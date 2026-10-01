# W2 Ledger kernel: the camp simulation that moves the world every night, headless (M/L)

Variant 1, Phase 0 (the vertical slice). Depends on: nothing (it can run in parallel with W1 in
its own worktree). Unlocks: W6, W7. This is the wave that proves the hardest part of the game, so it
comes second and it has no screens at all.

## Why this wave is second

The thing that must never break is the reconciliation staying sensible. In this variant the
reconciliation is **code**: a deterministic social simulation decides what every character did,
and a language model only writes the words afterwards (W6). So the risk is not "will the model
behave", it is "is a deterministic camp interesting, consistent and moved by the player". W2
answers that with numbers from thousands of simulated seasons before a single camp screen exists.

## Design note first

Write `docs/mage/W2-ledger.md`: the night order (below), the predicate vocabulary, the utility
formula, and a table of every invariant with the test that enforces it.

## Deliverables

1. **`camp` package inside `core`** (pure JVM): `CampState` (characters, relationships, tents,
   situations, calendar), loaded from the design package's JSON and CSV files, which move into
   `core/src/main/resources/camp/` unchanged. One loader, one authority per quantity
   (trust, debt, loyalty, hunger, renown, gold each live in exactly one map).
2. **The option scale**: the 14 activities of `activities.csv` as data. Every character, the
   player's three rivals included, chooses from the same list. Location and slot rules enforced.
3. **The utility planner** (dawn): for each NPC and each slot,
   `u(a) = sum over goals(goalWeight * progress(a, goal)) + needUrgency(a) + schoolBias(a)
   + relationshipMod(a) + noise`, where `noise` is a seeded value in [-0.05, 0.05] and a chosen
   multi-slot plan has a **dwell** of 2 slots (hysteresis 0.1) so characters do not twitch.
   Every decision writes a **decision trace** row: character, slot, top 3 options with scores,
   the winning reason.
4. **Contests**: d20 from `rng(hash(saveSeed, day), actorId, actionId)`; formulas exactly as in
   `activities.csv` and `situations.json`.
5. **The four situations** (`situations.json`) as data-driven state machines evaluated in the
   fixed night order. A predicate name not in the vocabulary is a load error, not a warning.
6. **The night**, in this order, as one function `Night.run(state, dayActions): NightLedger`:
   1. resolve contested actions; 2. apply deltas with clamps (trust -100..100, renown 0..100);
   3. hunger and loyalty; 4. situations a, b, c, d; 5. defections and joinings (max 1 defection
   per night); 6. goal retargets from `goals.csv`; 7. write facts with visibility and salience;
   8. select 3 to 5 board facts by salience (+3 if about the player, +2 if novel this week);
   9. plan tomorrow.
7. **The headless season runner**: `gradlew.bat :core:run --args="season --seeds 1000 --days 42
   --player brennic --policy <random|greedy-social|hermit|schemer>"` writes a JSON report.

## Tests (no device, no screen, no language model)

- **Golden nights**: the three worked nights in `design/reconciliation/worked-days.json` are
  reproduced exactly from their start state and day actions (every delta, transition, retarget
  and fact). This is the contract between the design and the code.
- **Invariants over 1,000 seasons x 4 player policies** (each one a test that also asserts its
  scope is non-empty: it counts the nights and facts it examined):
  - nobody is in two places in one slot; nobody acts while in the stocks;
  - no character dies in the camp; no magic is used in the camp;
  - every fact's actors and targets exist and are present that day;
  - every trust, renown, hunger and loyalty value is inside its range;
  - at most 2 schemes per night (3 on the eve), at most 1 defection per night;
  - no character holds a goal its trigger table cannot produce;
  - a Stray never receives a ration; the Vigil never schemes.
- **Coverage**: every situation state is reached in at least 5% of seasons (the fodder outcome
  at least 1%), every activity is chosen by at least one NPC in 95% of seasons, every goal is held
  by someone in 50% of seasons. An unreached state is reported by name.
- **Player choice matters**: for 200 seed pairs that differ only in the player's day-1 choices
  (help Fenna versus walk past), the worlds diverge: at least 3 board facts differ by day 7 in
  80% of pairs (authored threshold; the report gives the distribution).
- **The world moves without you**: with the `hermit` policy (the player only rests), at least
  4 facts of salience >= 6 occur per week in 90% of seasons.
- **Not chaos**: the same seed and the same player inputs give byte-identical ledgers; no single
  character defects more than twice per season; trust between two characters does not swing by
  more than 40 in one night.
- **Performance**: one night for 21 characters runs in < 5 ms on the desktop JVM (the Stick is
  measured in W7).

## Gate

```
gradlew.bat :core:test
gradlew.bat :core:run --args="season --seeds 1000 --days 42 --player brennic --policy random"
```

The season report lands in `docs/mage/W2-season-report.md` with: facts per week by type,
situation state reach rates, defections per season, rumour truth rate, the divergence
distribution, the hermit-week salience counts, and the three most and least common board facts.

## Owner check

Print the first 7 Dawn Boards (fact lists, no prose yet) for three seeds and three player
policies into the report. The owner reads them and answers: "Would I want to know this the next
morning?" A world the owner finds dull here is a STOP, not a tuning task.

## Done when

The golden nights reproduce, every invariant and coverage test is green with a non-empty scope,
the season report is written, and the owner's three-seed read is recorded.

## Kill criteria and STOP

| Trigger | Action |
|---|---|
| Golden nights cannot be reproduced because the design rules are ambiguous | Fix the design file first (one source), record the ambiguity, then the code. Never fix the test. |
| Divergence < 50% of pairs | STOP: player choices do not matter enough; report which situations absorb the difference. |
| Hermit policy: fewer than 2 salient facts a week | STOP: the camp is static; report before adding more activities. |
| A situation state is unreachable after the data is checked | Report it by name; the owner decides whether to cut it. |
| The owner finds the fact lists dull | STOP. The variant's bet (code decides) is in question; offer the director variant's harness as the alternative. |
