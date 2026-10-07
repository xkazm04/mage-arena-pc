# Game flow and screens

Purpose: lists every player-facing screen, what it shows, what the player can do there, and how screens connect. The screen logic lives in `packages/game/src/game-shell.ts`.
Status: built (U1 framework and screens, U3b camp header, U6 screen pass). Screen layout is measured by automated browser routes at 1080p and 1440p; whether the screens are pleasant to use is not owner-felt yet.

## Presentation rules (D19, U1)

- The whole game is one viewport-filling PixiJS canvas. There are no HTML panels, form controls, dropdowns or scrollbars. Text entry happens on the canvas (keyboard events, or a letter board for gamepad).
- Design space 1920×1080, scaled uniformly. Safe area is 5% of each edge. Primary targets are at least 68 px high (64 px minimum in the TV audit). Body text 30 px, labels 24 px, titles 62 px. Source: `packages/game/data/ui.json`.
- Fonts: Cinzel and Alegreya Sans (OFL), rasterized to bitmap atlases.
- UI art comes from a nine-slice UI kit atlas (`/assets/accepted/covenant/ui/kit.json`). If the kit is missing or malformed, a procedural kit is used.
- Every screen supports mouse, keyboard and standard gamepad with a spatial focus graph. See [controls-and-input.md](controls-and-input.md).

## Screen graph

```
Main menu ─┬─ Begin your story ─► Character pick ─► Camp map
           ├─ Continue season ─────────────────► Camp map (or the active bout)
           ├─ Load season ─────► Save & load
           ├─ The proving ground ─► Training list ─► Composition ─► Arena (practice / Tiro practice)
           ├─ Combat Feel Lab ───► Lab arena (setup L, tuning T)
           └─ Fullscreen

Camp map ─┬─ Place visit ─┬─ Activity (spends hours)
          │               ├─ Parley (Knowing moment) ─► Letter board (gamepad text)
          │               └─ Listen at the tent flap (night) ─► Listening act ─► Dawn
          ├─ Hollow Board / Journal / People (cast journal)
          ├─ Season (calendar)
          ├─ Tent Trial (Games eve 18:00, Pit)
          ├─ Compose your Water ─► Enter the Games ─► Arena (4 bouts) ─► Results ─► Camp
          └─ Pause ─► Settings / Sound & music / Save & load / Combat Feel Lab / Main menu
After day 14: Chapter end ("Two weeks survived") ─► Board / Journal / Save
```

## Screens

