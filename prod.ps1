<#
.SYNOPSIS
  Sera backend — self-contained production bootstrap + startup (Windows).

.DESCRIPTION
  Downloads its own Node.js, PostgreSQL, and Caddy binaries (all cached locally under
  .prod-tools/, fully self-contained like the rest), starts a local PG instance,
  creates .env with generated secrets on first run, provisions the DB role + database,
  applies the schema, and runs the server. Ctrl+C to stop — PG shuts down gracefully,
  data persists across runs.

  Flags:
    -Service     Register a Windows Scheduled Task (auto-start on boot)
    -Domain      Install the locally-downloaded Caddy reverse proxy with auto-TLS
    -Seed        Load seed.sql demo data
    -BackupCron  Install nightly backup Scheduled Task
    -Port        Override listening port (default: 80 - HTTP-only; pass -Port 4000 with -Domain)

.EXAMPLE
  ./prod.ps1
  ./prod.ps1 -Service -Domain api.sera.dz -BackupCron
#>
param(
    [int]$Port = 80,
    [string]$Domain = "",
    [switch]$Seed,
    [switch]$Service,
    [switch]$BackupCron,
    [string]$BackupDir = "C:\ProgramData\Sera\backups",
    [string]$OffsiteRemote = "",
    [string]$PostgresPassword = "",
    [string]$NodeVersion = "22.16.0",
    [string]$PgVersion = "18.6-1",
    [string]$CaddyVersion = "2.11.4"
)

$ErrorActionPreference = "Continue"
$ROOT = $PSScriptRoot
$ENV_FILE = Join-Path $ROOT ".env"
$FIRST_RUN = -not (Test-Path -LiteralPath $ENV_FILE)
$TOOLS_DIR = Join-Path $ROOT ".prod-tools"
$CACHE_DIR = Join-Path $TOOLS_DIR "cache"
$NODE_DIR = Join-Path $TOOLS_DIR "node-v$NodeVersion-win-x64"
$PG_DIR = Join-Path $TOOLS_DIR "pgsql"
$PG_DATA = Join-Path $PG_DIR "data"
$CADDY_EXE = Join-Path $TOOLS_DIR "caddy\caddy.exe"
$PG_LOG = Join-Path $TOOLS_DIR "pg_ctl.log"
   # distinct from logging_collector's pg.log (avoids sharing violation)

# ── default port 80; with -Domain, back the backend off to 4000 ──
# Port 80 is the default so plain `prod.ps1` serves the site + API at
# http://<host>/ with no port. When a reverse proxy (-Domain, Caddy auto-TLS)
# is requested, Caddy owns 80/443 and the backend must sit on a high port, so
# unless -Port was passed explicitly we re-home the backend to 4000.
if ($Domain -and -not $PSBoundParameters.ContainsKey('Port')) {
    $Port = 4000
}

# ── low-port (<1024) guard ──────────────────────────────────────
# Raw Node binds below 1024 on Windows require the process to be elevated
# (a `netsh http add urlacl` URL-ACL does NOT help - Node opens a raw socket,
# it does not use the HTTP.sys stack). Foreground runs must be in an
# Administrator console; -Service runs as SYSTEM (elevated) so it is fine.
if ($Port -lt 1024) {
    $elevated = (New-Object Security.Principal.WindowsPrincipal(
        [Security.Principal.WindowsIdentity]::GetCurrent()
    )).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $elevated) {
        Write-Host "ERROR: cannot bind to port $Port (< 1024) - this shell is not elevated." -ForegroundColor Red
        Write-Host "       Re-run from an Administrator console, or use -Service (runs as SYSTEM)." -ForegroundColor Yellow
        exit 1
    }
    Write-Sub "port $Port is below 1024 - requires elevation (detected OK)"
}

# ── pg lifecycle ────────────────────────────────────────────────
$pgBin = $null
$pgStarted = $false

