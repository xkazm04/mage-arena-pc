# Campaign implementation status

This file lists every campaign mechanic with its implementation status and the evidence for it, as of integration commit `b1efd46` plus uncommitted quest work (2026-10-07).
Use it to tell which parts of the other documents describe a running system and which describe intent.

Status: snapshot built from the wave reports (`docs/waves/*-report.md`) and the code. The status table in `docs/MAGE-ARENA-PLAN.md` section g is out of date on both `main` and `integration`: every wave still says "not started", although W0-W7 have reports.

Legend: **built** = implemented and covered by tests or gates. **partial** = implemented for a subset (for example Water only, weeks 1-2). **in progress** = code exists but is uncommitted or unwired. **planned** = a wave is assigned but no code exists. **reserved** = data shape exists, gameplay disabled.

| Mechanic | Status | Evidence (wave, test or gate) | Notes |
|---|---|---|---|
| Season calendar (6 weeks, Games weekly, Trial eve, scheme window) | built | W0, U3a; `calendar` in `camp.ts`; `npm run gate` | 42 days |
| Hour-based day (14 hours, free travel, phases, closing hours) | built | U3a (162 TS tests at that wave); `u3-replay.ts` | D25 replaced slots |
| Eight places, opening hours, activities | built | W5, U3a | Presence is a fixed schedule |
| 13 closed intents with effects | built | W0 replayer golden nights; W1 core | OFFER has no numeric effect |
| Contests (seeded d20), resolution order, traces | built | W0/W1; `data/sample-night.json` | |
| Camp-wide caps | built | W1 tests | |
| Daily settlement (hunger, routine training, stocks, admission, decay, bond) | built | W0 golden and branch nights | |
| Schemes: steal, poison, persuade, rumour; caught and stocks | built | W0 branches `caught`, `stocks-and-games`, `rumour-minimum-fails` | |
| Rumour value reactions | built | W0 | |
| Strays: hunger, huddled, desperate | partial | W0 | States recorded; consequences of `desperate` not specified |
| Tent admission, DEFECT | built | W0 | |
| Fifth tent | partial | RECRUIT adds to the `fifth` list | No fifth-tent stores or rules |
| Bond of the Four (first_watch, plotting, sworn, fractured) | built | W0 | What sworn or fractured unlock later: planned (W11/W12) |
| Torn-to-peers / torn-to-strangers trust | reserved | defect `torn-to-peers` | Needs arena duality bouts |
| Director pipeline (groups, schema, validator, planner, caps) | built | W1 PASS: 300 local + 30 Sonnet nights, 500-case fuzz | |
| Cache by complete request, revalidated hits | built | W1 `cache-replay.ts` (1,650 hits, 0 calls) | |
| Cost guard / durable budget | built | W1, W7 ledger | |
| Providers: planner, Ollama, Claude CLI | built | W1, W5, W7 | Hosted API planned W14 |
| Night act hiding latency, grace and planner fill | built | W5 (measured local night) | |
| Text guards and phrase bank | built | W1 (line repair rate measured) | Local line repair 18%: voice-quality limit |
| Hollow Board and journal facts | built | W5 | UI in gameplay docs |
| Listening act (earn a Knowing) | built | W5 | Gameplay docs |
| Parley (Knowing-gated, cards, typed) | built | W6: 100-case suite, 100 local probes, 300 card census | 4 semantic false positives disclosed |
| Season bridge: Tent Trial | partial | W7 (Water only) | |
| Season bridge: Tiro Games entry and rewards | partial | W7 (weeks 1-2, Tiro) | Mastery gain not wired |
| Save/load, replay, receipts | built | W7: byte-exact replay, 7 failure-matrix tests, 30-min soak | |
| Other playable schools (Fire, Earth, Air as season entrants) | planned | W8 | Lab practice profiles exist (gameplay) |
| Higher Games tiers (Veteranus, Primus, Summa) | planned | W9 | Data exists in `arena-tiers.json` |
| Deaths, Plot objects, the Vigil's attention, executions, census | reserved | `death-reservation.json`; W10 | |
| Lethal arena bouts | planned | W9 hooks | |
| Arcs depth, quests, six-week economy | planned / in progress | W11; quest engine uncommitted | |
| Quest decision-graph engine | in progress | uncommitted `quest.ts`, `quest.test.ts`, linter | Not wired into the camp |
| Story pack (15 scenes) | in progress | uncommitted `story/dialogue/` | Introduces cast and endings not in the data |
| Endings (breaking, champion, betrayed, revolt, martyr) | planned | W12 | Only names and the Breaking rule exist |
| Owner blind read of generated mornings | pending | W1 | |
| Gate G1 (the owner plays weeks 1-2) | pending | W7 | |
| Owner feel of camp pacing, slot economy, listening difficulty | not measured | W5 | |
