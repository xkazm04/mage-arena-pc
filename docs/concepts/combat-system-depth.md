# Combat-system depth: builds, not triangles

Status: **built and on main** 2026-10-23 (WP1 progression core, WP2 archetypes and rival builds, WP3 ultimates, WP4 Lab pickers; campaign week sets the enemy level at `995fab3`). Follow-up directions: `docs/concepts/D1-combat-followup-and-progression.md`.

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


### WP2 as built: archetypes and rival builds

**Builds** live in `arena/data/rival-builds.json` and are validated at load by `archetypes.ts`. Each build has a school, an archetype, a wave (0-based: 2 semifinal, 3 final), four ranks including agility, spell ranks 1-4 for its own rows, and a bolt + 4 loadout. `createGames(..., { rivalBuild: id })` spawns that build in place of the wave's rival on the build's wave. With `schoolRivals: 'named'`, Brennic plays `fire_close` and Lio plays `air_light` (the `build` key in `rivals.json`); their phases are unchanged. A build rival carries its build as its loadout name (`build:<id>`), so the state alone selects the plan. Water mages and catalogue (parity) rivals never reach the plan code, so the goldens, the default census digests and CR-002/CR-007 stay identical.

**Plans** (`archetypes.ts`) are code over row shapes. A row's role (bolt, dash, build, answer, hit, payoff, signature) comes from its shape; its metres and costs come from its row. Every plan answers first: Ring of Cinders against close pressure, Air Form against an aimed projectile, and Tide Ward against a beam on the Water side. Then:
- **Close (brawler):** holds 0.5-0.85 of its shortest hitter's reach and dashes in when far. It builds its resource with its short rows, cashes it with the strongest payoff at the resource's top threshold, and presses the dart once per decision.
- **Light (skirmisher):** holds 0.7-1.0 of the dart's reach and dashes out when pressed (Air also dashes to keep Momentum up). It alternates its damaging rows so a slow one and a fast one land together, and holds the dart down for a stream.
- **Heavy (controller):** holds 0.75-0.95 of its shortest unlocked payoff's reach. Until tier III it keeps its hands free for the ward while anything is seen coming. After that it casts the strongest unlocked payoff and banks the mana its next payoff needs.

**Measured (200 seeds per build):** every build lands 44-56% reference wins. fire_light wins all 18 of its fights that end before the reference's tier III. fire_heavy wins 55% and air_heavy 51% of the fights that reach tier IV. Close builds hold 4.4-5.5 m and spend 21-28% of their casts on hitters and dashes; light and heavy builds hold 8.2-8.8 m; heavy builds spend 7-15% on payoffs and signatures. Air Form never fires into another shape class: every cast that meets a threat meets a projectile.

**Open (structural):**
- Close duels end in 16-32 s, because both sides land everything at 5 m. *Addressed by D1's exchange windows (D1 6.1, `d1-exchange-after.json`): fire_close 67.0 s, air_close 50.7 s, both inside their bands. Brennic's named semifinal is now 63.0 s at 44.6% reference wins (2000 seeds, `d1-named-after*.json`).*
- Air's light build never gets a short fight at the final (0.9 darts, competence 1.5).
- Tide Ward and the beam rows sit on different collar tiers, so the beam answer never fires in play. *Still open (D1 6.4, `d1-counters.json`): none of the 783 beam blows on a Tide Ward holder is castable. Both D1 4.2 options were measured and declined. Holding Tide Ward past tier II makes 762 beams castable, but the reference never holds its 15 mana with the mend line free. D1 6.5 adds a Water plan that banks the mana and the line against a beam build. With the hold, it lifts coverage to 12.9%, but it drops two Mirror tide cells below the 40% floor (air_close 39.5%, air_heavy 38.0%), so it was declined. The limit left is when the AI casts the ward, not its price.* *D1 6.6 raised the ward at the rival's beam windup and measured windup + bank + held at 25.7% coverage (308 beam blows answered, 196 casts), but two Mirror tide cells fell under the 40% floor (air_close 39.5%, digest `0fe140e7`; air_heavy 32.0%, digest `3c0053af`), so it was declined. Tide Ward AI work stops at 6.6 (Director default 2026-10-24, owner to confirm), and the beam answer stays open as a structural item.*
- The reference player's chase keeps light and heavy builds at about 8.5 m instead of their bands.
- Defensive stats (focus, nerve) swing a duel by 30-45 points per rank, so builds stay within a rank of the reference's 1/1/1.

