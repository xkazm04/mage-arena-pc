# 10-31 gate rehearsal: PC channel (2026-10-27)

Operator standup 2026-10-27, aim A. The gate's wording (VR `docs/DECISIONS.md:967`): **"gameplay, graphics, models,
animation and audio at high quality, VR-less."** This rehearsal scores the PC channel against that wording and against
the numbers in D1 section 6 and D3 section 6, on local `main` at `ee241f70` plus the ruling-2 doc commit `13d69ff6`
(a comment and a doc line, nothing else).

Host: Windows 11, Node 24.14, headless Chromium (Playwright 1.63, ANGLE/D3D11). No paid calls were made. AU4 audio
(held run 935a3a33) is being re-cut in a parallel lane: audio is scored **as main stands now**, and AU4 is listed as
in flight.

## What was run

| Run | Result | Evidence |
|---|---|---|
| `npm run gate` | **pass**: build, lint, vitest 123 files / 983 tests, node tests 48/48, `check:design` | `logs/gate.txt` |
| `npm run smoke:d3` (1080p, 1440p, 21:9; camp and arena) | **pass**, `"ok": true`, 53 s | `logs/smoke-d3-tail.txt`, `stills/d3-*` |
| `npm run smoke:u4` (art browser + the U4 tour, 1080p and 1440p) | run 1 **fail** at `u4-browser.ts:158` (water body frames did not advance in 220 ms), run 2 **pass** (33 + 88 screens) | `logs/smoke-u4-run1-failure.txt`, `logs/smoke-u4-run2-pass.txt` |
| `npm run smoke:u3` (camp tour, 1080p and 1440p) | **pass**, 26 screens, 251 s | `logs/smoke-u3-tail.txt` |
| `smoke:preload` (built game, `preload-browser.ts`) | **pass**, 17 load cases, no timeout, no missing asset; 354 WebGL warnings (gap M2) | `logs/preload-results-trimmed.txt` |
| `npm run smoke:audio` (AU4 WebAudio graph, 1080p and 1440p) | **pass**, `{"passed":true,"runs":2,"faults":2}` (the 2 faults are the smoke's planted ones) | `logs/smoke-audio-tail.txt` |
| Full flow in the built game | title -> character -> camp -> proving-ground duel -> bout results -> Tiro Games -> chapter results, walked by the U4 tour (run 2) at 1080p and 1440p | `stills/flow-*` |

The smokes rewrite three tracked pins as they run (U3 `browser.json`, U4 `tour/browser.json`, AU4 `browser.json`).
Their diffs were saved here (`logs/*-pin-drift*.diff`) and the files restored; no pin was moved (gap m5).
Headless audio cannot be listened to: the audio smoke proves the graph, buses and cue routing, not how it sounds.

## Scorecard: the gate's five words

Mark: **at bar** (would pass a "high quality" read today), **near** (one or two owner-free fixes away), **below**
(needs content or an owner call before the word is true).

| Gate word | Mark | Why, in numbers | Evidence |
|---|---|---|---|
| Gameplay | **near** | The loop plays end to end at two resolutions (tour run 2, 88 screens). D1 section 6 scorecard: 5 of 10 rows met, 2 met but owner-pending, 2 missed (rival-duel duration on the week curve; Brand Drag's curve signature), counter coverage owner-pending (Ring of Cinders 1.6%). Only weeks 1-2 play (known owner item). | D1 "section 6 scorecard"; `stills/flow-1080-arena-hud.png` |
| Graphics | **near** | Painted title, camp and arena plate read as one game (stills). D3 widescreen proof passes at 1080p, 1440p and 21:9. 60 fps at 1440p and 4K on the slice scene (D2 7.3, 2026-10-25, RTX 4090). Against it: a results-screen overlap (M1), 354 WebGL `GL_INVALID_OPERATION` warnings (M2), a visible plate seam at 21:9 (m6). | `stills/flow-1080-main-menu.png`, `flow-1080-camp-map.png`, `d3-21x9-arena.png` |
| Models | **below** | Bodies delivered: 4 school mages (cassia, brennic, garran, iskar) and 7 enemies. The Tiro entrant falls back to Cassia (`data/animation.json:27` `rivalBody`); a camp character with no delivered body takes the procedural fallback (`body-policy.ts:43`); no Lio, Nysa or Cinder Hound body; the training dummy is procedural; the A10 manifest carries a 90-entry backlog and 3 identity-debt items. Bodies draw at 145.8 px full frame at 1080p (`u4-browser.ts:149`), small against the 1080p frame. | `assets/accepted/covenant/a10/characters.json` (`backlog`, `identityDebt`); `stills/flow-1080-arena-hud.png` |
| Animation | **below** | The A10 manifest grades itself: `animationQuality` = "incomplete candidate: distinct painted keys are not proof of an anatomically alternating gait; several leading-leg repeats remain". `smoke:u4` failed once in two runs on the frame-advance check (m7). | `characters.json` `animationQuality`; `logs/smoke-u4-run1-failure.txt` |
| Audio | **below, in flight** | AU4 engine passes its smoke (buses, compressor, limiter, ducking, cue routing). 17 cues in `data/audio.json`; the arena event kinds `down` (death), `interrupt` and `phase` have no route; no crowd, absorb raise/hold or telegraph cue; one hit sample. The owner's own triage: arena tracks high quality but looping, camp tracks weaker, effects uneven (`docs/MAGE-ARENA-PLAN.md:234`). AU4 re-cut (held run 935a3a33) is in flight in a parallel lane. | `logs/smoke-audio-tail.txt`; `audio.json` `routes` |

**In one line:** gameplay and graphics are near the bar on PC; models, animation and audio are not at "high quality"
today, and each of those three needs content (art or audio), not code alone.

## Scorecard: D3 section 6

| D3 section 6 bullet | Mark | Number |
|---|---|---|
| `game-shell.ts` under 400 lines, one module per screen, no screen file over ~500 | **met** | `game-shell.ts` 300 lines; 19 screen modules, largest `screens/camp.ts` 254 |
| HUD shows the right spell names, cooldowns and meter per school (a test per school) | **met for the three HUD schools** | `hud/school-hud.test.ts:43` Water, `:60` Fire (Heat 50/80), `:105` Air (Momentum 40/80). Earth uses the Water HUD (a practice profile over Water archetypes; START-HERE) |
| Camp screenshots at 1080p, 1440p and 21:9, no letterbox, no clipped text | **met** | `smoke:d3` `"ok": true`; `stills/d3-21x9-camp.png`. The check is "inside the viewport", so it does not catch the panel overlaps in M1 and m1 |
| Settings survive a restart and travel with the save | **half** | survives a reload (UI scale 115%, reduced motion; `smoke:d3`); travels with the save: no, Director default (known owner item, settings-with-save) |
| The owner judges menu and camp against the D4 targets | **owner** | not judged yet; the painted 4.5 art is a known owner item |

## Scorecard: D1 section 6

Census numbers are the D1 "section 6 scorecard" (2026-10-25) and 6.12 (2026-10-26); this rehearsal did **not**
re-run the census. Today's gate re-checks the "unchanged" row: goldens and the default census digests pass unedited.

| D1 section 6 bullet | Mark | Number |
|---|---|---|
| Close builds: median 45-75 s | met | fire_close 67.0 s, air_close 50.7 s |
| Close builds: reference wins 40-65% | met | fire_close 49.5%, air_close 40.0% (on the floor) |
| Close builds: hits per exchange falls | met | fire_close 2.29 -> 0.61, air_close 1.91 -> 1.30 |
| Rival-duel median in band through the ranked weeks | missed; owner-ruled 2026-10-25 (`lag-def1` behind the flag, off) | 8 steady cells under 45 s (fire_heavy w2-6, air_close w4-6) |
| Ultimates: committed rank-5 builds in band | met | fire_heavy 46.5 s, 41.5% |
| Ultimates: curve signature moves the right way | **missed** | Brand Drag neutral: tier-IV share 52.8% -> 53.5% |
| Counters: each row reaches its coverage target | owner-pending (N = 50% is a Director default) | Air Form 67.9% met; Ring of Cinders 1.6% missed; Tide Ward none castable |
| Progression: steady player 50-65% each week | met weeks 2-6, owner-pending | `lag-def1` 59.0, 60.8, 60.6, 54.4, 52.0%; week 1 47.3% |
| Progression: untrained player under 40% by week 4 | met, owner-pending | week 4: `lag-def1` 24.1% |
| Unchanged: goldens, census digests, CR-002/CR-007 parity | met | today's `npm run gate` green |

## Gap list (one list, ranked)

`owner-free`: a builder can close it without the owner; the smallest lane is named. `owner-call`: options and a
recommendation follow.

### Blocker

**B1. Animation is graded "incomplete candidate" by its own manifest.** owner-call.
Evidence: `assets/accepted/covenant/a10/characters.json` `animationQuality` ("several leading-leg repeats remain");
`stills/flow-1080-arena-hud.png` (bodies at 145.8 px full frame). The gate word "animation at high quality" is false on
its face while the manifest says this.
- (a) Accept the A10 gait for 10-31 and record it as known debt on the PC side.
- (b) Spend part of the remaining image cap (86 calls) on corrected run cycles for the four school mages only.
- (c) Code-side smoothing (foot-plant holds, cross-fade between keys) on the existing frames; no spend, partial fix.
- (d) Fold it into the D2 slice decision (painted 2.5D bodies get redone if the camera changes; D2 "Reuse audit").
- **Recommendation: (a) for 10-31, with (d) as the real answer.** D2 already says most combat art is redone if the
  slice is accepted; spending the cap on A10 run cycles first would be spent twice.

**B2. Models: fallbacks stand where named characters should.** owner-call.
Evidence: `packages/game/data/animation.json:27` `"rivalBody": "cassia"` (the Tiro entrant renders as Cassia);
`packages/game/src/body-policy.ts:43` (a character with no delivered body takes the procedural fallback); no body for
Lio, Nysa or Cinder Hound; 90-entry `backlog`, 3 `identityDebt` items in the A10 manifest.
- (a) Accept for 10-31: school mages are distinct, named rivals are not.
- (b) Generate the missing bodies (Lio, Nysa, Cinder Hound, a Tiro entrant) inside the image cap.
- (c) Give the Tiro entrant a tinted school body instead of Cassia (code, no spend), leave the rest.
- **Recommendation: (c) now, (b) only after the D2 slice pick**, for the same reason as B1.

### Major

**M1. Results screen: the collar notice overlaps the "Save / settings" button and the panel frame.** owner-free.
Evidence: `stills/flow-1080-bout-results.png` and `stills/flow-1440-bout-results.png` (the "The collar loosens.
Stand ready." plate covers the bottom of the button and the right panel's lower border at both sizes; the same on the
Tiro Games result). Not caught by `smoke:d3`, which checks only "inside the viewport".
Lane: one game-only UI lane on the results layout (`CanvasUI.notice`, `ui/ui.ts:825`, and the results screen's
button column), with a red test that the notice rect does not intersect any button.

**M2. WebGL `GL_INVALID_OPERATION: glUniform4f: Uniform size does not match uniform method.`** owner-free.
Evidence: `logs/preload-results-trimmed.txt`: 354 such warnings across the 17 preload cases, on every arena entry
(training, Lab, Tiro waves); `errors` arrays empty, so it does not crash. A shader sets a `vec4` uniform with the wrong
size (or the reverse).
Lane: a graphics lane that finds the uniform (Chromium logs it per draw), fixes the type, and makes the preload smoke
assert zero `GL_INVALID_OPERATION` lines.

**M3. Audio coverage: no death, interrupt or rival-phase cue; no crowd, absorb raise/hold or telegraph cue.**
in flight, owner-free.
Evidence: `packages/game/data/audio.json` `routes` holds `perfect unlock release hit stagger roll`; the arena event
kinds `down`, `interrupt`, `phase` have none (`audio-events.test.ts` lists them as uncued). D2 section 2 "Sound gaps".
Lane: the AU4 re-cut in flight owns `audio.json` and `public/audio`; route `down` to an existing kept sample there, and
any new cue goes through ElevenLabs within the 1,000-credit floor rule (authorized). Not touched here.
Status 2026-10-27: routed with no new file, each to its kept AU4 sample (audio bible levels unchanged): `down` -> `down-a`
(-2 dB cue gain, spatial, reads as final), `interrupt` -> `interrupt-a` (-2 dB, spatial, reads as a cut), `phase` -> `phase-a`
(-1 dB, centred, one at a time with a 2 s cooldown, reads as rival escalation). Still silent (remaining): `cast` start
(`cast.start` authored, no route), crowd, absorb raise/hold and telegraph cues.

**M4. D1: Brand Drag (Brand Wrath rank 5) has no measurable curve signature.** owner-free.
Evidence: D1 6.2 / scorecard: rival tier-IV share 52.8% -> 53.5%, reference 42.0% -> 41.5%; the heavy AI casts Wrath
about once a fight.
Lane: a census reading on the PC overlay (`school-balance.pc.json`), the 6.x way, off by default, digests unchanged.

**M5. D1: counter coverage target is a Director default; Ring of Cinders sits at 1.6%.** owner-call.
Evidence: D1 scorecard "Counters" row (N = 50% Director default, owner to confirm); 6.4-6.6.
- (a) Confirm N = 50% and open a Ring of Cinders lane (unlock tier or AI use) on the PC overlay.
- (b) Lower the target for Ring (it is a close-duel counter and close duels end near its unlock) and confirm 50% for
  the others.
- (c) Drop per-row targets and judge counters only by the builds census bands.
- **Recommendation: (b).** Air Form already meets 50%; Ring's 1.6% is the unlock timing, not the spell.

### Minor

**m1. Fire HUD: "Kindled at 50" is clipped by the bottom edge of its meter panel.** owner-free.
Evidence: `stills/d3-1080p-arena-fire.png` (bottom right). Lane: `hud/school-hud.ts` meter layout, with a text-inside-panel
assertion in `school-hud.test.ts`.

**m2. Fire slots all show the same flame glyph (five slots); Water's four slots each have their own.** owner-free if
per-spell glyphs exist in the icon atlas, otherwise an art ask.
Evidence: `stills/d3-1080p-arena-fire.png` against `stills/flow-1080-arena-hud.png`.

**m3. Damage numbers stack on top of each other.** owner-free.
Evidence: `stills/flow-1080-arena-hud.png` (three "2.1" drawn over each other above the target). Lane: a vertical
offset per concurrent number in the combat-feedback number layer.

**m4. "Read the bout" focused button shows a dark notch in its top and bottom border.** owner-free.
Evidence: `stills/flow-1080-bout-results.png`, `stills/flow-1440-bout-results.png` (centre of the button's border).
Lane: the focus-ring drawing for wide buttons in the kit.

**m5. Three smoke pins drift on every run.** owner-free.
Evidence: `logs/u3-pin-drift.diff` (U3 `browser.json`: the `+2`/`+9` chip texts from 8.13/8.14 and a clock text
`7h` -> `6h`), `logs/u4-tour-pin-drift.diff` (the same chip texts), `logs/au4-pin-drift-head.diff` (AU4 `browser.json`:
same keys, `passed` true both sides, but cue order and gains move run to run). Lane: one re-pin card with the written
reason (8.13 chips) for U3/U4, and an AU4 smoke change that sorts cues and moves measured gains out of the pin (as
`a8a802fc` did for U4).

**m6. 21:9 arena: the flat stone surround and the seam where the painted plate ends are visible.** owner-call.
Evidence: `stills/d3-21x9-arena.png` (both sides). D3 8 step 4: "Surround look: Director default 2026-10-24, owner to
confirm."
- (a) Confirm the flat surround as is.
- (b) A soft vignette over the seam (code, no spend).
- (c) Extend the painted plate (art, inside the image cap).
- **Recommendation: (b)**; (c) waits on the D2 slice like B1.

**m7. `smoke:u4` frame-advance check is flaky (1 fail in 2 runs).** owner-free.
Evidence: `logs/smoke-u4-run1-failure.txt` (`u4-browser.ts:158`, all 12 A10 body frames equal after 220 ms in the
water fixture at 1080p); run 2 passed. Either a real stall at fixture start or a too-tight wait. Lane: a tools lane
that samples frames over a longer window and records the stall when it happens.

**m8. Canvas kit (D3 4.1 A) is still "Director default 2026-10-24, owner to confirm".** owner-call, no work pending.
- (a) Confirm. (b) Reopen B (HTML overlay). **Recommendation: (a)**; 19 screen modules are built on it.

**m9. The main bundle is over 500 kB after minification (Vite warning on every build).** owner-free; no player
impact measured (preload passes, menu first paint 1.8 s). Lane: code-split the Lab and slice routes.

## Known owner items (not re-asked)

Fire/Air windup preview; settings with the save; resolution; the Lab (on the title menu, `stills/flow-1080-main-menu.png`);
the font; weeks 3-6 (title reads "WATER / THE FIRST TWO WEEKS"); 4.5 painted art and transitions; the D2 slice
(provisional pick, `candidates.json` `ownerPick` pending).

In flight elsewhere: AU4 audio re-cut (held run 935a3a33).

## Owner ruling recorded with this rehearsal

Ruling 2 (2026-10-27): trust-to-mood bands 15/40 **confirmed**. Recorded in D3 8.12 and the header comment of
`packages/game/src/ui/portrait-mood.ts` (commit `13d69ff6`). No number or constant changed.

## Files here

- `stills/` (PNG through LFS): `flow-1080-main-menu`, `flow-1080-camp-map`, `flow-1080-arena-hud`,
  `flow-1080-bout-results`, `flow-1440-bout-results`, `d3-21x9-camp`, `d3-21x9-arena`, `d3-1080p-arena-fire`.
- `logs/`: trimmed gate and smoke output, the preload summary, the three pin-drift diffs.
