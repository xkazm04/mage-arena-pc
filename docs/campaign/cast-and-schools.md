# Cast and schools

This file lists the four schools and their tents, the 16 characters with their roles, traits, values, goals and permissions, and the starting relationships.
Sources: `data/schools.json`, `data/characters.json`, `data/goals.json`, `data/relationships.json`, `data/rules.json` (initial values).

Status: authored and built. Every character runs in the headless simulation. Only Cassia (Water) is playable (`data/season-bridge.json`).

## Schools and tents

| School | Tent | Character hint (given to the Director) | Preferred stat | Intent weights (planner multipliers) |
|---|---|---|---|---|
| water | tide | patient, intelligent, wins before the fight | focus | WATCH 1.4, CONFIDE 1.2, SCHEME:persuade 1.3, SCHEME:rumour 1.2, TRAIN:focus 1.2 |
| fire | ember | hard-headed, aggressive, stronger under tension | nerve | TRAIN:nerve 1.4, SCHEME:poison 1.1, BEFRIEND 0.8, REPORT 0.5 |
| earth | stone | calm, protective, slow to move and hard to move | vigor | PROTECT 1.5, WORK 1.3, SCHEME:* 0.3 |
| air | gale | restless, free, contemptuous of rules | guile | RECRUIT 1.6, SCHEME:rumour 1.4, REPORT 0.3, DEFECT 1.3 |

- The **preferred stat** gets the daily routine training point for every tent member who is not the player and not in the stocks (`rules.json` `effects.daily.routinePoints` = 1).
- **Weights** multiply the planner's score for a candidate intent (see [director.md](director.md)). The model sees only the hint text, not the weights.
- Each tent starts with 6 stores (`rules.json` `initial.stores`). Strays have no stores.
- Officials: Septima's school is `salt` and Venno's is `none` (`rules.json` `officialSchools`). They get no routine school training and have no tent stores.

## Character sheet fields

| Field | Meaning | Seen by the Director? |
|---|---|---|
| `traits` (aggression, ambition, caution, loyalty, cunning, warmth; 1-10) | Personality numbers used by rules (aggression gap, elder warmth, loyalty seed) and the planner | Only as bands: low (<4), moderate, high (≥7) |
| `values` (from 12: strength, rank, kin, freedom, knowledge, honour, survival, order, spite, faith, gold, belonging) | Motive vocabulary. A decision's `reasonValue` must be one of the character's own values. Rumour reactions key on values. | Yes |
| `goal` (`id`, optional `target`) | One of 15 goal plans (below) | Yes |
| `stats` (vigor, focus, nerve, guile) | Starting ranks 1-5. Ranks come from training points: thresholds 0, 6, 14, 24, 36 (`rules.json` `stats.rankThresholds`) | No |
| `voice` (register, tics, never) | Speech style for the Director's one-line intention | Yes |
| `forbiddenIntents` | Intents the character may never choose (`X`, `X:*` or `X:kind`) | Yes |
| `knowledgeSeed` | Facts the character knows at the start | Yes (own facts only) |
| `rank` | Social rank in the camp (0-5); used for "same-rank" rules and the Trial rival | Indirectly (role) |
| Moods | calm, proud, afraid, angry, scheming, grieving | The Director chooses one each day |

Initial dynamic values (`rules.json` `initial`): gold 10, renown 5, hunger 0 (Strays 60), loyalty = trait loyalty × 10 (Strays 10), fatigue 0, mastery 1, trust 0 and debt 0 unless set in `relationships.json`.

## The cast

Source: `data/characters.json`. Stats are listed as vigor/focus/nerve/guile.

