# D1. Combat follow-up: close duels, ultimates, and the campaign progression curve

Status: **direction menu**; duel duration is **owner-confirmed 2026-10-25: `lag` plus rank defence 0.05 (`lag-def1`), behind the skill-book flag, off by default** (wired in 6.12). Written 2026-10-23 for future sessions. The section 5 slice is built (2026-10-24): exchange windows (6.1), the Third Blade rework and the heavy payoff sequence (6.2), and the week sweep reading (6.3). The 4.3 skill book is built behind an off-by-default flag, with its week curve (6.7, 2026-10-24). A mage-side lever for the week curve is measured as a reading (6.8, 2026-10-24). A small rival HP level on top of the recommended lag arm is measured and ruled out as the duel-duration lever (6.9, 2026-10-25). The two levers 6.9 named are measured on top of lag as a reading (6.10, 2026-10-25): rank-scaled exchange reach is ruled out; rank defence lengthens every short duel but does not close the gap alone, and 4.1 E is the next candidate. 4.1 E, the reference player's range, is measured as an off-by-default reading and ruled out (6.11, 2026-10-25): no arm meets the section 6 targets, so duel duration is now an owner question. The section 6 scorecard (goal 2) follows 6.11. It follows
`docs/concepts/combat-system-depth.md` (built and on main at `995fab3`). Start a session with
`/spark resume future-directions-concepts`, or spark one section of this doc as its own idea.

## 1. The owner's words

> "Followup to combat system to resolve close duels mechanisms and balancing of the campaign skill/spell/difficulty progress"

These still bind, from the combat-system-depth spark: builds, not triangles; any school can play any archetype; Agility
has no movement effect while VR is stationary; spell ranks 1-4 add power and rank 5 adds an ultimate form; regular
enemies level once per campaign week; rivals have authored builds.

## 2. Where things stand (measured)

| Area | Today | Evidence |
|---|---|---|
| Close duels | Brennic (fire_close) semifinal median **15.8 s** against a 45-75 s band, 47% reference wins; air_close 31.8 s | `npm --prefix packages/core run census:builds`; combat-system-depth doc, WP2 section |
| Why they are short | At about 5 m both sides land nearly every blow; extra rival HP raises its win share faster than it lengthens the fight | WP2 report |
| Light builds | fire_light wins all 18 of its fights that end before tier III; air_light gets **no** short fights (Gale Dart 0.9 damage) | builds census |
| Heavy builds | win 55% / 51% of fights reaching tier IV: the curve target is met only narrowly | builds census |
| Ultimates | Third Blade (Shear) rank 5 takes rival wins from 60.5% to **97%**; Brand Drag (Brand Wrath) does nothing measurable, because the heavy AI casts Wrath about 0.5 times per fight | WP3 report, `progression.pc.json` `spellRanks.ultimates` |
| Counters | Air Form answers projectiles reliably; Ring of Cinders is almost never cast (close duels end near its tier II unlock); Tide Ward never fires (it sits at tier II, every beam is tier IV) | WP2 report |
| Campaign progression | Stats train at camp on the 0;6;14;24;36 points curve; **nothing earns Agility or spell ranks yet**; enemy level = campaign week (`season.ts prepareBout`); only weeks 1-2 are playable | `stats.csv`, `season.ts`, `docs/campaign/season-and-time.md` |
| Difficulty by week | Wave 1 clear time 35.3 s (week 1), 44.9 s (week 3), 59.3 s (week 6) at matched agility 1; spell ranks equal to the week bring it back near 36 s | WP1 report |

## 3. Goals

1. A close duel is an **exchange**, not a race: readable trades, a reason to step out and step back in, median in band.
2. Each ultimate makes its archetype **more itself**, within the 40-65% band.
3. The six weeks feel like a **curve the player climbs**: what they earn each week roughly keeps pace with the enemy
   level, and a player who builds well pulls ahead.
4. Every number in this doc's answers comes out of the census, not out of hand-tuning.

## 4. Candidate directions

### 4.1 Close-duel mechanics (pick one or two)

| Option | What changes | Trade-off |
|---|---|---|
| **A. Exchange windows** (recommended first) | A close hit grants the defender a short punish window: their next close row is faster or their ward re-raises at once. Trades alternate instead of stacking. | New rule in kernel or school code; must stay neutral for Water and the VR parity suites. |
| B. Spacing pressure | Close builds lose Heat/flow when they stay inside 3 m too long; a back-step re-arms them. | Adds a timer the player has to read; needs HUD support (D3). |
| C. Poise and stagger | Close blows build poise damage; a broken guard staggers. Heavy hits trade HP for tempo. | Touches the shared hit path; risk to the Water golden replays. |
| D. Earlier Ring of Cinders | Move Ring's unlock or cost so the counter to close pressure exists inside a close duel. | Data only (overlay), but it changes the canonical numbers VR pins: a VR change request. |
| E. Reference player range | The census reference chases to its own 5-8 m band; let it play its archetype distance, so the census measures real spacing. | Changes every census baseline; re-pin with a reason. |

### 4.2 Ultimates and counters

- **Third Blade**: replace the third projectile with a control effect (a short root or slow on Shear), or keep the blade
  and lower Shear's rank-5 power. Measure both, keep the one inside the band.
- **Brand Drag and the heavy AI**: the heavy plan picks its strongest spell (Pyre). Give the heavy plan a **payoff
  sequence** that spends its tier-IV row when it unlocks, then re-judge Brand Drag.
- **Unused effect kinds**: lingering fire and the Momentum grant are built and tested but unused. Use them in a second
  ultimate pass or delete them.
- **Tide Ward**: either move beam answers to a row Water has early, or give Tide Ward a second answer class.
- **Counter coverage target**: from the ledger, each defensive row answers its shape class in at least N% of the
  contacts it could answer. N is set from the first measurement, not guessed.

### 4.3 Campaign progression curve

**Chosen design (owner ruling 2026-10-24, section 7 question 2).** Spell ranks are earned outside combat, not from Games
results:
- **Skill points.** Training at camp, and the other non-combat camp activities, award skill points. Training pays most.
  The award per activity is data.
- **Ranks in any spell.** The player spends skill points on the next rank of any spell they know: every row of their own
  school, plus any signature a teacher has taught them. Ranks keep their meaning (1-4 power, 5 the ultimate form).
- **Rising cost.** The next rank costs more at each rank and at each collar tier. The cost is a table (rank x tier) in a
  PC data file, not numbers in code.
- **Teachers.** Each school's elder teaches that school's signature spell, but only when the relationship check passes:
  the elder's trust in the player, the camp's existing `trust` state (the one befriending, confiding and parley move),
  is at or above a threshold. No second relationship state.
- Built 2026-10-24 behind an off-by-default PC flag, in memory only (no save schema change), with a per-week award scale
  so a steady trainer tracks the "N - 0.5" target. See 6.7.
- 2026-10-25: the book now rides on the season save as an optional key, a flag-on season banks each settled camp day into
  it, and `prepareBout` records the player's bought ranks on the bout (flag still off; 6.7, "On the season").
- The rest of this table still stands.

| Question | Options |
|---|---|
| How does the player earn **spell ranks**? | **Chosen: skill points from training and non-combat activities, spent on ranks (above).** Not chosen: points from Games results; Games results unlock and camp spends |
| How does the player earn **Agility**? | train at the yard on the shared points curve (as `stats.csv` implies), competing with vigor for yard time |
| How fast? | target: by week N the average spell rank is about N-0.5 for a player who trains steadily, so they sit just under the enemy level and catch up by building well |
| Spellbook growth | new rows join the spellbook by mastery or as Games rewards; the bolt + 4 pick stays |
| Weeks 3-6 | they run headless today; making them playable is shared with D3 |

### 4.4 Difficulty curve and the census

- Add a `--week` sweep to `census:builds` and the default census: each week runs at `enemyLevel = week` with a
  **progression profile** (expected ranks for that week).
- Targets per week: reference win rate and median per wave, with the bands from `arena-tiers.json`.
- A progression profile is data (`progression.pc.json` or a sibling), so the curve can be tuned without code.
- Report the curve as a table: week x wave x archetype -> win rate and median.

## 5. Recommended first slice

1. **Exchange windows (4.1 A)** for close duels, measured on fire_close and air_close plus one far build that should not
   change.
2. **Third Blade rework and the heavy payoff sequence (4.2)**, judged by the builds census.
3. **The week sweep (4.4)** as a reading only, so the progression design (4.3) starts from numbers.

## 6. How success is measured

- Close builds: median inside 45-75 s, reference wins 40-65%, and the hits-per-exchange rate falls.
- Ultimates: every committed rank-5 build stays inside the band and moves its curve signature the right way.
- Counters: each defensive row reaches its coverage target in the ledger.
- Progression: a week-by-week table in which a steadily training player wins 50-65% each week and a player who does not
  train falls below 40% by week 4.
- Unchanged: goldens, default census digests and CR-002/CR-007 parity, unless a slice re-pins them with a reason.

### 6.1 Slice step 1 as built: exchange windows (4.1 A), 2026-10-24

**Rule** (`packages/core/src/arena/exchange.ts`, numbers in `school-balance.pc.json` `exchange`). A clean hit (damage
through, no ward) delivered from `closeRangeM` 5 m or closer opens the defender's window against that attacker. For
`guardS` 8 s the defender's ward re-raises at once against the attacker's next `guardHits` 8 close blows: each lands
guarded with `guardReduction` 0.95 of it stopped, the way a held ward stops a blow. A blow from beyond 5 m, an unblockable
blow, or a blow from another attacker is not guarded. The window is rule state on the actor (`Actor.exchange`), read on
the existing hit path: no new sim event kind, and the guard shows as the `guarded` flag of the `hit` it blocks.
A window opens only in a contact a Fire or Air actor takes part in, and a `balance: 'canonical'` state ignores the rule.
So Water-only states and the parity suites never carry the key. With `--exchange off` the census runs the rule switched
off and nothing else changes.

The other punish the option names, a faster next cast, was built and measured, then left out. At 0.5x or 0.6x cast time
it moved the reference win rate down by 5-9 points on the close builds (fire_close 46% to 37% at 100 seeds), because the
rival rows have long casts and the reference's dart has almost none. Two other forms were also measured and dropped:
- a guard that ends when the defender answers took fire_close to 1-12% reference wins;
- a guard sized on the opening blow's damage favoured a rival that opens with a dart and follows with a big blow.

**One build change.** Longer close duels amplify a build's small edge: the favourite wins more often over more blows. With
the rule alone, air_close's reference win rate fell to 32% (median 47.7 s). air_close's Shear rank goes from 2 to 1
(`rival-builds.json`, PC-authored), which puts it back at 40%. No canonical or overlay spell number changed.

**Census** (`npm --prefix packages/core run census:builds`, 200 seeds per build; evidence in
`docs/change-requests/evidence/d1-exchange-before.json` (main) and `d1-exchange-after.json`). The median is in seconds.
"Hits/exch." is the new census column `hitsPerExchange`: one exchange is one side's run of landed blows until the other
side lands one, and the count is the blows in it that went through unguarded.

| Build | Median s (45-75 / 45-80) | Reference wins (40-65%) | Hits/exch. | Short fights | Tier IV fights |
|---|---|---|---|---|---|
| **fire_close** | 15.8 -> **67.0** | 47.0% -> 49.5% | 2.29 -> **0.61** | 200 -> 6 | 0 -> 167 |
| **air_close** | 31.8 -> **50.7** | 52.5% -> 40.0% | 1.91 -> **1.30** | 75 -> 0 | 4 -> 144 |
| **air_heavy** (the far build held unchanged) | 73.9 -> 75.8 | 46.0% -> 46.5% | 2.93 -> 2.93 | 0 -> 0 | 187 -> 187 |
| fire_light | 52.8 -> 54.0 | 45.5% -> 50.5% | 2.49 -> 2.45 | 18 -> 19 | 144 -> 154 |
| fire_heavy | 46.1 -> 46.5 | 43.5% -> 42.5% | 2.73 -> 2.68 | 1 -> 0 | 115 -> 126 |
| air_light | 63.5 -> 63.5 | 55.5% -> 56.5% | 2.71 -> 2.66 | 0 -> 0 | 191 -> 192 |

Both close builds are now inside their median band and the win-rate range, and hits per exchange falls on both
(0.61 and 1.30, from 2.29 and 1.91). air_close sits exactly on the 40% floor; that is the reading, not a margin. The far
builds hold within the 200-seed noise, but **their digests are not identical**: the reference chases them into 5-8 m, and
a few contacts per fight land inside 5 m (air_heavy 71e58951 -> 767c6f68). The named census
(`census:named`, 2000 seeds, `docs/change-requests/evidence/d1-named-after*.json`) moves Brennic's semifinal from a median
of 16.5 s to **63.0 s** (inside 45-75) at 44.6% reference wins (from 55.2%), and the gate now passes with both duels in
band. Lio's final holds: 63.6 s -> 64.2 s, 59.3% -> 57.6%.

**Pins.** Golden replays, CR-002/CR-007 parity and the default census are unchanged. `report:w4`'s loop (`runFight`, 2000
seeds per wave) reproduces all four `w8x.json` wave digests exactly. Two things change because the close duels changed,
and both are written down here and in the commit:
- `named-census.test.ts` no longer pins Brennic's semifinal under its band; it now asserts the median is in band;
- the named and builds census digests differ, and new evidence is filed under `docs/change-requests/evidence/`. The
  older `docs/waves/W8-evidence/named*.json` files stay as the pre-D1 record.

### 6.2 Slice step 2 as built: Third Blade rework and the heavy payoff sequence (4.2), 2026-10-24

Each ultimate is judged inside its own build, as WP3 judged them. The row runs at rank 4 and at rank 5 with every
other number held (`census:builds -- --only <build> --ranks <build>:<spell>=<rank>`, 200 seeds, exchange windows on).
Evidence: `docs/change-requests/evidence/d1-rank-*.json`. The Third Blade variants were run through the same census
runner with the form planted for that run only.

**Third Blade (air_close, Shear).** Reference wins at Shear rank 4 are 17.5% (median 42.3 s). Rank-4 power alone takes
the build out of the band, as WP3 found for most rows.

| Shear rank 5 form | Reference wins | Median s | Ultimate's own effect (vs rank 4) |
|---|---|---|---|
| Third Blade (+1 blade), as shipped by WP3 | 0.0% | 26.3 | -17.5 pp: overwhelming |
| Third Blade, blade damage cut so 3 blades = 2 rank-4 blades (x0.867) | 6% | 38.3 | -11.5 pp: the third blade still lands more often than it costs |
| Third Blade, blade damage x0.65 (3 blades ~ 2 rank-1 blades) | 24% | 47.2 | +6.5 pp: the rank buys less than rank 1 |
| slow x0.6 for 0.6 s | 15% | 41.3 | -2.5 pp |
| **root 0.3 s (kept: "Pinning Edge")** | **16.0%** | **41.8** | **-1.5 pp**; short fights 16 -> 20, rival share at tier IV 68% -> 73% |

To keep the blade, its power would have to fall to rank-1 level before rank 5 stopped dominating, so the blade cannot be
tuned into the band. The root keeps the doc's control option. Like Searing Hold, its own effect is small, and it pushes
the close build the way a close build should go: more short fights, more tier-IV wins. `progression.pc.json` now
registers `air_shear` as Pinning Edge (root 0.3 s). The `extraProjectiles` effect kind stays built and tested (with a
planted form), but no row uses it.

