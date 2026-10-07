# Casting and spells

Purpose: defines the spell slots, the cast pipeline (windup, commit, release, recovery, cooldown), the complete Water spell catalogue with branches, the Flow/Crest combo, and the practice profiles for the other three schools.
Status: Water catalogue built (W3, tuned in W4, commit/recovery in CF2). Fire, Earth and Air have only **practice profiles** (multipliers over Water spells) in the Combat Feel Lab; their own catalogues are planned (W8). Values are authored and simulated; not owner-felt.

Sources: [data/arena-design/spells-water.csv](data/arena-design/spells-water.csv) (integration `docs/design/reconciled/data/arena/spells-water.csv`), [combat.json](data/arena-design/combat.json) `lines` and `flow`, [runtime.json](data/arena-runtime/runtime.json) `water`, [feel.json](data/arena-runtime/feel.json), [lab-schools.json](data/arena-runtime/lab-schools.json), `packages/core/src/arena/water.ts`.

## Slots and composition

- Four slots. **Slot 1 is always Rain Needle** (the `bolt` line). Slots 2–4 each hold one of the five Water lines; a line can appear only once.
- Each line climbs tiers **in place**: the slot's spell becomes the line's tier II, III, IV spell as the collar unlocks (see [movement-and-resources.md](movement-and-resources.md#collar-tier-clock)).
- Branches (A/B) exist only where the data has two rows: Lash II, Mirror II, Tide Orb IV. The branch is chosen on the composition screen.
- The composition is chosen before a bout and is locked for all four bouts of a Games. No live loadout swaps.
- Planned (not built): one slot may hold a line lent by a sworn cross-tent friend (`combat.json/lines/borrowedLine`, the duality arc).

Named presets (`runtime.json/water/presets`):

| Preset | Slots 2–4 | Branches (Lash / Mirror / Tide Orb) |
|---|---|---|
| Undertow | Lash, Tide Orb, Mire | A / A / A |
| Mirror tide | Mirror, Mend, Tide Orb | A / A / B |
| Rotation | Tide Orb, Lash, Mirror | B / B / B |

Rotation is the census reference loadout; Undertow and Mirror tide are the AI opponent presets.

## Cast pipeline

| Step | Rule | Value |
|---|---|---|
| Input | Holding left button casts whenever the selected slot is ready | — |
| Check | Enough mana (or a ready Crest), line cooldown finished, no other pending cast, not staggered, not defeated | — |
| Commitment | Mana is paid and the **line cooldown starts at cast start** | — |
| Windup | The effect releases at `max(cast_s, telegraph_s)` after cast start | from CSV |
| Commit point | Before 65% of the windup, a roll may cancel the cast; after it, the cast is committed | `castCommitFraction` 0.65 |
| Cancel | Roll before commit, or a stagger at any time: no release, **mana and cooldown stay spent** | — |
| Release | A simulation release event carries spell, activation and location; effects and sound fire on this event | — |
| Recovery | Short lockout after release | `castRecoveryS` 0.05 s |
| Movement | × 0.75 while casting | `castMoveMultiplier` |

- Cooldowns are per line and shared across that line's tiers.
- The ward cannot be raised while a cast is pending.
- A cast keeps a snapshot of its spell; a tier unlock or a Lab tuning change during the windup does not alter it. Travelling projectiles keep their launch speed.
- A failed cast attempt (no mana, on cooldown, passive spell) does not change Flow.

## Water spell catalogue

Source: `spells-water.csv`, unchanged. Damage values are the **W4-tuned** numbers (W4 halved Water direct damage to meet pacing; Rain Needle 2.05). "Blockable" uses the threat families in [ward-and-absorb.md](ward-and-absorb.md).

| Line | Tier | Branch | Spell | Shape | Cast s | Cooldown s | Mana | Damage / effect | Blockable | Telegraph s | Range m | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| bolt | 0 | | Rain Needle | projectile 20 m/s | 0.00 | 0.25 | 3 | 2.05 | absorbable | 0.00 | 12 | always slot 1; inside 1.6 m it is a staff strike |
| tide_orb | 1 | | Bubble Shot | projectile 12 m/s | 0.15 | 2.5 | 10 | 7 | absorbable | 0.15 | 12 | |
| tide_orb | 2 | | Crash Orb | projectile 12 m/s, bursts r 2 m | 0.20 | 4.0 | 16 | 12 | absorbable | 0.20 | 12 | burst hits each target once |
| tide_orb | 3 | | Twin Tides | two projectiles 12 m/s at ±10° | 0.25 | 5.0 | 24 | 11 each | absorbable | 0.25 | 12 | |
| tide_orb | 4 | A | Leviathan Orb | slow projectile 6 m/s, r 1.5 m | 0.60 | 14.0 | 45 | 40 | UNBLOCKABLE | 1.00 | 14 | path is drawn; leave it or break the caster |
| tide_orb | 4 | B | Rain of Orbs | 5-orb fan 50° | 0.40 | 10.0 | 40 | 9 each | absorbable | 0.40 | 10 | fan speed 12 m/s (runtime.json) |
| lash | 1 | | Tide Lash | cone 90° × 3 m | 0.10 | 2.0 | 8 | 8 | absorbable | 0.10 | 3 | |
| lash | 2 | A | Undertow | cone 3 m + pull 3 m | 0.20 | 5.0 | 14 | 9 | absorbable | 0.20 | 3 | pulls into Lash range |
| lash | 2 | B | Riptide | cone 3 m + push 3 m | 0.20 | 5.0 | 14 | 9 | absorbable | 0.20 | 3 | makes space for orbs |
| lash | 3 | | Maelstrom Lash | ring 360°, r 3 m | 0.30 | 8.0 | 22 | 15 | absorbable | 0.30 | 3 | anti-hound |
| lash | 4 | | Drown Coil | grab 2.5 m; root 1.5 s | 0.40 | 16.0 | 40 | 25 | UNBLOCKABLE | 0.80 | 2.5 | ring fills for 0.8 s; roll out |
| mire | 1 | | Puddle | ground r 2.5 m; slow 30% for 4 s | 0.20 | 6.0 | 10 | 0 | n/a | 0.40 | 10 | |
| mire | 2 | | Fog Bank | ground r 3 m for 5 s; blocks line of sight; breaks soft-lock | 0.30 | 10.0 | 18 | 0 | n/a | 0.40 | 10 | AI cannot acquire targets through it; manual aim still works |
| mire | 3 | | Freeze Field | ground r 3 m; root 1.0 s | 0.30 | 12.0 | 28 | 5 | absorbable | 0.80 | 10 | positional: ring fills 0.8 s |
| mire | 4 | | Glacier Tomb | encase one target 2 s (immune, silenced) | 0.50 | 20.0 | 40 | 0 | n/a | 0.80 | 8 | targets the enemy nearest the cursor (radius 2 m); resets its Flow; passive regen continues |
| mend | 1 | | Cool Draught | self heal | 0.40 | 8.0 | 12 | heal 12 | n/a | 0 | 0 | |
| mend | 2 | | Tide Ward | self: ward drain −50% for 4 s | 0.20 | 12.0 | 15 | 0 | n/a | 0 | 0 | |
| mend | 3 | | Spring | self heal over time | 0.40 | 16.0 | 25 | heal 30 over 5 s | n/a | 0 | 0 | |
| mend | 4 | | Font | self: restore 60 mana | 0.60 | 30.0 | 0 | 0 | n/a | 0 | 0 | caster is rooted while casting |
| mirror | 1 | | Sheen | self 3 s: absorbed magic refunds +50% mana | 0.10 | 8.0 | 8 | 0 | n/a | 0 | 0 | multiplies the perfect refund only |
| mirror | 2 | A | Reflection | passive while slotted: a perfect absorb reflects the projectile | 0 | 0 | 0 | as reflected | n/a | 0 | 0 | only magic projectiles of tier ≤ own tier; reflected shots cannot be reflected again |
| mirror | 2 | B | Ripple | passive while slotted: a perfect absorb releases a ring r 3 m | 0 | 0 | 0 | 7.5 | absorbable | 0 | 3 | cannot chain into another Ripple |
| mirror | 3 | | Mirage | decoy for 3 s draws soft-lock | 0.20 | 12.0 | 20 | 0 | n/a | 0 | 6 | redirects AI aim; player aim is never affected |
| mirror | 4 | | Return Tide | release stored absorbed damage as a wave (max 40) | 0.30 | 18.0 | 20 | stored (max 40) | absorbable | 0.30 | 8 | stores 50% of damage prevented by the ward since last release; wave 12 m/s, r 1 m, pierces; empties even on a miss |

Rules from W3 that the CSV does not state:

- Mirror II passives stay active at later tiers while the line is slotted. Pressing a passive slot does nothing.
- Puddle slows anyone standing in it while active. Freeze Field roots once after its warning. Spring heals in fixed ticks.
- Damage, healing and statuses never affect DEFEATED actors.
- Current statuses in the simulation: slowed, rooted, warded (Tide Ward), sheen, encased. There are no burning or wet statuses yet.

## Flow and Crest (Water combo)

Source: `combat.json/flow`, `water.ts`.

| Parameter | Value |
|---|---|
| Gain | +1 stack when a cast uses a different line from the previous cast within 2.0 s |
| Maximum | 5 stacks |
| Damage bonus | +6% per stack |
| Reset | casting the same line twice in a row; or 3.0 s idle |
| Perfect absorb | +1 stack |
| Crest | at 5 stacks the next cast is a Crest: costs 0 mana, × 1.5 damage, then Flow resets to 0 |

- Rain Needle counts as a line; the staff strike does not.
- Flow starts at 0; the first cast sets the predecessor. Without perfects, cast 6 reaches 5 stacks and **cast 7** is the Crest. (The baseline sheet's "fifth cast" claim is a recorded prose defect.)
- The Crest multiplier replaces the per-stack bonus; they do not stack.
- Planned other-school resources: Heat (Fire), Footing (Earth), Momentum (Air). Glacier Tomb already resets them by name; they do not exist yet.

## School practice profiles (Combat Feel Lab only)

Source: `lab-schools.json`. Each profile reuses the five Water archetypes with a different body, name prefix and multipliers. Both player and opponent use the same rules.

| School | Body | Spell prefix | Move | Cast time | Projectile speed | Damage | Control |
|---|---|---|---|---|---|---|---|
| Water | cassia | Tide | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| Fire | brennic | Ember | 1.00 | 0.90 | 1.10 | 1.12 | 0.80 |
| Earth | garran | Stone | 0.90 | 1.20 | 0.80 | 1.25 | 1.20 |
| Air | iskar | Gale | 1.15 | 0.75 | 1.35 | 0.85 | 0.90 |

These are labelled practice profiles. In the season, all mage opponents are Water proxies. The planned W8 wave adds unique Fire, Earth and Air catalogues and resources. The original baseline Fire sheet exists only in the contest reference design (`docs/design/reference-the-ledger/design/spell-sheet-fire.md` on `main`) and is not active data.

## Feedback tied to casting

- Casting circles (A13 sigils) follow the real windup; release is drawn only on the release event.
- Cast, travel, impact and aura effects per element (A8). Effects are decoration; collision uses data geometry.
- HUD slots show the current tier spell name, cooldown and cost; HUD shows Flow, Crest and the next collar unlock.

## Superseded

| Old | Current | Source |
|---|---|---|
| Baseline Water damage values (before W4) | About half for direct damage; Rain Needle 2.05; Return Tide cap halved to 40 | W4 calibration |
| Instant cast release, no commit point | Commit at 65% of windup, 0.05 s recovery, cast movement × 0.75 | CF2 |
| Cast effects shown when a pending cast disappeared | Effects fire on the authoritative release event | CF2 |