### WP3 as built: rank-5 ultimate forms

**Rule.** Spell ranks 1-4 add power only. Rank 5 keeps rank-4 power and adds the row's ultimate form, when the row has one. The owner's words: "4 levels power only, final 5th level an ultimate form with additional effect". Version 1 registers six forms: one signature row per archetype per school. Every other row's rank 5 is power only, and that includes all Water rows.

**Data.** The forms live in `progression.pc.json` under `spellRanks.ultimates.<spellId>` as `{ name, summary, effect, ...params }`. There are six effect kinds, each with exact parameters:
- `root` (rootS);
- `slow` (slowMult, slowS);
- `heat` (heatPerHit);
- `momentum` (momentumPerHit);
- `extraProjectiles` (count);
- `embers` (tickDamage, tickS, durationS).

`progression.ts` refuses a form at load if its effect is unknown, it has a missing or extra key, a number is out of range, or the row's canonical shape cannot carry the effect. A rival build may hold rank 5 only on a row with a form.

**Code.** Each school's release asks `actorUltimate(actor, spellId, state)` once. The answer is undefined below rank 5, for an unranked actor, and under canonical balance. The form then shapes the hit template:
- heat and momentum add to the payment on connect;
- root and slow tag the blow with `Hit.ultimate`, and the owner's `onHit` applies them through the kernel's own root and slow gates, only when damage got through without a perfect absorb;
- the two shape kinds change the fan's blade count or queue embers at a ground circle.

Nothing is added to a state that has no rank-5 cast, so the goldens, the default census and the CR-002/CR-007 parity suites step exactly as before.

| archetype | row | form | effect |
|---|---|---|---|
| Fire close | Flick Flame | Searing Hold | root 0.6 s |
| Fire light | Ember Dart | Kindling Darts | +2 Heat per connect |
| Fire heavy | Brand Wrath | Brand Drag | slow x0.5 for 0.4 s per tick |
| Air close | Shear | Pinning Edge (was Third Blade; D1 6.2) | root 0.3 s |
| Air light | Gale Dart | Headwind | slow x0.7 for 0.5 s |
| Air heavy | Cyclone | Eye-wall | root 0.3 s per tick |

**Judged by the builds census.** Each row was run at rank 4 and rank 5 inside its build, 200 seeds each; the rank override was temporary. The ultimate's own effect on the rival's win rate:
- Third Blade: +36.5 pp. Close fights go from 68% to 97% rival wins. (Replaced by Pinning Edge, D1 6.2.)
- Headwind: +5.5 pp. Tier IV share +6.8 pp.
- Searing Hold: +3.2 pp at 1000 seeds.
- Kindling Darts: short wins go from 20 to 26 at the same win rate.
- Eye-wall: +1 pp.
- Brand Drag: neutral, because the heavy plan rarely presses Wrath.

The first Fire heavy draft (Pyre embers) made the heavy win before tier IV: short fights went from 4 to 48 and the tier IV share fell. It read less like a heavy build, so it was moved to the tier IV beam. No rank-5 row was committed to rival-builds.json in WP3: rank-4 power alone already takes every build under the 40% reference floor except fire_heavy. Since D1 6.2, fire_heavy holds Brand Wrath at rank 5 (41.5% reference wins at 46.5 s), the only committed rank-5 row.

