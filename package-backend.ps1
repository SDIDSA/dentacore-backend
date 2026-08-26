<#
.SYNOPSIS
  Packages the Sera backend into a hosting-ready zip (sera-backend-<version>.zip).

.DESCRIPTION
  Builds a whitelist-based staging tree, stages the authored deployment assets
  for BOTH targets (Linux: deploy/setup.sh / sera.service / nginx-sera.conf /
  backup.sh / sera-backup.cron; Windows: deploy/setup.ps1 / backup.ps1, plus
  README-HOSTED.txt — normalized to LF-only), validates every staged .js file
  with `node --check`, then compresses to dist\ and prints a SHA-256.

  The zip is platform-neutral: everything inside deploys on an Ubuntu host
  (deploy/setup.sh) or a Windows Server host (deploy/setup.ps1) per
  docs/HOSTING.md (the packager itself is Windows PowerShell by design).

.PARAMETER Version
  Version stamp for the artifact name. Default: parsed from ..\dentacore\pom.xml,
  falling back to 0.0.0-dev.

.PARAMETER OutDir
  Output directory for the zip + hash. Default: <backend root>\dist

.EXAMPLE
  ./package-backend.ps1
  ./package-backend.ps1 -Version 0.9.0 -OutDir C:\releases
#>
param(
    [string]$Version = "",
    [string]$OutDir = ""
)

$ErrorActionPreference = 'Stop'
$ROOT = $PSScriptRoot

# ── version resolution ─────────────────────────────────────────
if (-not $Version) {
    $Version = "0.0.0-dev"
    $pom = Join-Path $ROOT "..\dentacore\pom.xml"
    if (Test-Path $pom) {
        $m = Select-String -Path $pom -Pattern '<version>([^<]+)</version>' |
             Select-Object -First 1
        if ($m) { $Version = $m.Matches[0].Groups[1].Value }
    }
}
$stamp = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')

# ── paths ───────────────────────────────────────────────────────
if (-not $OutDir) { $OutDir = Join-Path $ROOT "dist" }
$pkgName = "sera-backend"
$stageRoot = Join-Path $env:TEMP ("sera-pkg-" + [IO.Path]::GetRandomFileName().Split('.')[0])
$stage   = Join-Path $stageRoot $pkgName
New-Item -ItemType Directory -Path $stage -Force | Out-Null

function Copy-ItemChecked([string]$from, [string]$to) {
    if (-not (Test-Path -LiteralPath $from)) { throw "required payload input missing: $from" }
    Copy-Item -LiteralPath $from -Destination $to -Recurse -Force
}

