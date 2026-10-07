# Season and time

This file defines the campaign calendar: the season of six weeks, the hour-based day, the phases, the eight places and their opening hours, how long each activity takes, and when the Tent Trial and Games happen.
All values come from `data/season.json`, `data/locations.json` and `data/camp-play.json`.

Status: built and tested (waves W0, W5, U3a). Weeks 1-2 are playable end to end. Weeks 3-6 run in the headless simulation, but their arena tiers are not built. Values are **authored**.

## Season structure

| Field | Value | Source key (`data/season.json`) |
|---|---|---|
| Weeks in a season | 6 | `weeks` |
| Days per week | 7 | `daysPerWeek` |
| Days in a season | 42 | derived |
| Games weekday | 7 (the last day of each week) | `gamesWeekday` |
| Tent Trial | 1 day before the Games (weekday 6) | `trialOffsetBeforeGames` |
| Scheme window opens | weekday 4 (open through Games day) | `schemeOpensWeekday` |
| Trial location | `pit` | `trialLocation` |
| Fourth Watch location | `edge` | `fourthWatchLocation` |
| Values that persist across the season | stats, trust, debt, loyalty, renown, gold, knowledge, mastery, arcs | `persistence` |
| Endings | breaking, champion, betrayed, revolt, martyr | `endings` |

There is no time loop or reset. The season ends after week 6; endings are resolved in a later wave (see [deaths-and-endings.md](deaths-and-endings.md)).

### Calendar function

Code (`packages/core/src/camp.ts` `calendar`) derives from the day number:

- `week = floor((day - 1) / 7) + 1`
- `weekday = ((day - 1) mod 7) + 1`
- `games = (weekday == 7)`
- `eve = (weekday == 6)` (Tent Trial day)
- `schemesOpen = (weekday >= 4)`

So the Trial eves are days 6, 13, 20, 27, 34, 41 and the Games days are 7, 14, 21, 28, 35, 42.

### Weekly rhythm

| Weekday | Label shown to the Director | What is special |
|---|---|---|
| 1-3 | "early week" | SCHEME is not allowed |
| 4-5 | "approaching the Games" | SCHEME allowed (cap 2 per day) |
| 6 | "Games eve" | SCHEME cap rises to 3; Tent Trial at the Pit at 18:00 |
| 7 | "Games dawn" | Games at 08:00 for 4 hours; poison sickness clears at settlement |

### Planned arena tier per week

Tiers are gated by mastery (`docs/design/reconciled/data/arena/arena-tiers.json` `requiresMastery`: Tiro 1, Veteranus 2, Primus 3, Summa 4). The playable build uses **Tiro only** for weeks 1-2 and does not unlock other tiers (`data/season-bridge.json` `weeksPlayable: 2`). How tiers map to weeks 3-6 is not yet specified beyond the mastery gate; the story pack places the Summa (Grand Games) on day 42.

## The day: hours (D25)

Decision D25 (owner, 2026-10-03) replaced the earlier fixed time slots with hours. Wave U3a implemented it.

| Field | Value | Source key |
|---|---|---|
| Waking hours | 14 | `wakingHours` |
| Wake hour | 08:00 | `wakeHour` |
| End of day (resolution) | 22:00 (= 8 + 14) | derived |
| Phases begin at | day 08:00, dusk 18:00, night 20:00 | `phases` |
| Travel cost | 0 hours (travel is free) | `travelHours` |
| Tent Trial | 18:00, lasts 2 hours | `trialHour`, `trialHours` |
| Games | 08:00, lasts 4 hours (whatever the real-time length of the fights) | `gamesHour`, `gamesHours` |
| Fourth Watch | 20:00 | `fourthWatchHour` |

Rules (from `packages/core/src/camp-session.ts` `timeProblem`, `passSlot`):

1. The phase is derived from the hour; it is never stored as authority.
2. An activity can start only at an open place and must **finish by the place's closing hour**.
3. An activity must not cross 22:00.
4. On Trial eve, an activity must not run past 18:00 (the Trial appointment).
5. An activity started before 20:00 must not run past 20:00: the last two hours belong to the night act.
6. **Wait** moves time to the next phase boundary (18:00, 20:00, then 22:00).
7. At 20:00, at your tent, the player can start the night act (Listening, 2 hours) or rest. The night then resolves once (see [director.md](director.md)).

