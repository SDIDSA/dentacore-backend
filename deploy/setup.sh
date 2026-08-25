#!/usr/bin/env bash
# Sera backend bootstrap for Ubuntu 22.04/24.04.
# Run from the extracted folder:
#   sudo bash deploy/setup.sh [--systemd] [--port PORT] [--seed] [--backup-cron [rclone-remote]]
set -euo pipefail

PORT="${PORT:-4000}"
WITH_SYSTEMD=no
WITH_SEED=no
WITH_BACKUP_CRON=no
OFFSITE_REMOTE="${OFFSITE_REMOTE:-}"
while [ $# -gt 0 ]; do
  case "$1" in
    --systemd) WITH_SYSTEMD=yes ;;
    --port) PORT="$2"; shift ;;
    --seed) WITH_SEED=yes ;;
    --backup-cron)
      WITH_BACKUP_CRON=yes
      if [ -n "${2:-}" ] && [ "${2:-}" != --* ]; then OFFSITE_REMOTE="$2"; shift; fi
      ;;
    *) echo "WARNING: unknown argument: $1" ;;
  esac
  shift
done

echo "== Sera backend bootstrap =="

# ── install Node.js >= 20 if missing or too old ────────────────
install_node() {
  echo "-- installing Node.js 22 via nodesource --"
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
}

node_ok() {
  command -v node >/dev/null || return 1
  local major
  major="$(node -e 'process.stdout.write(String(parseInt(process.version.slice(1))))')"
  [ "$major" -ge 20 ]
}

if ! node_ok; then
  install_node
  # verify after install
  if ! node_ok; then
    echo "ERROR: Node.js >= 20 could not be installed"; exit 1
  fi
fi
echo "   Node $(node -v) ready"

# ── install PostgreSQL if missing ───────────────────────────────
install_postgres() {
  echo "-- installing PostgreSQL --"
  apt-get update -qq
  apt-get install -y -qq postgresql postgresql-contrib
}

if ! command -v psql >/dev/null 2>&1; then
  install_postgres
fi

# ensure pg_isready is available (comes with postgresql package)
if ! command -v pg_isready >/dev/null 2>&1; then
  install_postgres
fi

# start the service if it's installed but not running
if command -v systemctl >/dev/null 2>&1 && systemctl is-enabled postgresql >/dev/null 2>&1; then
  if ! systemctl is-active --quiet postgresql; then
    echo "-- starting PostgreSQL service --"
    systemctl start postgresql
  fi
fi

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

# ── install production dependencies ────────────────────────────
echo "-- installing production dependencies --"
npm ci --omit=dev

# ── create .env from template ──────────────────────────────────
if [ ! -f .env ]; then
  echo "-- creating .env from .env.example --"
  cp .env.example .env

  # auto-generate secrets via openssl
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

# ── PostgreSQL setup ───────────────────────────────────────────
get_env() { grep -E "^${1}=" .env | tail -1 | cut -d= -f2-; }
sql_escape() { printf '%s' "$1" | sed "s/'/''/g"; }
DB_HOST="$(get_env DB_HOST)";  DB_HOST="${DB_HOST:-localhost}"
DB_NAME="$(get_env DB_NAME)";  DB_NAME="${DB_NAME:-dentacore}"
DB_USER="$(get_env DB_USER)";  DB_USER="${DB_USER:-dentacore}"
DB_PASS="$(get_env DB_PASSWORD)"
DB_PASS_SQL="$(sql_escape "$DB_PASS")"

# Local cluster: detect the apt-managed port (5432 by default) and align .env —
# the shipped template carries the Windows/dev port 5434, which is wrong here.
if [ "$DB_HOST" = "localhost" ] || [ "$DB_HOST" = "127.0.0.1" ]; then
  DB_PORT=""
  if command -v pg_lsclusters >/dev/null 2>&1; then
    DB_PORT="$(pg_lsclusters --no-header 2>/dev/null | awk '$4 == "online" { print $3; exit }')"
  fi
  DB_PORT="${DB_PORT:-5432}"
  if ! grep -qx "DB_PORT=${DB_PORT}" .env; then
    sed -i "s/^DB_PORT=.*/DB_PORT=${DB_PORT}/" .env
    echo "   aligned DB_PORT in .env to the local cluster (${DB_PORT})"
  fi
else
  # Remote database: trust whatever the operator configured
  DB_PORT="$(get_env DB_PORT)"; DB_PORT="${DB_PORT:-5432}"
