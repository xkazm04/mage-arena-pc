# D3. Non-combat presentation: menu, HUD and campaign, rebuilt for PC

Status: **direction menu**, written 2026-10-23 for future sessions. Section 5 steps 1 and 2 landed 2026-10-24 (see
"First slice as landed" below); step 3 landed.

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
- ~~The calendar as a living object: Games and Trial days, week level shown (enemy level = week)~~ landed in 8.8. Weather or season stays open: the view carries neither.
- The camp map with time-of-day lighting, characters present at places, and transitions between places.
- Progression screens for D1: where spell ranks and Agility are earned and spent.

### 4.4 PC-native input and settings

- ~~A real cursor and hover states, wheel scrolling, list virtualization for long journals.~~ Done, section 8.7.
- ~~Per-device glyphs (keyboard, Xbox, PlayStation) from the input modality already tracked.~~ Done, section 8.5.
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

1. Canvas kit or HTML overlay (4.1)? The engine is settled: PixiJS. **Canvas kit (option A), Director default
   2026-10-24, owner to confirm.**
2. Which screens matter most for the first visual pass: title, camp map, calendar, or results?
3. Should weeks 3-6 come before or after the visual pass?
4. Is the Lab a player feature (polished) or a developer tool (hidden)?

## 8. First slice as landed (2026-10-24)

1. **Screen modules and the layout helper (4.1 A).** `game-shell.ts` is down from 2,417 to 313 lines: it keeps the
   season session, the arena, the shared state and the router. Every screen is a module under
   `packages/game/src/screens/`; the largest is `parley.ts` at 245 lines. `ui/anchors.ts` adds `safeArea`, edge
   `anchor`, equal `columns` and a clamped `uiScale`. The proof of no visual change: a 17-screen tour (menu through
   saves) at 1920x1080 and 2560x1440 is pixel-identical before and after, with equal UI snapshots.
   - The broken characters near the old `game-shell.ts:870` were real. Six strings carried a literal `?` from U3b
     (`8d3888f`), for example "Tent Trial ? 18:00". They now use a middle dot, and an em dash for the dawn line.
2. **School-aware HUD (4.2).** The arena HUD left `arena-entry.ts` for `packages/game/src/hud/`:
   - `school-hud.ts` is the model;
   - `rune-meter.ts` draws the Heat and Momentum meters, marked at 50/80 and 40/80 from the identity;
   - `arena-hud.ts` draws the HUD itself.

   A Fire or Air player sees the bolt + 4 slots, each dark until its rune, with school cooldowns at the actor's pace,
   overlay prices and the rune meter in place of Flow. A ranked actor gets rank pips, with a star for a carried rank-5
   ultimate, plus a BUILD line. The unranked Water HUD has the same buttons and texts as before. There is one test per
   school. `@mage/core/arena` does not export `slotSpell`, `balancedSpell` or `identityNumber`, so the HUD mirrors
   them; a test pins the mirror to `arena/schools.ts`.
   - Not in this slice:
     - the meter at the opponent's feet (arena scene);
     - the bolt + 4 composition screen for practice entry (W8 lane P);
     - the rival's phase gems.
   - Landed after the slice (`4635100`, test `packages/game/src/input.test.ts`): Digit5, the wheel and the bumpers reach
     the fifth slot. `arenaHud` sets `ArenaInput.slotCount` from `slotCount(school)`: 5 for a Fire or Air bolt + 4
     layout, 4 for Water, whose input is unchanged. Digit5 does nothing with four slots. The settings hint reads 1-5.
