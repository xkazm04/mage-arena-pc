# Mage Arena: campaign design

This folder describes the **campaign** of Mage Arena: the season, the camp world, its simulated characters, the LLM Director that drives them, and how the camp connects to the arena.
It is written for an LLM to read first and a human second, and it is self-contained: every number comes from the JSON files in [`data/`](data/README.md), which are copies of the authoritative game data.
The player-facing screens and controls (camp map, clock, Hollow Board UI, Parley dialog, arena combat) are described in [`../gameplay/`](../gameplay/).

Status: the camp simulation, the Director, Parley and weeks 1-2 (Tent Trials and Tiro Games) are built and tested. Quests are in progress and not committed. Deaths and endings are reserved in the data but not built. See [status.md](status.md).

## Provenance

| Item | Value |
|---|---|
| Exported | 2026-10-07 |
| Source repository | `mage-arena`, branch `integration` (worktree `mage-arena-int`), commit `b1efd46` |
| Uncommitted source included | Quest runtime (`packages/core/src/quest.ts`, `quest-lint.ts`, `quest.md`) and the story dialogue pack (`story/dialogue/`), all work in progress on the integration worktree |
| Authority rule | **The data files win over prose.** If a sentence here contradicts a file in `data/`, the file is right and the sentence is a defect. |
| Source paths | Paths in backticks such as `docs/design/reconciled/data/rules.json` are relative to the integration repository. The same files are copied into `./data/` |
| Honesty labels | **authored** = designed numbers that have not been tested against play; **simulated** = produced by headless runs; **measured** = recorded on real hardware or with real model calls; **owner-felt** = judged by the owner in play. Nothing in the campaign is owner-felt yet. |

## Reading order

1. [premise-and-setting.md](premise-and-setting.md): the world, the betrayal, the camp, the factions.
2. [season-and-time.md](season-and-time.md): six weeks, days, hours, places, Trials and Games.
3. [cast-and-schools.md](cast-and-schools.md): 16 characters, 4 schools and tents, officials, Strays, goals and relationships.
4. [camp-simulation.md](camp-simulation.md): the 13 closed intents, their effects, caps, resolution order and daily settlement.
5. [social-systems.md](social-systems.md): trust, debt, loyalty, hunger, schemes, rumours, tents and admission, the bond of the four, Parley rules.
6. [director.md](director.md): the LLM Director: night transaction, what the model sees, validator, planner fallback, cache, budget, providers, text guards.
7. [season-bridge.md](season-bridge.md): how the camp feeds the arena and back (Tent Trial, Games entry, rewards, poison and fatigue).
8. [quests-and-story.md](quests-and-story.md): the quest graph engine and story pack (in progress).
9. [deaths-and-endings.md](deaths-and-endings.md): the reserved death system and the five endings.
10. [status.md](status.md): built, partial, planned or reserved, for each mechanic.
11. [open-questions.md](open-questions.md): owner decisions, open questions and known contradictions between sources.

## File map

| File | Holds |
|---|---|
| `README.md` | This index, glossary, provenance |
| `premise-and-setting.md` | Concept, setting, factions, owner concept notes |
| `season-and-time.md` | Calendar, hour model, phases, places and opening hours, activity durations |
| `cast-and-schools.md` | Schools, tents, cast table, traits, values, goals, starting relationships |
| `camp-simulation.md` | Intents, arguments, effects, contests, caps, resolution order, settlement |
| `social-systems.md` | Trust, debt, loyalty, hunger, Strays, schemes, rumours, admission, bond, Parley |
| `director.md` | LLM pipeline and its guarantees |
| `season-bridge.md` | Camp-to-arena contract |
| `quests-and-story.md` | Quest decision graphs, story pack |
| `deaths-and-endings.md` | Plot objects, the Vigil, endings |
| `status.md` | Implementation status table |
| `open-questions.md` | Owner questions, decisions, source contradictions |
| `data/` | Authoritative JSON (see [data/README.md](data/README.md)) |