function Stop-Pg {
    if ((-not $pgBin) -or (-not $pgStarted)) { return }
    if (-not (Test-Path "$pgBin\pg_ctl.exe")) { return }
    Write-Host "Stopping PostgreSQL..." -ForegroundColor Yellow
    & "$pgBin\pg_ctl.exe" stop -D $PG_DATA -m fast -w 2>$null
    $pgStarted = $false
}

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

# ── ensure Node.js (download + cache) ──────────────────────────
function Ensure-Node {
    if (Test-Path "$NODE_DIR\node.exe") { return "$NODE_DIR" }
    Write-Host "Downloading Node.js v$NodeVersion..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path $CACHE_DIR | Out-Null
    $zip = Join-Path $CACHE_DIR "node-v$NodeVersion-win-x64.zip"
    if (-not (Test-Path $zip)) {
        $url = "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-win-x64.zip"
        Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
        if ((Get-Item $zip).Length -lt 1MB) {
            Remove-Item $zip -Force
            Write-Host "ERROR: Node.js download failed" -ForegroundColor Red; exit 1
        }
    }
    Expand-Archive -Path $zip -DestinationPath $TOOLS_DIR -Force
    if (-not (Test-Path "$NODE_DIR\node.exe")) {
        Write-Host "ERROR: Node.js extraction failed" -ForegroundColor Red; exit 1
    }
    Write-Host "  Node v$NodeVersion ready" -ForegroundColor Green
    return "$NODE_DIR"
}

# ── ensure PostgreSQL (EDB binaries, download + cache) ──────────
function Ensure-Pgsql {
    if (Test-Path "$PG_DIR\bin\pg_ctl.exe") { return "$PG_DIR" }
    Write-Host "Downloading PostgreSQL $PgVersion..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path $CACHE_DIR | Out-Null
    $zip = Join-Path $CACHE_DIR "pgsql-$PgVersion.zip"
    if (-not (Test-Path $zip)) {
        $url = "https://get.enterprisedb.com/postgresql/postgresql-$PgVersion-windows-x64-binaries.zip"
        Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
        if ((Get-Item $zip).Length -lt 1MB) {
            Remove-Item $zip -Force
            Write-Host "ERROR: PostgreSQL download failed" -ForegroundColor Red; exit 1
        }
    }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    Write-Host "  Extracting bin/ and lib/ only..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path $PG_DIR | Out-Null
    $z = [System.IO.Compression.ZipFile]::OpenRead($zip)
    $extracted = 0
    foreach ($entry in $z.Entries) {
        $full = $entry.FullName
        if ($full -notmatch "^pgsql/(bin|lib|share)/") { continue }
        $dest = Join-Path $PG_DIR ($full -replace "^pgsql/", "")
        $destDir = Split-Path $dest -Parent
        if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Force -Path $destDir | Out-Null }
        if ($entry.Length -gt 0) {
            [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $dest, $true) | Out-Null
        }
        $extracted++
    }
    $z.Dispose()
    Write-Host "  Extracted $extracted files" -ForegroundColor Green
    if (-not (Test-Path "$PG_DIR\bin\pg_ctl.exe")) {
        Write-Host "ERROR: PostgreSQL extraction failed" -ForegroundColor Red; exit 1
    }
    Write-Host "  PostgreSQL $PgVersion ready" -ForegroundColor Green
    return "$PG_DIR"
}

# ── ensure Caddy (caddy.exe, download + cache, local & contained) ──
function Ensure-Caddy {
    if (Test-Path $CADDY_EXE) { return $CADDY_EXE }
    Write-Host "Downloading Caddy v$CaddyVersion..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path $CACHE_DIR | Out-Null
    $zip = Join-Path $CACHE_DIR "caddy-$CaddyVersion-windows-amd64.zip"
    if (-not (Test-Path $zip)) {
        $url = "https://github.com/caddyserver/caddy/releases/download/v$CaddyVersion/caddy_${CaddyVersion}_windows_amd64.zip"
        Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
        if ((Get-Item $zip).Length -lt 1MB) {
            Remove-Item $zip -Force
            Write-Host "ERROR: Caddy download failed" -ForegroundColor Red; exit 1
        }
    }
    New-Item -ItemType Directory -Force -Path (Split-Path $CADDY_EXE -Parent) | Out-Null
    Expand-Archive -Path $zip -DestinationPath (Split-Path $CADDY_EXE -Parent) -Force
    if (-not (Test-Path $CADDY_EXE)) {
        Write-Host "ERROR: Caddy extraction failed" -ForegroundColor Red; exit 1
    }
    Write-Host "  Caddy v$CaddyVersion ready" -ForegroundColor Green
    return $CADDY_EXE
}

