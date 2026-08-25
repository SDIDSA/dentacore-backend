# Hosting Runbook

Production deployment guide for the Sera backend on Ubuntu 22.04/24.04.

## Prerequisites

- Ubuntu 22.04 or 24.04 LTS (must run as root or with sudo)
- Internet access (setup.sh installs Node.js and PostgreSQL when missing)

## Quick Deploy

```bash
# 1. Upload and extract
scp sera-backend-*.zip root@your-server:/opt/
ssh root@your-server
cd /opt && unzip sera-backend-*.zip && cd sera-backend

# 2. Run setup (installs everything, creates DB, applies schema)
sudo bash deploy/setup.sh --systemd

# 3. Verify
curl http://localhost:4000/health
```

## What setup.sh Does

1. Installs Node.js 22 via nodesource (if missing or < 20)
2. Installs PostgreSQL + starts the service (if missing)
3. Installs production npm dependencies (`npm ci --omit=dev`)
4. Creates `.env` from `.env.example` with auto-generated:
   - `DB_PASSWORD` (16-byte hex)
   - `JWT_SECRET` + `JWT_REFRESH_SECRET` (32-byte hex)
   - `PORT=4000`, `NODE_ENV=production`
5. Creates PostgreSQL role + database (when reachable as `postgres` superuser)
6. Applies `db.sql` base schema
7. With `--systemd`: creates a `sera` system user, installs and enables the service

## Options

| Flag | Description |
|------|-------------|
| `--systemd` | Install and enable the `sera` systemd service |
| `--port N` | Override listening port (default: 4000) |
| `--seed` | Load `seed.sql` demo data after schema |
| `--backup-cron [rclone-remote]` | Install `/etc/cron.d/sera-backup`: nightly `pg_dump -Fc` + 14-day dump retention + optional rclone offsite copy + 180-day `audit_logs` trim |

## Post-Deploy Checklist

1. **Review `.env`** — set `CORS_ORIGIN` to your frontend URL, configure Cloudinary/SMTP if needed
2. **Firewall** — open port 4000 (or your reverse proxy port)
3. **Reverse proxy** — see `deploy/nginx-sera.conf` for an nginx sample
4. **TLS** — `sudo certbot --nginx -d api.yourdomain.com`
5. **Backups** — run setup with `--backup-cron` (see Options), or schedule `pg_dump` manually

## Backups + Maintenance

Recommended: let setup.sh install the cron (runs as the `postgres` user):

```bash
# with offsite copy (configure rclone for the postgres user first:
#   sudo -u postgres rclone config
sudo bash deploy/setup.sh --backup-cron rclone-remote:bucket/sera
# or local-only (add a remote later by editing /etc/cron.d/sera-backup)
sudo bash deploy/setup.sh --backup-cron
```

`deploy/backup.sh` does all of it: nightly `pg_dump -Fc`, retention prune,
rclone copy when `OFFSITE_REMOTE` is set, and trims `audit_logs` older than
180 days (`AUDIT_RETENTION_DAYS`). Verify after the first night:
`cat /var/log/sera-backup.log && ls -lh /var/backups/sera`.

## Reverse Proxy (nginx)

A sample config is at `deploy/nginx-sera.conf`. Copy and adapt:

```bash
sudo cp deploy/nginx-sera.conf /etc/nginx/sites-available/sera
sudo ln -s /etc/nginx/sites-available/sera /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## System Management

```bash
# Service status
sudo systemctl status sera

# Logs
sudo journalctl -u sera -f

# Restart after .env change
sudo systemctl restart sera

# Manual run (without systemd)
cd /opt/sera-backend
NODE_ENV=production node server.js
```

## Database

```bash
# Connect
PGPASSWORD=<password> psql -h localhost -p 5432 -U dentacore -d dentacore
```

## Updating

```bash
# 1. Stop service
sudo systemctl stop sera

# 2. Backup database
pg_dump -h localhost -p 5432 -U dentacore -d dentacore > backup-$(date +%F).dump

# 3. Extract new zip over existing directory
cd /opt && unzip -o sera-backend-*.zip

# 4. Run setup (safe to re-run — skips DB creation, re-applies db.sql)
cd sera-backend && sudo bash deploy/setup.sh

# 5. Restart
sudo systemctl start sera
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `FATAL: role "dentacore" does not exist` | Run setup.sh with postgres superuser access, or create role manually |
| `FATAL: database "dentacore" does not exist` | Run setup.sh, or `createdb -h localhost -p 5432 -U dentacore dentacore` |
| `EACCES: permission denied` on uploads | `chown -R sera:sera /opt/sera-backend` |
| Port already in use | Change `PORT` in `.env` or stop the conflicting service |
