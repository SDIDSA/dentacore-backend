# Self-contained Sera dev stack.
# Downloads its own Node.js + PostgreSQL binaries, starts an ephemeral PG instance,
# applies the schema, and runs nodemon. Ctrl+C to stop — everything shuts down.
param(
    [int]$PgPort = 5434,
    [int]$Port = 4000,
    [string]$DbName = "dentacore",
    [string]$DbUser = "dentacore",
    [string]$DbPass = "devpass123",
    [string]$NodeVersion = "24.20.0",
    [string]$PgVersion = "18.6-1"
)

$ErrorActionPreference = "Continue"
$ToolsDir = Join-Path $PSScriptRoot ".dev-tools"
$CacheDir = Join-Path $ToolsDir "cache"
$NodeDir = Join-Path $ToolsDir "node-v$NodeVersion-win-x64"
$PgDir   = Join-Path $ToolsDir "pgsql"

function Ensure-Node {
    if (Test-Path "$NodeDir\node.exe") { return "$NodeDir" }
    Write-Host "Downloading Node.js v$NodeVersion..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path $CacheDir | Out-Null
    $zip = Join-Path $CacheDir "node-v$NodeVersion-win-x64.zip"
    if (-not (Test-Path $zip)) {
        $url = "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-win-x64.zip"
        Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
        if ((Get-Item $zip).Length -lt 1MB) {
            Remove-Item $zip -Force
            Write-Host "ERROR: Node.js download failed (got HTML instead of zip)" -ForegroundColor Red; exit 1
        }
    }
    Expand-Archive -Path $zip -DestinationPath $ToolsDir -Force
    if (-not (Test-Path "$NodeDir\node.exe")) {
        Write-Host "ERROR: Node.js extraction failed" -ForegroundColor Red; exit 1
    }
    Write-Host "  Node v$NodeVersion ready" -ForegroundColor Green
    return "$NodeDir"
}

function Ensure-Pgsql {
    if (Test-Path "$PgDir\bin\pg_ctl.exe") { return "$PgDir" }
    Write-Host "Downloading PostgreSQL $PgVersion..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path $CacheDir | Out-Null
    $zip = Join-Path $CacheDir "pgsql-$PgVersion.zip"
    if (-not (Test-Path $zip)) {
        $url = "https://get.enterprisedb.com/postgresql/postgresql-$PgVersion-windows-x64-binaries.zip"
        Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
        if ((Get-Item $zip).Length -lt 1MB) {
            Remove-Item $zip -Force
            Write-Host "ERROR: PostgreSQL download failed (got HTML instead of zip)" -ForegroundColor Red; exit 1
        }
    }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    Write-Host "  Extracting bin/ and lib/ only..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path $PgDir | Out-Null
    $z = [System.IO.Compression.ZipFile]::OpenRead($zip)
    $extracted = 0
    foreach ($entry in $z.Entries) {
        $full = $entry.FullName
        if ($full -notmatch "^pgsql/(bin|lib|share)/") { continue }
        $dest = Join-Path $PgDir ($full -replace "^pgsql/", "")
        $destDir = Split-Path $dest -Parent
        if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Force -Path $destDir | Out-Null }
        if ($entry.Length -gt 0) {
            [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $dest, $true) | Out-Null
        }
        $extracted++
    }
    $z.Dispose()
    Write-Host "  Extracted $extracted files" -ForegroundColor Green
    if (-not (Test-Path "$PgDir\bin\pg_ctl.exe")) {
        Write-Host "ERROR: PostgreSQL extraction failed" -ForegroundColor Red; exit 1
    }
    Remove-Item "$PgDir\data" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  PostgreSQL $PgVersion ready" -ForegroundColor Green
    return "$PgDir"
}

function Stop-Pg([string]$pgBin, [string]$dataDir) {
    if ((-not $pgBin) -or (-not $dataDir)) { return }
    if (-not (Test-Path "$pgBin\pg_ctl.exe")) { return }
    & "$pgBin\pg_ctl.exe" stop -D $dataDir -m fast -w 2>$null
}

# ── main ────────────────────────────────────────────────────────
$pgBin = $null
$dataDir = $null

