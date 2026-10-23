# Combat-system depth: builds, not triangles

Status: **WP1 built** 2026-10-23 (progression core: Agility, spell ranks, enemy levels). WP2 (archetypes and rival builds), WP3 (ultimates) and WP4 (builds census and Lab pickers) follow in that order; WP3 and WP4 may run in parallel. The design comes from the owner's spark session of 2026-10-23 (`.spark/Spark/ideas/combat-system-depth.md`, outside git). This document is PC-only: nothing here changes VR's canonical numbers, and VR change requests come later, from evidence.

## 1. The owner's doctrine (verbatim)

These lines are the requirements. Everything below is read against them.

- **Builds, not triangles.** "Lets not make triangles, I would like to involve character stats development and spell extension and picking as a factor. Ideal target would be in having option doing builds in any class for any situation: Close fighters, Fast light spellcasters focused on first waves, Heavy slow long ranged mages which need to survive until later rounds and then control battlefield with powerful spells. No need to resolve all at once, but rather open the game for these possibilities, so it is replayable, not only the combinatoric behind story."
- **Agility.** "introduce agility, but we need to keep fight stationary until in VR. Let stick with agility, and design how it can help with spellcasting time, blocking time. So we have prepared the stats once VR left"
- **Spell ranks and enemy levels.** "Introduce Spell Ranks, this will affect health of enemies through levels too. We will also need larger spellbook then can be used, for each duel only selected leveled up spells can be picked (by default set from last battle). By spell variety we can shape the style of fights together with stats"
- **What a rank buys.** "Combine, for example 4 levels power only, final 5th level an ultimate form with additional effect"
- **Who levels.** "Regular enemies will have hardcoded levels per time spent in the calendar/campaign. Each week one level up for example. Rivals will have authored builds"

## 2. The model

A build is **stats** (vigor, focus, nerve and now agility, ranks 1-5), a **spellbook** with a rank per spell, a per-duel **pick** (bolt + 4 from the school's list, default = last battle's pick) and, for AI rivals, an **archetype plan**. Any school can run any archetype.

| Axis | What it does | Neutral default | Where |
|---|---|---|---|
| **Agility** (rank 1-5) | No movement effect. Per rank above 1: faster casting (cast and windup), a wider perfect-absorb window, shorter recovery (after casts, ward releases, staff strikes, rolls), cheaper blocking (absorb drain). | absent = rank 1 = no effect | `Ranks.agility?`, `arena/progression.ts` |
| **Spell rank** (1-5) | Ranks 1-4: power only, one multiplier on damage and effect size (heals, the Font's mana, Return Tide's stored cap, DoT ticks). Cost, cast time and cooldown unchanged. Rank 5: rank 4 power plus the row's **ultimate form** (WP3). | absent = rank 1 = the row's own numbers | `Actor.spellRanks?`, `rankedSpell` (Fire/Air), `rankedWaterSpell` (Water) |
| **Enemy level** (1-6) | Regular enemies (soldiers, creatures) take a per-level HP multiplier. Level = campaign week (`season.json` weeks: 6). Named rivals and mage entrants are not levelled: rivals get authored builds (WP2). | absent = level 1 = today's HP | `createGames(..., { enemyLevel })` |
| **Archetype** (to come, WP2) | Close fighter (the Fire brawler cycle), fast light caster (the Air skirmisher kite), heavy long-range controller. AI plans for Fire and Air rivals; shape-class counters (Ring vs dashers, Air Form vs projectiles, Tide Ward vs beams). | none | `arena/archetypes.ts`, `rival-builds.json` |

**Curve target** (from the spark): within a duel, light builds win most fights that end before tier III and heavy builds win most fights that reach tier IV; each archetype x school rival build lands at 40-65% against the reference.

### Rules every axis keeps

- **Neutral at default.** Effects scale with (rank - 1). The goldens (`replay-golden.test.ts`), the default census digests (`docs/waves/W8-evidence/w8x.json`) and the CR-002/CR-007 parity suites stay hash-identical without re-pinning. Keys are added to the state only when set.
- **Parity ignores all of it.** A state that runs `balance: 'canonical'` reads agility as 1, every spell rank as 1 and every enemy level as 1.
- **The telegraph holds.** Agility shortens the caster's own cast and windup, but a defender-facing warning (spell telegraph, Sunfall's shadow) never drops below its reaction-band floor (`warningFloor`: 0.8 s unblockable, 0.4 s positional), and a warning authored under its floor is not shortened at all, the same law as pace (`pacedWarning`).
- **Nerve keeps its rule.** Nerve still sets the drain rate and the perfect refund. Agility's drain cut is smaller and multiplies on top, so the two stats overlap only partly.
- **One seam per number.** Fire and Air ranks apply in `rankedSpell` (composing over `balancedSpell`, so the PC overlay comes first); Water ranks in `rankedWaterSpell`. No scattered multiplies.

