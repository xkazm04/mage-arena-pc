# Camp phase (non-combat play)

Purpose: describes what the player does in camp: the hour budget, places and activities, the header and clock, the night listening act, Parley, the Tent Trial and how Games results flow back. The rules that resolve NPC actions, trust, hunger, schemes and the Director are campaign topics, linked below.
Status: built for weeks 1–2 with Water / Cassia (W5, W6, W7, U3a, U3b). Values are authored; generated nights are simulated; daily pacing and listening difficulty are not owner-felt.

Related campaign docs: [season and time](../campaign/season-and-time.md), [camp simulation](../campaign/camp-simulation.md), [Director](../campaign/director.md), [social systems](../campaign/social-systems.md), [cast and schools](../campaign/cast-and-schools.md).

## The day in hours (D25)

Source: `docs/design/reconciled/data/season.json` (owned by the campaign export, see [../campaign/season-and-time.md](../campaign/season-and-time.md)), U3a.

| Item | Value |
|---|---|
| Waking hours | 14, from 08:00 to 22:00 |
| Phases | day from 08:00, dusk from 18:00, night from 20:00 |
| Travel | free (0 hours) between any places |
| Activity cost | each activity has a fixed duration in hours (table below) and must finish before the place closes |
| Waiting | always possible; advances to the next phase boundary |
| Night act | the last two hours (20:00–22:00) |
| Dawn | settles the whole camp exactly once |
| Trial | Games eve (day 6 and 13) at 18:00 at the Pit, 2 hours |
| Games | day 7 and 14 at 08:00, 4 hours of camp time regardless of real fight length |

Activity durations (hours), source `season.json/activityHours`:

| TRAIN | WORK | BEFRIEND | CONFIDE | PROTECT | WATCH | SCHEME | RECRUIT | DEFECT | REPORT | PLOT | REST | OFFER | PARLEY | LISTEN |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2 | 4 | 2 | 1 | 1 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 1 | 2 | 2 |

Repeating an activity in the same day does not reroll its contest: each actor/action/day has one seeded draw.

## Places

Source: `../campaign/data/locations.json`, `../campaign/data/camp-play.json`.

| Place | Opens–closes | Activities | Description shown to player |
|---|---|---|---|
| the Yard | 08–20 | TRAIN vigor | Dust, worn posts and room to make the body stronger. |
| the Cistern | 08–20 | TRAIN focus, WATCH | The basin is dry. Still your hands and watch who lingers. |
| the Pit | 18–20 | TRAIN nerve | A hollow of red earth. At dusk, courage has witnesses. |
| the Exchange | 08–18 | TRAIN guile, WORK | Small wages and careful bargains beneath the awnings. |
| the Commons | 08–20 | BEFRIEND, PROTECT, RECRUIT, DEFECT | Bread changes hands here. So do loyalties. |
| the Door | 08–18 | OFFER, REPORT | The Vigil hears accusations at the guarded gate. |
| your tent | 08–22 | REST, CONFIDE, SCHEME | Canvas offers little privacy. Rest, confide, or listen at the flap. |
| the Edge | 20–22 | PLOT ("Plan the bond") | Beyond the last lantern, the four can plan the bond. |

- The map has eight nodes and fixed routes (`camp-play.json/map`). The player starts in the tent.
- Each NPC has a presence list (day, dusk, night place) in `camp-play.json/presence`. Visits show who is "Here with you"; social activities and Parley need the target present.
- Schemes open from weekday 4 through Games. Scarce actions (SCHEME, DEFECT, REPORT, OFFER) have camp-wide daily caps shared with NPCs (SCHEME 2, 3 on Games eve; DEFECT, REPORT, OFFER 1 each). See [../campaign/camp-simulation.md](../campaign/camp-simulation.md).
- What each activity changes (stat points, gold, trust, hunger) is defined in `rules.json`; see [../campaign/camp-simulation.md](../campaign/camp-simulation.md).

## Stats the player trains

Source: `data/arena-design/stats.csv`. Ranks 1–5; points needed for ranks 1–5 are 0 / 6 / 14 / 24 / 36.

| Stat | Trained at | Arena effect | Camp effect |
|---|---|---|---|
| vigor | Yard | max HP = 80 + 15 × rank; max stamina = 60 + 10 × rank | WORK pays +1 gold at rank ≥ 3 |
| focus | Cistern, tent lessons | max mana = 80 + 15 × rank; mana regen = 6 + 1.5 × rank per s | lessons +1 extra at rank ≥ 3 |
| nerve | Pit | ward drain = 30 − 3 × rank mana/s; perfect refund × (1 + 0.1 × rank) | Parley intimidate roll = nerve × 4 + d20 |
| guile | Exchange, Commons | scouting reveal (planned) | scheme and Parley roll = guile × 4 + d20 |
| renown | arena | at renown ≥ 40 the crowd throws one +25 mana flask in a final (planned, not built) | Tent Trial weight 0.2 |
| gold | Exchange, arena | gear (planned) | bread, bribes, gifts |
| mastery | Games | arena tier eligibility (planned) | none |

The stats.csv column `on_reset` (Echo) is a leftover from the loop design and does not apply; see Superseded.

## Header and daily clock (D26, U3b)