**Open.** Updated after D1's first slice (`d4676f1`):
- **Third Blade is gone.** It was overwhelming against a rank-4 reference: at rank 5, 0% reference wins. Shear's rank 5 is now Pinning Edge, a 0.3 s root. Its own effect is -1.5 pp against rank 4, with more short fights and more tier-IV wins, as a close build should get (D1 6.2, `d1-rank-air-close-air-shear-*.json`). `extraProjectiles` stays built and tested, but no row uses it.
- **The heavy plan now has a payoff sequence.** It spends its tier-IV payoff (Brand Wrath, Cyclone) first. Wrath casts per fight go from 0.40 to 0.45.
- **Brand Drag is still neutral** (42.0% -> 41.5% reference wins, rank 4 -> 5). Now the cause is measured: Wrath is cast about once per fight that reaches tier IV, because fights end about 10 s after tier IV opens and Wrath's cooldown is 20 s. A useful Brand Drag needs longer heavy fights or a cheaper tier-IV row (D1 6.2, `d1-payoff-sequence.json`).
- **Close duels trade now** (D1 6.1). An exchange window guards a defender's next close blows after a clean close hit. Hits per exchange fall from 2.29 to 0.61 (fire_close) and from 1.91 to 1.30 (air_close). air_close sits exactly on the 40% floor; D1 6.4 records it unchanged.
- **Counters** have a measured target (D1 6.4: N = 50% of the blows a row could answer; Director default, owner to confirm). Air Form meets it at 67.9%. Ring of Cinders (1.6%) and Tide Ward (no castable beam) do not. The Tide Ward bank (6.5) reaches 12.9% and breaks the floor, so it was declined.

### WP4 as built: Lab build pickers

Both Lab sides now pick a whole build: school (Water, Fire, Air), an archetype preset, vigor, focus, nerve and agility (ranks 1-5), a spell rank per row (1-5), and for Fire and Air the bolt plus four rows from the school's spellbook. Water keeps its three-line composition (the compose screen for the player, the preset for the rival) and ranks each line across its four collar tiers. The Lab's forecast duel runs on these picks, both on the Builds page (live on the draft) and in the Tuning panel.

**Model.** `LabConfig` gains optional `playerBuild` and `opponentBuild` (`LabBuild`: `ranks`, `spellRanks`, `loadout`, `plan`), checked by `labBuildProblems` in `arena/lab.ts`. The check covers ranks on the shared mapping, known spell-rank keys, the loadout through `validateLoadout` on the side's own school, and a plan that names a rival build whose bolt + 4 the loadout is. `createLab` sizes HP, mana and stamina from the ranks with the kernel's own formula, turns a Fire or Air loadout into a real school actor, and carries the spell ranks. With no build, nothing changes: the default Lab, the goldens and the census stay identical. An archetype preset loads a `rival-builds.json` build as a starting point. Its plan keeps running while the loadout is still that build's own; stats and ranks are free to edit.

**Pick memory.** The last pick per side is saved on every bout start (`localStorage` `mage-arena.lab-pick.v1.<side>`) and seeds the first setup of the next Lab session. A missing, unreadable or invalid record is ignored, and the Lab works without storage.

**Not in WP4.** The live HUD still labels a Fire or Air player's slots with Water names (the bout itself plays the school rows). Per-row Fire/Air tuning in the Lab, and Water ranks per tier in the picker, are also not covered.

### Campaign week sets the enemy level (owner 2026-10-23)
`prepareBout` (`packages/core/src/season.ts`) records `enemyLevel = min(6, ceil(day / daysPerWeek))` on the bout, omitted in week 1, and `startBout` passes it to `createGames`. The save schema accepts it as an optional integer 2-6. Bouts saved before this change have no key, so they replay as level 1 and their hashes are unchanged; a recorded level replays exactly (`packages/tools/src/season.test.ts`).
