# Sera Backend — Server Runbook

Ships inside `sera-backend-<version>.zip`. Covers installing, operating, backing up,
restoring and updating one hosted backend box. The end-to-end release process
(building the client, publishing releases, go-live checklist) is `docs/DEPLOYMENT.md`
in the source tree.

Everything is self-contained: `prod.sh` (Linux) / `prod.ps1` (Windows) download Node.js
22.16.0 and PostgreSQL 18 into `.prod-tools/`, run PostgreSQL on `127.0.0.1:5434`, and keep
its data in `.prod-tools/pgsql/data/`. **That directory is the database — never delete it.**

## Linux (Ubuntu 22.04 / 24.04) — recommended

Prerequisites: a VPS (2 vCPU / 4 GB is enough for a pilot), a DNS `A` record pointing at it,
ports 80 + 443 open, and:

```bash
sudo apt update && sudo apt install -y curl unzip nginx certbot python3-certbot-nginx
```

### Install

```bash
sha256sum -c sera-backend-<version>.zip.sha256        # verify the upload
sudo unzip sera-backend-<version>.zip -d /opt && cd /opt/sera-backend
sudo bash prod.sh --systemd --backup-cron              # add an rclone remote for offsite: --backup-cron remote:bucket/sera
curl -s http://127.0.0.1:4000/health                   # {"status":"ok",...}
```

`--systemd` (as root) creates the unprivileged `sera` user, gives it `/opt/sera-backend`, runs the
bootstrap as that user (downloads, `.env` with generated `DB_PASSWORD`/`JWT_SECRET`/
`JWT_REFRESH_SECRET`, `initdb`, schema `db.sql`, system seed `seed-prod.sql`, `npm ci`), then
renders `deploy/sera.service` into `/etc/systemd/system/sera.service` and starts it on port 4000.
The service starts PostgreSQL itself (`ExecStartPre`) and stops it after node (`ExecStopPost`).

### TLS (nginx + certbot)

```bash
sudo cp deploy/nginx-sera.conf /etc/nginx/sites-available/sera
sudo sed -i 's/api.sera.dz/<your-domain>/' /etc/nginx/sites-available/sera
sudo ln -s /etc/nginx/sites-available/sera /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d <your-domain> --redirect
```

The sample proxies everything (site, API, Socket.IO upgrade) to `127.0.0.1:4000` and allows 25 MB
uploads. The app sets `trust proxy = 1` — keep exactly one proxy hop in front of it.

### Operate

```bash
sudo systemctl status sera
sudo journalctl -u sera -f                 # app log (also logs/backend.log)
sudo systemctl restart sera                # after editing .env
tail -f .prod-tools/pg.log                 # PostgreSQL log
```

Database shell:

```bash
cd /opt/sera-backend
sudo -u sera PGPASSWORD="$(sudo grep ^DB_PASSWORD= .env | cut -d= -f2)" \
  .prod-tools/pgsql/bin/psql -h 127.0.0.1 -p 5434 -U dentacore dentacore
```

Foreground run for debugging (stop the service first): `sudo systemctl stop sera && sudo -u sera bash prod.sh --port 4000`.

## Windows Server 2019+ / Windows 10+

Elevated PowerShell:

```powershell
(Get-FileHash sera-backend-<version>.zip -Algorithm SHA256).Hash   # compare with the .sha256
Expand-Archive sera-backend-<version>.zip C:\ ; cd C:\sera-backend
.\prod.ps1 -Service -BackupCron -Domain <your-domain>
curl.exe http://127.0.0.1:4000/health
```

- `-Service` registers the `Sera` SYSTEM Scheduled Task (at boot: start PG if needed, run node,
  output to `logs\service.log`). The script installs deps, hands PG over to the task and exits.
- `-Domain` downloads Caddy into `.prod-tools\caddy\`, installs it as the `Caddy` Windows service
  with automatic Let's Encrypt TLS, and re-homes the API to port 4000. Open ports 80 + 443 in the
  Windows firewall (`New-NetFirewallRule -DisplayName Sera-Web -Direction Inbound -Protocol TCP -LocalPort 80,443 -Action Allow`).
- `-BackupCron` registers `Sera-Backup` (daily 02:30, `deploy\backup.ps1` → `C:\ProgramData\Sera\backups`).
- Restart after editing `.env`: `schtasks /End /TN Sera; schtasks /Run /TN Sera`.

## Configuration (`.env`)

Generated on first run; edit then restart. Never commit or share it.

| Key | Production value |
|---|---|
| `NODE_ENV` | `production` (hides stack traces + Swagger) |
| `PORT` / `DB_HOST` / `DB_PORT` | managed by the prod scripts (4000 / 127.0.0.1 / 5434) |
| `DB_PASSWORD`, `JWT_SECRET`, `JWT_REFRESH_SECRET` | generated — rotating a JWT secret logs everyone out |
| `CORS_ORIGIN` | only needed for a cross-origin web front-end; the site, portal and desktop client don't need it |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | required for X-ray / media uploads |
| `SMTP_*` | required for appointment reminder emails (24 h ahead, to patients with an email). There is no SMS provider: phone-only patients get no reminder (logged as `failed`) |
| `ERROR_WEBHOOK_URL` | optional Slack/Discord webhook for production 500s |
| `JWT_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | default `24h` / `7d` |