## Glossary

| Term | Meaning |
|---|---|
| **Castra Clausa** | The guarded camp where the collared mages are held. |
| **Collar** | A ward collar on every mage. Inside the camp it holds magic silent: no spellcasting in camp. In the arena, the "collar clock" unlocks a new spell tier every 15 seconds (see gameplay). |
| **The Vigil** | The arcane guard of the camp, which cooperates with Rome. It stops violence, investigates reports, puts caught schemers in the stocks. Its warden is Septima. |
| **Stocks** | The punishment for a schemer the Vigil catches. A character in the stocks can only REST (or, for Venno, act normally), and cannot travel. It lasts until the next settlement. |
| **The Door** | The guarded gate and the place where accusations are heard (REPORT) and the Lanista makes offers (OFFER). Also the way out that the Breaking ending opens. |
| **Wardstones** | The stones that power the camp wards. Secret fact `K-wardstones-drink`: they drink the magic spilled in the arena. |
| **Tent** | One of the four school factions in the camp: Ember (Fire), Tide (Water), Stone (Earth), Gale (Air). Each has stores of food and an elder. |
| **Strays** | Mages with no tent: outcasts with no stores, who get hungry and are disliked. A "fifth tent" of Strays is Iskar's goal. |
| **Elder** | The head of a tent (rank 4). Chooses or influences the tent's Games entrant. |
| **Main / the Four** | The four player-candidate characters (Cassia, Brennic, Garran, Iskar), betrayed together at the ford. |
| **Bond** | The shared state of the Four: `scattered_four` → `first_watch` → `plotting` → `sworn`, or `fractured`. |
| **Fourth Watch** | The meetings of the Four at the Edge at night (20:00), where they PLOT (nonlethal bond planning). |
| **Knowing** | A true, private fact about a specific character (`type: knowing`). Required for Parley moments and for the reserved death plots. |
| **Hollow Board** | The morning board that shows what the camp saw overnight: public facts, witnessed facts, and the player's private journal entries. |
| **Journal** | The player's private list of secret facts they know. |
| **Intent** | One of 13 closed verbs a character can choose each day (TRAIN, WORK, BEFRIEND, ...). |
| **Director** | The LLM system that chooses each NPC's daily intent. Code owns every number and result. |
| **Planner** | The deterministic utility planner: the Director's fallback for any missing or rejected choice, and the default offline provider. |
| **Phrase bank** | Authored one-liners per intent, used when a model line fails the text checks. |
| **Tent Trial** | The unarmed contest the night before the Games, at the Pit at 18:00. It decides the tent's entrant. |
| **Games** | The weekly arena event on weekday 7 at 08:00. Tiers: Tiro, Veteranus, Primus, Summa. |
| **Missio** | Arena mercy: a bout lost at 0 HP ends without death. |
| **Lanista** | Aulus Venno, the Roman who runs the Games. Never enters the camp; speaks through the grille of the Door. |
| **Salt** | Septima's discipline: salt-wards that lock the collars. Not one of the four schools. |
| **Receipt** | A unique, replay-verified record of a Trial or Games result; it can only be applied once. |
| **The Breaking** | The cooperative ending in which two finalists turn the absorb mechanic on the arena and open the Door. |

## How the campaign links to gameplay

| Campaign system | Gameplay surface (in `../gameplay/`) |
|---|---|
| Season calendar and hours | Camp day loop: map, daily clock, place buttons, waiting, the night act |
| Player intents at places | Place actions, chosen in the camp screen; resolved at once |
| NPC intents (Director) | Resolved at night; results shown on the Hollow Board and in the journal at dawn |
| Listening (night act) | A 45-second real-time minigame at your tent that can earn a Knowing |
| Parley | A dialog: typed text or three authored cards, available only at Knowing moments |
| Tent Trial | Best-of-three stance exchange (press / brace / feint) |
| Games | Arena combat (Tiro waves). Camp stats set arena HP, stamina, mana and absorb values |
