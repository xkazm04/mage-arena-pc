# U1 screens — design before implementation

Replace the document shell and every production screen with the shared canvas
framework. Main menu and character pick lead into the unchanged sidecar-owned
season; camp places/time slots, six-week calendar, board, journal, listening,
Parley, Trial and Games keep their command/revision contracts. Composition uses
large cycling controls and tier previews. Pause/settings and save/load share
the same canvas, with arena checkpoint flush before save or navigation.

Arena uses its existing deterministic kernel and sprite/projection renderer in
the shared app's world layer. HUD is a sparse bottom resource/slot arrangement,
collar runes at the top, transient absorb/crest feedback, then an in-canvas result
screen. Fullscreen is a player gesture; fill the browser viewport when unavailable.
D18 supersedes A4/A5: remove the old camp textures from runtime and render an
original procedural Covenant camp until the new delivery is available. Never
restore discarded portraits or figures.

All scene transitions own and dispose listeners/world children. Repeated scene
mounts, semantic focus snapshots, actual mouse input, pause/save/load and every
screen will be exercised in the final U1 Playwright route at both resolutions.
Existing core/server regression tests remain authoritative for deterministic
effects; old DOM-selector browser scripts are historical W7 evidence.

Measured first route: `npm run build:game` and
`npx tsx packages/tools/src/u1-browser.ts --quick` PASS. 29 1080p captures, all
screen types, no browser errors, no button text overflow, no HTML controls or
page scroll. Native movement/cast/ward, fixed central camera, earned Knowing,
typed Parley, two-week chapter, four Trial/Games receipts, first Games champion
and second missio, camp and combat save/load all passed. Tests use a separate
temporary save directory via `MAGE_SAVE_DIRECTORY`; the owner's save is untouched.
`npx tsx packages/tools/src/u1-replay.ts` PASS: byte-identical 1,296,151-byte save.

Art camera v2 arrived: aligned the nominal figure to 3.75%, the dead zone and
.35-second edge-follow constant, cross-referenced in the game data and camera
note. Projection tests use floating-point tolerance, as exact decimal equality
is inappropriate for the inverse at 22.5px/m. Full gamepad and two-resolution
final evidence remain the TV sub-wave. Human desire-to-play remains unmeasured.
