# W1 Director harness: the camp's nights, headless, against a real model (M/L)

Variant 2, Phase 0 (the vertical slice). Depends on: nothing. Unlocks: W5, W6, W7.
This wave proves the hardest part first. It has no graphics at all. "Authored" marks a number nobody
has measured.

## Why this wave is first

This variant bets that a language model can direct 16 characters every night, in character, inside
bounds, cheaply, with an offline fallback. If that is false, nothing else in the variant matters, and
the project should learn it in week one rather than after the art is made.

## Design note first

Write `docs/mage/W1-director.md` (one page): the night pipeline order, the group split, the knowledge
slice rule, the cache key, the fallback ladder, and a table of every validator check with its test.

## Deliverables (all in `core`, pure JVM, plus a thin model client)

1. **CampState loader** for `design/data/*.json|csv` (moved unchanged into
   `core/src/main/resources/camp/`). One owner per quantity: trust, debt, loyalty, hunger, renown,
   gold, knowledge, playerKnowings, mainsTrust.
2. **Intents** (`intents.csv`) and their **resolution** in the fixed order (BEFRIEND/PROTECT/WORK,
   WATCH, SCHEME, RECRUIT/DEFECT/REPORT) with seeded d20 = `rng(saveSeed, day, actorId, actionId)`
   (no loop index). **Arcs** (`arcs.json`) evaluated by code; intents only push available edges.
3. **The planner**: a deterministic utility function over the intents (goal progress + need urgency +
   school weight from `schools.json` + relationship terms + seeded noise in [-0.05, 0.05]) writing
   the Director's schema with template lines. It must be able to play every night alone.
4. **Group input builder**: per group, members' sheets, relationships, **their own knowledge only**,
   the public board, calendar, caps, and (from night 2 of a loop) the mains' loop chronicles.
   Canonical JSON (sorted keys, no floats) so hashing is stable.
5. **Model client interface** `DirectorModel.decide(groupInput): GroupOutput?` with two
   implementations: a local endpoint (the dev machine's Ollama, the 27B and the 9B models) and a cloud
   endpoint behind an environment variable. Timeout per call; parallel calls; no retries in a loop
   (one retry on a transport error, then planner).
6. **Validator** (`director-prompt.md` table) and **camp caps** applied after all five groups.
7. **Cache**: `sha256(promptVersion + modelId + canonical(groupInput))` to a file store; replay on hit.
8. **Ring reset**: persisted vs reset fields per `loops.json`; Echo stats; loop chronicles (<= 12
   facts per main, chosen by salience).
9. **Runner**: `gradlew.bat :core:run --args="nights --loops 3 --policy <p> --model <local27b|local9b|cloud|planner> --seed <n>"`
   writes a JSONL of every night (inputs hash, source per group, items, validator verdicts, timings, tokens).

## Tests

- **Golden nights**: `design/reconciliation/worked-nights.json` nights A, B, C1 and C reproduce
  exactly from stored cache files (model outputs are fixtures here) and, for C, from the planner.
  Every delta, transition, rejection, cap drop and cache hit count matches.
- **Validator fuzz**: 500 generated malformed outputs (bad enums, unknown targets, forbidden intents,
  facts outside knowledge, digits in lines, over-cap schemes, wrong group members, truncated JSON):
  each is rejected for the right reason and the planner fills the gap. The test asserts it ran 500
  cases (non-empty scope).
- **Planner alone**: 1,000 loops (Loop 0 + Loop 1 + two 14-day loops) per player policy with
  `--model planner`: the same invariants as variant 1's W2 (nobody in two places, no deaths, ranges,
  caps, coverage of every arc state >= 5% of runs).
- **Soak with the local 27B**: 300 nights (about 1,500 calls). Report: item rejection rate by reason,
  planner share, cap drops, cache hit rate on replayed days, p50/p95/max call latency, tokens per call.
- **In-character judge**: a second local model (the 9B) answers five fixed questions per decision
  (Does the act follow from the goal? From the values? Would this person say this line? Does it use only
  what they know? Is it consistent with yesterday?) as JSON; report the share of "no" per question.
  The judge is diagnostic, not a gate: its verdicts go to the owner's reading list.
- **Divergence**: 200 seed pairs differing only in the player's day-1 choice: board facts differ by
  day 7 in >= 80% of pairs (authored threshold), live and planner modes reported separately.
- **Replay**: a repeated day hits the cache for every group whose input is unchanged; changing one
  player act changes at least one group's key.
- **Cost report**: tokens per night x placeholder prices; projected cost per loop and per playthrough.

## Gate

```
gradlew.bat :core:test
gradlew.bat :core:run --args="nights --loops 3 --policy curious --model local27b --seed 7"
gradlew.bat :core:run --args="nights --loops 3 --policy curious --model planner --seed 7"
```

`docs/mage/W1-director-report.md` holds the soak numbers, the judge table, the divergence
distribution, the cost projection, and the Hollow Boards (fact lists and lines) of three seeds for
live and planner side by side.

## Owner check

Read the three seeds' boards, live and planner side by side, without being told which is which.
Answer: which camp would you rather wake up in? If the owner cannot tell them apart, the variant's
cost is not buying anything: say so in the report.

## Kill criteria and STOP

| Trigger | Action |
|---|---|
| > 15% of items rejected over the soak | STOP. Shrink the vocabulary or split the call; if still high, recommend variant 1's Ledger behind this schema. |
| p95 call latency > 20 s on the local 27B with 5 parallel calls | Record it; try the 9B; the latency budget assumes the night act hides about 40 s. |
| Golden nights cannot be reproduced because the design is ambiguous | Fix the design file first, then the code; never the test. |
| The owner prefers the planner's boards | STOP and report: the live Director is not earning its cost. |
| Any wish to add graphics | Refuse; W5 owns the camp screens. |
