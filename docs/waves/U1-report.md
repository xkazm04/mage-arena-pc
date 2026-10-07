# U1 execution / GAME / 2026-10-02

U1 replaces the browser-page presentation with one viewport-filling Pixi canvas.
Every production screen uses the same original procedural Covenant kit, bitmap
type, focus, pointer and navigation framework. The camera now stays fixed through
ordinary movement and follows softly only at the view edges. D17-D19 supersede
the historical W7 near camera and A4/A5 presentation. Owner acceptance remains
open; automated results cannot establish the requested desire to play.

## Four sub-waves

| Sub-wave | Commit | Design before implementation |
|---|---|---|
| Camera | `f62dd89` | [U1-camera.md](U1-camera.md) |
| Framework | `ac95883` | [U1-framework.md](U1-framework.md) |
| Screens | `f99c302` | [U1-screens.md](U1-screens.md) |
| TV navigation and evidence | Commit containing this report | [U1-tv.md](U1-tv.md) |

Each has its own plan status row, session log, owner-check entry and green gate.
No push, art-worktree edit, image-provider request or Director model call was made.

## Delivered

- Data-owned 55-degree camera, nominal 3.75% figure height: 40.5px at 1080p,
  54px at 1440p. Wide asymmetric dead zone and a .35-second follow constant
  match the read-only art scale contract v2. Pointer and stick aiming invert
  the current ground projection. Camera state stays outside saves and simulation.
- Fullscreen API plus a viewport canvas with no page scrolling, HTML panels,
  select dropdowns or default controls/fonts. Bitmap Cinzel and Alegreya Sans
  ship with their OFL licences and source records.
- Nine-slice panels, buttons, tabs, spell slots, resource bars, tooltips,
  selected/disabled/focus states, custom cursor, animated feedback and reduced
  motion. Atlas validation includes schema, required IDs, hashes, geometry,
  anchors, minimum sizes and content insets; a failed load retains the kit.
- Main menu, character pick, camp map/eight places/time slots, season calendar,
  Hollow Board, journal, listening, typed/card Parley and controller letter board,
  Tent Trial, spell composition, training, arena HUD/collar/absorb feedback,
  pause/settings, bout/chapter results and save/load are all canvas screens.
- Five-percent safe area, 64-unit-or-larger navigation targets, large bitmap text,
  directional and Tab focus, mouse navigation, and standard gamepad controls.
  Gamepad disconnect pauses combat. Held confirmation cannot select a second
  screen. Inputs release on blur, pause and scene disposal.

## Measured checks

| Command / evidence | Result |
|---|---|
| `npm run gate` | PASS: strict builds, lint, 153 TypeScript tests, 10 reference tests, zero design contradictions; three golden nights / 216 deltas |
| `npm run build:game` | PASS: production bundle and bundled fonts |
| `npm run smoke:u1` | PASS: both resolution routes, 64 capture events / 60 distinct PNGs, zero page errors |
| `npx tsx packages/tools/src/u1-kit-browser.ts` | PASS: valid synthetic atlas plus five corruption/missing-file cases, all playable; native-click fullscreen entry/exit |
| `npx tsx packages/tools/src/u1-replay.ts` | PASS: two runs and load produce identical 1,296,151-byte envelopes |
| `npm --prefix packages/core run report:w4 -- --evidence U1-evidence --tag census` | PASS: 2,000 fights per wave, 8,000 total; all four original median bands |

The final browser route visits every screen, checks target size/safe bounds,
button text overflow and directional focus reachability, and asserts one canvas,
no HTML controls and no page scroll. It exercises native keyboard/mouse movement,
casting and ward, eight native pointer hits in different directions at each
resolution, central camera immobility, edge following, and the 3.75% figure scale.
The browser Gamepad API is emulated for menu edges, movement, oblique diagonal
aim, cast, absorb, slot selection, pause/resume and disconnect handling. This is
not a physical-controller measurement.

Both routes earn the bread Knowing through the real-time listening controls,
perform typed offline Parley, and complete days 1-14 with four checked receipts,
a first-Games victory and second-Games missio. Season bouts use the ordinary
deterministic input policy; no outcomes or resource values are forced. Camp and
combat save/load round trips compare exact views/checkpoints. Test servers force
the offline Director and isolated temporary save directories; owner saves remain
untouched. Replay SHA-256 is
`a344b92d448a932148f292ac69a8c5e47e9c479214336ca0544c67bbadcdfacd`.

| Resolution | Live visible projectiles | Samples | Frame rate | Render CPU p95 |
|---|---:|---:|---:|---:|
| 1920x1080 | 100 in every count sample | 360 frames | 60.00 fps | 1.70 ms |
| 2560x1440 | 100 in every count sample | 360 frames | 60.00 fps | 1.90 ms |

These are measured headless Chromium/D3D11 results on this Windows host, using
actual frame intervals, with the game render loop and moving projectiles. They
do not measure television latency or guarantee a different machine's frame rate.
Camera/aim/stress fixtures are labelled in the gallery. Trial shots are taken in
both weeks and reuse filenames, explaining 64 captures but 60 distinct files.

| Census wave | Median seconds | Original band | Compared with W7 |
|---|---:|---:|---|
| Soldiers | 38.233333 | 25-40 | Identical digest |
| Creatures | 44.633333 | 30-45 | Identical digest |
| Semifinal | 45.483333 | 45-70 | Identical digest |
| Final | 58.000000 | 45-80 | Identical digest |

No arena-size, spacing, opening, combat, AI or pacing changes were needed.
The kernel keeps the existing v1 arena-geometry authority; v2 is presentation.
No timeouts, invalid states, early Downs or sampled replay failures occurred.
The census ran in 97.54 seconds. Its per-seed files are retained.

## Art handoff and limits

The art worktree was read-only throughout. Its published UI contract v1 and
camera contract v2 are snapshotted in the evidence directory. `art/ui/kit.json`
was still absent at the final handoff check. The original procedural kit is the
requested interim delivery, not approval of final art. D18's superseded camp
textures and discarded figures/portraits are not loaded.

Copy a contract-conforming `art/ui/` delivery into this integration worktree;
the dev server serves it and the production build copies it automatically.
`/art/ui/kit.json` replaces the named regions without game-code changes. The
browser atlas test uses synthetic test-only pixels, never represented as art.
The real kit, replacement scenery and figures still need their own visual review.

Retained corrections: the first census invocation rejected the new output folder
before simulation; the allowlist was extended and the full census rerun. The
first gamepad harness bootstrap hit a transpiler `__name` issue; its JSON/PNG
are archived as `attempt-01-gamepad-bootstrap.*`, and the corrected native browser
bootstrap passed both routes. Inverse projection asserts use decimal tolerance
at 22.5px/m. No failed run is represented as successful evidence.

Final source review hardened atlas validation and preserved the Hollow Board's
warning texture when focus leaves a rumour card. The gate and both-resolution
production route were rerun on that final source. W7's 30-minute soak is
historical; a new 30-minute U1 soak was not run. Human camera comfort, sofa
readability, physical controller/latency and G1 desire to continue remain
unmeasured. See the current [owner route](../OWNER-CHECKS.md).

Open the [native-resolution gallery](U1-evidence/index.html) and
[evidence index](U1-evidence/README.md) for exact files and rerun commands.