**Heavy payoff sequence.** The heavy plan now orders its ready payoffs by collar tier first, then by weight. At tier IV it
spends Brand Wrath or Cyclone before Pyre or Squall, and it keeps the mana its next payoff needs, as before. Wrath casts
per fire_heavy fight go from 0.40 to 0.45 (a 40-seed reading). With Wrath still at rank 2 the builds hold: fire_heavy
42.5% -> 43.0% at 46.5 s, air_heavy 46.5% -> 46.0% at 75.3 s (`d1-payoff-sequence.json`). A stronger sequence was also
built and measured: the newest-tier payoff before the signature. It starved Sunfall (0.30 -> 0.17 casts per fight) and
took fire_heavy to 34% reference wins, out of the band, so it was not kept.

**Brand Drag re-judged.** At Wrath rank 4 the reference wins 42.0%; at rank 5, 41.5%. The rival's tier-IV share moves
from 52.8% to 53.5%. That is still neutral, but now the cause is measured. Wrath is cast about once in each fight that
reaches tier IV: fights end about 10 s after tier IV opens, and Wrath's cooldown is 20 s. So no plan change can press it
more often. A useful Brand Drag needs longer heavy fights or a cheaper tier-IV row, which is a 4.2 follow-up.

**Committed rank-5 builds.** fire_heavy now holds Brand Wrath at rank 5 (`rival-builds.json`; it was rank 2). It is the
only committed rank-5 row, and it stays inside the band.

| Build (committed, 200 seeds) | Median s | Reference wins | Tier IV fights (rival share) |
|---|---|---|---|
| fire_close | 67.0 | 49.5% | 167 (44%) |
| fire_light | 54.0 | 50.5% | 154 (36%) |
| fire_heavy (Brand Wrath rank 5) | 46.5 | 41.5% | 127 (54%) |
| air_light | 63.5 | 56.5% | 192 (42%) |
| air_close | 50.7 | 40.0% | 144 (57%) |
| air_heavy (payoff sequence) | 75.3 | 46.0% | 185 (50%) |

Evidence: `docs/change-requests/evidence/d1-ultimates-after.json`. Nothing in this step touches Water, parity or the
default census.

### 6.3 Slice step 3: the week sweep (4.4), a reading only, 2026-10-24

`npm --prefix packages/core run census:weeks` (new) runs every campaign week at `enemyLevel = week`. It covers the four
default-census Tiro waves (report-w4's reference player) and the six rival builds, 200 seeds per cell, with the slice's
steps 1-2 in place. The reference player's spell ranks come from a progression profile, which is data:
`packages/core/src/arena/data/progression-weeks.pc.json`. Each week holds an average rank over the bolt and every line
row; a .5 alternates the two ranks around it.
- `untrained` stays at rank 1.
- `steady` follows the 4.3 target "about N - 0.5 by week N": 1, 1.5, 2.5, 3.5, 4.5, then 5 (capped).
- Stats and agility stay at 1/1/1: no camp earns agility yet.

Week 1 of either profile is the plain census fight, hash for hash (`week-census.test.ts`). Evidence:
`docs/change-requests/evidence/d1-weeks.json`. **Nothing was tuned from this table.**

Waves 1-2 show the reference's median in seconds (it wins all of them). Waves 3-4 show reference wins / median. The
builds column lists reference wins in the order fire_close, fire_light, fire_heavy, air_light, air_close, air_heavy.

| Profile | Week | Avg rank | W1 s | W2 s | W3 semifinal | W4 final | Builds | Builds mean |
|---|---|---|---|---|---|---|---|---|
| untrained | 1 | 1 | 35.3 | 42.6 | 89% / 40.1 | 54% / 49.2 | 50 51 42 56 40 46 | 47% |
| untrained | 2 | 1 | 41.2 | 47.6 | 89% / 40.1 | 54% / 49.2 | 50 51 42 56 40 46 | 47% |
| untrained | 3 | 1 | 44.9 | 52.2 | 89% / 40.1 | 54% / 49.2 | 50 51 42 56 40 46 | 47% |
| untrained | 4 | 1 | 49.7 | 56.2 | 89% / 40.1 | 54% / 49.2 | 50 51 42 56 40 46 | 47% |
| untrained | 5 | 1 | 54.9 | 60.9 | 89% / 40.1 | 54% / 49.2 | 50 51 42 56 40 46 | 47% |
| untrained | 6 | 1 | 59.3 | 65.3 | 89% / 40.1 | 54% / 49.2 | 50 51 42 56 40 46 | 47% |
| steady | 1 | 1 | 35.3 | 42.6 | 89% / 40.1 | 54% / 49.2 | 50 51 42 56 40 46 | 47% |
| steady | 2 | 1.5 | 36.8 | 44.0 | 93% / 37.3 | 68% / 46.1 | 55 56 56 75 47 52 | 57% |
| steady | 3 | 2.5 | 36.4 | 44.6 | 98% / 34.6 | 82% / 43.4 | 67 65 64 75 61 66 | 66% |
| steady | 4 | 3.5 | 36.9 | 43.3 | 99% / 31.3 | 92% / 40.5 | 74 64 75 85 73 64 | 72% |
| steady | 5 | 4.5 | 39.0 | 46.4 | 99% / 31.1 | 93% / 39.8 | 72 66 77 87 77 59 | 73% |
| steady | 6 | 5 | 42.7 | 51.4 | 99% / 31.1 | 93% / 39.8 | 72 66 77 87 77 59 | 73% |

No cell timed out. The reading, for the progression design (4.3) to start from:
- **Only regular enemies feel the week.** An untrained player's mage waves and rival duels are the same every week,
  because mages and rivals are not levelled. So the "falls below 40% by week 4" target cannot happen. What the untrained
  player loses is time: wave 1 goes from 35.3 s to 59.3 s, and wave 2 from 42.6 s to 65.3 s, past its band by week 6.
- **Steady ranks overshoot the duels.** With nothing levelling the mages, a steady player passes the 50-65% target from
  week 3 (66% across the builds), and reaches 72-73% from week 4. The final goes from 54% to 93%.
- **Steady ranks hold the regular waves level.** Wave 1 stays at 35-39 s through week 5, as WP1 measured.
- **Rank 5 adds nothing to Water.** Weeks 5 and 6 are identical in the mage cells, because Water rows have no ultimate
  forms and rank 5 power equals rank 4. A Water player's rank 5 buys only power on the regular waves.
- So the progression curve needs a lever on the mage side as well as the enemy-level one: rivals that level by week, or
  authored builds per week. That decision belongs to 4.3 and the owner, not to this reading.

### 6.4 Counter coverage (4.2): the first reading, the target, and Tide Ward, 2026-10-24

**Reading** (`npm --prefix packages/core run census:counters`, new; 200 seeds per cell; evidence
`docs/change-requests/evidence/d1-counters.json`, 2026-10-24). The model has one shape-class answer row per school:
Ring of Cinders (close pressure), Air Form (projectiles) and Tide Ward (beams). Water's other defensive rows (Sheen,
Reflection/Ripple, Mirage, Fog Bank) answer no shape class, so they have no coverage to read. The runner reads the
threat-answer ledger (`ledger.ts`) of every mage that slots an answer row. A unit is one ledger entry: a graded contact,
or an aimed threat that the mage avoided. A unit counts for a row when its shape class is one the row answers and the
blow is blockable. The runner never writes, and every cell's digest equals its census digest (the builds cells equal
`d1-ultimates-after.json`). Cells:
- the four default-census waves (reference preset Rotation);
- the six builds against Rotation (the committed builds census);
- the six builds against Mirror tide, the supplement that slots Tide Ward. Rotation does not slot the mend line.

- **Slotted**: blows of the row's class that the holder met while it carried the row.
- **Castable**: blows met while the row could be cast by collar tier. This is the "could answer" of 4.2 and the
  coverage denominator. A Fire or Air row stays unlocked once its tier opens. A Water line plays one row per tier, so
  Tide Ward (mend II) is castable only while its holder sits at tier II.
- **Answered**: the row's effect was up at the blow (Air Form's evade window, Tide Ward's drain cut), or the holder
  released the row between first seeing the blow and its contact. Ring of Cinders is an instant blast and answers only
  this second way.

| Row (class) | Cell (holder) | Slotted | Castable | Answered | Coverage | Casts |
|---|---|---|---|---|---|---|
| Ring of Cinders (close) | fire_close (rival) | 1067 | 678 | 12 | 1.8% | 133 |
| | fire_close, Mirror tide | 914 | 716 | 11 | 1.5% | 161 |
| | fire_heavy, both presets | 15 | 3 | 0 | - | 30 |
| | **all cells** | **1996** | **1397** | **23** | **1.6%** | 324 |
| Air Form (projectile) | air_close (rival) | 20076 | 13629 | 8327 | 61.1% | 1491 |
| | air_close, Mirror tide | 21564 | 15278 | 9437 | 61.8% | 1657 |
| | air_heavy (rival) | 22489 | 17688 | 12780 | 72.3% | 2632 |
| | air_heavy, Mirror tide | 22278 | 17723 | 13113 | 74.0% | 2540 |
| | **all cells** | **86407** | **64318** | **43657** | **67.9%** | 8320 |
| Tide Ward (beam) | the Mirror tide reference vs fire_heavy / air_close / air_heavy | 104 / 16 / 663 | 0 | 0 | - | 1 |
| | default wave 4 (the Mirror tide final opponent) | 0 | 0 | 0 | - | 0 |
| | **all cells** | **783** | **0** | **0** | **none castable** | 1 |

What the reading says:
- **Air Form is the one answer that works as designed.** It answers 61-74% of the projectiles it could, in every cell.
  About a third of the blows it answers still land, because the evade is a chance (30% of magic).
- **Ring of Cinders almost never answers a blow (1.6%).** It is cast 324 times, almost all of them when a body is inside
  its reach (the plan's "pressed" branch), not in reply to a seen close blow. fire_heavy meets almost no close blows. The
  fix (4.1 D) is out of scope here; this is the measurement.
- **Tide Ward never meets a beam it can cast against.** 783 beam blows hit a mage that slots the mend line, and all 783
  arrive after tier II, when the line plays Spring or Font. This confirms the structural cause section 2 named.

**Proposed target N = 50%** (Director default 2026-10-24, owner to confirm). Each answer row should answer at least
half of the blows of its class that it could have answered, in every cell where it meets them. A row that meets blows of
its class it can never cast against (castable 0 while slotted > 0) fails the target outright. Why 50:
- Air Form, the one counter that works as designed, clears it in every cell by 11 points or more (61.1% lowest);
- so the bar is reachable and not set at the edge of the 200-seed noise;
- it still marks Ring (1.6%) and Tide Ward (none castable) as not yet counters.

Today Air Form meets the target. Ring of Cinders and Tide Ward do not.

**Tide Ward: both 4.2 options built and measured, neither kept.** Both were built as PC-only code driven by an overlay
block (`counters` in `school-balance.pc.json`, read by a new `arena/counters.ts`). Each was measured with the same reader,
200 seeds per cell; `census:counters -- --tide-ward <arm>` plants an arm for one run. Evidence: the `tideWardOptions` block
of `d1-counters.json` and `d1-counters-tw-{off,held,projectile,close,line}.json`. The code is kept as
`docs/change-requests/evidence/d1-tide-ward-options.patch` (it applies with `git apply` on the commit that adds it), not
in the tree.
- **A, the answer moves to a row Water has early (`held`).** From tier III on, while an enemy beam runs, the mend slot plays
  Tide Ward with its own numbers and the line's cooldown.
- **B, a second answer class.** A Water defender facing a build also casts Tide Ward at the second class: projectiles
  (the class with the most blows), close or line.
- In both arms the Water AI presses a castable Tide Ward ahead of a planned raise, as a build's plan answers first.
  Without this, the raise takes every gap between a beam's ticks.
- With both code paths in place and the rule off, all 16 cell digests equal the reading above.

| Arm | Tide Ward blows of its classes (slotted) | Castable | Answered | Coverage | Casts | Mirror tide cells that moved |
|---|---|---|---|---|---|---|
| today (off) | 783 beam | 0 | 0 | none castable | 1 | none (all 16 digests equal) |
| **A** held | 774 beam | **762** | 0 | **0.0%** | 1 | fire_heavy 26.0% -> 26.5% (46.2 -> 46.1 s); air_heavy 73.5 -> 73.4 s |
| **B** + projectile | 92895 (92118 projectile) | 23169 | 6 | **0.03%** | 2 | air_heavy 50.0% -> 49.5% |
| B + close | 5318 | 897 | 1 | 0.1% | 1 | none |
| B + line | 1476 | 457 | 0 | 0.0% | 1 | none |

**Why neither lifts coverage.** A fixes the tier gap: 762 of 774 beam blows become castable. But Tide Ward is still
cast once in all 1400 holder fights. A probe (`tide-ward-probe.ts`, in the patch; 200 seeds per beam build, A planted)
read the reference at the start of each aimed beam. Over 1032 beam starts, it **never** had both:
- Tide Ward's 15 mana: it had it at 114 starts, with a median of 3.3 mana against air_heavy and 13.6 against fire_heavy;
- the mend line off cooldown: it was free at 337 starts. Spring and Font share the line, and Font's cooldown is 30 s.

The reference spends its pool on Rain Needles down to 3-6 mana, so under B it cannot afford Tide Ward at tier II either.
The beam answer is therefore blocked by mana and by the shared line cooldown, not only by the collar tier. A data move
cannot unblock it. It needs a Water plan that banks Tide Ward's mana when it faces a beam build, or a cheaper Tide Ward
row (a canonical number, so a VR change request). Both are 4.2 follow-ups.

**Bands.** Neither arm moves a Mirror tide cell by more than 0.5 points or 0.1 s, so neither breaks a band. One cell is
outside its band in every arm, today's included: Mirror tide against fire_heavy wins 26.0%. That is the supplement
preset's own reading, not an effect of either arm. **Verdict: both declined, neither kept.** No game code, overlay key or
canonical number changes, so there is nothing to return to VR and no CR-009. Goldens, the default census digests and
CR-002/CR-007 are untouched: this step changes no code.

**Margin note: air_close on the 40% floor (6.2).** No counter change moved it. In the committed builds census,
air_close holds **40.0%** reference wins at a 50.7 s median (200 seeds; digest `ff684a89`, equal to
`d1-ultimates-after.json`). Every Tide Ward arm gives the same figures and the same digest: the Rotation reference does not
slot the mend line, and Air Form's 61.1% coverage is unchanged. Against the Mirror tide supplement air_close gives 49.0% at
54.5 s in every arm. It still sits exactly on the floor, and it was not tuned here.

### 6.5 Tide Ward: a Water plan that banks the answer (4.2 follow-up), 2026-10-24

**What was built.** 6.4 named the blocker: at a beam start, the Mirror tide reference never had Tide Ward's 15 mana and a
free mend line at the same time. This step builds the follow-up 6.4 named, as PC AI only: **the bank**. While Tide Ward can
answer a beam, the Water AI keeps its mana and its line. That holds when the reference slots the mend line and sits at
tier II (or past it, if option A holds the ward). The rule needs a beam build whose collar has opened its beam row (Brand
Wrath, Cyclone: tier IV). While it holds:
- no row may spend below Tide Ward's 15 mana. This covers Rain Needle (3 mana), the row that drained the pool in 6.4;
- the mend line plays only Tide Ward, and only at a seen aimed beam. Spring and Font would hold the line's cooldown
  (Font's is 30 s).

The AI reads the opponent the way it already does (`facesBuild`). It sees the rival's build and the rival's collar, never
the rival's cooldowns. The rule is gated by a new overlay key, `counters.tideWardBank` in `school-balance.pc.json`, off by
default and ignored under canonical balance (parity). Option A comes back from the 6.4 patch as `counters.tideWardHeld`.
6.4's option B was declined, so it is not carried. Arms: `census:counters -- --tide-ward off|bank|held-bank`. 200 seeds
per cell (40000-40199), the same 16 cells and presets as 6.4. Evidence: `d1-counters-bank-{off,bank,held-bank}.json` and
the probe `d1-tide-ward-bank-probe.json`. The code is kept as `docs/change-requests/evidence/d1-tide-ward-bank.patch`
(it applies with `git apply` on the commit that adds it, with its tests `counters.test.ts`), not in the tree.

| Arm | Tide Ward slotted | Castable | Answered | Coverage | Casts | Mirror tide cells that moved |
|---|---|---|---|---|---|---|
| today (off) | 783 | 0 | 0 | none castable | 1 | none (all 16 digests equal `d1-counters.json`) |
| bank alone | 783 | 0 | 0 | none castable | 1 | air_heavy digest only (`cfa07c05` -> `3d64e31f`), 50.0% at 73.5 s, unchanged |
| **bank + A (held)** | 1240 | **1237** | **160** | **12.9%** | 161 | fire_heavy, air_close, air_heavy (below) |

bank + A per cell: fire_heavy 238 castable, 10 answered (4.2%), 9 casts; air_heavy 997 castable, 150 answered (15.0%),
151 casts; air_close 2 castable, none answered. Other rows under bank + A: Air Form 67.7% (67.9% today), Ring of Cinders 1.6%
(unchanged).

Water's win rates (reference wins, median, 200 seeds; band: the 40-65% win target and the wave's duration band):

| Cell | today | bank alone | bank + A |
|---|---|---|---|
| Mirror tide vs fire_heavy | 26.0%, 46.2 s (`da8bad4f`) | same | **24.0%**, 46.4 s (`2af5a3f8`) |
| Mirror tide vs air_close | 49.0%, 54.5 s (`7b037b7e`) | same | **39.5%**, 57.7 s (`6d61e93b`): below 40% |
| Mirror tide vs air_heavy | 50.0%, 73.5 s (`cfa07c05`) | 50.0%, 73.5 s (`3d64e31f`) | **38.0%**, 73.9 s (`c0cb46c2`): below 40% |
| Mirror tide vs fire_close / fire_light / air_light | 50.5% / 46.5% / 65.0% | same | same (digests equal) |
| default waves 1-4 (Rotation; wave 4 is the Mirror tide opponent, not a build) | 100 / 100 / 88.5 / 53.5% | same | same (digests equal) |
| builds census (Rotation, `census:builds`): air_close | 40.0%, 50.7 s (`ff684a89`) | same | same |

The builds census runs the Rotation reference, which does not slot the mend line, so no arm can move it. Its six cells hold
their `d1-ultimates-after.json` digests in every arm. air_close stays exactly on its 40.0% floor there.

**What the reading says.**
- **Banking alone does nothing.** Without A, Tide Ward is castable only at tier II. A beam row opens at the rival's tier
  IV, by which time the reference's own collar has moved past tier II. The two conditions almost never meet, so the bank
  almost never runs. Its one trace is the moved air_heavy digest, with equal figures.
- **Bank + A unblocks the cost.** The probe (A planted, 200 seeds per beam build) read the reference at each aimed beam
  start. With both mana and a free line it found 722 of 1475 starts, against 0 of 1032 under A alone (6.4). The median mana
  at a beam start rose from 3.3 to 15.6 against air_heavy.
- **Even then, Tide Ward answers little.** Of those 722 starts, the reference released the ward 160 times, and each cast
  covered about one beam blow. Under A and the bank, 150 of the 761 beam blows on it landed while the ward was up (air_heavy).
  Mana and the line are no longer the limit. What is left is the cast: of the 160 releases, only 71 came while an aimed beam
  was in view. The ward goes up on the decision cadence after a beam is seen, and the probe points to that timing.
  Coverage, at 12.9%, is still far below the proposed N = 50%.
- **The bank costs Water fights.** Holding 15 mana stops Rain Needle below 18 mana, so the likely cause is the damage the
  reference no longer deals. Against the two Air beam
  builds the reference loses about 10 points: air_close 49.0% -> 39.5% and air_heavy 50.0% -> 38.0%. Both fall below the
  40% floor. Against fire_heavy, already outside its band at 26.0%, it falls to 24.0%.

**Verdict: declined.** Coverage rises (none -> 12.9%), but two Mirror tide cells break the 40% floor, so the rule fails
the keep test (coverage up materially, no band broken, air_close not below 40%). Both overlay keys stay out of the tree,
with the code in the patch. No game code, overlay key or canonical number changes. Goldens, the default and builds census
digests, and CR-002/CR-007 are untouched, and there is nothing to return to VR.

**No change request.** A cheaper Tide Ward row (a canonical number) is not the only fix left, so it is not proposed. The
bank already makes Tide Ward affordable with its line free at half the beam starts, and coverage stays at 12.9%. The gap
is in when the AI casts, which a lower price would not change. A cheaper row would only shrink the bank's damage cost. The next
step, if any, is the timing: a Water answer that raises Tide Ward at the beam's cast (the rival's windup is a seen threat)
instead of during the channel. It should be measured with the bank and A, by the same arms.

