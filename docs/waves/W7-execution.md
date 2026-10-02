# W7 integration execution

Design note, before implementation, 2026-10-02. Integration worktree begins at
ff99607; merge input is arena 68a4d68. All eight measured conflicts reproduced.
The supplied W7 plan is the contract. Work remains local; G1 is owner-only.

Sub-waves: workspace merge and owned scene lifecycles; pure season bridge and
sidecar replay receipts; opening encounter pacing; versioned atomic saves;
browser evidence and 30-minute offline soak. Build/tests precede each commit.

Combat source files are promoted byte-for-byte into reconciled/data/arena.
Historical contest tables remain archival. Runtime and accepted scale retain
their authority. No HP, damage, target bands or camera changes for W7 pacing.
Section n is imported from art read-only: discarded A2/A3 are never runtime
dependencies. Procedural figures remain behind the existing loader boundary.

Subscription work uses one durable session ledger capped at 20 attempted calls,
including failures, via the existing provider. All bulk checks use the planner.
Every acceptance result below will distinguish measured from pending.

## Merge sub-wave evidence

`npm run gate`: PASS, 129 TypeScript tests and ten reference tests, zero design
contradictions. `npm run build:game`: PASS. `npm --prefix packages/game run
smoke:w3 -- W7-evidence/merge-water`: PASS in the unified production bundle,
real pointer cast, composition, tier unlock, zero page errors. Historical pacing
FAIL remains open. No season-play or save claim at this sub-wave.

The nested lock removal initially refused because merge additions were staged;
only the two named redundant nested locks were then removed explicitly. The first
preview boot exposed Node's strip-only mode; legacy smoke launchers now use the
root TS loader. These failures were corrected before commit.

## Season decisions before behavior

Weeks one and two use Tiro only, explicitly labelled; mastery does not silently
unlock unimplemented Games tiers. Water collar spell tiers still unlock normally.
Trial is an unarmed best-of-three stamina exchange at the Pit on eve dusk, with
three readable stances and seeded opposing choices. Its weighted entrant score
is compiled from the existing Trial authority (bout/favour/renown). Losing the
entrant selection means watching the rival's deterministic Water bout with no
player gold/renown. No retry rerolls the same day.

Camp stats map by name to the existing arena formulas; poison applies the camp
table's next-Games HP/stamina penalties before Games-day expiry. Fatigue's arena
stamina cost, Trial exchange details and social aftermath are new authored bridge
data. No reserved torn-to-peers or death effects are activated. Completed bouts
produce unique receipts; the sidecar validates bounded ordered inputs and hashes,
then independently replays from the initial snapshot before applying a receipt.

The mandatory Trial offers a guard escort to the Pit when travel time is spent
or stocks prevent travel. The summons changes location only; stocks, time budget,
stats and receipt eligibility persist. This prevents a mandatory-event soft lock.

Season sub-wave gates: root gate passes 134 TS + ten reference tests. The pure
14-day route reproduces an actual full Tiro win and a missio loss with identical
final hashes. Browser weeks 1–2 passes at 1080p and 1440p, real camp controls,
listening and Parley, native arena move/cast/absorb followed by the disclosed
external input policy. Browser first Games loses in the final (three cleared),
second deliberately idles to missio; neither is relabelled a full win. Zero page
errors. See W7-evidence/season-browser.json and screens. Five live subscription
calls, all valid provider responses, ledger cap remains 20; no bulk model calls.

## Pacing candidate (before measurement)

The fresh merged 200-seed baseline confirms 46.2167 / 45.4 / 45.6 / 58.45 s
medians, first two failing. Move only multi-enemy formation anchors eight metres
toward the player, keeping the same grid, jitter and >=6 m separation. Single
mage openings remain unchanged. Hounds now assign their two engagement slots to
the nearest live pack members (stable ID tie-break), fixing distant first-spawned
hounds reserving attacks while close hounds circle. Speeds, HP, damage, resource
rules, reference policy, target bands and the accepted camera/oval are unchanged.
Retain this candidate's raw reports whether it passes or fails.

