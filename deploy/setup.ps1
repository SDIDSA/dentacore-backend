# Sera backend bootstrap for Windows Server 2019+ / Windows 10+.
# Windows equivalent of deploy/setup.sh (Ubuntu). Run from the extracted folder:
#   powershell -NoProfile -ExecutionPolicy Bypass -File deploy\setup.ps1 [-Service] [-Port 4000] [-Seed] [-BackupCron]
#
# Installs/verifies Node.js and PostgreSQL, generates secrets, creates the
# dentacore role + database, applies the idempotent db.sql, and optionally
# registers Scheduled Tasks for the API service and nightly backups.
#
# Auth model note: Windows PostgreSQL uses password auth (no peer-auth socket),
# so the postgres superuser password (set at EDB-install time) is prompted for
# only when the role/database must be created. Backups do NOT need it - they
# run as the dentacore app role using credentials from .env (the app role owns
# its database).
param(
    [switch]$Service,
    [int]$Port = 4000,
    [switch]$Seed,
    [switch]$BackupCron,
    [string]$BackupDir = "C:\ProgramData\Sera\backups",
    [string]$OffsiteRemote = "",
    [string]$PostgresPassword = ""
)

$ErrorActionPreference = "Stop"

function Write-Step($t) {
    Write-Host ""
    Write-Host "======================================================================"
    Write-Host "  $t"
    Write-Host "======================================================================"
}
function Write-Sub($t) { Write-Host "  -> $t" }

function Get-RandomHex([int]$bytes) {
    $b = New-Object byte[] $bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
    ([System.BitConverter]::ToString($b)).Replace("-", "").ToLowerInvariant()
}

function Find-Psql {
    $hits = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue |
        Sort-Object { [int]($_.Directory.Parent.Name -replace '[^\d]', '') } -Descending
    if ($hits) { $hits[0].FullName }
    $cmd = Get-Command psql -ErrorAction SilentlyContinue
    if (-not $hits -and $cmd) { $cmd.Source }
}

function Set-EnvValue([string]$file, [string]$key, [string]$value) {
    $lines = [System.IO.File]::ReadAllLines($file)
    $found = $false
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match "^$key=") { $lines[$i] = "$key=$value"; $found = $true }
    }
    if (-not $found) { $lines += "$key=$value" }
    [System.IO.File]::WriteAllLines($file, $lines)
}

function Get-EnvValue([string]$file, [string]$key) {
    foreach ($line in [System.IO.File]::ReadAllLines($file)) {
        if ($line -match "^$key=(.*)$") { return $Matches[1] }
    }
    return $null
}

Write-Step "Sera backend bootstrap (Windows)"

# -- locate app root (script lives in deploy\) --------------------------------
$AppDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $AppDir
Write-Sub "App root: $AppDir"

# -- install Node.js >= 20 if missing or too old ------------------------------
function Test-Node {
    $cmd = Get-Command node -ErrorAction SilentlyContinue
    if (-not $cmd) { return $false }
    $major = [int]((node -v) -replace '^v(\d+).*', '$1')
    return $major -ge 20
}

if (-not (Test-Node)) {
    Write-Step "Installing Node.js 22 LTS"
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if ($winget) {
        & winget install --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements --silent
        # refresh PATH for the current session
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    } else {
        Write-Host "ERROR: Node.js >= 20 is required and winget is unavailable." -ForegroundColor Red
        Write-Host "Install Node.js 20+ from https://nodejs.org then re-run this script." -ForegroundColor Red
        exit 1
    }
    if (-not (Test-Node)) {
        Write-Host "ERROR: Node.js >= 20 could not be installed." -ForegroundColor Red
        exit 1
    }
}
Write-Sub "Node $(node -v) ready"

# -- install PostgreSQL if missing --------------------------------------------
$psql = Find-Psql
if (-not $psql) {
    Write-Step "Installing PostgreSQL"
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if ($winget) {
        Write-Sub "winget install PostgreSQL.PostgreSQL.16 (remember the postgres password you set!)"
        & winget install --id PostgreSQL.PostgreSQL.16 --accept-source-agreements --accept-package-agreements --silent --override "--unattendedmodeui none --mode unattended --superpassword postgres"
        $psql = Find-Psql
    }
    if (-not $psql) {
        Write-Host "ERROR: PostgreSQL is required and could not be installed automatically." -ForegroundColor Red
        Write-Host "Install from https://www.enterprisedb.com/downloads/postgres-postgresql-downloads" -ForegroundColor Red
        Write-Host "then re-run this script." -ForegroundColor Red
        exit 1
    }
    Write-Host "WARNING: PostgreSQL was installed with superuser password 'postgres' - change it: psql -U postgres -c ""ALTER USER postgres PASSWORD '...'""" -ForegroundColor Yellow
}
$pgBin = Split-Path $psql
Write-Sub "psql: $psql"

