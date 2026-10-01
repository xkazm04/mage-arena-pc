# W1 Arena kernel: a mage that moves and shoots on the TV, driven by a phone (M)

Variant 1, Phase 0 (the vertical slice). Depends on: nothing. Unlocks: W3, W4, W5.
Written as a card for the executing agent. "Authored" marks a number nobody has measured.

## Why this wave is first

The arena half of the game must exist on the real Fire TV Stick with a phone in hand before
anything else is worth building, and the sister project (Death Ride) already proved the stack:
pure-JVM deterministic core, libGDX on Android, a phone PWA over a WebSocket served by the TV.
W1 copies those proven pieces and puts a mage in them. It builds no absorb, no tiers, no spells
beyond the Bolt: those are W3 and W4.

## Design note first

Write `docs/mage/W1-arena-kernel.md` (one page) before code: the module layout, the input frame,
the snapshot, the step order, and which files were copied from `deathride/` and why.

## Deliverables

1. **Modules** (a standalone Gradle project `magearena/`, the same shape as `deathride/`):
   - `core` (pure Kotlin JVM, JUnit 5, kotlinx-serialization): `ArenaWorld`, `Mage`, `InputFrame`,
     `ArenaSnapshot` (read-only), `ArenaSim.step(inputs)`. **No Android or libGDX imports.**
   - `link` (protocol): copy Death Ride's link module; rename messages. Input frame:
     `i {q, ts, mx, my, ax, ay, b}` = sequence, phone `performance.now()`, move vector -1..1,
     aim vector -1..1 (0,0 = soft-lock), button bitfield (bit 0 Bolt, bits 1-4 slots, 5 Absorb,
     6 Roll). Always the absolute state, 30 Hz and on change. Stale input > 250 ms zeroes movement.
   - `game` (shared libGDX), `app` (Android TV, `dev.magearena.tv`, leanback), `desktop` (LWJGL3,
     keyboard and mouse), `controller` (phone PWA, served from the APK assets).
2. **Fixed 60 Hz step**, render interpolates two snapshots, structural changes (spawn, despawn)
   at one drain point. No wall clock, no unseeded random, no hash-ordered iteration in the step.
   No allocation per step or per frame (reuse pools).
3. **The mage**: walk 4.5 m/s, sprint 6.5 m/s at stick deflection > 0.85 (stamina 15/s),
   facing follows movement unless aiming. Arena 32 m x 20 m, walls. Numbers come from
   `data/combat.json` (copy it from the design package; one source).
4. **The Bolt** (Ember Dart): projectile 18 m/s, range 12 m, 8 damage, 0.30 s fire interval,
   4 mana (mana is a plain pool in W1; regen arrives in W3). Soft-lock: nearest target inside a
   60-degree cone of facing, sticky for 1.0 s. Manual aim with the phone's drag-to-aim gesture.
5. **One authority for HP** (`Health` component, every write goes through `applyDamage`), every
   projectile has an **activation id** and a hit set (a target is hit once per activation),
   **death is a state tag** (`Down`) that targeting, AI and damage all read.
6. **Training dummies**: three static, one that walks a square, one that throws a white
   (physical) stone every 2.5 s with a 0.5 s wind-up, so the threat language starts here.
7. **Phone controller v0**: landscape; left half a floating stick (anchor on touch-down, 60 px
   radius, dead zone 8%); right half a big Bolt button (hold = auto-fire at the soft-lock target;
   press-drag-release = aim and fire once). Multi-touch, `touch-action: none`, wake lock where
   available. Pairing by QR + PIN copied from Death Ride.
8. **Placeholder rendering**: circles and arrows, element colour for magic, white for physical.
   No art.

## Tests (all in `core`, no device)

- **Determinism**: the same seed and the same scripted input file, run twice for 120 s of sim,
  produce equal state hashes at every 1 s mark.
- **Time basis**: run at 60 Hz and at 30 Hz; distance walked per second and Bolts fired per
  second agree within 1%.
- **HP authority**: a test fires 100 Bolts through 5 overlapping dummies and asserts each
  activation damaged each target at most once, and that the HUD value equals the authority.
- **Down state**: a Down dummy cannot be targeted, damaged or soft-locked; a Bolt in flight
  toward it passes through.
- **Input**: decode, stale-frame drop by sequence number, the 250 ms hold, aim vector clamp.
- **Linter seed**: a test reads `combat.json` and fails on any time value without a unit suffix
  in its key (`S`, `Mps`, `M`, `PerSecond`), so the unit discipline starts in W1.

## Gate (commands, all must be green)

```
gradlew.bat :core:test :link:test :app:assembleDebug
gradlew.bat :desktop:run --args="--smoke --duration=10"
```

Then the **on-device check**: install on the Stick (AFTKM), pair one Android phone, walk the mage
around the arena for 2 minutes, fire at all dummies. Record in the session log: frame time p50,
p95 and max over 60 s from `/stats`, input age p50 and p95 (clock-corrected, from `/stats`), the
phone model, the Wi-Fi band. A number not taken is written `not measured`.

## Owner check (write it into `OWNER-CHECKS.md`)

Three things to try: run a circle around the walking dummy while firing; stop dead and turn;
aim manually at the far dummy. Good looks like: the mage goes where the thumb says without
thinking about it. Bad looks like: the thumb has to look at the phone.

## Done when

The tests and the gate are green, the mage moves and shoots on the Stick with a phone, the numbers
are in the log, the owner check is written, and one commit carries the wave.

## Kill criteria and STOP

| Trigger | Action |
|---|---|
| Input age p95 > 150 ms on the Stick under a 30 Hz load | Do not tune by feel. Record it, finish W1, and flag W3 (the perfect absorb window depends on it). |
| The APK will not start on the Stick after one fix attempt | STOP and ask the owner. |
| Frame time p95 > 16.7 ms with 5 dummies and placeholder shapes | STOP: the renderer path is wrong; profile before adding anything. |
| Any wish to add absorb, tiers or spells | Refuse: W3 and W4 own them. |