fi

echo "-- setting up PostgreSQL (${DB_HOST}:${DB_PORT}) --"

# Superuser access over the Unix socket (peer auth) — apt clusters do not
# allow passwordless TCP connections as `postgres`.
pg_superuser_psql() {
  if command -v runuser >/dev/null 2>&1; then
    runuser -u postgres -- psql "$@"
  elif [ "$(id -un)" = "postgres" ]; then
    psql "$@"
  else
    su -s /bin/sh postgres -c 'psql "$@"' sh "$@"
  fi
}

if ! echo "SELECT 1" | pg_superuser_psql -tAc "SELECT 1" >/dev/null 2>&1; then
  echo "   WARNING: cannot reach the cluster as postgres superuser."
  echo "   Assuming role '${DB_USER}' and database '${DB_NAME}' already exist;"
  echo "   schema application below will fail if they do not."
else
  # create role if missing, then rotate password to match .env
  echo "DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASS_SQL}';
  ELSE
    ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASS_SQL}';
  END IF;
END \$\$;" | pg_superuser_psql

  # create database if missing
  if [ "$(echo "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | pg_superuser_psql -tA)" != "1" ]; then
    echo "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}" | pg_superuser_psql
    echo "   created database ${DB_NAME}"
  else
    echo "   database ${DB_NAME} already exists"
  fi
fi

# ── apply base schema ──────────────────────────────────────────
echo "-- applying schema (db.sql) --"
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -f db.sql --set ON_ERROR_STOP=1

# ── optional: seed data (--seed) ────────────────────────────────
if [ "$WITH_SEED" = "yes" ]; then
  echo "   WARNING: --seed loads DEMO data with published passwords"
  echo "   (admin@elqods.dz / Admin@2025!, etc.) — change them immediately,"
  echo "   or do not use --seed on an internet-facing host."
  PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -f seed.sql --set ON_ERROR_STOP=1
fi

# ── systemd unit ───────────────────────────────────────────────
if [ "$WITH_SYSTEMD" = "yes" ]; then
  SVC_USER="${SVC_USER:-sera}"
  id -u "$SVC_USER" >/dev/null 2>&1 || useradd -r -s /usr/sbin/nologin "$SVC_USER"
  chown -R "$SVC_USER":"$SVC_USER" "$APP_DIR"
  sed -e "s|__APP_DIR__|${APP_DIR}|g" \
      -e "s|__SVC_USER__|${SVC_USER}|g" \
      -e "s|PORT=.*|PORT=${PORT}|" \
      deploy/sera.service > /etc/systemd/system/sera.service
  systemctl daemon-reload
  systemctl enable --now sera
  echo "-- service installed: systemctl status sera --"
fi

# ── nightly backup + maintenance cron ──────────────────────────
if [ "$WITH_BACKUP_CRON" = "yes" ]; then
  install -d -o postgres -g postgres /var/backups/sera
  touch /var/log/sera-backup.log
  chown postgres:postgres /var/log/sera-backup.log
  sed -e "s|__APP_DIR__|${APP_DIR}|g" \
      -e "s|__OFFSITE__|${OFFSITE_REMOTE}|g" \
      deploy/sera-backup.cron > /etc/cron.d/sera-backup
  chmod 644 /etc/cron.d/sera-backup
  echo "-- backup cron installed: /etc/cron.d/sera-backup -> /var/backups/sera"
  if [ -n "$OFFSITE_REMOTE" ]; then
    echo "   offsite destination: $OFFSITE_REMOTE (rclone config must exist for the postgres user)"
  else
    echo "   WARNING: no offsite remote configured — dumps stay local only."
    echo "   Re-run with: sudo bash deploy/setup.sh --backup-cron rclone-remote:bucket/sera"
  fi
fi

cat <<EOF

Done. Next steps (REQUIRED before go-live):
  1. Edit .env — set CORS_ORIGIN to your real frontend URL
     (dev defaults only allow localhost origins)
  2. Edit .env — fill in Cloudinary credentials; until then media/X-ray
     uploads will fail at runtime
  3. Review SMTP settings if booking emails are enabled
  4. If you ran --seed: CHANGE THE SEEDED ADMIN PASSWORDS NOW

Start manually:  NODE_ENV=production node server.js
                 (or use the systemd unit installed above)
Health check:    curl http://localhost:${PORT}/health
Full runbook:    docs/HOSTING.md

EOF
