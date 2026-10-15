# Mage Arena on the Fire TV

The game stays a browser game served from this PC; the TV runs a small WebView shell (`tv/app`,
package `dev.magearena.tv`, about 17 KB) that opens it full screen. The camp server, saves and the
Director all keep running here.

```powershell
npm run camp                    # the game on 127.0.0.1:5173 (leave it running)
npm run tv                      # build the shell, connect, install, launch  (= ./tv/tv.ps1)
./tv/tv.ps1 -Stage deploy       # reinstall + relaunch only
./tv/tv.ps1 -Stage shot         # TV screenshot -> tv/artifacts/
./tv/tv.ps1 -Stage logs         # shell log: URL, page console, load errors
```

On the TV the remote's D-pad moves focus, OK chooses, Back and Play/Pause open the pause menu. The
arena itself needs a gamepad paired to the Stick over Bluetooth (the remote cannot move and aim).

## How it works, and where it came from

The adb side is the same as in `../firetv-deathride` (`scripts/dev.ps1`, `tools/device.mjs`,
`deathride/tools/ai-device-install.py`), which builds and drives native APKs on the same Stick:

| Need | How (both repos) |
|---|---|
| adb | `C:\Users\kazda\scoop\apps\android-clt\current\platform-tools\adb.exe` (SDK root is the same folder: build-tools 35, platforms 34/36) |
| Reach the Stick | `adb connect <ip>:5555` over Wi-Fi. Requires Settings > My Fire TV > Developer options > ADB debugging, and accepting the prompt on the TV once. |
| Build | Gradle 8.14 wrapper, AGP 8.7.3, `org.gradle.java.home=C:/Program Files/Android/Android Studio/jbr`, minSdk 28 (Fire OS 7 = Android 9, Fire OS 8 = Android 11) |
| Install / launch | `adb install -r -t <apk>`; wake with `input keyevent KEYCODE_WAKEUP`; launch with `am start -n <pkg>/.MainActivity` or `monkey -p <pkg> -c android.intent.category.LEANBACK_LAUNCHER 1` |
| See the TV | `adb exec-out screencap -p > shot.png` (pipe bytes through cmd, not PowerShell 5.1 redirection) |
| Read the app | `adb logcat -d -v brief -s <Tag>:I` |
| Who is on screen | `adb shell dumpsys window` -> `mFocusedApp` |

What differs for a browser game:

- **No browser on the Stick.** Fire OS 8 on this AFTKM has no Silk; it has Amazon's Chromium
  WebView (v148). So the game ships as a WebView shell rather than a URL opened in a browser.
- **The TV cannot reach this PC's ports.** Windows Firewall drops inbound LAN traffic to 5173
  (`nc` from the Stick timed out). Instead of opening a firewall port, `tv.ps1` runs
  `adb reverse tcp:5173 tcp:5173`: the TV's `127.0.0.1:5173` is tunnelled to this PC over the adb
  connection the PC already holds. The dev server stays bound to 127.0.0.1, so nothing is exposed to
  the LAN. The tunnel lasts until adb restarts; `-Stage deploy` re-creates it. (Death Ride avoids
  tunnels on hardware on purpose, because it measures Wi-Fi latency between phone and TV; we only
  load the page through it, the game loop runs on the TV.)
- **Remote keys.** The game's menus read `KeyboardEvent.code` (ArrowUp, Enter, Escape). WebView
  gives D-pad presses an empty `code`, so `MainActivity` re-sends remote and keyboard keys to the page
  as synthetic events with the code set. Gamepad events are not touched: the WebView exposes the
  standard Gamepad API (`navigator.getGamepads` probed as present) and the game reads it directly.
- **Viewport.** The Stick renders 4K: the page sees 960x540 CSS pixels at devicePixelRatio 4.
- **First load.** Vite dev mode streams every module and atlas through the tunnel: about 30 s cold,
  about 12 s once the WebView cache is warm. A production build (`npm run build:game`, then
  `vite preview` on 4173 and `./tv/tv.ps1 -Port 4173`) loads faster.
- **Debugging.** The shell enables WebView debugging: open `chrome://inspect` on this PC while the
  Stick is attached to get DevTools for the TV page. The shell also logs page console lines to logcat.

## Sharing the Stick

The same Stick runs Death Ride and telestrator workstreams, often from other sessions. Follow their
etiquette:

- **Check before taking the screen.** `tv.ps1 -Stage deploy` refuses while a `dev.deathride.*` or
  `dev.telestrator.*` app is focused; `-Force` overrides it.
- **adb servers.** Some Death Ride tools run a separate adb server (`adb -P 5043`) so they do not
  disturb each other. `tv.ps1` uses the default server (5037).
- **The Stick's address moves.** It is DHCP-assigned: 10.0.0.142 in older notes, 10.0.0.139 on
  2026-10-15. Pass `-Device <ip>` or set `TV_DEVICE` when it changes. Without either, `tv.ps1` uses
  the single Fire TV adb already has attached.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "could not reach the game" page on the TV | `npm run camp` is not running, or the tunnel is gone: `./tv/tv.ps1 -Stage deploy`, then OK on the remote retries |
| Dev server crashes on start after a merge (`Cannot read properties of undefined` in arena data) | Rebuild the gitignored generated data: `npm --prefix packages/core run data` |
| `cannot reach <ip>:5555` | Stick asleep, wrong address, or ADB debugging off. Find the address under Settings > My Fire TV > About > Network |
| Remote does nothing | The shell must have focus. Relaunch with `-Stage deploy` |
