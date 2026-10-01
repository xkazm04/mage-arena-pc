# W2 Arena kernel with the directional absorb, on the desktop with a gamepad (M)

Variant 2, Phase 0. Depends on: nothing (parallel to W1 in its own worktree). Unlocks: W3, W4.

## Why the absorb is in the kernel from day one

The arena's hardest part is the absorb: a directional ward, a 0.15 s perfect window, mana economy and
the collar clock it feeds. Everything else (lines, enemies) is content on top of it. So the kernel
ships with the absorb and with the bots that prove it, and the owner's hands judge it in this wave.

## Design note first

`docs/mage/W2-arena-kernel.md`: modules, the input frame, step order, the absorb state machine
(idle → raised → held → released, with the fresh-raise timestamp), and the arc test.

## Deliverables

1. **Modules**: `core` (pure Kotlin JVM, JUnit 5), `game` (libGDX shared), `desktop` (LWJGL3).
   No Android in Phase 0. Fixed 60 Hz step; render interpolation; deferred spawn/despawn; no wall
   clock, no unseeded random, no hash-ordered iteration, no per-step allocation.
2. **Input frame** (absolute state, device-agnostic): move vector, aim vector, buttons (Bolt, L1-L3,
   Absorb, Roll, Strike), aim-mode flag. Gamepad (XInput through libGDX controllers) and keyboard +
   mouse both produce it. Aim mode: holding a line button > 0.2 s plants the mage and the left stick
   aims; release casts.
3. **The mage**: walk 4.5 m/s, sprint 6.5 m/s (15 stamina/s), roll 4 m / 0.35 s with 0.25 s
   invulnerability (25 stamina), staff strike (1.6 m, 12 stamina, interrupts casts). Values from
   `data/combat.json` only.
4. **Rain Needle** (Bolt): 20 m/s, 6 damage, 0.25 s rate, 3 mana; soft-lock in a 60° cone, sticky 1 s.
5. **The absorb**: 140° arc toward aim (or facing), raise cost 5 mana, drain `30 - 3*nerve` per second,
   0.12 s minimum release before re-raise, reductions magic 0.85 / physical 0.30 / unblockable 0 /
   outside the arc 0. **Perfect**: fresh raise no more than 0.15 s before the hit resolves, hit
   inside the arc, magic only: full block, mana `10 * tier * (1 + 0.1*nerve)` (tier 0: 4), collar
   clock -2 s, a white ring, a bell, gamepad rumble.
6. **Collar clock** per combatant: tiers at 0/15/30/45 s, -2 s per perfect, >= 6 s between unlocks,
   reset each wave; four runes drawn as a ring at the mage's feet.
7. **HP authority**, activation ids with hit sets, `Down` as a state tag (as in the sister project).
8. **Dummies**: a magic thrower (tier 1 glob, 0.7 s wind-up, from the front), a physical slinger
   (from the side), a flanker that alternates sides, an unblockable charger (1.0 s lane telegraph),
   and a "stream" thrower (three bolts 0.2 s apart) to prove perfects cannot be farmed by holding.
9. **Bots**: `PerfectBot` (raises exactly 0.10 s before each magic hit, faces it), `HolderBot`
   (holds the ward permanently), `NeverBot` (never absorbs), `LateBot` (raises 0.16 s before).

## Tests (core, no window)

- **Determinism**: same seed and scripted input, 120 s twice: equal state hashes every second.
- **Window boundaries**: raise at 0.15 s before impact = perfect; at 0.15 s + one step = normal;
  `LateBot` never perfects; `HolderBot` never perfects and pays drain.
- **Arc**: hits at ±69° absorbed, at ±71° not; a hit from behind lands in full.
- **Maths**: mana returned for tiers 0-4 at Nerve 1 and 5; drain per second at Nerve 1-5.
- **Clock**: `PerfectBot` vs the magic dummy unlocks tier 2 at 15 s minus 2 s per perfect, never
  closer than 6 s between unlocks; resets on wave end.
- **Stream**: three bolts 0.2 s apart; a single fresh raise perfects at most the first.
- **Unblockable**: reduction 0 in every state; the strike interrupts the charger's wind-up.
- **Families**: physical never perfects; reduction 0.30.
- **Time basis**: 60 Hz vs 30 Hz parity within 1% for movement and drain.

## Gate

```
gradlew.bat :core:test
gradlew.bat :desktop:run --args="--smoke --duration=10"
gradlew.bat :desktop:run --args="--bots --duration=120 --report"
```

The bot report (perfect counts, mana curves, unlock times) goes in the session log with the machine
and the controller model. Input latency on the PC: measure with the flash method from the sister
project (a button press flashes the screen; film at 240 fps; at least 30 presses) and record p50/p95.

## Owner check

With a gamepad, five minutes against the flanker dummy. Questions: Can you tell from which side a
threat comes before it lands? Does a perfect feel earned or lucky? Is turning to absorb fun or a chore?
"Good" is: you start turning without thinking by minute three.

## Kill criteria and STOP

| Trigger | Action |
|---|---|
| The owner lands under 1 perfect in 10 attempts after five minutes | Do not widen by feel: record, try 0.20 s from data, re-run the owner check, report both. |
| The owner finds the directional ward a chore | Report; the 360° ward of variant 1 is one data change (`arcDeg: 360`). |
| Frame time p95 > 8 ms on the dev PC with 10 dummies | Profile before adding content. |
