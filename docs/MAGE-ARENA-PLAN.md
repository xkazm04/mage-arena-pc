# Mage Arena: the project plan

Written 2026-10-01 by the orchestrating session (Claude Sonnet 5.5) after the design contest `mage-arena` (blind, owner-only decision plus an objective review by Fable 5.1 at medium effort).
Executing agents: Codex GPT-6 Astra (implementation), Grok (images, until the quota is depleted), Fable 5.1 (reviewer at gates), the owner (the only judge of feel).
This file is the single source of truth: every session starts here (status table section g, last session-log entry section h).

## a. What we are building, in four sentences

An action RPG about elemental mages (Fire, Water, Earth, Air) of the Roman era, betrayed and locked in a magic-warded camp, forced to fight in the arena for food and equipment.
Two halves feed each other: a **camp** played on a Persona-style calendar (places to visit in time slots, relationships, schemes, loyalty) in which an LLM **Director** decides what every character does each night,
and an **arena** (diablo-style top-down real-time combat, one hand moves and one hand casts, spell tiers that unlock every 15 seconds, a mana-costed magical **absorb** with a perfect-absorb window).
One season of six weeks, six Games, four endings computed from state; the ending, the Breaking, is the absorb mechanic played as trust.
Windows first, mouse and keyboard first; a Fire TV port is a later spike only if the game ends well.

## b. The owner's direction (verbatim, 2026-10-01) and the design baseline

> "Platform should start on Windows with intense experimenting and game development there, so Death Ride can take TV dev environment in parallel. I would pick mouse and keyboard as first focus, thinking about porting options to FireTV only if the game ends well, as the complexity there is higher than we had for the racing. My feel is bending B/2 and pushing its mechanics, art style would need wider pallette of different styles to find the right direction in the beginning - always two images needed: Arena fight, Camp screen (map with places to go during time slots). For LLM engine of Director we will start on this machine with claude cli and Sonnet 5.5 medium. For other open questions from this variant: I would introduce deaths, but as very challenging aspects to plot as order is heavily guarded. Time loop I would lean into variant 1 rather with seasons."

Baseline: `docs/design/baseline-fourteen-nights/` (the chosen variant: language-model Director with a closed verb vocabulary, group calls, caps, per-item deterministic fallback, determinism by cache key,
directional absorb, spell lines that climb tiers in place, typed Parley gated by Knowings). Reference: `docs/design/reference-the-ledger/` (season of six weeks, collar tier clock, Wardstones, four endings, school identity as combat resource, the
camp board and the phrase-bank fallback; its deterministic planner is the Director's fallback). The two share one cast and setting. Objective review: `docs/judging/fable-verdict.json` and `docs/judging/scoreboard.md`.

## c. Decisions

| # | Decision | Why | Reversible? |
|---|---|---|---|
| D1 | Base is **Fourteen Nights' Director** (the model chooses each character's next verb from a closed list; code owns every number, roll and effect) on **The Ledger's season structure**. The Ledger's deterministic planner is the fallback behind the same schema. | owner direction; Fable: "give the model a job that can fail without breaking the world" | yes |
| D2 | **Time = one season of six weeks**, six Games, no repeating loops. Drop the ring reset, Echo stats and loop chronicles. Knowings, trust, reputation and mastery persist within the season. | owner direction | yes (data) |
| D3 | **Deaths exist and are very hard to plot** (section d). | owner direction | yes (data) |
| D4 | **Windows, mouse and keyboard first.** WASD move, mouse aim, left button casts the current slot, number keys or wheel pick slots, right button holds the directional absorb toward the cursor, Space rolls, Shift sprints. Gamepad is optional later. Fire TV is a post-G2 spike. | owner direction | no (scope) |
| D5 | **Stack: TypeScript.** Pure deterministic `core` (no DOM, no clock, seeded RNG), `director` (Claude CLI client, validator, planner, cache), `game` (PixiJS in the browser, desktop shell later), Vitest for tests, Playwright for screenshots and scripted play. A small Node sidecar owns model calls. | agents verify by headless simulation AND screenshots; one language across core, director and UI; the Death Ride JVM stack stays free for the TV project; a web build is also the cheapest later route to a TV | yes, cheap until W2 |
| D6 | **Director engine for development: `claude -p` (Claude CLI) with Sonnet 5.5, medium effort**; a second provider, the local Ollama model, is used for bulk soak runs. The offline planner is always present. A hosted-API provider is added behind the same interface in W14. | owner direction; subscription not API cost; bulk soak must not burn the subscription | yes |
| D7 | **Art: Grok image generation through a budgeted, gated pipeline**, a wider palette of style directions first. Every style proof is **two images: Arena fight and Camp screen (a map with places to go, with time slots)**. | owner direction | yes |
| D8 | **Roles:** Sonnet orchestrates (plans, merges, reconciles, checks the claims), Astra implements, Fable 5.1 reviews at gates, the owner certifies feel and chooses style. | owner direction | yes |
| D9 | Original names, text, art and rules only; the Roman-era elemental-mage setting is the owner's. No copying of any game, film or book. | brief | no |

## d. The death system (design intent; implemented in W10, the data model is reserved from W0)