| Id | Name | School | Tent | Role | Rank | Goal (target) | Values | Stats | Forbidden intents | Knows at start |
|---|---|---|---|---|---:|---|---|---|---|---|
| cassia | Cassia of the Lighthouse | water | tide | main | 1 | learn_secrets | knowledge, rank, survival | 1/3/1/2 | – | K-ford-betrayal |
| brennic | Brennic the Red | fire | ember | main | 1 | rise_in_tent (ember) | strength, rank, honour | 2/1/2/1 | REPORT | K-ford-betrayal |
| garran | Garran Stonehand | earth | stone | main | 1 | escape_research | kin, honour, survival | 3/1/2/1 | SCHEME:poison, SCHEME:steal | K-ford-betrayal |
| iskar | Iskar Windborn | air | gale | main | 1 | build_fifth_tent | freedom, spite, belonging | 2/2/1/2 | REPORT | K-ford-betrayal |
| sadruba | Elder Sadruba | fire | ember | elder | 4 | win_games (ember) | rank, strength, order | 3/4/5/3 | DEFECT | K-ember-won-last-games |
| ophel | Elder Ophel | water | tide | elder | 4 | win_games (tide) | knowledge, order, rank | 1/5/3/5 | DEFECT | K-ember-won-last-games |
| ruadh | Elder Ruadh | earth | stone | elder | 4 | keep_peace (stone) | order, kin, faith | 4/3/4/2 | SCHEME:poison | – |
| kesh | Elder Kesh | air | gale | elder | 4 | profit | survival, gold, freedom | 2/4/3/5 | – | – |
| corvo | Corvo | fire | ember | rival | 1 | rise_in_tent (ember) | rank, spite, strength | 2/2/1/2 | – | – |
| nysa | Nysa | water | tide | rival | 1 | rise_in_tent (tide) | rank, gold, survival | 1/2/1/3 | – | – |
| senna | Senna | earth | stone | rival | 1 | rise_in_tent (stone) | honour, rank, order | 2/1/2/1 | SCHEME:poison | – |
| lio | Lio | air | gale | rival | 1 | win_games (gale) | freedom, strength | 2/1/2/1 | REPORT | – |
| fenna | Fenna | air | strays | stray | 1 | find_tent | survival, belonging | 1/1/1/3 | SCHEME:poison | – |
| quill | Old Quill | earth | strays | stray | 3 | survive | knowledge, survival | 1/4/2/4 | DEFECT, SCHEME:poison | K-wardstones-drink |
| septima | Warden Septima | salt | vigil | warden | 5 | keep_peace | order, faith | 3/5/5/4 | SCHEME:*, DEFECT, RECRUIT, PLOT, TRAIN, WORK | – |
| venno | Lanista Aulus Venno | none | roman | lanista | 0 | profit | gold, rank | 1/1/2/5 | TRAIN, WORK, CONFIDE, PROTECT, SCHEME:*, RECRUIT, DEFECT, REPORT, PLOT, REST | – |

Starting facts added at session start (`data/camp-play.json` `discoveries`, `data/parley.json` `facts`): `K-nysa-bread` (Nysa leaves bread by the southern tent rope after dusk; held by Nysa and Quill) and `K-quill-lantern` (Quill leaves the last lantern burning to mark a safe place to talk; held by Nysa and Quill).

### Traits

| Id | Aggression | Ambition | Caution | Loyalty | Cunning | Warmth |
|---|---:|---:|---:|---:|---:|---:|
| cassia | 3 | 8 | 8 | 5 | 10 | 4 |
| brennic | 9 | 9 | 2 | 4 | 3 | 3 |
| garran | 2 | 3 | 7 | 9 | 3 | 9 |
| iskar | 7 | 7 | 3 | 2 | 6 | 5 |
| sadruba | 7 | 6 | 5 | 8 | 6 | 2 |
| ophel | 2 | 7 | 9 | 6 | 9 | 3 |
| ruadh | 3 | 3 | 8 | 9 | 4 | 7 |
| kesh | 4 | 6 | 6 | 4 | 8 | 4 |
| corvo | 8 | 8 | 3 | 6 | 5 | 2 |
| nysa | 4 | 8 | 5 | 5 | 8 | 5 |
| senna | 4 | 7 | 7 | 7 | 4 | 4 |
| lio | 6 | 6 | 1 | 5 | 4 | 6 |
| fenna | 3 | 4 | 6 | 6 | 7 | 5 |
| quill | 1 | 1 | 8 | 3 | 7 | 4 |
| septima | 3 | 4 | 9 | 9 | 6 | 2 |
| venno | 2 | 9 | 6 | 1 | 8 | 3 |

### Bios (authored, abridged from `data/characters.json`)

- **Cassia**: an Alexandrian lamp-keeper's daughter who read every scroll about power. Wins fights before they start; keeps her own ledger.
- **Brennic**: a Gaulish auxiliary who burned a barbarian ford for Rome and was collared for it. Wants the top of any hierarchy.
- **Garran**: a Danube farmer who raised walls for the legion; has a wife and two daughters beyond the Door and means to walk back.
- **Iskar**: a steppe rider who believed Rome's promise of citizenship. Hates the collar and the tents that obey it; wants a fifth tent that answers to no one.
- **Sadruba**: twenty years in the camp; picks the Ember entrant by blood and Pit results only.
- **Ophel**: keeps the Tide ledger of debts and the camp's best information; commissions untraced schemes.
- **Ruadh**: holds the Stone Tent together with bread and patience.
- **Kesh**: an old nomad who trades with the Lanista and everyone else; tolerates Iskar for the hands he brings.
- **Corvo**: was the Ember entrant until the new Fire mage arrived; same rank as Brennic.
- **Nysa**: charming, quick, the best liar in camp; Cassia's same-rank rival.
- **Senna**: proud and careful; the Stone Tent's best young fighter until Garran came.
- **Lio**: reckless, likeable, owes money to half the camp; Iskar's same-rank rival.
- **Fenna**: thrown out of the Gale Tent for a theft she did not commit; hungry and clever.
- **Old Quill**: a deserter from the Roman arcane college that built the Door; knows what the Wardstones drink. Nobody listens.
- **Septima**: the warden whose salt-wards lock the collars; stops violence, punishes the caught.
- **Venno**: runs the Games for betting senators; sells scouting, buys favours; never enters the camp.

