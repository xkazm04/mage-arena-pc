# Open questions, decisions and known contradictions

This file collects the owner decisions that shape the campaign, the questions still open, and the contradictions or gaps found between sources while preparing this export.
A reviewer or developer should resolve the contradictions before building the waves that depend on them.

Status: snapshot, 2026-10-07. Decisions are the owner's (`docs/MAGE-ARENA-PLAN.md`). Contradictions were found by reading the data, the code and the wave notes; none is fixed here.

## Owner decisions that affect the campaign

| # | Decision | Effect on the campaign |
|---|---|---|
| D1 | The Director (the model chooses verbs from a closed list; code owns every number) on the season structure; the deterministic planner is the fallback | [director.md](director.md) |
| D2 | One season of six weeks, six Games, no loops. Knowings, trust, reputation and mastery persist | [season-and-time.md](season-and-time.md) |
| D3 | Deaths exist and are very hard to plot | [deaths-and-endings.md](deaths-and-endings.md) |
| D6 | Director engine for development: Claude CLI, Sonnet 5.5 medium; local model for bulk soak; planner always present; hosted API later (W14) | [director.md](director.md) |
| D9 | Original names, text, art and rules only; no vendor or model names in game files | all content |
| D25 | Camp time in hours; actions cost hours; travel is free; places open and close at hours; phases derived; the Director's inputs state time in hours | [season-and-time.md](season-and-time.md) |
| D26 | Place buttons show only the place name; a header with icons for gold, reputation and fatigue; a rendered daily clock | gameplay docs |

## Open questions for the owner (each has a default)

| # | Question | Default in force |
|---|---|---|
| Q1 | Can the player character die to a camp plot? | Yes, rarely, only if isolated and unwarned; ends the run with a chronicle (martyr) |
| Q2 | Lethal arena bouts decreed from a high tier as story beats? | Yes, rare, from Tier III upward |
| Q3 | Pick one of four characters at the start; the other three become allies or rivals in the bond arc? | Yes (only Water/Cassia is playable now) |
| Q4 | Desktop shell: browser first, Electron or Tauri at packaging? | Browser first; decide at W14 |
| Q5 | Scope of typed role-play (Parley)? | Only at Knowing moments, through the Director, with offline cards (built) |

Pending owner checks: blind reading of generated Hollow Board mornings (W1); Gate G1, playing weeks 1-2 (W7); the feel of camp pacing, the hour economy and the listening difficulty (W5).

## Contradictions and gaps found between sources

Ordered by impact on further development.

1. **Story pack vs season data (endings).** The in-progress story pack sets an ending `collared` (refusal) that is not in `data/season.json` `endings`, and lowers the Breaking threshold to 50 when `septima.cracked`. The arena tier data says trust ≥ 60.
2. **Story pack vs cast.** The pack uses characters that are not in `data/characters.json` (tamar, calla, lucia, pell, meret, aurel, dumno, belen) and roles (partner, villain, agent) that are not cast ids.
3. **Story pack vs disabled deaths.** The pack contains lethal outcomes (`X.lethal`, `summaDeath`, `partner.dead`, `beloved.dead`) while `death-reservation.json` has `enabled: false` and W10 is not built.
4. **Tent Trial cadence.** The season has a Tent Trial every week on weekday 6 (built). The story pack has a single quest "The Tent Trial" on day 33 with different outcomes (patron entry, fifth tent). The relation between the two is not specified.
5. **Loop wording left in arena data.** `arena-tiers.json` `_about` says "The Games are the last day of every loop" and mastery "persists across resets"; `tentTrial.day` says "loop day 2 in Loop 0"; every tier's `rankUpOn` says "(persists across resets)". `stats.csv` keeps an `on_reset` column with Echo rules ("Echo: restarts at max(1; best rank - 1)…", "resets to 5", "resets to 10"). Loops were removed in W0 (defect `ring-echo-chronicle`); these files belong to the arena stream (defect `arena-loop-content`, "reserved arena stream").
6. **Camp effects in `stats.csv` that the rules do not implement.** `stats.csv` says "WORK pays +1 gold at rank ≥ 3" (vigor), "lessons progress +1 extra at rank ≥ 3" (focus), "at renown ≥ 40 the crowd throws one mana flask (+25) in a final", and guile "scouting reveal". `rules.json` gives WORK a flat +4 gold, and the camp code has no rank bonus. These may be stale or unbuilt; the data authority for them is unclear.
7. **Mastery gain is not wired.** Tier data defines mastery +1 for winning a final (or reaching a final twice), but the W7 bridge applies only gold, renown and trust. The season cannot reach Veteranus (mastery 2) yet.
8. **Wave numbering for quests.** `packages/core/src/quest.md` calls the quest engine W10; the plan assigns W10 to deaths and W11 to quests.
9. **Unused arc numbers.** `rules.json` `arcs.peerTrust` (20) and `arcs.swornTrust` (50) and `effects.tornToStrangers` (−20) are not referenced by the camp code. They are either reserved or stale. Bond "sworn" uses `bondSwornTrust` (40), not `swornTrust` (50).
10. **Goal plans vs planner goal intents.** `data/goals.json` plans and `config.json` `planner.goalIntents` differ (for example escape_research: TRAIN/BEFRIEND/PLOT vs PLOT/CONFIDE/WATCH). Two partial authorities for "what a goal suggests".
11. **OFFER has no effect.** Only Venno may OFFER; it records a secret fact and changes nothing. The terms (`favour_for_training`, `back_entrant`) suggest Games-related effects that are not specified.
12. **Strays `desperate`, fifth tent and bond `sworn`/`fractured`** are tracked states with no downstream consequence yet (W11/W12).
13. **Presence ignores intent.** NPC locations come from a fixed schedule (`camp-play.json` `presence`), not from their chosen intent. An NPC can be "at the Commons" while their day's act is TRAIN at the Yard.
14. **Plan status table is stale.** `docs/MAGE-ARENA-PLAN.md` section g says every wave is "not started" on both `main` and `integration`, while reports exist for W0-W7, U1-U6c, CF1, H1 and others.
15. **Plan overview says "four endings".** Data has five. Already logged as defect `ending-count`; the overview sentence on `main` still says four.
16. **External story sources.** The story pack refers to a season spine, a story graph, a story bible (P1-P24) and drafts that are not in this repository. Reviewers cannot check the pack against them.