### 6.6 Tide Ward at the beam windup (4.2 follow-up), 2026-10-24

**What was built.** 6.5 ended on one lever: the timing. Raise Tide Ward at a rival beam's windup instead of during the channel,
and measure it with the bank and option A by the same arms. The 6.5 patch was re-applied (`git apply`, clean) and a third PC-only
overlay key added, `counters.tideWardWindup` (off by default, ignored under canonical balance). While it is on:
- the cue is the windup. A rival beam's pending cast aimed at the Water mage is a seen threat under its own activation id; a running
  channel is seen under minus its owner's id. First sight of the windup sets a cue, due once the mage's own reaction delay has run
  from that sight;
- at the cue the AI presses a castable Tide Ward at once, off its decision cadence (the same press 6.5 used, ahead of a planned raise);
- the cue lasts one decision cadence. A ward that cannot go up in that time is not raised later in the channel, and a beam first
  seen in its channel cues nothing. With the key on, the cadence path casts the ward only at a live cue, never at a channel alone.

The windup itself is short (Brand Wrath and Cyclone: 0.20 s cast) and the reference's reaction delay is longer, so the ward goes up
just after the channel opens. It goes up on a fixed delay from the windup, though, not on whichever decision follows a beam. The
rule is deterministic: it reads only the seen threats and the mage's own reaction delay, and it keeps its cue in the mage's
brain state. Arms: `census:counters -- --tide-ward off|held-bank|windup|windup-held|windup-bank-held`, 200 seeds per cell
(40000-40199), the same 16 cells and presets as 6.4-6.5. Evidence: `d1-counters-windup-{off,held-bank,windup,windup-held,windup-bank-held}.json`,
the probe `d1-tide-ward-windup-probe.json` (6.5's probe, extended to the windup arms). The bank + held arm reproduces 6.5 exactly
(12.9%, 161 casts; Mirror tide air_close 39.5%, air_heavy 38.0%, digests `6d61e93b`, `c0cb46c2`), as a sanity check.

| Arm | Tide Ward slotted | Castable | Answered | Coverage | Casts |
|---|---|---|---|---|---|
| off | 783 | 0 | 0 | none castable | 1 |
| bank + held (6.5) | 1240 | 1237 | 160 | 12.9% | 161 |
| windup alone | 783 | 0 | 0 | none castable | 1 |
| windup + held | 774 | 762 | 0 | 0.0% | 1 |
| **windup + bank + held** | 1204 | **1198** | **308** | **25.7%** | 196 |

windup + bank + held per cell: fire_heavy 239 castable, 25 answered (10.5%), 20 casts; air_heavy 957 castable, 283 answered
(29.6%), 175 casts; air_close 2 castable, none answered. windup + held per cell: fire_heavy 102, air_close 15, air_heavy 645
castable, none answered. Other rows under windup + bank + held: Air Form 67.6% (67.9% off), Ring of Cinders 1.6% (unchanged).

Mirror tide win rates (reference wins, median, 200 seeds; band: the 40-65% win target and the wave's duration band):

| Mirror tide vs | off | bank + held | windup alone | windup + held | windup + bank + held |
|---|---|---|---|---|---|
| fire_heavy | 26.0%, 46.2 s | 24.0%, 46.4 s | 26.0%, 46.2 s | 26.5%, 46.1 s | **25.0%**, 46.4 s (`e392f881`) |
| air_close | 49.0%, 54.5 s | **39.5%**, 57.7 s | 49.0%, 54.5 s | 49.0%, 54.5 s | **39.5%**, 57.7 s (`0fe140e7`): below 40% |
| air_heavy | 50.0%, 73.5 s | **38.0%**, 73.9 s | 50.0%, 73.5 s | 50.0%, 73.4 s | **32.0%**, 75.5 s (`3c0053af`): below 40% |
| fire_close / fire_light / air_light | 50.5 / 46.5 / 65.0% | same | same | same | same (digests equal) |

- **Default waves 1-4** (Rotation): 100 / 100 / 88.5 / 53.5% and their digests in every arm.
- **Builds census** (Rotation, the `builds` cells of the same runs; `census:builds` on the final tree gives the same figures):
  air_close **40.0%**, 50.7 s, digest `ff684a89` in every arm.
- Under the three windup arms two Rotation digests move with equal figures: fire_heavy (`24f9d691` -> `edb0b407`) and air_heavy
  (`c210ea17` -> `323943f3`). The Rotation reference does not slot the mend line, but it faces a build, so it writes the cue into
  its brain state and never acts on it. Under windup alone and windup + held the Mirror tide beam cells move the same way (digests
  only), apart from fire_heavy 26.0 -> 26.5% and air_heavy 73.5 -> 73.4 s under windup + held, the figures option A alone gave in 6.4.

**What the reading says.**
- **Windup alone and windup + held do nothing.** Without the bank, Tide Ward is castable only at tier II (alone), or castable
  but unaffordable (held). The probe finds the reference with both the mana and a free mend line at 0 of 1032 beam starts under
  windup + held, the same 0 as A alone in 6.4: its median mana at a beam start is 3.3 against air_heavy. The cue fires and finds
  no ward to press, so it never casts.
- **With the bank, the timing helps, and it doubles coverage.** windup + bank + held answers 308 beam blows against bank + held's
  160, with only 35 more casts (196). Each ward now covers about 1.6 blows instead of 1. On the reference, 283 of the 716 beam blows
  from air_heavy landed while the ward was up, against 150 of 761 under bank + held. Coverage is 25.7%, still about half the
  proposed N = 50%.
- **It costs Water more fights than the bank alone.** air_heavy falls 50.0 -> 32.0% (bank + held: 38.0%), air_close stays at
  39.5%, below the floor, and fire_heavy falls to 25.0%. The bank's damage cost (6.5) is unchanged. The likely extra cost (an
  inference, not measured): the press clears a planned absorb, so the reference drops a raise against the beam's first tick to
  cast the ward.

**Verdict: declined, no arm kept.** No arm passes the keep test (coverage up materially, no band broken, air_close not below
40%, no Mirror tide cell below the 40% floor):
- windup alone and windup + held do not move coverage;
- windup + bank + held lifts it (none -> 25.7%) but leaves air_close at 39.5% and puts air_heavy at 32.0%, both below the floor.

The three overlay keys stay out of the tree. The code (`counters.ts` with all three keys, the AI rule, the probe, `report-counters`
arms, tests `counters.test.ts`) is kept as `docs/change-requests/evidence/d1-tide-ward-windup.patch`. It applies with `git apply`
on the commit that adds it, and it contains the 6.5 bank code too. No game code, overlay key, canonical number, golden, census
digest or parity suite (CR-002/CR-007) changes, there is nothing to return to VR, and there is no change request.

**Next.** Every Tide Ward arm that answers beams costs Water its Air beam fights, because the bank is what makes the ward
affordable. Two levers are left, and neither is an AI timing change:
- a cheaper or free Tide Ward row on PC (an overlay number, a CR candidate for VR), which would let the windup rule run without
  the bank;
- or accept that Tide Ward is not a counter and read beam answers elsewhere.

**Director default 2026-10-24, owner to confirm:** stop Tide Ward AI work at this step. Tide Ward stays outside the counter target,
and the overlay-price lever waits for an owner ruling on whether a PC price deviation for a Water row is wanted.

### 6.7 The skill book (4.3) as built, and its week curve, 2026-10-24

**What was built** (`packages/core/src/skill-book.ts`, numbers in `packages/core/src/arena/data/skill-book.pc.json`, checked
at load). The 4.3 design, as pure functions over an in-memory book of unspent points, ranks bought and signatures taught:
- **Earning.** `earnSkillPoints(book, activity, week)`: each finished camp activity earns `award[activity]` times
  `weekScale[week - 1]`. Training earns 2 per session. Working, befriending, confiding, protecting, watching, recruiting,
  offering, parley and listening earn 1. Rest, schemes, plots, reports and defection earn nothing.
- **Ranks.** `buyRank(book, key, school)` buys the next rank of a known spell, at `rankCost[tier][rank - 1]`:
  - the bolt is tier 0; a Water row's tier is its `line:tier`, a Fire or Air row's its canonical tier;
  - the table rises by 2 points per rank and per tier, from 20 (bolt, rank 1 to 2) to 34 (tier IV, rank 4 to 5);
  - a Water player knows every Water row, plus each signature taught.
- **Teachers.** `learnSignature(t, session, book, elder)`: Sadruba teaches Sunfall and Kesh teaches Tempest Lance, the Fire
  and Air signatures VR CR-005 grants. A lesson needs the elder present and `trust['elder>player']` at or above
  `teaching.trustAtLeast`, 20. That is the camp's own trust map, the one befriending, confiding and parley move. No new
  relationship state was added.
  - Water has no teachable signature: the player is Water and already knows every Water row. Earth has no arena rows.
  - A taught Fire or Air signature can be ranked, but a Water entrant cannot slot it yet. Cross-school slots belong to
    spellbook growth (4.3) and the composition rules.
- **Into a bout.** `boutSpellRanks(book)` returns the bought ranks for `createGames`' existing `spellRanks` option.

**The flag.** `enabled` in `skill-book.pc.json` is `false`. While it is off, nothing earns, no lesson passes and
`boutSpellRanks` gives `undefined`. While it is off, `createSeason` writes no book, so the season, the save and every bout are
today's, and the goldens, the default census digests and CR-002/CR-007 parity are unchanged. Run on this branch: the parity suites, golden
replays, the determinism wall and the week sweep test are green, and the full `npm run test` passes. Nothing was re-pinned.

**On the season (built 2026-10-25, player side only).** The 6.7 open item is closed for the player. Mage and rival ranks
are the held kernel lever (6.8). No file under `packages/core/src/arena/` changed.
- **The save.** `SeasonProgress.skills` is an optional key holding the book: unspent points, points earned, ranks bought
  and signatures taught. `createSeason` writes it only when the flag is on. Its presence is that season's flag, so a save
  keeps one rule from its first day to its last. A season started with the flag off writes no key, and a save without it
  loads as before (the enemyLevel precedent, `combat-system-depth.md`).
  - Schema bounds (`director/src/save-schema.ts`): points and earned are integers from 0 to `maxSeasonPoints`. Ranks are
    allowed only in Water rows or teachable signatures, each from 2 to the top rank. `taught` is a unique set of
    teachable signatures. No other keys are allowed.
  - `validatePayload` adds `skillBookStateProblems`: a rank only in a spell the player knows, unspent points never above
    earned, and points spent equal to the ranks bought.
- **Earning.** `SeasonService` banks a camp day when it settles at dawn. `earnCampDay` takes the session as it stood
  before `settleCamp` and calls `earnSkillPoints` once for each activity the player finished: each camp act (`dayActs`),
  each parley that day, and a finished listening act. A day banks once.
  - A save taken mid-dawn keeps the progress as it stood beside the unsettled checkpoint, so loading it banks that day
    once.
- **Doors.** `buySeasonRank(session, progress, key)` and `takeSeasonLesson(t, session, progress, elder)` are pure core
  functions over `buyRank` and `learnSignature`. No UI yet. They refuse while the Trial or a bout is open, so a prepared
  bout always matches its progress, which `validatePayload` re-derives.
- **Into the bout.** `prepareBout` records `spellRanks = boutSpellRanks(book)` on the bout, the same shape as
  `enemyLevel`. The key is left out with no book, with nothing bought, or when the player only watches. `startBout` passes
  it to `createGames` through the existing `spellRanks` option.
- **Evidence.** Tests:
  - `packages/tools/src/season.test.ts`: "records the bought spell ranks on the bout and replays them exactly", and "a
    flag-on season banks camp days into the book and each Games morning bout gets boutSpellRanks of that morning" (days
    1-14, both Games mornings).
  - `packages/director/src/skill-book-save.test.ts`: a round trip of the book and of a ranked bout, a save taken
    mid-dawn, and one rejection per bound.
  - `packages/core/src/skill-book.test.ts`: `earnCampDay` over a real camp day, the saved-book check and the doors.
  - Gate: build, lint, the full vitest suite (109 files, 875 tests), the node tests (44) and `check:design` are green.
    `@mage/*` was resolved to the branch's own packages for this run: the builder worktree's `node_modules` links them to
    the main checkout.
  - CR-002 and CR-007 parity (27 + 27), the golden replays (4), the determinism wall (24), the week census (10) and the
    skill census (3) pass unchanged. Nothing was re-pinned.
  - Commits: fd5c0b0 (core), dfe29f9 (save schema and service), 4477f77 (the mid-dawn banking fix), c3e2815 (tests).

