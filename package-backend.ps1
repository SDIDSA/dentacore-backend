<#
.SYNOPSIS
  Packages the Sera backend into a hosting-ready zip (sera-backend-<version>.zip).

.DESCRIPTION
  Builds a whitelist-based staging tree, generates the Linux deployment assets
  (setup.sh / systemd unit / nginx sample — all LF-only), validates every staged
  .js file with `node --check`, then compresses to dist\ and prints a SHA-256.

  The zip is platform-neutral: everything inside deploys on an Ubuntu host per
  docs/HOSTING.md (the script itself is Windows PowerShell by design).

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

    # Directories (src minus __tests__)
    Copy-ItemChecked (Join-Path $ROOT 'src') $stage
    Remove-Item -LiteralPath (Join-Path $stage 'src\__tests__') -Recurse -Force -ErrorAction SilentlyContinue

    foreach ($d in 'public', 'migrations') { Copy-ItemChecked (Join-Path $ROOT $d) $stage }

    # scripts/: only runtime-relevant utilities
    New-Item -ItemType Directory -Path (Join-Path $stage 'scripts') -Force | Out-Null
    foreach ($s in 'migrate.js', 'verify-multitenancy.js', 'test-db-connection.js') {
        Copy-ItemChecked (Join-Path $ROOT "scripts\$s") (Join-Path $stage 'scripts')
    }

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

    Write-LF 'HOSTED-BUILD.txt' $manifest

    Write-LF 'deploy/setup.sh' @'
#!/usr/bin/env bash
# Sera backend bootstrap for Ubuntu 22.04/24.04.
# Run from the extracted folder:  sudo bash deploy/setup.sh [--systemd]
set -euo pipefail

PORT="${PORT:-3000}"
WITH_SYSTEMD=no
for a in "$@"; do
  case "$a" in
    --systemd) WITH_SYSTEMD=yes ;;
    --port) PORT="$2"; shift ;;
  esac
done

echo "== Sera backend bootstrap =="
command -v node >/dev/null || { echo "ERROR: Node.js >= 20 required (https://deb.nodesource.com/setup_22.x)"; exit 1; }
command -v npm >/dev/null || { echo "ERROR: npm not found"; exit 1; }

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

echo "-- installing production dependencies --"
npm ci --omit=dev

if [ ! -f .env ]; then
  echo "-- creating .env from .env.example --"
  cp .env.example .env
  if command -v openssl >/dev/null; then
    PW="$(openssl rand -hex 16)"
    sed -i "s/^DB_PASSWORD=.*/DB_PASSWORD=${PW}/" .env
    echo "   generated DB_PASSWORD (store it somewhere safe)"
  else
    echo "   WARNING: openssl missing - edit DB_PASSWORD in .env manually"
  fi
fi

echo "-- applying schema + migrations --"
npm run migrate

if [ "$WITH_SYSTEMD" = "yes" ]; then
  SVC_USER="${SVC_USER:-sera}"
  id -u "$SVC_USER" >/dev/null 2>&1 || useradd -r -s /usr/sbin/nologin "$SVC_USER"
  chown -R "$SVC_USER":"$SVC_USER" "$APP_DIR"
  sed -e "s|__APP_DIR__|${APP_DIR}|g" -e "s|__SVC_USER__|${SVC_USER}|g" \
      deploy/sera.service > /etc/systemd/system/sera.service
  systemctl daemon-reload
  systemctl enable --now sera
  echo "-- service installed: systemctl status sera --"
fi

cat <<'EOF'

Done. Next steps:
  1. Review .env (NODE_ENV=production, JWT secrets, CORS_ORIGIN)
  2. Start manually:  NODE_ENV=production node server.js
     (or use the systemd unit installed above)
  3. Health check:    curl http://localhost:3000/health
  Full runbook: docs/HOSTING.md in the repository.

EOF
'@

    Write-LF 'deploy/sera.service' @'
[Unit]
Description=Sera API (Node.js/Express)
After=network.target postgresql.service

[Service]
Type=simple
User=__SVC_USER__
WorkingDirectory=__APP_DIR__
EnvironmentFile=__APP_DIR__/.env
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
'@

    Write-LF 'deploy/nginx-sera.conf' @'
# Reverse proxy sample — certbot --nginx adds the TLS block afterwards.
server {
    listen 80;
    server_name api.sera.dz;

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
'@

    Write-LF 'README-HOSTED.txt' @'
Sera hosted backend — quick start (Ubuntu)

  1. unzip sera-backend-<version>.zip
  2. cd sera-backend
  3. sudo bash deploy/setup.sh --systemd

Requires Node.js >= 20 and PostgreSQL 14+ running locally
(create db + user first: see docs/HOSTING.md in the repository).

Health:            curl http://localhost:3000/health
Booking portal:    http://<host>:3000/book.html?clinic=<slug>
Full runbook:      docs/HOSTING.md
'@

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
                   'README-HOSTED.txt', 'HOSTED-BUILD.txt') {
        $bytes = [IO.File]::ReadAllBytes((Join-Path $stage $lf))
        if ($bytes -contains [byte]13) { throw "CR found in $lf (must be LF-only)" }
    }
    Write-Host "   LF purity OK"

    # required files sanity
    foreach ($req in 'server.js', 'package.json', 'db.sql', 'src\app.js',
                     'public\book.html', 'scripts\migrate.js', 'deploy\setup.sh') {
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
