# Hit reactions and defeat

Purpose: defines what happens when a fighter takes damage (stagger, poise, knockback, cast interruption), how defeat works (the DEFEATED state and persistent corpses), and the presentation feedback for hits.
Status: built (CF2 feedback, H1 simulation and presentation, U6b/U6c delivered animation clips). Values are authored; the census and Lab comparisons are simulated. Interruption length, struggle and fall are **not owner-felt** (H1 owner check pending).

Owner direction (D36, D37): "any hit interrupting cast and movement for very quick moment … If character defeated it also needs animation to lay down and stay there."

Sources: [data/arena-runtime/feel.json](data/arena-runtime/feel.json), [enemies.json](data/arena-design/enemies.json) `poise`, [combat-feedback.json](data/presentation/combat-feedback.json), [animation.json](data/presentation/animation.json), `packages/core/src/arena/kernel.ts` (`resolveHit`), H1 report.

## Stagger (hit stun)

Every positive HP loss attempts a stagger, including chip damage through a held ward.

```
duration = clamp( (hitStunS + hpRemoved × hitStunPerDamageS) / (poise × poiseScale),
                  hitStunS, hitStunMaxS )      → rounded up to whole 60 Hz ticks
immunity tail = hitStunGraceS after the stagger ends
```

| Parameter | Value | Source |
|---|---|---|
| Minimum stun (`hitStunS`) | 0.10 s | feel.json/defaults |
| Maximum stun (`hitStunMaxS`) | 0.20 s | feel.json/defaults |
| Stun per HP removed | 0.003 s/HP | feel.json/defaults |
| Stagger immunity tail | 0.18 s | feel.json/defaults/hitStunGraceS |
| Global poise multiplier | 1 | feel.json/defaults/poiseScale |

What a stagger does:

- Clears velocity immediately and stops a roll.
- Cancels a pending mage cast or an enemy windup. **Mana, stamina and cooldowns already spent stay spent.**
- Tags the body `STAGGERED` until it ends.
- The ward stays held and keeps draining; it does not get a new perfect window.

What does not stagger: roll i-frames, perfect absorbs, zero-damage contacts, Lab damage-off mode. During the immunity tail the body still takes damage and flinches visually, but a new stagger cannot start, so a fresh cast or movement is protected (anti-stunlock rule).

Example: a 12-damage hit on poise 1 → (0.10 + 0.036) / 1 = 0.136 s → 9 ticks (0.15 s). The same hit on a thornback (poise 2.3) → 0.059 s → clamped up to 0.10 s.

## Poise

| Body | Poise |
|---|---|
| Mages, dummies, conscript, slinger, netter, cinder hound, hush moth | 1 |
| Shieldman (Scutum bearer) | 1.8 |
| Mire maw | 2 |
| Thornback | 2.3 |

Source: `enemies.json` per enemy, `feel.json/poise`. The Lab also has independent player and opponent poise sliders.

## Knockback

`displacement = knockbackM × min(2, hpRemoved / 10) / max(1, poise)` in the direction away from the hit source, clamped to the arena. Default `knockbackM` = 0.16 m at 10 damage (max 0.32 m). This moves the actual body in the simulation.

## Defeat (DEFEATED state)

- When HP reaches 0, one authority tags the actor `DEFEATED` (serialized, replaces the old down boolean), records the tick and direction, stops velocity, ward and roll, cancels pending commitments and emits a death event.
- Every system reads the tag: movement, casting, targeting, damage and healing, both AIs, projectile collision, encounter counts, HUD.
- The corpse stays in the actor list until the bout is reset. It has no collision, no targeting ring, no health bar, no AI, and cannot be hit again. Targeted windups lose a dead target.
- Already-launched projectiles and hazards marked `survivesOwner` (for example the cinder hound's death burst) keep their lifetime; they cannot hit corpses.
- Season bouts: a player defeat is a **missio** loss (the crowd spares the fighter). No one dies in Tiro. The results panel leaves the player's body visible on the floor.
- Lab: G revives and refills through the same authority; R starts a fresh bout.
- A simultaneous defeat of the player and the last enemy counts as a loss.

## Presentation feedback

Presentation never changes the simulation. Time-stretch effects (hit stop, slow-down) stretch wall time only; the census and TTK use simulation seconds. Reduced motion removes shake, hit stop, slow-down and recoil displacement, and snaps a fallback death to the lying pose.

| Feedback | Value | Source |
|---|---|---|
| Hit stop | 2–3 frames on hits of 5+ damage | combat-feedback.json |
| White silhouette flash | 0.065 s | combat-feedback.json, feel.json/hitFlashS |
| World shake | 0.12 s, 0.28 px per damage at 1080p, max 6 px; HUD and aim stay stable | combat-feedback.json |
| Damage numbers | 0.8 s, rise 40 px, max 32 on screen, hidden below 0.5 damage | combat-feedback.json |
| Sprite recoil away from the hit | 0.35 m over 0.20 s, squash 0.18, sprite shake 3 px | feel.json defaults |
| Player hit edge cue | 0.22 s screen-space | feel.json/playerHitCueS |
| Hit clip choice | hit-light below 18 HP removed, hit-heavy at 18 or more; the clip is fitted to the flinch time | animation.json/bodies/heavyHitDamage |
| Death | death clip plays once and holds its last frame as a corpse; if missing, the sprite rotates and settles to a lying pose in 0.55 s; aura fades in 0.30 s | feel.json/deathFallS, deathAuraFadeS |
| Audio | separate hit and stagger hooks (stagger reuses the hit sample at lower pitch and gain) | H1 report |

Animation coverage (U6c): all four mages, four soldiers, cinder hound and hush moth have light/heavy hits and collapse/corpse pairs in all four facings. Mire maw is missing rear collapse/corpse; thornback is missing rear hits and rear collapse/corpse. Those 12 slots use the same creature's front view (visible in the F8 art debug view).

## Measured effects (simulated)

H1 headless Lab comparison: 100 seeds per opponent school, Water Rotation reference AI level 3 vs a level 2 practice profile, aggression 0.75, 10 m, Current tuning.

| Opponent | Hits to defeat (median) before / after | Winning TTK median s before / after |
|---|---|---|
| Fire | 39 / 38 | 69.38 / 65.47 |
| Water | 44 / 44 | 75.58 / 71.75 |
| Earth | 44 / 44 | 74.53 / 68.98 |
| Air | 49 / 49 | 77.37 / 72.02 |

Winning sample sizes changed, so TTK is not a paired estimate. Interruption shortened duels; see the census in [opponents-and-arena-tiers.md](opponents-and-arena-tiers.md).

## Superseded

| Old | Current | Source |
|---|---|---|
| No hit stun (W2–U5) | Stagger added | CF2 |
| Constant 0.05 s stagger on unguarded hits, 0.16 s tail (CF2) | Damage-scaled 0.10–0.20 s on any HP loss incl. guarded chip, 0.18 s tail (H1) | H1, D36 |
| `down` boolean; defeated actors removed or ignored | Serialized DEFEATED tag, persistent corpse | H1, D37 |
| Procedural lying pose only | A14 collapse/corpse clips where delivered | U6b, U6c |
