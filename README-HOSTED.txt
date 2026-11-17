Sera hosted backend - quick start
(full procedure: docs/HOSTING.md in this zip; release process: docs/DEPLOYMENT.md in the source tree)

Everything is self-contained: prod.sh / prod.ps1 download their own Node.js and
PostgreSQL into .prod-tools/ - nothing is apt/winget-installed except what is noted.

[Ubuntu 22.04 / 24.04]  (needs: curl, unzip; nginx + certbot for TLS)

  1. sudo mkdir -p /opt && cd /opt && sudo unzip sera-backend-<version>.zip
  2. cd sera-backend
  3. sudo bash prod.sh --systemd --backup-cron [rclone-remote:bucket/sera]
  4. curl http://127.0.0.1:4000/health
  5. nginx + certbot in front (deploy/nginx-sera.conf, see docs/HOSTING.md)

  --systemd       create the 'sera' user, bootstrap as that user (binaries, .env
                  secrets, DB, schema, deps), install + start the sera service on :4000
  --backup-cron   nightly pg_dump -Fc to /var/backups/sera, 14-day retention,
                  180-day audit_logs trim, optional rclone offsite copy
  --port N        listening port (default 4000 under --systemd, 80 otherwise)
  --seed          demo data with PUBLISHED passwords - never on a production box

  Foreground test (no service, as a normal user):  bash prod.sh --port 4000

[Windows Server 2019+ / Windows 10+]  (elevated PowerShell)

  1. Expand-Archive sera-backend-<version>.zip C:\ ; cd C:\sera-backend
  2. powershell -NoProfile -ExecutionPolicy Bypass -File prod.ps1 -Service -BackupCron -Domain api.example.com
  3. curl http://127.0.0.1:4000/health

  -Service        register the 'Sera' SYSTEM Scheduled Task (starts PG + API at boot,
                  logs\service.log)
  -BackupCron     'Sera-Backup' task, nightly 02:30 -> C:\ProgramData\Sera\backups
  -Domain NAME    Caddy reverse proxy with automatic Let's Encrypt TLS (port 4000 behind it)
  -Port N         listening port (default 80 without -Domain)
  -Seed           demo data with PUBLISHED passwords - never on a production box

After install:
  - edit .env: CORS_ORIGIN, CLOUDINARY_* (X-ray uploads), SMTP_* (reminders), ERROR_WEBHOOK_URL
    then restart (systemctl restart sera / schtasks /End + /Run /TN Sera)
  - create the operator account:
      .prod-tools/node-v22.16.0-linux-x64/bin/node scripts/create-platform-admin.js <email> <password>
  - site:     https://<domain>/          booking portal: https://<domain>/book?clinic=<slug>
  - health:   https://<domain>/health    operator console: https://<domain>/platform
