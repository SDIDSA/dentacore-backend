# Hosting Runbook

Production deployment guide for the Sera backend on Ubuntu 22.04/24.04 or Windows Server.

## Prerequisites

- Ubuntu 22.04 or 24.04 LTS (must run as root or with sudo) **or** Windows 10+ / Server 2019+
- Internet access (first run downloads Node.js + PostgreSQL binaries)

## Quick Deploy

```bash
# 1. Upload and extract
scp sera-backend-*.zip root@your-server:/opt/
ssh root@your-server
cd /opt && unzip sera-backend-*.zip && cd sera-backend

# 2. First run: downloads binaries, creates DB, applies schema, starts server
sudo bash prod.sh --systemd

# 3. Verify
curl http://localhost:4000/health
```

Windows:
```powershell
# 1. Extract the zip, open PowerShell as Administrator
cd C:\sera-backend

# 2. First run: downloads binaries, creates DB, applies schema, starts server
.\prod.ps1 -Service -Domain api.sera.dz

# 3. Verify
curl http://localhost:4000/health
```

## What prod.sh / prod.ps1 Does

1. Downloads Node.js binaries into `.prod-tools/node-*` (cached, ~30 MB)
2. Downloads PostgreSQL binaries into `.prod-tools/pgsql/` (cached, Windows: EDB ~50 MB, Linux: Percona ~304 MB, selective extract)
3. On first run:
   - Creates `.env` from `.env.example` with auto-generated secrets
   - Initializes PG data dir at `.prod-tools/pgsql/data/`
   - Creates role + database, applies `db.sql` schema
4. Starts PG via `pg_ctl start` (port 5434)
5. Installs production npm dependencies (`npm ci --omit=dev`)
6. With `-Domain`: installs Caddy as a Windows service with auto-TLS
7. Starts `node server.js`

Ctrl+C stops PG gracefully. Data persists in `.prod-tools/pgsql/data/` across runs.

## Options

| Flag | Description |
|------|-------------|
| `--systemd` / `-Service` | Install and enable the `sera` service (systemd on Linux, Scheduled Task on Windows) |
| `--port N` / `-Port N` | Override listening port (default: 80; 4000 behind nginx/Caddy or under `--systemd`) |
| `--seed` / `-Seed` | Load `seed.sql` demo data after schema |
| `--backup-cron [rclone-remote]` / `-BackupCron` | Install backup task: nightly `pg_dump -Fc` + 14-day dump retention + optional rclone offsite copy + 180-day `audit_logs` trim |
| `-Domain <name>` | (Windows) Install Caddy reverse proxy with auto-TLS for the given domain |

## Post-Deploy Checklist

1. **Review `.env`** — set `CORS_ORIGIN` to your frontend URL, configure Cloudinary/SMTP if needed
2. **Firewall** — open port 80/443 (Caddy/nginx handles TLS and proxies to 4000)
3. **Reverse proxy** — Linux: see `deploy/nginx-sera.conf` + `certbot`; Windows: `-Domain` flag installs Caddy automatically
4. **Backups** — run with `--backup-cron` (see Options), or schedule `pg_dump` manually

## Backups + Maintenance

Recommended: let the script install the cron/task:

```bash
# Linux with offsite copy (configure rclone for the app user first:
#   sudo -u sera rclone config)
sudo bash prod.sh --backup-cron rclone-remote:bucket/sera
# or local-only
sudo bash prod.sh --backup-cron
```

```powershell
# Windows
.\prod.ps1 -BackupCron
```

`deploy/backup.sh` / `deploy/backup.ps1` do all of it: nightly `pg_dump -Fc`, retention prune,
rclone copy when `OFFSITE_REMOTE` is set, and trims `audit_logs` older than
180 days (`AUDIT_RETENTION_DAYS`). Verify after the first night:
`cat /var/log/sera-backup.log && ls -lh /var/backups/sera`.

## Reverse Proxy (nginx — Linux only)

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
PGPASSWORD=<password> psql -h 127.0.0.1 -p 5434 -U dentacore -d dentacore
```

## Updating

```bash
# 1. Stop service
sudo systemctl stop sera

# 2. Backup database
pg_dump -h 127.0.0.1 -p 5434 -U dentacore -d dentacore > backup-$(date +%F).dump

# 3. Extract new zip over existing directory
cd /opt && unzip -o sera-backend-*.zip

# 4. Re-run (safe — skips DB creation, re-applies db.sql, skips .env)
cd sera-backend && sudo bash prod.sh

# 5. Restart
sudo systemctl start sera
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `FATAL: role "dentacore" does not exist` | Re-run with postgres superuser access, or create role manually |
| `FATAL: database "dentacore" does not exist` | Re-run prod.sh/prod.ps1, or `createdb -h 127.0.0.1 -p 5434 -U dentacore dentacore` |
| `EACCES: permission denied` on uploads | `chown -R sera:sera /opt/sera-backend` |
| Port already in use | Change `PORT` in `.env` or stop the conflicting service |
