# D1. Combat follow-up: close duels, ultimates, and the campaign progression curve

Status: **direction menu**, written 2026-10-23 for future sessions. The section 5 slice is built (2026-10-24): exchange windows (6.1), the Third Blade rework and the heavy payoff sequence (6.2), and the week sweep reading (6.3). The 4.3 skill book is built behind an off-by-default flag, with its week curve (6.7, 2026-10-24). It follows
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
`boutSpellRanks` gives `undefined`. Nothing in `season.ts`, `camp*.ts` or the arena calls the book, so today's bouts,
goldens, the default census digests and CR-002/CR-007 parity are unchanged. Run on this branch: the parity suites, golden
replays, the determinism wall and the week sweep test are green, and the full `npm run test` passes. Nothing was re-pinned.

**Not persisted.** The season save does not carry the book. The schema change it needs (points, ranks and taught signatures
on the save, and `prepareBout` passing the ranks into the entrant) is an open ask, not built.

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
