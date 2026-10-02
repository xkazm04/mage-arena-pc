# Mage Arena: the project plan

Written 2026-10-01 by the orchestrating session (Claude Sonnet 5.5) after the design contest `mage-arena` (blind, owner-only decision plus an objective review by Fable 5.1 at medium effort).
Executing agents: Codex GPT-6 Astra (implementation), Grok (images, until the quota is depleted), Fable 5.1 (reviewer at gates), the owner (the only judge of feel).
This file is the single source of truth: every session starts here (status table section g, last session-log entry section h).

## a. What we are building, in four sentences

An action RPG about elemental mages (Fire, Water, Earth, Air) of the Roman era, betrayed and locked in a magic-warded camp, forced to fight in the arena for food and equipment.
Two halves feed each other: a **camp** played on a Persona-style calendar (places to visit in time slots, relationships, schemes, loyalty) in which an LLM **Director** decides what every character does each night,
and an **arena** (diablo-style top-down real-time combat, one hand moves and one hand casts, spell tiers that unlock every 15 seconds, a mana-costed magical **absorb** with a perfect-absorb window).
One season of six weeks, six Games, endings computed from state; the ending, the Breaking, is the absorb mechanic played as trust.
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
| Core [`core`] | W0 | Design reconcile, season data, replayer-generated fixtures | - | six Fable fixes and lower-severity followups closed; gates green | 2833a30 | 2026-10-02 |
| Core | W1 | Scaffold + Director harness (headless): state, intents, planner, validator, caps, cache, providers, soak and fuzz report | W0 | engineering PASS: 300 local + 30 Sonnet nights, complete local judge; rejection 4.73%; owner blind read pending | 27a74fb | 2026-10-02 |
| Arena [`arena`] | W2 | Arena kernel on mouse and keyboard: fixed step, movement, aim, one spell, directional absorb and perfect window, collar clock, dummies, bots, screenshots | - | implemented; owner feel pending | 2494ab9 | 2026-10-02 |
| Arena | W3 | Water: five spell lines and branches, composition screen, collar tier clock in play | W2 | implemented; owner feel pending | 2126f57 | 2026-10-02 |
| Arena | W4 | Enemies, AI mage on the same kernel, Tiro Games waves, 2,000 seeded fights per wave | W3 | implemented; compact-court gate passed; W4b reopened soldier/creature pacing | 4b21c57 | 2026-10-02 |
| Core | W5 | Camp screens: season map, time slots, eight places, Hollow Board, night act that hides model latency | W1 | engineering PASS: Pixi camp, accepted art loader, deterministic slots/listening, 1080p/1440p browser gates; owner feel pending | d18ef80 | 2026-10-02 |
| Core | W6 | Parley (typed role-play at Knowing moments) with injection suite and offline cards | W5 | engineering PASS for bounded effects: 100-case suite, offline cards, typed browser play; four bounded semantic false positives and timeout fallbacks disclosed; owner feel pending | c464f16 | 2026-10-02 |
| Integration | W7 | Season integration: weeks 1-2 playable end to end, save/load, **Gate G1 (owner plays)** | W4, W6 | workspace merge gates pass; season/save/pacing/soak in progress; G1 open | merge sub-wave | 2026-10-02 |
| Arena | W8 | Fire, Earth, Air schools | G1 | not planned | | |
| Arena | W9 | Tiers II-IV, Summa, the mage semifinal, lethal-bout hooks | W8 | not planned | | |
| Core | W10 | Deaths and the Vigil: Plot objects, crackdown, executions, death census | G1 | not planned | | |
| Core | W11 | Arcs depth, quests and linter, economy over six weeks | G1 | not planned | | |
| Core | W12 | Endings: the Breaking duet, champion, betrayed, revolt, martyr | W9, W10, W11 | not planned | | |
| Core | W13 | Art integration | A2-A5 | not planned | | |
| Core | W14 | Cache pre-warm, hosted-API provider, cost guard | W11 | not planned | | |
| Core | W15 | Release candidate, balance report, **Gate G2** | all | not planned | | |
| Art [`art`] | A1 | Style exploration: at least eight directions, **two images each (Arena fight, Camp map with time slots)**, a combined board | - | not started | | |
| Art | A2 | 16 portraits and expressions in the chosen style | A1 owner choice | not planned | | |
| Art | A3 | Top-down figures, poses, spell effects | A1 owner choice | not planned | | |
| Art | A4 | Camp map final, backdrops, story cards, Hollow Board frames | A1 owner choice | not planned | | |
| Art | A5 | Icons, HUD, spell-line icons | A1 owner choice | not planned | | |

