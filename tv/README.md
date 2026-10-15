# Mage Arena on the Fire TV

The game stays a browser game served from this PC; the TV runs a small WebView shell (`tv/app`,
package `dev.magearena.tv`, about 670 KB, most of it the ZXing QR library) that opens it full
screen. The camp server, saves and the Director all keep running here.

```powershell
npm run camp                    # the game on 127.0.0.1:5173 (leave it running)
npm run tv                      # build the shell, connect, install, launch  (= ./tv/tv.ps1)
./tv/tv.ps1 -Stage deploy       # reinstall + relaunch only
./tv/tv.ps1 -Stage shot         # TV screenshot -> tv/artifacts/
./tv/tv.ps1 -Stage logs         # shell log: URL, page console, load errors
./tv/tv.ps1 -Stage pair         # the phone controller's URL and PIN (deploy prints them too)
```

On the TV the remote's D-pad moves focus, OK chooses, Back and Play/Pause open the pause menu. The
remote cannot move and aim at once, so the arena is played from a **phone** (below) or a gamepad
paired to the Stick over Bluetooth. Both work at the same time.

## Phone controller

The shell turns any phone on the same Wi-Fi into the gamepad. The pattern, and most decisions, come
from `../firetv-deathride` (its `link/RaceServer.kt` and `controller/index.html`), which drives its
racer from phones on this same Stick.

**Pairing.** At launch the TV shows a card with a QR code, the address and a 4-digit PIN (made fresh
at each launch). Scan the QR: the PIN travels in its URL (`http://<TV IP>:8780/?pin=NNNN`). A phone
that cannot scan opens the address and types the PIN. The card shrinks to a corner dot once a phone
pairs, and comes back when it leaves. **Hold Menu** on the remote to show or hide the card; a short
Menu press is still Escape. The URL and PIN are also logged (`./tv/tv.ps1 -Stage pair` reads them):

```
I/MageArena: controller http://10.0.0.139:8780/?pin=9229
```

- **One seat.** A second phone is told "Another phone is already playing" and gets a Retry button.
  A wrong PIN shows the PIN form again. The phone that holds the seat keeps an opaque token, so after
  a Wi-Fi blip or a reload it gets its seat back, even before the TV has noticed the old socket died.
- **The PC stays closed.** The phone talks to the TV's own listener (`link.port` in
  `tv/controller/tuning.json`, 8780). Nothing on this PC is opened to the LAN; the game still reaches
  the TV only through `adb reverse`.
- **Leaving releases everything.** When the phone closes, locks or loses Wi-Fi, the seat empties
  (the socket times out after 3 s of silence), the virtual gamepad disconnects, and the game pauses as
  it does for any lost gamepad. A phone that stays connected but stops sending has its inputs zeroed
  after 750 ms. No stick or button can stay held.

**The phone page** (`tv/controller/index.html`, one file, served from the APK; turn the phone
sideways):

| Layout | Left thumb | Right thumb | Top row |
|---|---|---|---|
| Arena | Floating MOVE stick anywhere in the left zone; push past the dashed ring to SPRINT | Floating AIM stick; push to the blue ring to CAST (held = repeated casts); WARD (hold) and ROLL on the right edge | PAUSE, layout toggle, spell slots 1-4 |
| Menu | D-pad | A (OK), B (Back) | PAUSE, layout toggle |

- **The layout follows the TV.** The shell reports the game's screen to the phone
  (`canvas[data-screen]`, 4 times a second), so the phone shows sticks in the arena and the D-pad
  everywhere else (camp, pause, results). The toggle overrides it until the screen changes. Automatic,
  because the game changes screens by itself (pause, results) and a player mid-fight should not have to
  find a toggle.
- **Cast on the aim stick** rather than a separate CAST button: both thumbs are busy, and the game
  already repeats a held cast, so twin-stick "aim to the rim to fire" keeps the right thumb on the
  stick. Inside the blue ring you can turn without casting. Ward faces the last aim direction (the game
  keeps it when the stick is released), so the right thumb can leave the stick to ward.
- **Sprint ring on the move stick** (L3), since the left thumb is otherwise idle.
- **Slots 1-4** are direct keys (sent as `Digit1`-`Digit4` keyboard events through the shell, as it
  already does for remote keys) rather than LB/RB stepping: one tap, no counting.
- Buttons are at least 72 px; a quick tap is held for at least 70 ms so it always spans a game frame;
  the game's own stick dead zone (0.24, `packages/game/data/ui.json`) is the dead zone.
