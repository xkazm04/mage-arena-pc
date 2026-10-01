# Variant 1 design package: The Ledger

Read `../index.html` first (the report). These files are what the executing agent builds from.
Every number is authored unless a file says otherwise; feel is the owner's to certify.

| File | What it is | Consumed by |
|---|---|---|
| `data/characters.json` | 21 camp characters: traits, values, goals, stats, voice cards | W2 loader, W6 Crier |
| `data/schools.json` | Four schools: combat identity resource and camp bias | W4, W8, W2 planner |
| `data/stats.csv` | Vigor, Focus, Nerve, Guile, Renown, Gold: how each is trained and what it does in the arena | W2, W3, W7 |
| `data/locations.csv` | Nine camp places, which slots they are open, what they give | W2, W6 |
| `data/activities.csv` | The option scale every character chooses from | W2 planner |
| `data/goals.csv` | Goal library and the deterministic retarget triggers | W2 |
| `data/relationships.csv` | Starting trust, debt, feud | W2 |
| `data/situations.json` | The four archetype situations as state machines | W2 |
| `data/quests.json` | Two authored decision-text quests and the quest linter rules | W10 |
| `data/combat.json` | Arena constants: movement, roll, absorb, perfect absorb, tier clock, threat language | W1, W3 |
| `data/spells-fire.csv` + `spell-sheet-fire.md` | The Fire school's ten spells and how to compose them | W4 |
| `data/enemies.json` | Soldiers, creatures, and the AI mage competence dial | W5 |
| `data/arena-tiers.json` | Four arena tiers, their waves, payouts and the Tent Trial | W5, W7, W9 |
| `reconciliation/night-ledger-schema.json` | Schema of the Night Ledger (code) and the Dawn Board (Crier) | W2, W6 |
| `reconciliation/crier-prompt.md` | The Crier prompt, an example input and output, the validator, the cost | W6, W15 |
| `reconciliation/worked-days.json` | Three worked nights of the slice with every delta; W2's golden test | W2 |
| `waves/W1-arena-kernel.md` | Full wave card | W1 |
| `waves/W2-ledger-kernel.md` | Full wave card | W2 |

Consistency rule: when a number appears in two files, the data file wins and the other is a
defect to fix (one authority per quantity).