## h. Wave cards

Rhythm of every wave: design note first (`docs/waves/<id>-*.md`), data first, tests with content assertions, a green gate, a status row and a session-log entry, an `OWNER-CHECKS.md` entry for anything only the owner can judge, one commit. A gate with no command is `unverifiable`; a number not measured is `not measured`.

### W0 Design reconcile (docs and tools, no engine)
Read the baseline design and Fable's verdict. Produce the **reconciled design** under `docs/design/reconciled/`: season calendar (six weeks, Games weekly, day slots) in `data/season.json`; loops removed; deaths reserved in the data model (Plot object, Vigil attention, Executed state) with no gameplay yet; every defect in section f fixed or explicitly logged; the data files become the only authority.
Build the **replayer** (`packages/tools/replay`): it applies Director output to a CampState using only the tables and produces golden nights, so worked nights are generated, never typed. Gate: the replayer reproduces three nights with every delta derivable from a table; a consistency checker verifies rendered template/data agreement, explicit foreign keys and vocabularies, and deterministic fixture replay (not arbitrary prose semantics); a mutation test proves the checker fails on a planted contradiction.
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
| Art | A3 | Top-down figures, poses, spell effects at the confirmed scale | **owner confirms the arena camera** (`art/CAMERA-OK.md`) | blocked |
| Arena | W4b | Camera and scale pass: PixiJS camera, scale contract, arena layout wide enough, readability of telegraphs and the absorb arc at distance, screenshots at 1080p and 1440p | A1b, W4 | not started |


## l. Session log

(each run appends: wave, date, what changed, commands with results, what is `not measured`, next wave)

### CORE W0 review closure — 2026-10-02, second session

- Read baseline report/data, W1 report, Fable review and full plan; section m was
  absent on core and read from the main worktree, then carried into this plan.
- Closed review items 1–14 with fixes and explicit naming/scope dispositions.
  `docs/waves/W0-review-fixes.md` was written before edits. No arena or art edits.
- `npm run gate`: build/lint green, 18 Director plus ten replayer tests pass;
  checker zero contradictions in its stated scope, three golden nights / 216
  traced changes, five additional generated branch nights. Syntax build passes.
- Pinned the pre-fix W1 experiment tables to preserve all saved live evidence.
  New balance authored, outcomes simulated; owner feel not measured. Next W1b.

### CORE W0 ? 2026-10-01

- Read the full project plan, chosen report/data/cards and Fable verdict; reconciled camp design under `docs/design/reconciled/`. Archived contest packages preserved. No game or art modifications.
- Design note first: `docs/waves/W0-design-reconcile.md`. Season calendar, numeric effect authority, cast/locations, death reservations, defect dispositions, reference replayer and generated fixtures added.
- Measured: `node packages/tools/replay/cli.mjs check` ? zero contradictions, three simulated nights, 237 traced changes. `node --test packages/tools/replay/*.test.mjs` ? seven passed, including planted prose/rule/fixture contradictions. `node packages/tools/replay/cli.mjs build` ? green. Full commands and boundaries in `docs/waves/W0-report.md`.
- Authored numbers remain authored. Owner feel and live model quality not measured. Fable review is pending orchestrator dispatch, as assigned by the card. Deferred arcs/arena/Parley integrations explicitly listed in `docs/design/reconciled/defects.json`.
- Next: W1; verify local Claude flags before any subscription calls, local bulk soak, capped Sonnet run.

### CORE W1 — 2026-10-02 (stopped; wave incomplete)