try {

$nodeDir = Ensure-Node
$pgBin   = Join-Path (Ensure-Pgsql) "bin"

$dataDir  = Join-Path $env:TEMP "sera-dev-pg-$PgPort"
$logFile  = Join-Path $env:TEMP "sera-dev-pg-$PgPort.log"

# -- init data dir if needed --
if (-not (Test-Path "$dataDir\postgresql.conf")) {
    Write-Host "Initializing PostgreSQL data dir..." -ForegroundColor Cyan
    & "$pgBin\initdb.exe" -D $dataDir -U $DbUser -E UTF8 --locale=C 2>$null
    if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: initdb failed" -ForegroundColor Red; exit 1 }

    $conf = Join-Path $dataDir "postgresql.conf"
    (Get-Content $conf -Raw) -replace "#?port\s*=.*", "port = $PgPort" | Set-Content $conf
    "listen_addresses = 'localhost'" | Add-Content $conf
    "shared_buffers = 64MB" | Add-Content $conf
    "logging_collector = off" | Add-Content $conf

    $hba = Join-Path $dataDir "pg_hba.conf"
    "host all all 127.0.0.1/32 trust" | Set-Content $hba
    "host all all ::1/128 trust" | Add-Content $hba
}

# -- start PG --
& "$pgBin\pg_isready.exe" -h 127.0.0.1 -p $PgPort 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Starting PostgreSQL on port $PgPort..." -ForegroundColor Cyan
    Start-Process -FilePath "$pgBin\pg_ctl.exe" -ArgumentList "start -D `"$dataDir`" -l `"$logFile`"" -NoNewWindow
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Milliseconds 500
        & "$pgBin\pg_isready.exe" -h 127.0.0.1 -p $PgPort 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { break }
    }
    & "$pgBin\pg_isready.exe" -h 127.0.0.1 -p $PgPort 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: pg_ctl start failed" -ForegroundColor Red; exit 1 }
}

# -- create role + database --
$env:PGPASSWORD = $DbPass
$roleExists = & "$pgBin\psql.exe" -h 127.0.0.1 -p $PgPort -U $DbUser -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DbUser'" 2>$null
if ($roleExists -ne "1") {
    Write-Host "Creating role '$DbUser'..." -ForegroundColor Cyan
    & "$pgBin\psql.exe" -h 127.0.0.1 -p $PgPort -U $DbUser -d postgres -c "CREATE ROLE $DbUser WITH LOGIN PASSWORD '$DbPass' SUPERUSER" 2>$null
}
$dbExists = & "$pgBin\psql.exe" -h 127.0.0.1 -p $PgPort -U $DbUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DbName'" 2>$null
if ($dbExists -ne "1") {
    Write-Host "Creating database '$DbName'..." -ForegroundColor Cyan
    & "$pgBin\psql.exe" -h 127.0.0.1 -p $PgPort -U $DbUser -d postgres -c "CREATE DATABASE $DbName OWNER $DbUser" 2>$null
}

# -- apply schema --
Write-Host "Applying schema..." -ForegroundColor Cyan
& "$pgBin\psql.exe" -h 127.0.0.1 -p $PgPort -U $DbUser -d $DbName -v ON_ERROR_STOP=1 -f (Join-Path $PSScriptRoot "db.sql") 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: schema failed" -ForegroundColor Red; exit 1 }

# -- install npm deps if needed --
if (-not (Test-Path (Join-Path $PSScriptRoot "node_modules\.package-lock.json"))) {
    Write-Host "Installing dependencies..." -ForegroundColor Cyan
    & "$nodeDir\npm.cmd" install --prefix $PSScriptRoot 2>$null
}

# -- start node --
$env:DB_HOST = "127.0.0.1"
$env:DB_PORT = "$PgPort"
$env:DB_NAME = $DbName
$env:DB_USER = $DbUser
$env:DB_PASSWORD = $DbPass
$env:NODE_ENV = "development"
$env:PORT = "$Port"
$env:PATH = "$nodeDir;$env:PATH"

Write-Host ""
Write-Host "==================================" -ForegroundColor Green
Write-Host "  Sera dev stack" -ForegroundColor Green
Write-Host "  PostgreSQL: 127.0.0.1:$PgPort" -ForegroundColor Green
Write-Host "  API:        http://localhost:$Port" -ForegroundColor Green
Write-Host "  Node:       v$NodeVersion (local)" -ForegroundColor Green
Write-Host "  Ctrl+C to stop" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green
Write-Host ""

& "$nodeDir\npm.cmd" run dev

} finally {
    Write-Host "Stopping PostgreSQL..." -ForegroundColor Yellow
    if ($pgBin -and $dataDir) { Stop-Pg $pgBin $dataDir }
    Get-Process -Name "postgres","pg_ctl" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    if ($dataDir -and (Test-Path $dataDir)) {
        Remove-Item -Recurse -Force $dataDir -ErrorAction SilentlyContinue
    }
}
