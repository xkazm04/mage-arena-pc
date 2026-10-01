# Variant 2 wave plan (status table for the executing agent)

Rhythm per wave, as in the sister project: design note first, data-first, tests in `core`, green
build, a desktop check (the owner plays on the PC with a gamepad), a status row, a session-log
entry, an `OWNER-CHECKS.md` entry, one commit. A gate with no command is `unverifiable`; a number
not taken is `not measured`. STOP where a card says STOP.

| # | Id | Wave | Deliverable | Gate | Depends on | Status |
|---|---|---|---|---|---|---|
| 1 | W1 | Director harness | CampState, intents, planner, validator, caps, cache, model client (local + cloud), ring reset, runner; no graphics | golden nights; 500-case fuzz; 300-night soak report; owner reads boards blind | - | not started |
| 2 | W2 | Arena kernel + absorb | desktop libGDX, gamepad + KBM, 60 Hz core, Rain Needle, directional absorb, perfect window, collar clock, dummies, bots | window/arc/maths tests; bot report; owner absorb check | - | not started |
| 3 | W3 | Water lines | 5 lines, branches, Flow, composition screen | line linter (telegraph bands); DPS per 15 s per composition | W2 | not started |
| 4 | W4 | Enemies + Tiro Games | 8 enemies, AI mage on the same kernel (competence 1-2), wave director, missio | 2,000 seeded fights per wave in duration bands; dead-air buckets | W3 | not started |
| 5 | W5 | Loop 0 camp + Hollow Board | day/dusk/night screens, 8 places, night act, board cards, journal | snapshot tests from golden nights; night act hides call latency (measured) | W1 | not started |
| 6 | W6 | Parley | Knowing moments, Parley call, code checks, offline cards | injection suite (100 hostile texts); 300 authored Parleys; refusal without Knowing | W5 | not started |
| 7 | W7 | Ring reset + Gate G1 | persistence, Echo stats, chronicles, Loop 0 to Loop 1 day 1; save/load; soak | owner plays Loop 0 and the first day of Loop 1 | W4, W6 | not started |
| 8 | W8 | Fire, Earth, Air | three schools' lines and identities | cross-school duel matrix: no school > 55% | G1 | not planned |
| 9 | W9 | Tiers II-IV + Echo | new waves, competence 3-4, the Echo semifinal | per-tier simulations | W8 | not planned |
| 10 | W10 | Arcs depth + quests | 12 arc-driven quest graphs, quest linter | reachability, dead ends, effect census | G1 | not planned |
| 11 | W11 | Loops 1-2+ and economy | 7- and 14-day calendars, gold, bread, gear, mastery | economy walk; repeated-day fast-forward | W10 | not planned |
| 12 | W12 | Endings | the Breaking duet; champion, betrayed, revolt | every ending reachable by a scripted policy; owner plays the Breaking | W9, W11 | not planned |
| 13 | W13 | Art integration | art stream assets into the game | 1440p frame time; memory | A1-A5 | not planned |
| 14 | W14 | Cache pre-warm + cost guard | path explorer, shipped cache, daily call cap, model pinned per save | first session offline with live-quality nights; cost report | W11 | not planned |
| 15 | W15 | Fire TV port spike (optional) | core on the Stick, planner-first, gamepad | Stick frame time; owner decides | G1 | not planned |
| 16 | W16 | Release candidate + Gate G2 | balance report, soak, checklist | owner verdict | all | not planned |

Art stream (own worktree, parallel from W2): **A1** four style directions (owner chooses) →
**A2** 16 portraits + expressions → **A3** top-down figures and poses → **A4** backdrops, story
cards, Hollow Board card frames → **A5** line icons and spell effects. Every batch: a one-image proof,
gates, the owner's contact sheet, spent versus remaining.