### Spell-rank keys

- **Fire and Air:** the spell id (`fire_lance`, `air_shear`), the same id the canonical CSVs and the overlay use.
- **Water:** the line row `<line>:<tier>` (`tide_orb:2`, the bolt is `bolt:0`). A Water line row is one spell per collar tier; its A/B branches are alternative forms of the same row, so the rank follows the row and survives a branch swap. Ratios (Tide Ward's drain cut, Sheen's refund, Puddle's slow), displacement and durations keep the row's numbers.

## 3. The data file

`packages/core/src/arena/data/progression.pc.json`, loaded and checked by `arena/progression.ts` (unknown keys, wrong signs, a falling table or an unknown ultimate id throw at load; `authored-data.test.ts` plants each failure).

| Key | Value | Why this start |
|---|---|---|
| `agility.pointsForRank` | 0;6;14;24;36 | the shared stats curve (`stats.csv`, checked equal in the test) |
| `agility.castMultPerRank` | -0.04 | rank 5 casts at x0.84: Brand Lance 36 -> 31 ticks; under every floor-bound warning nothing moves |
| `agility.perfectWindowAddSPerRank` | 0.0125 s | rank 5 widens 0.15 s to 0.20 s (9 -> 12 ticks): readable, still a skill window |
| `agility.recoveryMultPerRank` | -0.05 | rank 5 at x0.80: roll recovery 9 -> 8 ticks, ward re-raise 8 -> 6 ticks |
| `agility.drainMultPerRank` | -0.03 | rank 5 drains x0.88, well under nerve 5's x0.56 (27 -> 15 mana/s) |
| `spellRanks.power` | 1, 1.1, 1.2, 1.3 | +10% per rank; rank 5 keeps 1.3 and adds its ultimate |
| `spellRanks.ultimates` | `{}` | the WP3 registry; `ultimateFor(spellId, rank)` reads it |
| `enemyLevels.hpMult` | 1, 1.1, 1.2, 1.3, 1.4, 1.5 | mirrors the rank power so that "average spell rank == enemy level" keeps the default shape; levels 5-6 run ahead of rank-4 power until ultimates exist |

## 4. Measurements (first evidence, no tuning)

200 default-census seeds (from `censusSeedStart`), the reference player (Rotation, competence 2), normal difficulty. Level 1 at agility 1 reproduces the first 200 fights of `w8x` wave 1 (median 35.32 s).

**Wave 1 (soldiers):**

| Run | Win rate | Median s (completed) | Timeouts |
|---|---|---|---|
| Level 1, agility 1 | 100.0% | 35.32 | 0 |
| Level 1, agility 5 | 100.0% | 35.53 | 0 |
| Level 3, agility 1 | 100.0% | 44.88 | 0 |
| Level 3, agility 5 | 100.0% | 44.78 | 0 |
| Level 6, agility 1 | 100.0% | 59.27 | 0 |
| Level 6, agility 5 | 100.0% | 58.73 | 0 |
| Level 3, Water rows at rank 3 | 100.0% | 36.28 | 0 |
| Level 4, Water rows at rank 4 | 100.0% | 35.78 | 0 |
| Level 6, Water rows at rank 5 | 100.0% | 42.73 | 0 |

**Mage waves (agility only; mages are not levelled):** semifinal agility 1/3/5 wins 88.5/90.5/89.0%, median 40.10/39.57/40.17 s; final 53.5/55.5/56.0%, median 49.20/49.33/49.33 s.

Reading: the reference player clears wave 1 untouched, so wave 1 measures clear time only. Enemy level is a pure duration lever there (+27% at level 3, +68% at level 6), and matched spell ranks bring it back (36.3 s and 35.8 s against 35.3 s). Agility shows where the player is hit: +2.5 points in the final. The reference AI still plans its raise on the base window (`mage-ai.ts`), so agility's window is measured as a passive gain here.

## 5. Not in WP1

Camp training for agility (no camp stat earns it yet; saves only accept it), the week-to-level wiring in the season bout, player Fire/Air in Games, mixed-school spellbooks, movement effects from agility, and VR change requests.
