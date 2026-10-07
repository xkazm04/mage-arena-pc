# W7 integration plan - CORE third-session handoff

**Plan only.** No arena source was imported, no branch was merged and no W7
playability/save-load claim is made. The orchestrator owns integration under plan
section i. W5 is `d18ef80`; W6 is `c464f169bbb8abfb4bedcce53450bb8c618f67a9`.
This plan follows section j: retain one data authority, preserve seeded simulation,
validate model effects, run gates before commits, keep measured and felt separate,
and never push. Owner G1 remains open.

## Inspected snapshots and present blocker

Read-only `git show`, `git ls-tree` and object-only `git merge-tree` inspected:

| Input | Pinned revision | Relevant state |
|---|---|---|
| Core | `c464f169bbb8abfb4bedcce53450bb8c618f67a9` | W0/W1b, W5 camp, W6 Parley; 65 TS plus ten reference tests pass |
| Arena | `68a4d68d315856c89339d331ac0db7f4784d566f` | W4b confirmed camera and W4c ground-plane aiming; Tiro pacing follow-up open |
| Art reference | `9c3c7ff8dcd16ac2df8c77d3dbadeee4ffb78b39` | W5 already copied accepted A4/A5 assets with hashes; further art acceptance remains separate |
| Common ancestor | `1e9de1c48449817a4f5506c9a42d0240a6b64e9e` | Basis of the measured merge conflict inventory |

The camera end note was absent from this core checkout. It was read from the
arena plan and carried into the core plan: **55-degree oblique view, upright
billboards, near-distance open oval; never 90-degree top-down**. Preserve the
192x144 m arena, 0.8-1.2 zoom, near 1.2 baseline, minimum 6 m opening separation,
140-degree ward and pointer-to-ground inverse transform. Do not shrink the arena
or flatten the camera to make an integration gate appear green.

Arena's saved W4b report discloses an actual regression: the 2,000-fights-per-wave
census has medians **44.3833 / 45.55 / 45.4833 / 58 s**, versus bands
25-40 / 30-45 / 45-70 / 45-80. Soldier and creature bands fail. The command is
`npm --prefix packages/core run report:w4 -- --evidence W4b-evidence --tag oval-census`
and deliberately exits 1. These are inspected arena evidence, not freshly measured
by CORE. The old W4 pass is historical. Opening-encounter rework belongs to arena;
G1 cannot close until the current merged camera/layout passes the required census.
No HP, spell damage or duration-band change is authorized merely to conceal it.

## Merge inventory and exact procedure

Measured on the pins above:

```powershell
git merge-tree --write-tree --name-only c464f169bbb8abfb4bedcce53450bb8c618f67a9 68a4d68d315856c89339d331ac0db7f4784d566f
```

It reports eight conflicts: `.gitattributes`, `.gitignore`,
`docs/MAGE-ARENA-PLAN.md`, `packages/core/package.json`,
`packages/game/package.json`, `packages/game/index.html`,
`packages/game/src/main.ts`, `packages/game/src/style.css`. The object result is
`42d441be4fa2fc0ec3853f975c31c15ee185eb9e`; it is not a commit or a usable merge.
The command writes Git objects only; it did not touch any worktree/index.

Future orchestrator commands, **not executed in this session**:

```powershell
Set-Location C:\Users\kazda\kiro\mage-arena-core
if (git status --porcelain) { throw 'Core has uncommitted work; preserve it first.' }
$w7Core = (git rev-parse core).Trim()
$w7Arena = '68a4d68d315856c89339d331ac0db7f4784d566f'
git merge-base --is-ancestor c464f169bbb8abfb4bedcce53450bb8c618f67a9 $w7Core
if ($LASTEXITCODE -ne 0) { throw 'W6 is not an ancestor; re-plan.' }
# Record $w7Core in the integration note. Review any code after the W6 pin.
git merge-tree --write-tree --name-only $w7Core $w7Arena
# Exit 1 is expected for the documented conflicts; inventory changed conflicts.
git worktree add -b integration/w7-core-arena C:\Users\kazda\kiro\mage-arena-w7 $w7Core
if ($LASTEXITCODE -ne 0) { throw 'Worktree was not created; do not reuse another checkout.' }
Set-Location C:\Users\kazda\kiro\mage-arena-w7
git merge --no-ff --no-commit $w7Arena
# Expected conflict exit: proceed only with the explicit resolution below.
git diff --name-only --diff-filter=U
```

