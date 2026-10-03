# CF2 - combat feel implementation and measured limits

2026-10-04. [Design authored first](CF2-combat-feel-design.md). CF1 and the
[start guide](../START-HERE.md) were committed first at cd27240; U5 is 72d0fb7.

The shipping kernel now accelerates/brakes at 60/90 m/s^2, retains immediate aim,
slows movement while casting to .75, commits casts at .65 of windup, and has a
50 ms release recovery. Early roll cancellation spends the already-paid mana and
cooldown. Four-metre rolls keep 250 ms i-frames / 350 ms duration / 150 ms recovery;
recovery movement is half speed and does not inherit roll velocity. Unguarded
hits stagger for 50 ms, with a 160 ms immunity tail, and displace by .16 m per
10 damage. Guarding avoids stagger. Wave reset clears velocity and stagger.

Rules and the Lab share feel.json/tuning.ts. The Lab adds stagger grace and roll
recovery movement controls; version 2 exports accept/migrate version 1 imports.
[CF1 Current tuning](CF2-evidence/current-cf1-tuning.json) is retained for comparison
(it restores coefficients, not the previous AI implementation). Cast/projectile/
cooldown multipliers remain 1 in shipping Current. No damage/HP subsidy was added.

Authoritative release events carry spell/activation/location. Cast effects and
sound now follow the release event, windup animation follows pending duration,
and an interrupted cast never produces a release effect. HUD identifies the
cancel/committed phases. Impact feedback adds 2-3 frames of local hit stop,
65 ms white silhouette, bounded damage-scaled world shake, pooled damage numbers
(max 32), and damage-scaled gain through the existing impact/hit audio engine.
Perfect absorb shows a bright fresh-window arc, barrier compression, 120 ms local
slow-down and the actual +mana refund in both world and HUD. Reduced motion turns
off shake/stop/slow-down. Numbers and exact arc remain. Telegraph boundaries gain
contrasting under-strokes; minimum locators never change actual hit geometry.
All of this remains behind or beside the optional A13 painted-sigil boundary.

Hit stop/slow-down stretch local presentation time; fixed-step input order and
kernel time stay authoritative. Census/TTK are **simulation seconds**, not wall
seconds including those presentation holds. Replay uses the same snapshots but
does not recreate wall-time holds or re-trigger audio. Hardware latency and audio
mix quality have not been measured.

AI retains the competence ladder and observed-threat reaction floor of 250 ms,
uses pending spell snapshots for threat travel time, avoids new casts that
conflict with a planned ward, and varies strafe phase/spacing and useful spell
scores deterministically. No future inputs or resource/stat bypasses. Cast
commitment may prevent a late defensive decision, as it does for the player.

## Headless Lab comparison

100 fixed seeds 7331-7430 per opponent school, fresh Water Rotation reference AI
level 3 versus level 2 practice profile, aggression .75, distance 10 m, damage ON,
Current, 120 s cap. Raw [before](CF2-evidence/before.json) and
[after](CF2-evidence/after.json) retain every seed/outcome/hash. Values are before ->
after. "Opportunities" means incoming magic contacts (including blocks/perfects),
not every attack launched; misses/i-frame avoidance are excluded.

| Opponent | Wins / 100 | Winning TTK median (s) | Hits taken median | Magic contacts median |
|---|---:|---:|---:|---:|
| Fire | 2 -> 21 | 83.35 -> 69.38 | 36 -> 37 | 36 -> 37 |
| Water | 3 -> 32 | 91.33 -> 75.58 | 41 -> 41 | 42 -> 41 |
| Earth | 35 -> 53 | 88.15 -> 74.53 | 32 -> 29 | 35 -> 32 |
| Air | 0 -> 8 | none -> 77.37 | 49 -> 49 | 50 -> 49 |

There are no timeouts. Winning-TTK subsets change: Fire's old TTK has only two
wins, Water's three, and Air had none. These medians are not evidence of universal
improvement. Total perfects across these 400 bouts changed 539 -> 508; successful
wards 786 -> 707. The new feedback makes the rule visible; it does not demonstrate
that a human can perfect more often. Owner hands must settle that.

## Real-game census

Fresh 2,000 fights per wave, same seed range/reference composition/competence,
all outcomes retained: [census](CF2-evidence/census.json). Before is committed CF1
(which exactly matched U5). The 200-fight pilot is retained separately as draft.

| Wave | Median seconds | p90 seconds | Wins / 2,000 | New band (s) |
|---|---:|---:|---:|---|
| soldiers | 38.48 -> 36.02 | 45.88 -> 43.42 | 2000 -> 2000 | 25-40 |
| creatures | 45.08 -> 45.85 | 54.22 -> 55.87 | 2000 -> 2000 | 30-48 |
| semifinal | 45.48 -> 60.88 | 55.37 -> 74.33 | 1829 -> 765 | 45-75 |
| final | 58.00 -> 67.35 | 69.45 -> 81.83 | 1407 -> 794 | 45-85 |

All four gates pass: zero timeouts, invalid states, early losses or sampled replay
failures. Max durations are 59.98 / 75.85 / 96.10 / 104.05 seconds. The new bands
were declared before the full census: two extra seconds for creature movement/
recovery/displacement; five extra for duel commitments/defensive choices. Medians
also fit the old bands; the change is an explicit provisional pacing allowance.

**Difficulty is a material remaining owner check.** Reference duel win rates
fell from 91.45% / 70.35% to 38.25% / 39.70%. We did not discard seeds, force wins,
restore HP or silently buff the reference policy to conceal this. The scripted
reference is not a human skill model; the new game should not be called balanced
or more fun from these numbers. They are the reason to use the Lab before a
further balance pass. Soldier fights shorten; mage bouts become more deliberate.

## Verification and owner-only judgments

- `npm run gate`: 191 TypeScript tests + 11 reference tests, zero contradictions.
  Covers commitment/release, recovery, acceleration/braking, i-frames, stagger
  grace, JSON continuation, honest reaction ages, legacy tuning and presentation
  timing. Existing save tests replay prepared/active/intermission/terminal states.
- `npm run build:game`; `$env:MAGE_EVIDENCE='CF2'; npx tsx packages/tools/src/cf1-browser.ts`:
  both native resolutions, all CF1 interactions, zero HTML form controls,
  explicit before-release/release checks, hit/perfect screenshots, reduced motion.
  22 PNGs, zero page errors. Inspected white silhouette, ward and refund captures.
  [Browser metrics](CF2-evidence/browser.json): frame p95 16.7 / 16.8 ms,
  application CPU p95 1.2 / 1.3 ms. Short run, not physical latency or GPU timing.
- `$env:MAGE_EVIDENCE='CF2'; npx tsx packages/tools/src/u3-replay.ts`: exact
  1,300,369-byte season save round-trip; [record](CF2-evidence/replay-save.json).
- `npm --prefix packages/core run report:w4 -- --evidence CF2-evidence --tag census`
  and `npx tsx packages/tools/src/cf-report.ts after` reproduce the reports.

Only the owner can judge floaty/snappy/heavy movement, comfortable cancellation,
ward anticipation, perceived fairness, sound payoff and crowded readability.
The large inherited HUD still hides part of the southern arena. Full unique
non-Water catalogues and complete directional A10 clips remain future work;
practice profiles are labelled. Painted A13 sigils remain an art-stream delivery.
No art-worktree writes, provider calls or push. No outstanding gate failures.
