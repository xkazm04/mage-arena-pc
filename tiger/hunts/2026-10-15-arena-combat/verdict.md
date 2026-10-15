# Verdict - 2026-10-15-arena-combat

Judge: claude-opus-5-5 (caller session). Pool judged blind from `pool.md`; seats looked up only after this file.
Peer scores exclude own-seat ratings (n=3 each). Fusions P20-P26 were not peer-rated.

## Premise checks (read at the anchors, HEAD 64d55fe)

- `resolveHit` (packages/core/src/arena/kernel.ts:69-95):
  - It returns with no event when the target is immune, so a rolled-through threat is invisible today. **True**, as P06 claims.
  - A guarded hit carries `guarded` but no age. Perfect is `tick - absorbFreshTick <= ticks(window)`. **True** for P03, P06 and P16.
- `updateWard` (kernel.ts:119-128) blocks a raise while `a.pending`. **True**: the "cast-blocked" bucket in P06 is real.
- The mage AI over-defends (packages/core/src/arena/mage-ai.ts:64-70, 78-80). **True**, for the reasons P18 and P02 give:
  - A plain absorb sets `plannedRaiseTick = tick+1` and holds the ward to impact.
  - `nextDecisionTick` advances inside the hold, but the decision body is skipped, so that cadence is spent on silence.
  - The unblockable counter only runs when `target.absorb` is already true.
  - `usesTierCurve` has no reader (docs/design/reconciled/data/arena/enemies.json:194-221).
  - Tiro uses competence 1 and 1.5 (arena-tiers.json:50,64), so rows 1-2 kept byte-identical leave the census untouched.
- Lab ring `recordLab` (packages/core/src/arena/lab.ts:143-166):
  - It strips `randomLog` and the AI audit arrays. `rng` and `nextId` stay in state. **True** for P07 and P14.
  - Training scheduler fields live outside state. **True**.
  - `changeLabTuning` logs only `tuning:${name}` (lab.ts:213-223). **True** for P09.
- `stepLab` never calls `enemyInputs` (lab.ts:173-186). **True** for P19.
- `updateClock` runs per actor. The HUD countdown is for the player only. **True** for P17.
- The HUD prints `${s.mana} mana / Tier` even at Flow 5, and "Alternate spells" otherwise (packages/game/src/arena-entry.ts:764, 788-789). **True** for P11 and P03.
- The season log is discarded after settlement: `p.bout = null` (packages/core/src/season.ts:153). **True** for P09 and P15.
- **False details:**
  - P01 and P02 cite `balance.test.ts` and `arena.test.ts`; neither exists. The ladder runner is packages/core/scripts/report-ladder.ts.
  - P03 cites "Three.js RingGeometry", but the renderer is PixiJS.
  - P04 claims "preloaded A10/A14 GLBs" mapped for brennic, garran and iskar. There is no GLB anywhere and no such mapping in arena-scene.ts. The bodies are sprite atlases.

## Triage

| id | premise | value | conf | effort | fit | score | disposition |
|---|---|---|---|---|---|---|---|
| P06 threat-answer ledger | true | 5 | 4 | S | strength (exact kernel truth) | 20 | **kept, core lead A** |
| P16 answer words on frame | true | 4 | 4 | S | strength | 16 | kept, cluster B |
| P03 ward timing + Flow HUD | partly (Three.js) | 4 | 4 | S | strength | 16 | kept, cluster A/B |
| P11 absorb-to-Crest payoff | true | 4 | 4 | S | strength | 16 | kept, cluster B |
| P22 (fuses P16+P11+P03) | true | 4 | 4 | S | strength | 16 | **kept, lead B** |
| P07 Lab takeover | true | 5 | 4 | S | strength (determinism) | 20 | **kept, core lead C** |
| P09 feel capsules | true | 4 | 4 | M | strength | 10 | kept, lead E |
| P21 (fuses P06+P07+P09+P15) | true | 5 | 3 | M | strength | 9.4 | split into A, C, E, J |
| P25 checkpoint tape seek | true | 4 | 3 | M | strength | 7.5 | folded into E and J |
| P18 curve play | true | 4 | 4 | M | strength (fair AI) | 10 | **kept, core lead D** |
| P02 L4 fix + tier curve + staff interrupt | partly (fake test file) | 4 | 3 | S→M | strength | 7.5 | folded into D. The staff-interrupt part was dropped: `interruptsCasts` semantics are not owner-decided. |
| P20 (fuses P18+P12) | true | 4 | 3 | M | strength | 7.5 | live-impact refresh detail folded into D |
| P26 (fuses P02+P12+P18) | true | 4 | 3 | M | strength | 7.5 | folded into D and H |
| P12 rival plans | true | 4 | 3 | M | strength | 7.5 | kept, lead H |
| P23 (fuses P18+P12+P17) | true | 4 | 3 | M | strength | 7.5 | split into D, G, H |
| P17 rival collar | true | 3 | 3 | S | strength | 9 | kept, G |
| P19 live Lab creatures | true | 3 | 4 | S | strength (Lab) | 12 | kept, F |
| P08 census forecast | true | 4 | 3 | M | strength (census) | 7.5 | kept, leap I |
| P15 read/take over settled bout | true | 5 | 2 | M | strength | 6.3 | kept, leap J |
| P10 player's Shade | true | 5 | 2 | L | strength | 4 | kept, leap K |
| P13 committed lunges | true | 3 | 3 | M | partly | 5.6 | kept, leap L |
| P01 counterfactual ghosts | partly (fake test file) | 4 | 3 | M | strength | 7.5 | folded into I and J. The ghost render is deferred. |
| P14 drills | true | 4 | 2 | L | strength | 3.2 | subsumed by C+E (the foundation), left out as a whole |
| P24 (fuses P06+P09+P14+P19) | true | 4 | 2 | L | strength | 3.2 | left out: "certified alternative" search is unspecified |
| P04 camp rivals into Games | false (GLB) | 3 | 2 | M→L | crosses into camp | 2.4 | **dropped**: out of hunt scope (camp); its asset premise is false |
| P05 higher tiers + Resonance | true (tiers), invented (Resonance) | 3 | 2 | M→L | partly | 2.4 | **dropped**: the planned waves are W9 and W12. Resonance invents Breaking rules the owner has not designed. Peers rated it 3.0. |

## Clusters (cross-seat agreement)

- **Grade the answer.** P06, P16, P03, P22, P21, P25 and P15 (grading part). Every seat
  proposed a version of this: the strongest signal in the pool.
- **Takeover and retry.** P07, P01, P14, P15, P21, P24 and P25, from 4 seats.
- **Make the ladder honest.** P18, P02, P12, P20, P23 and P26, from 3+ seats.
- **Capsule and tape.** P09, P01(5), P21, P24 and P25.

## Composition

Thesis: **the perfect absorb is the game's signature skill and today it is an invisible
9-tick cliff. Make it a skill the player can read, retry and race, against an opponent
ladder that actually gets harder.**

Core: A, B, C, D. Supporting: E, F, G, H. Leaps: I, J, K, L. The scope is in scope.md.