try {
    Write-Host "Packaging Sera backend v$Version -> $OutDir"

    # ── whitelisted payload ─────────────────────────────────────
    # Root files
    foreach ($f in 'server.js', 'package.json', 'db.sql', 'seed.sql') {
        Copy-ItemChecked (Join-Path $ROOT $f) $stage
    }
    if (Test-Path (Join-Path $ROOT 'package-lock.json')) {
        Copy-Item (Join-Path $ROOT 'package-lock.json') $stage -Force
    }
    if (Test-Path (Join-Path $ROOT '.env.example')) {
        Copy-Item (Join-Path $ROOT '.env.example') (Join-Path $stage '.env.example') -Force
    }
    New-Item -ItemType Directory -Path (Join-Path $stage 'docs') -Force | Out-Null
    Copy-ItemChecked (Join-Path $ROOT 'docs\HOSTING.md') (Join-Path $stage 'docs')

    # Directories (src minus __tests__)
    Copy-ItemChecked (Join-Path $ROOT 'src') $stage
    Remove-Item -LiteralPath (Join-Path $stage 'src\__tests__') -Recurse -Force -ErrorAction SilentlyContinue

    foreach ($d in 'public') { Copy-ItemChecked (Join-Path $ROOT $d) $stage }

    # scripts/: only runtime-relevant utilities
    New-Item -ItemType Directory -Path (Join-Path $stage 'scripts') -Force | Out-Null
    foreach ($s in 'verify-multitenancy.js', 'test-db-connection.js') {
        Copy-ItemChecked (Join-Path $ROOT "scripts\$s") (Join-Path $stage 'scripts')
    }

    # Runtime prerequisites (Node.js, PostgreSQL) are NOT bundled — setup.sh
    # installs both via apt on the target host (security updates + systemd
    # integration come from the distro packages).

    New-Item -ItemType Directory -Path (Join-Path $stage 'deploy') -Force | Out-Null

    # build manifest
    $manifest = @"
Sera hosted backend package
version : $Version
built   : $stamp
target  : Ubuntu 22.04/24.04 (+ any Node >= 20 host)
deploy  : see deploy/setup.sh and README-HOSTED.txt
"@

    # ── generated deploy assets (LF-only!) ──────────────────────
    function Write-LF([string]$rel, [string]$content) {
        $path = Join-Path $stage $rel
        $dir = Split-Path $path -Parent
        if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
        [IO.File]::WriteAllText($path, ($content -replace "`r`n", "`n"), [Text.UTF8Encoding]::new($false))
    }

    # ── authored deploy assets (kept LF-only in the zip) ─────────
    foreach ($a in 'deploy\setup.sh', 'deploy\sera.service', 'deploy\nginx-sera.conf',
                   'deploy\backup.sh', 'deploy\sera-backup.cron',
                   'deploy\setup.ps1', 'deploy\backup.ps1', 'README-HOSTED.txt') {
        $p = Join-Path $stage $a
        New-Item -ItemType Directory -Path (Split-Path $p -Parent) -Force | Out-Null
        Copy-ItemChecked (Join-Path $ROOT $a) (Split-Path $p -Parent)
        [IO.File]::WriteAllText($p,
            ([IO.File]::ReadAllText($p) -replace "`r`n", "`n"),
            [Text.UTF8Encoding]::new($false))
    }

    Write-LF 'HOSTED-BUILD.txt' $manifest

    # ── validation gates ────────────────────────────────────────
    Write-Host "-- validating staged JavaScript --"
    $jsFiles = Get-ChildItem $stage -Recurse -Filter *.js
    foreach ($jf in $jsFiles) {
        & node --check $jf.FullName 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "syntax error in $($jf.FullName)" }
    }
    Write-Host ("   {0} files OK" -f $jsFiles.Count)

    # LF purity on shell/unit assets
    foreach ($lf in 'deploy/setup.sh', 'deploy/sera.service', 'deploy/nginx-sera.conf',
                   'deploy/backup.sh', 'deploy/sera-backup.cron',
                   'deploy/setup.ps1', 'deploy/backup.ps1',
                   'README-HOSTED.txt', 'HOSTED-BUILD.txt') {
        $bytes = [IO.File]::ReadAllBytes((Join-Path $stage $lf))
        if ($bytes -contains [byte]13) { throw "CR found in $lf (must be LF-only)" }
    }
    Write-Host "   LF purity OK"

    # required files sanity
    foreach ($req in 'server.js', 'package.json', 'db.sql', 'src\app.js',
                     'public\book.html', 'deploy\setup.sh') {
        if (-not (Test-Path (Join-Path $stage $req))) { throw "staged file missing: $req" }
    }

    # ── compress + hash ─────────────────────────────────────────
    # NOTE: Compress-Archive on Windows PowerShell writes '\' entry separators,
    # which Linux unzip extracts as broken filenames. Build the archive via
    # .NET ZipArchive with explicit '/' separators instead.
    Add-Type -AssemblyName System.IO.Compression
    New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
    $zipPath = Join-Path $OutDir "sera-backend-$Version.zip"
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

    $fileStream = [IO.File]::Open($zipPath, [IO.FileMode]::Create)
    $archive = New-Object IO.Compression.ZipArchive($fileStream, [IO.Compression.ZipArchiveMode]::Create)
    try {
        Get-ChildItem $stage -Recurse -File | ForEach-Object {
            $rel = $_.FullName.Substring($stage.Length).TrimStart('\', '/').Replace('\', '/')
            $entry = $archive.CreateEntry("sera-backend/$rel", [IO.Compression.CompressionLevel]::Optimal)
            $inStream = [IO.File]::OpenRead($_.FullName)
            $outStream = $entry.Open()
            $inStream.CopyTo($outStream)
            $inStream.Dispose(); $outStream.Dispose()
        }
    } finally {
        $archive.Dispose(); $fileStream.Dispose()
    }

    $hash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLower()
    $shaPath = "$zipPath.sha256"
    "$hash *$(Split-Path $zipPath -Leaf)" | Out-File -FilePath $shaPath -Encoding ascii

    $sizeMB = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
    Write-Host ""
    Write-Host "  [v] $zipPath ($sizeMB MB)"
    Write-Host "  [v] SHA-256: $hash"
}
finally {
    Remove-Item -LiteralPath $stageRoot -Recurse -Force -ErrorAction SilentlyContinue
}
