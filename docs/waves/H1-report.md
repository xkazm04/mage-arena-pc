# H1 - hit reactions and persistent defeat

2026-10-04. GAME / integration. [Design note](H1-design.md), [owner feel-test](../START-HERE.md#h1-feel-test-the-hit-reactions-and-defeat).

## Shipped behavior

Actual HP loss attempts a short stagger, including guarded chip. The default duration is
`clamp((0.10 + HP removed * 0.003) / (entity poise * poise multiplier), 0.10, 0.20)`
seconds, rounded up at 60 Hz. The tail lasts another .18 s after the stun ends. During
that explicit anti-stunlock exception, damage and cosmetic flinch continue but a new
cast/movement opportunity is protected. Roll i-frames, perfect absorbs and zero HP loss
never stun. Ward remains held and drains normally during stun; no artificial new perfect
window. A hit after roll i-frames can stop the remainder of the roll.

Every body shares the rule. Stagger cancels pending mage casts and enemy windups,
immediately clears velocity, and leaves spent mana, stamina and cooldowns spent.
Mage AI uses the same activation gate. Authored poise: shieldman 1.8, mire maw 2,
thornback 2.3, others 1. The Lab exposes independent player/opponent poise as well as
global scaling, all stun bounds, knockback and presentation settings in three Hit pages.
Tuning exports are version 3; old constant-duration experiments have an explicit migration.

The former down boolean is removed. DEFEATED is the serialized authority read by movement,
casting, targeting, hostile effects, healing, both AIs, projectile collision, encounter
counts and HUD. The health transition establishes defeat before cancelling commitments.
Targeted windups lose their dead target. The actor remains addressable with its defeat
tick/direction and never reacts to another hit. Already-launched projectiles and explicitly
survivesOwner corpse hazards keep their authored lifetime; they cannot collide with corpses.
Advancing/resetting the bout removes old opponents; G explicitly revives/refills in the Lab.

A10 hit/death clips are selected where present. A short sprite recoil away from the recorded
hit direction, squash, shake, white flash, number and player edge cue make contact visible
without a flinch clip. Contact impact art is smaller/translucent enough to show the figure.
Hit and stagger have separate audio hooks (the stagger currently reuses the delivered hit
sample at lower pitch/gain). Reduced motion removes displacement/shake and snaps the
fallback death to the lying pose. Death holds the final A10 frame, or rotates/settles the
same entity's sprite when its death clip is missing. Its aura fades. Presentation clocks
finish death/contact effects after the simulation stops; core state is untouched. The
results panel leaves the player's corpse visible on the floor. The Lab labels defeat and
keeps G/R available. A14 replacements are handled by U6b, not silently asserted here.

## Before and after, measured headless

100 seeds 7331-7430 per school; Water Rotation reference AI level 3 against the Lab level 2
practice profile, aggression .75, 10 m, Current tuning, damage ON, 120 s cap. Both sides
obey the core. No human play is represented. Hits-to-defeat count positive HP deltas on the
losing figure; TTK is the winning-player subset. Staggers count new stagger deadlines,
including fatal contacts. Cancels count interruption events (including voluntary roll
cancels), not only hit-caused cancellations. Raw rows: [before](H1-evidence/before.json),
[after](H1-evidence/after.json).

| Opponent | Hits to defeat median before / after | Winning TTK median s before / after | Staggers total before / after | Cancels total before / after |
|---|---:|---:|---:|---:|
| Fire | 39 / 38 | 69.38 / 65.47 | 6244 / 4809 | 137 / 109 |
| Water | 44 / 44 | 75.58 / 71.75 | 7082 / 5469 | 119 / 102 |
| Earth | 44 / 44 | 74.53 / 68.98 | 6302 / 5253 | 150 / 142 |
| Air | 49 / 49 | 77.37 / 72.02 | 6967 / 5188 | 101 / 82 |

Winning samples are respectively 21->15, 32->36, 53->62 and 8->5, so TTK is not a
same-winner paired estimate. Median whole-bout durations moved 59.87->54.35,
72.35->66.42, 74.53->68.98 and 66.22->60.55 s. Longer immobilization changes spacing
and aim opportunities; the longer tail permits fewer separate stuns. Those mechanisms
are consistent with the observations, not a claim of causal isolation or better feel.
Enemy HP/damage/counts were not altered to force a timing result.

## Full census and pacing bands

`npm --prefix packages/core run report:w4 -- --evidence H1-evidence --tag census`
runs 2,000 fixed seeds per wave (8,000 total), fresh starts, original reference policy,
no refills or dropped seeds. [Final census](H1-evidence/census.json) includes source hashes,
all raw fights, replay sampling and validity checks. All waves pass, with no timeouts,
invalid states, replay failures or premature player defeats.

| Wave | Median seconds CF2 / H1 | Authored band old -> new | Reason |
|---|---:|---|---|
| Soldiers | 36.02 / 36.03 | 25-40 -> 25-45 | Median unchanged; the measured p90 43.85 merits a wider encounter target |
| Creatures | 45.85 / 45.93 | 30-48 -> 35-60 | Heavy poise and pack spacing still yield a broad distribution, p10 37.43 / p90 55.78 |
| Semifinal | 60.88 / 57.10 | 45-75 retained | The shorter duel remains inside a useful target; no need to narrow it to this sample |
| Final | 67.35 / 62.00 | 45-85 -> 45-80 | Interruption shortens duels; p90 75.27 supports lowering the upper target |

Bands are authored pacing goals, not confidence intervals or a promise every seed falls
inside them. New in-band fractions are about 90%, 90%, 88% and 93%; exact values are in
the census. The full census was rerun against the final bands after the initial assessment.

## Verification and limits

- `npm run gate`: 205 TypeScript tests plus 11 reference checks; zero design contradictions.
- `npm run build:game`: passed (existing bundle size advisory).
- H1 core tests: floor/ceiling/poise, paid-cast cancellation, movement stop, sustained fan
  recovery, ward chip, zero damage, perfect/roll protection, both AI types, defeat state
  consumers, persistent corpses, explicit revival, tuning migration and exact continuation.
- A full season-envelope test stops on an active stagger and then on player defeat,
  round-trips through encode/decode/independent replay and preserves the corpse reference.
- `$env:MAGE_EVIDENCE="H1"; npx tsx packages/tools/src/u3-replay.ts`: complete two-week
  same-seed and save/load byte equality, 1,300,369 bytes, hash `2451fa7085c6a8534036a26e347b48d6281d42f22dcf51616570ea82b7452bc2`; [exact record](H1-evidence/replay-save.json).
- `npx tsx packages/tools/src/h1-browser.ts`: passed, 36 native 1080p/1440p captures of Hit pages, actual Lab
  stagger metrics, visible sprite displacement, roster corpse poses, frozen simulation
  with continuing death presentation, held final poses, G/R, reduced motion and results.
  [Native gallery](H1-evidence/index.html), [browser observations](H1-evidence/browser.json).

Owner feel, television viewing distance and audio preference remain unmeasured. The
existing A10 gaps are visible in the browser pose diagnostics; procedural lying poses
are intentional interim presentation. U6b audits current A14/AU3 deliveries next.
