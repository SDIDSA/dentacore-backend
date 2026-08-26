param(
  [int]$Port = 9350,
  [string]$Url = 'http://localhost:4100/book.html?clinic=clinic-demo&theme=dark',
  [string]$OutPng = ''
)
$ErrorActionPreference = 'Stop'
$profileDir = Join-Path $env:TEMP "edge-slotchk-$Port"
$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
$proc = Start-Process -FilePath $edge -ArgumentList @(
  '--headless=new','--disable-gpu','--hide-scrollbars',
  "--remote-debugging-port=$Port","--user-data-dir=$profileDir",
  '--window-size=1440,1600', "`"$Url`""
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
    $ws.SendAsync([ArraySegment[byte]]::new($bytes), 'Text', $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
    while ($true) {
      $buf = New-Object byte[] (16MB); $sb = [Text.StringBuilder]::new()
      do {
        $seg = [ArraySegment[byte]]::new($buf)
        $r = $ws.ReceiveAsync($seg, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
        [void]$sb.Append([Text.Encoding]::UTF8.GetString($buf, 0, $r.Count))
      } while (-not $r.EndOfMessage)
      $m = $sb.ToString() | ConvertFrom-Json
      if ($m.id -eq $id) { return $m }
    }
  }
  function Eval([int]$id, [string]$expr) {
    $p = @{ id = $id; method = 'Runtime.evaluate'; params = @{ expression = $expr; returnByValue = $true } } |
      ConvertTo-Json -Depth 5 -Compress
    (Send-Recv $id $p).result.result.value
  }

  Start-Sleep -Seconds 4   # dentists/services fetch + render

  # click the first day chip -> slots load
  $r1 = Eval 2 "(function(){var c=document.querySelectorAll('#dates .chip');if(!c.length)return{err:'no date chips'};c[0].click();return{clicked:c[0].textContent}})()"
  Start-Sleep -Seconds 3
  $r2 = Eval 3 @"
(function(){
  var s = document.querySelector('.slot');
  if (!s) return { err: 'no slots rendered' };
  var cs = getComputedStyle(s);
  return { slotCount: document.querySelectorAll('.slot').length,
           color: cs.color, bg: cs.backgroundColor };
})()
"@
  Write-Host "click => $($r1 | ConvertTo-Json -Compress)"
  Write-Host "slots => $($r2 | ConvertTo-Json -Compress)"

  if ($OutPng -and $r2 -and -not $r2.err) {
    $shot = Send-Recv 4 '{"method":"Page.captureScreenshot","params":{"format":"png","captureBeyondViewport":true}}'
    [IO.File]::WriteAllBytes($OutPng, [Convert]::FromBase64String($shot.result.result.data))
    Write-Host "screenshot: $OutPng ($([math]::Round((Get-Item $OutPng).Length/1kb)) KB)"
  }

  $b = [Text.Encoding]::UTF8.GetBytes('{"id":90,"method":"Browser.close"}')
  try {
    $ws.SendAsync([ArraySegment[byte]]::new($b), 'Text', $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
  } catch {}
  Start-Sleep -Milliseconds 400
  $ws.Dispose()
}
finally {
  if ($proc -and -not $proc.HasExited) { taskkill /PID $proc.Id /T /F 2>$null | Out-Null }
}