try {

Write-Step "Sera backend bootstrap + startup (Windows)"
Set-Location $ROOT
Write-Sub "App root: $ROOT"

# ── ensure binaries ────────────────────────────────────────────
$nodeDir = Ensure-Node
$pgDir = Ensure-Pgsql
$pgBin = Join-Path $pgDir "bin"
$env:PATH = "$nodeDir;$pgBin;$env:PATH"

Write-Sub "Node:  $nodeDir"
Write-Sub "PG:    $pgBin"

# ── create .env from template (first run) ──────────────────────
if ($FIRST_RUN) {
    Write-Step "Creating .env from .env.example"
    Copy-Item (Join-Path $ROOT ".env.example") $ENV_FILE
    Set-EnvValue $ENV_FILE "DB_PASSWORD" (Get-RandomHex 16)
    Set-EnvValue $ENV_FILE "JWT_SECRET" (Get-RandomHex 32)
    Set-EnvValue $ENV_FILE "JWT_REFRESH_SECRET" (Get-RandomHex 32)
    Set-EnvValue $ENV_FILE "NODE_ENV" "production"
    Write-Sub "generated DB_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET"
} else {
    Write-Step ".env already exists, skipping creation"
}

# ── apply explicit -Port to .env ────────────────────────────────
Set-EnvValue $ENV_FILE "PORT" "$Port"
Set-EnvValue $ENV_FILE "DB_HOST" "127.0.0.1"
Set-EnvValue $ENV_FILE "DB_PORT" "5434"

# ── load .env into process env ──────────────────────────────────
Get-Content $ENV_FILE | ForEach-Object {
    $line = $_.Trim()
    if ($line -match '^\s*#' -or $line -notmatch '=') { return }
    $k, $v = $line -split '=', 2
    [Environment]::SetEnvironmentVariable($k.Trim(), $v.Trim(), "Process")
}
$env:NODE_ENV = "production"
$env:DB_HOST = "127.0.0.1"
$env:DB_PORT = "5434"

$DbHost = $env:DB_HOST
$DbPort = $env:DB_PORT
$DbName = if ($env:DB_NAME) { $env:DB_NAME } else { "dentacore" }
$DbUser = if ($env:DB_USER) { $env:DB_USER } else { "dentacore" }
$DbPass = $env:DB_PASSWORD

# ── init PG data dir if needed ─────────────────────────────────
$justInitialized = $false
if (-not (Test-Path "$PG_DATA\postgresql.conf")) {
    $justInitialized = $true
    Write-Step "Initializing PostgreSQL data dir"
    New-Item -ItemType Directory -Force -Path $PG_DATA | Out-Null
    & "$pgBin\initdb.exe" -D $PG_DATA -U $DbUser -E UTF8 --locale=C 2>$null
    if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: initdb failed" -ForegroundColor Red; exit 1 }

    $conf = Join-Path $PG_DATA "postgresql.conf"
    (Get-Content $conf -Raw) -replace "#?port\s*=.*", "port = 5434" | Set-Content $conf
    "listen_addresses = '127.0.0.1'" | Add-Content $conf
    "shared_buffers = 128MB" | Add-Content $conf
    "logging_collector = on" | Add-Content $conf
    "log_directory = '$($TOOLS_DIR -replace '\\','/')'" | Add-Content $conf
    "log_filename = 'pg.log'" | Add-Content $conf

    $hba = Join-Path $PG_DATA "pg_hba.conf"
    # local trust lets us set the initdb superuser's password on first run
    # (the role created by initdb -U $DbUser has no password yet)
    "local all all trust"  | Set-Content $hba
    "host  all all 127.0.0.1/32 trust" | Add-Content $hba
    "host  all all ::1/128    trust" | Add-Content $hba

    Write-Sub "data dir initialized (port 5434)"
}

# ── start PG ───────────────────────────────────────────────────
& "$pgBin\pg_isready.exe" -h 127.0.0.1 -p 5434 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Step "Starting PostgreSQL"
    Start-Process -FilePath "$pgBin\pg_ctl.exe" -ArgumentList "start -D `"$PG_DATA`" -l `"$PG_LOG`"" -NoNewWindow
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Milliseconds 500
        & "$pgBin\pg_isready.exe" -h 127.0.0.1 -p 5434 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { break }
    }
    & "$pgBin\pg_isready.exe" -h 127.0.0.1 -p 5434 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: pg_ctl start failed" -ForegroundColor Red; exit 1 }
    $pgStarted = $true
    Write-Sub "PostgreSQL running on 127.0.0.1:5434"
} else {
    $pgStarted = $true
    Write-Sub "PostgreSQL already running on 127.0.0.1:5434"
}