**The week scale, and why.** The owner's rule makes each rank cost more. With the same award every week, the curve is
concave: fast in week 1, slow by week 6. The flat arm below runs 0.69-0.88 ahead of the target in weeks 1-2 and falls short
of rank 5 in week 6. A 4.3 target that climbs one rank per week needs income that climbs too. `weekScale` [1, 2, 4, 4, 5, 5]
lets the camp's drills pay more as the season goes on. The scale and the cost table were picked together, by fitting the
census's own season to the target. Both are data. The owner should confirm the week scale: it adds to the ruling and does
not contradict it.

**The week curve** (`npm --prefix packages/core run census:skills`, 2026-10-24, camp seed 73). The census plays the six-week
season through the real camp session (`createCampSession`, `actCamp`, `settleCamp`) with the book on:
- each Games morning (days 7, 14 ... 42), before the bout, it reads the average rank over the week sweep's ranked rows: the
  bolt and the Rotation preset's three lines at tiers I-IV, 13 rows;
- the `steady` player trains whenever a ground is open, vigor, focus and nerve in turn. That is 35 sessions in week 1 and 39
  in each later week, after the Trial and Games hours;
- the `worker` only works at the Exchange;
- after each day the player buys the cheapest next rank it can afford, until no rank is affordable;
- the target is the week sweep's `steady` profile (6.3): N - 0.5, floored at 1 and capped at 5.

| Week | Target | Steady (committed) | Steady, flat award (3x every week) | Worker (committed) |
|---|---|---|---|---|
| 1 | 1 | **1.23** (+0.23) | 1.69 (+0.69) | 1.00 |
| 2 | 1.5 | **1.69** (+0.19) | 2.38 (+0.88) | 1.08 |
| 3 | 2.5 | **2.62** (+0.12) | 3.08 (+0.58) | 1.31 |
| 4 | 3.5 | **3.46** (-0.04) | 3.69 (+0.19) | 1.46 |
| 5 | 4.5 | **4.46** (-0.04) | 4.31 (-0.19) | 1.62 |
| 6 | 5 | **5.00** (0.00) | 4.85 (-0.15) | 1.85 |

Points earned by each Games morning: steady 70, 218, 514, 826, 1208, 1598. Ranking all 13 rows to 5 costs 1436. A steady
trainer tracks the target within 0.23 every week (`skill-census.test.ts` holds it within 0.25). A player who only works
reaches 1.46 by week 4.

What this does not yet show:
- **Win rates.** The steady curve now matches the profile 6.3 ran, so 6.3's steady rows are the expected reading. That
  reading still overshoots the duels (66-73% from week 3), because mages and rivals are not levelled. That is the open 4.3
  lever 6.3 named, and it is not touched here.
- **Teachers in the curve.** Lessons are not part of the reading: no ranked row is a taught signature.

### 6.8 Mage-side lever: the reading (4.3), 2026-10-24

6.3 and 6.7 measured a steady trainer overshooting the duels: 66-73% from week 3. Mages and rivals are not levelled, so the
"untrained below 40% by week 4" target cannot happen either. This reading measures levers on the mage side. **It turns
nothing on and changes no default.** `census:weeks` takes an opt-in `--arm`. Without one, the sweep is the 6.3 sweep: a
rerun matched all 120 cell digests of `d1-weeks.json`. `week-census.test.ts` pins week 1 of both profiles to the plain
census, hash for hash, on every wave and build, and checks one ranked, levelled 6.3 cell against its digest.

**What the core supports today.** `createGames` has no option that levels a mage:
- `enemyLevel` scales regular enemies only, by design ("named rivals and mage entrants keep theirs", `games.ts`).
- `spellRanks` ranks the player only.
- `rivalBuild` spawns the build with its authored `rival-builds.json` ranks.

Both levers below are still reachable without a kernel change. An arm applies the core's exported `enemyHpMult` and
`setSpellRanks` to the spawned opponent mage (a rival build, or a mage wave's Water proxy) before the first tick, the way
the Lab applies an opponent build. This works for a census. **For the game, each lever needs a kernel lever**: a
`createGames` option that levels or ranks the opponent mage, and `season.ts prepareBout` passing it. That is not built
here, and the arena kernel and `arena/index.ts` are untouched.

The three arms (`week-census.ts mageArms`; rival ranks come from the new `rivalProfiles` key in
`progression-weeks.pc.json`, never below a build's authored ranks):
- `level`: the opponent mage gets the regular enemies' HP multiplier for the week, 1.0 to 1.5 (`progression.pc.json`
  `enemyLevels`).
- `ranked`: the opponent mage's bolt and rows are ranked on the steady player's own curve, 1, 1.5, 2.5, 3.5, 4.5, 5. At
  rank 5 a Fire or Air row with an ultimate form plays it.
- `lag`: the same, one rank behind the steady player: 1, 1, 1.5, 2.5, 3.5, 4.
  - The brief's third arm was a blend of the first two "if they bracket the target". They do not: both hold the steady
    player at about 50% or under from week 2 (`ranked` 49.4-50.4% in weeks 2-4, then 44%; `level` 47% and falling). The bracket is 6.3 (no arm, too high) against `ranked` (at the floor). So the
    third arm is the lighter version of the closer arm.

Same format as 6.3: 200 seeds per cell, seeds 40000-40199, `npm --prefix packages/core run census:weeks -- --count 200
--arm <arm> --tag d1-weeks-arm-<arm> --out-dir docs/change-requests/evidence`. Builds are listed in the order fire_close,
fire_light, fire_heavy, air_light, air_close, air_heavy. No cell timed out in any arm.

**Arm 1, `level`** (`docs/change-requests/evidence/d1-weeks-arm-level.json`)

| Profile | Week | Avg rank | W1 s | W2 s | W3 semifinal | W4 final | Builds | Builds mean |
|---|---|---|---|---|---|---|---|---|
| untrained | 1 | 1 | 35.3 | 42.6 | 89% / 40.1 | 54% / 49.2 | 50 51 42 56 40 46 | 47% |
| untrained | 2 | 1 | 41.2 | 47.6 | 81% / 44.8 | 39% / 51.5 | 41 41 34 46 24 35 | 37% |
| untrained | 3 | 1 | 44.9 | 52.2 | 69% / 47.7 | 26% / 53.5 | 31 33 23 37 17 28 | 28% |
| untrained | 4 | 1 | 49.7 | 56.2 | 56% / 51.8 | 16% / 54.3 | 27 23 15 21 8 23 | 19% |
| untrained | 5 | 1 | 54.9 | 60.9 | 44% / 53.9 | 9% / 54.6 | 20 14 10 14 4 20 | 14% |
| untrained | 6 | 1 | 59.3 | 65.3 | 29% / 56.3 | 6% / 54.7 | 17 8 7 7 2 15 | 9% |
| steady | 1 | 1 | 35.3 | 42.6 | 89% / 40.1 | 54% / 49.2 | 50 51 42 56 40 46 | 47% |
| steady | 2 | 1.5 | 36.8 | 44.0 | 90% / 41.3 | 56% / 49.4 | 48 47 41 63 35 47 | 47% |
| steady | 3 | 2.5 | 36.4 | 44.6 | 85% / 41.8 | 56% / 48.8 | 47 47 39 55 34 50 | 45% |
| steady | 4 | 3.5 | 36.9 | 43.3 | 87% / 41.3 | 52% / 47.9 | 47 45 39 57 35 38 | 44% |
| steady | 5 | 4.5 | 39.0 | 46.4 | 80% / 44.2 | 43% / 49.8 | 45 38 31 51 24 33 | 37% |
| steady | 6 | 5 | 42.7 | 51.4 | 72% / 46.4 | 34% / 51.6 | 37 31 24 36 19 24 | 28% |

**Arm 2, `ranked`** (`docs/change-requests/evidence/d1-weeks-arm-ranked.json`)

| Profile | Week | Avg rank | W1 s | W2 s | W3 semifinal | W4 final | Builds | Builds mean |
|---|---|---|---|---|---|---|---|---|
| untrained | 1 | 1 | 35.3 | 42.6 | 89% / 40.1 | 54% / 49.2 | 50 51 42 56 40 46 | 47% |
| untrained | 2 | 1 | 41.2 | 47.6 | 82% / 40.0 | 40% / 47.6 | 36 38 40 45 28 45 | 39% |
| untrained | 3 | 1 | 44.9 | 52.2 | 67% / 39.1 | 30% / 44.6 | 36 27 32 34 18 31 | 30% |
| untrained | 4 | 1 | 49.7 | 56.2 | 54% / 37.2 | 17% / 42.0 | 28 18 19 25 12 30 | 22% |
| untrained | 5 | 1 | 54.9 | 60.9 | 54% / 37.2 | 16% / 42.0 | 30 18 19 19 11 27 | 21% |
| untrained | 6 | 1 | 59.3 | 65.3 | 54% / 37.2 | 16% / 42.0 | 30 18 19 18 11 27 | 20% |
| steady | 1 | 1 | 35.3 | 42.6 | 89% / 40.1 | 54% / 49.2 | 50 51 42 56 40 46 | 47% |
| steady | 2 | 1.5 | 36.8 | 44.0 | 87% / 37.1 | 55% / 44.5 | 49 47 55 56 39 57 | 50% |
| steady | 3 | 2.5 | 36.4 | 44.6 | 86% / 34.1 | 59% / 41.4 | 52 44 56 55 41 56 | 50% |
| steady | 4 | 3.5 | 36.9 | 43.3 | 86% / 30.8 | 62% / 37.9 | 53 42 48 57 49 49 | 49% |
| steady | 5 | 4.5 | 39.0 | 46.4 | 83% / 29.7 | 61% / 37.0 | 48 38 46 51 40 44 | 44% |
| steady | 6 | 5 | 42.7 | 51.4 | 83% / 29.7 | 61% / 37.0 | 48 39 46 47 40 44 | 44% |

**Arm 3, `lag`** (`docs/change-requests/evidence/d1-weeks-arm-lag.json`)

| Profile | Week | Avg rank | W1 s | W2 s | W3 semifinal | W4 final | Builds | Builds mean |
|---|---|---|---|---|---|---|---|---|
| untrained | 1 | 1 | 35.3 | 42.6 | 89% / 40.1 | 54% / 49.2 | 50 51 42 56 40 46 | 47% |
| untrained | 2 | 1 | 41.2 | 47.6 | 89% / 40.1 | 54% / 49.2 | 50 51 42 56 40 46 | 47% |
| untrained | 3 | 1 | 44.9 | 52.2 | 82% / 40.0 | 40% / 47.6 | 36 38 40 45 28 45 | 39% |
| untrained | 4 | 1 | 49.7 | 56.2 | 67% / 39.1 | 30% / 44.6 | 36 27 32 34 18 31 | 30% |
| untrained | 5 | 1 | 54.9 | 60.9 | 54% / 37.2 | 17% / 42.0 | 28 18 19 25 12 30 | 22% |
| untrained | 6 | 1 | 59.3 | 65.3 | 54% / 37.2 | 16% / 42.0 | 27 18 19 25 12 30 | 22% |
| steady | 1 | 1 | 35.3 | 42.6 | 89% / 40.1 | 54% / 49.2 | 50 51 42 56 40 46 | 47% |
| steady | 2 | 1.5 | 36.8 | 44.0 | 93% / 37.3 | 68% / 46.1 | 55 56 56 75 47 52 | 57% |
| steady | 3 | 2.5 | 36.4 | 44.6 | 92% / 35.1 | 68% / 42.4 | 55 52 68 65 48 58 | 58% |
| steady | 4 | 3.5 | 36.9 | 43.3 | 90% / 31.1 | 67% / 38.8 | 52 46 66 66 55 54 | 56% |
| steady | 5 | 4.5 | 39.0 | 46.4 | 84% / 29.9 | 63% / 37.0 | 53 45 48 61 51 57 | 52% |
| steady | 6 | 5 | 42.7 | 51.4 | 83% / 29.7 | 61% / 37.0 | 54 45 48 53 51 57 | 51% |

**Against the 6 targets.** The targets are read on the builds mean: the six rival duels, the opponents the arms level.
- **Week 1 cannot move.** Week 1 is rank 1 and level 1 in every reading, so it is the plain census: 47.3%, 2.7 points
  under the 50% floor. No week lever reaches it. Weeks 2-6 are judged.
- **`level`**: misses the steady target. Steady falls from 46.8% (week 2) to 28.3% (week 6). The rival's HP grows to 1.5x,
  while rank power stops at 1.3x (rank 5 adds nothing to Water, 6.3). It hits the untrained target hard: 36.7% already in
  week 2, 19.4% by week 4. It is the only arm that keeps the steady player's duel medians where they were.
- **`ranked`**: misses the steady target, narrowly. Steady holds 50.3%, 50.4% and 49.4% in weeks 2-4, then 44.2% and
  43.8%. The untrained player is at 21.9% by week 4. Ranks on both sides shorten the duels: by week 4, fire_light,
  fire_heavy and air_close end in 36-40 s, under the 45 s floor.
- **`lag`**: **hits both.** Steady wins 56.8%, 57.6%, 56.3%, 52.3% and 51.0% in weeks 2-6, all inside 50-65%. The
  untrained player is at 38.6% in week 3 and 29.5% by week 4. Two costs:
  - the final (wave 4, the Water proxy) is 67-68% for the steady player in weeks 2-4, over 65%. Single builds over 65%:
    air_light 74.5% (week 2) and 65.5% (week 4), fire_heavy 68.0% (week 3) and 65.5% (week 4);
  - the duels get shorter, as in `ranked`. By week 4, fire_heavy (38.5 s), air_close (38.2 s) and fire_light (44.1 s)
    end under the 45 s floor, and air_close is at 35.2 s by week 5.
- The semifinal mage wave (Water proxy, competence 1) is 83-93% for the steady player under `ranked` and `lag`, and
  72-90% under `level`. It is 89% in week 1. It is a weak wave, not a duel, and only `level` brings it down, to 72% by
  week 6.

**Recommendation: `lag`, rival builds and mage entrants ranked one rank behind the steady player's curve (`rivalProfiles.lag`:
1, 1, 1.5, 2.5, 3.5, 4). Director default 2026-10-24, owner to confirm.** It is the only arm that meets both targets in
weeks 2-6. It also matches the 4.3 intent: the player who trains steadily stays a step ahead of the field, and the one who
does not falls behind. Before it can play in a bout it needs:
- the kernel lever above (a `createGames` option for the opponent mage's ranks, and `prepareBout` passing the week's
  profile);