3. **Settings and widescreen (4.4)** (`5315373`, `d4b8868`, `c4a5931`, `ed1bee6`).
   - `packages/game/src/settings/`: one versioned settings object (UI scale 0.75 to 1.5, window mode through the
     Fullscreen API, graphics tier, reduced motion) in the single `mage-settings` key, with load, validate, migrate and
     per-field fallback. It keeps `mage-motion` in sync, because `arena-entry.ts` and `arena-scene.ts` read it.
     The tier maps onto `quality.json` profiles without editing `quality.ts`. Only `desktop` exists, so every tier
     maps to it today; a tier with another profile reloads once with `?quality=`.
   - **Settings persist outside the save: Director default 2026-10-24, owner to confirm.** D3 asked for them to travel
     with the save. The reason for the default: no save-schema change overnight. The cost is that settings are per
     device and not per save slot.
   - `viewportLayout(w, h, uiScale)` keeps the 16:9 design stage for content and reports the viewport `edges` in design
     units. The backdrop covers the viewport, its title and footer bands span the real edges, the collar sigil anchors to
     the top-right corner, and the arena HUD's corner clusters (vitals, rune meter or Flow, Pause) sit against the
     screen edges. At 16:9 the offsets are 0, so nothing moves. `anchors.safeEdges` gives edge-based corner anchors.
   - The settings screen in `screens/pause.ts` has the new controls and a key or pad hint line driven by the last input
     device.
   - Measured (`npm run smoke:d3`, `d3-widescreen-browser.ts`): the camp at 1920x1080, 2560x1440 and 3440x1440 has live
     pixels on both side strips (no letterbox bar), no text or button outside the viewport, and edges of 0..1920 at
     16:9 and -330..2250 at 21:9. UI scale 115% and reduced motion survive a page reload. Unit tests cover settings
     load, defaults, migration and corrupt values, and `viewportLayout` at those three sizes.
4. **Arena widescreen, HUD re-anchoring and smoke reconcile (4.4, 2026-10-24).**
   - The arena camera already spans the whole viewport (`makeCamera` takes `app.screen`); what showed at 21:9 was the
     renderer's clear colour beyond the painted plate. The floor under the plate now starts with a worn-stone surround
     with the same quiet pigment marks, drawn only when the visible ground is wider than the plate (`arena-scene.ts`
     `buildFloor`). The camera, the combat geometry and every gameplay number are unchanged.
   - **Surround look: Director default 2026-10-24, owner to confirm.** A flat worn-stone tone with scattered marks, not
     an extension of the painted plate (that would need new art, which is a spend ask). The seam where the plate ends is
     visible at 21:9.
   - The arena HUD rebuilds when the viewport edges change (a resize or a UI scale change), so a window widened inside a
     bout re-anchors its corner clusters. `hud/hud-anchors.ts` holds `hudAnchors` and `edgeKey`;
     `arena-widescreen.test.ts` covers the margins at 1080p, 1440p and 21:9 and the stale check.
   - Measured (`npm run smoke:d3`, extended): the arena at 1920x1080, 2560x1440 and 3440x1440 has live pixels on both
     side strips (share 1.0, threshold 0.9) and no HUD text or button outside the viewport; edges are 0..1920 at 16:9 and
     1440p and -330..2250 at 21:9. Widening a 1080p bout window to 3440x1440 moves the edges to -330..2250, keeps Pause
     on the right margin and leaves both strips live. Screenshots: `docs/waves/D3-evidence/screens/`
     `{1080p,1440p,21x9}-arena.png` and `1080p-to-21x9-arena.png` (git-ignored, regenerated by the smoke); numbers in
     `docs/waves/D3-evidence/d3-widescreen.json`.
   - **smoke:u4 reconciled.** The 1.5x figure scale is deliberate: `a009284` (U5, scale contract v3, "figures 50% larger",
     60.75 px at 1080p in OWNER-CHECKS). The assertions were stale: u4-browser 97.2 -> 145.8 px, u3-browser camera 0.0375 ->
     0.05625 of the height. Four more stale checks fixed beside it (prop depth probe ids, the "cast" effect count since
     `0d2e5f8`, the procedural cinder hound that now has A10 pages, and the 300 MiB texture budget, measured 387 MiB,
     raised to 400 as a stopgap). `u4-browser.ts` passes.
   - Still open:
     - Nothing from the old list is open. `smoke:u3` and the `u4-tour.ts` half of `smoke:u4` used to stop in the first Tiro
       bout with "Cannot read properties of null (reading 'addressModeU')". The cause was holders of the
       `inscription.collar` page without their own lease. Fixed by `742b0bb` (`sigil()` and `RivalCollarView` each lease
       `inscription.collar`) and `d7e776a` (`art-fixture.ts` emits `release`, and `smoke:u4` checks the cast effect
       again). The follow-on "Arena checkpoint mismatch" was fixed by `17cb830` (fdlibm, engine-independent trig).
       After `17cb830`, `smoke:u3` (26 screens) and `u4-tour` (88 screens) PASS on main.

