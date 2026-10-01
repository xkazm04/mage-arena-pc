# Spell sheet: Fire (the Ember Tent), Variant 1

Data: `data/spells-fire.csv` (the single source; this sheet explains it). Constants:
`data/combat.json`. All numbers are authored and are tuned in W5 by Monte-Carlo; feel is the
owner's call.

## The rules every Fire spell lives under

- **Four slots, one Bolt.** Ember Dart is always on the Bolt button. The four slot buttons hold
  any four learned spells. A slot holding a tier N spell is dark until the collar unlocks tier N.
- **The collar clock.** Tier 1 from 0 s, tier 2 at 15 s, tier 3 at 30 s, tier 4 at 45 s. Each
  perfect absorb advances the clock by 2 s (never closer than 6 s between two unlocks). The clock
  resets each wave.
- **Heat** (0..100). +2 per Ember Dart hit, +6 per Flick Flame target, +12 per unabsorbed hit
  taken, +3 per second with an enemy inside 3 m; -6 per second after 2 s without a gain.
  **Kindled** at 50: spell damage x1.15. **Blazing** at 80: x1.30, but absorb drains 1.5x and
  stamina regenerates at 0.7x. Fire is paid for standing close and hitting, and taxed for hiding
  behind the ward.

## The spells

| Tier | Spell | Shape | Cast | Cooldown | Mana | Damage | Blockable | Telegraph | Job |
|---|---|---|---|---|---|---|---|---|---|
| 0 | **Ember Dart** | projectile 18 m/s, 12 m | 0 | 0.30 (rate) | 4 | 8 | absorbable | none | the always-on poke; staff strike inside 1.6 m |
| 1 | **Flick Flame** | cone 60 deg, 4 m | 0.15 | 3.0 | 12 | 20 | absorbable | 0.15 | close punisher, Heat engine |
| 1 | **Cinder Step** | dash 5 m + trail 2 s | 0 | 6.0 | 15 | 6 per 0.5 s tick | absorbable | none | mobility that costs mana, not stamina |
| 1 | **Kindle** | self | 0.40 | 10.0 | 8 | 0 | n/a | none | +25 Heat without contact; rooted while casting |
| 2 | **Brand Lance** | line 14 m, pierces | 0.60 | 7.0 | 25 | 32 | absorbable | 0.60 line | breaks Scutum walls; the duel's mid-game threat |
| 2 | **Ring of Cinders** | ring r 3 m, knockback 2 m | 0.30 | 9.0 | 22 | 18 | absorbable | 0.30 | answer to hounds and conscripts |
| 3 | **Pyre Circle** | circle r 3 m at a point | 0.50 | 12.0 | 40 | 48 | absorbable | 0.80 ring fill | area denial; forces the enemy to move or absorb |
| 3 | **Furnace Heart** | self, 6 s | 0.50 | 16.0 | 30 | 0 | n/a | none | Heat locked at 100; absorb drain x2 while it lasts |
| 4 | **Sunfall** | meteor r 3.5 m | 0.80 (rooted) | 25.0 | 70 | 95 | **UNBLOCKABLE** | 1.20 growing shadow | the finisher; interruptible by a staff strike |
| 4 | **Brand Wrath** | beam 10 m, 2.0 s channel | 0.20 | 20.0 | 60 | 14 per 0.25 s tick | absorbable | 0.20 | sustained pressure; only its first tick can be perfect-absorbed |

## Composition: three legal loadouts and what they say

The player composes before each Games day (the Door screen). A loadout is a bet on how long the
fight will last and how many perfect absorbs the player will land.

| Loadout | Slots | The bet | Weak to |
|---|---|---|---|
| **Pit-dog** (early curve) | Flick Flame, Cinder Step, Kindle, Ring of Cinders | Every slot is live by 15 s; win the soldier and creature waves fast and Blazing | A patient mage who absorbs and waits for tier 3 |
| **Brand** (middle curve) | Flick Flame, Cinder Step, Brand Lance, Pyre Circle | Two live slots at once, Lance by 15 s, Pyre by 30 s; the all-rounder | Hush moths (no area until 30 s) |
| **Sunfall gambit** (late curve) | Flick Flame, Brand Lance, Furnace Heart, Sunfall | Two dark slots for 30 s; three perfect absorbs bring Sunfall at 39 s instead of 45 s | Soldier waves (empty slots), anyone who out-spaces the meteor |

## How a Fire duel is meant to feel (authored intent, owner certifies)

0-15 s: dart and flick at close range, build Heat, absorb the opponent's darts, try a perfect
absorb on their first tier-1 spell. 15-30 s: Brand Lance comes alive; the line telegraph tells
the opponent where not to stand. 30-45 s: Pyre Circle forces movement into the Lance. 45 s, or
earlier with perfect absorbs: Sunfall, which they cannot absorb, only leave or break with a
staff strike while you are rooted. The Fire player's risk is the root and the Blazing absorb tax.

## Tests that pin this sheet (W4)

- Every spell has a unit-suffixed cast, cooldown, mana and damage; a positional area spell has
  telegraph >= 0.40 s; an unblockable has telegraph >= 0.80 s (spell linter, reads the CSV).
- A scripted dummy fight with each loadout produces a damage-per-second curve per 15 s window;
  the Sunfall gambit's 0-30 s DPS is lower than Pit-dog's, and its 45-60 s DPS is higher
  (the curve claim is checked, not assumed).
- A bot that perfect-absorbs 3 times unlocks tier 4 at 39.0 s +- one step.
- Brand Wrath's ticks dedup per tick id; a perfect absorb on tick 2 is impossible.
