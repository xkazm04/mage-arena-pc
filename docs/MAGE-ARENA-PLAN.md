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
| Arena [`arena`] | W2 | Arena kernel on mouse and keyboard: fixed step, movement, aim, one spell, directional absorb and perfect window, collar clock, dummies, bots, screenshots | - | implemented; automated gates green; owner feel pending | `:/^W2:` | 2026-10-02 |
| Arena | W3 | Water: five spell lines and branches, composition screen, collar tier clock in play | W2 | implemented; automated gates green; owner feel pending | `:/^W3:` | 2026-10-02 |
| Arena | W4 | Enemies, AI mage on the same kernel, Tiro Games waves, 2,000 seeded fights per wave | W3 | implemented; automated median gates green; owner feel pending | `:/^W4:` | 2026-10-02 |
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
| Art | A3 | Top-down figures, poses, spell effects at the confirmed scale | owner confirmed the camera 2026-10-02 (`art/CAMERA-OK.md`: open-oval-sparse-near-a01, near distance) | not started |
| Arena | W4b | (camera confirmed: near distance, open oval) Camera and scale pass: PixiJS camera, scale contract, arena layout wide enough, readability of telegraphs and the absorb arc at distance, screenshots at 1080p and 1440p | A1b, W4 | not started |

## l. Session log

(each run appends: wave, date, what changed, commands with results, what is `not measured`, next wave)

### W2 — 2026-10-02 — arena stream

- Read this plan a–l, baseline report/data/cards and Fable verdict before implementation. Wrote `docs/waves/W2-arena-kernel.md` first. D4 mouse/keyboard and D5 TypeScript override old gamepad/JVM prose; Rain Needle keeps the CSV's zero cast time.
- Created isolated `packages/core/package.json`, core lockfile, `tsconfig.arena.json`, `src/arena/` and arena scripts; created `packages/game/package.json`, game lockfile, strict config, PixiJS/Vite UI and Playwright harness. **No root workspace config, director, tools package or art files created.** The core stream must reconcile package manifests at integration; the arena subpath export and data prebuild are documented in `packages/game/README.md`.
- Baseline combat/CSV/stat data compile into one ignored generated module; authored missing geometry/training/presentation numbers live in `src/arena/data/runtime.json`. Duplicate Nerve/clock values are checked. Fixed 60 Hz kernel, seeded/logged randomness, swept projectiles, down/missio, movement/roll/stamina/staff, ward state machine, collar clock, five training scenarios and a projectile stress scene. Short input taps are queued to the next simulation tick.
- Commands: `npm --prefix packages/core run build` **green**; `npm --prefix packages/core test` **15 passed**; `npm --prefix packages/core run report:w2` **green**; `npm --prefix packages/game run build` **green**; `npm --prefix packages/game run smoke` **green**, real mouse/keyboard checks and four screenshots in `docs/waves/W2-evidence/`. Production-build smoke exposed and fixed an async renderer/entry-module deadlock that development mode hid.
- **Simulated:** 120 s bot runs, perfect 40/40, late/holder/never 0/40; perfect clock unlocks 0/9/18/27 s versus 0/15/30/45 s. Gross raise/drain/capped return and the window sweep are in `bots.json`; same-seed full-state replay matches. Observation resets HP after Down to continue samples, never mana (explicit in report).
- **Measured:** on Ryzen 7 7800X3D / RTX 4090, headless Chromium D3D11, 100 projectiles: approximately 60 fps, CPU p95 1.4 ms, frame interval p95 16.8 ms (360 samples; exact latest values in `browser.json`). Initial default-backend run was ~46 fps; explicit D3D11 and static backdrop caching resolve the budget. Harness enforces CPU <8 ms and target fps within an authored 2% scheduling tolerance.
- **Not measured / not felt:** physical input-to-photon latency, human absorb/aim feel and audio comfort. Pending owner checklist in `docs/OWNER-CHECKS.md`; no physical controller measurement claimed. Next: write full W3 card, then Water lines/Flow/composition/curve linter. Commit column uses a Git subject revision selector so the commit can identify itself without a stale self-hash.

### W3 — 2026-10-02 — arena stream

- W2 committed as `2494ab9`. Wrote the full `docs/waves/W3-water-lines.md` card first, reasoning from combat, all Water CSV rows/sheet, roster and Tiro data. Five Water lines, all branches, Flow/Crest, independent cooldowns, cast snapshots, areas, pull/push/root/encase, heal/ward/HoT/Font, Sheen/Reflection/Ripple/Mirage/Return Tide now use the same kernel. The baseline numerical data was not retuned.
- Prose defects resolved explicitly: first spell establishes Flow's predecessor, cast six can reach five stacks, cast seven consumes Crest; effective impact waits for max(cast, telegraph); later tiers retain Mirror's slotted passive. Short cones and reactive rings are not ground-positioned warnings. Runtime supplements own only unspecified geometry/policy parameters. Enemy HP/counts are read from baseline for target probes; no Director or art work.
- Added preparation dialog with three unique slots, named presets, branch choices and complete tier curves. D4 selection/casting remains consistent; slot labels and cooldowns climb in place. Added zones, spell warnings, status/decoy shapes and Flow/Crest HUD.
- Commands: `npm --prefix packages/core run build` **green**; `npm --prefix packages/core test` **30 passed** (15 W2 + 15 Water); `npm --prefix packages/core run report:w3` **green** (24 catalog rows, two planted linter contradictions rejected, four windows per composition/scenario, no universal dominance flag); `npm --prefix packages/game run build` **green**; `npm --prefix packages/game run smoke:w3` **green**, zero browser exceptions and four screenshots. The harness confirmed a real selected-slot hit, blocked duplicate lines and observed custom Lash II-B become Riptide at tier II.
- **Simulated:** stationary soldier first clears: Undertow 12.15 s, Mirror tide 15.65 s, Rotation 12.8833 s; these are expressly **not AI-wave duration claims**. Targets are re-racked after clear for four continuous DPS windows; no player resource refills/resurrection. Against incoming magic the probe's Undertow/Rotation policies went Down; their subsequent windows correctly show zero, while Mirror tide survived and healed. Unlimited-mana ceilings are separately labelled authored calculations. Exact outputs/methodology: `docs/waves/W3-evidence/water-curves.json`.
- **Not measured / not felt:** human composition/upgrade clarity, spell rhythm, utility quality and real-enemy balance. Owner checks appended. No borrowed schools, camp/save integration or non-Water spells yet. Next: full W4 card, moving roster/AI mages, Tiro wave director and 2,000-seed census per wave.

