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
#   --systemd              Register a systemd service (auto-start on boot)
#   --port PORT            Override listening port (default: 80; 4000 under --systemd)
#   --seed                 Load seed.sql demo data
#   --backup-cron [remote] Install nightly backup cron
#
# Usage:
#   bash prod.sh                       # direct HTTP-only on port 80 (run as root)
#   bash prod.sh --systemd --seed      # TLS: nginx 443 -> backend on 4000
#   bash prod.sh --backup-cron rclone-remote:bucket/sera
#
set -euo pipefail

# ── flags ───────────────────────────────────────────────────────
PORT="${PORT:-80}"
PORT_SET=no
WITH_SYSTEMD=no
WITH_SEED=no
WITH_BACKUP_CRON=no
OFFSITE_REMOTE="${OFFSITE_REMOTE:-}"
NODE_VERSION="${NODE_VERSION:-22.16.0}"
PG_VERSION="${PG_VERSION:-18.6}"
while [ $# -gt 0 ]; do
  case "$1" in
    --systemd) WITH_SYSTEMD=yes ;;
    --port)    PORT="$2"; PORT_SET=yes; shift ;;
    --seed)    WITH_SEED=yes ;;
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

pg_stop() {
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

# ── main ────────────────────────────────────────────────────────
echo "== Sera backend bootstrap + startup =="

ensure_node
ensure_pgsql
export PATH="$NODE_DIR/bin:$PG_DIR/bin:$PATH"

echo "   Node $(node -v) ready"
echo "   PG   $(psql --version) ready"

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

# ── apply explicit --port to .env ──────────────────────────────
if [ "$PORT_SET" = "yes" ]; then
  if grep -qE '^PORT=' .env; then
    sed -i "s/^PORT=.*/PORT=${PORT}/" .env
  else
    printf 'PORT=%s\n' "${PORT}" >> .env
  fi
fi

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
  initdb -D "$PG_DATA" -U "$DB_USER" -E UTF8 --locale=C 2>/dev/null

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
pg_isready -h 127.0.0.1 -p $PG_PORT -q 2>/dev/null || {
  echo "-- starting PostgreSQL --"
  pg_ctl start -D "$PG_DATA" -l "$TOOLS_DIR/pg_ctl.log" -w >/dev/null 2>&1 || true
  for i in $(seq 1 40); do
    sleep 0.5
    if pg_isready -h 127.0.0.1 -p $PG_PORT -q 2>/dev/null; then break; fi
  done
  if ! pg_isready -h 127.0.0.1 -p $PG_PORT -q 2>/dev/null; then
    echo "ERROR: pg_ctl start failed" >&2
    tail -20 "$TOOLS_DIR/pg_ctl.log" 2>/dev/null || true
    exit 1
  fi
}
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

# ── apply base schema (idempotent) ─────────────────────────────
echo "-- applying schema (db.sql) --"
PGPASSWORD="$DB_PASS" psql -h 127.0.0.1 -p $PG_PORT -U "$DB_USER" -d "$DB_NAME" \
  -v ON_ERROR_STOP=1 -f db.sql 2>/dev/null || {
  echo "WARNING: schema apply returned non-zero (tables may already exist)"
}
echo "   schema OK"

# ── optional: seed data (--seed) ────────────────────────────────
if [ "$WITH_SEED" = "yes" ]; then
  echo "   WARNING: --seed loads DEMO data with published passwords"
  PGPASSWORD="$DB_PASS" psql -h 127.0.0.1 -p $PG_PORT -U "$DB_USER" -d "$DB_NAME" \
    -f seed.sql 2>/dev/null
fi

# ── systemd unit (--systemd) ───────────────────────────────────
if [ "$WITH_SYSTEMD" = "yes" ]; then
  echo "-- installing systemd service --"
  SVC_USER="${SVC_USER:-sera}"
  id -u "$SVC_USER" >/dev/null 2>&1 || useradd -r -s /usr/sbin/nologin "$SVC_USER"
  chown -R "$SVC_USER":"$SVC_USER" "$SCRIPT_DIR"
  cat > /etc/systemd/system/sera.service <<UNIT
[Unit]
Description=Sera API
After=network.target

[Service]
Type=simple
User=$SVC_USER
WorkingDirectory=$SCRIPT_DIR
Environment=NODE_ENV=production
Environment=PORT=$PORT
Environment=DB_HOST=127.0.0.1
Environment=DB_PORT=$PG_PORT
EnvironmentFile=$SCRIPT_DIR/.env
ExecStartPre=$PG_DIR/bin/pg_ctl start -D $PG_DATA -l $TOOLS_DIR/pg_ctl.log -w
ExecStop=$PG_DIR/bin/pg_ctl stop -D $PG_DATA -m fast -w
ExecStart=$NODE_DIR/bin/node server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
  systemctl daemon-reload
  systemctl enable --now sera
  echo "-- service installed: systemctl status sera --"
fi

# ── nightly backup + maintenance cron (--backup-cron) ───────────
if [ "$WITH_BACKUP_CRON" = "yes" ]; then
  echo "-- installing nightly backup cron --"
  SVC_USER="${SVC_USER:-sera}"
  id -u "$SVC_USER" >/dev/null 2>&1 || useradd -r -s /usr/sbin/nologin "$SVC_USER"
  install -d -o "$SVC_USER" -g "$SVC_USER" /var/backups/sera
  touch /var/log/sera-backup.log
  chown "$SVC_USER":"$SVC_USER" /var/log/sera-backup.log
  sed -e "s|__APP_DIR__|${SCRIPT_DIR}|g" \
      -e "s|__SVC_USER__|${SVC_USER}|g" \
      -e "s|__OFFSITE__|${OFFSITE_REMOTE}|g" \
      deploy/sera-backup.cron > /etc/cron.d/sera-backup
  chmod 644 /etc/cron.d/sera-backup
  echo "-- backup cron installed: /etc/cron.d/sera-backup -> /var/backups/sera (user $SVC_USER)"
  if [ -n "$OFFSITE_REMOTE" ]; then
    echo "   offsite destination: $OFFSITE_REMOTE"
  else
    echo "   WARNING: no offsite remote — dumps stay local only."
  fi
fi

# ── install npm deps if needed ──────────────────────────────────
if [ ! -f "$SCRIPT_DIR/node_modules/.package-lock.json" ]; then
  echo "-- installing production dependencies --"
  npm ci --omit=dev 2>/dev/null || npm install --omit=dev 2>/dev/null
fi

# ── banner ──────────────────────────────────────────────────────
echo ""
echo "=================================="
echo "  Sera backend"
echo "  PostgreSQL: 127.0.0.1:$PG_PORT"
echo "  API:        http://localhost:$PORT"
if [ "$PORT" = "80" ] && [ "$WITH_SYSTEMD" != "yes" ]; then echo "  Public:     http://<your-public-ip>/ (HTTP-only, site + API same-origin)"; fi
echo "  Node:       v$NODE_VERSION (local)"
echo "  Ctrl+C to stop"
echo "=================================="
echo ""

# ── start server ────────────────────────────────────────────────
exec node server.js