Use Git blobs to preserve both entrypoints before resolving them. This exact
command reads the pinned originals without PowerShell encoding conversion:

```powershell
New-Item -ItemType Directory -Force .director-runtime | Out-Null
@'
const { execFileSync } = require('node:child_process');
const { writeFileSync } = require('node:fs');
for (const [rev, from, to] of [
  ['c464f169bbb8abfb4bedcce53450bb8c618f67a9', 'main.ts', 'camp-entry.ts'],
  ['68a4d68d315856c89339d331ac0db7f4784d566f', 'main.ts', 'arena-entry.ts'],
  ['68a4d68d315856c89339d331ac0db7f4784d566f', 'style.css', 'arena-style.css'],
]) writeFileSync('packages/game/src/' + to,
  execFileSync('git', ['show', rev + ':packages/game/src/' + from]));
'@ | Set-Content -Encoding utf8 .director-runtime/w7-extract.cjs
node .director-runtime/w7-extract.cjs
```

Resolve the eight conflicts deliberately:

| File | Resolution |
|---|---|
| `.gitattributes` | Union byte-preserving accepted-art/W6-evidence rules with arena rules. Never normalize hashed evidence. |
| `.gitignore` | Union runtime, dependency, dist and generated arena-data rules. Preserve W1 evidence exceptions. |
| Plan | Union stream histories and status rows; retain W1 full PASS, W5/W6 outcomes, current camera note and current arena pacing FAIL. Do not copy stale "not started" rows over completed evidence. |
| Core package | Keep workspace name `@mage/core` and root export; add `./arena` export to `./src/arena/index.ts`. Union arena data/report scripts. Root owns tool versions/lock. |
| Game package | Keep `@mage/game`, current core/director dependencies and Pixi/Vite versions; add arena smoke scripts and required Playwright test dependency. Rewrite `@mage-arena/core/arena` imports to `@mage/core/arena`; remove the duplicate file dependency. |
| HTML | Keep camp's accessible root and module loader. Arena no longer replaces the global `#app` autonomously. |
| `src/main.ts` | Small scene router; extracted camp and arena entry modules mount into owned roots and return disposers. Preserve both implementations; no blanket ours/theirs. |
| `src/style.css` | Camp styles retained; scope extracted `arena-style.css` below `.arena-root`, including headers, `.slots`, `.toolbar`, canvas and buttons. No global collision. |

Arena also carries nested package locks and a different compiler/test setup.
Remove **only** its two now-redundant tracked nested lockfiles in the integration
checkout (`git rm packages/core/package-lock.json packages/game/package-lock.json`)
and regenerate the root lock with `npm install`. Keep one installed dependency
graph; do not install a second copy of core or Pixi. Arena uses extensionless
relative imports and Bundler resolution; core uses NodeNext. Convert relative
arena imports to explicit `.ts`, including generated-data imports, and retain its
`noUncheckedIndexedAccess` checks in an arena-specific check. Do not exclude arena
from the root gate just to hide type errors. Reconcile ESLint with real fixes or
scoped justified rules, not a blanket ignore. Generate arena data before compile.

Keep the existing names for arena `data`, `report:w2`, `report:w3`, `report:w4`,
`report:w4:ladder` and game `smoke`, `smoke:w3`, `smoke:w4`, `smoke:w4b` scripts so
the recorded commands remain usable. Adapt their dev-server base URL/route to the
integrated training route and retain stable test controls there. The production
build must include both routes and both accepted-asset loaders.

After conflict resolution, lifecycle extraction, bridge and save implementation:

