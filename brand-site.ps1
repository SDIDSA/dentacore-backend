<#
.SYNOPSIS
  Regenerates the Sera public-site brand assets from branding/identity.svg.

.DESCRIPTION
  Standalone brand pass for the backend's public website (dentacore-backend/public/),
  so the backend pipeline is self-sufficient from the brand SSOT:
    - public/favicon.ico        (tiled knockout accent mark; needs ImageMagick)
    - public/icons/task-icon.svg (flat accent mark)
    - the <span class="brand-mark"> SVGs inside public/index.html (nav + footer)
  Mirrors the site outputs of the client pipeline's deploy.ps1 Phase 1.5. If
  ImageMagick ('magick') is absent, the favicon is left untouched but the pure-SVG
  assets (task-icon.svg + brand marks) are still regenerated. Idempotent: existing
  files are only rewritten when their content changes.
.PARAMETER Root
  The dentacore-backend root directory (default: this script's directory).
#>
param(
    [string]$Root = $PSScriptRoot
)

$ErrorActionPreference = 'Stop'

$BrandSvg = Join-Path $Root "..\branding\identity.svg"
$WebsiteDir = Join-Path $Root "public"
$MagickCmd = Get-Command magick -ErrorAction SilentlyContinue

if (-not (Test-Path -LiteralPath $BrandSvg)) {
    Write-Host "WARNING: brand SSOT not found at '$BrandSvg' - keeping existing site brand assets" -ForegroundColor Yellow
    return
}

Write-Host "Branding site from $BrandSvg"

# ── SSOT ingestion + MEASURED NORMALIZATION (mirrors client deploy.ps1) ──
$svgText = [System.IO.File]::ReadAllText($BrandSvg)
if ($svgText -notmatch ' d="([^"]+)"') {
    Write-Host "ERROR: no path data found in branding SSOT" -ForegroundColor Red; exit 1
}

# drawable inner content = everything after </defs> (or <svg>) minus </svg>
$inner = $svgText
$di = $inner.IndexOf('</defs>')
if ($di -ge 0) { $inner = $inner.Substring($di + 7) }
else {
    $dm = [regex]::Match($inner, '<defs\b[^>]*/>')
    if ($dm.Success) { $inner = $inner.Substring($dm.Index + $dm.Length) }
    else {
        $gt = $inner.IndexOf('>', $inner.IndexOf('<svg'))
        $inner = $inner.Substring($gt + 1)
    }
}
$inner = [regex]::Replace($inner, '(?s)<sodipodi:namedview\b.*?(/>|</sodipodi:namedview>)', '')
$inner = $inner.Substring(0, $inner.LastIndexOf('</svg>')).Trim()
$innerNoFill = [regex]::Replace($inner, '\s+(style="fill:[^"]*"|fill="[^"]*")', '')

$declared = 48.0
if ($svgText -match 'viewBox="\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)\s*"') {
    $declared = [double]$Matches[1]
} elseif ($svgText -match '<svg[^>]*?\swidth="([\d.]+)"') {
    $declared = [double]$Matches[1]
}

if ($MagickCmd) {
    $brandTmp = Join-Path $env:TEMP ("sera-brand-" + [IO.Path]::GetRandomFileName().Split('.')[0])
    New-Item -ItemType Directory -Path $brandTmp -Force | Out-Null
    & $MagickCmd.Source -background none $BrandSvg -resize 512x512 (Join-Path $brandTmp "ssot.png")
    $geom = & $MagickCmd.Source (Join-Path $brandTmp "ssot.png") '-trim' -format '%w %h %X %Y' 'info:'
    $m = [regex]::Match(($geom -join ' '), '(\d+)\s+(\d+)\s+([+-]?[\d.]+)(px)?\s+([+-]?[\d.]+)(px)?')
    if ($m.Success -and [int]$m.Groups[1].Value -gt 0) {
        $f      = 512.0 / $declared
        $mUser  = ([double]$m.Groups[1].Value) / $f
        if (([double]$m.Groups[2].Value) / $f -gt $mUser) { $mUser = ([double]$m.Groups[2].Value) / $f }
        $cxUser = (([double]$m.Groups[3].Value) + ([double]$m.Groups[1].Value) / 2) / $f
        $cyUser = (([double]$m.Groups[5].Value) + ([double]$m.Groups[2].Value) / 2) / $f
    } else {
        Write-Host "ERROR: could not measure branding SSOT ink" -ForegroundColor Red; exit 1
    }
    $k48   = [math]::Round(38.4 / $mUser, 4).ToString([System.Globalization.CultureInfo]::InvariantCulture)
    $tx48  = [math]::Round(24 - $cxUser * (38.4 / $mUser), 4).ToString([System.Globalization.CultureInfo]::InvariantCulture)
    $ty48  = [math]::Round(24 - $cyUser * (38.4 / $mUser), 4).ToString([System.Globalization.CultureInfo]::InvariantCulture)
    $k256  = [math]::Round(148.8 / $mUser, 4).ToString([System.Globalization.CultureInfo]::InvariantCulture)
    $tx256 = [math]::Round(128 - $cxUser * (148.8 / $mUser), 4).ToString([System.Globalization.CultureInfo]::InvariantCulture)
    $ty256 = [math]::Round(128 - $cyUser * (148.8 / $mUser), 4).ToString([System.Globalization.CultureInfo]::InvariantCulture)

    $bareG     = "<g transform=""translate($tx48,$ty48) scale($k48)"">$innerNoFill</g>"
    $accentG48 = "<g fill=""#2563EB"" transform=""translate($tx48,$ty48) scale($k48)"">$innerNoFill</g>"
    $cutG256   = "<g transform=""translate($tx256,$ty256) scale($k256)"">$innerNoFill</g>"

    # favicon.ico: tiled knockout accent mark (accent tile with mark knocked out)
    $tileSvg = "<svg xmlns=""http://www.w3.org/2000/svg"" viewBox=""0 0 256 256"" width=""256"" height=""256"">$cutG256</svg>"
    $tileBaseSvg = "<svg xmlns=""http://www.w3.org/2000/svg"" viewBox=""0 0 256 256"" width=""256"" height=""256"">" +
        "<rect width=""256"" height=""256"" rx=""56"" fill=""#2563EB""/></svg>"
    [System.IO.File]::WriteAllText((Join-Path $brandTmp "tile.svg"), $tileBaseSvg, (New-Object System.Text.UTF8Encoding($false)))
    [System.IO.File]::WriteAllText((Join-Path $brandTmp "cut.svg"), $tileSvg, (New-Object System.Text.UTF8Encoding($false)))
    & $MagickCmd.Source -background none (Join-Path $brandTmp "tile.svg") (Join-Path $brandTmp "tile.png")
    & $MagickCmd.Source -background none (Join-Path $brandTmp "cut.svg") (Join-Path $brandTmp "cut.png")
    & $MagickCmd.Source (Join-Path $brandTmp "tile.png") (Join-Path $brandTmp "cut.png") `
        "-compose" "DstOut" "-composite" (Join-Path $brandTmp "tile-cut.png")
    if ($LASTEXITCODE -eq 0) {
        $favP = Join-Path $WebsiteDir "favicon.ico"
        $favTmp = Join-Path $brandTmp "favicon.ico"
        & $MagickCmd.Source -background none (Join-Path $brandTmp "tile-cut.png") -define icon:auto-resize=48,32,16 $favTmp
        if ($LASTEXITCODE -eq 0) {
            if (-not (Test-Path -LiteralPath $favP) -or
                -not [System.Linq.Enumerable]::SequenceEqual([System.IO.File]::ReadAllBytes($favP), [System.IO.File]::ReadAllBytes($favTmp))) {
                Copy-Item -LiteralPath $favTmp -Destination $favP -Force
                Write-Host "  favicon.ico regenerated"
            }
        } else {
            Write-Host "WARNING: favicon.ico generation failed - keeping existing" -ForegroundColor Yellow
        }
    } else {
        Write-Host "WARNING: tile knockout composite failed - keeping existing favicon" -ForegroundColor Yellow
    }
    Remove-Item -LiteralPath $brandTmp -Recurse -Force
} else {
    # No ImageMagick: still emit the pure-SVG brand assets using canonical layout
    $k48   = "0.8"; $tx48 = "24"; $ty48 = "24"
    $bareG     = "<g transform=""translate($tx48,$ty48) scale($k48)"">$innerNoFill</g>"
    $accentG48 = "<g fill=""#2563EB"" transform=""translate($tx48,$ty48) scale($k48)"">$innerNoFill</g>"
    Write-Host "WARNING: ImageMagick not found - keeping existing favicon.ico" -ForegroundColor Yellow
}

# ── public/icons/task-icon.svg (flat accent mark) ──
$iconsDir = Join-Path $WebsiteDir "icons"
New-Item -ItemType Directory -Path $iconsDir -Force | Out-Null
$faviconSvg = "<svg xmlns=""http://www.w3.org/2000/svg"" viewBox=""0 0 48 48"">$accentG48</svg>"
if (-not (Test-Path -LiteralPath (Join-Path $iconsDir "task-icon.svg")) -or
    [System.IO.File]::ReadAllText((Join-Path $iconsDir "task-icon.svg")) -ne $faviconSvg) {
    [System.IO.File]::WriteAllText((Join-Path $iconsDir "task-icon.svg"), $faviconSvg, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "  icons/task-icon.svg regenerated"
}

# ── inline .brand-mark SVGs in index.html (nav + footer) ──
$WebIndex = Join-Path $WebsiteDir "index.html"
if (Test-Path -LiteralPath $WebIndex) {
    $html = [System.IO.File]::ReadAllText($WebIndex)
    $markSvg = "<svg aria-hidden=""true"" xmlns=""http://www.w3.org/2000/svg"" viewBox=""0 0 48 48"" fill=""currentColor"">$bareG</svg>"
    $markedHtml = [regex]::Replace(
        $html,
        '(?s)(<span class="brand-mark"[^>]*>\s*)<svg.*?</svg>',
        ('${1}' + $markSvg.Replace('$', '$$')))
    if ($markedHtml -ne $html) {
        [System.IO.File]::WriteAllText($WebIndex, $markedHtml, (New-Object System.Text.UTF8Encoding($false)))
        Write-Host "  brand-mark SVGs regenerated"
    }
}

Write-Host "Site branding complete"