### Activity durations (hours)

Source: `data/season.json` `activityHours`.

| Activity | Hours | | Activity | Hours |
|---|---:|---|---|---:|
| TRAIN | 2 | | RECRUIT | 2 |
| WORK | 4 | | DEFECT | 2 |
| BEFRIEND | 2 | | REPORT | 1 |
| CONFIDE | 1 | | PLOT | 2 |
| PROTECT | 1 | | REST | 2 |
| WATCH | 2 | | OFFER | 1 |
| SCHEME | 2 | | PARLEY (player only) | 2 |
| | | | LISTEN (player only, night act) | 2 |

**NPCs and the player use time differently.** An NPC chooses one main act per day; the act summarizes the whole day and is legal if it fits any opening interval of a place that offers it (`activityFitsDay`). The player can do several activities a day, one after another, as long as hours remain. Each player act is resolved immediately; the NPCs' acts are resolved together at night.

## Places

Source: `data/locations.json` (activities and hours) and `data/camp-play.json` (map, descriptions).

| Id | Name | Activities offered | Open (from-to) | Description (authored) |
|---|---|---|---|---|
| `yard` | the Yard | TRAIN:vigor | 08-20 | Dust, worn posts and room to make the body stronger. |
| `cistern` | the Cistern | TRAIN:focus, WATCH | 08-20 | The basin is dry. Still your hands and watch who lingers. |
| `pit` | the Pit | TRAIN:nerve | 18-20 | A hollow of red earth. At dusk, courage has witnesses. |
| `exchange` | the Exchange | TRAIN:guile, WORK | 08-18 | Small wages and careful bargains beneath the awnings. |
| `commons` | the Commons | BEFRIEND, PROTECT, RECRUIT, DEFECT | 08-20 | Bread changes hands here. So do loyalties. |
| `door` | the Door | OFFER, REPORT | 08-18 | The Vigil hears accusations at the guarded gate. |
| `tent` | your tent | REST, CONFIDE, SCHEME | 08-22 | Canvas offers little privacy. Rest, confide, or listen at the flap. |
| `edge` | the Edge | PLOT | 20-22 | Beyond the last lantern, the four can plan the bond. |

Opening intervals are half-open: `[openHour, closeHour)`. The player starts each day at `tent` (`data/camp-play.json` `startLocation`).

### Map

`data/camp-play.json` `map` gives node positions on a 1000 x 600 canvas and the route graph:
tent–commons, tent–exchange, tent–cistern, commons–yard, commons–cistern, commons–pit, commons–exchange, commons–door, commons–edge, exchange–door.
Since D25, travel between any two places costs 0 hours. The routes are visual only.

### Presence (who is where)

`data/camp-play.json` `presence` gives each NPC a place for day, dusk and night. The player can target someone with BEFRIEND, PROTECT, CONFIDE, WATCH or RECRUIT only if that person is present at the current place and phase, and is not in the stocks.

| Character | Day | Dusk | Night |
|---|---|---|---|
| cassia | cistern | tent | tent |
| brennic | yard | pit | edge |
| garran | commons | yard | edge |
| iskar | exchange | commons | edge |
| nysa | commons | tent | tent |
| senna | commons | tent | tent |
| lio | exchange | pit | tent |
| corvo | yard | pit | tent |
| sadruba | yard | pit | tent |
| ruadh | commons | yard | tent |
| ophel | cistern | tent | tent |
| kesh | exchange | commons | tent |
| fenna | commons | commons | tent |
| quill | cistern | commons | tent |
| septima | door | pit | tent |
| venno | door | commons | tent |

Presence is the same every day. It does not follow the NPC's chosen intent (not specified whether this will change).

## History / superseded

- Wave W5 used day/dusk/night **slots** with a travel budget. D25 (U3a) replaced them with hours and free travel. Save version 2 rejects old slot saves.
- The baseline used "Fourteen Nights" in loops. The reconciled design uses one 42-day season.
- The arena data file `arena-tiers.json` still describes the Tent Trial day as "loop day 2 in Loop 0". The season data is the authority; see [open-questions.md](open-questions.md).
