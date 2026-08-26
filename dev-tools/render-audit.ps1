<#
.SYNOPSIS
  Rendered-DOM audit for the Sera landing page (headless Edge via CDP).

.DESCRIPTION
  Builds website/_preview.html from index.html (adds URL-param overrides for
  theme/lang + a post-load metrics probe), drives headless Edge through the
  DevTools protocol, and returns measured geometry/styles of the redesign's
  key devices. Why CDP: msedge.exe is a GUI-subsystem binary — its stdout
  (--dump-dom, console) never reaches PowerShell on Windows.

.EXAMPLES
  ./render-audit.ps1                              # desktop light, layout probe
  ./render-audit.ps1 -Theme dark                  # dark tokens
  ./render-audit.ps1 -Size '500,3400'             # small-viewport rules
  ./render-audit.ps1 -Lang ar -Interact           # RTL boot + panel/calendar interaction
#>
param(
  [int]$Port = 9240,
  [string]$Size = '1440,5400',
  [ValidateSet('light','dark')][string]$Theme = 'light',
  [ValidateSet('en','fr','ar')][string]$Lang = 'en',
  [switch]$Interact,
  [string]$SiteRoot = "$PSScriptRoot\..\public"
)

$ErrorActionPreference = 'Stop'
$site = (Resolve-Path $SiteRoot).Path

# ---- 1. build _preview.html from the real source -------------------------
$src = [IO.File]::ReadAllText("$site\index.html", [Text.Encoding]::UTF8)
$earlyAnchor = '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
$early = $earlyAnchor + "`n" +
  '<script>/* render-audit: URL-param overrides, must run BEFORE the pre-paint resolver */' +
  'try{var q=location.search,m=q.match(/theme=(dark|light)/);if(m)localStorage.setItem("dc-theme",m[1]);' +
  'var l=q.match(/[?&]lang=(en|fr|ar)/);if(l)localStorage.setItem("dc-lang",l[1])}catch(e){}</script>'
$out = $src.Replace($earlyAnchor, $early)

if (-not $Interact) {
  $probe = @'
<script>/* render-audit probe — end-of-body script: DOM is ready; do NOT wait for
   window.load here, a slow/hung font fetch would block it forever */
setTimeout(function(){
  function pick(s,p){var e=document.querySelector(s);return e?getComputedStyle(e)[p]:'MISSING:'+s}
  function pickPseudo(s,ps,p){try{var e=document.querySelector(s);return e?getComputedStyle(e,ps)[p]:'ERR'}catch(x){return 'ERR'}}
  var feats=[].map.call(document.querySelectorAll('#features .card'),function(c){return Math.round(c.getBoundingClientRect().height)});
  var a={
    theme:document.documentElement.getAttribute('data-theme'),
    dir:document.documentElement.getAttribute('dir'),
    vw:innerWidth,
    bodyColor:getComputedStyle(document.body).color,
    h1Font:getComputedStyle(document.querySelector('.hero-copy h1')).fontFamily.split(',')[0],
    h1Weight:getComputedStyle(document.querySelector('.hero-copy h1')).fontWeight,
    markBg:(function(){var m=document.querySelector('.hero-copy mark');return m?getComputedStyle(m).backgroundColor:'NO MARK'})(),
    chromeTitle:pickPseudo('.app-chrome','::after','content').slice(0,26),
    featRowCounts:feats.length,
    featRowCols:pick('#features .card','gridTemplateColumns'),
    tagCount:document.querySelectorAll('#features .card .tag').length,
    idxText:(function(){var e=document.querySelector('#features .idx');return e?(e.offsetWidth>0?'visible':'zero'):'MISSING'})(),
    stepNum:(document.querySelector('.step-num')||{}).textContent,
    stepArrow:pickPseudo('.steps li','::after','content'),
    badgePos:pick('.badge','position'),
    featuredBg:pick('.price-card.featured','backgroundColor'),
    faqQ1:pickPseudo('.faq summary','::before','content'),
    specFont:pick('.specimen','fontFamily').split(',')[0],
    eyebrowBracket:pickPseudo('.eyebrow','::before','content'),
    ctaBg:pick('.cta-band','backgroundColor'),
    btnPrimaryBg:pick('#downloadBtn','backgroundColor'),
    btnRadius:pick('#downloadBtn','borderRadius'),
    gradGone:!document.querySelector('.grad'),
    orbGone:!document.querySelector('.orb'),
    serifGone:getComputedStyle(document.querySelector('h1')).fontFamily.indexOf('Fraunces')===-1,
    footerTxt:(document.querySelector('.footer p')||{}).textContent,
    calCells:document.querySelectorAll('.cal-cell').length,
    panelsVisible:document.querySelectorAll('.app-panel.visible').length
  };
  var pre=document.createElement('pre');pre.id='AUDIT';pre.textContent='__A__'+JSON.stringify(a)+'__Z__';
  document.body.appendChild(pre);
},1100);
</script>
'@
  $out = $out.Replace('</body>', $probe + '</body>')
}
[IO.File]::WriteAllText("$site\_preview.html", $out, [Text.UTF8Encoding]::new($false))

# ---- 2. drive headless Edge over CDP --------------------------------------
$url = ([Uri]([IO.Path]::Combine($site, '_preview.html'))).AbsoluteUri + "?theme=$Theme&lang=$Lang"
$profile = Join-Path $env:TEMP "edge-audit-$Port"
$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
          "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") |
        Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw 'msedge.exe not found' }

