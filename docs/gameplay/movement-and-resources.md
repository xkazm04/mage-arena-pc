# Movement and resources

Purpose: defines how fighters move, roll and strike, the three combat resources (HP, mana, stamina), the collar tier clock, and recovery between bouts.
Status: built (W2 kernel, CF2 feel pass). All values are authored and verified by deterministic tests; movement feel is not owner-felt.

Sources (integration paths): `docs/design/reconciled/data/arena/combat.json` → [data/arena-design/combat.json](data/arena-design/combat.json); `packages/core/src/arena/data/feel.json` → [data/arena-runtime/feel.json](data/arena-runtime/feel.json); `stats.csv` → [data/arena-design/stats.csv](data/arena-design/stats.csv); `packages/core/src/arena/kernel.ts`.

## Simulation basics

- Fixed step 60 Hz (`combat.json/simStepHz`). Durations are rounded up to whole ticks.
- Tick order: tick → resource and status updates → inputs and ward edges → movement → cast completion and new casts → projectiles and impacts → cleanup → tier unlock.
- Stable actor order, swept projectile collision, one hit per target per activation.
- No wall clock, no unseeded randomness. Every random draw is seeded and logged with purpose and tick.

## Movement

| Parameter | Value | Source |
|---|---|---|
| Walk speed | 4.5 m/s | combat.json/movement |
| Sprint speed | 6.5 m/s | combat.json/movement |
| Sprint stamina cost | 15 per second | combat.json/movement |
| Acceleration | 60 m/s² | feel.json/defaults |
| Braking | 90 m/s² | feel.json/defaults |
| Body turn response (visual only) | 24 per second | feel.json/defaults |
| Move speed while casting | × 0.75 | feel.json/defaults |
| Move speed while ward is held | × 0.5 | combat.json/absorb |
| Body radius (mage) | 0.38 m | runtime.json/geometry |

- Aim is immediate. Visual body turning is smoothed, but the ward arc and hit arc always use the true aim direction.
- All movement, rolls, pushes, pulls and charges are clamped to the shared arena ellipse; the whole collision disk stays inside.

## Roll

| Parameter | Value | Source |
|---|---|---|
| Distance | 4.0 m | combat.json/roll |
| Duration | 0.35 s | combat.json/roll |
| Invulnerability (i-frames) | first 0.25 s | combat.json/roll |
| Stamina cost | 25 | combat.json/roll |
| Recovery | 0.15 s | combat.json/roll |
| Movement during recovery | × 0.5, no inherited roll velocity | feel.json/defaults |

- Direction: movement direction, otherwise facing.
- I-frames avoid both damage and stagger. A hit after the i-frames can stop the rest of the roll.
- A roll can cancel a cast before its commit point; the spent mana and cooldown stay spent.
- The ward cannot be raised during a roll.

## Staff strike

Pressing cast with slot 1 (Rain Needle) while an enemy is within range inside the front arc becomes a staff strike.

| Parameter | Value | Source |
|---|---|---|
| Range | 1.6 m | combat.json/staffStrike |
| Front arc | 90° | runtime.json/geometry/staffArcDeg |
| Windup | 0.25 s | combat.json/staffStrike |
| Recovery | 0.3 s | combat.json/staffStrike |
| Stamina cost | 12 | combat.json/staffStrike |
| Damage | 6, family physical | combat.json/staffStrike |
| Interrupts enemy casts and windups | yes | combat.json/staffStrike |

The staff strike is the answer to an unblockable caster in reach ("leave it or break it").

## Resources

Base values come from the fighter's ranks (see [camp-phase.md](camp-phase.md#stats-the-player-trains)). Source: `stats.csv`.

| Resource | Formula | Rank 1 | Cassia at season start (vigor 1, focus 3, nerve 1) |
|---|---|---|---|
| Max HP | 80 + 15 × vigor | 95 | 95 |
| Max stamina | 60 + 10 × vigor | 70 | 70 |
| Max mana | 80 + 15 × focus | 95 | 125 |
| Mana regen | (6 + 1.5 × focus) per s | 7.5/s | 10.5/s |
| Ward drain | (30 − 3 × nerve) mana per s held | 27/s | 27/s |
| Perfect refund multiplier | 1 + 0.1 × nerve | 1.1 | 1.1 |

- Stamina regenerates 20 per second after 0.8 s without spending (`combat.json/stamina`).
- Mana regenerates continuously, including while the ward is held.
- Training and Lab fighters default to rank 1 in vigor, focus and nerve (`runtime.json/training/defaultRanks`).
- Season penalties: fatigue costs 2 max stamina per point; poison costs 10 HP and 20 max stamina at the next Games (`season-bridge.json`, `rules.json/schemes/poison`).
- Cassia's starting stats come from `characters.json` (campaign data).

## Collar tier clock

The collar is the spine of combat pacing: spell tiers unlock with time, and each slot upgrades in place.

| Parameter | Value | Source |
|---|---|---|
| Tier I unlocks | 0 s | combat.json/tierClock |
| Tier II | 15 s | |
| Tier III | 30 s | |
| Tier IV | 45 s | |
| Perfect absorb advances the clock by | 2.0 s | tierClock.perfectAbsorbAdvanceS |
| Minimum time between unlocks | 6.0 s | tierClock.minimumSecondsBetweenUnlocks |
| Resets each wave (bout) | yes | tierClock.resetsEachWave |

- The clock is per fighter: each actor has its own tier and its own perfect-absorb credit. Unlock time for tier n = (n − 1) × interval − accumulated perfect credit, but never sooner than 6 s after the previous unlock.
- The interval is 15 s by default; the Lab exposes it as `collarIntervalS` (6–30 s).
- A cast already in progress keeps its spell snapshot when a tier unlocks. Unlocking a tier never clears a cooldown.
- Audio: tier II and III start the full-length arena tracks (U6b); a rune tick sound marks unlocks.

## Between bouts (waves)

Source: `combat.json/betweenWaves`.

| Effect at "Enter the next bout" | Value |
|---|---|
| HP | heal 30% of missing HP |
| Mana | refill to 100% |
| Stamina | refill to 100% |
| Collar clock | reset to tier I |
| Effects, cooldowns, Flow, stored damage | cleared |
| Composition | kept (locked for the whole Games) |

## Pacing guardrails

Source: `combat.json/reactionBands`.

| Rule | Value |
|---|---|
| Minimum warning for positional (ground) threats | 0.4 s |
| Minimum warning for unblockable threats | 0.8 s |
| The player may not be defeated before | 5.0 s into a bout (census gate) |

These floors hold even when the Lab shortens cast times.

## Superseded

| Old | Current | Source |
|---|---|---|
| Instant start/stop movement (W2–U5) | 60/90 m/s² acceleration/braking, cast move × 0.75 | CF2 |
| Full-speed movement after a roll | × 0.5 during roll recovery | CF2 |
| `combat.json/aimMode` (hold-to-aim, soft-lock) | Not used with mouse aim | W2, D4 |
| `stats.csv` on_reset / Echo | No resets in a season | D2 |