# -- ensure the PostgreSQL service is running ---------------------------------
$pgSvc = Get-Service | Where-Object { $_.Name -like "postgresql*" -and $_.Status -eq "Running" } | Select-Object -First 1
if (-not $pgSvc) {
    $pgSvc = Get-Service | Where-Object { $_.Name -like "postgresql*" } | Select-Object -First 1
    if ($pgSvc) { Write-Sub "starting service $($pgSvc.Name)"; Start-Service $pgSvc.Name }
}
if ($pgSvc) { Write-Sub "PostgreSQL service: $($pgSvc.Name) ($($pgSvc.Status))" }

# -- install production dependencies ------------------------------------------
Write-Step "Installing production dependencies"
& npm.cmd ci --omit=dev
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: npm ci failed" -ForegroundColor Red; exit 1 }

# -- create .env from template ------------------------------------------------
$envFile = Join-Path $AppDir ".env"
if (-not (Test-Path $envFile)) {
    Write-Step "Creating .env from .env.example"
    Copy-Item (Join-Path $AppDir ".env.example") $envFile
    Set-EnvValue $envFile "DB_PASSWORD" (Get-RandomHex 16)
    Set-EnvValue $envFile "JWT_SECRET" (Get-RandomHex 32)
    Set-EnvValue $envFile "JWT_REFRESH_SECRET" (Get-RandomHex 32)
    Set-EnvValue $envFile "NODE_ENV" "production"
    Write-Sub "generated DB_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET"
} else {
    Write-Step ".env already exists, skipping creation"
}

# -- apply explicit -Port to .env (always, so re-deploys honor the flag) ------
Set-EnvValue $envFile "PORT" "$Port"
Write-Sub "PORT=$Port written to .env"

# -- PostgreSQL setup ----------------------------------------------------------
$DbHost = Get-EnvValue $envFile "DB_HOST"; if (-not $DbHost) { $DbHost = "localhost" }
$DbName = Get-EnvValue $envFile "DB_NAME"; if (-not $DbName) { $DbName = "dentacore" }
$DbUser = Get-EnvValue $envFile "DB_USER"; if (-not $DbUser) { $DbUser = "dentacore" }
$DbPass = Get-EnvValue $envFile "DB_PASSWORD"
$DbPort = Get-EnvValue $envFile "DB_PORT"; if (-not $DbPort) { $DbPort = "5432" }
Set-EnvValue $envFile "DB_PORT" $DbPort

Write-Step "Setting up PostgreSQL ($DbHost`:$DbPort)"

$env:PGPASSWORD = $DbPass
$canConnect = & $psql -h $DbHost -p $DbPort -U $DbUser -d postgres -tAc "SELECT 1" 2>$null
if (-not $canConnect) {
    # first run: need the postgres superuser to create the app role + database
    if (-not $PostgresPassword) {
        $secure = Read-Host "postgres superuser password (set at PostgreSQL install)" -AsSecureString
        $bss = [System.Runtime.InteropServices.Marshal]::SecureStringToBStr($secure)
        $PostgresPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringBStr($bss)
    }
    $env:PGPASSWORD = $PostgresPassword
    $ok = & $psql -h $DbHost -p $DbPort -U postgres -d postgres -tAc "SELECT 1" 2>$null
    if (-not $ok) {
        Write-Host "ERROR: cannot reach PostgreSQL as superuser. Check the service and password." -ForegroundColor Red
        exit 1
    }

    $roleExists = & $psql -h $DbHost -p $DbPort -U postgres -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DbUser'"
    $escaped = $DbPass.Replace("'", "''")
    if ($roleExists) {
        & $psql -h $DbHost -p $DbPort -U postgres -d postgres -c "ALTER ROLE $DbUser WITH LOGIN PASSWORD '$escaped';" | Out-Null
        Write-Sub "role $DbUser exists - password rotated to match .env"
    } else {
        & $psql -h $DbHost -p $DbPort -U postgres -d postgres -c "CREATE ROLE $DbUser WITH LOGIN PASSWORD '$escaped';" | Out-Null
        Write-Sub "created role $DbUser"
    }

    $dbExists = & $psql -h $DbHost -p $DbPort -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DbName'"
    if (-not $dbExists) {
        & $psql -h $DbHost -p $DbPort -U postgres -d postgres -c "CREATE DATABASE $DbName OWNER $DbUser;" | Out-Null
        Write-Sub "created database $DbName"
    } else {
        Write-Sub "database $DbName already exists"
    }

    $env:PGPASSWORD = $DbPass
}

