# U4 — art wiring round 2

Authored 2026-10-03, GAME / integration. Five sub-wave commits: accepted
assets, effects, characters, camp clock/header, verification and polish. Read
the full plan including j/o/q, owner checks, U2/U3/AU4 reports and session-6
handoff. Selectively copy A8/A10/A11 and the extended UI kit from the art
worktree, never raw sources. Keep upstream manifests, hashes and individual
sidecars. No art-worktree edits, arena-ground changes, provider calls or pushes.

Core remains presentation-independent. All implemented spells receive the A8
element family, with event-driven cast, travel, impact and hit, continuous aura,
and held barrier with contact compression and perfect flare. Water is still the
only playable spell catalogue; other elements are verified presentation fixtures,
not new W8 gameplay. Exact telegraphs and 140-degree ward geometry remain driven
by combat data. Emissive clips use additive blend at restrained opacity. Animation
sprites are pooled, with bounded counts and measured frame-time budgets.

A10 policy: identify the entity first, with no cross-entity substitution. Select
run direction from velocity, action direction from aim and keep facing at rest.
For an absent clip prefer the same state in the nearest available direction
(previous displayed facing breaks ties), then a compatible state in the requested
direction, then nearest direction of that state. Substitute poses hold a key;
missing death holds the last available body, faded, rather than running a corpse.
Only an entity with no loadable clip at all gets its existing procedural figure.
Log every distinct requested-to-selected fallback once and show it in an opt-in
debug overlay. Mirror the entire upright figure, including equipment handedness;
never rotate it. Sort by baseline and preserve the delivered 97.2px full frame /
40.5px nominal body at 1080p, scaled by viewport height.

A11 supplies icon.stat.* at 32 header units and the layered Tideglass, water
draining with remaining hours, four phase plates, orbiting bead and the existing
low-hours warning. Reduced motion directly displays state. The handoff explicitly
calls A11 an authored composite, not new painted generation; retain that limitation.

Validation: gate green at every commit; production Playwright tour and ordinary
input bout at 1080p/1440p; each element, moving characters, fallback and missing
asset coverage; 100 projectiles plus 12 animated figures; decoded texture memory
and frame time; exact replay and unchanged fight census. Consider atlas packing
and unload inactive pages if residency exceeds 300 MiB. Measurements and remaining
placeholders go in U4-report.md; owner motion/feel remains pending.