# ── create role + database (first init) ──────────────────────────
$escaped = $DbPass.Replace("'", "''")
$env:PGPASSWORD = $DbPass

if ($justInitialized) {
    # initdb -U $DbUser already created $DbUser as a superuser with NO password.
    # Set its password to match .env over the temporary local trust auth.
    Write-Sub "setting role $DbUser password (first init)"
    $env:PGPASSWORD = ""
    & "$pgBin\psql.exe" -h 127.0.0.1 -p 5434 -U $DbUser -d postgres -c "ALTER ROLE $DbUser WITH LOGIN PASSWORD '$escaped' SUPERUSER;" 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: could not set password for role $DbUser" -ForegroundColor Red
        $hba = Join-Path $PG_DATA "pg_hba.conf"
        "host all all 127.0.0.1/32 md5" | Set-Content $hba
        "host all all ::1/128 md5" | Add-Content $hba
        exit 1
    }
    Write-Sub "role $DbUser password set"
    $env:PGPASSWORD = $DbPass

    # lock pg_hba down to md5 (trust was only for provisioning)
    $hba = Join-Path $PG_DATA "pg_hba.conf"
    "host all all 127.0.0.1/32 md5" | Set-Content $hba
    "host all all ::1/128 md5" | Add-Content $hba
}

$dbExists = & "$pgBin\psql.exe" -h 127.0.0.1 -p 5434 -U $DbUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DbName'"
if (-not $dbExists) {
    & "$pgBin\psql.exe" -h 127.0.0.1 -p 5434 -U $DbUser -d postgres -c "CREATE DATABASE $DbName OWNER $DbUser;" | Out-Null
    Write-Sub "created database $DbName"
} else {
    Write-Sub "database $DbName already exists"
}

# ── apply base schema (idempotent) ──────────────────────────────
Write-Step "Applying schema (db.sql)"
& "$pgBin\psql.exe" -h 127.0.0.1 -p 5434 -U $DbUser -d $DbName -v ON_ERROR_STOP=1 -f (Join-Path $ROOT "db.sql") 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "WARNING: schema apply returned non-zero (tables may already exist)" -ForegroundColor Yellow
} else {
    Write-Sub "schema OK"
}

# ── optional: seed data (-Seed) ──────────────────────────────────
if ($Seed) {
    Write-Host "   WARNING: -Seed loads DEMO data with published passwords" -ForegroundColor Yellow
    & "$pgBin\psql.exe" -h 127.0.0.1 -p 5434 -U $DbUser -d $DbName -v ON_ERROR_STOP=1 -f (Join-Path $ROOT "seed.sql") 2>$null
}