- Design note first: `docs/waves/W1-director-harness.md`. Strict TypeScript/npm workspaces, pure camp core, utility planner, schema/domain validation, camp caps, content-hash cache, durable call budgets and three providers implemented. Game and art untouched.
- CLI flags verified before calls; subscription-compatible minimal settings recorded. Sonnet measurement finished at exactly 30 nights / 150 calls, including the initial probe. No more Sonnet calls are scheduled.
- `npm run gate`: build and ESLint green, 18 Director tests and seven W0 tests passed. The checker reports zero contradictions within its implemented template/foreign-key/fixture scope; it is not a semantic proof of arbitrary prose. `npm run report` independently replayed all 155 saved local and 30 Sonnet nights. W0 fixture bytes remain unchanged. `npx tsx packages/tools/src/cache-replay.ts`: 925 cache hits across those 185 nights, zero provider calls.
- Local bulk stopped at 155/300 nights on `qwen3.8:27b-64k`: 110/2325 intents rejected (4.73%), one recorded timeout. The 15% kill threshold was not exceeded in this partial sample; the required full-sample gate is not passed. Sonnet completed 30 nights, 150 calls, zero rejected intents; subscription cap preserved. Line repairs and raw latency/token measurements remain visible in `docs/waves/W1-report.md` and evidence.
- Interruption: a requested 55-second wait reported 25926.6283 seconds elapsed. Execution resumed at 06:34 UTC, past the roughly five-hour work window. Cause is not established. The local runner was stopped; the queued judge exited at its deadline and made no calls. The last recorded local night includes the elapsed interruption and timeout; it was retained. Ledger shows 776 local-soak reservations for 775 recorded calls: one stopped in-flight reservation remains charged. No retries or reset were used.
- Partial evidence preserved with `npx tsx packages/tools/src/archive.ts --partial`; hashes and expected/actual row counts in the archive manifest. `npx tsx packages/tools/src/blind.ts local-soak` generated three blind morning comparisons from the saved sample. Owner read remains pending.
- Remaining before W1 acceptance: the other 145 local nights; local-model character judgments for both providers; regenerate the complete report/archive; address Fable’s six residual design-package fixes. Resume must preserve checkpoint/evidence and the cost ledger, explicitly account for the charged in-flight local call, and make no additional Sonnet calls. Do not begin W5 on a claim that W1 passed.
- Fable review arrived during the interruption: accepted W0 for handover with six fixes owed. `docs/judging/fable-w0-review.md` is preserved as supplied; open fixes and observations are recorded in `docs/design/reconciled/defects.json`. This later review supersedes the earlier W0-session pending-review status.
- Labels: rules authored, camp outcomes simulated, timings/rejections/tokens measured. Character quality and owner feel remain not measured. No game/art modifications and no push.

### CORE W1b completion - 2026-10-02, second session

- Completed the original 300-night local experiment in detached ten-night chunks;
  preserved the first 155 rows and all 30 Sonnet nights byte for byte. No new
  subscription calls: 150/150 reservations. No new wall-clock gaps; the earlier
  interruption and orphan reservation remain charged and archived.
- Local rejection 213/4,500 (4.73%) is below the 15% kill rule. Engineering PASS;
  proceed to W5. Local judge covers all 330 nights / 4,950 actors. Five failed
  attempts retained. Gross-contradiction calibration passes, but observed answer
  category/reason disagreements and 821 local line repairs are explicit limits.
- `npm run gate`: build/lint green, 20 TypeScript and ten replayer tests pass.
  `npm run report`: exact request, rejection and state audit for every night.
  Cache replay: 1,650 hits, zero calls. Provenance hashes prove original evidence
  preserved. Full archive row counts, hashes and compression round trips pass.
- Full-sample blind mornings pass desktop/mobile browser checks; screenshots
  saved. Owner read pending, not felt. Cost report separates CLI reference USD
  3.7934884 from unmeasured subscription debit and electricity. No art/arena edits
  and no push. Next: W5 camp scenes, then W6 Parley.

### CORE W5 completion - 2026-10-02, third session

- Read the full plan, section j and the Tessera/camera direction, W1 report,
  unfinished W5 design and prior session logs. Reviewed and retained the
  uncommitted headless session/slot groundwork. W1 remains engineering PASS:
  213/4,500 rejected local intents (4.73%), below the 15% kill rule.
- Built the Pixi season map, eight visits, time slots, Hollow Board, private
  journal and playable listening act. Sidecar owns revisions, ticks, partial
  Director groups, bounded grace and exactly one dawn. Core stays pure.
- Read the art delivery and copied 22 approved-for-integration textures with
  sidecars and original provenance archives. Source hashes verified; source
  owner-review labels preserved alongside current user authorization. No art
  worktree edits and no arena imports. Loader placeholders remain playable.
- `npm run gate`: build/lint, 41 TypeScript tests, ten reference tests, zero
  design contradictions; three original golden nights / 216 changes preserved.
  `npm run build:game` passes. Three additional generated camp mornings replay
  exactly. Six-week camp-only simulation completes; arena integration not claimed.
