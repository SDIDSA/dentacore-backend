#!/usr/bin/env bash
#
# Sera backend — self-contained production bootstrap + startup (Linux).
#
# Downloads its own Node.js and PostgreSQL binaries, starts a local PG instance,
# creates .env with generated secrets on first run, provisions the DB role + database,
# applies the schema, and runs the server. Ctrl+C to stop — PG shuts down gracefully,
# data persists across runs.
#
# Flags:
#   --systemd              (root) Bootstrap as the service user + install/start the
#                          `sera` systemd service (auto-start on boot), then exit
#   --backup-cron [remote] (root) Install the nightly backup cron, then exit
#   --port PORT            Override listening port (default: 80; 4000 under --systemd)
#   --seed                 Load seed.sql demo data (published passwords - never in prod)
#   --bootstrap-only       Provision everything (binaries, .env, DB, schema, deps)
#                          then stop PG and exit without starting the server
#
# Usage:
#   bash prod.sh --port 4000                       # foreground, as a normal user
#   sudo bash prod.sh --systemd                    # production: service on :4000 behind nginx
#   sudo bash prod.sh --backup-cron remote:bucket/sera
#   sudo bash prod.sh --systemd --backup-cron      # both in one go
#
# PostgreSQL refuses to run as root, so root never touches PG itself: under
# --systemd it creates the service user (SVC_USER, default `sera`), hands it the
# app dir, and re-runs this script as that user with --bootstrap-only.
#
set -euo pipefail

# ── flags ───────────────────────────────────────────────────────
PORT="${PORT:-80}"
PORT_SET=no
WITH_SYSTEMD=no
WITH_SEED=no
WITH_BACKUP_CRON=no
BOOTSTRAP_ONLY=no
OFFSITE_REMOTE="${OFFSITE_REMOTE:-}"
NODE_VERSION="${NODE_VERSION:-22.16.0}"
PG_VERSION="${PG_VERSION:-18.6}"
while [ $# -gt 0 ]; do
  case "$1" in
    --systemd) WITH_SYSTEMD=yes ;;
    --port)    PORT="$2"; PORT_SET=yes; shift ;;
    --seed)    WITH_SEED=yes ;;
    --bootstrap-only) BOOTSTRAP_ONLY=yes ;;
    --backup-cron)
      WITH_BACKUP_CRON=yes
      if [ -n "${2:-}" ] && [ "${2:-}" != --* ]; then OFFSITE_REMOTE="$2"; shift; fi
      ;;
    *) echo "WARNING: unknown argument: $1" ;;
  esac
  shift
done

# ── default 80; --systemd re-homes to 4000 ──────────────────────
# Port 80 is the default so a plain foreground `bash prod.sh` serves the site +
# API at http://<host>/ with no port. The systemd service runs as an unprivileged
# user (no CAP_NET_BIND_SERVICE) and follows the nginx + certbot TLS topology, so
# unless --port was passed explicitly we re-home it to 4000 (nginx fronts 443 -> 4000).
if [ "$WITH_SYSTEMD" = "yes" ] && [ "$PORT_SET" = "no" ]; then
  PORT=4000
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
ENV_FILE="$SCRIPT_DIR/.env"
FIRST_RUN=no
[ ! -f "$ENV_FILE" ] && FIRST_RUN=yes

TOOLS_DIR="$SCRIPT_DIR/.prod-tools"
CACHE_DIR="$TOOLS_DIR/cache"
NODE_DIR="$TOOLS_DIR/node-v$NODE_VERSION-linux-x64"
PG_DIR="$TOOLS_DIR/pgsql"
PG_DATA="$PG_DIR/data"
PG_PORT=5434

