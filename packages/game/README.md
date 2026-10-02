# Mage Arena integrated browser build

Run from the repository root in Windows PowerShell, with Node 24 or newer:

```powershell
npm ci
npm run gate
npm run build:game
node --import tsx node_modules/vite/bin/vite.js preview --config packages/game/vite.config.ts --host 127.0.0.1 --port 4173 --strictPort
```

Open http://127.0.0.1:4173. Choose Water / Cassia. Fire, Earth and Air appear as
camp allies. This chapter ends on the morning after the second Games: days 1-14
are playable; both Games use Tiro. `npm run camp` starts development on port 5173.
There is one root workspace and lockfile; do not install nested packages separately.

Camp uses clickable places, paid travel and one activity per time slot. Listen at
the tent flap at night: A/D or 1-3 move cover, hold Space to listen, release to hide.
A held Knowing opens Parley with the relevant person. Offline typing uses the
explicitly selected authored approach; its words are not interpreted by a model.
Read the Hollow Board at dawn and the private journal for learned facts.

The Tent Trials are at the Pit on days 6 and 13, at dusk. Read the rival's stance
and choose press, brace or feint. The elder weighs the bout, favour and renown.
The summons can escort you if travel is exhausted. Losing the entrant selection
means watching your Water rival on Games day, with no player payout.

On days 7 and 14 prepare a three-line Water composition and enter the four Tiro
bouts. WASD moves; mouse aims at the ground/foot ring; left button casts; right
button holds directional absorb; Space rolls; Shift sprints; 1-4/wheel chooses a
slot. The collar unlocks tiers during each bout. Enter the next bout explicitly
at intermission. A loss grants missio; Return to camp writes one checked reward
receipt and social consequences. Training from the menu never grants season rewards.

Escape opens pause/settings and the complete controls. Sound can be toggled.
Save/load is explicit; the local slot is `.director-runtime/saves/season.json`
with `.previous` recovery. Loading opens paused. Saves require the same source
fingerprint; a changed build gives a recoverable incompatibility error. Restarting
the server creates a new in-memory camp; use Load saved season to restore it.
Do not delete the cost ledger to reset a subscription cap.

The default Director is offline and makes zero model calls. Optional `CAMP_DIRECTOR`
values are `local` for the existing local provider and `claude` for the existing
Sonnet 5.5 medium CLI provider. The latter shares W7's durable run identity and
**twenty-call cap**, including the seven calls already recorded in this integration
session. CLI absence, slow replies or an exhausted cap fall back to the planner;
typed Parley has authored fallback. Provider details stay outside game assets/UI.

U2 presents the entire game in one fullscreen canvas, with no document panels,
select dropdowns or default form controls. Choose Fullscreen from the main menu
or settings; Escape still follows browser fullscreen behavior before returning
control to the game. The app always fills the viewport, even without fullscreen.

The camera uses the art v2 nominal scale: 55 degrees, 3.75% body height (40.5px
at 1080p and 54px at 1440p). It stays fixed inside a wide dead zone and softly
follows at the edges. The 192x144 m oval and combat geometry are unchanged.
Runtime numbers live in `data/camera.json`, cross-referencing the art contract.
D18 supersedes A4/A5: Covenant A4c maps/backdrops, A2c portraits and the A5b
90-region atlas now supply the presentation. Missing or corrupt files fall back
independently. Discarded A2/A3 images never enter the runtime loader. A3c figures
remain procedural until their pose, facing and animation gates pass; per-identity
reasons and the three Games palette assignments live in `data/covenant.json`.

Keyboard menus: arrows or Tab/Shift+Tab move visible focus; Enter chooses;
Escape backs out or pauses. Mouse targets use the same actions. Standard gamepad:
D-pad/left stick navigates, A chooses/holds, B goes back, Start pauses/resumes.
In combat, left stick moves, right stick aims, RT casts, LT absorbs, A rolls,
left-stick press sprints, and LB/RB change slots. The Parley letter board supports
controller-only writing. Pause settings include sound and reduced UI motion.

Art integration: `npx tsx packages/tools/src/u2-assets.ts` verifies the explicit
delivery allowlist and copies 246 files, hashes and sidecars into
`assets/accepted/covenant`. The production build copies only that accepted tree.
The UI entry point is `/assets/accepted/covenant/ui/kit.json`; runtime images and
fonts use its neighbouring `manifest.json`. SHA-256, dimensions, region bounds,
anchors and slice insets are checked before use. No runtime reads `art/raw`.
Cinzel headings and Source Sans 3 body text render through bitmap atlases;
accepted font licences ship with the assets. The procedural kit is created only
if the delivered kit fails. Loader diagnostics are available in the harness.

Current checks, from the root (run browser checks sequentially):

```powershell
npm run gate
npm run smoke:u2
npm run smoke:u2:art
npx tsx packages/tools/src/u2-replay.ts
npm --prefix packages/core run report:w4 -- --evidence U2-evidence --tag census
```

`smoke:u2` builds and boots its own production preview, walks every screen at
1080p and 1440p, drives mouse/keyboard plus an emulated standard Gamepad API,
plays both weeks and tests camp/combat save-load. It measures a 100-projectile
arena fixture and captures all three palettes and front/behind prop sorting.
`smoke:u2:art` captures all cast expressions, places, time variants and stories,
then injects six missing/corrupt asset cases through camp and combat. The tests
use temporary save folders (`MAGE_SAVE_DIRECTORY`) and make no provider calls.
Screenshots and measured reports are in `docs/waves/U2-evidence/index.html`.
Harness mutations only exist with `?harness=1`; ordinary play exposes read-only
diagnostics. Read `docs/waves/U2-report.md` for remaining art limitations.

The old W2-W7 DOM-selector smoke scripts and reports are historical. U2's browser
route supersedes their page navigation; pure core, save, injection and census
gates remain active. Automated controller emulation is not physical controller
latency, and screenshots do not certify sofa readability or desire to continue.
[Owner checks](../../docs/OWNER-CHECKS.md) keep G1 open for the owner.
