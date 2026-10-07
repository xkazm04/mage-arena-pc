# Quests and story

This file describes the authored narrative layer: the quest decision-graph engine and the season story pack of 15 scenes.
Both are **work in progress**: they exist as uncommitted files on the integration worktree and are not wired into the camp session, the Director or the UI.

Status: in progress, not committed, not playable. Engine has unit tests and a linter. Story content is **authored** and unreviewed by the owner.
Sources (uncommitted, integration worktree): `packages/core/src/quest.ts`, `quest-lint.ts`, `quest.md`, `quest.test.ts`, `packages/core/scripts/lint-quests.ts`, `story/dialogue/` (`manifest.md`, `schema.md`, `pack.json`, `scenes/*.json`).
These files are not copied into `data/` because they are still changing.

## Where quests sit in the design

The owner concept asks for quests "composed as decision text game (D&D style)", "predefined but also part of reconciliation", for equipment and for sabotage between schools (`docs/OWNER-NOTES.md`).
The reconciled design keeps quests out of the active contract: the defect register lists "reconciliation quests and detailed plan steps" as later work (`data/defects.json` `remaining-arcs`), and the plan places quest depth in W11 ("Arcs depth, quests and linter, economy over six weeks").
The quest engine's own note calls itself W10, while the plan's W10 is deaths. The wave number is not settled.

## Quest graph format

The format comes from the historical reference design (`docs/design/reference-the-ledger/design/data/quests.json`), extended on 2026-10-05.

```
Quest    { id, title, giver, for, kind, window, start, nodes[], terminals[]
           (+ authoring meta: day, spineIds, plants, payoffs, scene) }
Node     { id, text, choices[], lines?[] }          // text may be "Speaker: 'line'"
Choice   { label, to? | (check + pass + fail), cost?, when?, effects?.flags }
Terminal { id, text, effects: { knowing?, trust?, debt?, renown?, stocks?, flags?, ... }, variants?[] }
Check    { stat: vigor|focus|nerve|guile, dc }
When     { flag, op: eq|ne|gte|gt|lte|lt, value }
Variant  { when, append?, effects? }
```

Extensions accepted and locked on 2026-10-05: `when` on a choice (flag or trust gate), `effects.flags` (story flags), `lines` on a node (multi-speaker beats), `variants` on a terminal (conditional appended text and effects).

### Runtime rules (`quest.ts`)

| Function | Behaviour |
|---|---|
| `startQuest(quest, {seed, day, actor, flags})` | Opens a session |
| `offer(session, {stats})` | Current node text/lines and the visible choices, with odds in % |
| `choose(session, index, {stats, camp})` | Pays the cost, applies effects, rolls a check if any, advances or closes |
| `evalWhen` | A missing flag counts as 0, '' or false; `eq`/`ne` treat numeric strings as numbers |
| `applyQuestEffects` | Merges flags (later wins); can mirror effects into the camp state. Trust keys with a bare NPC id mean `player>npc`; debt keys may use `->` and the token `player` |
| `resolveTerminal` | Base text plus every matching variant, in order |
| Check roll | `floor(seededUnit(seed, day, actor, "quest:{questId}:{nodeId}:{choiceIndex}") × 20) + 1 + stat ≥ dc` |

Linter (`quest-lint.ts`): every node reachable (ignoring `when`); every non-terminal node has at least 2 choices; every terminal has authored effects; every check names a real stat.

## Story pack "story-v12"

`story/dialogue/pack.json`: 15 quests, 89 nodes, 100 terminals.

| # | Quest id | Title | Giver | Day | Story beats (spine ids) |
|---|---|---|---|---:|---|
| 1 | dlg_opening_ford | The Ford and the Collaring | septima | 1 | START |
| 2 | dlg_s2_quills_lantern | Quill's Lantern | quill | 15+ | S-2 |
| 3 | dlg_letter_day | Letter Day | tamar | 17 | V.temptation, LT.* |
| 4 | dlg_reversal_d21 | The Reversal | camp | 21 | R.R1-R4 |
| 5 | dlg_tent_trial | The Tent Trial | ophel | 33 | S-4, B5, L.* |
| 6 | dlg_v_unmask | The Unmasking | villain | 25 | V.unmask |
| 7 | dlg_s5_last_lantern | The Last Lantern | partner | 27 | S-5.tell/keep, T.* |
| 8 | dlg_s6_venno_grille | Venno's Grille | venno | 38 | S-6 |
| 9 | dlg_dark_night | The Dark Night | camp | 35 | DN-1 … DN-6 |
| 10 | dlg_summa_eve | Summa Eve | partner | 41 | CP6, V.confront, S-7 |
| 11 | dlg_summa_climax | The Summa | arena | 42 | E.breaking / champion / … |
| 12 | dlg_coin_no_offer | The Coin with No Offer | partner | 42 | X.coins, X.refusal |
| 13 | dlg_revolt | Names Stand Up | fenna | 41 | CP6.2.a, E.revolt |
| 14 | dlg_martyr | The Knife Was Not for You | agent | 41 | E.martyr, X.kesh |
| 15 | dlg_epilogue | Epilogue Cards | pell | 42+ | E.* |

### Story concepts introduced by the pack

These appear in the pack's flags and givers but are **not** in the reconciled data (`data/characters.json`, `data/facts.json`):

- **Partner** (an open pool: whichever main the player is closest to) and **villain** (a locked id: the main who turns), with name substitution still to do.
- The **Reversal** on day 21 (after Games III), the **Unmasking** (day 25), the **Last Lantern** tell/keep/partial choice (day 27), the **Dark Night** (days 34-36).
- Characters not in the cast: tamar, calla, lucia, pell, meret, aurel, dumno, belen.
- Flags for the Breaking condition: `K-wardstones-drink`, `timing.hint`, `duet.hint`, `partnerKnows`, `septima.cracked` (lowers the Breaking requirement to 50, "Breaking soft 50").
- Endings set by terminals: breaking, champion, betrayed, revolt, martyr, and **collared** (refusal), which is not in `data/season.json` `endings`.
- A lethal Summa outcome (`X.lethal`, `summaDeath`) and a partner death (`partner.dead`), which conflict with death gameplay being disabled.

The pack refers to authoring sources outside this repository (a season spine and story graph, a story bible P1-P24, `drafts/flag-map.md`, `drafts/scenes/15-epilogue-system.md`). They were not available for this export.

### Gaps listed by the pack (`manifest.md`)

1. Partner and villain name substitution at runtime.
2. The letter counter is a stub, not a full tree.
3. Epilogue terminals are stubs; the full card lines are in a draft.
4. Some stage lines are longer than a voice-over limit of 10 words.
5. The linter rule (at least 2 choices per non-terminal) was enforced after a fix.

## What is needed to wire quests in

Not specified by any wave note yet. At minimum: a trigger model (day, window, giver presence, flags) inside the camp session; a way to spend hours on a quest node; mapping quest effects (`knowing`, `trust`, `debt`, `renown`, `stocks`) through the same clamped, traced state changes as intents; reconciling the extra cast and the `collared` ending with the season data; and deciding whether the Director may start quests ("part of reconciliation", owner notes).
