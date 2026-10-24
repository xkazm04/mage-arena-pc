# D1. Combat follow-up: close duels, ultimates, and the campaign progression curve

Status: **direction menu**, written 2026-10-23 for future sessions. The section 5 slice is built (2026-10-24): exchange windows (6.1), the Third Blade rework and the heavy payoff sequence (6.2), and the week sweep reading (6.3). It follows
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

| Question | Options |
|---|---|
| How does the player earn **spell ranks**? | (a) points from Games results (renown or a new "insight" currency); (b) camp lessons per school, like focus training at the cistern; (c) both: Games results unlock, camp spends |
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

## 7. Open questions for the spark

1. Which close-duel option (A-E) fits the feel the owner wants: trading blows, dancing in and out, or guard breaks?
   **Option A, exchange windows (the doc's recommendation; built and measured in 6.1). Director default 2026-10-24,
   owner to confirm.**
2. Spell-rank currency: Games results, camp lessons, or both?
3. Should a rank-5 ultimate be rare (one per build) or common late in the season?
4. Do changes to canonical numbers (Ring unlock, Tide Ward) go to VR as change requests, or stay PC overlay deviations?
   **They stay PC overlay deviations, and each is returned to VR as a change-request proposal, never applied to VR.
   For this slice: the exchange-window rule and its four numbers, in `docs/change-requests/CR-008.md`. Director default
   2026-10-24, owner to confirm.**

## 8. Tools to use

`census:builds`, `census:named`, `report:w4`, the threat-answer ledger (`ledger.ts`), the PC overlay
(`school-balance.pc.json`), `progression.pc.json`, `rival-builds.json`, the Lab build pickers, `vr:tuning-return`.