Each main has a same-school, same-rank **rival** (Brennic–Corvo, Cassia–Nysa, Garran–Senna, Iskar–Lio). The rival is the Tent Trial opponent.

## Goals

`data/goals.json` gives each goal a plan: a list of intents with argument bindings (`$preferredStat`, `$elder`, `$rival`, `$goalTarget`, `$schemer`, `$stray`, `$peer`, `$creditor`, `$knownFact`). The plans are guidance for the Director and planner, not a second executable vocabulary.
The planner's goal bonus uses the intent lists in `packages/director/src/config.json` `planner.goalIntents`.

| Goal | Plan steps (`goals.json`) | Planner goal intents (`config.json`) |
|---|---|---|
| rise_in_tent | TRAIN preferred stat; BEFRIEND elder | TRAIN, BEFRIEND |
| win_games | TRAIN preferred stat; WATCH rival; SCHEME steal rival | TRAIN, WATCH, SCHEME |
| protect | PROTECT goal target; REPORT schemer | PROTECT, REPORT |
| revenge | SCHEME persuade goal target | SCHEME |
| escape_research | TRAIN focus at cistern; BEFRIEND quill at commons; PLOT at edge | PLOT, CONFIDE, WATCH |
| build_fifth_tent | RECRUIT stray; PROTECT stray | RECRUIT, PROTECT |
| undermine | SCHEME rumour serves_rome on rival; RECRUIT rival | SCHEME, RECRUIT |
| win_favour | PROTECT goal target; BEFRIEND goal target | PROTECT, BEFRIEND |
| repay_debt | PROTECT creditor | PROTECT |
| find_tent | WORK; BEFRIEND elder | WORK, BEFRIEND |
| survive | WORK; REST | WORK, REST |
| keep_peace | REPORT schemer; BEFRIEND peer | BEFRIEND, REPORT |
| profit | OFFER back_entrant to peer; WORK; WATCH peer | WORK, OFFER, WATCH |
| learn_secrets | WATCH peer; CONFIDE known fact to peer | WATCH, CONFIDE |
| hold_fifth_tent | RECRUIT stray; PROTECT peer; WORK | RECRUIT, PROTECT, WORK |

The goal and plan lists are not identical (for example escape_research). The planner uses `config.json`. A goal can be changed each day by the Director (`goal` is a decision field), but `keep_peace` blocks SCHEME.

## Starting relationships

Source: `data/relationships.json` (34 directed edges: `from > to`, trust −100..100, debt 0..99). Every other pair starts at trust 0, debt 0.

| From → To | Trust | | From → To | Trust |
|---|---:|---|---|---:|
| brennic → cassia | 15 | | iskar → lio | −10 |
| brennic → garran | 20 | | iskar → kesh | −5 |
| brennic → iskar | 5 | | corvo → brennic | −20 |
| brennic → corvo | −15 | | nysa → cassia | −10 |
| brennic → sadruba | 10 | | senna → garran | −5 |
| sadruba → brennic | 10 | | lio → iskar | −5 (debt 1) |
| sadruba → corvo | 15 | | fenna → kesh | −40 |
| cassia → brennic | 15 | | quill → septima | −30 |
| cassia → garran | 25 | | septima → fenna | −30 |
| cassia → iskar | 10 | | ophel → sadruba | −20 |
| cassia → nysa | −10 | | kesh → venno | 20 |
| cassia → ophel | 20 | | fenna → garran | 10 |
| garran → brennic | 20 | | ophel → cassia | 20 |
| garran → cassia | 25 | | ophel → nysa | 25 |
| garran → iskar | 15 | | | |
| garran → senna | −5 | | | |
| garran → ruadh | 25 | | | |
| iskar → brennic | 0 | | | |
| iskar → cassia | 10 | | | |
| iskar → garran | 20 | | | |

The Four start with positive mutual trust (the shared betrayal). Same-tent rivals start negative.
