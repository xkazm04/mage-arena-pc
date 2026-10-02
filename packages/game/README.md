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

U1 presents the entire game in one fullscreen canvas, with no document panels,
select dropdowns or default form controls. Choose Fullscreen from the main menu
or settings; Escape still follows browser fullscreen behavior before returning
control to the game. The app always fills the viewport, even without fullscreen.

The camera uses the art v2 nominal scale: 55 degrees, 3.75% body height (40.5px
at 1080p and 54px at 1440p). It stays fixed inside a wide dead zone and softly
follows at the edges. The 192x144 m oval and combat geometry are unchanged.
Runtime numbers live in `data/camera.json`, cross-referencing the art contract.
D18 supersedes A4/A5: the current camp and UI have original procedural Covenant
fallbacks. No discarded portraits or figures are loaded.

Keyboard menus: arrows or Tab/Shift+Tab move visible focus; Enter chooses;
Escape backs out or pauses. Mouse targets use the same actions. Standard gamepad:
D-pad/left stick navigates, A chooses/holds, B goes back, Start pauses/resumes.
In combat, left stick moves, right stick aims, RT casts, LT absorbs, A rolls,
left-stick press sprints, and LB/RB change slots. The Parley letter board supports
controller-only writing. Pause settings include sound and reduced UI motion.

UI art integration: place the art stream's unchanged `art/ui/` delivery in this
worktree. The dev server serves it and the production build copies it automatically.
The entry point is `/art/ui/kit.json`. The loader checks the published schema,
required region IDs, SHA-256 page hashes, atlas bounds, anchors and nine-slice
borders. Invalid/missing kits retain procedural components and report diagnostics.
No code edits are needed for a contract-conforming atlas. Typography is bundled
Cinzel and Alegreya Sans, drawn as bitmap atlases; full OFL licences ship in
`public/fonts/`. See `docs/waves/U1-evidence/art-ui-contract.md` for the contract
snapshot, and the live art stream's README for subsequent delivery changes.

Current checks, from the root (run browser checks sequentially):

```powershell
npm run gate
npm run smoke:u1
npx tsx packages/tools/src/u1-kit-browser.ts
npx tsx packages/tools/src/u1-replay.ts
npm --prefix packages/core run report:w4 -- --evidence U1-evidence --tag census
```

`smoke:u1` builds and boots its own production preview, walks every screen at
1080p and 1440p, drives mouse/keyboard plus an emulated standard Gamepad API,
plays both weeks and tests camp/combat save-load. It uses a temporary save
folder (`MAGE_SAVE_DIRECTORY`), preserving the owner's local slot. It never
makes provider calls. Screenshots and machine-readable evidence are in
`docs/waves/U1-evidence`; the gallery is `index.html`. Harness mutations only
exist with `?harness=1`; ordinary play exposes read-only diagnostics.

The old W2-W7 DOM-selector smoke scripts and reports are historical. U1's browser
route supersedes their page navigation; pure core, save, injection and census
gates remain active. Automated controller emulation is not physical controller
latency, and screenshots do not certify sofa readability or desire to continue.
[Owner checks](../../docs/OWNER-CHECKS.md) keep G1 open for the owner.