- the player's own ranks reaching the bout, the save-schema ask 6.7 left open.

Not measured here, and next for this lever: the short duels. A small HP level on top of `lag` would lengthen them. It
would also lower the steady player's 51-58%, so it needs its own reading with the duration band as a third target.

### 6.9 Lag plus a small HP level: the reading (4.3), 2026-10-25

6.8 recommended `lag` and named its cost: the rival duels get shorter as both sides rank up. This reading adds a small HP level
on top of `lag`, to see if it brings the duels back into the band. **It turns nothing on and changes no default.**
`prepareBout`, the season and the director are untouched, and nothing outside the census sets the opponent-mage option.

**The lever.** 6.8 asked for a kernel lever. Main already has one: `createGames` `opponentMage { level, averageRank }`
(`mage-build.ts`, 9556d69), and `census:weeks` drives its arms through it (91bec6a). The held run 33b3b831 built the same
lever as `rivalLevel` (5e14b23), with the same rule: HP first, then ranks, never below a build's authored ranks. It also
moved the census onto that lever, uncommitted. Main carries both, so neither was cherry-picked. Re-run on this branch, the
default sweep and the `level`, `ranked` and `lag` arms each match all 120 cell digests of their evidence files.

**The arms** (`week-census.ts mageArms`; curves in `progression-weeks.pc.json` `rivalHpLevels`, integer enemy levels, never
falling). Each keeps `rivalProfiles.lag` (1, 1, 1.5, 2.5, 3.5, 4) and passes the week's HP level as the opponent mage's
`level`, which picks `progression.pc.json` `enemyLevels.hpMult`. An integer level is the only HP step the lever has, so
the smallest step is x1.1.
- `lag-hp1`: levels 1, 1, 2, 2, 2, 2. HP x1.1 from week 3, the week `lag` starts ranking the rival.
- `lag-hp2`: levels 1, 1, 2, 2, 3, 3. x1.1 in weeks 3-4, then x1.2.
- Both stay well under the `level` arm's 1.1-1.5. The brief allowed up to 3 curves. A third was not run, because it could not
  show anything new. Each week cell depends only on that week's options, so the measured cells already cover every integer
  curve:
  - a level-2 week 2 is the `level` arm's week 2 (rank 1 adds nothing; checked hash for hash);
  - level-2 weeks 3-6 are `lag-hp1`'s;
  - level-3 weeks 5-6 are `lag-hp2`'s.
  - `lag-hp2`'s weeks 1-4 equal `lag-hp1`'s, digest for digest. Week 1 of each arm is the plain census, and weeks 1-2 are `lag`.

Same format as 6.8: 200 seeds per cell, seeds 40000-40199, `npm --prefix packages/core run census:weeks -- --count 200 --arm
<arm> --tag d1-weeks-arm-<arm> --out-dir docs/change-requests/evidence`. Builds are listed in the order fire_close,
fire_light, fire_heavy, air_light, air_close, air_heavy. No cell timed out.

**Arm 1, `lag-hp1`** (`docs/change-requests/evidence/d1-weeks-arm-lag-hp1.json`)

| Profile | Week | Avg rank | W1 s | W2 s | W3 semifinal | W4 final | Builds | Builds mean |
|---|---|---|---|---|---|---|---|---|
| untrained | 1 | 1 | 35.3 | 42.6 | 89% / 40.1 | 54% / 49.2 | 50 51 42 56 40 46 | 47% |
| untrained | 2 | 1 | 41.2 | 47.6 | 89% / 40.1 | 54% / 49.2 | 50 51 42 56 40 46 | 47% |
| untrained | 3 | 1 | 44.9 | 52.2 | 72% / 43.8 | 28% / 49.0 | 31 31 31 35 17 38 | 30% |
| untrained | 4 | 1 | 49.7 | 56.2 | 50% / 41.7 | 16% / 45.6 | 29 22 23 24 9 24 | 22% |
| untrained | 5 | 1 | 54.9 | 60.9 | 38% / 39.4 | 9% / 42.2 | 21 11 14 16 5 22 | 14% |
| untrained | 6 | 1 | 59.3 | 65.3 | 37% / 39.3 | 9% / 42.2 | 22 11 14 14 5 22 | 14% |
| steady | 1 | 1 | 35.3 | 42.6 | 89% / 40.1 | 54% / 49.2 | 50 51 42 56 40 46 | 47% |
| steady | 2 | 1.5 | 36.8 | 44.0 | 93% / 37.3 | 68% / 46.1 | 55 56 56 75 47 52 | 57% |
| steady | 3 | 2.5 | 36.4 | 44.6 | 86% / 37.8 | 53% / 45.0 | 49 45 56 51 37 53 | 48% |
| steady | 4 | 3.5 | 36.9 | 43.3 | 82% / 34.3 | 57% / 41.6 | 45 39 51 55 47 49 | 48% |
| steady | 5 | 4.5 | 39.0 | 46.4 | 74% / 32.6 | 47% / 38.7 | 45 39 34 49 39 43 | 41% |
| steady | 6 | 5 | 42.7 | 51.4 | 75% / 32.5 | 45% / 38.6 | 47 39 34 40 39 43 | 40% |

**Arm 2, `lag-hp2`** (`docs/change-requests/evidence/d1-weeks-arm-lag-hp2.json`)

| Profile | Week | Avg rank | W1 s | W2 s | W3 semifinal | W4 final | Builds | Builds mean |
|---|---|---|---|---|---|---|---|---|
| untrained | 1 | 1 | 35.3 | 42.6 | 89% / 40.1 | 54% / 49.2 | 50 51 42 56 40 46 | 47% |
| untrained | 2 | 1 | 41.2 | 47.6 | 89% / 40.1 | 54% / 49.2 | 50 51 42 56 40 46 | 47% |
| untrained | 3 | 1 | 44.9 | 52.2 | 72% / 43.8 | 28% / 49.0 | 31 31 31 35 17 38 | 30% |
| untrained | 4 | 1 | 49.7 | 56.2 | 50% / 41.7 | 16% / 45.6 | 29 22 23 24 9 24 | 22% |
| untrained | 5 | 1 | 54.9 | 60.9 | 30% / 41.2 | 5% / 43.4 | 18 9 10 8 3 18 | 11% |
| untrained | 6 | 1 | 59.3 | 65.3 | 30% / 41.2 | 5% / 42.8 | 18 9 10 8 3 18 | 11% |
| steady | 1 | 1 | 35.3 | 42.6 | 89% / 40.1 | 54% / 49.2 | 50 51 42 56 40 46 | 47% |
| steady | 2 | 1.5 | 36.8 | 44.0 | 93% / 37.3 | 68% / 46.1 | 55 56 56 75 47 52 | 57% |
| steady | 3 | 2.5 | 36.4 | 44.6 | 86% / 37.8 | 53% / 45.0 | 49 45 56 51 37 53 | 48% |
| steady | 4 | 3.5 | 36.9 | 43.3 | 82% / 34.3 | 57% / 41.6 | 45 39 51 55 47 49 | 48% |
| steady | 5 | 4.5 | 39.0 | 46.4 | 65% / 34.8 | 36% / 40.7 | 37 32 24 34 30 33 | 32% |
| steady | 6 | 5 | 42.7 | 51.4 | 65% / 34.7 | 33% / 40.8 | 37 32 24 30 30 33 | 31% |

**Against the three targets** (builds mean, weeks 2-6; `lag` from 6.8 alongside):

| Arm | Steady, weeks 2-6 | Untrained, week 4 | Rival duels under 45 s (steady) |
|---|---|---|---|
| `lag` (6.8) | 56.8, 57.6, 56.3, 52.3, 51.0: **hit** | 29.5%: **hit** | 12 cells: **miss** |
| `lag-hp1` | 56.8, 48.3, 47.6, 41.3, 40.0: **miss** (weeks 3-6) | 21.6%: **hit** | 11 cells: **miss** |
| `lag-hp2` | 56.8, 48.3, 47.6, 31.5, 30.8: **miss** (weeks 3-6) | 21.6%: **hit** | 11 cells: **miss** |

- **Rival-duel medians under 45 s**, weeks 2-6:
  - `lag-hp1` steady: week 2 fire_heavy 44.5; week 3 fire_heavy 44.4, air_close 44.8; week 4 fire_heavy 40.0, air_close 40.5;
    weeks 5 and 6 fire_light 41.4, fire_heavy 38.3, air_close 37.5.
  - `lag-hp1` untrained: week 4 fire_heavy 44.5, air_close 44.3; weeks 5 and 6 fire_heavy 39.0, air_close 41.8.
  - `lag-hp2` steady: weeks 2-4 as `lag-hp1`; week 5 fire_light 43.3, fire_heavy 38.5, air_close 39.3; week 6 fire_light
    43.8, fire_heavy 38.5, air_close 39.3.
  - `lag-hp2` untrained: as `lag-hp1`.
  - Week 2 is `lag`'s in both arms (HP level 1): fire_heavy 44.5 s.
- **The final over 65%**: 68.0% in week 2 under both arms (`lag`'s week, untouched). After that it is 52.5, 57.5, 46.5 and
  44.5% under `lag-hp1`, and 52.5, 57.5, 36.0 and 33.0% under `lag-hp2`. The only single build over 65% is air_light in week
  2 at 74.5%, also `lag`'s.
- The semifinal (the Water proxy, levelled too) falls in weeks 3-6 from `lag`'s 83-92% to 74-86% (`lag-hp1`) and 65-86%
  (`lag-hp2`).

**The reading, plainly: HP buys the rival wins, not time.** Each x1.1 step costs the steady player 8.7-11.0 points
(week 3: 57.6% to 48.3%; week 5: 52.3% to 41.3%). It adds 1.1-2.9 s to the three shortest duels (week 4: fire_heavy 38.5 to
40.0 s, air_close 38.2 to 40.5 s). At x1.2, week 5 steady falls to 31.5% while fire_heavy (38.5 s) and air_close (39.3 s) are
still 6 s short of the floor. Section 2 found the same thing for close duels: rival HP raises its win share faster than it
lengthens the fight. No integer HP curve keeps the steady player at 50% or above in a week it touches (the composition above),
and none brings the short duels to 45 s. A finer step than x1.1 is not available today. On these slopes, about +5% HP would
cost about 5 points and buy about 1 s, so it could not close the 6-10 s gap either. **The HP level is ruled out as the
duration lever.**

**Recommendation: keep `lag` with no HP level (`rivalProfiles.lag`, 6.8). Director default 2026-10-25, owner to confirm.**
It is still the only arm that meets the steady and untrained targets in weeks 2-6. Treat the short duels as their own problem,
not as part of the week curve. They come from rank power on both sides: ranks multiply damage, so ranked fights end sooner. The
next reading should look for a lever that adds time without adding the rival's win share:
- the exchange windows (4.1 A, 6.1) per rank;
- rank power that grows defence as well as damage.

That choice belongs to the owner. Nothing here is turned on. Before `lag` can play in a bout, `prepareBout` must pass the
week's `opponentMage` (the lever exists; the player's own ranks already reach the bout, 6.7 "On the season").

### 6.10 Duration levers after the HP level: the reading (4.1 A, 4.3), 2026-10-25

6.9 ruled out the HP level: it buys the rival wins, not time. Under `lag`, 12 steady rival-duel cells in weeks 2-6 still have
medians under 45 s (fire_light, fire_heavy, air_close). It named two levers that might add time without adding the rival's win
share. This reading measures both on top of `lag`. **It turns nothing on and changes no default.** `prepareBout`, the season and
the director are untouched, and nothing outside the census sets either option.

**Where the short duels' damage lands.** A new read-only reading, `report-reach.ts`, sorts the damage each side puts through by
the distance at contact. Steady week 4 under `lag`, 200 seeds (`npm --prefix packages/core run data && npx tsx
packages/core/scripts/report-reach.ts --count 200 --week 4 --arm lag`):

| Build (lag, steady, week 4) | Player's damage: <=5 m / 5-8 m / >8 m | Rival's damage: <=5 m / 5-8 m / >8 m | Clean close blows a fight, why no window |
|---|---|---|---|
| fire_light (46.0%, 44.1 s) | 3 / 43 / 54% | 3 / 45 / 52% | none open 1.09, expired 0.33 |
| fire_heavy (65.5%, 38.5 s) | 4 / 47 / 49% | 6 / 58 / 36% | none open 1.26, expired 0.48 |
| air_close (55.0%, 38.2 s) | 19 / 80 / 1% | 23 / 77 / 0% | none open 2.10, expired 6.25, spent 0.06 |

So 77-97% of the damage in the three short duels lands from beyond the window's 5 m. The window's other numbers barely bind:
`guardHits` almost never runs out (spent 0.06 a fight), and `guardS` runs out about 6 times a fight in air_close only.

**The levers.** Both are optional `createGames` options. Their default is today's behaviour exactly. Both read the same quantity:
the rank steps a mage **gained** above its authored build (`progression.ts rankSteps`: the mean, over its rows, of its power rank
above 1, with rank 5 counted as 4; `games.ts gainedRanks`). The player's ranks all count. An opponent mage counts only what the
`opponentMage` lever added. So week 1, and fire_heavy's authored Brand Wrath 5, move nothing.
- `exchangeReach { perRankStepM }` (exchange.ts). The window's reach is `closeRangeM` + `perRankStepM` x the defender's gained
  steps, both for opening the window and for guarding. This is the smallest shape that fits the 6.1 rule: one existing number,
  scaled by rank. It is also the only number of the rule that touches where the short duels' damage lands. Growing `guardHits`
  or `guardS`, or tightening the stack cap, would reach only air_close's ~6 expired close blows a fight, and nothing in
  fire_light or fire_heavy. The per-state reach is kept outside the hashed state, like the arena hooks.
- `rankDefence { hpPerRankStep }` (games.ts). Every mage's HP is x(1 + `hpPerRankStep` x its gained steps): the player at
  creation, each opponent mage at spawn. 0.1 mirrors the rank power table's +0.1 a rank, so two mages that gained the same ranks
  take as long to fell each other as at rank 1. It is an HP step, not an incoming-damage cut, because an HP step is set at spawn
  and leaves the shared hit path (`contact.ts`, `kernel.ts`) untouched. Over a fight the two are the same budget, except for stagger
  length and heals.

**The arms** (`week-census.ts mageArms`). Each keeps `rivalProfiles.lag` (1, 1, 1.5, 2.5, 3.5, 4) and adds one lever with the same
strength every week. Each lever was tried at two strengths, the brief's limit:
- `lag-xw1` / `lag-xw2`: reach +0.5 / +1 m per gained step. At week 4 the steady player defends at about 6.3 / 7.5 m and the
  rival at about 5.4 / 5.8 m (fire_heavy: 0.8 gained steps).
- `lag-def1` / `lag-def2`: HP +0.05 / +0.1 per gained step.

Same format as 6.8 and 6.9: 200 seeds per cell, seeds 40000-40199, `npm --prefix packages/core run census:weeks -- --count 200
--arm <arm> --tag d1-610-weeks-arm-<arm> --out-dir docs/change-requests/evidence`. The writer now ends with the targets read off
the cells: the builds mean per week, and the duels under their band's floor in weeks 2-6. The `lag` control column was re-run on
this branch and matches all 120 cell digests of `d1-weeks-arm-lag.json`. The evidence files `d1-610-weeks-arm-<arm>.json` are not
committed with this section: `docs/change-requests/evidence/` is outside this lane's paths, and the files are held for filing.
Builds are listed in the order fire_close, fire_light, fire_heavy, air_light, air_close, air_heavy. No cell timed out, except
under `lag-xw2` (below).