```powershell
npm install
npm --prefix packages/core run data
npm run gate
npm run build:game
npm --prefix packages/core run build
npm --prefix packages/game run build
npm --prefix packages/core run test
npm --prefix packages/game run test
# Start the unified loopback server in a separate shell, then:
npx tsx packages/tools/src/camp-browser.ts
npx tsx packages/tools/src/parley-browser.ts
npm --prefix packages/game run smoke
npm --prefix packages/game run smoke:w3
npm --prefix packages/game run smoke:w4
npm --prefix packages/game run smoke:w4b
npm --prefix packages/core run report:w2
npm --prefix packages/core run report:w3
npm --prefix packages/core run report:w4 -- --evidence W7-evidence --tag integrated-census
# Run the new W7 bridge/save/replay/browser gates described below as well.
git diff --check
git diff --name-only --diff-filter=U
# Stage reviewed files only; then inspect staged evidence and commit the merge.
git add -u
git status --short
# Explicitly add newly implemented entry/bridge/save/test/evidence files shown above.
git diff --cached --check
git commit -m 'W7: integrate camp and arena with deterministic saves'
```

Execute commands sequentially and stop at each unexpected nonzero exit; do not
commit a failed gate. The current pacing failure is expected **before** its arena
follow-up, but remains a failed acceptance gate. Future commands are a plan,
not evidence. No push. If integration must be abandoned, `git merge --abort` is
appropriate only in this newly created integration worktree; never reset core,
arena or art worktrees. Pin and review a later arena fix before merging it there.

## Contract between camp and arena

Add a pure core season bridge, with separate Director-side session orchestration.
No filesystem, clock or transport in core. The bridge has an explicit state
machine: camp -> prepared bout -> active/intermission -> terminal result -> camp.
A pending bout locks camp travel, slot passing, Parley and dawn. Training is a
separate replayable route and cannot grant season rewards.

The current arena exports `createGames(seed, composition, startWave,
referencePlayer)`, `stepGames`, `advanceGames` and `gamesResult`. The constructor
hardcodes Cassia/Water and default arena stats; it cannot currently receive a camp
character. Extend it with a validated player snapshot from camp (identity, school,
stats, allowed composition/mastery and carried effects) without changing existing
training defaults. W7's playable scope is Cassia/Water/Tiro; other schools remain
W8, not relabelled Water implementations. Week two must not silently expose
unimplemented tiers: enforce the actual unlocked tier and disclose Tiro scope.

`GamesResult` currently has `kind: missio | champion`, `wavesCleared`, `gold`,
`renown`, `finalReached`, `finalWon`. Only lost/complete games can produce it.
The sidecar must derive the terminal result from the seeded input replay, then
apply a unique bout receipt once. Do not accept HTTP-supplied payout numbers or
trust a client saying it won. Validate ordered ticks, allowed inputs, bounded
payloads and state hashes; disallow debug/reference-player shortcuts in season
mode. Arena `champion` means this bout, not the season ending.

Reconcile source ownership before coding gains:

| Quantity | Required authority |
|---|---|
| Calendar, slot costs, Knowing effects, trust, camp sickness/caps | Existing reconciled season/rules/camp-play/parley data |
| Combat, Water, enemies, tiers/payout, arena runtime | Arena's existing source tables; promote active files byte-for-byte into a reconciled arena namespace and repoint its compiler, keeping historical baseline archived |
| Shared stat ranks and stat-to-resource formulas | Single reconciled stat mapping, checked against both camp rank ranges and arena formulas; remove duplicate live authorities |
| Camera/layout | Accepted scale contract and arena runtime; no prose constants copied into bridge |
| Reward carry, fatigue/sickness application, Trial outcomes | Explicit reconciled bridge data with source references and trace tests before behavior |

The current arena data compiler reads historical `baseline-fourteen-nights` combat,
stats, Water, enemy and tier data plus `art/scale-contract-v1.json`. Preserve its
contradiction checks while moving active authority. Do not promote old loop/echo
camp data accidentally. Imported `runtime.json` and accepted scale remain the
arena's responsibilities; the bridge reads them rather than duplicating numbers.

