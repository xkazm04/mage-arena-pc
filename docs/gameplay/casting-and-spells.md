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

## Fire school (Heat)

Status: built in W8 lane F to VR CR-002 to the letter. The parity suite runs with the PC overlay off. Season Water proxies are unchanged. A Fire mage appears only behind `createGames(..., { schoolRivals: 'fire' | 'named' })`, or as a loadout actor in the Lab and practice entry once lane P wires them. Values come from VR and are simulated, not felt by the owner.

Sources: `docs/design/reconciled/data/arena/spells-fire.csv` (VR's numbers, unedited), `schools-combat.json` `fire`, `school-balance.pc.json` (PC overlay, empty), `packages/core/src/arena/fire.ts`, `shapes.ts`, `mage-ai-fire.ts`. The contract is mage-arena-vr `docs/change-requests/CR-002-fire-school.md`.

### Slots and composition

- **Loadout.** Ember Dart is fixed on the Bolt slot, and there are four free slots with no branches. Authored presets are Pit-dog, Brand and Sunfall gambit (`school-presets.json`).
- **AI rival.** An AI rival (`schoolState.catalogue`) chooses from all ten rows: slot n is CSV row n.
- **Tier gate.** A row whose tier is above the collar tier cannot be cast.
- **Staff strike.** Inside 1.6 m, the Bolt slot is the shared staff strike: stamina 12, no mana, no Heat.

### Heat

| Rule | Value |
|---|---|
| Range | 0–100. Arena bouts start at 0. The camp's "start at 30 against a feud target" is camp bias, not combat. |
| Gains | Ember Dart 2 per connecting hit. Flick Flame 6 per target. 12 when a Fire mage takes a hit with damage above 0 and absorb reduction 0. 3 per second for each living enemy within 3 m. |
| Spell heat | Paid to the caster when the blow connects, including on a perfect absorb (see the spell table) |
| Decay | 6 per second, starting 2.0 s after the last gain. The idle timer does not refresh while Heat decays. Proximity counts as a gain. |
| Kindled (≥ 50) | spell damage × 1.15 |
| Blazing (≥ 80) | spell damage × 1.3, absorb drain × 1.5, stamina regen × 0.7. A higher band replaces the lower one; at 100 the multiplier is still 1.3. |
| Snapshot | Projectiles and placed areas keep the Heat they had at release. Each trail tick and each beam tick reads live Heat. |
| Perfect absorb | No extra Heat beyond the shared mana refund |

- **Tick order.** The Heat tick runs at the start of the actor step, before that tick's release and before projectile hits.
- **Furnace Heart lock.** The lock holds Heat at 100 for 6 s and discards gains. When the lock ends, decay starts on the same tick.

### Fire spell catalogue

Source: `spells-fire.csv`, unchanged. The cooldown starts at the press, and mana is paid at the press. The windup is `max(cast_s, telegraph_s)`, except for Sunfall. A cast time of 0 releases on the same tick.

| Slot | Spell | Tier | Shape | Windup | Mana | Damage | Heat | Kernel notes |
|---|---|---|---|---|---|---|---|---|
| 0 | Ember Dart | 0 | projectile 18 m/s, 12 m | 0 | 4 | 8 | 2 per hit | cooldown 0.30 s |
| 1 | Flick Flame | 1 | cone 60° × 4 m | 0.15 s | 12 | 20 | 6 per target | Hits a body whose centre is within 4 m (centre at 4.05 m misses). |
| 2 | Cinder Step | 1 | dash 5 m + trail 2 s | 0 | 15 | 6 per 0.5 s tick | 3 per tick | No stamina and no i-frames. The trail is the segment actually travelled. Four ticks. Each target is hit at most once per owner per tick. |
| 3 | Kindle | 1 | self | 0.40 s, rooted | 8 | — | +25 | clamped at 100 |
| 4 | Brand Lance | 2 | line 14 m | 0.60 s | 25 | 32 | 4 per target | Pierces a Scutum front block. It is still `magic`, so a ward absorbs it. |
| 5 | Ring of Cinders | 2 | ring r 3 m | 0.30 s | 22 | 18 | 5 per target | Knocks the target back 2 m when damage gets through and the absorb was not perfect. |
| 6 | Pyre Circle | 3 | ground circle r 3 m at a point | 0.80 s | 40 | 48 | 8 per target | One detonation when the windup ends. The caster is not rooted. |
| 7 | Furnace Heart | 3 | self | 0.50 s | 30 | — | locked at 100 for 6 s | Absorb drain is doubled while the lock lasts, and stacks with Blazing for × 3. |
| 8 | Sunfall | 4 | meteor r 3.5 m, 12 m | 0.80 s rooted cast, then a 1.2 s shadow | 70 | 95 | 10 per target | Unblockable. A staff strike during the cast cancels it. After release, the shadow survives interrupts and its owner's defeat. |
| 9 | Brand Wrath | 4 | beam 10 m for 2.0 s | 0.20 s | 60 | 14 per 0.25 s tick | 2 per tick | Eight ticks, each with its own activation. The beam follows current facing. Only the first tick can be perfected; later ticks chip a held ward at 14 × 0.15. |

- **Damage cells.** A damage cell is read as the number it starts with, so "14 per 0.25 s tick" means 14.
- **Families.** `UNBLOCKABLE` becomes `unblockable`, `absorbable` becomes `magic`, and `n/a` marks the self rows.
- **Strict reading.** Shape, tick, heat and note cells are read strictly: a cell the reader cannot parse fails at load.
- **Beam lock.** While a beam runs, its caster cannot start another cast.
- **Downed casters.** A downed caster's trails and beams stop. The Sunfall shadow is the only effect that outlives its caster.
- **Pace.** The cast time, cooldown and projectile speed scale with the caster's pace (`feel.json` `pace`). A warning never drops below its reaction-band floor. At parity, pace is 1×.

### Ember mage (AI)

- **Shared AI.** The shared mage AI (`mage-ai.ts`) supplies reactions, absorb and perfect rolls, aim error and cadence (T07 competence). Aim lead uses Ember Dart's 18 m/s.
- **Spell choice.** The AI walks the ten rows. A row is useful if it deals damage or is a zone (Pyre). Kindle and Furnace Heart are cast only when no useful row is legal. A dash has no range gate.
  - Level < 2 draws `mage <id> spell`.
  - Level ≥ 2 sorts the rows, with damage first. From level 3, unblockable rows go first against a held ward.
- **Sunfall bank.** From tier IV until the first Sunfall releases:
  - A legal Sunfall is always the cast, and that pick draws no random.
  - Below 70 mana, the AI casts only spells that keep 70 banked. Otherwise it withholds offense and regenerates mana.
  - If Sunfall is out of range or on cooldown, the normal pick applies.
- **Threats.** Its pending cast, a live beam (id is the negative of the owner id) and a committed shadow are threats to the PC AI. A dash, a trail and the self rows are not.

### Parity (CR-002)

- **Hand checks.** `packages/core/src/arena/parity/cr-002.test.ts` reproduces every CR-002 hand check with its exact number.
  - These checks run VR's feel layer: no hit stun, no generic knockback, instant acceleration.
  - The staff-interrupts-Sunfall check runs PC's own feel, because PC interrupts a cast through the stagger.
- **VR scenarios.** The two VR duel scenarios (`parity/cr-002.json`) match VR on outcome, phase, player HP, waves cleared and Sunfall count. They differ on ticks and player mana.
- **First divergence.** It is tick 0, random draw 4: PC's reference player draws `mage 1 variety 3` (`mage-ai.ts` spell variety), and VR has no such draw. Pace, the PC feel layer and later AI terms add to the drift. Nothing was tuned.

### PC deviations (interim, pending kernel hooks)

- **Pierce.** Brand Lance's pierce is delivered as an `area` contact, which is resolveHit's only shield bypass.
- **Later Wrath ticks.** Perfect suppression on later Wrath ticks masks the target's fresh-raise tick for that one contact.
- **Root.** Kindle and Sunfall root through the ward root field. An interrupted rooted cast keeps the root until its release tick would have come.
- **Beam timing.** Beams stop when their owner rolls, staggers, goes down or is encased. They resolve after projectiles, where VR resolves them inside the caster's step.

## Air school (W8, CR-007)

Status: built in W8 lane A to VR's T23 rules, accepted 2026-10-23 as CR-007. Momentum, the ten rows, the curving bolt, the staggered volley, the evade and the deflect run in `packages/core/src/arena/air.ts`. Lio's AI is in `mage-ai-air.ts`. Slipstream, Downdraft, Tempest Lance and Cyclone release through the shared shapes in `shapes.ts` (lane F). Values are VR's, simulated, and not owner-felt. The PC census (lane B) has not run yet.

Sources: `docs/design/reconciled/data/arena/spells-air.csv` (VR's numbers, never edited on PC), `schools-combat.json` `air`, `packages/core/src/arena/data/school-balance.pc.json` (PC overlay, empty), `docs/change-requests/CR-007-air-school.md`, `packages/core/src/arena/parity/cr-007.*`.

### Slots and presets

- The bolt slot always holds Gale Dart. Four free slots hold any four distinct Air rows; there are no branches. A row whose tier the collar has not unlocked is dark.
- An AI rival (Lio, or every mage with `schoolRivals: 'air'`) chooses from the whole catalogue: slot n is row n.

Authored presets (`school-presets.json`):

| Preset | Slots | Tiers |
|---|---|---|
| Skirmisher | Shear, Slipstream, Veering Bolt, Downdraft | I, I, II, II |
| Storm | Shear, Veering Bolt, Squall, Cyclone | I, II, III, IV |
| Tempest gambit | Shear, Veering Bolt, Eye of the Storm, Tempest Lance | I, II, III, IV |

### Momentum

| Rule | Value | Notes |
|---|---|---|
| Range | 0–100 | starts at 0 each bout |
| Gain | +20/s while this tick's move is above 4 m/s | walking (4.5 m/s), sprinting and rolling count; a Slipstream dash does not |
| Decay | −25/s while still (zero displacement) | an encased or staggered mage is still |
| Dead band | 0 to 4 m/s: no change | for example walking with the ward held (2.25 m/s) |
| Spell payments | the `momentum_gain` cell, per hit, target or tick | paid on a warded or perfected hit too; never on an evaded one |
| 40 | pierce one extra target, roll stamina ×0.6 | the pierce applies to projectiles and is fixed at release |
| 80 | range ×1.3 | projectiles, lines, beams and Downdraft's placement, not the dash; the 40 band still applies |
| Ward drain | ×1.2 always, ×1.8 under Eye of the Storm | |
| Perfect absorb | deflect | a projectile of tier ≤ own tier leaves along the aim, same speed, damage and tier, and cannot be redirected again; it replaces the Water Mirror |

### Cast pipeline differences from Water

- Mana is paid and the cooldown starts at the press, as for Water. Windup is `max(cast_s, telegraph_s)` for every row.
- No Flow. No cast recovery after release.
- Momentum is updated after the move and before the same tick's release, so a cast pressed while still sees the decay first.
- Squall and Cyclone keep the hands busy until they finish: no other cast and no staff strike. An interrupt (roll, stagger, encase, a connecting staff strike) drops the orbs not yet thrown and ends the channel. Mana and cooldown stay spent.
- Tempest Lance roots its caster for the windup.

### Air spell catalogue

Source: `spells-air.csv`, unchanged. Windup and cooldown are in ticks at 60 Hz.

| Tier | Spell | Shape | Windup | Cooldown | Mana | Damage | Blockable | Range m | Momentum | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 0 | Gale Dart | projectile 24 m/s | 0 | 18 | 4 | 7 | absorbable | 14 | 2 per hit | inside 1.6 m slot 0 is the staff strike |
| 1 | Shear | two projectiles 22 m/s at ±12° | 8 | 180 | 12 | 9 each | absorbable | 12 | 4 per hit | the blades diverge, so both hit only a close target |
| 1 | Slipstream | dash 6 m | 0 | 300 | 12 | — | — | 6 | +30 | no stamina, no trail |
| 2 | Veering Bolt | curving projectile 16 m/s, 60° off the line | 30 | 420 | 22 | 24 | absorbable | 14 | 6 per hit | arcs to the aim point from the flank; the side alternates with the activation id |
| 2 | Downdraft | ground circle r 2.5 m | 42 | 540 | 20 | 26 | absorbable | 12 | 5 per target | lands at release on the aim point, no farther than the range |
| 2 | Air Form | self 3 s | 9 | 840 | 10 | — | — | — | needs and spends 40 | evades 60% of physical and 30% of other blockable hits; unblockables are never evaded |
| 3 | Squall | four orbs 14 m/s, 0.25 s apart | 18 | 660 | 34 | 11 each | absorbable | 12 | 3 per hit | each orb is its own activation, so each can be perfected |
| 3 | Eye of the Storm | self | 24 | 960 | 28 | — | — | — | locked at 100 for 5 s | ward drain ×1.5 while it lasts |
| 4 | Tempest Lance | line 16 m | 72 | 1500 | 70 | 85 | UNBLOCKABLE | 16 | 10 per target | the signature: rooted 1.2 s windup, blink off the line or strike the caster |
| 4 | Cyclone | beam 10 m for 2 s | 12 | 1200 | 60 | 12 per 0.25 s tick | absorbable | 10 | 2 per tick | follows the facing; every tick can be perfected |

### Air Form's evasion

Each hit that reaches a formed mage draws once from the seeded RNG (`air <id> evade <activation>`), after the roll and encase immunity and before the ward. An evaded hit does nothing: no ward drain, no damage, no hit count, no Momentum to the thrower. An evaded projectile flies on through the body. The same inputs evade the same hits.

### Lio, the Gale mage

Lio is the Tiro final's rival when school rivals are on (`schoolRivals: 'named'`). The semifinal is Brennic (Fire). The AI aims with Gale Dart's 24 m/s lead. On each decision it takes the first of these that is legal:

1. Tempest Lance from tier IV, unless the target is mid-roll.
2. Air Form when an aimed, blockable threat is coming, the form is down and Momentum is 40 or more.
3. Slipstream while Momentum is under 40, along its move (sideways when standing), with the dash end kept inside the arena.
4. The competence curve over the damaging rows. Level 1 draws one at random. Level 2 and up prefer Veering Bolt and Squall, then the highest damage × count.

### Parity

`parity/cr-007.test.ts` reruns VR's `AirTests.cpp` hand checks on the PC kernel with `balance: 'canonical'` and the PC feel layer off. VR has no Air scenario summary to compare.

## School practice profiles (Combat Feel Lab only)

Source: `lab-schools.json`. Each profile reuses the five Water archetypes with a different body, name prefix and multipliers. Both player and opponent use the same rules.

| School | Body | Spell prefix | Move | Cast time | Projectile speed | Damage | Control |
|---|---|---|---|---|---|---|---|
| Water | cassia | Tide | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| Fire | brennic | Ember | 1.00 | 0.90 | 1.10 | 1.12 | 0.80 |
| Earth | garran | Stone | 0.90 | 1.20 | 0.80 | 1.25 | 1.20 |
| Air | iskar | Gale | 1.15 | 0.75 | 1.35 | 0.85 | 0.90 |

These are labelled practice profiles. In the season, all mage opponents are Water proxies by default. Since W8, Fire and Air have real catalogues and resources (sections above). An actor with `schoolState` never reads these profiles. Earth remains a practice profile only. The original baseline Fire sheet exists only in the contest reference design (`docs/design/reference-the-ledger/design/spell-sheet-fire.md` on `main`) and is not active data.

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
