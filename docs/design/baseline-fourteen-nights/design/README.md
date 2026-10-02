# Variant 2 design package: Fourteen Nights

Read `../index.html` first (the report). These files are what the executing agent builds from.
Every number is authored unless a file says otherwise; feel is the owner's to certify.

| File | What it is | Consumed by |
|---|---|---|
| `data/characters.json` | 16 characters: traits, values, goals, voice, `remembersLoops`, `forbiddenIntents`, knowledge seeds | W1 |
| `data/schools.json` | Four schools; combat identity; camp bias as planner intent weights and a prompt hint | W1, W3, W8 |
| `data/stats.csv` | Stats, arena effects, what happens at the ring's turn (Echo) | W1, W2, W7 |
| `data/locations.csv` | Eight places, when they are open, what they give | W5 |
| `data/intents.csv` | The closed intent vocabulary, effects, contests, caps | W1 |
| `data/loops.json` | Loop lengths, what persists, what resets, mastery, endings | W1, W7, W12 |
| `data/combat.json` | Arena constants: movement, aim mode, directional absorb, perfect window, collar clock, Flow | W2, W3 |
| `data/spells-water.csv` + `spell-sheet-water.md` | Water's Bolt and five lines | W3 |
| `data/enemies.json` | Roster, AI mage competence, the Echo | W4, W9 |
| `data/arena-tiers.json` | Tiers by mastery, waves, payouts, the Breaking condition | W4, W9 |
| `data/arcs.json` | The four archetype situations as arcs, and which intents push which edge | W1 |
| `data/parley.json` | Typed role-play: trigger, output, code checks, offline cards, two examples | W6 |
| `reconciliation/director-schema.json` | Schema of one Director group call's output | W1 |
| `reconciliation/director-prompt.md` | System message, example input and output, validator, cache, cost and latency | W1, W14 |
| `reconciliation/worked-nights.json` | Nights A, B, C1 (cache) and C; W1's golden test | W1 |
| `waves/W1-director-harness.md`, `waves/W2-arena-kernel.md` | Full wave cards | W1, W2 |
| `waves/plan.md` | All waves with gates and dependencies | every session |

Consistency rule: when a number appears in two files, the data file wins and the other is a defect.

Arena implementation amendment, W4 (2026-10-02): `spells-water.csv` and three HP entries in
`enemies.json` were tuned against seeded fights in the arena stream, directly in these authorities.
`spell-sheet-water.md` now reflects those damage values and D4 controls. The original `index.html`,
gamepad/JVM wave card and loop-era prose are historical design context; the current project plan and
`docs/waves/W2-*`, `W3-*`, `W4-*` govern execution. Original authored values remain in Git history.
Do not create a second editable copy of these arena tables at integration; either keep the arena compiler's
explicit baseline paths or move the authority and update its imports, carrying the W4 tuning with it.
