# Gameplay data files

Purpose: byte-for-byte copies of the data files that hold gameplay numbers, so reviewers can read the authority directly. If a doc and a file here disagree, the file is right (and the doc is a defect).
Status: copied 2026-10-07 from the `integration` worktree at commit `b1efd46`. These copies are **not** used by the game; edit the source paths in the integration repo, then re-copy.

Campaign data (season calendar, intents, rules, characters, relationships, Director schema) is exported in [../../campaign/data/](../../campaign/data/).

## arena-design/ — combat design authority

Source folder: `docs/design/reconciled/data/arena/` (promoted byte-for-byte from the chosen baseline in W7; tuned in W4/W7/H1).

| File | Contents |
|---|---|
| [combat.json](arena-design/combat.json) | Simulation step, movement, roll, staff strike, stamina, tier clock, ward/absorb and perfect window, lines, Flow, threat language, warning floors, between-wave recovery, legacy pacing targets |
| [spells-water.csv](arena-design/spells-water.csv) | The complete Water catalogue: line, tier, branch, shape, cast time, cooldown, mana, damage, blockability, telegraph, range |
| [stats.csv](arena-design/stats.csv) | Stats (vigor, focus, nerve, guile, renown, gold, mastery), where they are trained, rank thresholds, arena and camp formulas |
| [enemies.json](arena-design/enemies.json) | Soldiers, creatures, AI mage competence table and caps (plus the obsolete Echo) |
| [arena-tiers.json](arena-design/arena-tiers.json) | Tiro, Veteranus, Primus, Summa: waves, spawns, competence, duration bands, gold and renown payouts; Tent Trial scoring |

## arena-runtime/ — kernel supplements and feel

Source folder: `packages/core/src/arena/data/`.

| File | Contents |
|---|---|
| [runtime.json](arena-runtime/runtime.json) | Values missing from the design data: geometry, training scenarios, Water details (fan speed, Return Tide wave, presets), Games spawns and AI behaviour constants, census settings, performance budget |
| [feel.json](arena-runtime/feel.json) | Version 3 feel defaults (acceleration, cast commit, stagger, knockback, presentation reactions), presets Current/Snappier/Heavier, AI variation, base poise |
| [lab-schools.json](arena-runtime/lab-schools.json) | Fire/Earth/Air/Water practice-profile multipliers for the Combat Feel Lab |

## presentation/ — camera, readability and feedback

Source: `packages/game/data/` and `art/scale-contract-v3.json`.

| File | Contents |
|---|---|
| [scale-contract-v3.json](presentation/scale-contract-v3.json) | Art/camera contract: 55° elevation, 22.5 px/m, figure 5.625% height, 94×62 m arena, dead zone, telegraph minimums, ward visual radius |
| [camera.json](presentation/camera.json) | Game camera runtime values: projection, zoom, follow dead zone and response, arena painting placement |
| [combat-feedback.json](presentation/combat-feedback.json) | Hit stop, flash, shake, perfect slow-down, damage numbers |
| [animation.json](presentation/animation.json) | Effect budgets and opacities, hit/cast holds, heavy-hit threshold (18), school→body and enemy→element maps, animation state compatibility |
| [sigils.json](presentation/sigils.json) | Painted sigil limits and telegraph coverage tolerances |
| [ui.json](presentation/ui.json) | UI design size, safe area, text sizes, target height, gamepad dead zone and repeat timing |

## Camp data (kept once, in ../../campaign/data/)

Source: `docs/design/reconciled/data/`.

| File | Contents |
|---|---|
| [locations.json](../../campaign/data/locations.json) | Eight places, their activities and opening hours |
| [camp-play.json](../../campaign/data/camp-play.json) | Map nodes and routes, NPC presence per phase, place descriptions, listening act parameters, the first Knowing |
| [season-bridge.json](../../campaign/data/season-bridge.json) | Camp → arena bridge: playable school, fatigue cost, Tent Trial stances and costs, aftermath trust, save/bout limits, result rumours |

## Re-copy command

From the main worktree, with the integration worktree at `../mage-arena-int`:

```bash
S=../mage-arena-int; D=docs/gameplay/data
cp $S/docs/design/reconciled/data/arena/* $D/arena-design/
cp $S/packages/core/src/arena/data/*.json $D/arena-runtime/
for f in camera combat-feedback animation ui sigils; do cp $S/packages/game/data/$f.json $D/presentation/; done
cp $S/art/scale-contract-v3.json $D/presentation/
# camp data (season-bridge, camp-play, locations) lives in docs/campaign/data/
```