# -- apply base schema (idempotent - safe on every re-run) ---------------------
Write-Step "Applying schema (db.sql)"
& $psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -v ON_ERROR_STOP=1 -f (Join-Path $AppDir "db.sql")
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: schema application failed" -ForegroundColor Red; exit 1 }

# -- optional: seed data --------------------------------------------------------
if ($Seed) {
    Write-Host "   WARNING: -Seed loads DEMO data with published passwords" -ForegroundColor Yellow
    Write-Host "   (admin@elqods.dz / Admin@2025!, etc.) - change them immediately," -ForegroundColor Yellow
    Write-Host "   or do not use -Seed on an internet-facing host." -ForegroundColor Yellow
    & $psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -v ON_ERROR_STOP=1 -f (Join-Path $AppDir "seed.sql")
    if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: seed application failed" -ForegroundColor Red; exit 1 }
}

# -- optional: API service as a Scheduled Task (systemd equivalent) ------------
if ($Service) {
    Write-Step "Installing Sera service (Scheduled Task)"
    $runner = Join-Path $AppDir "run-sera.cmd"
    @"
@echo off
cd /d "$AppDir"
set NODE_ENV=production
set PORT=$Port
node server.js >> "$AppDir\logs\service.log" 2>&1
"@ | Set-Content -Path $runner -Encoding Ascii

    New-Item -ItemType Directory -Force (Join-Path $AppDir "logs") | Out-Null
    schtasks /Create /F /TN "Sera" /RU SYSTEM /RL HIGHEST /SC ONSTART /TR "`"$runner`"" | Out-Null
    schtasks /Run /TN "Sera" | Out-Null
    Write-Sub "service installed: schtasks /Query /TN Sera  (logs\service.log)"
}

# -- optional: nightly backup + maintenance Scheduled Task ----------------------
if ($BackupCron) {
    Write-Step "Installing nightly backup task"
    New-Item -ItemType Directory -Force $BackupDir | Out-Null
    schtasks /Create /F /TN "Sera-Backup" /RU SYSTEM /SC DAILY /ST 02:30 /TR "powershell -NoProfile -ExecutionPolicy Bypass -File `"$AppDir\deploy\backup.ps1`"" | Out-Null
    Write-Sub "backup task installed: schtasks /Query /TN Sera-Backup -> $BackupDir"
    if ($OffsiteRemote) {
        Write-Sub "offsite destination: $OffsiteRemote (rclone must be in SYSTEM PATH; set OFFSITE_REMOTE in .env)"
        Set-EnvValue $envFile "OFFSITE_REMOTE" $OffsiteRemote
    } else {
        Write-Host "   WARNING: no offsite remote configured - dumps stay local only." -ForegroundColor Yellow
        Write-Host "   Re-run with: -BackupCron -OffsiteRemote rclone-remote:bucket/sera" -ForegroundColor Yellow
    }
}

Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue

Write-Step "Done. Next steps (REQUIRED before go-live)"
Write-Host @"
  1. Edit .env - set CORS_ORIGIN to your real frontend URL
     (dev defaults only allow localhost origins)
  2. Edit .env - fill in Cloudinary credentials; until then media/X-ray
     uploads will fail at runtime
  3. Review SMTP settings if booking emails are enabled
  4. If you ran -Seed: CHANGE THE SEEDED ADMIN PASSWORDS NOW

Start manually:   `$env:NODE_ENV='production'; node server.js
                  (or use the Sera scheduled task installed above)
Health check:     curl http://localhost:$Port/health
Full runbook:     docs/HOSTING.md
"@
