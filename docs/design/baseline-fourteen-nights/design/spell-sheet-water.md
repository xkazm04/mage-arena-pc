# Spell sheet: Water (the Tide Tent), Variant 2

Data: `data/spells-water.csv` (the single source). Constants: `data/combat.json`. Numbers authored,
tuned in W4 by simulation; feel is the owner's. This sheet was reconciled for the executing arena
stream in W4; the original contest report remains historical. See `docs/waves/W4-tiro-games.md`
and its generated census for the tuning evidence. The tables below are a reading aid, not a second authority.

## The rules

- **Bolt + three lines.** Rain Needle is always in slot 1. The player brings 3 of Water's 5 lines in
  slots 2–4. Number keys or wheel select; left mouse casts (D4). Each line button climbs from tier I to IV in place as the collar unlocks tiers (0, 15, 30,
  45 s; -2 s per perfect absorb; >= 6 s between unlocks; reset each wave).
- **Branches** are chosen before the Games at tier II and tier IV where a line has them.
- **Borrowed line**: a sworn cross-tent friend can lend one of their school's lines for one slot.
- **Flow** (0-5): casting a *different* line within 2.0 s of the last adds a stack (+6% spell damage
  each); at 5 the next spell is a **Crest** (free, x1.5). The same line twice, or 3 s without casting,
  resets Flow. The first cast establishes the predecessor: five qualifying changes reach five stacks
  on cast six, and cast seven can consume Crest. A perfect absorb adds 1 and refreshes the idle grace
  without changing the timestamp of the last actual cast. Water rewards rotation, not spam.
- **Directional absorb**: a 140° ward toward the aim. Water's own unblockables (Leviathan Orb, Drown
  Coil) are its answer to an opponent who has learned to absorb everything.

## The five lines

| Line | I | II | III | IV |
|---|---|---|---|---|
| **Tide Orb** (projectile) | Bubble Shot: 7 dmg, cd 2.5 s, 10 mana | Crash Orb: 12, bursts r 2 m | Twin Tides: 2 x 11 | **A** Leviathan Orb: 40, UNBLOCKABLE, 1.0 s path telegraph · **B** Rain of Orbs: 5 x 9 |
| **Lash** (close) | Tide Lash: cone 3 m, 8 | **A** Undertow: pull 3 m · **B** Riptide: push 3 m | Maelstrom Lash: ring r 3 m, 15 | Drown Coil: grab, root 1.5 s, 25, UNBLOCKABLE, 0.8 s ring |
| **Mire** (zone) | Puddle: slow 30% | Fog Bank: blocks sight, breaks soft-lock | Freeze Field: root 1.0 s after 0.8 s | Glacier Tomb: encase 2 s, resets the target's resource |
| **Mend** (sustain) | Cool Draught: heal 12 | Tide Ward: drain -50% for 4 s | Spring: heal 30 over 5 s | Font: +60 mana, cd 30 |
| **Mirror** (counter) | Sheen: +50% perfect mana refund for 3 s | **A** Reflection: perfects reflect projectiles · **B** Ripple: perfects release a 7.5-dmg ring | Mirage: decoy 3 s | Return Tide: release stored absorbed damage (base max 40) |

## Three compositions

| Composition | Lines (branches) | The promise | Weak to |
|---|---|---|---|
| **Undertow** (pressure) | Lash (II-A Undertow), Tide Orb (IV-A Leviathan), Mire | Pull them in, root them, then the unblockable orb they cannot absorb | Air's momentum; anyone who out-spaces the pull |
| **Mirror tide** (counter) | Mirror (II-A Reflection), Mend, Tide Orb (IV-B Rain) | Absorb everything, reflect projectiles, grow mana; lose nothing | Physical-heavy waves (soldiers): perfects do not work on steel |
| **Rotation** (Flow) | Tide Orb, Lash (II-B Riptide), Mirror (II-B Ripple) | Alternate three buttons for permanent Crests; ripples punish melee | Long cooldown gaps when the collar is slow |

## How a Water duel should feel (authored intent; the owner certifies)

The first 15 s are reading: absorb their Bolt stream facing them, fish for a perfect on their first
tier-I spell, keep Flow alive with cheap alternations. At 15 s the branch decision pays: Undertow
drags them into the Lash, Reflection turns their projectiles around. At 45 s (earlier with perfects)
Leviathan Orb is the line they must leave, not absorb.

## Tests that pin this sheet (W3)

- Line linter: every positional area has telegraph >= 0.40 s; every unblockable >= 0.80 s; every
  number has a unit; every line has 4 tiers and branches only at II and IV.
- Flow: a scripted rotation of three lines every 1.5 s reaches 5 stacks on the 6th cast and Crests on the next;
  repeating one line never exceeds 1.
- Composition curves: damage per 15 s window for each composition against the magic dummy and the
  stationary soldier formation; the Mirror composition's formation time is reported. The original
  expectation that Mirror is always slowest is not a gate: the final tuning's probe does not establish that.
- Reflection: only projectiles of tier <= the reflector's unlocked tier reflect; physical never.