**Arm 1, `lag-xw1`** (reach +0.5 m a step)

| Profile | Week | Avg rank | W1 s | W2 s | W3 semifinal | W4 final | Builds | Builds mean |
|---|---|---|---|---|---|---|---|---|
| untrained | 1 | 1 | 35.3 | 42.6 | 89% / 40.1 | 54% / 49.2 | 50 51 42 56 40 46 | 47% |
| untrained | 2 | 1 | 41.2 | 47.6 | 89% / 40.1 | 54% / 49.2 | 50 51 42 56 40 46 | 47% |
| untrained | 3 | 1 | 44.9 | 52.2 | 82% / 40.0 | 40% / 47.6 | 23 36 43 43 9 44 | 33% |
| untrained | 4 | 1 | 49.7 | 56.2 | 67% / 39.1 | 30% / 44.6 | 4 26 28 32 0 28 | 20% |
| untrained | 5 | 1 | 54.9 | 60.9 | 54% / 37.2 | 17% / 42.0 | 1 14 18 21 0 26 | 13% |
| untrained | 6 | 1 | 59.3 | 65.3 | 54% / 37.2 | 16% / 42.0 | 1 12 17 16 0 23 | 11% |
| steady | 1 | 1 | 35.3 | 42.6 | 89% / 40.1 | 54% / 49.2 | 50 51 42 56 40 46 | 47% |
| steady | 2 | 1.5 | 36.8 | 44.0 | 93% / 37.3 | 68% / 46.1 | 64 56 56 76 61 52 | 61% |
| steady | 3 | 2.5 | 36.4 | 44.6 | 92% / 35.1 | 68% / 42.4 | 55 53 66 71 76 60 | 63% |
| steady | 4 | 3.5 | 36.9 | 43.3 | 90% / 31.1 | 67% / 38.8 | 36 48 68 66 74 57 | 58% |
| steady | 5 | 4.5 | 39.0 | 46.4 | 84% / 29.9 | 63% / 37.0 | 24 41 48 57 45 48 | 44% |
| steady | 6 | 5 | 42.7 | 51.4 | 83% / 29.7 | 61% / 37.0 | 21 40 45 51 30 44 | 38% |

**Arm 2, `lag-xw2`** (reach +1 m a step)

| Profile | Week | Avg rank | W1 s | W2 s | W3 semifinal | W4 final | Builds | Builds mean |
|---|---|---|---|---|---|---|---|---|
| untrained | 1 | 1 | 35.3 | 42.6 | 89% / 40.1 | 54% / 49.2 | 50 51 42 56 40 46 | 47% |
| untrained | 2 | 1 | 41.2 | 47.6 | 89% / 40.1 | 54% / 49.2 | 50 51 42 56 40 46 | 47% |
| untrained | 3 | 1 | 44.9 | 52.2 | 82% / 40.0 | 40% / 47.6 | 10 37 43 44 1 44 | 30% |
| untrained | 4 | 1 | 49.7 | 56.2 | 67% / 39.1 | 30% / 44.6 | 0 15 25 24 0 28 | 15% |
| untrained | 5 | 1 | 54.9 | 60.9 | 54% / 37.2 | 17% / 42.0 | 0 7 8 4 0 11 | 5% |
| untrained | 6 | 1 | 59.3 | 65.3 | 54% / 37.2 | 16% / 42.0 | 0 2 6 4 0 9 | 3% |
| steady | 1 | 1 | 35.3 | 42.6 | 89% / 40.1 | 54% / 49.2 | 50 51 42 56 40 46 | 47% |
| steady | 2 | 1.5 | 36.8 | 44.0 | 93% / 37.3 | 68% / 46.1 | 69 56 57 76 84 53 | 65% |
| steady | 3 | 2.5 | 36.4 | 44.6 | 92% / 35.1 | 68% / 42.4 | 48 56 70 72 97 56 | 66% |
| steady | 4 | 3.5 | 36.9 | 43.3 | 90% / 31.1 | 67% / 38.8 | 28 57 76 74 79 64 | 63% |
| steady | 5 | 4.5 | 39.0 | 46.4 | 84% / 29.9 | 63% / 37.0 | 22 57 56 53 11 58 | 43% |
| steady | 6 | 5 | 42.7 | 51.4 | 83% / 29.7 | 61% / 37.0 | 24 49 52 46 3 54 | 38% |

**Arm 3, `lag-def1`** (HP +0.05 a step)

| Profile | Week | Avg rank | W1 s | W2 s | W3 semifinal | W4 final | Builds | Builds mean |
|---|---|---|---|---|---|---|---|---|
| untrained | 1 | 1 | 35.3 | 42.6 | 89% / 40.1 | 54% / 49.2 | 50 51 42 56 40 46 | 47% |
| untrained | 2 | 1 | 41.2 | 47.6 | 89% / 40.1 | 54% / 49.2 | 50 51 42 56 40 46 | 47% |
| untrained | 3 | 1 | 44.9 | 52.2 | 80% / 41.0 | 35% / 48.1 | 34 36 40 43 24 44 | 37% |
| untrained | 4 | 1 | 49.7 | 56.2 | 55% / 41.4 | 20% / 45.3 | 30 23 30 26 10 27 | 24% |
| untrained | 5 | 1 | 54.9 | 60.9 | 36% / 39.9 | 7% / 42.9 | 19 11 16 13 5 22 | 14% |
| untrained | 6 | 1 | 59.3 | 65.3 | 32% / 40.6 | 7% / 42.3 | 20 10 14 11 3 21 | 13% |
| steady | 1 | 1 | 35.3 | 42.6 | 89% / 40.1 | 54% / 49.2 | 50 51 42 56 40 46 | 47% |
| steady | 2 | 1.5 | 36.8 | 44.0 | 95% / 37.4 | 75% / 46.3 | 56 57 56 76 53 55 | 59% |
| steady | 3 | 2.5 | 36.4 | 44.6 | 95% / 35.8 | 75% / 44.0 | 56 59 69 71 50 60 | 61% |
| steady | 4 | 3.5 | 36.9 | 43.3 | 94% / 34.1 | 76% / 42.4 | 54 52 70 69 59 61 | 61% |
| steady | 5 | 4.5 | 39.0 | 46.4 | 84% / 34.6 | 65% / 42.5 | 56 48 60 64 48 52 | 54% |
| steady | 6 | 5 | 42.7 | 51.4 | 80% / 35.1 | 61% / 43.1 | 55 47 58 56 46 51 | 52% |

**Arm 4, `lag-def2`** (HP +0.1 a step)

| Profile | Week | Avg rank | W1 s | W2 s | W3 semifinal | W4 final | Builds | Builds mean |
|---|---|---|---|---|---|---|---|---|
| untrained | 1 | 1 | 35.3 | 42.6 | 89% / 40.1 | 54% / 49.2 | 50 51 42 56 40 46 | 47% |
| untrained | 2 | 1 | 41.2 | 47.6 | 89% / 40.1 | 54% / 49.2 | 50 51 42 56 40 46 | 47% |
| untrained | 3 | 1 | 44.9 | 52.2 | 77% / 42.3 | 33% / 48.5 | 33 33 38 41 19 43 | 34% |
| untrained | 4 | 1 | 49.7 | 56.2 | 44% / 42.3 | 9% / 46.1 | 23 16 25 19 6 24 | 19% |
| untrained | 5 | 1 | 54.9 | 60.9 | 21% / 41.8 | 4% / 43.4 | 16 7 12 5 2 18 | 10% |
| untrained | 6 | 1 | 59.3 | 65.3 | 16% / 42.0 | 2% / 42.8 | 13 5 10 6 2 17 | 9% |
| steady | 1 | 1 | 35.3 | 42.6 | 89% / 40.1 | 54% / 49.2 | 50 51 42 56 40 46 | 47% |
| steady | 2 | 1.5 | 36.8 | 44.0 | 96% / 37.4 | 76% / 46.6 | 57 59 56 79 56 57 | 61% |
| steady | 3 | 2.5 | 36.4 | 44.6 | 97% / 36.9 | 81% / 45.0 | 60 61 69 80 58 65 | 65% |
| steady | 4 | 3.5 | 36.9 | 43.3 | 95% / 37.2 | 78% / 44.9 | 57 57 66 75 61 66 | 63% |
| steady | 5 | 4.5 | 39.0 | 46.4 | 87% / 39.6 | 67% / 47.0 | 57 48 57 68 46 58 | 56% |
| steady | 6 | 5 | 42.7 | 51.4 | 85% / 40.8 | 58% / 48.1 | 53 46 55 60 42 55 | 52% |

**Against the three targets** (builds mean, weeks 2-6; `lag` is the control, re-run here). The last column is not one of the three
targets. It counts the steady rival duels whose median runs past their band's ceiling (75 s on wave 3, 80 s on wave 4).

| Arm | Steady, weeks 2-6 | Untrained, week 4 | Rival duels under 45 s (steady) | Over the ceiling (steady) |
|---|---|---|---|---|
| `lag` (control) | 56.8, 57.6, 56.3, 52.3, 51.0: **hit** | 29.5%: **hit** | 12 cells: **miss** | 0 |
| `lag-xw1` | 60.8, 63.2, 58.0, 43.8, 38.3: **miss** (weeks 5-6) | 19.7%: **hit** | 8 cells: **miss** | 6 |
| `lag-xw2` | 65.5, 66.3, 62.7, 42.7, 37.6: **miss** (weeks 2, 3, 5, 6) | 15.2%: **hit** | 4 cells: **miss** | 9, and 131 timeouts |
| `lag-def1` | 59.0, 60.8, 60.6, 54.4, 52.0: **hit** | 24.1%: **hit** | 8 cells: **miss** | 0 |
| `lag-def2` | 60.8, 65.4, 63.5, 55.7, 51.8: **miss** (week 3, 0.4 over) | 18.7%: **hit** | 4 cells: **miss** | 0 |

The three short duels, steady medians in seconds for weeks 2, 3, 4, 5, 6:

| Arm | fire_light, weeks 2-6 | fire_heavy, weeks 2-6 | air_close, weeks 2-6 |
|---|---|---|---|
| `lag` | 51.3, 46.7, 44.1, 40.3, 40.3 | 44.5, 41.5, 38.5, 37.0, 37.0 | 47.7, 42.5, 38.2, 35.2, 35.2 |
| `lag-xw1` | 51.8, 47.9, 44.0, 41.9, 41.9 | 44.9, 42.2, 38.6, 38.3, 38.5 | 50.0, 57.4, 75.0, 97.5, 107.3 |
| `lag-xw2` | 51.8, 50.6, 47.5, 60.0, 65.7 | 44.9, 42.2, 40.5, 43.5, 45.1 | 52.9, 75.1, 129.0, 149.2, 149.7 |
| `lag-def1` | 51.5, 49.3, 48.8, 47.0, 47.5 | 44.5, 41.5, 39.5, 41.0, 42.1 | 49.2, 45.0, 43.1, 41.7, 42.1 |
| `lag-def2` | 52.3, 51.9, 53.5, 53.8, 55.3 | 44.8, 42.5, 41.0, 44.6, 45.4 | 50.0, 47.0, 48.0, 49.8, 50.3 |

- **Rival duels under 45 s**, weeks 2-6, as the writer lists them:
  - `lag-xw1` steady: w2 fire_heavy 44.9; w3 fire_heavy 42.2; w4 fire_light 44.0, fire_heavy 38.6; w5 and w6 fire_light 41.9,
    fire_heavy 38.3 and 38.5.
  - `lag-xw2` steady: fire_heavy only, w2 44.9, w3 42.2, w4 40.5, w5 43.5.
  - `lag-def1` steady: w2 fire_heavy 44.5; w3 fire_heavy 41.5; w4 fire_heavy 39.5, air_close 43.1; w5 fire_heavy 41.0, air_close
    41.7; w6 fire_heavy 42.1, air_close 42.1.
  - `lag-def2` steady: fire_heavy only, w2 44.8, w3 42.5, w4 41.0, w5 44.6.
  - Untrained: 6 cells in every arm, `lag` included, mostly fire_heavy and air_close in weeks 4-6 (38.5-44.8 s). They are the
    ranked rival beating a rank-1 player fast, which is the untrained target working, not a duel to lengthen.
- **Over the ceiling**: `lag-xw1` steady w4-6 fire_close 77.6-84.7 s, air_close 75.0-107.3 s. `lag-xw2` steady w3-6 fire_close
  83.6-92.6 s, air_close 75.1-149.7 s, w6 air_heavy 85.5 s. air_close times out in 5, 59 and 67 of 200 fights in weeks 4-6.
- **The final and the semifinal** (the Water proxy) see no Fire/Air contact, so the reach arms leave them exactly at `lag`'s
  values: final 68.0, 67.5, 67.0, 62.5, 60.5% in weeks 2-6. Rank defence lifts both, because the steady player gains a rank more
  than the lag-ranked proxy. Final: 74.5, 75.0, 75.5, 64.5, 61.0% (`lag-def1`) and 76.0, 80.5, 78.0, 66.5, 58.0% (`lag-def2`).
  Semifinal: 80-95% and 84.5-97%, against `lag`'s 82.5-93%.
- **Single builds over 65%**, steady weeks 2-6:
  - `lag`: w2 air_light 74.5; w3 fire_heavy 68.0; w4 fire_heavy 65.5, air_light 65.5.
  - `lag-xw1`: w2 air_light 75.5; w3 fire_heavy 65.5, air_light 71.0, air_close 75.5; w4 fire_heavy 68.0, air_light 65.5,
    air_close 74.0.
  - `lag-xw2`: w2 fire_close 68.5, air_light 75.5, air_close 84.0; w3 fire_heavy 70.0, air_light 71.5, air_close 96.5; w4
    fire_heavy 75.5, air_light 74.0, air_close 78.5.
  - `lag-def1`: w2 air_light 76.0; w3 fire_heavy 69.0, air_light 71.0; w4 fire_heavy 69.5, air_light 69.0.
  - `lag-def2`: w2 air_light 79.0; w3 fire_heavy 68.5, air_light 80.0; w4 fire_heavy 65.5, air_light 75.0, air_heavy 65.5; w5
    air_light 67.5.

**The reading, plainly: neither lever closes the gap.**
- **Exchange reach is the wrong shape.** It lengthens only the duels already fought near 5 m, the close builds, and it overshoots
  them past their bands. fire_close and air_close go long, and with +1 m air_close times out. fire_light and fire_heavy stay short,
  because 36-54% of their damage lands beyond 8 m. It also bends the curve: the steady player wins more in weeks 2-4 (up to 66.3%),
  then falls to 37.6-43.8% in weeks 5-6, because a long close duel goes to the rival close builds (fire_close 21-24%, air_close
  3-45%). It is ruled out.
- **Rank defence adds time without overshooting.** No cell passes its ceiling, there are no timeouts, and every short duel gets
  longer: air_close goes from 35.2 to 41.7 s (+0.05) and to 49.8 s (+0.1) in week 5. At +0.05 it is the only measured arm that meets
  both win targets in weeks 2-6, and it cuts the short cells from 12 to 8. At +0.1 only fire_heavy is still short (41.0-44.8 s, 4
  cells), but steady week 3 reads 65.4%, 0.4 over the ceiling. That is inside the 200-seed noise of a six-build mean, but it is a
  miss as read.
- Its cost is the one 6.9 found in reverse: the steady player gains a rank more than a lag rival, so defence by own rank gives the
  steady player more. Steady rises 0.8-7.8 points over `lag`, and the final climbs to 74.5-80.5% in weeks 2-4. The untrained player falls
  further behind, 18.7-24.1% in week 4, which still meets the target.
- **fire_heavy is short under every arm**: 37.0-45.4 s in weeks 2-6. It is a far build: 94% of the rival's damage and 96% of the player's
  lands beyond 5 m. In the census, much of it lands in the 5-8 m band the reference player chases to.

