<#
.SYNOPSIS
  Put Mage Arena on the Fire TV: build the WebView shell, install it, point it at this PC, launch it.

.DESCRIPTION
  The game and its camp server keep running on this machine (`npm run camp`, port 5173). The TV runs
  a small WebView shell (tv/app, about 670 KB with its QR library) that opens http://127.0.0.1:5173/
  and reaches this PC through `adb reverse` over the adb connection, so no firewall port has to open
  and the dev server can stay bound to 127.0.0.1. Stages, in the order they should fail:
    build   - assemble the debug APK (Gradle 8.14 / AGP 8.7.3 / Android Studio JBR, as firetv-deathride)
    connect - adb connect to the Stick and report model / Fire OS
    deploy  - refuse if another workstream's app is in front, adb reverse the game port, install,
              wake the TV, launch through the leanback intent, wait for the page to load
    shot    - save a TV screenshot to tv/artifacts/
    logs    - print the shell's log (URL, page console, load errors)
    pair    - print the phone controller's URL and PIN (deploy prints them too)

  Phone controller: the shell listens on the TV's LAN address (port in tv/controller/tuning.json, 8780) and shows a QR
  and PIN. The phone talks to the TV directly; nothing on this PC is opened to the LAN.

  Device: -Device <ip[:port]>, else $env:TV_DEVICE, else the single Fire TV adb already has attached.
  The Stick's address is DHCP-assigned and moves (10.0.0.142 in older notes, 10.0.0.139 on 2026-10-15).

.EXAMPLE
  ./tv/tv.ps1                         # build, connect, deploy
  ./tv/tv.ps1 -Stage deploy           # reinstall and relaunch only
  ./tv/tv.ps1 -Stage shot             # screenshot what the TV shows
  ./tv/tv.ps1 -Stage pair             # controller URL and PIN of the running shell
  ./tv/tv.ps1 -Device 10.0.0.139 -Force
#>
param(
  [ValidateSet('all', 'build', 'connect', 'deploy', 'shot', 'logs', 'pair')]
  [string]$Stage = 'all',
  [string]$Device = $env:TV_DEVICE,
  # The game port on this PC: 5173 for `npm run camp`, 4173 for a production `vite preview`.
  [int]$Port = 5173,
  # Take the screen even when another workstream's app (Death Ride, telestrator) is in front.
  [switch]$Force,
  # How the phone's state reaches the page: 'pull' (the page reads it each frame, the default in tuning.json) or 'push'.
  [ValidateSet('', 'pull', 'push')]
  [string]$Feed = ''
)

$ErrorActionPreference = 'Stop'
$tv = $PSScriptRoot
$sdk = 'C:\Users\kazda\scoop\apps\android-clt\current'
$adb = "$sdk\platform-tools\adb.exe"
$pkg = 'dev.magearena.tv'
$apk = "$tv\app\build\outputs\apk\debug\app-debug.apk"
$run = { param($name) $Stage -eq 'all' -or $Stage -eq $name }

# adb narrates progress on stderr even when it succeeds; under Stop that is a terminating error in
# PowerShell 5.1. Run it under Continue and judge it by the exit code (firetv-deathride dev.ps1).
function Adb {
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $out = & $adb @script:deviceArgs @args 2>&1
    return [pscustomobject]@{ Output = ($out | Out-String).Trim(); Code = $LASTEXITCODE }
  } finally { $ErrorActionPreference = $prev }
}
function Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
# The shell logs "controller http://<tv-ip>:<port>/?pin=NNNN" when its LAN listener starts.
function Pairing {
  $line = ((Adb logcat -d -v brief -s MageArena:I).Output -split "`n" | Select-String 'controller http' | Select-Object -Last 1) -as [string]
  if ($line -match '(http://\S+)') { return $Matches[1] }
  return $null
}

# Which device: explicit, env, or the one Fire TV (model AFT*) adb already knows.
$script:deviceArgs = @()
if ($Device) {
  $serial = if ($Device.Contains(':')) { $Device } else { "${Device}:5555" }
} else {
  $listed = (& $adb devices -l 2>$null | Select-String 'model:AFT' | ForEach-Object { ($_ -split '\s+')[0] })
  $serial = @($listed)[0]
  if (@($listed).Count -gt 1) { throw "several Fire TVs attached ($($listed -join ', ')); pass -Device" }
}
if ($serial) { $script:deviceArgs = @('-s', $serial) }

if (& $run 'build') {
  Step 'assemble debug APK'
  if (-not (Test-Path "$tv\local.properties")) {
    Set-Content -Path "$tv\local.properties" -Value "sdk.dir=$($sdk -replace '\\','/' -replace ':','\:')" -Encoding ascii
  }
  Push-Location $tv
  try { & .\gradlew.bat :app:assembleDebug --console=plain -q } finally { Pop-Location }
  if ($LASTEXITCODE) { throw 'build failed' }
  Write-Host "apk: $apk ($((Get-Item $apk).Length) bytes)"
}

