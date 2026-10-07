# Premise and setting

This file states what the game is about, who is in the camp and why, and which parts of the owner's original concept the current design keeps, changes or postpones.
It is the narrative frame for every other campaign document.

Status: authored. The setting text is stable. The narrative quest content is in progress (see [quests-and-story.md](quests-and-story.md)).

## One-paragraph premise

Elemental mages of the Roman era (Fire, Water, Earth, Air) fought for a Roman legion against barbarians. After the battle at a ford, the legion betrayed them: it collared its own allies and locked them in Castra Clausa, a magic-warded camp with no escape.
The camp is split into tents by school. Each tent trains, schemes and competes so that its entrant does well in the arena Games, which earn gold for food and equipment.
The player is one of four mages (one per school) who were collared together at the ford. One season of six weeks, with Games every week, leads to one of five endings.

Source: `docs/OWNER-NOTES.md` (owner concept, 2026-10-01) and `docs/MAGE-ARENA-PLAN.md` section a. The camp lore below comes from `docs/design/reconciled/README.md`.

## World facts the design commits to

| Fact | Source |
|---|---|
| The legion betrayed its mages at the ford. | reconciled README; `data/facts.json` `K-ford-betrayal` (secret, held by the Four) |
| The Vigil guards the camp. The collars hold magic silent inside its walls. | reconciled README; owner notes ("Magic can't be used inside camp") |
| The Games feed the Wardstones. | reconciled README; `data/facts.json` `K-wardstones-drink` (secret, held by Old Quill) |
| The Ember Tent won the last Games. | `data/facts.json` `K-ember-won-last-games` (public) |
| The season ends; time does not repeat. Trust, knowledge, mastery and consequences persist through the season. | `data/season.json` `persistence`; plan D2 |
| The arena is outside the prison. Two finalists of the highest tier who cooperate can destroy it (the Breaking). | owner notes; `data/season.json` `endings` |
| Guards forbid ordinary violence. Poison cannot kill. There is no assassination verb. | Director system prompt (`packages/director/src/input.ts`); plan section d |
| The Lanista never enters the camp. He speaks through the grille of the Door. | `data/characters.json` (venno bio) |

Roman culture is the worldbuilding baseline (the camp, the Games, the legion as non-magical enemies). The mages and the arena have their own raw, magical, fantastical identity (plan D14, D15). This affects art and tone, not campaign rules.

## Factions

| Faction | Members | Role in the campaign |
|---|---|---|
| Ember Tent (Fire) | Brennic, Elder Sadruba, Corvo | Hard-headed, aggressive, stronger under tension. Won the last Games. |
| Tide Tent (Water) | Cassia, Elder Ophel, Nysa | Patient and intelligent; wins before the fight; most of the untraced schemes. |
| Stone Tent (Earth) | Garran, Elder Ruadh, Senna | Calm and protective; holds together with bread and patience. |
| Gale Tent (Air) | Iskar, Elder Kesh, Lio | Restless, free, contemptuous of rules. |
| Strays | Fenna, Old Quill | No tent and no stores; hungry, distrusted. Candidates for a fifth tent. |
| The Vigil | Warden Septima | The arcane guard (salt-wards). Stops violence; punishes the caught, not the guilty. |
| Rome | Lanista Aulus Venno | Runs the Games for betting senators; sells scouting, buys favours. |

Full cast details: [cast-and-schools.md](cast-and-schools.md).

## The four mains (owner concept → current data)

| Owner concept (verbatim intent) | Current character | Goal in data |
|---|---|---|
| Fire "lusts blood, lives as warrior to become the strongest mage in hierarchy" | Brennic the Red (ember) | `rise_in_tent` (target ember) |
| Water "female, extremely intelligent and knowledgeable about spells, using intrigues and strategy" | Cassia of the Lighthouse (tide) | `learn_secrets` |
| Earth "a protector, powerful and calm, working towards a way out and back to his family" | Garran Stonehand (stone) | `escape_research` |
| Air "anger towards Rome; eliminate those playing by Roman rules; create a new tent; revolt" | Iskar Windborn (gale) | `build_fifth_tent` |

## Owner concept → design mapping

| Owner concept item (`docs/OWNER-NOTES.md`) | Current design | Status |
|---|---|---|
| Pick one of the four schools at the start | Plan Q3 default: pick one of four; the other three become allies or rivals | Only Water/Cassia is playable (`data/season-bridge.json` `playableSchool`, `playableCharacter`) |
| Skippable tutorial battle against barbarians, then the betrayal | Story pack scene `dlg_opening_ford` (day 1) | In progress, not wired |
| Tents per school; school behaviour traits | `data/schools.json` (hint, intent weights, preferred stat) | Built |
| Persona-style time: places that raise different stats | 8 places, hour-based day (`data/locations.json`, `data/season.json`) | Built |
| Arena tiers by level; school picks its best (internal competition) | Tent Trial decides the entrant; tiers by mastery (Tiro → Summa) | Trial and Tiro built; higher tiers planned |
| Waves: soldiers, creatures, school mages in semifinal and final | Arena tier data (gameplay) | Tiro built |
| LLM daily reconciliation of every character | The Director (night transaction) | Built |
| Archetype situations: outcast Strays; schools sabotaging each other; tribalism; bond of the Four | Strays and hunger; SCHEME kinds; same-tent rivalry decay and cross-tent peer bonus; bond state machine | Built (core rules); deeper arcs planned (W11) |
| Quests as D&D-style decision text, predefined and from reconciliation | Quest decision-graph engine and story pack | In progress |
| Typed role-play in certain situations | Parley, only at Knowing moments | Built |
| No magic in camp; guardian mages prevent violence | Collars; the Vigil; no violent intent exists | Built (as rule constraints) |
| Escape by two cooperating finalists destroying the arena | The Breaking ending | Planned (W12) |
| Deaths (owner, 2026-10-01: "very challenging to plot as order is heavily guarded") | Plot objects with four stages; disabled | Reserved (W10) |
| Time loop (owner: "lean into variant 1 rather with seasons") | One season, no loops; loop/Echo content removed | Built (season) |

## History / superseded

- The contest design "Fourteen Nights" used a time loop (ring reset, Echo stats, loop chronicles). The owner chose seasons instead (plan D2); all loop content was removed in wave W0 (`data/defects.json` `ring-echo-chronicle`). Some arena data still carries loop wording; see [open-questions.md](open-questions.md).
- The two contest packages (`docs/design/baseline-fourteen-nights/`, `docs/design/reference-the-ledger/`) are historical. The reconciled design takes the Director from the first and the season structure, planner and phrase bank from the second (plan D1).
