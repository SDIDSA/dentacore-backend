#!/usr/bin/env bash
# Sera nightly maintenance: pg_dump + retention prune + offsite copy + audit trim.
# Intended to run from cron as the app user (who owns the self-contained PG in
# .prod-tools), connecting with .env credentials; see deploy/sera-backup.cron,
# prod.sh --backup-cron, or docs/HOSTING.md section 5.
#
# Environment:
#   APP_DIR               app root containing .env          (default: script's parent dir)
#   BACKUP_DIR            dump target                       (default: /var/backups/sera)
#   RETENTION_DAYS        local dump retention              (default: 14)
#   AUDIT_RETENTION_DAYS  audit_logs row retention in days  (default: 180; 0 disables)
#   OFFSITE_REMOTE        rclone destination, e.g. "remote:bucket/sera"; empty skips
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/sera}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
AUDIT_RETENTION_DAYS="${AUDIT_RETENTION_DAYS:-180}"
OFFSITE_REMOTE="${OFFSITE_REMOTE:-}"

get_env() { grep -E "^${1}=" "$APP_DIR/.env" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r'; }
DB_NAME="$(get_env DB_NAME)"; DB_NAME="${DB_NAME:-dentacore}"
DB_USER="$(get_env DB_USER)"; DB_USER="${DB_USER:-dentacore}"
DB_PORT="$(get_env DB_PORT)"; DB_PORT="${DB_PORT:-5434}"
DB_PASS="$(get_env DB_PASSWORD)"

# self-contained PG tools + server live under .prod-tools; connect over TCP (md5)
export PATH="$APP_DIR/.prod-tools/pgsql/bin:$PATH"
export PGHOST=127.0.0.1
export PGPORT="$DB_PORT"
export PGUSER="$DB_USER"
export PGPASSWORD="$DB_PASS"

mkdir -p "$BACKUP_DIR"

dump="$BACKUP_DIR/$DB_NAME-$(date +%F).dump"
echo "-- pg_dump -> $dump"
pg_dump -Fc -h "$PGHOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" > "$dump"

find "$BACKUP_DIR" -name '*.dump' -mtime "+$RETENTION_DAYS" -delete

if [ -n "$OFFSITE_REMOTE" ]; then
  if command -v rclone >/dev/null 2>&1; then
    echo "-- offsite copy -> $OFFSITE_REMOTE"
    rclone copy "$BACKUP_DIR" "$OFFSITE_REMOTE" --max-age 48h
  else
    echo "WARNING: OFFSITE_REMOTE set but rclone is not installed — skipping offsite copy" >&2
  fi
fi

if [ "$AUDIT_RETENTION_DAYS" -gt 0 ]; then
  psql -h "$PGHOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
    -c "DELETE FROM audit_logs WHERE created_at < now() - interval '${AUDIT_RETENTION_DAYS} days'"
fi

echo "-- backup done: $dump"
