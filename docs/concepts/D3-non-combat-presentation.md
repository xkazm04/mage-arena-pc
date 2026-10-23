# D3. Non-combat presentation: menu, HUD and campaign, rebuilt for PC

Status: **direction menu**, written 2026-10-23 for future sessions; nothing here is built.

**Decision (owner, 2026-10-24): painted 2.5D, in PixiJS, is the primary direction** ("Im sold to 2.5D [...] master as
primary choice over 3D").

The references:
- the menu, HUD and campaign are judged against the painted **A** targets T3-A (HUD), T4-A (camp map and calendar) and
  T5-A (title) in `docs/concepts/D4-visual-target-prompts.md`;
- the camp map is an illustrated painting with sigil markers and plaques, not a 3D diorama.

## 1. The owner's words

> "Visual part of non-combat parts - menu, hud, campaign. As we need to use upgrade of tech and resources from FireTV and improve all aspects of how game looks and feels"

All four drivers are in scope: architecture first, a school-aware HUD, campaign presentation, and PC-native input and
settings.

## 2. Where things stand

| Area | Today | Evidence |
|---|---|---|
| Structure | every screen is a private method of `GameShell` in a **2,417-line** file (menu, camp map, visits, calendar, board, journal, parley, Tent Trial, compose, proving ground, results, pause, settings, sound, saves, chapter) | `packages/game/src/game-shell.ts` (menu `:296`, camp `:542`, calendar `:841`, settings `:2072`, saves `:2227`) |
| UI kit | immediate-mode canvas UI (`panel`, `text`, `button`, `slider`, `icon`, `bar`, `notice`), bitmap fonts, a nine-slice Covenant atlas; no layout engine, absolute pixel coordinates per screen; no component catalog | `ui/ui.ts`, `ui/kit.ts`, `art/ui/README.md` |
| Tokens | colours in `kit.ts:4-16`; `data/ui.json`: 1920x1080 design size, 5% safe area, body 30 px, title 62 px, target height 68 px (TV sizes) | `data/ui.json` |
| Scaling | letterbox only: no widescreen or ultrawide use, no UI scale setting | `ui/layout.ts:21-37` |
| TV-era tech worth keeping | spatial focus navigation, gamepad repeat and dead zones, input modality switching (focus ring only for keyboard and pad), reduced motion | `ui/layout.ts:44+`, `ui/gamepad.ts`, `ui.ts:71` |
| PC gaps | no mouse-wheel scrolling, OS cursor hidden for a painted one, static key hints ("ARROWS / TAB ... ENTER ... ESC"), no graphics, resolution or UI-scale options, settings only in localStorage | `style.css`, `game-shell.ts:291` |
| HUD | Water-only: slot icon 0 hardcoded `"water"`, Water spell names and cooldowns for every school, heading hardcoded "Cassia of the Tide"; no Heat or Momentum meter; no build or rank readout | `arena-entry.ts:998`, `:1103`, `:1129`, `:1172` |
| Campaign | 6x7 calendar grid; only **weeks 1-2 playable** ("WATER / THE FIRST TWO WEEKS"); camp map of eight places; day, dusk and night backdrops; portraits exist for 7 moods per character but only Cassia's is shown outside the journal; narrative from the director's phrase bank | `game-shell.ts:841-870`, `assets/accepted/camp`, `a2c/portraits`, `packages/director` |
| Debug look | "Combat Feel Lab" and "The proving ground" on the title menu; all-caps slash kickers; Lab banners "NOTHING IS SENT, SAVED OR PAID" | `game-shell.ts:296+` |
| Inconsistencies | stale `art/interface-style-v1.json` palette ("Tessera & Lime", Segoe UI) conflicts with Covenant; body font shipped is Alegreya, the manifest names Source Sans 3; possible broken characters near `game-shell.ts:870` (to verify) | scout, 2026-10-23 |

## 3. Goals

1. Screens that look like **one designed game**, not a tool: a real title screen, consistent layout, transitions.
2. A HUD that **reads the player's school and build**: the right spells, the resource meter, ranks and ultimates.
3. A campaign that is **all six weeks**, presented with the cast's faces, a living calendar and a camp you want to walk.
4. **PC-native** input and settings: mouse and wheel, keyboard and pad glyphs, resolution and UI scale, persistent
   options.
5. A structure where a screen can be **redesigned without touching the other 20**.

## 4. Candidate directions

### 4.1 Architecture first

| Option | What it is | Trade-off |
|---|---|---|
| **A. Screen modules on the current kit** (recommended) | split `game-shell.ts` into one module per screen behind a small router; add anchors and a layout helper (edges, columns, safe area, UI scale) to `CanvasUI` | low risk, incremental; still a canvas kit |
| B. DOM/HTML UI over the canvas | menus and campaign in HTML/CSS (rich text, scrolling, accessibility); the canvas keeps combat | fast iteration, real layout; two rendering worlds to keep consistent |
| C. Native engine UI | only if D2's 2.5D mastery slice fails and the fallback opens | not planned |

### 4.2 School-aware HUD

- Slots from `slotSpell` for Fire/Air, Water lines for Water; school cooldowns and prices.
- Heat (50/80 marks) and Momentum (40/80 marks) rune meters (W8 decision A2).
- Build readout: spell ranks as pips, the rank-5 ultimate marked, Agility shown where it changes timing.
- The named rival's phase and its granted signature telegraphed (rival-phases `phase` event).

### 4.3 Campaign presentation

- Weeks 3-6 playable end to end (they run headless today).
- Portraits in conversations, the board and results; mood follows relationships.
- The calendar as a living object: Games and Trial days, week level shown (enemy level = week), weather or season.
- The camp map with time-of-day lighting, characters present at places, and transitions between places.
- Progression screens for D1: where spell ranks and Agility are earned and spent.

### 4.4 PC-native input and settings

- A real cursor and hover states, wheel scrolling, list virtualization for long journals.
- Per-device glyphs (keyboard, Xbox, PlayStation) from the input modality already tracked.
- Settings: resolution, window mode, UI scale, graphics quality tiers above today's single `desktop` profile, audio
  buses, reduced motion; persisted with the save, not only in localStorage.
- Widescreen: layouts anchor to edges instead of a letterboxed 16:9 stage.

### 4.5 Look and feel

- A title screen built on T5-A: painted key art with layered parallax, the moonlit arena, and the menu column on dark
  enamel plaques.
- The camp map built on T4-A: a painted map with time-of-day lighting layers, sigil markers, plaque labels and lantern
  and smoke particles. These are the same Pixi lighting and particle techniques D2's slice proves.
- The HUD built on T3-A: aged-silver slot frames, a curved rune meter, rank pips and the rival's phase gems.
- Screen transitions, button motion and sound, a consistent kicker and heading system.
- One palette and type system: retire `interface-style-v1.json`, settle the body font.
- Move "Combat Feel Lab" and "The proving ground" behind a developer menu.

## 5. Recommended first slice

1. **Screen modules and the layout helper (4.1 A)**, with no visual change, proven by the existing UI tests and
   `camp-browser` screenshots at 1080p and 1440p.
2. **School-aware HUD (4.2)**: it unblocks playing Fire and Air in the Lab today.
3. **Settings and widescreen (4.4)**, then the title screen and camp map against T5-A and T4-A (4.5). These reuse the
   lighting and particle work from D2's mastery slice.

## 6. How success is measured

- `game-shell.ts` under 400 lines, one module per screen, and no screen file over about 500 lines.
- The HUD shows the right spell names, cooldowns and meter for each school (a test per school).
- `camp-browser` screenshots at 1080p, 1440p and 21:9 with no letterbox bars and no clipped text.
- Settings survive a restart and travel with the save.
- The owner judges the redesigned menu and camp against the D4 target images.

## 7. Open questions for the spark

1. Canvas kit or HTML overlay (4.1)? The engine is settled: PixiJS.
2. Which screens matter most for the first visual pass: title, camp map, calendar, or results?
3. Should weeks 3-6 come before or after the visual pass?
4. Is the Lab a player feature (polished) or a developer tool (hidden)?
