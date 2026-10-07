# Ward and absorb

Purpose: defines the directional ward (magical absorb), its mana costs, the perfect-absorb window and rewards, the three threat families and how threats are telegraphed.
Status: built (W2 kernel; CF2 feedback; U4 barrier art; U6 sigils). Values are authored and simulated (timing bots, census). Whether the perfect window is too tight, right or too forgiving is **not owner-felt** (owner check W2 pending).

Sources: [data/arena-design/combat.json](data/arena-design/combat.json) `absorb`, `threatLanguage`, `reactionBands`; [feel.json](data/arena-runtime/feel.json); `packages/core/src/arena/kernel.ts` (`updateWard`, `resolveHit`).

## Concept

From the owner's concept: "Parry mechanic should be there as 'magical absorb', spending mana for time holding the absorb. If perfect parry in specific window of impact, amount of mana comparable to spell level is recovered, timer to unlock next spell level shorten (some spells can be unblockable)."

The ward is an energy barrier held toward the aim point. It is the core skill check: face the threat, time a fresh raise, and get paid in mana and collar time.

## Ward rules

| Parameter | Value | Source |
|---|---|---|
| Input | Right mouse button held (LT on gamepad) | D4 |
| Shape | Arc of **140°** centred on the aim direction; the rear 220° is open | combat.json/absorb/arcDeg |
| Facing | Aim direction if aiming, else movement facing | combat.json/absorb/facing |
| Raise cost | 5 mana | absorb.raiseCostMana |
| Drain while held | 30 − 3 × nerve mana per second (27/s at nerve 1) | absorb.drainPerSecond |
| Minimum release before re-raise | 0.12 s | absorb.minReleaseBeforeReRaiseS |
| Move speed while held | × 0.5 | absorb.moveSpeedWhileHeldMult |
| Cannot raise | during a roll, while a cast is pending, with mana below the raise cost | kernel.ts |
| Exhaustion | if mana runs out while holding, the ward drops and stays down until the button is released (no auto re-raise from regeneration) | W2 |
| Mana regeneration | continues while the ward is held | W2 |

Damage reduction when the hit comes from inside the arc:

| Incoming family | Reduction | Meaning |
|---|---|---|
| magic | 85% | absorb it |
| physical (steel) | 30% | chip only; roll instead |
| unblockable | 0% | leave the area, or interrupt the caster |
| any hit outside the arc | 0% | the rear is open |

## Perfect absorb

| Parameter | Value | Source |
|---|---|---|
| Condition | Magic hit, inside the arc, landing no more than **0.15 s** after a **fresh** raise (impact tick − raise tick ≤ window ticks, inclusive) | absorb.perfect |
| Damage reduction | 100% | absorb.perfect.reduction |
| Mana returned | 10 × incoming tier × (1 + 0.1 × nerve); tier 0 (Rain Needle, hound burst) returns a flat 4 | absorb.perfect.manaReturned |
| Collar clock | +2.0 s toward the next tier unlock (minimum 6 s between unlocks still applies) | tierClock.perfectAbsorbAdvanceS |
| Flow | +1 stack | combat.json/flow |
| Not possible against | physical, unblockable | absorb.perfect.notAgainst |

Rules:

- A ward that stays up never refreshes its timestamp. To get a perfect, release and raise again just before impact (at least 0.12 s release).
- The window is the same for everyone and never scales. Nerve scales drain and refund only ("two-axis" rule).
- Refund is capped at max mana. Sheen (Mirror I) multiplies the perfect refund by 1.5. Reflection and Ripple (Mirror II) trigger on perfects. Return Tide stores 50% of damage prevented by the ward.
- A stagger never creates a new perfect window for a ward that is held.
- Hush moths drift toward whoever holds the ward and drain 6 mana per second on contact: holding is not always right.

Example: a tier 2 magic hit perfectly absorbed at nerve 1 refunds 10 × 2 × 1.1 = 22 mana.

## Threat families and telegraph language

Source: `combat.json/threatLanguage`, `reactionBands`.

| Family | Visual language | Correct answer |
|---|---|---|
| magic | element colour, glow, shrinking ring | face it and absorb (perfect for reward) |
| physical (steel) | white / steel | roll (i-frames) or step out; the ward only removes 30% |
| unblockable | black core, jagged red rim | leave the marked area, or break the caster with a staff strike |

| Warning floor | Value |
|---|---|
| Positional (ground area) threats | at least 0.4 s |
| Unblockable threats | at least 0.8 s |

The warning lasts at least the floor even if a spell's cast time is shorter or the Lab shortens casting.

Telegraph shapes: ring, cone, line/lane, area, unblockable mark. Painted A13 sigils show a rank mask that fills as the threat approaches release. The exact damage shape is data geometry; a larger dotted locator may help reading small threats but is not the hitbox. See [camera-and-scale.md](camera-and-scale.md).

## Feedback

Sources: CF2 report, `data/presentation/combat-feedback.json`, U4 report.

- The held ward is drawn as a barrier membrane following the aim, clipped exactly to the 140° arc. A blocked hit compresses the barrier (scale 0.88).
- A fresh raise shows a bright "window open" arc for the perfect window.
- A perfect absorb: localized flare, barrier compression, 0.12 s local slow-down to time scale 0.35, and the actual "+mana" refund shown in the world and the HUD. Older builds used a white ring and an 880 Hz bell (0.13 s).
- Reduced motion turns off the slow-down; the window cue and numbers stay.
- Presentation slow-down stretches wall time only; simulation time and the census are unaffected.

## Measured evidence

- W2: unit tests for arc edges, window boundaries, exhaustion and release; timing bots (one always perfect, one 0.16 s late) and a window sweep in `W2-evidence/`.
- CF2 headless Lab comparison (400 bouts): total perfects 539 → 508, successful wards 786 → 707 after the feel pass. This does not show whether a human can perfect more or less often.

## Superseded

| Old | Current | Source |
|---|---|---|
| Gamepad trigger ward (baseline) | Right mouse button; LT on gamepad | D4 |
| Perfect feedback: white ring + bell | Barrier flare, slow-down, visible +mana | CF2, U4 |
| Rear absorb shown in A1b concept image | Forward 140° arc only (image defect) | W4b |
