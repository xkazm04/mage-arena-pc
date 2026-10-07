# CF2 design — readable commitments and impacts

2026-10-04, written before implementation, after the CF1 commit. Owner hands
remain the decision-maker. The 400-fight baseline shows low reference survival
against several practice profiles and very few successful wards: do not equate
this with human balance. The baseline is retained in CF2-evidence/before.json.

Read-only registry sources used: systems-canon/realtime-combat-semantics,
balance-validation/combat-pacing-and-dramatic-arc and encounter-balance-simulation,
asset-production/motion-and-audio/motion-quality-gating/techniques/
genre-response-latency-norms. Apply shared-kernel authority, visible commitments,
seeded inputs, honest reaction floors and outcome distributions. Genre timing
norms are hypotheses, not a physical latency measurement of this game.

Proposed shipping Current: short acceleration/braking (60/90 m/s²), immediate
mouse aim, visual turning 24/s; casting movement .75, commit .65 and recovery
.05 s. Roll keeps its four-metre distance and existing i-frames; recovery movement
is half speed. Modest .05 s stagger on unguarded hits, .16 m knockback per 10
damage, a .16 s stagger immunity tail to prevent a projectile fan stunlock.
Cast/travel multipliers remain 1 initially: pacing should change through decision
and commitment quality, not an unreviewed global damage buff. All values live in
data; Lab exposes the existing knobs. Preserve old Current as an export fixture.

Add authoritative release events carrying activation and spell identity/location:
effects and cast sounds must fire on the release frame, not guessed disappearance
of a pending cast. Windup animation follows pending duration; interruptions do
not emit release/impact. Roll recovery and cast commitment have tests. Stagger
and movement state must reset between waves and survive JSON continuation.

Feedback: 2–3 frame local presentation hit stop on meaningful hits, brief true
white silhouette flash, damage-scaled world shake (HUD/aim coordinates stay
stable), bounded pooled floating numbers, existing audio impact/hit hooks.
Player perfect absorb adds a short compression slow-down, bright window cue and
visible actual +mana refund. Presentation time stretching never changes the
fixed-step kernel or recorded input order; census times remain simulation time.
Reduced motion disables shake/stop/slow-down and retains numbers/ward cues.
No art generation or sigil redraw: overlay cues and A13 loader remain separable.

AI: preserve competence ladder and ≥250 ms observed-threat reaction. Use actual
pending spell profiles for travel prediction; avoid starting an unfinishable
cast while a scheduled ward is imminent. Add seeded strafe phase/distance
variation and weighted useful spell choice, keeping sustain/counter priorities.
Observe only visible world cues, never future player inputs; both sides consume
the same action/resource rules. Report changed census bands with reasons after
measurement, including tails, losses, timeouts and exact replay checks.

Validation: mechanical tests, complete gate, 2,000 fresh fights per wave, same
400 Lab seeds before/after, authoritative season round-trip, real-browser Lab
controls and release/impact/ward screenshots at 1080p/1440p. Report anything
unmeasured honestly: input latency, sound quality, subjective weight/fairness and
the owner preference between presets. No push or art-worktree writes.

Provisional band revision before the full census: soldiers 25-40 s unchanged; creatures 30-48 s (allow two extra seconds for acceleration/recovery and displacement); semifinal 45-75 s and final 45-85 s (five-second extra upper margin for cast commitments and defensive choices). The pilot already lies within the original duel bands; widening is an explicit pacing allowance, not a failed-median rescue. Retain all tails and win/loss rates in the report; owner review may reject this difficulty.