## Operator account

Create (or promote) the platform owner, who manages tenants at `https://<domain>/platform`:

```bash
cd /opt/sera-backend
sudo -u sera .prod-tools/node-v22.16.0-linux-x64/bin/node scripts/create-platform-admin.js <email> '<password>' "Full Name"
```
Windows: `.\.prod-tools\node-v22.16.0-win-x64\node.exe scripts\create-platform-admin.js <email> <password>`.

Clinics self-register at `https://<domain>/signup`.

## Backups

Linux cron (`/etc/cron.d/sera-backup`, 02:30, as `sera`) runs `deploy/backup.sh`: `pg_dump -Fc` to
`/var/backups/sera/dentacore-YYYY-MM-DD.dump`, deletes dumps older than 14 days, copies to
`OFFSITE_REMOTE` with rclone when set (configure first: `sudo -u sera rclone config`), and trims
`audit_logs` older than 180 days. Run it once now and check:

```bash
sudo -u sera APP_DIR=/opt/sera-backend bash /opt/sera-backend/deploy/backup.sh
ls -lh /var/backups/sera && tail /var/log/sera-backup.log
```

**Local dumps on the same disk are not a backup** — configure an offsite remote before real
patient data goes in.

### Restore

```bash
sudo systemctl stop sera
cd /opt/sera-backend
sudo -u sera .prod-tools/pgsql/bin/pg_ctl start -D .prod-tools/pgsql/data -l .prod-tools/pg_ctl.log -w
sudo -u sera PGPASSWORD="$(sudo grep ^DB_PASSWORD= .env | cut -d= -f2)" \
  .prod-tools/pgsql/bin/pg_restore --clean --if-exists --no-owner \
  -h 127.0.0.1 -p 5434 -U dentacore -d dentacore /var/backups/sera/dentacore-YYYY-MM-DD.dump
sudo -u sera .prod-tools/pgsql/bin/pg_ctl stop -D .prod-tools/pgsql/data -m fast -w
sudo systemctl start sera
```

Windows: `schtasks /End /TN Sera`, then the same `pg_ctl start` / `pg_restore` / `pg_ctl stop`
with `.prod-tools\pgsql\bin\*.exe` and a dump from `C:\ProgramData\Sera\backups`, then `schtasks /Run /TN Sera`.

Test a restore on a scratch box before go-live, not during an incident.

## Updating

```bash
sudo -u sera APP_DIR=/opt/sera-backend bash /opt/sera-backend/deploy/backup.sh   # fresh dump first
sudo systemctl stop sera
cd /opt && sudo unzip -o sera-backend-<new-version>.zip                          # keeps .env + .prod-tools/
cd sera-backend && sudo rm -rf node_modules                                       # forces a clean npm ci
sudo bash prod.sh --systemd                                                       # re-applies db.sql + seed-prod.sql, restarts
curl -s http://127.0.0.1:4000/health
```

`db.sql` is idempotent (`IF NOT EXISTS`) — it creates new tables/indexes but does **not** alter
existing columns. If a release changes an existing table, it must ship the matching `ALTER`
statements, applied by hand with psql before restarting.

Rollback: stop the service, unzip the previous version's zip the same way, re-run
`sudo bash prod.sh --systemd`; if the schema moved, restore the pre-update dump.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `PostgreSQL cannot run as the root user` | use `sudo bash prod.sh --systemd`, or run the foreground test as a normal user |
| `missing shared libraries required by PostgreSQL` | `sudo apt install -y libnuma1`, re-run |
| `pg_ctl start failed` / port 5434 in use | another PG holds 5434 — stop it; check `.prod-tools/pg_ctl.log` |
| `EADDRINUSE :4000` | a foreground `prod.sh`/`node` is still running next to the service |
| 502 from nginx | `systemctl status sera`; `journalctl -u sera -n 200` |
| X-ray uploads fail | set `CLOUDINARY_*` in `.env`, restart |
| 413 on upload | raise `client_max_body_size` in the nginx site |