# ── helpers ─────────────────────────────────────────────────────
sql_escape() { printf '%s' "$1" | sed "s/'/''/g"; }
get_env() { grep -E "^${1}=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r'; }

PG_STARTED=no
pg_stop() {
  # only stop an instance this run started (never pull PG out from under a running service)
  [ "$PG_STARTED" = "yes" ] || return 0
  if [ -x "$PG_DIR/bin/pg_ctl" ] && [ -d "$PG_DATA" ]; then
    echo "Stopping PostgreSQL..."
    "$PG_DIR/bin/pg_ctl" stop -D "$PG_DATA" -m fast -w 2>/dev/null || true
  fi
}
trap pg_stop EXIT

# ── ensure Node.js (download + cache) ──────────────────────────
ensure_node() {
  if [ -x "$NODE_DIR/bin/node" ]; then return; fi
  echo "Downloading Node.js v$NODE_VERSION..."
  mkdir -p "$CACHE_DIR"
  local tarball="$CACHE_DIR/node-v$NODE_VERSION-linux-x64.tar.xz"
  if [ ! -f "$tarball" ]; then
    curl -fsSL "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.xz" -o "$tarball"
    if [ "$(stat -f%z "$tarball" 2>/dev/null || stat -c%s "$tarball")" -lt 1048576 ]; then
      rm -f "$tarball"
      echo "ERROR: Node.js download failed" >&2; exit 1
    fi
  fi
  tar -xf "$tarball" -C "$TOOLS_DIR"
  if [ ! -x "$NODE_DIR/bin/node" ]; then
    echo "ERROR: Node.js extraction failed" >&2; exit 1
  fi
  echo "  Node v$NODE_VERSION ready"
}

# ── ensure PostgreSQL (Percona binaries, download + cache) ──────
ensure_pgsql() {
  if [ -x "$PG_DIR/bin/pg_ctl" ]; then return; fi
  echo "Downloading PostgreSQL $PG_VERSION (Percona)..."
  mkdir -p "$CACHE_DIR"
  local tarball="$CACHE_DIR/percona-pg$PG_VERSION.tar.gz"
  if [ ! -f "$tarball" ]; then
    curl -fsSL "https://downloads.percona.com/downloads/postgresql-distribution-${PG_VERSION%%.*}/${PG_VERSION}/binary/tarball/percona-postgresql-${PG_VERSION}-ssl3-linux-x86_64.tar.gz" -o "$tarball"
    local size
    size=$(stat -f%z "$tarball" 2>/dev/null || stat -c%s "$tarball")
    if [ "$size" -lt 1048576 ]; then
      rm -f "$tarball"
      echo "ERROR: PostgreSQL download failed" >&2; exit 1
    fi
  fi
  echo "  Extracting ./percona-postgresql${PG_VERSION%%.*}/ only..."
  mkdir -p "$PG_DIR"
  # ./percona-postgresql18/ is two path components ('.' + dir), so strip 2
  tar -xf "$tarball" --strip-components=2 -C "$PG_DIR" "./percona-postgresql${PG_VERSION%%.*}/"
  if [ ! -x "$PG_DIR/bin/pg_ctl" ]; then
    echo "ERROR: PostgreSQL extraction failed" >&2; exit 1
  fi
  echo "  PostgreSQL $PG_VERSION ready"
}

# Ensure the PostgreSQL binaries can actually load (they need libnuma.so.1 etc.
# that minimal/cloud images often lack). Best-effort install when root+apt,
# otherwise fail with a clear prerequisite message instead of a cryptic ldd error.
ensure_pg_libs() {
  local postgres_bin="$PG_DIR/bin/postgres"
  [ -x "$postgres_bin" ] || return 0
  local missing
  missing=$(ldd "$postgres_bin" 2>/dev/null | awk -F'=> ' '/not found/{gsub(/[ \t]/,"",$1); print $1}' | sort -u)
  [ -n "$missing" ] || return 0

  echo "PostgreSQL is missing system libraries on this host:"
  echo "$missing" | sed 's/^/   - /'

  if [ "$(id -u 2>/dev/null || echo 1)" -eq 0 ] && command -v apt-get >/dev/null 2>&1; then
    echo "Attempting to install runtime dependencies (libnuma1)..."
    if apt-get update -qq >/dev/null 2>&1 && apt-get install -y libnuma1 >/dev/null 2>&1; then
      missing=$(ldd "$postgres_bin" 2>/dev/null | awk -F'=> ' '/not found/{gsub(/[ \t]/,"",$1); print $1}' | sort -u)
      [ -z "$missing" ] && { echo "   runtime dependencies installed"; return 0; }
    fi
  fi

  echo "ERROR: missing shared libraries required by PostgreSQL:" >&2
  echo "$missing" | sed 's/^/   - /' >&2
  echo "       On Debian/Ubuntu install them, e.g.:  apt-get install -y libnuma1" >&2
  echo "       then re-run prod.sh." >&2
  exit 1
}

# ── main ────────────────────────────────────────────────────────
echo "== Sera backend bootstrap + startup =="

IS_ROOT=no
[ "$(id -u 2>/dev/null || echo 1)" -eq 0 ] && IS_ROOT=yes
SVC_USER="${SVC_USER:-sera}"

# ── privileged actions (root): service user, systemd unit, backup cron ──
if [ "$WITH_SYSTEMD" = "yes" ] || [ "$WITH_BACKUP_CRON" = "yes" ]; then
  if [ "$IS_ROOT" != "yes" ]; then
    echo "ERROR: --systemd / --backup-cron install system files; run with sudo." >&2
    exit 1
  fi
  id -u "$SVC_USER" >/dev/null 2>&1 || useradd -r -m -d "/home/$SVC_USER" -s /usr/sbin/nologin "$SVC_USER"
  chown -R "$SVC_USER":"$SVC_USER" "$SCRIPT_DIR"

  if [ "$WITH_SYSTEMD" = "yes" ]; then
    # PostgreSQL needs libnuma on minimal/cloud images; install it while we are root.
    if command -v apt-get >/dev/null 2>&1 && ! ldconfig -p 2>/dev/null | grep -q 'libnuma.so.1'; then
      echo "-- installing libnuma1 (PostgreSQL runtime dependency) --"
      apt-get update -qq >/dev/null 2>&1 && apt-get install -y -qq libnuma1 >/dev/null 2>&1 || true
    fi

    echo "-- bootstrapping as $SVC_USER --"
    boot_args=(--bootstrap-only --port "$PORT")
    [ "$WITH_SEED" = "yes" ] && boot_args+=(--seed)
    runuser -u "$SVC_USER" -- env NODE_VERSION="$NODE_VERSION" PG_VERSION="$PG_VERSION" \
      bash "$SCRIPT_DIR/prod.sh" "${boot_args[@]}"

    echo "-- installing systemd service --"
    sed -e "s|__APP_DIR__|${SCRIPT_DIR}|g" \
        -e "s|__SVC_USER__|${SVC_USER}|g" \
        -e "s|__PORT__|${PORT}|g" \
        -e "s|__PG_PORT__|${PG_PORT}|g" \
        -e "s|__PG_BIN__|${PG_DIR}/bin|g" \
        -e "s|__PG_DATA__|${PG_DATA}|g" \
        -e "s|__TOOLS_DIR__|${TOOLS_DIR}|g" \
        -e "s|__NODE_BIN__|${NODE_DIR}/bin/node|g" \
        deploy/sera.service > /etc/systemd/system/sera.service
    systemctl daemon-reload
    systemctl enable sera >/dev/null 2>&1
    systemctl restart sera
    echo "   service installed + started: systemctl status sera / journalctl -u sera -f"
    echo "   API on http://127.0.0.1:$PORT - front it with nginx + certbot (docs/HOSTING.md)"
  fi

  if [ "$WITH_BACKUP_CRON" = "yes" ]; then
    echo "-- installing nightly backup cron --"
    install -d -o "$SVC_USER" -g "$SVC_USER" /var/backups/sera
    touch /var/log/sera-backup.log
    chown "$SVC_USER":"$SVC_USER" /var/log/sera-backup.log
    sed -e "s|__APP_DIR__|${SCRIPT_DIR}|g" \
        -e "s|__SVC_USER__|${SVC_USER}|g" \
        -e "s|__OFFSITE__|${OFFSITE_REMOTE}|g" \
        deploy/sera-backup.cron > /etc/cron.d/sera-backup
    chmod 644 /etc/cron.d/sera-backup
    echo "   backup cron installed: /etc/cron.d/sera-backup -> /var/backups/sera (user $SVC_USER)"
    if [ -n "$OFFSITE_REMOTE" ]; then
      echo "   offsite destination: $OFFSITE_REMOTE"
    else
      echo "   WARNING: no offsite remote - dumps stay local only."
    fi
  fi
  trap - EXIT
  exit 0
fi

if [ "$IS_ROOT" = "yes" ]; then
  echo "ERROR: PostgreSQL cannot run as the root user." >&2
  echo "       Production: sudo bash prod.sh --systemd   (runs as the '$SVC_USER' service user)" >&2
  echo "       Foreground test: run as a normal user, e.g.  bash prod.sh --port 4000" >&2
  exit 1
fi

# npm cache inside the app dir (service users may have no writable home)
export npm_config_cache="$TOOLS_DIR/npm-cache"
mkdir -p "$TOOLS_DIR"

ensure_node
ensure_pgsql
export PATH="$NODE_DIR/bin:$PG_DIR/bin:$PATH"

echo "   Node $(node -v) ready"
echo "   PG   $(psql --version) ready"

ensure_pg_libs

# ── privileged port (ports < 1024) ─────────────────────────────
# PostgreSQL refuses to run as root, so the script runs as a normal user.
# To serve on a privileged port (default 80) we grant the node binary the
# CAP_NET_BIND_SERVICE capability once (needs root: sudo setcap ...); the
# capability then persists across runs. If it can't be granted, the node
# server would fail to bind, so we error out early with the fix (or point at
# the nginx/Caddy reverse-proxy path in docs/HOSTING.md).
if [ "$BOOTSTRAP_ONLY" != "yes" ] && [ "$PORT" -lt 1024 ]; then
  node_bin="$NODE_DIR/bin/node"
  node_real="$(readlink -f "$node_bin" 2>/dev/null || echo "$node_bin")"
  if command -v setcap >/dev/null 2>&1 && [ -f "$node_real" ]; then
    if ! setcap "cap_net_bind_service=+ep" "$node_real" 2>/dev/null; then
      if command -v sudo >/dev/null 2>&1; then
        sudo -n setcap "cap_net_bind_service=+ep" "$node_real" 2>/dev/null || true
      fi
    fi
  fi
  if ! getcap "$node_real" 2>/dev/null | grep -q 'cap_net_bind_service'; then
    echo "ERROR: port $PORT is privileged; binding it requires CAP_NET_BIND_SERVICE or root." >&2
    echo "       Grant the capability once (as root):" >&2
    echo "         sudo setcap cap_net_bind_service=+ep $node_real" >&2
    echo "       then re-run (the capability persists across runs)." >&2
    echo "       Or front the backend with nginx/Caddy on :80 -> :4000 (recommended for prod)." >&2
    exit 1
  fi
  echo "   node granted cap_net_bind_service (can bind :$PORT as non-root)"
fi

# ── create .env from template (first run) ──────────────────────
if [ "$FIRST_RUN" = "yes" ]; then
  echo "-- creating .env from .env.example --"
  cp .env.example .env
  if command -v openssl >/dev/null; then
    DB_PW="$(openssl rand -hex 16)"
    JWT_SEC="$(openssl rand -hex 32)"
    JWT_REF="$(openssl rand -hex 32)"
    sed -i \
      -e "s/^DB_PASSWORD=.*/DB_PASSWORD=${DB_PW}/" \
      -e "s/^JWT_SECRET=.*/JWT_SECRET=${JWT_SEC}/" \
      -e "s/^JWT_REFRESH_SECRET=.*/JWT_REFRESH_SECRET=${JWT_REF}/" \
      -e "s/^PORT=.*/PORT=${PORT}/" \
      -e "s/^NODE_ENV=.*/NODE_ENV=production/" \
      .env
    echo "   generated DB_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET"
  else
    echo "   WARNING: openssl missing — edit secrets in .env manually"
  fi
else
  echo "-- .env already exists, skipping creation --"
fi

# ── apply effective PORT to .env (default 80, or --port override) ──
if grep -qE '^PORT=' .env; then
  sed -i "s/^PORT=.*/PORT=${PORT}/" .env
else
  printf 'PORT=%s\n' "${PORT}" >> .env
fi

chmod 600 .env   # secrets: owner-only on every run (also fixes older installs)

# force local PG settings
sed -i "s/^DB_HOST=.*/DB_HOST=127.0.0.1/" .env 2>/dev/null || echo "DB_HOST=127.0.0.1" >> .env
sed -i "s/^DB_PORT=.*/DB_PORT=${PG_PORT}/" .env 2>/dev/null || echo "DB_PORT=${PG_PORT}" >> .env

# ── read DB config from .env ───────────────────────────────────
DB_NAME="$(get_env DB_NAME)";  DB_NAME="${DB_NAME:-dentacore}"
DB_USER="$(get_env DB_USER)";  DB_USER="${DB_USER:-dentacore}"
DB_PASS="$(get_env DB_PASSWORD)"

# ── init PG data dir if needed ─────────────────────────────────
if [ ! -f "$PG_DATA/postgresql.conf" ]; then
  echo "-- initializing PostgreSQL data dir --"
  mkdir -p "$PG_DATA"
  set +e
  initdb -D "$PG_DATA" -U "$DB_USER" -E UTF8 --locale=C 2>"$TOOLS_DIR/initdb_err.txt"
  init_rc=$?
  set -e
  if [ "$init_rc" -ne 0 ]; then
    echo "ERROR: initdb failed" >&2
    cat "$TOOLS_DIR/initdb_err.txt" >&2
    exit 1
  fi

  sed -i "s/^[# ]*port[[:space:]]*=.*/port = $PG_PORT/" "$PG_DATA/postgresql.conf"
  echo "listen_addresses = '127.0.0.1'" >> "$PG_DATA/postgresql.conf"
  echo "unix_socket_directories = '$PG_DATA'" >> "$PG_DATA/postgresql.conf"
  echo "shared_buffers = 128MB" >> "$PG_DATA/postgresql.conf"
  echo "logging_collector = on" >> "$PG_DATA/postgresql.conf"
  echo "log_directory = '$TOOLS_DIR'" >> "$PG_DATA/postgresql.conf"
  echo "log_filename = 'pg.log'" >> "$PG_DATA/postgresql.conf"

  echo "local all all trust" > "$PG_DATA/pg_hba.conf"
  echo "host all all 127.0.0.1/32 md5" >> "$PG_DATA/pg_hba.conf"
  echo "host all all ::1/128 md5" >> "$PG_DATA/pg_hba.conf"

  echo "   data dir initialized (port $PG_PORT)"
fi

# ── start PG ───────────────────────────────────────────────────
# Clear a stale pid file left behind if a previous run was killed hard.
if [ -f "$PG_DATA/postmaster.pid" ]; then
  old_pid=$(head -1 "$PG_DATA/postmaster.pid" 2>/dev/null | tr -d ' ')
  if [ -n "$old_pid" ] && ! kill -0 "$old_pid" 2>/dev/null; then
    echo "   removing stale postmaster.pid (PID $old_pid not running)"
    rm -f "$PG_DATA/postmaster.pid"
  fi
fi

echo "-- starting PostgreSQL --"
if pg_isready -h 127.0.0.1 -p $PG_PORT -q 2>/dev/null; then
  echo "   PostgreSQL already running on 127.0.0.1:$PG_PORT"
else
  # Clear a stale pid file left behind if a previous run was killed hard.
  if [ -f "$PG_DATA/postmaster.pid" ]; then
    old_pid=$(head -1 "$PG_DATA/postmaster.pid" 2>/dev/null | tr -d ' ')
    if [ -n "$old_pid" ] && ! kill -0 "$old_pid" 2>/dev/null; then
      echo "   removing stale postmaster.pid (PID $old_pid not running)"
      rm -f "$PG_DATA/postmaster.pid"
    fi
  fi

  if ! pg_ctl start -D "$PG_DATA" -l "$TOOLS_DIR/pg_ctl.log" -w; then
    echo "ERROR: pg_ctl start failed" >&2
    tail -30 "$TOOLS_DIR/pg_ctl.log" 2>/dev/null
    echo "       If port $PG_PORT is already in use, stop the other instance first." >&2
    exit 1
  fi
  PG_STARTED=yes
fi
for i in $(seq 1 40); do
  sleep 0.5
  if pg_isready -h 127.0.0.1 -p $PG_PORT -q 2>/dev/null; then break; fi
done
if ! pg_isready -h 127.0.0.1 -p $PG_PORT -q 2>/dev/null; then
  echo "ERROR: PostgreSQL did not become ready" >&2
  tail -30 "$TOOLS_DIR/pg_ctl.log" 2>/dev/null
  exit 1
fi
echo "   PostgreSQL running on 127.0.0.1:$PG_PORT"

# ── create role + database (first run) ───────────────────────────
# initdb -U $DB_USER already created $DB_USER as a superuser. Set its password
# over the local socket (trust auth in the fresh data dir), then create DB.
psql -h "$PG_DATA" -p $PG_PORT -U "$DB_USER" -d postgres -c \
  "ALTER ROLE $DB_USER WITH LOGIN PASSWORD '$(sql_escape "$DB_PASS")' SUPERUSER;" >/dev/null 2>&1 || {
  echo "ERROR: could not set password for role $DB_USER" >&2
  exit 1
}
echo "   role $DB_USER password set"

export PGPASSWORD="$DB_PASS"
db_exists=$(psql -h 127.0.0.1 -p $PG_PORT -U "$DB_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null || true)
if [ "$db_exists" != "1" ]; then
  psql -h 127.0.0.1 -p $PG_PORT -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME OWNER $DB_USER" >/dev/null 2>&1
  echo "   created database $DB_NAME"
else
  echo "   database $DB_NAME already exists"
fi

# ── strip a leading UTF-8 BOM (psql chokes on it) ──────────────
strip_bom() {
  local f="$1"
  if [ "$(head -c3 "$f")" = "$(printf '\xef\xbb\xbf')" ]; then
    local t
    t="$(mktemp)"
    tail -c +4 "$f" > "$t"
    echo "$t"
  else
    echo "$f"
  fi
}

# ── apply base schema (idempotent) ─────────────────────────────
echo "-- applying schema (db.sql) --"
DBSQL=$(strip_bom db.sql)
PGPASSWORD="$DB_PASS" psql -h 127.0.0.1 -p $PG_PORT -U "$DB_USER" -d "$DB_NAME" \
  -v ON_ERROR_STOP=1 -f "$DBSQL" 2>"$TOOLS_DIR/schema_err.txt" || {
  echo "WARNING: schema apply returned non-zero (tables may already exist)"
  echo "--- db.sql psql output (tail) ---"
  tail -n 40 "$TOOLS_DIR/schema_err.txt"
}
echo "   schema OK"

# ── apply production system seed (idempotent: roles, plans, categories) ──
# Own step so it always runs even if db.sql aborts on a re-apply.
echo "-- applying production seed (seed-prod.sql) --"
SEEDPRODSQL=$(strip_bom seed-prod.sql)
PGPASSWORD="$DB_PASS" psql -h 127.0.0.1 -p $PG_PORT -U "$DB_USER" -d "$DB_NAME" \
  -v ON_ERROR_STOP=1 -f "$SEEDPRODSQL" 2>"$TOOLS_DIR/seed_err.txt" || {
  echo "WARNING: seed-prod.sql apply returned non-zero"
  echo "--- seed-prod.sql psql output (tail) ---"
  tail -n 40 "$TOOLS_DIR/seed_err.txt"
}
echo "   seed OK"

# ── optional: seed data (--seed) ────────────────────────────────
if [ "$WITH_SEED" = "yes" ]; then
  echo "   WARNING: --seed loads DEMO data with published passwords"
  DEMOSQL=$(strip_bom seed.sql)
  PGPASSWORD="$DB_PASS" psql -h 127.0.0.1 -p $PG_PORT -U "$DB_USER" -d "$DB_NAME" \
    -f "$DEMOSQL" 2>"$TOOLS_DIR/demo_err.txt" || {
    echo "--- seed.sql psql output (tail) ---"
    tail -n 40 "$TOOLS_DIR/demo_err.txt"
  }
fi

# ── install npm deps if needed ──────────────────────────────────
if [ ! -f "$SCRIPT_DIR/node_modules/.package-lock.json" ]; then
  echo "-- installing production dependencies --"
  npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund
fi

if [ "$BOOTSTRAP_ONLY" = "yes" ]; then
  echo "-- bootstrap complete (PostgreSQL will stop; the service starts it) --"
  exit 0
fi

# ── banner ──────────────────────────────────────────────────────
echo ""
echo "=================================="
echo "  Sera backend"
echo "  PostgreSQL: 127.0.0.1:$PG_PORT"
echo "  API:        http://localhost:$PORT"
if [ "$PORT" = "80" ]; then echo "  Public:     http://<your-public-ip>/ (HTTP-only, site + API same-origin)"; fi
echo "  Node:       v$NODE_VERSION (local)"
echo "  Ctrl+C to stop"
echo "=================================="
echo ""

# ── start server ────────────────────────────────────────────────
exec node server.js