**Recommendation: keep `lag` as the week curve (6.8). Take rank defence forward as the duration lever at `hpPerRankStep` 0.05
(`lag-def1`), and drop the reach lever. Director default 2026-10-25, owner to confirm.** At 0.05, rank defence is the only measured
lever that keeps both win targets while it lengthens every short duel. A strength between 0.05 and 0.1 was not run (two per lever).
It would trade the week-3 ceiling against the remaining short cells, and it needs its own reading before anyone picks it. Rank
defence does not close the duration gap by itself. **The next candidate is 4.1 E, the reference player range**, not built here. The
census reference chases every build to its own 5-8 m band, so fire_heavy, a far build, is measured in the reference's band instead
of its own. 4.1 E changes every census baseline and is a re-pin with a reason. Nothing here is turned on. Before rank defence can
play in a bout, `prepareBout` must pass the week's `rankDefence` beside its `opponentMage`, and the final's 74.5-75.5% (weeks 2-4) needs a look of its own.

### 6.11 The reference player's range: the reading (4.1 E), 2026-10-25

6.10 left fire_heavy short under every arm (37.0-45.4 s in weeks 2-6) and named 4.1 E as the next candidate. The census
reference chases every build into its own authored 5-8 m (`runtime.json` `magePreferredDistanceM`), so a far build is
measured in the reference's band instead of its own. This reading measures the reference holding each build's own band.
**It turns nothing on, changes no default and re-pins nothing.** `prepareBout`, the season and the director are untouched.

**The option.** The new `createGames` option `referenceRange: 'build'` (archetypes.ts `setReferenceRange` and
`referenceBand`, read in mage-ai.ts) has the reference player hold the band of the build it faces instead of 5-8 m. The band
is the build's own `archetypeBand`, the band its plan holds. It is read from its rows: the row's reach times the archetype's
fractions, and for a heavy build the payoff rows its collar has opened. No per-build constant. The option is kept outside
the hashed state like the arena hooks. A fight without a build plays exactly as before: waves 1-2, and the Water proxy in the
semifinal and the final. Omitted, the Games is today's. Goldens, CR-002/CR-007 parity and the default census digest tests
pass unchanged, and `games.test.ts` checks both on and off. Nothing in the game sets it.

The bands the reference now holds (seed 40000, at spawn; a heavy band moves out to payoff reach as the collar opens):

| Build | fire_close | fire_light | fire_heavy | air_light | air_close | air_heavy |
|---|---|---|---|---|---|---|
| Band, m | 2.0-3.4 | 8.4-12.0 | 9.0-11.4 | 9.8-14.0 | 3.0-5.1 | 10.5-13.3 |

**The arms** (`week-census.ts mageArms`):
- `lag-ref`: `lag` plus the range;
- `lag-def1-ref`: `lag-def1` (rank defence at `hpPerRankStep` 0.05) plus the range.

The range is how the census plays a build, not a week lever, so it applies from week 1. Week 1's build cells therefore
differ from every other arm. All 48 wave cells of each range arm match their base arm, digest for digest.

Same format as 6.8 to 6.10: 200 seeds per cell, seeds 40000-40199, weeks 1-6, both profiles, `npm --prefix packages/core run
census:weeks -- --count 200 --arm <arm> --tag d1-611-weeks-arm-<arm> --out-dir docs/change-requests/evidence`. Evidence (filed
with this section): `d1-611-weeks-arm-lag-ref.json`, `d1-611-weeks-arm-lag-def1-ref.json`, and the `lag-def1` control
`d1-611-weeks-arm-lag-def1.json`. Both controls were re-run on this branch. `lag` matches all 120 cell digests of
`d1-weeks-arm-lag.json`. `lag-def1` reproduces every 6.10 figure. Builds are listed in the order fire_close, fire_light,
fire_heavy, air_light, air_close, air_heavy.

**Arm 1, `lag-ref`** (lag plus the range)

| Profile | Week | Avg rank | W1 s | W2 s | W3 semifinal | W4 final | Builds | Builds mean |
|---|---|---|---|---|---|---|---|---|
| untrained | 1 | 1 | 35.3 | 42.6 | 89% / 40.1 | 54% / 49.2 | 1 62 25 2 74 35 | 33% |
| untrained | 2 | 1 | 41.2 | 47.6 | 89% / 40.1 | 54% / 49.2 | 1 62 25 2 74 35 | 33% |
| untrained | 3 | 1 | 44.9 | 52.2 | 82% / 40.0 | 40% / 47.6 | 0 52 26 1 62 36 | 29% |
| untrained | 4 | 1 | 49.7 | 56.2 | 67% / 39.1 | 30% / 44.6 | 0 52 26 1 50 28 | 26% |
| untrained | 5 | 1 | 54.9 | 60.9 | 54% / 37.2 | 17% / 42.0 | 0 38 21 0 45 22 | 21% |
| untrained | 6 | 1 | 59.3 | 65.3 | 54% / 37.2 | 16% / 42.0 | 0 38 21 0 45 22 | 21% |
| steady | 1 | 1 | 35.3 | 42.6 | 89% / 40.1 | 54% / 49.2 | 1 62 25 2 74 35 | 33% |
| steady | 2 | 1.5 | 36.8 | 44.0 | 93% / 37.3 | 68% / 46.1 | 1 67 34 1 81 34 | 36% |
| steady | 3 | 2.5 | 36.4 | 44.6 | 92% / 35.1 | 68% / 42.4 | 1 70 43 4 83 52 | 42% |
| steady | 4 | 3.5 | 36.9 | 43.3 | 90% / 31.1 | 67% / 38.8 | 1 66 49 4 75 49 | 40% |
| steady | 5 | 4.5 | 39.0 | 46.4 | 84% / 29.9 | 63% / 37.0 | 1 57 41 6 75 40 | 37% |
| steady | 6 | 5 | 42.7 | 51.4 | 83% / 29.7 | 61% / 37.0 | 1 57 41 6 75 40 | 37% |

**Arm 2, `lag-def1-ref`** (lag plus rank defence at 0.05, plus the range)

| Profile | Week | Avg rank | W1 s | W2 s | W3 semifinal | W4 final | Builds | Builds mean |
|---|---|---|---|---|---|---|---|---|
| untrained | 1 | 1 | 35.3 | 42.6 | 89% / 40.1 | 54% / 49.2 | 1 62 25 2 74 35 | 33% |
| untrained | 2 | 1 | 41.2 | 47.6 | 89% / 40.1 | 54% / 49.2 | 1 62 25 2 74 35 | 33% |
| untrained | 3 | 1 | 44.9 | 52.2 | 80% / 41.0 | 35% / 48.1 | 0 51 26 1 58 35 | 28% |
| untrained | 4 | 1 | 49.7 | 56.2 | 55% / 41.4 | 20% / 45.3 | 0 41 25 0 39 26 | 22% |
| untrained | 5 | 1 | 54.9 | 60.9 | 36% / 39.9 | 7% / 42.9 | 0 29 14 0 22 17 | 14% |
| untrained | 6 | 1 | 59.3 | 65.3 | 32% / 40.6 | 7% / 42.3 | 0 29 13 0 20 16 | 13% |
| steady | 1 | 1 | 35.3 | 42.6 | 89% / 40.1 | 54% / 49.2 | 1 62 25 2 74 35 | 33% |
| steady | 2 | 1.5 | 36.8 | 44.0 | 95% / 37.4 | 75% / 46.3 | 2 68 34 2 84 36 | 38% |
| steady | 3 | 2.5 | 36.4 | 44.6 | 95% / 35.8 | 75% / 44.0 | 1 71 42 4 86 59 | 44% |
| steady | 4 | 3.5 | 36.9 | 43.3 | 94% / 34.1 | 76% / 42.4 | 2 71 49 3 82 52 | 43% |
| steady | 5 | 4.5 | 39.0 | 46.4 | 84% / 34.6 | 65% / 42.5 | 1 61 49 2 79 43 | 39% |
| steady | 6 | 5 | 42.7 | 51.4 | 80% / 35.1 | 61% / 43.1 | 1 60 46 3 77 41 | 38% |

**Duel medians**, seconds, weeks 1-6 (steady; untrained below). Week 1 is the same for both profiles.

| Build | `lag` (control) | `lag-def1` (control) | `lag-ref` | `lag-def1-ref` |
|---|---|---|---|---|
| fire_close | 67.0, 61.4, 56.2, 48.9, 46.7, 46.7 | 67.0, 62.5, 59.5, 52.0, 56.0, 57.0 | 44.7, 45.1, 40.1, 39.1, 38.1, 37.6 | 44.7, 47.1, 44.1, 41.6, 40.6, 40.1 |
| fire_light | 54.0, 51.3, 46.7, 44.1, 40.3, 40.3 | 54.0, 51.5, 49.3, 48.8, 47.0, 47.5 | 75.5, 69.0, 64.0, 57.3, 54.5, 54.5 | 75.5, 69.0, 67.8, 63.5, 64.4, 65.2 |
| fire_heavy | 46.5, 44.5, 41.5, 38.5, 37.0, 37.0 | 46.5, 44.5, 41.5, 39.5, 41.0, 42.1 | 46.9, 46.1, 44.5, 42.4, 39.5, 39.5 | 46.9, 46.3, 44.6, 43.6, 44.95, 45.4 |
| air_light | 63.5, 59.9, 56.8, 49.4, 47.1, 47.2 | 63.5, 60.5, 58.6, 55.0, 54.1, 55.3 | 152.1, 155.3, 150.3, 148.1, 136.4, 130.7 | 152.1, 153.3, 160.5, 152.4, 148.4, 144.1 |
| air_close | 50.7, 47.7, 42.5, 38.2, 35.2, 35.2 | 50.7, 49.2, 45.0, 43.1, 41.7, 42.1 | 75.5, 70.0, 62.6, 57.1, 57.0, 57.0 | 75.5, 70.2, 64.4, 63.2, 65.7, 66.6 |
| air_heavy | 75.3, 72.2, 68.4, 59.6, 60.6, 60.6 | 75.3, 72.6, 69.4, 64.2, 67.8, 68.7 | 90.5, 87.4, 84.8, 77.7, 76.9, 76.9 | 90.5, 89.0, 86.3, 84.2, 83.0, 83.5 |

Untrained, weeks 2-6 (`lag-ref` / `lag-def1-ref`):
- fire_close: 44.7, 39.6, 37.1, 36.6, 36.6 under both arms.
- fire_light: 75.5, 73.5, 70.9, 63.9, 63.9 / 75.5, 73.9, 72.9, 67.3, 68.4.
- fire_heavy: 46.9, 47.0, 46.6, 42.8, 42.8 / 46.9, 47.2, 46.7, 43.4, 43.8.
- air_light: 152.1, 145.7, 145.6, 135.5, 133.5 under both arms.
- air_close: 75.5, 73.0, 72.5, 69.2, 69.2 / 75.5, 74.7, 76.6, 72.1, 72.2.
- air_heavy: 90.5, 90.5, 88.6, 82.0, 82.0 / 90.5, 90.5, 89.0, 82.0, 82.3.

**Short, long and timed-out cells**, weeks 2-6. A rival duel's floor is 45 s on both waves. The task's 75 s mark is the
wave-3 ceiling; air_light and air_heavy fight on wave 4, whose ceiling is 80 s.
- **Under 45 s, steady**:
  - `lag-ref`, 8 cells: fire_close w3-6 (40.1, 39.1, 38.1, 37.6) and fire_heavy w3-6 (44.5, 42.4, 39.5, 39.5).
  - `lag-def1-ref`, 7 cells: fire_close w3-6 (44.1, 41.6, 40.6, 40.1) and fire_heavy w3-5 (44.6, 43.6, 44.95).
  - The controls: `lag` 12 cells, `lag-def1` 8 cells, as in 6.10.
- **Under 45 s, untrained**: 7 cells in each range arm, fire_close w2-6 and fire_heavy w5-6. As in 6.10, the untrained short
  cells are the rival beating a rank-1 player fast.
- **Over 75 s, steady**: 10 cells in each range arm, air_light w2-6 (130.7-160.5 s) and air_heavy w2-6 (76.9-89.0 s).
  - Past the wave's own ceiling: `lag-ref` 7 (air_light w2-6, air_heavy w2-3); `lag-def1-ref` 10.
  - Untrained: 12 and 13 cells.
  - The controls: none for steady.
- **Timeouts**: air_light only, every week, in both profiles.
  - Steady weeks 2-6: `lag-ref` 409 of 1000 fights (134, 109, 79, 44, 43); `lag-def1-ref` 584 (141, 131, 123, 95, 94).
  - Week 1: 132 of 200 in both arms.
  - No wave cell and no other build timed out. The controls have none.
- **The final and the semifinal** are the Water proxy, which is no build, so each range arm reads exactly as its base arm.
  - `lag-ref`, as `lag`: final 68.0, 67.5, 67.0, 62.5, 60.5% and semifinal 93.0, 91.5, 90.0, 83.5, 82.5% in weeks 2-6.
  - `lag-def1-ref`, as `lag-def1`: final 74.5, 75.0, 75.5, 64.5, 61.0% and semifinal 95.0, 95.0, 93.5, 84.0, 80.0%.
  - Untrained week 4 final: 29.5% (`lag-ref`) and 19.5% (`lag-def1-ref`).
- **Single builds over 65%**, steady weeks 2-6:
  - `lag-ref`: w2 fire_light 67.0, air_close 81.0; w3 fire_light 70.0, air_close 82.5; w4 fire_light 66.0, air_close 74.5;
    w5 and w6 air_close 75.0.
  - `lag-def1-ref`: w2 fire_light 68.0, air_close 84.0; w3 fire_light 71.0, air_close 85.5; w4 fire_light 70.5, air_close
    82.0; w5 air_close 78.5; w6 air_close 77.0.
  - At the other end, every week of both arms: fire_close 0.5-1.5% and air_light 1.0-6.0%. The controls have no single
    build under 40% for steady.

**Against the section 6 targets** (builds mean; the targets are read for weeks 2-6, because week 1 is the plain census in
every arm before this one, 6.8):

| Arm | Steady 50-65%, weeks 2-6 | Untrained under 40%, week 4 | Rival duels under 45 s (steady) | Over 75 s (steady) | Timeouts (steady) |
|---|---|---|---|---|---|
| `lag` (control) | 56.8, 57.6, 56.3, 52.3, 51.0: **hit** | 29.5%: **hit** | 12: **miss** | 0 | 0 |
| `lag-def1` (control) | 59.0, 60.8, 60.6, 54.4, 52.0: **hit** | 24.1%: **hit** | 8: **miss** | 0 | 0 |
| `lag-ref` | 36.3, 41.9, 40.4, 36.7, 36.7: **miss** (every week) | 26.1%: hit | 8: **miss** | 10 | 409 |
| `lag-def1-ref` | 37.5, 43.6, 42.9, 38.9, 37.8: **miss** (every week) | 21.7%: hit | 7: **miss** | 10 | 584 |

The untrained hit under the range arms is hollow: week 1 already reads 33.0%, so the untrained player does not fall below
40% by week 4. They start there.

**Why the range breaks the duels it does not lengthen.** A build's band is its best range by construction: it is cut from
the build's own rows. The Water reference has no row built for it. Its rows reach 12 m (Rain Needle, Tide Orb; Tide Orb's
tier-IV form 10 m), Lash 2.5-3 m, and Mirror's tier-IV wave 8 m.
- **Too far.** Against air_light (9.8-14 m) and air_heavy (10.5-13.3 m) the reference holds where its own rows reach only
  part of the time. air_light times out in 43-141 of 200 fights a cell, and air_heavy runs past its ceiling.
- **Too close.** Against fire_close (2.0-3.4 m) the reference stands inside the build's Ring and Flick and wins 0-1.5%.
  air_close (3.0-5.1 m) goes the other way, 74-86%, and runs 57-76 s. Both close duels leave the 40-65% range.
