# Combat Feel Lab

Purpose: describes the training sandbox used to tune combat feel: one player against exactly one target, live tuning of every feel parameter with bounds, named presets, metrics, replay, and import/export. This is the main tool for the owner's combat-feel review (D33).
Status: built (CF1, extended in CF2, H1, U6c). The Lab uses the shipping kernel; its default tuning ("Current") equals the season game. Presets are experiments, **not owner-approved balance**.

Sources: `docs/START-HERE.md`, CF1/CF2/H1 notes, `packages/core/src/arena/{lab,tuning}.ts`, [data/arena-runtime/feel.json](data/arena-runtime/feel.json), [lab-schools.json](data/arena-runtime/lab-schools.json).

## Entry

- Main menu → **Combat Feel Lab**, or Escape → Combat Feel Lab during play, or route `/lab`.
- Entering from a season checkpoints the season and leaves it paused; "Continue season" returns to that checkpoint. Lab bouts never change the season.

## Setup (key L)

Source: `lab.ts/LabConfig`, `validateLabConfig`.

| Setting | Options / range | Default |
|---|---|---|
| Target | Dummy, Mage AI, Cinder Hound, Mire Maw, Thornback, Hush Moth (creatures are stationary inspection targets) | Dummy |
| Dummy action | Still, Magic, Physical, Charge | Magic |
| Your school | Water, Fire, Earth, Air (practice profiles) | Water |
| Opponent school | Water, Fire, Earth, Air; for creatures this button becomes **facing** (SE, SW, NW, NE) | Fire |
| Competence | 1–4 (integer) | 2 |
| Aggression | 0 (cautious) – 1 (eager) | 0.75 |
| Distance | 2–36 m | 10 m |
| Seed | fixed 0 – 4,294,967,295, or random per reset | 7331 fixed |
| Loadout | composition screen: slot 1 Rain Needle + three lines with branches, or a preset | Rotation |

Changing the setup or loadout resets the bout; tuning stays selected. Competence changes decisions and reactions only, never HP or damage. Creature targets use roster HP and poise and do not run creature AI.

## Keys

| Key | Action |
|---|---|
| L | Setup panel |
| T | Live tuning panel (opening it freezes the bout; its Run button lets the opponent act with the panel open) |
| R | Reset the bout and metrics with the selected setup and tuning |
| P | Freeze / resume |
| . (period) | Freeze and advance exactly one 1/60 s tick |
| G | Refill both fighters' HP, mana, stamina and revive (metrics marked MIXED) |
| H | Toggle HP damage for both sides (contacts and control still happen) |
| V | Replay the last 20 s (1,200 ticks); V again returns to the untouched live bout |
| Escape | Pause menu; from a Lab panel, back to combat |
| F8, [ / ] | Art debug view and paging (missing animation fallbacks) |

When either figure falls, the bout holds for reset or refill.

## Tuning fields (key T)

Source: `tuning.ts/tuningFields` (bounds), `feel.json/defaults` and `combat.json` (Current values). Changes apply to future actions; casts in progress keep their snapshot; flying projectiles keep their speed. Warning floors (0.8 s unblockable, 0.4 s positional) are never shortened.

| Tab | Field (key) | Unit | Min | Max | Step | Current |
|---|---|---|---|---|---|---|
| Movement | Walk speed (walkMps) | m/s | 1 | 10 | 0.1 | 4.5 |
| Movement | Sprint speed (sprintMps) | m/s | 1 | 14 | 0.1 | 6.5 |
| Movement | Acceleration, 0 = instant (accelerationMps2) | m/s² | 0 | 150 | 5 | 60 |
| Movement | Braking, 0 = instant (decelerationMps2) | m/s² | 0 | 150 | 5 | 90 |
| Movement | Body turn response, 0 = instant (turnResponse) | 1/s | 0 | 40 | 1 | 24 |
| Movement | Move speed while casting (castMoveMultiplier) | × | 0 | 1 | 0.05 | 0.75 |
| Roll | Roll distance (rollDistanceM) | m | 1 | 8 | 0.1 | 4.0 |
| Roll | Roll duration (rollDurationS) | s | 0.15 | 0.8 | 0.01 | 0.35 |
| Roll | Roll invulnerability (rollIFramesS, ≤ duration) | s | 0 | 0.8 | 0.01 | 0.25 |
| Roll | Roll recovery (rollRecoveryS) | s | 0 | 0.6 | 0.01 | 0.15 |
| Roll | Move speed in roll recovery (rollRecoveryMoveMultiplier) | × | 0 | 1 | 0.05 | 0.5 |
| Casting | Cast time multiplier (castTimeScale) | × | 0.25 | 2 | 0.05 | 1 |
| Casting | Cooldown multiplier (cooldownScale) | × | 0.25 | 2 | 0.05 | 1 |
| Casting | Projectile speed multiplier (projectileSpeedScale) | × | 0.25 | 3 | 0.05 | 1 |
| Casting | Cast commit point (castCommitFraction; 1 = cancellable through the whole windup) | fraction | 0 | 1 | 0.05 | 0.65 |
| Casting | Spell recovery (castRecoveryS) | s | 0 | 0.5 | 0.01 | 0.05 |
| Hit | Minimum stun (hitStunS) | s | 0 | 0.3 | 0.01 | 0.10 |
| Hit | Maximum stun (hitStunMaxS) | s | 0.01 | 0.4 | 0.01 | 0.20 |
| Hit | Stun per damage (hitStunPerDamageS) | s/HP | 0 | 0.02 | 0.001 | 0.003 |
| Hit | Stagger immunity after hit (hitStunGraceS) | s | 0 | 0.6 | 0.01 | 0.18 |
| Hit | Poise multiplier (poiseScale) | × | 0.25 | 4 | 0.05 | 1 |
| Hit | Knockback at 10 damage (knockbackM) | m | 0 | 2 | 0.05 | 0.16 |
| Hit | Your poise (playerPoise) | × | 0.25 | 4 | 0.05 | 1 |
| Hit | Opponent poise (opponentPoise) | × | 0.25 | 4 | 0.05 | 1 |
| Hit | Visual recoil distance (hitRecoilM) | m | 0 | 1 | 0.05 | 0.35 |
| Hit | Recoil / flinch time (hitRecoilS) | s | 0.05 | 0.5 | 0.01 | 0.20 |
| Hit | Recoil squash (hitSquash) | fraction | 0 | 0.4 | 0.01 | 0.18 |
| Hit | Sprite shake (hitShakePx) | px | 0 | 8 | 0.5 | 3 |
| Hit | White flash (hitFlashS) | s | 0.02 | 0.15 | 0.005 | 0.065 |
| Hit | Player edge cue (playerHitCueS) | s | 0.05 | 0.5 | 0.01 | 0.22 |
| Hit | Fallback fall time (deathFallS) | s | 0.2 | 1 | 0.05 | 0.55 |
| Hit | Death aura fade (deathAuraFadeS) | s | 0.05 | 0.8 | 0.05 | 0.30 |
| Absorb | Perfect absorb window (absorbWindowS) | s | 0.03 | 0.4 | 0.01 | 0.15 |
| Absorb | Absorb arc (absorbArcDeg) | ° | 60 | 180 | 5 | 140 |
| Absorb | Absorb drain multiplier (absorbDrainScale) | × | 0 | 3 | 0.05 | 1 |
| Absorb | Perfect refund multiplier (perfectRefundScale) | × | 0 | 3 | 0.05 | 1 |
| Resources | Mana regeneration multiplier (manaRegenScale) | × | 0 | 3 | 0.05 | 1 |
| Resources | Time between collar tiers (collarIntervalS) | s | 6 | 30 | 1 | 15 |
| Opponent | Enemy reaction delay multiplier (enemyReactionScale; 250 ms floor) | × | 0.5 | 3 | 0.05 | 1 |
| Opponent | Enemy aim error multiplier (enemyAimErrorScale) | × | 0 | 3 | 0.05 | 1 |
| Spells | Per-archetype cast time, cooldown, projectile speed overrides for the selected slot/tier (affect both sides) | s, s, m/s | — | — | — | from CSV |