First candidate remains FAIL: 44.0167 / 45.2 / 45.6 / 58.45 s (200 seeds).
Trace inspection at seed 40000 shows slingers untouched until the conscripts die,
then prolonged lateral kiting; the maw remains 16.9 m away after the pack dies.
Second candidate gives slingers an explicit 0.8 s planted reload after release
(the 2.2 s cooldown and 0.5 s warning are unchanged) and moves the maw into the
front formation cell, permuting the same four separated spawn cells. No hidden
combat stat changes. The nearest-pack correction and closer anchor remain.

Second candidate: soldiers 44.6167 s FAIL, creatures 44.3 s PASS (200 seeds).
Reload alone worsened soldiers because they still planted at the projectile's
24 m travel range, long before their authored 8–10 m engagement band. Third
candidate schedules kiter attacks only once within that band; approach runs at
the existing 3.6 m/s. Projectile range, attack warning and cooldown are unchanged.

Third candidate still FAILS soldiers at 44.7167 s; creatures remain 44.3 s.
Fourth candidate changes soldier opening assignment: the two slingers take the
front flanks, with one conscript in front centre and three advancing behind.
This makes the priority targets reachable while melee closes, instead of placing
both behind four bodies. The six cells and their separation remain unchanged.

Fourth candidate soldiers 42.1 s FAIL. Fifth candidate removes unbounded lateral
orbiting inside the slinger's firing band: it plants there, retreats if crowded,
and closes if out of range. Its authored role remains a kiter, with exactly the
same band/speed/attack. This is a readable firing-position policy rather than a
perpetually circling moving target on a wall-less court.

Fifth candidate soldiers 41.9333 s FAIL (200 seeds). Sixth places one slinger
in front centre as well as one front flank; the fourth conscript takes the other
flank. The player can engage a priority ranged target immediately while the
melee formation closes. This changes assignment only, never cell spacing.

Sixth candidate's full 2,000/wave census FAILS narrowly: 40.65 / 44.6333 /
45.4833 / 58 s. Preserved as candidate-six-census*.json, no discarded seeds.
Seventh moves the soldier front anchor to the closest legal opening: player X
plus the contract separation plus maximum X jitter (14.8 m here). Worst-case
centre separation stays >=6 m. Creature and mage geometry stays as measured.

Seventh probe soldiers 41 s FAIL; the last metre is not the underlying fix.
Eighth lets conscripts spend their real stamina on the existing shared sprint
while approaching attack range. They still walk during backoff and stop during
windup/recovery; sprint drains and regeneration obey the unchanged kernel. This
closes the walk-speed gap on the enlarged court without granting free speed,
resources, damage or health. The roster behavior text now states this explicitly.
Final pacing gate: `integrated-census.json` records 2,000 fights per wave,
medians **38.233 / 44.633 / 45.483 / 58.000 s**, all four original bands passed.
Zero timeouts, invalid states, or replay failures. Creature median remains close
to its upper limit; the full seed sample is retained, without dropping losses.
Root gate after the sprint change: 137 TypeScript tests and 10 reference tests
passed; no design contradictions. Numeric health and damage data, reference
controller, camera contract and duration bands are unchanged.
## Save/load sub-wave

Version-one saves contain the source fingerprint, checksum, arena checkpoint hash,
camp/session state, input log, receipts, carried effects, promises, and completed
validated Director groups with their original request identities. Arena player
references are serialized as IDs and re-linked before replay validation. The local
sidecar writes `.director-runtime/saves/season.json` through a flushed temporary
file and preserves `.previous`; malformed/version/source failures leave play
unchanged. Pause/settings and the menu provide load; settings also offers recovery.

Checkpointing seals unfinished inference. Both the continuing service and a loaded
copy use the selected authored Parley card / offline night fallback for unfinished
work. Completed groups survive; reservations remain in the durable cost ledger,
outside the save. Epoch checks reject late responses and old asynchronous cleanup
cannot unlock newer work. No new paid call is made by restore.

Tests exposed historical-object aliasing: the live camp shared the last resolution
and history board, so later Games rewards rewrote prior records in an uninterrupted
run but not a JSON-loaded run. `camp-session.ts` now snapshots both records at
creation. This changes no combat rules or census results.

Save matrix covers initial/final weeks, next-day continuation, listening ticks,
pending Parley, partially completed pending dawn, prepared/active/intermission/
terminal bouts, before/after reward, duplicate payout, corrupted files and previous
good recovery. Full root gate: **144 TypeScript + 10 reference tests PASS**, lint,
both compiler checks and zero design contradictions (2026-10-02).

