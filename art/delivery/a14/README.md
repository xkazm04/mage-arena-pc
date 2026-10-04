# A14 additive character clips

Session 10 stage 2: **180/192 priority slots**. All humanoids are complete.
Cinder hound and Hush Moth have all four priority states in four directions;
Mire Maw lacks rear death/corpse, and Thornback lacks rear hits/death/corpse.
Those twelve slots failed their two-attempt bounds and remain absent. The
session used 22 agy calls/images/charges (project 364), Grok unused. Current
counts and exact remaining queue are in `session10/current.json` and
`session10/backlog.json`. The schema and merge procedure remain unchanged:
merge these entries over A10 without consumer code changes. Historical
session-9 notes below are retained as history.

`characters.json` follows the A10 `schemaVersion:1` page/entity/clip/frame schema.
Merge present entity/state/direction entries over A10; preserve its other clips.
Page IDs are prefixed `a14-` to avoid collisions. `loader.js` is a working merge
and canvas consumer, including atlas hash checks. Paths are repository-relative.
Missing/rejected clips remain explicit; the consumer returns false for them.

States: `hit-light` (four keys, 160ms), `hit-heavy` (six keys, 240ms suggested
visual recovery), `death` (four, six or seven keys, 600ms), `corpse` (one static key, indefinite).
Legacy `hit` aliases `hit-light`. The game may retime playback to its stun data;
art does not prolong the simulation's interruption. Both hit clips recover.
Every damaging hit, casting cancellation, poise, immunity and recoil mechanics
belong to the game. Enemy attack/brace names do not confer new abilities.

On defeat retain facing, play death once, then select corpse indefinitely until
bout cleanup. Nonlooping playback clamps to its last key even if state switching
is delayed. Corpse pixels and anchor exactly match the last death key. Separate
`corpses/<entity>-<direction>.png` files have mirroring already applied; when using
these standalone files do NOT mirror them again. Atlas left clips DO use mirrorX.
Ground body-centre anchors are supplied; keep corpse world position constant,
sort on its ground centre, and remove collision/targeting/AI in the simulation.

Master frames are 384px, nominal body height 160px. **D32 scale is already in
A14:** draw full frames at 145.8px at 1080p, 194.4px at 1440p for nominal bodies
60.75/81px. Do not apply 1.5 again. The merger upgrades inherited A10 drawing
size once and captures each clip's old anchor. Honour clip anchors rather than
overwriting all entity anchors during merge. No upright body rotations or extra
ground-projection squash. Native generated detail is measured per source.

Two anatomical views are generated (ne rear-right, se front-right); nw/sw are
horizontal mirrors, including handed equipment. Generated pose keys undergo
local magenta extraction, uniform scaling and authored ground-pivot alignment.
Source indices disclose reselections. Corpse is derived from the last key, not
an extra generated image. The owner board presents death strips and lying poses.
Source gates check margins, pigment and silhouette drift, plus hash-bound direct
facing observations. They do not prove identity or animation quality. Local
vision advice can only reject or route to the owner; no owner approval is claimed.

Rebuild: `python tools/art/a14_build.py`; validation and browser commands are
recorded with the final delivery reports. Existing A10 source files remain intact.

Stage 1 is PARTIAL: 124/192 requested state-direction slots. All four mages and
four soldiers have both hit clips in all directions. Death/corpse are present
for those eight except Garran ne/nw. The four creatures still need A14 generation;
their slots stay absent. Existing A10 fallback policy remains game-owned.

Grok stopped with HTTP 402 exhausted Build balance. agy stopped with repeated
pre-generation HTTP 503 after one documented bounded recovery. Both latches are
retained at 342 project charges (24 this session); unused allowance is not
availability. All 21 generated attempts, including four complete-sheet rejects,
are preserved. Some light clips select stronger stagger keys; source layout
corrections and explicit empty-gutter grid-rule masks are documented. No missing
anatomy was reconstructed or padding used to conceal a cut-off body.
