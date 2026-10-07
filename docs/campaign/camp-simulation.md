# Camp simulation

This file describes the core simulation of the camp: the 13 closed intents, their arguments and legality rules, their effects and contests, the camp-wide caps, the order in which a night resolves, and the daily settlement.
Rules and numbers come from `data/intents.json`, `data/rules.json` and `data/season.json`. Code behaviour comes from `packages/core/src/camp.ts` (`legalProblem`, `resolve`).

Status: built (W0 reference replayer, W1 pure core, W5/U3a player sessions). Golden nights replay exactly from tables. All numbers are **authored**. Outcomes in fixtures are **simulated**.

## Design principles

1. **Closed vocabulary.** Every character, NPC or player, acts only through these 13 intents. There is no violent or lethal intent.
2. **Code owns every number.** The Director chooses an *attempt* (intent + arguments). Code checks legality, rolls dice and applies effects.
3. **One authority per number.** Effects live only in `rules.json`. Prose that disagrees is a defect.
4. **Deterministic.** Every die is seeded by `(seed, day, actor, action)` and logged; every changed value records the rule that changed it.
5. **Per-item failure.** An illegal NPC choice is replaced by the planner's choice for that character only. The rest of the night goes ahead.

## The decision record

Every chosen act is a decision object (`data/decision.schema.json`, generated from the shared schema builder):

| Field | Type / allowed values |
|---|---|
| `character` | character id |
| `intent` | one of the 13 intents |
| `args` | `target` (id), `stat` (vigor, focus, nerve, guile), `kind` (steal, poison, persuade, rumour), `topic` (serves_rome, cowardice, theft, kindness_to_strays), `factId`, `toTent` (tide, ember, stone, gale), `terms` (favour_for_training, back_entrant) |
| `goal` | one of 15 goal ids |
| `mood` | calm, proud, afraid, angry, scheming, grieving |
| `reasonValue` | must be one of the character's own values |
| `citedFacts` | at most 3 fact ids, each in the character's own knowledge |
| `line` | a short in-voice line (see text guards in [director.md](director.md)) |

## The 13 intents

Sources: `data/intents.json` (arguments, visibility of the resulting fact), `data/rules.json` `effects` (numbers), `data/season.json` (hours), `data/locations.json` (places).