| Screen | Shows | Player actions | Notes |
|---|---|---|---|
| Main menu | Title, Cassia portrait, collar inscription, "Water / the first two weeks" | Begin your story, Continue season, Load season, The proving ground, Combat Feel Lab, Fullscreen | Route `/` |
| Character pick ("The four bound together") | Portraits of the four main mages with name and school | Only Water / Cassia is selectable ("Walk as Cassia"); the others are marked "Camp ally" | Fire, Earth and Air join camp as allies; their arena chapter is planned (W8) |
| Camp map | Header `CASTRA CLAUSA / WEEK n / DAY n`; eight place buttons with **names only**; top-right gold, reputation and fatigue icons; the daily rune clock; footer actions | Travel to a place (free), Wait until the next phase, open Board / Journal / Season, Pause; on event days: Answer the summons (Trial), Compose your Water / Enter the Games | Closed places are shown hatched and disabled (U3b, D26) |
| Place visit | Backdrop, characters present ("Here with you"), activities with their hour cost | Choose an activity, start a Parley ("Speak with X") when a Knowing moment exists, Listen at the tent flap at night | Activity durations come from `season.json/activityHours` |
| Season (calendar) | "One season. Six Games." Six weeks, Trial and Games days | Read only | Later weeks show "Later weeks await the next chapter." |
| Hollow Board | Public deeds, rumours and witnessed facts from dawn settlement | Select a card to read it | Rumours are marked; a rumour is not a witnessed fact |
| Journal | Private Knowings and facts the player knows | Read; Knowings unlock Parley | Private knowledge persists across the season |
| People (cast journal) | Camp residents with portraits and known details | Read | |
| Listening act | Night scene with three cover positions, voices and a patrol | Hold Space to listen, A/D or 1–3 to change cover, release to hide | 45 s act that hides Director latency; see [camp-phase.md](camp-phase.md) |
| Parley | Knowing moment header with hour and hours left, the cited Knowing, three authored approaches, optional typed text (280 chars) | Pick an approach, optionally type, Speak | Once per day; consumes 2 hours |
| Letter board | On-canvas keyboard rows (A–J, K–T, U–Z and punctuation) | Compose text with gamepad or arrow keys | Gamepad replacement for typing |
| Tent Trial | "Who carries the Tide?" Score, stamina, rival's stance tell | Accept the Trial; pick press / brace / feint per exchange | Best of three; see [camp-phase.md](camp-phase.md) |
| Composition ("Compose your Water") | Slot 1 Rain Needle (fixed); slots 2–4 line pickers; branch toggles; tier preview per slot; presets; Flow hint | Pick lines and branches or a preset, Inspect, Enter season Games / Enter the arena | Composition is locked for all four bouts of a Games |
| The proving ground | Lessons: Magic thrower, Steel from the side, Alternating flanks, Unblockable lane, Three-bolt stream, Tiro Games, and single roster opponents | Pick a lesson, compose, enter | "Practice / no season stakes" |
| Arena HUD | Bottom: HP, mana, stamina bars and four spell slots with cooldown and cost. Top: collar rune clock. Transient absorb, Flow and Crest feedback. Damage numbers in world | Combat controls | HUD can hide part of the southern arena rim (known issue) |
| Results | "Bout won", "The Tiro Games are yours", or "The crowd grants your life" (missio) | Enter the next bout, Return to camp, Return to practice, Save / settings | Between bouts: "The next bout resets mana, stamina and the collar." Spectator result: "You watched your tent entrant. No player payout." |
| Chapter end | "Two weeks survived / The first chapter" | Read the Hollow Board, Open your journal, Save / settings | Shown after day 14; day 15 closes the playable chapter |
| Pause | "The world can wait" | Resume, Settings & controls, Sound & music, Save & load, Combat Feel Lab, Main menu | Entering the Lab from a season checkpoints and pauses the season |
| Settings & controls | Control reference (menus, aim & cast, absorb, roll & sprint, spell slots), motion (Reduced) | Toggle reduced motion | Reduced motion turns off camera shake, hit stop and perfect slow-down |
| Sound & music | Bus volumes | Louder, Quieter, Mute all, Test effects, Test voice | Audio engine: wave AU4 |
| Save & load | Save slots with portrait and context | Save, Load, Load previous good save | Saves are versioned, source-checked and replayed before load; see below |
| Combat Feel Lab | Arena with Lab HUD and canvas panels | See [combat-feel-lab.md](combat-feel-lab.md) | Route `/lab` |

## Save and load

Source: W7 report, U3a.

- Saves work in camp, during combat and after settlement. A bout is saved as its seed plus its input log, and it is replayed independently before load or reward.
- Saves are bounded (`season-bridge.json/limits.saveBytes` = 33,554,432 bytes), versioned, checked against the combat source version, and written atomically with a previous-good recovery slot.
- Save version 2 (hour model) rejects older slot-model saves. Builds that change combat sources reject older-source saves explicitly; the player must start a new season.
- Unfinished Director or Parley inference at save time is frozen to the planner or authored-card result. Late results are ignored.
- Measured: two-week route same-seed and save/load produce a byte-identical envelope (1,300,369 bytes in H1).

## Scene flow facts

- **Season start:** Begin your story → pick Cassia → camp at day 1, 08:00, in the tent (`camp-play.json/startLocation`).
- **Night:** the final two waking hours (20:00–22:00) offer the night act. "The day is spent — dawn awaits" → Meet the morning runs dawn settlement exactly once.
- **Games eve (days 6 and 13):** the Trial is mandatory at 18:00 at the Pit. If the player is elsewhere or held in stocks, a guard escort moves them to the Pit ("Answer the summons"), so the event cannot soft-lock.
- **Games day (days 7 and 14):** 08:00, four hours of camp time regardless of how long the fights take. If the player lost the Trial they watch their tent entrant's simulated bout and get no payout.
- **Chapter end:** after day 14.

## Superseded

| Old | Current | Source |
|---|---|---|
| HTML panels over a canvas (W5–W7 browser page) | Full-canvas UI kit | D19, U1 |
| Time slots per day with travel cost | Hours; travel is free; only facility actions cost hours | D25, U3a |
| Place buttons show cost and time | Place buttons show only the name | D26, U3b |