5. **Per-device pad glyphs (4.4, 2026-10-26)** (`680c043` tests, `7424c68` implementation).
   - `settings/pad-glyphs.ts` holds `padFamily(id)`, which reads the `Gamepad.id` string: Microsoft (045e, Xbox, XInput)
     gives `xbox`, Sony (054c, DualShock, DualSense, "Wireless Controller") gives `playstation`, anything else gives
     `generic`, which uses the Xbox names because the standard mapping is Xbox-shaped. Xbox is checked first, since
     "Xbox Wireless Controller" also contains the Sony-style name.
   - `CanvasUI` keeps `padFamily` beside `modality`, set from the connected standard pad on every poll, so a pad swapped
     mid-session changes the copy the next time a hint renders. `Pad` gained an optional `id`.
   - `hudHint`, `settingsLines` and `menuHint` take the family (default `xbox`). PlayStation copy names Cross, Circle,
     R2, L2, L1 and R1. The arena HUD, the pause menu's settings screen and footer, and the Controls screen pass
     `u.padFamily`. Keyboard and mouse copy and the Xbox copy are byte-identical, so no existing test moved.
   - Text only: no glyph art and no layout change. Tests: `settings/pad-glyphs.test.ts` (DualSense, DualShock 4, Xbox
     Series, Xbox 360 XInput and an unknown id; a PlayStation, Xbox and keyboard case per hint function).
   - Landed (`bb56684` red tests, `56b0a62` implementation): `pauseHint(modality, family = "xbox")` is built on `padNames`; the gamepad copy names the pause button ("START  Pause", "OPTIONS  Pause" on PlayStation), keyboard copy stays "ESC / START  Pause". The loading card in `arena-entry.ts` re-sets the text every render from `u.modality` and `u.padFamily`. Tests: `settings/pad-glyphs.test.ts`.
   - Not changed: `parley.ts` has no pad button copy.

6. **Skill-book screen (4.3 progression screens, 2026-10-26)** (`4748200` red tests, `ab641b6` director, `811abe7` screen).
   - **Director widening, Athena's ruling 2026-10-26 09:32Z** (the game sees the season only through `season-service.ts`):
     `view().season.skills` (school, points, earned, taught, `trustNeeded`, a row per known spell with rank and next cost,
     a row per elder with trust, their signature and the core's own refusal text) and two `SeasonCommand` cases,
     `buy-rank {key}` and `take-lesson {teacher}`. They call `buySeasonRank` and `takeSeasonLesson`, are checked by the
     same envelope check as the other commands (exact keys, string fields) and bump the revision. Reversible; the save
     schema, `save.ts` and `skill-book.pc.json` are untouched.
   - **Flag-off proof.** The `skills` key is present only while `progress.skills` is, so with the flag off it is absent, not
     `null`: a `null` would add `"skills":null` to the JSON and break byte identity (a deviation from the ruling's
     `?? null`, taken for the stricter hard limit). `season-service.test.ts` pins the flag-off view JSON of a fresh season
     (7629 bytes, sha256 `936ceedc...6ca8b`, taken on main before the change) and shows both new commands refused with
     `No one teaches spells yet.`, revision unmoved.
   - **The screen** (`screens/skills.ts`, id `skills`, a plain router screen): six spells a page with rank, next cost and
     "not enough yet", the elders with `Trust n of N` and a lesson button whose subtitle is the director's refusal. A refusal
     comes back as a line on the screen, never thrown. Reached by **K** from the camp, visit, calendar, board and journal
     screens, and only while the view carries a book; with the flag off the key does nothing. `game-shell.ts` grew from 297
     to 300 lines (import, member, init line).
   - **Closed in 8.7:** the on-screen button to the book landed (`3bf0881`); K stays as it was.

### 8.7 PC-native input remainder and the camp entry to the skill book (2026-10-26)

Two parts, each red then green. Base `main` a5083fd; `game-shell.ts` stays at 300 lines; `save-schema.ts`, `save.ts`,
`skill-book.pc.json` and `season-service.ts` are untouched.

- **A. Camp entry** (red `0a0e43b`, green `3bf0881`). A `skill-book` tab-style button at (1324, 205, 296x68) in the free
  gap of the camp header row, between the tabs and Pause. It is drawn only while `hasBook(view)` (the check in
  `screens/skills.ts`, reused) and does what K does: open the camp on the stack, reset and go to `skills`. The K binding
  is unchanged.
- **Flag-off proof.** `camp-book.test.ts` renders `camp()` on a recording canvas (every ui call and the link graphics
  instructions, serialized) and pins the flag-off output at **3545 bytes, sha256
  `b8ed3fd02b1e5f3fd716a89f4aa14368dc759a0a89eab6d2f99018a6f9132e95`**, measured on unmodified main a5083fd before the
  button existed (the pinning commit was green for it and red only for the button test). A second test shows the button
  exists and routes to `skills` when `season.skills` is present, and is absent when it is not.
- **B. PC-native input** (red `0757fb3`, green `dde6b44`).
  - *Wheel.* Outside the arena the wheel presses the screen's own Previous/Next (`wheelPager` in `ui/hover.ts`): journal
    cards, the cast, skill spells, camp actions, training. Ids are allow-listed so `load-previous` ("Recover previous")
    is never a pager; a disabled end does nothing; 120 ms throttle. Saves has no paged list. The arena's slot-cycling in
    `input.ts` is untouched and `input.test.ts` is unedited and green.
  - *Hover.* The skin choice moved out of the frame loop into `buttonLook`, which is unit-tested for every kind (button,
    tab, slot, card). The one kind that bypassed hover was the card (the kit has no `card.hover` region): a hovered card
    now gets a gold outline on top of its focus ring. No kit or atlas change.
  - *Virtualization.* `cards()` builds one page (`perPage` = 4 rows) through `pageWindow`, which also clamps a stale page
    into range. `journal-virtual.test.ts`: a 500-entry journal builds the same nodes as a 3-entry one plus at most
    `perPage` rows (at most 4 `card-` buttons, under 60 display requests in all), and 124 presses of Next reach "Fact 499".
- **Gate.** `npm run gate` green; `npm run smoke:d3` exits 0. The smoke rewrites `d3-widescreen.json` with arena `hud`
  text count 35 where the committed file says 34. That is the arena HUD (rival phase gems, `427e315`), not a screen
  touched here; the file was left as committed.
- **Still open in 4.4.** Settings persisted *with the save*, not only in localStorage, is the owner's call (it changes the
  save schema, which does not move without an ask). Resolution options and window mode beyond today's profile likewise.

