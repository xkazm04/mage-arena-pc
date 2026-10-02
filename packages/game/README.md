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

The camera stays at 55 degrees, near zoom 1.2 (range 0.8-1.2), on the accepted
192x144 m open oval, with upright figures, ground aiming and a 140-degree ward.
A4/A5 camp assets are accepted. A1b supplies the camera/ground reference, not a
clean extractable floor texture; the floor remains procedural. All figures use
the validated loader's procedural fallback. Discarded A2 portraits were removed
from the current tree; A3 is never a runtime dependency. No new figure art is approved.

W7 checks, from the root (browser scripts must run sequentially):

```powershell
npm run gate
npm run build:game
npm --prefix packages/core run report:w2 -- W7-evidence/controls
npm --prefix packages/core run report:w3 -- W7-evidence/water
npm --prefix packages/core run report:w4 -- --evidence W7-evidence --tag integrated-census
npm --prefix packages/core run report:w4:ladder -- W7-evidence
npm --prefix packages/game run smoke -- W7-evidence/controls
npm --prefix packages/game run smoke:w3 -- W7-evidence/water
npm --prefix packages/game run smoke:w4 -- W7-evidence/games
npm --prefix packages/game run smoke:w4b -- W7-evidence/camera
npx tsx packages/tools/src/w7-replay.ts
# Against the production preview above:
$env:CAMP_URL = 'http://127.0.0.1:4173'
npx tsx packages/tools/src/season-browser.ts
npx tsx packages/tools/src/w7-soak.ts 30
```

The soak writes its fixture seasons into the local save slot: preserve an owner's
save before running that test. Full gate details and measured limitations are in
[W7 execution](../../docs/waves/W7-execution.md). [Owner checks](../../docs/OWNER-CHECKS.md)
keep G1 open until the owner plays the first two weeks. Headless frame timing is
not physical input latency or a human assessment of camera, pacing or enjoyment.