- So the range hands each build its own range, except where the reference outreaches it, and the curve collapses. Steady
  falls 14-22 points under its base arm in every week.

**fire_heavy, the duel 6.10 named.** Its band (9.0-11.4 m before tier III) sits inside the reference's 12 m, so this is the
fair reading the option was built for. The damage does move out. A read-only reach reading, steady week 4, 200 seeds
(`npx tsx packages/core/scripts/report-reach.ts --count 200 --week 4 --arm <arm>`):

| Arm (steady, week 4) | fire_heavy | Player's damage: <=5 m / 5-8 m / >8 m | Rival's damage: <=5 m / 5-8 m / >8 m |
|---|---|---|---|
| `lag` (6.10) | 65.5%, 38.5 s | 4 / 47 / 49% | 6 / 58 / 36% |
| `lag-ref` | 48.5%, 42.4 s | 0 / 26 / 74% | 1 / 14 / 85% |
| `lag-def1-ref` | 48.5%, 43.6 s | 1 / 26 / 73% | 1 / 14 / 85% |

Even so, **fire_heavy does not reach 45 s.**
- It does reach 45 s in week 2: 46.1 s (`lag-ref`) and 46.3 s (`lag-def1-ref`), against 44.5 s under both controls.
- It also reaches it in week 6 under `lag-def1-ref` (45.4 s).
- In weeks 3-5 it stays short under both arms: 39.5-44.5 s (`lag-ref`) and 43.6-44.95 s (`lag-def1-ref`).
- Fought at its own range, it gains 1.6-3.9 s over `lag` in weeks 2-4, and its reference win share falls from 56.0-68.0% to
  34.0-48.5%.
- So the chase was part of fire_heavy's short duel, a few seconds, and not the gap. What is left is in the duel itself: a
  ranked heavy build against a ranked reference, without the chase.

**The reading, plainly: the reference range is ruled out as the duration lever.** Neither range arm meets a win target that
its base arm met: steady falls to 36-44% in every week. Each arm still has 7-8 short cells, adds 10 long cells and 409-584
timeouts, and puts fire_close and air_light out of reach (0.5-6.0%). Its one clean reading, fire_heavy, gains a few seconds
and stays under 45 s in weeks 3-5. A narrower shape could be built: the range for far builds only, or the band clipped to
the reference's own reach. That would be a fourth lever, and this brief proposes none.

**Recommendation: no arm meets the section 6 targets, so D1 duel duration is now an owner question.** Nothing is turned on,
no default moves, and no further lever is proposed. The best measured arm is still `lag-def1` (the 6.10 Director default,
owner to confirm). It meets both win targets in weeks 2-6, with no long cell and no timeout. It leaves 8 short steady cells:
fire_heavy in weeks 2-6 (39.5-44.5 s) and air_close in weeks 4-6 (41.7-43.1 s). The owner's choices, each with its census
number:
- **Accept `lag` + rank defence 0.05 and relax the rival-duel floor for the ranked weeks.** A 40 s floor would leave one
  steady cell short, fire_heavy week 4 at 39.5 s (6.10, 6.11).
- **Accept `lag` + rank defence 0.1 (`lag-def2`).** It has 4 short cells, all fire_heavy (41.0-44.8 s), but steady week 3
  reads 65.4%, 0.4 over the ceiling (6.10).
- **Keep the 45 s floor and ask for a further lever.** 6.9-6.11 have now measured four lever shapes: rival HP, exchange
  reach, rank defence, reference range. None closes fire_heavy alone.

The Director's lean is the first: it keeps both win targets and moves no band but the floor. It is the owner's call. 4.1 E
is closed as measured. The option stays in the core off by default, as a census tool, with no re-pin.

### 6.12 Duel duration as built: lag plus rank defence 0.05 behind the skill-book flag, 2026-10-26

Owner ruling 2026-10-25 #3: adopt `lag-def1` (6.10) as the duel-duration answer. It is wired for a flag-on season only; the file's
`enabled` stays `false`, so nothing plays by default.

**As built.** `prepareBout` (season.ts) records two optional fields on a `SeasonBout` whose season carries `p.skills` (only
created with the skill-book flag on) and is the player's own bout: `opponentMage { averageRank: rivalProfiles.lag[week - 1] }`
(the bout's campaign week, the one that sets `enemyLevel`; week 1 included, as in the census) and `rankDefence { hpPerRankStep:
0.05 }`. `startBout` passes both to `createGames`, so `replayBout` reproduces them. No opponent-mage HP level (6.9). Both keys are
absent when unset, like `enemyLevel` and `spellRanks`, so flag-off bouts, their JSON and `boutHash` are unchanged.
The reading moved from the census script into `src/arena/week-profiles.ts` (`weekProfiles`, `rivalProfiles`, `rivalHpLevels`,
checked at load); `week-census.ts` re-exports it. The 0.05 is data: `progression-weeks.pc.json` `seasonRival { profile: "lag",
hpPerRankStep: 0.05 }`, checked at load (`rankDefenceProblems`, profile names a `rivalProfiles` entry); the `lag-def1` arms read it.

**Spectator bouts get no levers.** The rival curve lags the *player's* ranks and a spectator's bout plays an AI mage with no bought
ranks, so there is nothing to lag behind; a watched bout stays as it was.

**Proofs.**
1. Flag off: no golden, census digest or CR-002/CR-007 check was touched; the full suite's goldens (replay-golden.test.ts and the rest) pass
   unedited, and the `lag-def1` sweep below reproduces the 6.11 control digest for digest, so the census path the refactor moved is unchanged.
2. Flag on: `season.test.ts` turns the flag on with `createSeason(true)` (never the JSON), prepares a bout in each of weeks 1-6 (it opens
   `weeksPlayable` to 6 for the test; the chapter plays two), asserts the levers, that they equal the `lag-def1` arm's
   `armOption`/`armExtras` for that week, and that `replayBout` matches the hash. The season path cannot reproduce the census digests
   directly: the census fights the reference player with the profile's ranks on a census seed, while a season bout fights the camp
   entrant with bought ranks on a camp seed. Equality is proven at the `createGames`-options level (`opponentMage`, `rankDefence`,
   `enemyLevel`; `spellRanks` is the player's own). The census itself, re-run the 6.10 way (`census:weeks -- --count 200 --profile
   steady --arm lag-def1`, seeds 40000-40199, `d1-612-weeks-arm-lag-def1.json`), gives builds means 47.3, 59.0, 60.8, 60.6, 54.4, 52.0%
   (weeks 1-6), the 6.10 numbers, and all 60 steady-cell digests equal `d1-611-weeks-arm-lag-def1.json`'s.
3. The save schema: see the open ask below.

**Open ask (blocks the gate).** `packages/director/src/save-schema.ts` lists the bout's keys closed; the two new fields make a flag-on
prepared bout fail `validatePayload` ("must NOT have additional properties"), so `skill-book-save.test.ts` (2 tests) goes red. The fix is
additive (optional `opponentMage`, `rankDefence` on the bout schema; `save.ts` already re-prepares and hashes the bout), but it is a season
save schema change, which needs an ask.

**Save schema (resolves the ask above).** The save schema carries both keys as optional and bounded (`bout.opponentMage { averageRank }` 1..maxSpellRank in halves, `bout.rankDefence { hpPerRankStep }` in (0, 1], extra keys and non-finite values refused); a save without them loads and encodes as before (`8ff325a`, `save-schema.ts`, `skill-book-save.test.ts`).

Commits: `ad63b19` (week profiles to src, `seasonRival` data), `3590414` (season levers and test).

### 6.13 Brand Drag re-judged, 2026-10-27

6.2 left Brand Drag (Brand Wrath rank 5) neutral and named two ways out: longer heavy fights or a cheaper tier-IV row. Three
arms are built in the PC overlay (`school-balance.pc.json` `brandDrag.arms`, code in `packages/core/src/arena/brand-drag.ts`),
all **off by default** (no arm is selected unless a census passes `--brand-drag <arm>`), each applying to a rank-5 Brand Wrath
only: `reserve` (the heavy plan keeps Wrath's mana one tier earlier), `early` (Wrath opens at tier III instead of IV), `quick`
(Wrath cooldown 20 s -> 10 s). Read the 6.2 way: `census:builds -- --only fire_heavy --ranks fire_heavy:fire_wrath=<4|5>
[--brand-drag <arm>]`, 200 seeds (40000-40199), exchange windows on. Evidence: `docs/change-requests/evidence/d1-brand-drag-<arm>-r<4|5>.json`
(the builds summary now carries `castsPerFight`). Every figure below is read from those files.

| Arm | Rival tier-IV share, rank 4 -> 5 | Reference wins | fire_heavy median | Wrath casts / fight | Short fights (rank 5) |
|---|---|---|---|---|---|
| off (control) | 52.8% -> 53.5% | 42.0% -> 41.5% | 46.5 -> 46.5 s | 0.63 -> 0.63 | 0 |
| reserve | 52.8% -> 53.5% | 42.0% -> 41.5% | 46.5 -> 46.5 s | 0.63 -> 0.63 | 0 |
| early | 52.8% -> 54.5% | 42.0% -> 26.0% | 46.5 -> 39.0 s | 0.63 -> 1.28 | 10 |
| quick | 52.8% -> 55.9% | 42.0% -> 40.0% | 46.5 -> 46.5 s | 0.63 -> 0.71 | 0 |

- **reserve** changes nothing: its digest equals the control's at both ranks, so the heavy plan was not mana-starved at tier IV.
- **early** presses Wrath twice as often (1.28 casts a fight) and the signature leans the right way (tier-IV share +1.7 pp), but
  the build leaves the band: reference wins 26.0% (floor 40%), median 39.0 s (floor 45 s), 10 fights end before tier III. Out.
- **quick** stays inside the band (40.0%, which is the floor itself, and 46.5 s) and leans the right way (+3.1 pp tier-IV share
  against +0.7 pp for the control), but Wrath rises only 0.63 -> 0.71 casts a fight and the lean is small against the noise of
  127 tier-IV fights (about 4 pp standard error). It also takes fire_heavy from 41.5% to the 40.0% floor.
- **Default census**: the six-build default census re-runs `d1-ultimates-after.json` digest for digest (`census:compare`: all
  `same`), and the named duels re-run `d1-named-after.json` the same way (`d1-brand-drag-named-default*.json`). Goldens and the
  parity suites are untouched (the arms read nothing unless selected).

Reading: no arm both moves the signature measurably and keeps fire_heavy in its band. `early` moves it by changing the fight, not
the ultimate; `quick` is in band but inside the noise. `quick` stays a Director default behind the flag (owner to confirm);
nothing is turned on.

### D1 section 6 scorecard (goal 2), 2026-10-25

Each section 6 bullet, read off the census. "Owner-pending" marks a result that holds only under a Director default the
owner has not confirmed, or a target the owner has to set.

| Section 6 bullet | Mark | Census number | Source |
|---|---|---|---|
| Close builds: median inside 45-75 s (default census) | **met** | fire_close 67.0 s, air_close 50.7 s | 6.1, 6.2 (`d1-ultimates-after.json`) |
| Close builds: reference wins 40-65% (default census) | **met** | fire_close 49.5%, air_close 40.0% (on the floor) | 6.2, 6.4 margin note |
| Close builds: hits per exchange falls | **met** | fire_close 2.29 -> 0.61, air_close 1.91 -> 1.30 | 6.1 (`d1-exchange-before/after.json`) |
| Every rival duel's median in band through the ranked weeks (the duration reading of 6.9-6.11) | **missed**; owner-confirmed 2026-10-25: `lag-def1` adopted behind the flag (6.12) | best arm `lag-def1`: 8 steady cells under 45 s (fire_heavy w2-6, air_close w4-6), 0 over the ceiling; fire_heavy never reaches 45 s in weeks 3-5 under any 6.10 or 6.11 arm | 6.10, 6.11, 6.12 |
| Ultimates: every committed rank-5 build inside the band | **met** | fire_heavy (Brand Wrath 5) 46.5 s, 41.5%; the only committed rank-5 row | 6.2 |
| Ultimates: each moves its curve signature the right way | **missed** (re-judged 6.13) | Brand Drag is neutral: the rival's tier-IV share goes 52.8% -> 53.5%, reference 42.0% -> 41.5% (Wrath about once a fight). Pinning Edge (Shear 5) leans the right way (-1.5 pp, short fights 16 -> 20) but takes air_close to 16.0%, out of the band, so it is not committed. 6.13 re-measured three Brand Drag arms: `early` leaves the band (26.0%, 39.0 s), `reserve` is identical to the control, `quick` stays in band (40.0%, 46.5 s) with tier-IV share 53.5% -> 55.9% but Wrath only 0.63 -> 0.71 casts a fight, inside the noise; stays missed | 6.2, 6.13 |
| Counters: each defensive row reaches its coverage target | **owner-pending** (N = 50% is a Director default) | Air Form 67.9% (61.1% lowest cell): met. Ring of Cinders 1.6%: missed. Tide Ward: none castable, best declined arm 25.7%, and stopped outside the target (Director default, owner to confirm) | 6.4, 6.5, 6.6 |
| Progression: a steadily training player wins 50-65% each week | **met weeks 2-6, owner-pending** | `lag`: 56.8, 57.6, 56.3, 52.3, 51.0%; `lag-def1`: 59.0, 60.8, 60.6, 54.4, 52.0%. Week 1 is the plain census at 47.3%, which no week lever reaches. Both arms are Director defaults, owner to confirm; nothing is on | 6.8, 6.10, 6.11 |
| Progression: a player who does not train falls below 40% by week 4 | **met, owner-pending** | week 4: `lag` 29.5%, `lag-def1` 24.1% (week 1: 47.3%) | 6.8, 6.10, 6.11 |
| Unchanged: goldens, default census digests, CR-002/CR-007 parity | **met** | Every lever in 6.7-6.11 is off by default. The default sweep re-runs `d1-weeks.json` (120 cells) and the `lag` control re-runs `d1-weeks-arm-lag.json` (120 cells), digest for digest. The only pins moved were moved with a reason in 6.1 (the named and builds census) | 6.1, 6.8, 6.10, 6.11 |

**Goal 2 in one line:** of the ten scorecard rows, 5 are met outright and 2 more are met in the census but owner-pending
(the progression rows wait on the owner to confirm `lag` and rank defence before anything plays in a bout). 2 are missed:
rival-duel duration on the week curve, and Brand Drag's curve signature. The counter target is owner-pending.

## 7. Open questions for the spark

1. Which close-duel option (A-E) fits the feel the owner wants: trading blows, dancing in and out, or guard breaks?
   **Option A, exchange windows (the doc's recommendation; built and measured in 6.1). Director default 2026-10-24,
   owner to confirm.**
2. Spell-rank currency: Games results, camp lessons, or both?
   **Owner, 2026-10-24:** "non-combat game activities - people in schools can teach you if aligned with you their
   signature spell, training gains skill points to invest in ranking of any spell, each rank and tier gets more points to
   level up". The chosen design is in 4.3.
3. Should a rank-5 ultimate be rare (one per build) or common late in the season?
4. Do changes to canonical numbers (Ring unlock, Tide Ward) go to VR as change requests, or stay PC overlay deviations?
   **They stay PC overlay deviations, and each is returned to VR as a change-request proposal, never applied to VR.
   For this slice: the exchange-window rule and its four numbers, in `docs/change-requests/CR-008.md`. Director default
   2026-10-24, owner to confirm.**

## 8. Tools to use

`census:builds`, `census:named`, `report:w4`, the threat-answer ledger (`ledger.ts`), the PC overlay
(`school-balance.pc.json`), `progression.pc.json`, `rival-builds.json`, the Lab build pickers, `vr:tuning-return`.