Days 6/13 are Trial eves, days 7/14 Games. Specify Trial entry/exit and per-day
receipt rules so repeated navigation cannot reroll a bout. Preserve actual camp
stats, trust, debt, loyalty, gold, renown, knowledge and mastery across returns.
Camp currently clears sickness on Games-day settlement: snapshot and apply any
valid poison/fatigue effect **before** its documented expiry so it cannot vanish
before the bout. Do not activate reserved `tornToPeers` or other duality effects
without an actual eligible outcome and explicit bridge tests. Arena missio does
not invent camp death; lethal mechanics remain W10.

## Renderer and input lifecycle

Arena currently creates its own Pixi Application, window listeners, ticker,
AudioContext and DOM. `ArenaInput` has `clear()` but no listener disposal. Camp
also owns polling, Pixi and controls. Extract mount/dispose for both. Use an
AbortController or named handlers for input/resize/visibility, remove tickers,
stop audio, release pointer captures and cancel owned polls at transition.
Destroy owned containers/renderers without unloading shared textures in use.
Return to the same camp session and focus the triggering control. Tests must
round-trip repeatedly and prove one input frame/tick handler remains active.

Keep upright figure depth ordering and foot-plane aim under follow, zoom and
resize. Camp asset manifest fallback and arena figure-manifest fallback are
separate accepted loader boundaries. Merge no raw art branch wholesale. A3 frames
need their delivery acceptance and sidecars; procedural fallback remains valid
until then. No model/provider bookkeeping in game assets or UI.

## Save/load and acceptance gates

Use a versioned, strictly validated save envelope: schema version, source/data
hashes, season/session state, bout identity/phase, ArenaState tick/RNG state,
composition, ordered input log and checkpoint hash, applied receipt IDs, pending
intent promises, carried camp effects and validated completed Director decisions.
Persist IDs for references; re-link `Games.player` to its actor on load rather than
silently cloning a divergent actor object. Never serialize promises/controllers,
Pixi objects, model processes or wall-clock timestamps into deterministic state.

Sidecar writes atomically to a bounded local save path with a previous good
snapshot; validate before replacing or loading it. Unknown schema/hash or corrupt
content gets a recoverable error, never a partial state write. Save/load must not
reset budgets or change request keys. For in-flight Director work, persist the
request identity and already completed validated groups; resume from cache or
bounded authored fallback without refunding reservations or spawning duplicate
paid calls. Saving cannot reroll Parley or duplicate Games payout. Sleep pauses
presentation; fixed-tick replay does not simulate hours of combat on resume.

Required W7 evidence before G1 review:

1. Pure deterministic 14-day camp/Trial/Games path, including a loss and win,
   returned real receipts, unchanged unrelated state and traceable payouts.
2. Byte-equivalent continuation hashes for uninterrupted versus save/load at
   camp, listening, pending Parley, pending dawn, active arena, intermission and
   terminal-before/after-reward points. Malformed/old saves fail without mutation.
3. Repeated receipt, stale revision, duplicate/dropped input, wrong bout ID,
   fabricated payout, close/reopen and concurrent dawn tests. Independent replay
   rejects mismatched arena hash and never grants a second reward.
4. Browser weeks 1-2 route with real controls at 1080p/1440p; no double handlers,
   late Director writes or secret-state projection. Record screenshots and commands.
5. Re-run current W2-W4/W4b gates on the merged code, including 2,000 fights/wave,
   native pointer/ward hits, fallback assets and 100 **visible moving** projectiles
   in the performance sample. No recycling historical PASS as new measurement.
6. Orchestrator independently reruns gates and dispatches the planned G1 review.
   Owner plays the two-week build and judges camp consequence, typing value,
   camera/aim comfort and desire to continue. Only that can mark felt/G1 complete.

Current CORE work is ready for this integration; current arena pacing and owner
review remain open. No W7 implementation has been smuggled into the core branch.