$proc = Start-Process -FilePath $edge -ArgumentList @(
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  "--remote-debugging-port=$Port", "--user-data-dir=$profile",
  "--window-size=$Size", "`"$url`""
) -PassThru

try {
  $targets = $null
  foreach ($i in 1..30) {
    Start-Sleep -Milliseconds 500
    try { $targets = Invoke-RestMethod "http://127.0.0.1:$Port/json" -TimeoutSec 2; break } catch {}
  }
  if (-not $targets) { throw 'devtools endpoint never came up' }
  $page = $targets | Where-Object { $_.type -eq 'page' } | Select-Object -First 1

  $ws = [System.Net.WebSockets.ClientWebSocket]::new()
  $ws.ConnectAsync([Uri]$page.webSocketDebuggerUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()

  function Send-Recv([int]$id, [string]$json) {
    $bytes = [Text.Encoding]::UTF8.GetBytes($json)
    $ws.SendAsync([ArraySegment[byte]]::new($bytes), 'Text', $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
    while ($true) {
      $buf = New-Object byte[] (4MB)
      $sb = [System.Text.StringBuilder]::new()
      do {
        $seg = [ArraySegment[byte]]::new($buf)
        $r = $ws.ReceiveAsync($seg, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
        [void]$sb.Append([Text.Encoding]::UTF8.GetString($buf, 0, $r.Count))
      } while (-not $r.EndOfMessage)
      $msg = $sb.ToString() | ConvertFrom-Json
      if ($msg.id -eq $id) { return $msg }
    }
  }

  Start-Sleep -Seconds 3   # load handlers, fonts, reveal observer

  # graceful browser shutdown over CDP (kills the whole process tree cleanly)
  $bye = @{ id = 90; method = 'Browser.close'; params = @{} } | ConvertTo-Json -Compress -Depth 4
  $shutdown = { try {
    $bytes = [Text.Encoding]::UTF8.GetBytes($bye)
    $ws.SendAsync([ArraySegment[byte]]::new($bytes), 'Text', $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
  } catch {} }

  if ($Interact) {
    $await = $false
    $expr = @'
(function(){
  var o={ready:document.readyState};
  var btn=document.querySelector('.side-item[data-page="appointments"]');
  if(!btn){
    o.error='side-item not found';
    o.bodyLen=document.body?document.body.innerHTML.length:-1;
    o.sideItems=document.querySelectorAll('.side-item').length;
    o.h1=document.querySelector('.hero-copy h1')?document.querySelector('.hero-copy h1').textContent.slice(0,30):'none';
    return o;
  }
  o.dir=document.documentElement.getAttribute('dir');
  o.bootLang=document.documentElement.getAttribute('lang');
  o.h1Html=document.querySelector('.hero-copy h1').innerHTML.slice(0,50);
  btn.click();
  o.apptVisible=document.querySelector('[data-panel="appointments"]').classList.contains('visible');
  var cells=document.querySelectorAll('#apptGrid .cal-cell:not(.off)');
  cells[0].click();
  o.dayViewShown=!document.getElementById('apptDayView').hidden;
  o.dayTitle=document.getElementById('apptDayTitle').textContent;
  o.dayRows=document.querySelectorAll('#apptDayRows .row').length;
  document.getElementById('apptBack').click();
  o.backToMonth=!document.getElementById('apptMonthView').hidden;
  o.navLink0=document.querySelector('.nav-links a').textContent;
  o.footer=document.querySelector('.footer p').textContent;
  return o;
})()
'@
  } else {
    # poll for the probe node — window 'load' can lag on slow font fetches
    $await = $true
    $expr = @'
(async function(){
  for (var i = 0; i < 100; i++) {
    var el = document.getElementById('AUDIT');
    if (el) return JSON.parse(el.textContent.replace(/^__A__/,'').replace(/__Z__$/,''));
    await new Promise(function(r){setTimeout(r,100)});
  }
  return {error:'AUDIT node never appeared'};
})()
'@
  }

  $payload = @{ id = 2; method = 'Runtime.evaluate'; params = @{ expression = $expr; returnByValue = $true; awaitPromise = $await } } |
    ConvertTo-Json -Depth 6 -Compress
  $resp = Send-Recv 2 $payload
  Write-Host "=== RENDER AUDIT ($Size theme=$Theme lang=$Lang interact=$([bool]$Interact)) ==="
  if ($null -ne $resp.result.result -and $resp.result.result.PSObject.Properties['value']) {
    $resp.result.result.value | ConvertTo-Json -Depth 6 -Compress
  } else {
    Write-Host 'EVAL FAILED — raw response:'
    $resp | ConvertTo-Json -Depth 8 -Compress
    if ($resp.result.exceptionDetails) { Write-Host "exception: $($resp.result.exceptionDetails.text) $($resp.result.exceptionDetails.exception.description)" }
  }
  & $shutdown
  Start-Sleep -Milliseconds 400
  $ws.Dispose()
}
finally {
  # tree-kill fallback in case Browser.close never landed
  if ($proc -and -not $proc.HasExited) {
    taskkill /PID $proc.Id /T /F 2>$null | Out-Null
  }
}