### 8.8 The living calendar and the smoke:d3 re-pin (2026-10-26)

Base `main` 955337b. Settings with the save stays the owner's call and is untouched; `season-service.ts`, the save files,
`skill-book.pc.json`, `input.ts` and `game-shell.ts` (300 lines) are untouched.

- **Pin** (`calendar.test.ts`, green on unmodified main): the calendar render on a recording canvas (every ui call,
  serialized), fixture day 9 / week 2, **4346 bytes, sha256 `c84cc0b57d87453e6f9b8fb5c7d0c4ae7472eb08da2d1c9d0d51a8e82fba527a`**.
- **Red** (`1855b47`): "marks today once, and moves the mark with the day", "marks every Games day (7, 14 ... 42) and every
  Trial eve (6, 13 ... 41) with its own kicker", "shows each week's level on its WEEK row, past, current and future told
  apart", plus "keeps the existing strings".
- **Green** (`a7cb414`, `b9d3e4d`). On screen: a gold `TODAY` tag in the top right of today's cell; a water `GAMES` kicker
  on days 7, 14 ... 42 and an earth `TRIAL` kicker on the eves (6, 13 ... 41), under the date and beside the existing
  school icons; under each `WEEK n` a line `LEVEL n · PAST | NOW | AHEAD` (enemy level = week, capped by `maxEnemyLevel`
  from `@mage/core/arena`), the current week's label in gold, past weeks muted. All colours come from `colours`; no new
  palette value. Nothing new in the view: the week and today come from `view.day`, the seven-day rhythm is the same one
  the screen already assumed (Games on the seventh, the Trial the eve before; `season.json` agrees). `b9d3e4d` repairs a
  mojibake of the middle dot that `a7cb414` carried (it never built); the **final pin is 5169 bytes, sha256
  `1c50ae1532c0362f7652da51255d0cfb3a610c964db7ac2f0261899464061d97`** (the 5175 of `a7cb414` is superseded).
- **smoke:d3 re-pin** (`c0a1030`). `d3-widescreen.json` arena `hud` text count 34 -> 35 in the three arena viewport rows
  and nothing else in the file moved. The extra text is the rival phase-gem label added by `427e315` (a muted 22 px label
  on the right cluster for the named rival's next break). `npm run smoke:d3` exits 0 and leaves the file unchanged.
- **Still open.** Weather or season is not in the view. The calendar draws a fixed 6x7 grid; the Games and Trial schedule
  is constant-derived, not read from the tables, so a season that changes `daysPerWeek` would need the view to carry it.
  Settings persisted with the save (4.4) remains the owner's call.