| Intent | Args | Fact visibility | Place | Hours | Effect when it resolves |
|---|---|---|---|---:|---|
| TRAIN | stat | public | Yard (vigor), Cistern (focus), Pit (nerve), Exchange (guile) | 2 | +3 training points in the stat (+2 if hunger ≥ 70; halved, rounded down, if fatigue ≥ 6). Rank recomputed from thresholds 0/6/14/24/36. |
| WORK | – | public | Exchange | 4 | +4 gold, +1 fatigue, +2 to own tent's stores (if it has a tent). A working Stray's hunger grows 8 instead of 15. |
| BEFRIEND | target | public | Commons | 2 | Both directions of trust +6, ×1.5 if different tents and same rank, then ×0.5 if the aggression traits differ by ≥ 6; rounded down once; symmetric. |
| CONFIDE | target, factId | secret | Tent | 1 | Both directions of trust +4. The target learns the fact if they did not know it. The actor must know the fact. |
| PROTECT | target | witnessed | Commons | 1 | Actor pays 2 gold. Target's hunger −30, and the target is "warned" (+2 to the DC of schemes against them tonight). If the target was hungry (> 0): target→actor trust +10 and target owes the actor 1 debt. A protected Stray skips nightly hunger growth. Needs ≥ 2 gold. |
| WATCH | target | secret | Cistern | 2 | Contest: actor guile×4 + d20 > 10 + target guile×4. Success: learn one non-secret fact the target knows and the actor does not. Failure: target→actor trust −6 (noticed). |
| SCHEME | target, kind, topic (rumour only) | secret (a public fact on rumour success or when caught) | Tent | 2 | See [Schemes](#schemes). Only on weekdays 4-7. |
| RECRUIT | target | public (witnessed fact on success) | Commons | 2 | Contest: actor guile×4 + floor(renown/10) + d20 > 10 + target loyalty. Success: target loyalty −8, target→actor trust +4. A recruited Stray joins the "fifth tent" list. Recruiting a Stray needs goal build_fifth_tent or hold_fifth_tent. |
| DEFECT | toTent | public | Commons | 2 | Actor moves to the new tent with loyalty 40. Legal only if: own loyalty < 20; trust ≥ 20 toward someone in the new tent; and that tent's elder has warmth ≥ 6 or the tent has ≥ 6 stores. |
| REPORT | target | secret | Door | 1 | Contest: d20 + 8 (Vigil bonus) > 10 + target guile×4. Success: the target's schemes tonight fail. An investigation record is kept either way. Reporting one of the Four by another of the Four fractures the bond. |
| PLOT | – | secret | Edge | 2 | Bond progress +1 and bond state → `plotting`. Only for the Four, only when the bond is first_watch, plotting or sworn. **Nonlethal bond planning.** It never creates a death Plot object. |
| REST | – | private | Tent | 2 | Fatigue −2. |
| OFFER | target, terms | secret | Door | 1 | Only Venno (the Lanista) may OFFER, with terms favour_for_training or back_entrant. Currently records a secret fact only; no numeric effect. |

Player-only activities: **PARLEY** (2 hours, see [social-systems.md](social-systems.md)) and **LISTEN** (2 hours, the night act; see [../gameplay/](../gameplay/)).

### Contest constants

`data/rules.json` `contests`: d20 (`dieSides` 20), `guileMultiplier` 4, `baseDc` 10, `vigilBonus` 8, `renownDivisor` 10, `loyaltyDivisor` 4, `rumourBaseDc` 12, `patrol` 0.
Each roll is `1 + floor(seededUnit(seed, day, actor, action) × 20)`. The action string makes each contest unique, so spending more hours never rerolls it (U3a).

### Schemes

A scheme is possible only when the scheme window is open (weekday ≥ 4). The score is `actor guile × 4 + d20`, against a kind-specific DC:

| Kind | DC | Effect on success | Data |
|---|---|---|---|
| steal | 10 + target guile×4 (+0 patrol) | Target's tent stores −4 | `schemes.steal.stores` |
| poison | 10 + target guile×4 | Target becomes **sick**: −20 stamina and −10 HP in the next Games. Nonlethal. Clears at Games-day settlement. | `schemes.poison` |
| persuade | 10 + floor(target loyalty / 4) | Target loyalty −15 | `schemes.persuade.loyalty` |
| rumour | 12 + floor(target renown / 10) | Target renown −3; listeners react (see [social-systems.md](social-systems.md)); a public "rumour" fact (truth false) appears | `schemes.rumour` |

Modifiers and guards:

- A **warned** target (protected today) adds +2 to the DC (`effects.PROTECT.warningDc`).
- A rumour whose die is 1 or lower always fails (`reviewPolicy.rumourFailsAtOrBelow` = 1).
- A successful REPORT against the schemer today makes all their schemes fail.
- **Caught:** if the scheme fails, the Vigil rolls d20 + 8 > schemer guile×4 + 10. If that succeeds, the schemer goes into the **stocks**, loses 5 renown, and the target's trust toward them drops 30. A public "caught" fact appears.
- Illegal schemes: target already sick (poison); the same target as the actor's scheme on the previous resolution day (`repeat-target`); a goal of keep_peace; a scheme against the character's own `protect` goal target; a rumour without a valid topic; a topic on a non-rumour scheme; steal from someone with no tent stores.

## Legality checks (per item)

`legalProblem` rejects an item for the first failing reason, in this order: actor (unknown, dead, or the player in an NPC list), intent, args, forbidden, goal, mood, value, knowledge (cited facts), target (missing, dead or self), stocks (only REST allowed, except Venno), stat, resources (PROTECT needs gold), activity-hours, fact (CONFIDE), scheme rules, bond-edge (PLOT), offer, defect-edge, recruit-edge.

The player's acts also must happen at an open place that offers the activity, fit the hour rules (see [season-and-time.md](season-and-time.md)), target someone present, and respect the caps.

## Camp caps

`data/rules.json` `caps`: the number of times an intent can happen in the **whole camp** per day, player included.

| Intent | Cap per day |
|---|---:|
| SCHEME | 2 |
| SCHEME on Games eve | 3 |
| DEFECT | 1 |
| REPORT | 1 |
| OFFER | 1 |

Caps are applied after validating each group, across the whole camp, in a deterministic order: the higher-cunning actor keeps the slot, then the alphabetically earlier id. The player's acts earlier in the day use up cap slots first. A capped item is replaced by a planner fallback that cannot itself use a capped intent.

## Resolution order

`data/rules.json` `resolutionOrder`: PROTECT → BEFRIEND → WORK → TRAIN → REST → CONFIDE → WATCH → REPORT → SCHEME → RECRUIT → DEFECT → PLOT → OFFER. Ties sort by character id.
REPORT investigates before SCHEME, so a successful report stops the same night's schemes. This order fixed a contradiction in the baseline (`data/defects.json` `report-order`).

All groups see the same immutable start state. Items resolve one by one against the evolving state.

## Daily settlement (after the main acts)

Runs once per day, at the end of the night (`resolve`, settle step):

1. **Hunger.** Each living Stray who was not protected today gains hunger: +8 if they worked, else +15 (`effects.daily`).
2. **Routine training.** Every non-player character with a school who was not in the stocks at the start of the day gains +1 point in the school's preferred stat.
3. **Stocks release.** Characters who were in the stocks at the start of the day (and were not caught again today) leave the stocks.
4. **Strays huddle.** If any Stray was protected today, the Strays state becomes `huddled`.
5. **Tent admission.** Each Stray joins a tent if they trust some member of a tent with stores ≥ 20, and that tent's elder has warmth ≥ 6 or the tent has ≥ 6 stores. Candidates sort by id. On joining, loyalty becomes 40 and a public fact appears.
6. **Same-tent rivalry.** For every ordered pair in the same tent (with stores) and the same rank: trust −1. This applies to every eligible pair, not only those named in prose.
7. **Bond transitions** (see [social-systems.md](social-systems.md)).
8. **Strays desperate.** If the Strays are huddled and their average hunger is ≥ 70, the state becomes `desperate`.
9. **Poison clears.** On Games day, every sick character is cured.
10. **Facts and board.** New facts are added to the fact list. The Hollow Board shows the day's public facts, plus witnessed facts ("Someone saw: …") and secret facts the player knows ("Journal: …").

Fact visibility (`rules.json` `factVisibility`): public → everyone; witnessed → participants and their tents; secret → participants; private → the actor only. Knowledge of each fact is added to the characters who can see it.

## Ranges

`data/rules.json` `ranges`: trust −100..100, loyalty 0..100, hunger 0..100, renown 0..100, fatigue 0..10, gold 0..9999, debt 0..99, stores 0..9999. Every change is clamped.

## Verification

| Check | Command (integration repo) | What it proves |
|---|---|---|
| Design contract | `node packages/tools/replay/cli.mjs check` | The rendered README matches its table-backed template, references and vocabularies are valid, golden nights replay exactly |
| Planted contradictions | `node --test packages/tools/replay/*.test.mjs` | The checker fails on planted prose/table/fixture contradictions |
| Full gate | `npm run gate` | Build, lint, all TypeScript and reference tests, zero contradictions |

The checker does not prove the meaning of free prose. Scenario inputs live in `data/scenarios.json` (seed 73, start day 4, three nights: shelter, consequence, games-eve; five branch cases). A sample generated night is in `data/sample-night.json`.