### W4 — 2026-10-02 — arena stream

- W3 committed as `2126f57`. Wrote full `docs/waves/W4-tiro-games.md` before implementation. Added all eight enemies with committed warnings, shield/flank rules, two-slot hound packs and delayed death bursts, physical pull, charge/wall stun and moth mana drain. Added data-derived mage competence/interpolation, delayed observations and seeded decisions through the same player input/kernel; no AI stat bonuses.
- Added exact four-bout Tiro spawns, intermission recovery, locked composition, tier resets, missio, one terminal payout and readable next-bout/retry controls. Added all eight roster practice entries. Other-school opponents are visibly labelled **Water proxies**, pending W8. The W7 Games/result API and camp's responsibility to apply the reward once are documented in `packages/game/README.md`. No director, tools package, root workspace config or art assets added; existing independent core/game manifests gained arena-only scripts.
- **Authored tuning in the data authority:** halved Water direct damage and base Return Tide cap (80→40), with Rain Needle further reduced from its original 6 to 2.05; conscript HP 40→38, slinger 30→28, mire maw 120→100. Costs, healing, cooldowns, control, enemy damage and rank resources are unchanged. No hidden multiplier, duration padding, resource refill or policy weakening. Initial and intermediate calibration reports, including a failing full census (semifinal median 44.55 s), are retained. Updated Water sheet/prose; original HTML report remains historical. Integration must carry these baseline CSV/JSON amendments into its one authoritative location and retarget the compiler if needed.
- Final review fixed passive regeneration during encasement, separated conscript recovery/backoff, kept enemy windup facing at the committed aim, excluded overkill from damage telemetry and let hostile hazards settle before clear. The final census was regenerated after these changes; earlier passing summary retained as `census-before-kernel-review.json`.
- Commands: `npm --prefix packages/core run build` **green**; `npm --prefix packages/core test` **47 passed**; `npm --prefix packages/core run report:w3` **green**; `npm --prefix packages/core run report:w4` **green**; `npm --prefix packages/core run report:w4:ladder` **green** for reaction/stat-cap checks; `npm --prefix packages/game run build` **green**; `npm --prefix packages/game run smoke:w3`, `smoke:w4`, and `smoke -- W4-evidence/performance` **green**, zero browser exceptions; `git diff --check` **green**. W3 curves/screenshots regenerated for W4 data; their original measurements remain available at the W3 commit. Current stationary-soldier first clears are 23.65 / 23.40 / 22.15 s for Undertow / Mirror tide / Rotation; these are not moving-wave durations.
- **Simulated:** 2,000 independent fresh starts per Tiro wave, seeds 40000–41999, unchanged rank-one Rotation reference input controller. Completed-bout medians (wins and losses) **37.5833 / 40.4833 / 46.3667 / 58.1333 s**, all inside their authored bands. Wins **2000 / 2000 / 1813 / 1332**; zero timeouts, early Downs, invalid states or sampled replay mismatches. Only 61.0% / 67.7% / 57.4% / 92.25% of individual durations lie in-band: the declared gate is median pacing, not all seeds. Exact tails, resources, perfect rates, dead-air buckets, source hashes, digests and all raw rows: `docs/waves/W4-evidence/census*.json`.
- **Simulated ladder limitation:** 500 trials per competence row, reference wins 443 / 287 / 115 / 184. Level 4 overdefends in this matchup and is weaker than level 3; later-ladder balance remains a W9 task, not claimed green. Tiro uses competence 1 and 1.5. Full-Games integration fixture explicitly selects winning seed 1, completes in 142.25 s with real carryover/recovery and yields 100 gold / 25 renown once; this is not an unbiased Games win-rate sample.
- **Measured:** production Playwright drives real D4 inputs, checks composition, all four reference-policy bouts, ordinary-damage missio and all roster entries. On Ryzen 7 7800X3D / RTX 4090, Windows Chromium 153 D3D11: 100 projectiles, 360 samples, **60.003 fps**, CPU p95 **1.3 ms**, frame p95 **16.8 ms**. Details/screenshots in `W4-evidence/browser.json` and `W4-evidence/performance/`. GPU completion, physical input-to-photon latency, human pacing, absorb/aim feel and audio comfort are **not measured / not felt**.
- W2–W4 implementation is complete within this stream's scope; stop here with one commit per wave and no push. Owner checks are appended; G1 is still open. Next authorized integration work belongs to W7; non-Water identities to W8; later tiers/level-4 tuning to W9. No owner-only or cross-stream work was silently marked complete.