- `npx tsx packages/tools/src/camp-browser.ts`: final browser gate passes with
  zero page errors and 14 screenshots at 1080p/1440p. Travel, training, all slots,
  real-time listening reward, refresh, board/journal and placeholder fallback
  checked. A rerun overlapped source formatting/hot reload and timed out;
  its partial capture was superseded by the completed run.
- `npx tsx packages/tools/src/camp-local-night.ts`: five live local calls,
  zero rejected intents, four groups complete during the measured 48.59-second
  act, final post-act wait 0.80 seconds. Separate durable five-call ledger;
  zero subscription calls. No clock jump observed; local sample gap list empty.
  A 15-second heartbeat is running for the rest of this session and records any
  gap over 45 seconds, without assuming its cause.
- Art/rules authored; state simulated; tests/screens/latency measured. Owner feel
  pending in OWNER-CHECKS. W5-report.md records boundaries. One W5 commit, no push.
  Next: W6 typed Parley at Knowing moments, code checks and offline cards.

### CORE W6 completion - 2026-10-02, third session

- Design note before implementation: W6-parley.md. Typed role-play is gated by a
  real held Knowing, presence, legal slot and once/day use. Director proposals
  pass schema/domain checks and pure core contests. Offline authored cards use
  the same path. Trust, disclosures and the next friendly act remain code-owned.
- `npm run gate`: strict build/lint, 65 TypeScript tests, ten reference tests,
  zero checker contradictions. Existing W0/W5 fixtures preserved. Production
  `npm run build:game` passes. Timeout/late-result, budget, cache, concurrent
  travel/dawn and already-completed night-job promise regressions covered.
- `npx tsx packages/tools/src/parley-report.ts`: 100 simulated hostile cases,
  20 families/five contexts, zero state escapes; 300 seeded authored outcomes.
  `parley-local-suite.ts`: 100 hostile probes plus three distinct positive
  controls. Final hostile outcomes: 70 refusal, four bounded small trust gains,
  26 timed-out selected-card fallbacks. Controls all select their intended
  effects. Semantic false positives are disclosed, not called clean refusals.
- All prompt iterations retained: 349 local reservations, 348 recorded rows,
  one stopped pilot call still charged. No reset/retry expansion after the final
  cap. Zero new subscription calls. `parley-audit.test.ts` replays evidence and
  `parley-archive.ts` records byte hashes/ledger/heartbeat. W1 evidence untouched.
- `npx tsx packages/tools/src/parley-browser.ts`: earned Knowing, typed reply,
  once/day/slot checks and direct card, zero browser errors, six screenshots at
  1080p/1440p. Initial eight plus final three gameplay reservations; cached
  replies explicitly retained. Canvas shrink fix verified in final screenshots.
- No PC-sleep clock jump observed. The 15-second heartbeat's >45-second gap list
  is empty through the archived W6 observation. Local inference timeouts remain
  measured failures with unknown cause, not attributed to sleep.
- Rules/cards authored, state simulated, calls/tests/screens measured; owner
  feel pending in OWNER-CHECKS. One W6 commit, no push, no art/arena edits.
  Next: requested W7 integration plan and exact merge steps, without importing
  arena implementation on core.

### CORE W7 groundwork - 2026-10-02, third session

- W7-integration-plan.md is a plan only, per the session instruction. Read arena
  source/manifests, its current W4b evidence and the camera end note with `git show`;
  no arena imports, merges or edits. Art and arena worktrees remain clean.
- Pinned core c464f16 and arena 68a4d68. `git merge-tree --write-tree --name-only
  core arena` reports eight conflicts without changing the index/worktree. Exact
  future isolated-worktree merge commands and per-file resolutions are written.
- Plan covers workspace exports/lockfiles, active data authority, dual renderer
  lifecycle, real deterministic Games receipts, Trial/Games chronology, sickness
  carry, versioned atomic saves, replay and input validation, owner G1 gates.
- The core checkout lacked the final owner camera note. Read it from arena and
  preserve it below: 55-degree oblique, upright figures, near-distance open oval.
  Current arena evidence explicitly FAILS soldier/creature pacing (44.3833 and
  45.55 seconds). No claim that old W4 PASS applies; arena follow-up precedes G1.
- CORE implementation gates remain those passed for c464f16; documentation-only
  groundwork adds no unmeasured gameplay claim. Owner feel/G1 remains open.
