# CF1 design: a repeatable combat experiment

Authored before implementation, 2026-10-03. D33, PC mouse/keyboard first.
Ship and commit this Lab plus START-HERE before changing the real game's feel.

One player and exactly one target: passive/throwing dummy OR a mage of Fire,
Water, Earth or Air. Choose competence 1–4, aggression, starting separation,
fixed seed or a freshly sampled displayed seed. Reset reuses the chosen seed;
random-seed mode samples at reset outside the deterministic core. Target/school/
distance/loadout changes reset the bout; tuning changes affect future actions
immediately. Running casts keep their committed spell snapshot. Input, combat,
resources, telegraphs and AI all use the shipping fixed-step kernel.

Only Water has a complete authored season catalogue. The Lab exposes four
practice profiles with distinct cast/projectile/movement/damage coefficients,
names and A8/A10 school art over the same five spell archetypes. This is explicit
in UI and guide; it does not claim W8's unique school resources/content. Both
sides use the chosen profile through the same kernel. Competence changes inputs,
never HP/damage. Compose keeps the familiar bolt + three chosen lines/branches.

Tuning is per-arena serialized data, never mutable global tables. Defaults keep
U5 gameplay exactly; Current/Snappier/Heavier are named experiments. Movement
acceleration/deceleration, walk/sprint speed, roll distance/duration/i-frames/
recovery, spell cast/cooldown/projectile scales and individual spell overrides,
hit stun/knockback, absorb window/arc/drain/refund, mana regen, collar interval,
AI reaction and aim error are bounded numeric fields. Numeric entry, dragging
sliders and keyboard adjustment all live in the canvas UI kit. Export a versioned
JSON download; import by paste or dropping JSON onto the canvas, validated before
any application. No HTML form controls. Invalid/unknown fields fail visibly.

R resets, P freezes/resumes, period steps exactly one tick, G replenishes,
H toggles HP damage, T opens tuning, L opens setup, V replays the last 20 seconds.
Input to panels never leaks into combat. Escape keeps the existing pause menu.
Entering from a paused season flushes its accepted state first; lab mutations do
not touch the season. Main menu and pause menu both have direct Lab entry.

HUD: damaging contacts landed/taken, incoming magic contacts and ward successes,
perfect fraction, damage per gross mana spent (including cast/raise/drain),
elapsed and first target-down time. Damage-off contacts remain measurable but
do not alter HP; TTK is unavailable there. Replenishment/tuning changes are marked
as mixed measurements. A bounded snapshot ring records 1,200 fixed ticks; replay
freezes the live bout, never re-applies damage, and restores it without mutation.
Replay is observation, not a second simulation. Core determinism and JSON state
continuation get tests; browser tests exercise real controls at both resolutions.

Guide: exact Windows PowerShell install/gate/build/preview commands and URL,
menus, every control, a ten-minute experiment and a report template naming
preset/parameter/seed plus floaty/snappy/heavy/unfair/unreadable. Both
docs/START-HERE.md and the top of OWNER-CHECKS receive the same guide.
