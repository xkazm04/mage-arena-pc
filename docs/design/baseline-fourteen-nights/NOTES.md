# Fourteen Nights

## The bets

- **The language model directs the camp.** Every night, five group calls choose each character's next verb from a closed list of 13 intents, citing a value and facts from that character's own sheet and knowledge. Code validates every item, enforces camp-wide caps, owns every number and resolves the verbs with seeded dice. Anything invalid, late or offline falls to a deterministic planner.
- **The prison is a time loop.** Loops of 3, 7, then 14 days, each ending at the Games. Mastery, Knowings, the four mains' trust and Echo stats persist; everything else resets. The reset caps how far a model-driven world can drift.
- **Determinism as fiction.** The cache key holds no loop index: if the player changes nothing, the night replays exactly, for free. Change one thing and the night goes differently.
- **PC first, gamepad first.** Directional 140° absorb, lines that climb tiers in place, Parley typed on a keyboard.

## Why this loop holds

Inside a loop, stats, trust and scouting feed the Trial and the Games, and the Games feed gold, renown and Mastery. Across loops, what the player learned in the camp (who poisons whom, what Ophel wants) becomes Parley leverage and scheme warnings, and Mastery raises the next Games' tier. The bond of four is the only trust that survives, so it grows loop over loop until the Breaking, a duet of perfect absorbs, is possible.

## Biggest risk and the early test

The model will not stay in bounds. W1 is the headless Director harness, before any graphics: 300 nights with the local 27B model against the validator, a 500-output fuzz, in-character judging and a cost report. If more than 15% of items are rejected, STOP and shrink the vocabulary, or fall back to variant 1's Ledger behind the same schema.

## Known limits

- Runtime cost is real (about 1 USD a playthrough before cache at placeholder prices) and depends on a provider; offline play is planner-only.
- A model update invalidates the cache; saves pin their model.
- Repetition fatigue is unmeasured; loop lengths are owner-tunable.
- PC first departs from the sister project's TV stack; a TV port is a spike, not a promise.
- Numbers are authored; feel is the owner's.
