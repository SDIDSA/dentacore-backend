# Sera nightly maintenance for Windows: pg_dump + retention prune + offsite copy + audit trim.
# Windows equivalent of deploy/backup.sh (Ubuntu/cron). Installed by
# deploy/setup.ps1 -BackupCron as a SYSTEM Scheduled Task; can also run manually:
#   powershell -NoProfile -ExecutionPolicy Bypass -File deploy\backup.ps1
#
# Connects as the dentacore app role using credentials from .env (no postgres
# superuser needed - the app role owns its database).
#
# Environment (set in .env or the calling context):
#   BACKUP_DIR            dump target                       (default: C:\ProgramData\Sera\backups)
#   RETENTION_DAYS        local dump retention              (default: 14)
#   AUDIT_RETENTION_DAYS  audit_logs row retention in days  (default: 180; 0 disables)
#   OFFSITE_REMOTE        rclone destination, e.g. "remote:bucket/sera"; .env or here; empty skips
param(
    [string]$BackupDir = "C:\ProgramData\Sera\backups",
    [int]$RetentionDays = 14,
    [int]$AuditRetentionDays = 180,
    [string]$OffsiteRemote = ""
)

$ErrorActionPreference = "Stop"

$AppDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$envFile = Join-Path $AppDir ".env"

function Get-EnvValue([string]$key) {
    if (Test-Path $envFile) {
        foreach ($line in [System.IO.File]::ReadAllLines($envFile)) {
            if ($line -match "^$key=(.*)$") { return $Matches[1] }
        }
    }
    return $null
}

$DbName = Get-EnvValue "DB_NAME"; if (-not $DbName) { $DbName = "dentacore" }
$DbHost = Get-EnvValue "DB_HOST"; if (-not $DbHost) { $DbHost = "localhost" }
$DbPort = Get-EnvValue "DB_PORT"; if (-not $DbPort) { $DbPort = "5432" }
$DbUser = Get-EnvValue "DB_USER"; if (-not $DbUser) { $DbUser = "dentacore" }
$DbPass = Get-EnvValue "DB_PASSWORD"
if (-not $OffsiteRemote) { $OffsiteRemote = Get-EnvValue "OFFSITE_REMOTE" }

# locate psql/pg_dump
$pgTool = $null
foreach ($name in @("pg_dump.exe", "psql.exe")) {
    $hit = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\$name" -ErrorAction SilentlyContinue |
        Sort-Object { [int]($_.Directory.Parent.Name -replace '[^\d]', '') } -Descending | Select-Object -First 1
    if ($hit) { $pgTool = $hit.FullName; break }
}
if (-not $pgTool) { $pgTool = (Get-Command pg_dump -ErrorAction SilentlyContinue).Source }
if (-not $pgTool) { Write-Error "pg_dump/psql not found"; exit 1 }
$pgBin = Split-Path $pgTool

$env:PGPASSWORD = $DbPass
try {
    New-Item -ItemType Directory -Force $BackupDir | Out-Null

    $dump = Join-Path $BackupDir "$DbName-$(Get-Date -Format 'yyyy-MM-dd').dump"
    Write-Host "-- pg_dump -> $dump"
    & (Join-Path $pgBin "pg_dump.exe") -h $DbHost -p $DbPort -U $DbUser -Fc -f $dump $DbName
    if ($LASTEXITCODE -ne 0) { Write-Error "pg_dump failed"; exit 1 }

    Get-ChildItem $BackupDir -Filter *.dump |
        Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) } |
        Remove-Item -Force

    if ($OffsiteRemote) {
        $rclone = Get-Command rclone -ErrorAction SilentlyContinue
        if ($rclone) {
            Write-Host "-- offsite copy -> $OffsiteRemote"
            & $rclone.Source copy $BackupDir $OffsiteRemote --max-age 48h
        } else {
            Write-Host "WARNING: OFFSITE_REMOTE set but rclone is not installed - skipping offsite copy" -ForegroundColor Yellow
        }
    }

    if ($AuditRetentionDays -gt 0) {
        & (Join-Path $pgBin "psql.exe") -h $DbHost -p $DbPort -U $DbUser -d $DbName -v ON_ERROR_STOP=1 `
            -c "DELETE FROM audit_logs WHERE created_at < now() - interval '$AuditRetentionDays days'"
        if ($LASTEXITCODE -ne 0) { Write-Error "audit_logs trim failed"; exit 1 }
    }

    Write-Host "-- backup done: $dump"
} finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