Principle: **order is heavily guarded**, so a death in the camp is a conspiracy the player (or a rival) must assemble, not an event the dice hand out.
- **No intent kills.** The closed Director vocabulary has no assassination verb. A death is the end state of a **Plot object** with required stages; each stage is a normal intent with a hard precondition:
  1. *Means*: a successful poison or sabotage scheme (twice, different nights) plus a Knowing about the target's routine.
  2. *The Vigil*: a guardian looked away: a bribe, a distraction or a defector, which requires gold, a Knowing of the guard rota, and a rank-contested roll.
  3. *The window*: only the dusk of a Games eve, with the target isolated (no ally within sight) and no witness.
  4. *Cover*: a believable cause (an arena injury, a poisoned ration blamed on the camp's hunger). Without it the Vigil investigates the next day and the plotter is **executed** (a real death).
- **Odds are low even for a perfect plan** (authored target ≤ 35% success; each failed stage raises the Vigil's attention for everyone). NPC plots against NPCs are possible but rare (authored target ≤ 0.15 NPC deaths per season with no player involvement; checked by 2,000 seeded seasons).
- **Arena:** fights are not lethal by default (the Roman crowd grants missio). Lethal bouts (sine missione) can be decreed from a high tier by the Vigil's politics, as a story beat, rarely.
- **The player character:** can be the target of a Plot. A warned player (a friend who knows) can foil it; an isolated, unwarned player can die; a death ends the run with a chronicle and the ending "martyr". Open question for the owner with that default.
- **Consequences:** crackdown (the Vigil's patrols raise everyone's caps), trust shocks, quest chains, ending states. All numbers in data; a death-frequency census is a gate.

## e. Architecture sketch

```
repo/
  packages/core/        pure TS, seeded RNG, fixed-step arena sim, camp state, intents, effects, saves. No DOM, no Date.now, no Math.random.
  packages/director/    Director client (claude CLI, ollama, offline planner behind one interface), validator, caps, cache, prompts, cost guard
  packages/game/        PixiJS app: arena scene, camp scene (map and slots), Hollow Board, composition screen, Parley UI; input mapping
  packages/tools/       replayer, soak runner, fuzzers, art pipeline (Python or Node), contact-sheet builders
  assets/               accepted art with sidecars (briefs, prompts, attempts); raw is git-ignored
  docs/                 this plan, design baseline, wave notes, owner checks, pitfalls
```
Rules of the architecture: the core never sees a sprite; the director never sees a number it may change (it sees facts and chooses verbs); every number lives in one data file; every random draw is seeded and logged;
every Director call is cacheable by a content hash; a model that is slow, wrong or absent degrades to the planner per item, never per game.

## f. Fixes owed to the design before any code (from Fable's review; wave W0 closes them)

Defects found in the chosen baseline, each concrete (Fable verdict, `docs/judging/fable-verdict.json`):
1. The cache story contradicts its own example (the loop index is "not in the key" but the example input carries it). With seasons there is no loop index: define the key from the facts the call actually sees and prove two identical inputs give one key and a changed fact gives another.
2. Worked nights do not validate against the schema or the rules (missing goal and mood fields; a repeated scheme that one night allows and another rejects; a Tent Trial on a wrong day; a Well location that the location table lacks; a cache hit claimed for a group whose members' trust changed). Fixtures must be **generated by the replayer from the tables**, never hand-written.
3. Ledger-side defects that carry over because we reuse its planner and phrase bank: the activity table has 13 rows while text says 14; two authorities for trust gain; worked-day deltas that ignore the data (hunger, aggression-gap halving, torn-to-peers); a crier validator with no banned-consequence or number-word check.
4. Anything stated in prose that the data contradicts: **the data file wins and the prose is a defect.**
5. Owner-facing: remove or rewrite everything tied to loops (Echo, ring reset, loop chronicle) and give the season calendar (six weeks, Games weekly) in data.

## g. Status table (every session updates this)

Two code streams and one art stream run in parallel worktrees; the orchestrator merges. Branch names in brackets.

| Stream | Id | Wave | Depends on | Status | Commit | Date |
|---|---|---|---|---|---|---|
| Core [`core`] | W0 | Design reconcile, season data, replayer-generated fixtures | - | not started | | |
| Core | W1 | Scaffold + Director harness (headless): state, intents, planner, validator, caps, cache, providers, soak and fuzz report | W0 | not started | | |
| Arena [`arena`] | W2 | Arena kernel on mouse and keyboard: fixed step, movement, aim, one spell, directional absorb and perfect window, collar clock, dummies, bots, screenshots | - | not started | | |
| Arena | W3 | Water: five spell lines and branches, composition screen, collar tier clock in play | W2 | not started | | |
| Arena | W4 | Enemies, AI mage on the same kernel, Tiro Games waves, 2,000 seeded fights per wave | W3 | not started | | |
| Core | W5 | Camp screens: season map, time slots, eight places, Hollow Board, night act that hides model latency | W1 | not started | | |
| Core | W6 | Parley (typed role-play at Knowing moments) with injection suite and offline cards | W5 | not started | | |
| Core | W7 | Season integration: weeks 1-2 playable end to end, save/load, **Gate G1 (owner plays)** | W4, W6 | not started | | |
| Arena | W8 | Fire, Earth, Air schools | G1 | not planned | | |
| Arena | W9 | Tiers II-IV, Summa, the mage semifinal, lethal-bout hooks | W8 | not planned | | |
| Core | W10 | Deaths and the Vigil: Plot objects, crackdown, executions, death census | G1 | not planned | | |
| Core | W11 | Arcs depth, quests and linter, economy over six weeks | G1 | not planned | | |
| Core | W12 | Endings: the Breaking duet, champion, betrayed, revolt, martyr | W9, W10, W11 | not planned | | |
| Core | W13 | Art integration | A2-A5 | not planned | | |
| Core | W14 | Cache pre-warm, hosted-API provider, cost guard | W11 | not planned | | |
| Core | W15 | Release candidate, balance report, **Gate G2** | all | not planned | | |
| Art [`art`] | A1 | (done 2026-10-02, owner chose Tessera & Lime) Style exploration: at least eight directions, **two images each (Arena fight, Camp map with time slots)**, a combined board | - | not started | | |
| Art | A2 | 16 portraits and expressions in the chosen style | A1 owner choice | not planned | | |
| Art | A3 | Top-down figures, poses, spell effects | A1 owner choice | not planned | | |
| Art | A4 | Camp map final, backdrops, story cards, Hollow Board frames | A1 owner choice | not planned | | |
| Art | A5 | Icons, HUD, spell-line icons | A1 owner choice | not planned | | |
| Audio [`audio`] | AU3 | Full arena scores C and D, normalized copies, section/cell indices, sustain/sting candidates and r4 proof | D39 | delivered for review; adaptive musical gates pending; A deferred by cap/floor | 7e7a9ed, 3b304b8 + final handoff | 2026-10-04 |

## h. Wave cards

Rhythm of every wave: design note first (`docs/waves/<id>-*.md`), data first, tests with content assertions, a green gate, a status row and a session-log entry, an `OWNER-CHECKS.md` entry for anything only the owner can judge, one commit. A gate with no command is `unverifiable`; a number not measured is `not measured`.

### W0 Design reconcile (docs and tools, no engine)
Read the baseline design and Fable's verdict. Produce the **reconciled design** under `docs/design/reconciled/`: season calendar (six weeks, Games weekly, day slots) in `data/season.json`; loops removed; deaths reserved in the data model (Plot object, Vigil attention, Executed state) with no gameplay yet; every defect in section f fixed or explicitly logged; the data files become the only authority.
Build the **replayer** (`packages/tools/replay`): it applies Director output to a CampState using only the tables and produces golden nights, so worked nights are generated, never typed. Gate: the replayer reproduces three nights with every delta derivable from a table; a consistency checker (script) finds zero contradictions between prose, tables and fixtures; a mutation test proves the checker fails on a planted contradiction.
Fable 5.1 reviews the reconciled package at the end (the orchestrator dispatches it). Kill: none (docs).

### W1 Scaffold and Director harness (headless, the hardest claim first)
Create the TypeScript monorepo (pnpm or npm workspaces, Vitest, strict TS, ESLint). Implement CampState, the closed intent vocabulary, the utility **planner** (fallback), the **validator** (schema, closed vocabulary, camp caps, per-item rejection and fallback), the **cache** (content-hash key over exactly the facts the call sees), the **cost guard** (per-run and per-day call caps, failed calls counted), and the providers: `claude` (spawns `claude -p` with Sonnet 5.5, medium effort, structured output via `--json-schema`, minimal settings, no tools, a hard timeout, one call per group, JSON validated by us), `ollama` (local 27B, for soak), `planner` (offline).
Verify the CLI flags on this machine first (`claude --help`; `--bare`, `--json-schema`, `--tools`, `--model`, `--effort` exist) and record the exact invocation and its latency.
Gate (all measured, written to a report): golden nights from W0 replay exactly; **500-case fuzz** of malformed, hostile and out-of-vocabulary outputs: the validator never lets an invalid item through and the planner fills it; **300 nights with the local model** (and **30 nights with Sonnet 5.5 medium**, to protect the subscription): rejection rate, latency p50/p95, in-character check by a judge model (Sonnet or the local 27B, say which), and a cost report. **KILL: if more than 15% of items are rejected with the local model after prompt iteration, STOP and report; options are to shrink the vocabulary or promote the planner to the default with the model narrating only.** Blind owner read: three generated Hollow Board mornings without labels.

### W2 Arena kernel (mouse and keyboard)
Fixed 60 Hz TS core, seeded; WASD movement, mouse aim, cursor-facing; one spell (Rain Needle, a light bolt) with cooldown and cast time; **directional absorb** (right button hold, 140-degree arc toward the cursor, mana drain per second, a perfect-absorb window at the moment of impact that refunds mana and shortens the collar clock); stamina with roll and sprint; the **collar clock** (every 15 s a new spell tier unlocks); training dummies and scripted bots (including a bot that lands perfect absorbs and a bot that never does); PixiJS scene with placeholder shapes; a **Playwright harness that boots the game, drives scripted input and saves screenshots**; perf budget on this PC (60 fps with 100 projectiles).
Gate: arc, window and mana maths unit tests; the perfect-absorb bot report (hit rate versus window, mana economics); determinism (same seed, same inputs, same hash); screenshots in `docs/waves/W2-evidence/`; `OWNER-CHECKS.md` entry: absorb feel (too tight, right, too forgiving) and aim feel. Kill: none; absorb window and arc are data.

### A1 Style exploration (art stream)
Build the generation pipeline for this project, reusing the lessons and code patterns of the sister project's art pipeline (read-only: `C:\Users\kazda\kiro\firetv-deathride-art\deathride\tools\art` and its `ACCEPTANCE.md`, `STYLE.md`): versioned briefs, one-image proof before any batch, a local weekly budget guard with a stop latch on the first quota or rate-limit error, resumable generation history, deterministic gates, local vision-model grading that may only reject or route to the owner.
Produce **at least eight genuinely different style directions** for a Roman-era elemental-mage game, hand-drawn digital (no 3D), and for each exactly **two images: (1) an Arena fight (diablo-style top-down, a mage mid-cast against enemies, absorb effect, spell effects readable) and (2) the Camp screen (a map with the places to go and the day time slots)**. Directions must differ in line, palette, shading, density and mood (examples to spread across, rename freely: Roman mosaic and fresco, ink and parchment, gouache storybook, comic woodcut, dark oil-painting gritty, flat poster screen-print, neon-ember dark fantasy, watercolour). Same prompt skeleton with only the style block changed so the comparison is fair; original designs only. Then one combined board (HTML contact sheet) and a ranked shortlist by the local grader as input only. The owner chooses; record the choice in `art/OWNER-CHOICE.md`.
Budget: about 40 images (8 styles x 2 images x about 2 attempts), cap 120, stop on the first quota error; report spent and remaining. No videos.

### W3 onward (summary; cards are written when the wave is reached)
W3 Water spell lines (five lines, branches, Flow, composition screen, DPS-per-15-s linter). W4 enemy roster, AI mage competence ladder on the same kernel, wave director, 2,000 seeded fights per wave within duration bands. W5 camp scenes: the **season map** (places as nodes, time slots, travel costs), eight places with their gains, the Hollow Board with cards, a playable **night act** that hides the Director's latency. W6 Parley: typed role-play only at Knowing moments, output through code checks, 100-case injection suite, offline authored cards. W7 integration of weeks 1-2, save/load, soak, **G1**.

## i. Orchestration

The orchestrating session (Sonnet) does not write product code. It: keeps this plan current; launches Astra runs one stream per worktree with a prompt that names the wave cards; checks them hourly (alive, growth, commits, errors, Grok spend); merges streams on the `integration` branch;
re-runs the gates itself (not trusting reports); dispatches Fable 5.1 reviews at W0, G1 and G2; and hands the owner contact sheets and OWNER-CHECKS. Run directory for logs: `C:\Users\kazda\kiro\firetv\.contest\runs\mage-*`.
Worktrees: `C:\Users\kazda\kiro\mage-arena` (main), `...\mage-arena-core`, `...\mage-arena-arena`, `...\mage-arena-art`.

## j. Rules for every executing agent

- One authority per number; the data file wins over prose. Build and tests green at every commit. Never push. Never ask a question; decide, write the decision in the wave note, and continue.
- Determinism: core has no wall clock, no unseeded randomness; model output is never trusted without the validator; the model never sees or sets a number.
- Honest labels: authored, simulated, measured, felt. Nothing is "felt" until the owner says so. A claim without a command is `unverifiable`.
- Subscription care: Director development calls use the Claude CLI under the cap in the wave card; bulk work uses the local model. Image generation stops at the first quota error.
- Original content only; no names, text or art copied from any existing work. No vendor or model names in game files, assets or UI.
- The sister projects (Death Ride) may be read for patterns; never modify them, never use their Stick or app ids.
- Windows host: use PowerShell or Bash as the tools allow; paths are Windows paths; a hung child process after a finished turn is expected sometimes; the orchestrator cleans it.

## k. Open questions for the owner (each has a default so nothing blocks)

| # | Question | Default |
|---|---|---|
| Q1 | The player character dying to a camp plot: allowed? | Yes, rarely, only if isolated and unwarned; ends the run with a chronicle ("martyr") |
| Q2 | Arena deaths: lethal bouts decreed from a high tier as story beats? | Yes, rare, from Tier III upward |
| Q3 | Starting character: pick one of four at the start, the other three become allies/rivals who share the bond arc? | Yes |
| Q4 | Desktop shell: browser window first, Electron or Tauri at packaging? | Browser first; decide at W14 |
| Q5 | Typed role-play (Parley) scope? | Only at Knowing moments, via the Director, with offline cards |

## m. Art and camera direction after A1 (owner, 2026-10-02)

> "Looking at the styles, in terms of feasibility of arena battles many can be a problem to achieve. The arena camera angle is too close and characters too large then to be playable or fit to decide. Lets go with Tessera & Lime as the baseline. For arena and camera imagine Diablo or Path of Exile to set up camera, distance, larger spacing. Attempts like 02-salt-ink-arena-a01, 08-rain-wash-arena-a01 are one step towards the idea."

Decisions: **D10** the visual baseline is **Tessera & Lime** (style id `01-tessera` in `art/styles/a1-v1.json`); **D11** the arena camera follows the **Diablo / Path of Exile framing**: a high, distant, near-top-down camera (roughly 45-60 degrees of tilt), the whole fight readable at a glance,
a character about 4-6% of the screen height (a mage about 60-90 px tall at 1080p), enemies and projectiles clearly separated, wide spacing between combatants, an arena that is several screens of fight space wide, spell effects and the 140-degree absorb arc readable at that scale, telegraphs bigger than the figures. The A1 arena images were too close and too large; attempts 02 and 08 are the nearest framing.
The arena kernel (W2-W4) and every arena sprite must be authored for this camera and scale: a **scale contract** (metres per pixel, mage height in px, arena size, camera zoom range, minimum readable telegraph size) is the first deliverable of W4b and of A1b.

| Stream | Id | Wave | Depends on | Status |
|---|---|---|---|---|
| Art | A1b | Tessera & Lime baseline: scale contract and **arena camera proofs** (Diablo/PoE framing, three camera distances, several arena layouts), camp map re-check | A1 owner choice (done) | not started |
| Art | A2 | 16 portraits and expressions in Tessera & Lime | A1b | not started |
| Art | A4 | Camp map final, backdrops, story cards, Hollow Board frames | A1b | not started |
| Art | A5 | Icons, HUD, spell-line icons | A1b | not started |
| Art | A3 | Oblique-view figures (upright, about 55 degrees elevation, NOT straight 90-degree top-down), poses, spell effects at the confirmed scale | owner confirmed the camera 2026-10-02 (`art/CAMERA-OK.md`: open-oval-sparse-near-a01, near distance) | not started |
| Arena | W4b | (camera confirmed: near distance, open oval) Camera and scale pass: PixiJS camera, scale contract, arena layout wide enough, readability of telegraphs and the absorb arc at distance, screenshots at 1080p and 1440p | A1b, W4 | not started |

## n. Character and arena identity reset (owner, 2026-10-02, after the A3 board)

> "The character manifestation in arena does not look very natural. Main blue caster in center looks authentic to the artstyle, with size, angle, style. All others look like they don't belong there, rather belonging on papyrus paintings. The style of characters is too clean and generic - we should find our own raw and brutal tone like Death Race did to find identity of the arena character styles and environment in arena. Mages in arena are not politicians, but well equiped magicians knowing the battlefield, overpowering with sparkles and energy around them caused by their elemental alignment. We took the roman culture as worldbuilding baseline correctly, but now we should go into more raw and magical/fantastical direction to create our own flavor of the world. Throw all portraits and current looks of key characters and start again - portraits can have more aura of old Baldurs Gate games. Clothing more fitting RPG mages known - staff, accessories, lightweight colored cloth designs."

Decisions: **D12** all A2 portraits and all A3 figures and poses are **discarded** (kept in git history only, never used). **D13** the bar for in-arena figures is the **blue hooded caster in the chosen proof `01-tessera-open-oval-sparse-near-a01`**: its size, angle, rendering and integration with the ground.
**D14** Roman culture stays as the worldbuilding baseline (the camp, the Games, the legion as non-magical enemy waves), but the **mages and the arena get their own raw, magical, fantastical identity**: not clean, not generic, not museum-painting.
**D15** the mages are **battle mages, not politicians**: well equipped, knowing the battlefield, overpowering, surrounded by **sparkles and energy of their elemental alignment** (fire embers and heat shimmer, water mist and droplets, earth stone motes and dust, air wind wisps and arcs of lightning); **staff, accessories, light coloured layered cloth** as in classic RPG mages;
**portraits with the aura of late-1990s painted CRPG bust portraits** (rich, dark, painterly, strong light, characterful faces), original designs only, no franchise names in prompts or files. The method of the sister project's art direction v2 (rough ink-brush line, wear everywhere, silhouette first, palette discipline, a CHOICE of directions before commitment) is the pattern: read `C:\Users\kazda\kiro\firetv-deathride-art\docs\concepts\DEATH-RIDE-ART-DIRECTION-V2.md` as a method, never as a style to copy.

| Stream | Id | Wave | Depends on | Status |
|---|---|---|---|---|
| Art | A6 | **Identity reset**: at least six raw-magical style directions for the arena mages, enemies and arena environment, each shown as (1) an arena scene at the confirmed near oblique camera and (2) a late-90s CRPG-style painted bust portrait of the Water mage; the owner chooses | D12-D15 | not started |
| Art | A2b | New portraits (16 cast, expressions) in the chosen direction | A6 owner choice | blocked |
| Art | A3b | New oblique figures, poses, spell and aura effects in the chosen direction, enemies included, finishing the three missing creatures with moderation-safe prompts | A6 owner choice | blocked |
| Art | A4b | Camp map and backdrops re-checked against the new identity (the camp map is kept unless the owner says otherwise) | A6 owner choice | blocked |

## o. Art direction v3, camera and UI as art (owner, 2026-10-02, after the A6 board and the G1 build)

> "Regarding the art direction, I think 02, 03, 04 share similar artistic baseline for fidelity, characters. They can be combined and provide variations of arenas as each is dominated by different color pallette. Even 01, 05, 06 arena styles can be added, yet the artstyle there is too grainy, looking like page in a book which is a difficult world where to place moving characters and spells. All concepts are very cool, 04 is my portrait winner. For the game itself - I think camera distance and angle from art proposals are better than our current in game. More distance, so camera will move rarely only if player on the edge. The HUD is greatest pain - I guess because it should be part of art package - game feels like browser page wrapping screenshot in the center. At this point the quality is in shape as a player I don't want to interact with it at all. We will need to emphasize more into applying art into all parts of the game, trying to achieve videogame quality in TV interface. If grok reaches image limits, we can use 'agy' cli for gemini and create concept art, textures with Nano Banana 2. Not sure about its capabilities around editing."
> "the art decision will have impact on HUD, current city art too."

Decisions:
- **D16 Art baseline = the "Covenant family": A6 directions 02 Verdigris Covenant, 03 Ragged Oracle and 04 Moonchalk Tempest merged into one style bible** (one fidelity, one way of drawing characters, enemies, effects and surfaces) with **arena variants by palette** (verdigris green, rust and sand, moonlit blue-black), each a different arena the player visits. Directions 01, 05, 06 may be added as further palette variants only if the grain is removed: the owner rejects the paper-and-book texture because moving characters and spells do not read on it. **Portraits follow 04 Moonchalk Tempest** (the owner's winner), in the late-1990s painted CRPG bust mood.
- **D17 Camera = the distance and angle of the art proposals** (A1b far/standard and the A6 scenes), not the current in-game near camera: more distance, a mostly **fixed camera that moves rarely, only when the player approaches the edge of the view** (a wide dead zone, soft edge follow, no constant tracking). The scale contract is rewritten for it (figures about 3 to 4.5 percent of screen height at 1080p, readable by silhouette, aura and effect, so the figure design must carry identity at that size).
- **D18 The camp ("city") art and the HUD follow the new style.** The A4 camp map, backdrops, story cards and Hollow Board frames and the A5 icons and HUD are superseded; they are redone in the Covenant family (palette variants for the different times and places). The earlier "camp map is kept" decision is withdrawn.
- **D19 UI is part of the art package and the game is a video game, not a web page.** Full-screen canvas game (no browser page look: no HTML panels floating over a screenshot, no dropdowns, scrollbars, default fonts or form controls); every screen (main menu, camp, season map, Hollow Board, journal, Parley, composition screen, arena HUD, pause, results, save and load) is built from an **art-directed UI kit**: frames and nine-slice panels, bars, spell slots, the collar rune clock, cursor, buttons, tabs, tooltips, iconography, typography with a game feel, animated feedback. Layout and type sizes are **TV-grade** (readable from a sofa distance, generous safe areas, large touch-free targets, full keyboard and gamepad navigation) while mouse and keyboard remain the first input. Quality bar: a player wants to interact with it.
- **D20 Image providers: Grok and the Antigravity CLI (`agy`, Nano Banana 2) behind one provider interface, each with its own budget guard and stop latch (probed 2026-10-02: see docs/PROVIDER-LEDGER.md; the owner is signed in)** (was: Grok first, agy fallback) for concept art and textures when Grok's allowance ends. `agy` is installed at `C:\Users\kazda\AppData\Local\agy\bin\agy.exe` (not on PATH, version 1.2.15) but **not signed in** (the owner must log in once); its image-generation and **image-editing capabilities are unverified**, so the first fallback task is a measured capability probe (generation, reference-guided generation, editing an existing sprite, transparency, consistency across a set) recorded in a provider ledger. Providers sit behind one interface with a budget guard each; a refusal or an unavailable provider routes to the next (registry: `generative-provider-routing`).

| Stream | Id | Wave | Depends on | Status |
|---|---|---|---|---|
| Art | A7 | **Covenant bible**: merge 02/03/04 into one style bible and three arena palette variants, rewrite the scale contract for the far fixed camera, remove the grain, keep the Moonchalk portrait as the portrait bar | D16, D17 | not started |
| Art | A3c | Figures at the new camera: four mages with staff, accessories, light coloured cloth and elemental energy; the enemy roster; spell and aura effects; designed to read at 3 to 4.5 percent height | A7 | not started |
| Art | A5b | **UI kit**: full HUD and menu kit in the Covenant style (nine-slice frames, bars, spell slots, collar rune clock, cursor, buttons, tabs, typography, icons) as engine-ready atlases | A7 | not started |
| Art | A4c | Camp ("city") map, backdrops, Hollow Board frames and story cards in the Covenant style | A7 | not started |
| Art | A2c | Cast portraits in the Moonchalk Tempest style (the four mains first, then the rest) | A7 | not started |
| Game | U1 | **Camera and UI overhaul**: far fixed camera with edge follow; full-screen canvas UI framework with the nine-slice kit loader (placeholder kit until A5b lands); rebuild the HUD, main menu, camp, Hollow Board, journal, Parley, composition, pause and results screens as in-game art-directed screens; TV-grade layout; keyboard, mouse and gamepad navigation; screenshots at 1080p and 1440p | D17, D19 | not started |
| Art/Game | P1 | Provider probe (done 2026-10-02, see docs/PROVIDER-LEDGER.md) | owner login | done |

## p. Audio direction (owner, 2026-10-02): philosophy first, then ElevenLabs for the game effects

> "We created in another project with ElevenLabs couple of samples and via report like C:\Users\kazda\kiro\garden-vr\docs\audio\audition\r2\index.html I can triage directions and themes to pick, I suggest to do similarly here so we establish the philosophy and then use ElevenLabs to cover the game effects."

Pattern to follow (read-only): `C:\Users\kazda\kiro\garden-vr\docs\audio\` (`AUDIO-BIBLE.md`, `CHOICES.md`, `audition/r2`, `audition/r3`) and the generation tool `C:\Users\kazda\kiro\garden-vr\tools\audio\elevenlabs.mjs` (credit guard with a reserve, a committed ledger, sidecar JSON per asset, retry on 429, API key read from an `.env`, never printed or copied).

**Decisions.** **D21** audio is established as a **philosophy first** (an audio bible), then a **blind-ish audition report** (an HTML page with a player per sample, grouped by direction and theme, like the garden-vr report) from which the owner triages; the owner's choices are recorded in `docs/audio/CHOICES.md` and **outrank** the bible where they differ. **D22** ElevenLabs is the generator for SFX, music and any voice; every call goes through the project copy of the guarded tool. **D23** **the ElevenLabs account is shared with the garden-vr project**: on 2026-10-02 it is the starter tier with **43,319 of 90,000 credits remaining, resetting 2026-10-04**; the tool's reserve of 8,000 stays; **Mage Arena's audition budget is at most 12,000 credits** (cost model from the garden-vr ledger: SFX about 40 credits per second with a minimum of 100; measure music and voice per call with a proof first), and the production budget is set after the owner's choices and the reset. **D24** audio philosophy inputs: the collar tier clock (a new spell tier every 15 s) is the spine of the **adaptive arena music** (layers or intensity tiers that follow the collar, a mana and absorb accent on perfect absorbs); the camp is a **place with time** (day, dusk and night beds, per-place ambience, the Hollow Board and Parley voices); **UI sounds are part of the UI kit** (menu, confirm, deny, slot select, tab, tooltip, save); SFX identity per element (fire, water, earth, air) and per event (cast, travel, impact, absorb, perfect absorb, hit, roll, collar rune tick, crowd). Registry notes to read (read-only): `ai-registry\knowledge\game-production\asset-production\motion-and-audio\adaptive-music-authoring` and `spatial-audio-scene-authoring` (priority, concurrency and cooldown table, transition quantisation, voice budget, loudness targets) and `ai-registry\knowledge\media-generation\audio-generation`.

| Stream | Id | Wave | Depends on | Status |
|---|---|---|---|---|
| Audio [`audio`] | AU1 | **Philosophy and audition round 1**: audio bible (pillars, palette of sound, mix and priority rules, adaptive music design tied to the collar clock, loudness targets); the project ElevenLabs tool with ledger and credit guard; about 30 to 40 samples across directions and themes; the audition report; stop for the owner | D21-D24 | not started |
| Audio | AU2 | Round 2 refinement of the chosen directions (variants inside the chosen family), narration or bark voice if wanted | AU1 owner choice | blocked |
| Audio | AU3 | Production set: the full effect list per element and event, the music set (title, camp day/dusk/night, arena per palette, win and loss stingers, adaptive layers), UI sounds, ambiences; loudness-normalised, loop-checked, sidecars and ledger | AU2 | blocked |
| Game | AU4 | In-game audio engine: WebAudio mixer with buses, priority, cooldown and concurrency limits, ducking, adaptive music following the collar tiers and absorb events, UI sounds from the UI kit, volume and mute settings, tests for the priority table | AU3 or placeholders | not started |

## q. Owner review of the U2 gallery and audio round 2 (2026-10-03)

**A. Evidence gallery (owner's notes, condensed; full text in the chat record).**
- The strongest parts are the non-combat art outputs: the city (camp) and the characters (portraits) are **production quality**; most choices there are liked.
- **City map:** buttons must not show function or time to reach. **Time is measured in hours; only actions inside a facility are charged against the day** (travel is free). A more creative, rendered **daily clock** that increases and decreases from there. **Icons for stats (gold, reputation, fatigue) in the top-right header**, generated art.
- **Spells and effects art** is one of the key gaps: inconsistent with what the approved concept art tried to achieve.
- **The arena is the weakest part**: it degraded painfully from the approved concept; the quality of the arena structure, objects and surface is the first visible change. Most painful is the **design of the characters and their one-axis movement**: the design and execution fit the art style, but **high fidelity of their assets and spells** is key to the game looking and playing well.

**B. Audio round 2 (owner triage).** Kept: arena C "Reed oath", arena D "Lyre under iron", air B "Hollow Vortex" (air C maybe: `air-C-spiral-filament` usable for a different air spell, `air-C2` not clear enough), camp A "Thread and Reed" (day, dusk, night), hit and impact A "Hide and Slate", collar rune B "Stone Waking", UI B "Rune Ceramic" (all five), the kept fire A and water B variations. Rejected: absorb A, B and C (A "sounds like a notification, we need to mirror the feel of an energy barrier stopping and slowing down another energy source"; C "like a cartoon effect, no elemental or natural element in the sound"), camp B, title A and B ("the style is the same as the camp menu; lean into the melodicity of the arena music but keep the calm tone"), hit B, collar A, roll A and B (A: "the first sound in the track is great, it sounds like a step in sand, the second one breaks it"), crowd A and B (A "sounds like soccer fans, we need more raw and bloodlust fans of a colosseum arena"), UI A. Overall: **the arena background tracks are of high quality; we need to escape the loop and create full 2 to 3 minute tracks; the camp tracks do not share that quality and capability to become long tracks. Effects vary in quality and execution: calm them on the app side, not in the audio generation tool.**

Decisions: **D25** the camp time model becomes **hours**: a day has a number of waking hours (data), actions inside a facility cost hours, **travel between places is free**, places open and close at hours, the phases (day, dusk, night) are derived from the hour, the night act stays at the end of the day; the Director's inputs state time in hours; all fixtures regenerate from the replayer. **D26** camp UI: place buttons show **only the place name** (no cost or time text); a header with generated **icons for gold, reputation and fatigue** at the top right; a **creatively rendered daily clock** that advances and decreases with the hours spent (design left to the art and game streams: for example a collar-rune dial, an hourglass or a water clock in the Covenant style). **D27** art priorities, in order: (1) **spell and effect art** matching the approved concept (per element, cast, travel, impact, the absorb as an energy barrier, auras), (2) **the arena restored to the approved concept quality** (ground, rim and structures, objects, surface, three palettes) at proper resolution, (3) **characters at high fidelity with real directional movement** (multi-direction idle, run, cast, absorb, hit, death for the four mages and the enemy roster), (4) the stat icons and the clock art. **D28** audio picks as above; they outrank the bible. **D29** produce **full-length arena tracks (2 to 3 minutes, not loops)** in the kept directions (arena A, C, D) when the shared ElevenLabs account resets (2026-10-04 19:31 UTC; music costs about 30 credits per second, so a 150 s track is about 4,500 credits); the camp tracks need a different approach (re-direct, or the Google audio services) because the kept camp direction does not extend well. **D30** **effects are calmed on the app side**: per-sound gain trims, a high-cut filter, compression and limiting, randomised pitch and volume variation, concurrency and cooldown limits, ducking under music and voice; the audio engine owns this, not the generator.

| Stream | Id | Wave | Depends on | Status |
|---|---|---|---|---|
| Art | A8 | **Spell and effect art** in the Covenant style matching the approved concept: per element cast, travel, impact, the absorb as an energy barrier arc and its perfect-absorb flare, auras, telegraphs, hit sparks; sheets and loops that read at the far camera | D27 | not started |
| Art | A9 | **Arena restoration**: ground, rim, structures, banners, props and surface at proper resolution, matching the approved arena concept, in the three palettes, with tiling or tiled-by-design ground where needed | D27 | not started |
| Art | A10 | **Character fidelity and direction**: four mages and the enemy roster with real multi-direction animation sets and a consistency pipeline | A8 | not started |
| Art | A11 | **Stat icons (gold, reputation, fatigue) and the daily clock art** | D26 | not started |
| Game | U3 | **Time model in hours (D25), camp UI changes (D26)**: core data and tests, replayer fixtures regenerated, Director inputs in hours, place buttons by name only, header with the stat icons (placeholder until A11) and the rendered clock | D25, D26 | not started |
| Game | AU4 | **Audio engine** with buses, priority, concurrency and cooldown limits, ducking, the app-side calming of effects (D30), music playback with crossfades and the collar-tier adaptive layers, UI sounds, volume settings; uses the kept samples through a manifest | D28, D30 | not started |
| Audio | AU2b | Regenerate the rejected categories: absorb as an energy barrier stopping and slowing an energy source (elemental, natural, not a notification, not cartoonish), the title theme (melodic like the arena music, calm), roll (single sand step), crowd (raw, bloodlust colosseum), collar rune alternative if needed | D28 | not started |
| Audio | AU3 | Full-length 2 to 3 minute arena tracks in the kept directions, after the credit reset; camp music re-direction | account reset | blocked |

## r. Owner review of the A12 plates and U4 build (2026-10-03): plates accepted, figures bigger, combat feel is the focus, sigils redone

> "1. Wire the plates, it will be acceptable for now. 3. Figures are small, 50% increase of them would help. We will focus then primarily on gameplay mechanics, first how it feels on PC as I see the combat now as the weakest point. After plates guide me how to start the game, extend training mode against dummy to set one opponent too and I will go through. One piece which did not go through art transformations are sigils, they look like geometry in elementary math, not following artstyle nor any feel of magicality."

Decisions: **D31** the A12 plates are accepted for now and are wired into the game (the plate-based arena with the compact-layout step, the occluder sprites with base lines, palette per tier). **D32** characters are drawn **50% larger** (figures about 5.6 percent of screen height at 1080p instead of 3.75; the scale contract is versioned, the camera distance and arena layout are re-checked so the fight still reads and the plate geometry still works; the A10 masters are 384 px so there is headroom). **D33** the primary focus becomes **combat feel on PC with mouse and keyboard** (the owner sees combat as the weakest point): a **Combat Feel Lab** training mode with a dummy and **one selectable opponent** (a mage AI of a chosen school and competence), live-tunable parameters, a reset and metrics, so the owner can play and give feedback; then the improvements it shows are needed (hit feedback, cast timing, movement, absorb feel, enemy behaviour and telegraphs). **D34** **sigils are redone as art**: the casting circles, telegraph marks (ring, cone, line, area, unblockable), the ward and absorb geometry, the perfect-absorb window mark and the rune glyphs currently read as geometry from elementary mathematics; they must follow the Covenant style and feel magical (painted rune circles with glow, wear and elemental character, animated), while the exact hit geometry stays authored in data.

| Stream | Id | Wave | Depends on | Status |
|---|---|---|---|---|
| Game | U5 | Wire the A12 plates (compact layout, occluders, palette per tier) and figures 50% larger (scale contract v3, camera and layout re-check) | D31, D32 | not started |
| Game | CF1 | **Combat Feel Lab**: training mode with a dummy and one selectable opponent, live tuning, reset, metrics, replay of the last bout; the owner's start guide | U5 | not started |
| Game | CF2 | Combat feel improvements from the Lab findings: hit feedback (hit stop, flash, shake, knockback, numbers), cast and animation timing, movement feel, absorb and perfect-absorb feel, telegraph readability, enemy behaviour; data-driven; census bands re-set where gameplay changes | CF1 | not started |
| Art | A13 | **Sigils and telegraphs as art** (D34): casting circles per element, telegraph marks, the absorb and ward rune geometry, the perfect-absorb mark, rune glyph alphabet, animated decal sheets | D34 | not started |

## s. Owner review after the Combat Feel Lab build (2026-10-04): sigils wired, hit reactions, defeat, full-length tracks

> "2. Wire the sigils, together with other screens on board we improved significantly. ... Next step would be to introduce reactivity after hits, the characters will need to visibly struggle, any hit interrupting cast and movement for very quick moment, prepared audio tracks, we should still have some credits and you can charge above your threshold together with point 3. If character defeated it also needs animation to lay down and stay there."

Decisions: **D35** the A13 sigils (casting circles, threat decals with progress fill, the ward and absorb rune work, the perfect-window ring, floor decals, selection and status sigils) are wired into the game behind the loader boundary, and every screen is brought up to the level of the improved boards (use all delivered art consistently: plates, effects, characters, clock, icons, sigils, portraits). **D36** **hit reactivity**: any hit that deals damage **interrupts casting and movement for a very short moment** (data-driven hit stun, about 0.10 to 0.20 s, scaled by damage with a floor and a ceiling, a stagger-immunity tail so there is no stun-lock, roll invulnerability respected, heavy enemies with more poise), with a **visible struggle** (flinch and stagger animation, recoil offset, flash, sound hook), for the player and every opponent; cancelled casts keep the spent mana and cooldown as the Lab already records. **D37** **defeat**: a defeated figure plays a death animation, **lies down and stays there** for the rest of the bout (a persistent corpse pose, drawn on the ground, depth-sorted, no collision, no targeting, no AI), as a state tag read by every system. **D38** the missing character clips are generated, hit and death first (all entities, all directions, including a lying final pose). **D39** the owner authorises the **full-length arena tracks now** and **spending the shared ElevenLabs credits below the earlier 8,000 reserve** (the account was 10,689 at 11:13 on 2026-10-04 and resets at 19:31 UTC the same day); keep a floor of 1,000 credits; Reed oath (arena C) first, then Lyre under iron (arena D), then Hide and iron (arena A) if credits remain; the camp tracks and the round-3 picks stay open.

| Stream | Id | Wave | Depends on | Status |
|---|---|---|---|---|
| Game | U6 | Wire the A13 sigils and bring every screen up to the improved boards | D35 | complete; U6 report and evidence |
| Game | H1 | Hit reactions (D36) and defeat (D37) in the simulation, animation selection, Lab tuning parameters, tests, census | D36, D37 | complete; H1 report and evidence |
| Game | U6b | Wire the new character clips and the full-length tracks when delivered | D38, D39 | complete for landed gated deliveries; U6b report lists pending assets |
| Game | U6c | Rewire A14.3 reactions, persistent corpses, extra motion and creature Lab targets | A14.3, H1 | complete for landed delivery; U6c report/evidence and exact remaining fallback table |
| Art | A14 | Missing character clips, hit and death first (all entities, all directions, a lying final pose), hit-light and hit-heavy flinch, then the remaining clips and creature front views | D38 | A14.3: 180 priority + 46 additional clips integrated in U6c; 12 priority + 12 other gaps remain |
| Audio | AU3 | Full-length 2 to 3 minute arena tracks (C, D, then A), loop-free, aligned to the collar clock; layers or cut points for the adaptive engine | D39 | full C/D delivered; A and adaptive certification pending, U6b audit |
| Art | A14.1 | Hit-light, hit-heavy, collapse and persistent lying poses | D36-D38 | 124/192 slots; 68 explicit missing; owner-review; commit containing A14-1 note |
| Art | A14.2 | Remaining clips, creature views and cheap gait corrections | A14.1, D38 | BLOCKED generation; 18-loop audit complete, no safe correction; 58 non-reaction slots missing; zero spend |
| Art | A14.3-1 | Session 10 humanoid completion | D36-D38 | 128/192 total; all humanoid priority slots present; gates pass; 2 new charges, 344 total; owner-review |
| Art | A14.3-2 | Session 10 creature collapse and reactions | D36-D38 | 180/192 priority slots; 12 bounded-attempt gaps; 22 session charges, 364 total; owner-review |
| Art | A14.3-3 | Session 10 creature motion and remaining legacy clips | D38, A14.3-2 | 226 clips: 180 priority + 46 other; 12 + 12 explicit gaps; 40 session charges, 382 total; gates pass; owner-review |

## l. Session log

(each run appends: wave, date, what changed, commands with results, what is `not measured`, next wave)

**ART session 9 / A14 stage 2 / 2026-10-04:** Existing-pixel audit complete; generation BLOCKED. Inspected all 18 inherited ne/se run strips (14 six-key, three five-key, one three-key). No safe cheap opposite-stride correction exists in the inspected keys; Hush moth already has raised/lowered wing poses. No animation changed. Exact queue: 68 priority A14 slots, then 58 other legacy slots; the full 84-slot legacy backlog overlaps 26 priority hit/death slots. Creature front views remain missing. Zero calls/charges, total still 342/450; both latches retained. `python tools/art/a14_gait_audit.py` verifies 73 stage-1 delivery/ledger files unchanged and produces the [owner board](../art/review/a14/stage2.html), findings and queue. Stage-2 browser checks cover 1920, 2560 and 390px widths. Owner animation quality, game integration and provider account allowance remain unmeasured. Stage 1 committed as `3c4f4a9`; this stage has its own local commit. Next: restore provider availability under the retained guards, then finish priority reactions before other clips; no push.
**AU3 / AUDIO session 4 — 2026-10-04:** D39 executed now, without waiting for reset: one 150 s six-section music_v1 composition each for Reed oath then Lyre under iron. Raw MP3s remain untouched; 48 kHz PCM derivatives are exactly 150 s at -25.99/-26.00 LUFS, below -1 dBTP, with no clipped samples. Delivered six section cuts, ten cell indices and tier map per track, 15 s sustain candidates and 5 s sting candidates, full provenance, r4 triage, updated investment proof and engine manifest. Separate commits: `7e7a9ed` C, `3b304b8` D; final handoff follows. No push.

Cost: 4,500 per track, observed shared immediate/settled deltas matching 30 credits/requested second; **9,000/10,000**, last balance **1,689**, floor **1,000**. Nine HTTP requests all succeeded, minimum pacing 8.004 s, no 429/quota error or pending reservation. Budget closed. A cannot fit at 150 s (4,500) or 90 s (2,700): 1,000 job credits and 689 balance headroom remain. No retry, camp, Google or round-3 generation. Choices updated only with generation facts.

Gates: `node --test tools/audio/guard.test.mjs tools/audio/guard-r4.test.mjs` 28/28; `python tools/audio/process-r4.py <track-id>` both tracks; `python tools/audio/evidence-r4.py` 18 measured/provenanced derivatives; `python tools/audio/build-reports.py`; `python tools/audio/check-reports.py` passes 73 original hash/sidecar/ledger checks, exact section reconstruction, mastering, ten-cell indices, numerical three-repeat seams, and desktop/phone light/dark browser playback/triage/export with no overflow or JS errors. Evidence: `docs/audio/evidence/r4/validation.json`. Both internal-boundary attack screens pass 9/9 at <=10 ms; onset periodicity estimates 96.021 and 95.999 BPM. These are not true-downbeat certification. Musical acceptance remains **not measured**: no listening model available, so motif identity, vocal absence, six-phase development, real harmonic release, fatigue, masking, mono/small speakers and transition harmony remain owner checks. Adaptive playback defaults disabled. Next: owner r4/r3 triage and AU4 integration/acceptance; A needs a future budget authorization, camp/Google remain separate.

**Camera angle (owner, 2026-10-02): the view is oblique, about 55 degrees of elevation, never a straight 90-degree top-down.** Figures are upright billboards with visible faces and bodies; the arena ground is foreshortened. See art/CAMERA-OK.md.

**Audio proof report (owner, 2026-10-02):** when the audition cap is reached, produce `docs/audio/PROOF-REPORT.html`: everything generated, per-sample prompt, duration and credit cost, the measured cost model, a candid strength and weakness assessment per category, the extrapolated cost of a full production set, and the questions to settle before investing in a richer ElevenLabs plan versus combining with Google audio services (the owner has credits through a Google ultra plan). Evidence for an investment decision; the r1 audition report stays the triage tool.


### 2026-10-04 - GAME U6

A13 imported through the verified loader; pooled painted cast, threat/progress, ward, selection/status and floor decals. Complete native 1080p/1440p screen walk, consistent school radicals/inscriptions and corrected frame insets. Geometry coverage witnesses and fallback retained. Commands/results and measured GPU texture/performance evidence: [U6 report](waves/U6-report.md). Owner visual/TV judgment remains unmeasured. Next: H1 hit reactivity and persistent defeat.


### 2026-10-04 - GAME H1

Damage-scaled .10-.20 s stagger, immunity tail, authored poise and paid-cast cancellation
now apply to every combatant. DEFEATED is the shared serialized state tag across
activation, movement, targeting, effects, AI, projectiles and HUD. A10 reaction
selection, procedural recoil/fall, persistent corpses, audio hooks and paged Lab
Hit controls are wired. Owner guide extended. Full census, seeded before/after
metrics, save/replay and native browser captures: [H1 report](waves/H1-report.md).
Human feel and art acceptance remain unmeasured. Next: U6b fresh delivery audit.


### 2026-10-04 - GAME U6b

Read-only upstream audit: art 74b3d56, audio 8e8ab42. Imported 124 A14 reaction
slots additively with lossless packing, per-clip anchors/scale and exact-facing
persistent corpse keys. Wired full 150-second AU3 C/D masters through the audio
manifest and tier playlists; retained A preview and nonquantized whole-track
crossfades while certified adaptive transitions are unavailable. Native reaction
and audio walks, real full-track progression, performance/memory, final gate and
save/replay are recorded in [U6b report](waves/U6b-report.md). No upstream edits,
generation or push. Owner feel/listening/TV acceptance is not measured. Remaining
work: 68 priority A14 slots plus 58 other legacy requests, full A, and verified
adaptive musical boundaries/approval when those deliveries become available.


### 2026-10-04 - GAME U6c

Read-only A14.3 audit at art 82f5bc4. Four sub-waves: verified additive import,
paired collapse/corpse selection and stationary creature Lab targets, all 46
extra motion clips with creature attack presentation, then native verification.
All twelve roster bodies use delivered reactions and persistent lying sprites;
12 priority directions and 12 other motion/brace slots use explicit same-entity
fallbacks. F8 logs missing slots once. No core/director combat implementation,
combat data, tuning or save-version changes. Gate: 215 tests + 11 reference
checks, zero contradictions; game build pass. Full 8,000-fight records and
save/replay bytes equal H1. Native 1080p/1440p walks and 100-projectile/12-figure
stress: 60 fps, 325.716 MiB decoded textures. [U6c report](waves/U6c-report.md)
and [gallery](waves/U6c-evidence/index.html). Art/audio worktrees unchanged;
no generation or push. Owner animation/identity/TV/feel acceptance is not
measured. Next: the exact 24 missing slots listed in the report, then owner
creature reaction review using the new Lab selector.
**ART session 9 / A14 stage 1 / 2026-10-04:** PARTIAL: 124/192 state-direction slots. All four mages and four soldiers have hit-light/heavy in all directions; death plus persistent corpse in all directions except Garran ne/nw. Creature A14 generation remains missing. 21 generated sources, 24 charged attempts, total 342/450; Grok latched on HTTP 402 exhausted Build balance, agy on repeated pre-image HTTP 503. One agy extra-call driver repair/reset and one bounded preflight recovery are archived; no refunds. 88 tests, 49-product offline rebuild and five browser viewport cases pass. Existing 378 protected art files and inherited ledger prefix are unchanged. Owner animation/readability and game integration remain unmeasured. Commands: `python tools/art/a14_build.py`, `a14_board.py`, `a14_portable.py`, `a14_browser.py`, `a14_audit.py`; `python -m unittest discover -s tools/art -p test_*.py`. [Owner board](../art/review/a14/index.html). Next: zero-spend gait audit and exact stage-2 backlog; no further generation under retained latches.


**ART session 10 / A14.3 stage 1 / 2026-10-04:** Garran rear collapse and persistent corpse delivered; all eight humanoids complete, 128/192 priority slots. Two fresh agy calls/images/charges, one reject, project 344; old latch and failure records preserved, Grok unavailable. Source/delivery gates, 52-product byte-identical rebuild, five browser cases and 16 targeted tests pass. All 378 protected art files and inherited ledger rows unchanged. Design: docs/waves/A14-3-stage1-garran.md. Owner feel and game integration unmeasured. Next: reference-guided creature collapse, then reactions; no push.


**ART session 10 / A14.3 stage 2 / 2026-10-04:** Added 52 creature priority slots; total 180/192. Twelve rear Mire Maw/Thornback slots remain missing after two attempts per source slot. Twenty stage calls, 22 session calls/images/charges, project 364; agy clear, Grok unused and latched. Original Covenant creature images passed on every call, explicit crop/selection/scale/pivot records and local reject-or-owner grading. Standalone corpse overwrite detected and fixed by persistence checks; final delivery, 77-product portable checks and all 90 tests pass. Browser five cases/44 persistent atlas corpses pass. Design: docs/waves/A14-3-stage2-creatures.md. Owner animation and game integration unmeasured. Next: budgeted remaining creature motion and legacy queue; no push.


**ART session 10 / A14.3 stage 3 / 2026-10-04:** Added 46 motion/attack/resistance slots; A14 now has 226 clips (180/192 priority plus 46 other), with 12 priority and 12 other legacy slots still missing. Eighteen stage calls bring session 10 to 40 agy calls/images/charges, project 382; allowance exhausted, Grok unused, old latches and ledger evidence retained. Thornback front run/attack failed both attempts; Shieldman attack failed crop/equipment continuity and only brace keys survive. All 90 tests, 91-product byte-identical offline rebuild and seven browser cases pass (44 persistent corpses and 46 added clips at both native sizes). All 378 earlier protected files, 75 stage-2 atlas/corpse images and inherited ledger rows unchanged. Owner feel, game integration and actual shared-account allowance remain unmeasured. Design: docs/waves/A14-3-stage3-motion.md. Commands: python tools/art/a14_build.py, a14_board.py, a14_extra_board.py, a14_portable.py, a14_browser.py; python tools/art/a14_session10.py audit stage3; python -m unittest discover -s tools/art -p test_*.py. Exact queue and loader note in art/SESSION-10-HANDOFF.md. Stopped at the session cap; no push.