if (& $run 'connect') {
  if (-not $serial) { throw 'no Fire TV attached; pass -Device <ip> (Settings > My Fire TV > About > Network shows it)' }
  Step "connect to $serial"
  $c = (& $adb connect $serial 2>&1 | Out-String).Trim()
  Write-Host $c
  if ($c -match 'unable to connect|failed|refused') {
    throw "cannot reach $serial - is the Stick awake, on this network, with Settings > My Fire TV > " +
          "Developer options > ADB debugging on? Accept the 'Allow USB debugging' prompt on the TV the first time."
  }
  (Adb wait-for-device) | Out-Null
  Write-Host "device: $((Adb shell getprop ro.product.model).Output), Fire OS $((Adb shell getprop ro.build.version.fireos).Output)"
}

if (& $run 'deploy') {
  if (-not $serial) { throw 'no Fire TV attached; run -Stage connect -Device <ip> first' }
  Step 'deploy'
  # Other sessions (Death Ride, telestrator) test on the same Stick. Do not take the screen from them.
  $focus = ((Adb shell dumpsys window).Output -split "`n" | Select-String 'mFocusedApp' | Select-Object -First 1) -as [string]
  if (-not $Force -and $focus -match 'dev\.deathride\.|dev\.telestrator\.') {
    throw "another workstream is on screen: $($focus.Trim()). Re-run with -Force to take it."
  }
  try { Invoke-WebRequest "http://127.0.0.1:$Port/" -UseBasicParsing -TimeoutSec 5 | Out-Null }
  catch { Write-Warning "nothing answers on 127.0.0.1:$Port - start the game first: npm run camp" }

  # The TV's 127.0.0.1:$Port becomes this PC's, tunnelled over adb. Lasts until adb restarts.
  $r = Adb reverse "tcp:$Port" "tcp:$Port"
  if ($r.Code) { throw "adb reverse failed: $($r.Output)" }
  $i = Adb install -r -t $apk
  if ($i.Code) { throw "install failed: $($i.Output)" }
  (Adb shell input keyevent KEYCODE_WAKEUP) | Out-Null
  (Adb shell am force-stop $pkg) | Out-Null
  (Adb logcat -c) | Out-Null
  $url = "http://127.0.0.1:$Port/"
  $extra = if ($Feed) { " --es feed $Feed" } else { '' }
  $l = Adb shell "am start -n $pkg/.MainActivity --es url $url$extra >/dev/null 2>&1"
  if ($l.Code) { throw "launch failed: $($l.Output)" }

  # Dev mode streams every module and atlas through the tunnel; the first load takes ~30 s.
  $loaded = $false
  foreach ($n in 1..45) {
    $log = (Adb logcat -d -v brief -s MageArena:I).Output
    if ($log -match 'load failed') { throw "the TV could not load ${url}:`n$log" }
    if ($log -match 'probe ') { $loaded = $true; break }
    Start-Sleep -Seconds 2
  }
  if ($loaded) { Write-Host "page loaded on the TV; art and audio may still be streaming in" -ForegroundColor Green }
  else { Write-Warning "no load confirmation yet; see: ./tv/tv.ps1 -Stage logs" }
  $pair = Pairing
  if ($pair) { Write-Host "phone controller: $pair   (PIN $($pair -replace '.*pin=',''))" -ForegroundColor Green }
  else { Write-Warning "the controller listener did not report; see: ./tv/tv.ps1 -Stage logs" }
}

if ($Stage -eq 'pair') {
  $pair = Pairing
  if (-not $pair) { throw 'no controller line in the log; is the shell running? (./tv/tv.ps1 -Stage deploy)' }
  Write-Host "phone controller: $pair   (PIN $($pair -replace '.*pin=',''))"
}

if (& $run 'shot') {
  if (-not $serial) { throw 'no Fire TV attached' }
  $dir = "$tv\artifacts"; New-Item -ItemType Directory -Force $dir | Out-Null
  $file = "$dir\tv-$(Get-Date -Format yyyyMMdd-HHmmss).png"
  # cmd keeps the PNG bytes intact; PowerShell 5.1 redirection would re-encode them as text.
  cmd /c "`"$adb`" $($script:deviceArgs -join ' ') exec-out screencap -p > `"$file`""
  Write-Host "screenshot: $file"
}

if ($Stage -eq 'logs') {
  Write-Host (Adb logcat -d -v brief -s MageArena:I).Output
}

if ($Stage -eq 'all') {
  Write-Host "`nOn the TV: remote D-pad moves focus, OK chooses, Back / Play-Pause open the pause menu." -ForegroundColor Green
  Write-Host "The arena needs a gamepad: scan the TV's QR with a phone on the same Wi-Fi, or pair a Bluetooth pad." -ForegroundColor Green
}