# ── optional: API service as Scheduled Task (-Service) ────────────
if ($Service) {
    Write-Step "Installing Sera service (Scheduled Task)"
    $runner = Join-Path $ROOT "run-sera.cmd"
    @"
@echo off
cd /d "$ROOT"
set NODE_ENV=production
set PORT=$Port
set DB_HOST=127.0.0.1
set DB_PORT=5434
"$pgBin\pg_ctl.exe" start -D "$PG_DATA" -l "$PG_LOG"
"$nodeDir\npm.cmd" start
"@ | Set-Content -Path $runner -Encoding Ascii

    New-Item -ItemType Directory -Force (Join-Path $ROOT "logs") | Out-Null
    schtasks /Create /F /TN "Sera" /RU SYSTEM /RL HIGHEST /SC ONSTART /TR "`"$runner`"" | Out-Null
    schtasks /Run /TN "Sera" | Out-Null
    Write-Sub "service installed: schtasks /Query /TN Sera  (logs\service.log)"
}

# ── optional: nightly backup Scheduled Task (-BackupCron) ─────────
if ($BackupCron) {
    Write-Step "Installing nightly backup task"
    New-Item -ItemType Directory -Force $BackupDir | Out-Null
    schtasks /Create /F /TN "Sera-Backup" /RU SYSTEM /SC DAILY /ST 02:30 /TR "powershell -NoProfile -ExecutionPolicy Bypass -File `"$ROOT\deploy\backup.ps1`"" | Out-Null
    Write-Sub "backup task installed: schtasks /Query /TN Sera-Backup -> $BackupDir"
    if ($OffsiteRemote) {
        Write-Sub "offsite destination: $OffsiteRemote"
        Set-EnvValue $ENV_FILE "OFFSITE_REMOTE" $OffsiteRemote
    } else {
        Write-Host "   WARNING: no offsite remote - dumps stay local only." -ForegroundColor Yellow
    }
}

# ── Caddy reverse proxy (-Domain) ──────────────────────────────
if ($Domain) {
    Write-Step "Installing Caddy reverse proxy for $Domain"
    $caddy = Ensure-Caddy
    $deployDir = Join-Path $ROOT "deploy"
    New-Item -ItemType Directory -Force $deployDir | Out-Null
    $caddyfile = Join-Path $deployDir "Caddyfile"
    @"
$Domain {
    reverse_proxy localhost:$Port
}
"@ | Set-Content -Path $caddyfile -Encoding UTF8 -NoNewline
    Write-Sub "Caddyfile written to $caddyfile"
    $caddySvc = Get-Service -Name "Caddy" -ErrorAction SilentlyContinue
    if ($caddySvc -and $caddySvc.Status -eq "Running") {
        Stop-Service -Name "Caddy" -Force -ErrorAction SilentlyContinue
    }
    & $caddy stop 2>$null
    & $caddy install --config $caddyfile --adapter caddyfile 2>$null
    Start-Service -Name "Caddy" -ErrorAction SilentlyContinue
    Write-Sub "Caddy service installed and started"
    Write-Sub "https://$Domain -> http://localhost:$Port"
}

# ── install npm deps if needed ──────────────────────────────────
if (-not (Test-Path (Join-Path $ROOT "node_modules\.package-lock.json"))) {
    Write-Host "Installing dependencies..." -ForegroundColor Cyan
    npm ci --omit=dev 2>$null
    if ($LASTEXITCODE -ne 0) { npm install --prefix $ROOT --omit=dev 2>$null }
}

Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue

# ── banner ──────────────────────────────────────────────────────
Write-Host ""
Write-Host "==================================" -ForegroundColor Green
Write-Host "  Sera backend" -ForegroundColor Green
Write-Host "  PostgreSQL: 127.0.0.1:5434" -ForegroundColor Green
Write-Host "  API:        http://localhost:$Port" -ForegroundColor Green
if ($Port -eq 80 -and -not $Domain) { Write-Host "  Public:     http://<your-public-ip>/ (HTTP-only, site + API same-origin)" -ForegroundColor Green }
if ($Domain) { Write-Host "  Caddy:      https://$Domain -> :$Port" -ForegroundColor Green }
Write-Host "  Node:       v$NodeVersion (local)" -ForegroundColor Green
Write-Host "  Ctrl+C to stop" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green
Write-Host ""

# ── start server ────────────────────────────────────────────────
& node server.js

} finally {
    Stop-Pg
}