## Final browser and soak sub-wave

The CLI night runtime is now selectable entirely in the Director layer, with the
same fixed W7 ledger and 20-call cap as the initial sample. The first browser night
reused three groups and added two live requests, for **seven total reservations**.
The new browser driver's asynchronous wait returned before listening finished;
two attempted runs failed at the dawn locator, and their reservations/cache were
retained. Explicit bounded server-state polling completed the next attempt from
validated cache, with no further calls. All bulk work uses the offline planner.

Production weeks 1-2 pass at 1080p and 1440p with camp visits, a real 45-second
listening act, Parley, both Trials, actual arena input replay, champion and missio,
four once-only receipts, next-morning boards and save/load at camp/combat/final
checkpoints. Native keyboard/mouse precede the disclosed external input policy.
The final browser runs supersede the earlier season-sub-wave first-Games missio;
they now demonstrate a champion return as well as an ordinary-damage loss.

Repeated composer cancellation exposed retained hidden dialogs; the season
callback now removes each cancelled/failed composer. Six Back/Escape cancellations
and eight arena remounts pass with one bout identity, one canvas and no extra
receipt. Camp disposal also clears owned toast timers and ignores late errors.
Package-local game tests initially attempted to load the HTTP sidecar via Vite's
config and hit Node strip-only syntax. A dedicated unit-test config runs the same
camera/loader tests without starting a server. Root and both package gates pass.

The source comparison found Windows CRLF conversion in the promoted text tables.
Explicit LF attributes now keep combat/stats/spells/tiers byte-identical to the
pinned Git blobs. Enemy data changes only the disclosed conscript behavior prose;
every numeric field remains identical. The full census was rerun, preserving all
four passing medians and fight digests. Accepted camera bytes are unchanged.

Section n is enforced in the current tree: 120 discarded A2 delivery/review files
and portrait images are removed, with history retained. No A3 runtime images were
present. Accepted camp asset hashes remain unchanged. A1b is a camera/ground proof
containing figures, not a clean floor texture; the current floor is procedural.

The soak runs a single production browser through repeated menu/camp/training
lifecycles, checks poll/RAF ownership and native wheel input, loads real simulated
season checkpoints, and completes normal Trial/Games seasons with the offline
planner. Its first one-minute probe used a CDP freeze command that did not suspend
the visible renderer, so that assertion failed; the failed record is preserved.
The corrected probe measures a deliberate two-second renderer stall and verifies
bounded catch-up. The acceptance run requires thirty actual wall-clock minutes,
retains all samples, verifies a stable simulation/source hash and unchanged cost
ledger, and cannot pass before that interval finishes. It is not a human soak.

The report, screenshot gallery and OWNER-CHECKS contain concrete Windows commands.
Owner G1 and the independent orchestrator rerun remain outside this executing
agent's completed automated claims. No push or owner-feel assertion is made.

The first full soak passed at 1,800,091 ms: 60 cycles, four complete simulated
seasons plus four days, 5.0-7.3 MiB retained browser heap, no page errors and no
new calls. It is retained as `soak-before-validation-hardening.json`. Additional
malformed-save probes then exposed four real gaps: unknown pending Parley card
and wrong pending-dawn slot could mutate the live service before throwing;
duplicated character identity and an entrant rank inconsistent with the camp
could pass validation. All four probes first failed, then passed after correction.

Validation now checks keyed identities, pending-action eligibility and the
deterministically prepared entrant/seed against the camp. Restoration resolves
fallbacks in an isolated service before replacing the live service, so an error
cannot leave a partial restore. A prepared save also boots into an arena at tick
zero and remains paused; a dedicated production browser check covers that route.
The pause button label follows global settings. The final source fingerprint,
byte-exact replay, browser route and thirty-minute soak are remeasured after this
hardening rather than relabelling the earlier run.

The final hardened-source soak **PASS** is 1,800,083 ms: 60 scene cycles and
simulated days, four complete seasons plus four days, 5.0-7.3 MiB retained browser
heap, zero errors and zero added calls. Its source fingerprint matches the final
1,296,151-byte replay/save artifact. Both final production browser resolutions
also passed after hardening. The total CLI ledger remains **7/20**. All automated
W7 gates are complete; independent orchestrator rerun and owner G1 remain open.
The test-generated local save slot is reset to day 1 for the owner handoff.
