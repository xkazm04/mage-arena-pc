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
| Audio [`audio`] | AU1 | Philosophy, guarded generation, audition and investment evidence | D21-D24 | partial; billing latch after 2/40 proofs; reports validated; stopped for owner | this AU1 handoff commit | 2026-10-02 |
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
| Audio [`audio`] | AU1 | **Philosophy and audition round 1**: audio bible (pillars, palette of sound, mix and priority rules, adaptive music design tied to the collar clock, loudness targets); the project ElevenLabs tool with ledger and credit guard; about 30 to 40 samples across directions and themes; the audition report; stop for the owner | D21-D24 | partial: bible and both reports ready, 2/40 proofs generated; local billing latch, no provider quota error; stopped for owner |
| Audio | AU2 | Round 2 refinement of the chosen directions (variants inside the chosen family), narration or bark voice if wanted | AU1 owner choice | blocked |
| Audio | AU3 | Production set: the full effect list per element and event, the music set (title, camp day/dusk/night, arena per palette, win and loss stingers, adaptive layers), UI sounds, ambiences; loudness-normalised, loop-checked, sidecars and ledger | AU2 | blocked |
| Game | AU4 | In-game audio engine: WebAudio mixer with buses, priority, cooldown and concurrency limits, ducking, adaptive music following the collar tiers and absorb events, UI sounds from the UI kit, volume and mute settings, tests for the priority table | AU3 or placeholders | not started |

## l. Session log

(each run appends: wave, date, what changed, commands with results, what is `not measured`, next wave)

**Camera angle (owner, 2026-10-02): the view is oblique, about 55 degrees of elevation, never a straight 90-degree top-down.** Figures are upright billboards with visible faces and bodies; the arena ground is foreshortened. See art/CAMERA-OK.md.

### AU1 audio — 2026-10-02 — partial handoff, owner stop

Read full plan, owner notes, baseline combat/camp design, garden-vr audio patterns and registry audio guidance. Wrote `docs/audio/AUDIO-BIBLE.md` (all unchosen sound/mix directions are proposals), empty owner choices, 40 original comparison briefs, adapted guarded generator, committed-ledger/sidecar workflow, offline measurements, `docs/audio/audition/r1/index.html` and `docs/audio/PROOF-REPORT.html`. Owner's investment-evidence addition is reflected in the proof report, including forecasts and a proposed same-list Google comparison; no Google service invoked.

Generation stopped after a 2 s Fire SFX proof and a 20 s arena music proof. **No quota/429 and no cap exhaustion.** Music returned no billing header, which tripped the tool's additional billing-uncertainty latch. The owner instructed stopping on a latch, so it was not cleared. Exact SFX charge 20; music actual unresolved, 1,200 reserved; total conservative cap debit 1,220/12,000. Shared account change across the interval 620, remaining 42,061 at 19:14:19 UTC, reserve 8,000, reset 2026-10-04 19:31:41 UTC. The 38 other samples and the voice proof were not generated; this is incomplete AU1 coverage, not proof of a Starter plan limitation.

Validation commands: `node --test tools/audio/guard.test.mjs` (7 offline guard tests); `node tools/audio/plan-audition.mjs` (40 authored briefs, no calls); `python tools/audio/measure.py` (both files decoded and ebur128 measured); `python tools/audio/build-reports.py`; `python tools/audio/check-reports.py` (file:// desktop 1440px + phone 390px, light/dark, every audio plays, no browser errors, no page overflow, localStorage/Markdown export/repeat checks, every reference exists, sidecars/ledger/hashes agree). Evidence in `docs/audio/evidence/validation.json` and meter outputs/screenshots. SFX -10.0 LUFS / +0.8 dBTP; music -14.4 LUFS / -1.5 dBTP; music direct-repeat edge RMS difference 5.21 dB fails the authored 3 dB screen despite a near-zero endpoint jump. Raw files remain unchanged; report playback applies measured attenuation.

Not measured: owner listening, actual music billing attribution, voice cost, alternate-direction/family coherence, music tempo/grid, adaptive stems and in-game mix. Next action is owner review/accounting resolution for any future AU1 continuation; AU2–AU4 and production remain untouched. See `docs/waves/AU1-audio-philosophy.md` and `docs/OWNER-CHECKS.md`. One local commit; never pushed.
