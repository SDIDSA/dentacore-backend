<#
.SYNOPSIS
  Restores a Sera PostgreSQL backup (.dump, custom format) produced by the
  nightly '<AppName>Backup' scheduled task (or setup-backend.ps1's initial backup).

.DESCRIPTION
  DESTRUCTIVE: runs pg_restore with --clean --if-exists against the live dentacore
  database, dropping and recreating every object. A safety pre-restore dump of the
  current database is taken first (into ProgramData\<AppName>\backups unless the
  backups directory does not exist, in which case next to this script).

  Credentials are read from {BackendDir}\.env (DB_USER / DB_PASSWORD / DB_PORT /
  DB_NAME). pg_restore / pg_dump are resolved from {BackendDir}\pgsql\bin.
  The password is passed via the PGPASSWORD environment variable - never as a
  command-line argument. No credentials are hardcoded.

.USAGE
  On an installed machine the script ships in {app}\backend\scripts:

    powershell -NoProfile -ExecutionPolicy Bypass -File restore-db.ps1 `
        -DumpFile "C:\ProgramData\Sera\backups\dentacore_20260823_020000.dump"

  You will be prompted to type RESTORE to confirm. For unattended use skip the
  prompt with the explicit confirmation switch:

    ... -DumpFile <path> -ConfirmBackup

  Optional parameters:
    -BackendDir      Backend root containing .env and pgsql\bin
                     (default: parent folder of this script's directory)
    -SkipSafetyDump  Skip the pre-restore safety dump (not recommended)
#>
param(
    [Parameter(Mandatory=$true)]
    [string]$DumpFile,
    # Skips the typed RESTORE confirmation. The historical name
    # -ConfirmBackup is kept as an alias for compatibility; the intent is
    # "I confirm the restore", not "make a backup".
    [switch]$Yes,
    [switch]$ConfirmBackup,
    [string]$BackendDir,
    [switch]$SkipSafetyDump,
    # Product name from pom.xml <app.name>; drives the task name and the
    # ProgramData\<AppName> safety-dump location. Must match setup-backend.ps1.
    [string]$AppName = "Sera"
)

$taskBackupName = "${AppName}Backup"

$SkipRestoreConfirmation = $Yes -or $ConfirmBackup

$ErrorActionPreference = "Stop"

function Read-DotEnv {
    param([string]$Path)
    $cfg = @{}
    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }
        $idx = $trimmed.IndexOf('=')
        if ($idx -lt 1) { continue }
        $key = $trimmed.Substring(0, $idx).Trim()
        $val = $trimmed.Substring($idx + 1).Trim()
        if (($val.Length -ge 2) -and (($val[0] -eq '"' -and $val[-1] -eq '"') -or ($val[0] -eq "'" -and $val[-1] -eq "'"))) {
            $val = $val.Substring(1, $val.Length - 2)
        }
        $cfg[$key] = $val
    }
    return $cfg
}

# -- Resolve paths --------------------------------------------------------------------------------

if (-not $BackendDir) {
    if (-not $PSScriptRoot) { throw "-BackendDir not given and script location unknown" }
    $BackendDir = Split-Path -Parent $PSScriptRoot
}
$envFile   = Join-Path $BackendDir ".env"
$pgBin     = Join-Path $BackendDir "pgsql\bin"
$pgRestore = Join-Path $pgBin "pg_restore.exe"
$pgDumpExe = Join-Path $pgBin "pg_dump.exe"

$DumpFile = (Resolve-Path -LiteralPath $DumpFile -ErrorAction Stop).Path

Write-Host "Sera database restore"
Write-Host "  Dump file   : $DumpFile"
Write-Host "  Backend dir : $BackendDir"

if (-not (Test-Path -LiteralPath $envFile))   { throw ".env not found at $envFile" }
if (-not (Test-Path -LiteralPath $pgRestore)) { throw "pg_restore.exe not found at $pgRestore" }

# -- Confirmation ---------------------------------------------------------------------------------

if (-not $SkipRestoreConfirmation) {
    Write-Host ""
    Write-Host "WARNING: this OVERWRITES the live dentacore database (--clean --if-exists)." -ForegroundColor Yellow
    Write-Host "All current data will be dropped and replaced by the contents of the dump." -ForegroundColor Yellow
    $answer = (Read-Host "Type RESTORE to continue (anything else aborts)").Trim()
    if ($answer -cne 'RESTORE') {
        Write-Host "Aborted - no changes made."
        exit 1
    }
} else {
    Write-Host "-Yes/-ConfirmBackup given: skipping interactive confirmation"
}

# -- Read config ----------------------------------------------------------------------------------

$cfg = Read-DotEnv -Path $envFile
$dbUser     = $cfg['DB_USER']; if (-not $dbUser) { $dbUser = 'dentacore' }
$dbName     = $cfg['DB_NAME']; if (-not $dbName) { $dbName = 'dentacore' }
$dbPort     = $cfg['DB_PORT']; if (-not $dbPort) { $dbPort = '5434' }
$dbPassword = $cfg['DB_PASSWORD']
if (-not $dbPassword) { throw "DB_PASSWORD missing from $envFile" }

Write-Host "  Database    : $dbName on localhost:$dbPort (user $dbUser)"

# -- Safety pre-restore dump ----------------------------------------------------------------------

if (-not $SkipSafetyDump) {
    if (-not (Test-Path -LiteralPath $pgDumpExe)) { throw "pg_dump.exe not found at $pgDumpExe (required for the safety dump)" }
    $safetyDir = Join-Path $env:ProgramData "$AppName\backups"
    if (-not (Test-Path -LiteralPath $safetyDir)) { $safetyDir = $PSScriptRoot }
    $stamp       = Get-Date -Format 'yyyyMMdd_HHmmss'
    $safetyDump  = Join-Path $safetyDir "pre_restore_safety_${stamp}.dump"

    Write-Host "Taking safety pre-restore dump -> $safetyDump ..."
    $env:PGPASSWORD = $dbPassword
    try {
        & $pgDumpExe -h localhost -p $dbPort -U $dbUser -Fc -d $dbName -f $safetyDump
        $safetyExit = $LASTEXITCODE
    } finally {
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    }
    if ($safetyExit -ne 0) {
        throw "Safety pre-restore dump failed (exit $safetyExit) - restore aborted, live data untouched"
    }
    Write-Host "Safety dump OK. Restore it with this script if anything goes wrong."
}

# -- Restore --------------------------------------------------------------------------------------

Write-Host "Restoring (this can take a while) ..."
$env:PGPASSWORD = $dbPassword
try {
    & $pgRestore -h localhost -p $dbPort -U $dbUser -d $dbName --clean --if-exists "$DumpFile"
    $restoreExit = $LASTEXITCODE
} finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

if ($restoreExit -ne 0) {
    Write-Host ""
    Write-Host "pg_restore exited with code $restoreExit." -ForegroundColor Red
    Write-Host "Some errors are benign when restoring over a live DB (e.g. active connections);" -ForegroundColor Red
    Write-Host "verify app functionality or re-run against a freshly recreated database." -ForegroundColor Red
    exit $restoreExit
}

Write-Host ""
Write-Host "Restore completed successfully." -ForegroundColor Green
exit 0