- The page vibrates on presses, on cast, on pairing and on losing the link, where the phone supports
  it. Fullscreen and the landscape lock are requested on the first touch release, if available.
  **Screen wake lock is not available on a plain LAN HTTP page** (it needs a secure origin), so keep
  the phone awake through its display setting.
- Every number (port, rates, radii, thresholds, overlay sizes) is in `tv/controller/tuning.json`; the
  shell reads it and injects its `phone` block into the page it serves.

**How the phone reaches the game.** The game is unchanged: it reads the standard Gamepad API
(`navigator.getGamepads()`, `mapping: "standard"`). The shell injects `app/src/main/assets/pad-shim.js`
as the first element of the game's `<head>`: it fetches the main document itself in
`shouldInterceptRequest` and inserts the script, so the shim runs before any game script and the
game's first `getGamepads()` call already sees the phone. `WebViewCompat.addDocumentStartJavaScript`
would be the tidier hook, but androidx.webkit is not in this machine's offline Gradle cache. While a
phone is seated, the shim adds a synthetic standard gamepad and fires `gamepadconnected` /
`gamepaddisconnected`. The phone sends absolute state about 60 times a second while a thumb is down
and 4 times a second otherwise (`{"t":"i","q":..,"b":<button bits>,"x":[lx,ly,rx,ry]}`), so a late
frame is simply replaced by the next. Mapping: axes 0-1 move, 2-3 aim; buttons 7 cast, 6 ward,
0 roll / A, 1 B, 10 sprint, 9 pause, 12-15 D-pad.

- **A Bluetooth gamepad keeps working.** With both connected, the shim merges the phone into the
  real pad's slot (each stick from whichever is deflected further, buttons OR'ed), because the game
  reads only the first standard pad. With no phone the real pad is returned untouched.
- **Pull, not push.** The shim reads the newest state through a `@JavascriptInterface` on each
  `getGamepads()` call (`feed: "pull"`). The alternative, the shell calling `evaluateJavascript` on
  every phone frame (`./tv/tv.ps1 -Stage deploy -Feed push`), was measured and is worse (below). A
  bridge call costs about 0.5 ms on the Stick, so the shim makes none while no phone is seated
  (`getGamepads()` then costs 0.014 ms).

**Measured on the Stick, 2026-10-15.** The phone page was driven by Playwright on this PC as a
896x414 touch phone over the house Wi-Fi, in the arena's first training lesson, which the game renders
at 30 fps on the Stick. "Round trip" is phone send -> TV -> the game's own `getGamepads()` read of
that frame -> ack -> phone. "TV age" is the part inside the TV, from the socket read to the game's
read.

| Feed | Round trip p50 / p95 | TV age p50 / p95 | Samples |
|---|---|---|---|
| pull (default) | 14-19 ms / 29-84 ms | 6.6-8.6 ms / 19-45 ms | 4 runs of 15 s, 250-377 each |
| push | 51-60 ms / 161-249 ms | 37-44 ms / 133-145 ms | 2 runs of 15 s, 204-306 each |

The p95 tail follows the game's own arena frame time on the Stick (p50 33 ms, p95 100 ms) and the
Wi-Fi (ping p95 21-75 ms between runs). On a 60 fps menu screen pull measured 12.6 / 22.2 ms. What the
eye sees adds the game's frame and the TV's display latency, which this does not measure.

**Tools.** Debug builds answer `GET http://<TV IP>:8780/debug/state?pin=NNNN` with the game's
screen, focused button, the training player's position, ward, roll and cast counters, the gamepads
the page sees, and the link's timing (`&reset=1` clears the timing). The phone page exposes
`window.__ctrl.stats()` (round-trip and ping percentiles) and `__ctrl.state()`.

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
| Phone page does not open | Phone and TV must be on the same Wi-Fi (guest networks often isolate clients). `./tv/tv.ps1 -Stage pair` prints the address the TV offers; the card says "No Wi-Fi on the TV" when it has none |
| Phone says "Wrong TV code" | The shell was relaunched and made a new PIN. Rescan the QR or type the new PIN |
| Phone says "Another phone is already playing" | One seat. Close the controller on the other phone (the seat frees within 3 s), then Retry |
| The game paused by itself | The phone left (locked, closed or out of Wi-Fi); the game pauses as for any lost gamepad. Reopen the page; the seat comes back |