- Top-right header: gold, reputation (renown) and fatigue, each with an icon.
- Daily clock: a verdigris ring with one rune per waking hour. Spent runes darken, the hand moves, the remaining arc drains, and it refills at dawn. A low-hours warning uses colour and words. Reduced motion snaps to the true value.
- Place buttons show the name only. Closed places use the kit's disabled/hatch style.
- Activity buttons inside a place show their real hour cost.

## Night: the listening act (W5)

Source: `camp-play.json/listening`.

The night act both rewards the player and hides the Director's model latency: Director calls start when dusk is committed and run in the background during the act.

| Parameter | Value |
|---|---|
| Duration | 450 ticks × 100 ms = 45 s |
| Cover positions (lanes) | 3 |
| Patrol period | 60 ticks |
| Voice (beacon) period | 90 ticks |
| Patrol warning | 12 ticks |
| Ticks of listening per fragment | 10 |
| Fragments needed for a Knowing | 3 |
| Fragments lost when exposed | 1 (once per continuous exposure) |
| Grace after the act before planner fill | 12,000 ms |

Play: move between covers to follow the voices, hold Listen to collect fragments, release when the patrol reaches your cover. With three fragments the player earns a Knowing chosen by code (not by the model). "Rest" and other night activities are shorter alternatives.

After the act, the server waits at most the grace period, fills missing NPC groups with the deterministic planner, cancels outstanding model calls and ignores late results. Dawn commits once. The browser never sends ticks, rewards or numeric effects.

## Hollow Board and journal

- **Hollow Board:** public and witnessed facts from dawn settlement, plus rumours (marked; a rumour is not proof).
- **Journal:** private Knowings and facts the player knows. Secrets never leak to the Board.
- Generated flavour text is checked for digits, number words, unknown names, instructions and banned consequences; bad lines are replaced from an authored phrase bank. See [../campaign/director.md](../campaign/director.md).

## Parley (W6)

A typed or card-based conversation with an NPC, available only at a **Knowing moment**:

- The player holds a true Knowing about that NPC, and the NPC is present at the same open place.
- At most one Parley per day. It costs 2 hours, even if refused.
- Closed while in stocks, during the listening act, after night ends, or after the season ends.

Flow: the screen shows the held Knowing, three authored approaches (reveal, bargain, ask) and an optional 280-character text field. An approach is always selected, so if typed text cannot be interpreted (model unavailable or timed out), the selected authored card is used. Clicking a card directly never calls the model.

Effects are closed and checked by code: trust shifts (capped), `reveal_fact` (a true fact the NPC knows), `flip_next_intent` (the NPC's next night act becomes a friendly player-directed act). Large effects need a cited held Knowing and a roll: `stat × multiplier + d20 > DC` (intimidation uses nerve, other stances guile). Hostile or deceptive stances lose trust when they fail. Parley grants no death, gold, mastery or invented fact. Details: [../campaign/social-systems.md](../campaign/social-systems.md).

## Tent Trial (Games eve)

Source: `../campaign/data/season-bridge.json/trial`, `arena-tiers.json/tentTrial`.

An unarmed stamina bout at the Pit, 18:00, against the same-rank tent rival, decided by best of three exchanges (win 2, at most 3).

| Stance | Beats | Stamina cost |
|---|---|---|
| press | feint | 18 |
| brace | press | 8 |
| feint | brace | 12 |

Other values: rank weight 2, counter bonus 12, exhausted penalty 8, respect trust +3, score scale 100. The rival's stance tell is shown ("Their stance: …"); opposing choices are seeded.

Entrant score = bout result 50% + elder's trust (favour) 30% + renown 20%. The higher score carries the tent into the Games. A loser watches their tent entrant's simulated Water bout (spectator competence 2) and gets no gold or renown. A Trial cannot be retried the same day.

## Games entry and the season bridge (W7)

Source: `packages/core/src/season.ts`, `season-bridge.json`.

1. On Games day at 08:00 the player opens **Compose your Water**, picks a loadout, then **Enter the Games**.
2. Camp stats map to arena values by name (vigor, focus, nerve ranks).
3. Penalties carried in: fatigue costs 2 max stamina per point; poison ("sick") costs 10 HP and 20 max stamina at the next Games. Resources never drop below 1.
4. The Games are the Tiro tier (both weeks), four bouts; see [opponents-and-arena-tiers.md](opponents-and-arena-tiers.md).
5. Result: gold and renown for the highest completed wave (clamped to the camp ranges); main allies gain trust (+3 if the player won the final, +1 on missio); a rumour fact is posted; a result fact goes to the Board. Games consume 4 camp hours.
6. Mastery is not awarded yet, and later tiers do not unlock (planned W9/W11).

## Superseded

| Old | Current | Source |
|---|---|---|
| Day/dusk/night slots; one activity ends a slot; travel spends a budget | Hours; travel free; activities cost hours | D25, U3a |
| Listening "slot" | Listening costs 2 hours (`activityHours.LISTEN`) | U3a |
| Parley "consumes the current activity slot" | Parley costs 2 hours | U3a |
| `stats.csv` on_reset Echo rules; arena-tiers "loop" wording | Single six-week season, no resets | D2 |