- Session started 11:51:51 UTC. Heartbeat from 12:17:31 through 13:13:33 UTC has
  224 samples and no >45-second gap; no PC-sleep clock jump observed. No push,
  no new subscription calls. Next: orchestrator integration on a separate branch.

**Camera angle (owner, 2026-10-02): the view is oblique, about 55 degrees of elevation, never a straight 90-degree top-down.** Figures are upright billboards with visible faces and bodies; the arena ground is foreshortened. See art/CAMERA-OK.md. Read-only source: arena 68a4d68; confirmed near-distance open oval. This note supersedes ambiguous older top-down wording above.


## Imported arena stream history (pinned 68a4d68)



(each run appends: wave, date, what changed, commands with results, what is `not measured`, next wave)

**Camera angle (owner, 2026-10-02): the view is oblique, about 55 degrees of elevation, never a straight 90-degree top-down.** Figures are upright billboards with visible faces and bodies; the arena ground is foreshortened. See art/CAMERA-OK.md.

### ARENA session 2 — W4b and W4c, 2026-10-02

Read the complete plan, confirmed camera/scale contract, A1b board/manifest and chosen full-size source, W2–W4 notes and game README. Implemented a full-viewport player-following 55° camera, near 1.2 baseline and 0.8–1.2 zoom, foreshortened ground, foot-depth-sorted upright procedural billboards, the 192×144 m playable open oval, sparse 6 m opening formations, exact forward 140° visual ward, readable warnings/projectile minimums, debug contract overlay and validated sprite-manifest loading with fallback. The old 32×20 m bounds and fixed canvas scale are superseded by the imported art contract. W4c implements cursor-to-ground inversion, refreshing under follow/zoom/resize, and tests ground hit/ward geometry separately from billboard pixels. No director or camp package was touched; no push.

`npm --prefix packages/core run build`, `npm --prefix packages/game run build`, core tests (51) and game tests (13) pass. `smoke:w4b` passes at native 1920×1080 and 2560×1440 with near/far screenshots, overlapping upright figures, live warnings, 32 real-pointer hit cases and sprite success/failure probes. Its uncontended 360-frame samples sustain approximately 60 fps with **100 visible moving projectiles in every sampled frame**, below the 8 ms CPU p95 budget on the recorded Windows/D3D11 machine. Exact final measurements and commands: `docs/waves/W4b-evidence/browser.json`. Prior controls, composition and Tiro lifecycle smoke commands pass into separate subfolders. The new selected completion fixture is seed 30, 159.05 simulated seconds, with normal resources and explicit between-bout recovery.

Revalidation beyond the camera gate: `npm --prefix packages/core run report:w4 -- --evidence W4b-evidence --tag oval-census` runs 2,000 fights per wave and deliberately returns **FAIL/exit 1** for soldier/creature pacing on the enlarged layout. Medians are **44.3833 / 45.55 / 45.4833 / 58 s** against bands 25–40 / 30–45 / 45–70 / 45–80. No timeouts, early Downs, invalid states or sampled replay mismatches. The old W4 pass is historical, not a pass for the new arena. Initial row-layout and final sparse-grid measurements are retained; no HP, spell damage, resource, competence or duration-band tuning was performed. Stop balance tuning here and queue a dedicated opening-encounter rework before G1, preserving the confirmed camera and 6 m separation. See `docs/waves/W4b-camera-scale.md` for a concrete proposal.

Still **not measured/felt**: owner motion readability, camera comfort, naturalness of foot-plane aiming, physical input-to-photon latency. `OWNER-CHECKS.md` supplies the trial. A3 animation/pose delivery and W8 schools remain their own waves. Next arena work: resolve the disclosed Tiro pacing regression and owner feedback; integrate accepted A3 assets through the loader boundary. G1 remains open.


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

### INTEGRATION W7 merge sub-wave - 2026-10-02

- Merged pinned arena 68a4d68 into integration at ff99607, resolving the eight documented conflicts. Unified workspace exports, lock, NodeNext imports, scoped CSS, and owned camp/arena lifecycles. Promoted active arena tables byte-for-byte; imported section n.
- npm run gate: 129 TS plus ten reference tests PASS, zero design contradictions. npm run build:game PASS. Water production smoke PASS with real pointer and keyboard controls. W7-evidence/merge-water preserves new measurements.
- Arena pacing remains FAIL pending its sub-wave. Season/save/soak and owner feel/G1 not measured. No push. Next: season bridge and authoritative replay receipts.