The Hit tab has three pages of six rows. Input methods: drag a slider, focus and press Left/Right, or click the value and type (Enter applies, Escape cancels). All controls are on the canvas.

## Presets

Source: `feel.json/presets`. Fields not listed keep the Current value.

| Field | Current | Snappier | Heavier |
|---|---|---|---|
| accelerationMps2 | 60 | 90 | 30 |
| decelerationMps2 | 90 | 110 | 45 |
| walkMps | 4.5 | 5.2 | 4.1 |
| castTimeScale | 1 | 0.75 | 1.25 |
| cooldownScale | 1 | 0.85 | 1.15 |
| projectileSpeedScale | 1 | 1.25 | 0.9 |
| rollDurationS | 0.35 | 0.28 | 0.40 |
| rollRecoveryS | 0.15 | 0.10 | 0.22 |
| hitStunS | 0.10 | 0.10 | 0.12 |
| hitStunMaxS | 0.20 | 0.15 | 0.20 |
| knockbackM | 0.16 | 0.15 | 0.50 |
| hitRecoilS | 0.20 | 0.15 | 0.20 |
| hitRecoilM | 0.35 | 0.35 | 0.50 |

## Metrics (Lab HUD)

| Metric | Definition |
|---|---|
| Contacts landed / taken | Damaging contacts (a miss or a rolled-through projectile is not a contact) |
| Ward success | Ward successes per incoming magic contact |
| Perfect rate | Perfect absorbs per incoming magic contact |
| Damage per mana | Damage dealt per gross mana spent (cast + ward raise + drain) |
| Elapsed / TTK | Simulation seconds; first target-down time |
| Staggers dealt / taken, cancelled casts | H1 additions |
| MIXED label | Shown when tuning changed mid-bout or G was used |
| REPLAY label | Shown during replay; aggregate metrics stay live |

With damage off, contacts are measured as hypothetical post-ward damage; TTK is unavailable. Times are simulation seconds and exclude presentation hit stop and slow-down. Lab history lasts for the browser session only.

## Import and export

- Export downloads a versioned JSON (version 3) with the tuning and preset name. School, loadout and seed are not included.
- Import: paste with Ctrl+V or drop the file on the canvas, then Enter validates and applies. Invalid values or unknown fields are rejected without changing the current tuning. Version 1 and 2 files migrate (their constant stun duration is preserved; new H1 fields take defaults).

## Owner feel protocol (from START-HERE)

1. Water, Still dummy, seed 7331, 10 m, Current: move, reverse, sprint, roll, cast all four slots.
2. Magic dummy, damage off: hold the ward, then release and raise just before contact; turn away to test the open rear; try Physical and Charge.
3. Mage AI Water, competence 2, aggression 0.75, 10 m, fixed seed: play Current, Snappier, Heavier with the same loadout; damage on for TTK; replay an unfair moment.
4. Change one parameter, reset, repeat; export the preferred set.

Report with the words floaty, snappy, heavy, unfair, unreadable, plus resolution, loadouts, opponent settings, seed, preset, exact parameter values, damage mode and the action that exposed the problem.

## Limits

- Fire, Earth and Air are practice profiles over Water archetypes, not their own catalogues.
- Creature targets are stationary; active creature AI is exercised in the proving ground roster practice.
- Physical input latency, audio mix and subjective weight are not measured.
