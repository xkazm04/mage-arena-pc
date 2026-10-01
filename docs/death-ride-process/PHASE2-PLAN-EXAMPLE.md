# Death Ride: Phase 2, the art pipeline and the content to beat the 1996 original

Written 2026-10-01. Phase 1 (`DEATH-RIDE-PHASE1.md`, G1-REPORT.md) delivered a complete loop with placeholder visuals. Owner decisions on 2026-10-01:

- The Grok test art (cars, tiles, icons, one mock scene, in `C:\Users\kazda\kiro\firetv\.contest\art-test\`) is **good enough to build on**: the art style, the cars
  and the icons are the direction. Extraction into the game and consistency are the known challenges.
- The ambition is to **beat the content and quality of Death Rally (1996)**. Public benchmarks (unverified secondary sources collected by a side experiment,
  `.contest\experiments\gpt61-sol-death-rally\research\GAME-FACTS.md`): six cars on an upgrade ladder, nineteen tracks, engine/tire/armor upgrades, one-race
  consumables (mines, spikes, fuel), loans, contraband side contracts, named rivals who buy cars. Treat as targets to exceed, not facts to copy.
- **Grok image generation is the mass image engine** (the owner's weekly quota just reset; use it, but never waste it, see section d). Local models help with recognition and
  grading. The registry knowledge in `C:\Users\kazda\kiro\ai-registry\knowledge\media-generation` (and `game-production`) is the method.
- Astra drives development. Two parallel streams, on separate worktrees, merged by the host: **Art stream** (P1-P4) and **Content stream** (C1-C4), then **Integration** (I1-I3).

## a. Tools and facts verified on this machine (2026-10-01)

| Thing | State |
|---|---|
| Grok CLI | `grok` 1.0.44 logged in with the owner's SuperGrok session, model `grok-4.7`, built-in `image_gen` / `image_edit` / video tools, bundled skills `game-assets`, `game-tilesets`, `game-character-consistency`, `game-animation-frames`, `game-ui-icons`, `imagine` in `~/.grok/bundled/skills/` (read them before writing prompts). Headless call that worked: `grok -m grok-4.7 --effort low --always-approve --permission-mode bypassPermissions -p "<prompt>" --output-format json` run inside the output directory; the image is saved as a file there. Several can run in parallel processes. |
| What the test showed | 1024x1024 or 16:9 PNG, flat colour background reliable, strong style. Failures seen: one car came back three-quarter view instead of top-down; one car cropped at the frame edge; asphalt and oil tiles repeated visibly; lighting baked from the top-left (it will not rotate correctly if the sprite is rotated in-engine); extra decoration (driver, number) when not forbidden. |
| Local models | GPU RTX 4090 24 GB. Ollama has `qwen3.8:27b-64k` and `mimo-9b:q8-64k` (vision capable, `capabilities` includes vision) at `localhost:11434`. The repo's `vision/vlm.py` is an existing local vision client from the PoC. Use local models for **grading and recognition**, never as the arbiter of taste. |
| Reference device | Fire TV Stick 4K (AFTKM, 1.7 GB, armeabi-v7a, 1080p). Texture memory is the real constraint, see section d. |

## b. Art stream (worktree/branch `deathride/art`)

Rule: assets are produced by a **repeatable pipeline from versioned briefs**, never by hand, so any asset can be regenerated, graded and replaced.

### P1 Style bible and pipeline skeleton

- **Style bible** (`deathride/art/STYLE.md` + a machine-readable `style.json`): the locked style block restated verbatim in every call (registry: `style-block-restated-every-call`,
  `style-first-token-ordering`, `medium-vocabulary-locking`, `two-block-style-and-action`), camera contract (**true top-down, car pointing +x, neutral flat lighting with no baked
  directional shadow so the engine can rotate and light it**), colour roles (`assigned-colour-roles`, per-class accent), outline weight, scale contract linking sprite pixels to the game's
  metres per pixel from the Phase 1 scale contract (read `W6-tracks.md`), negative prompt list (`negative-prompting`: no driver, no text, no numbers, no logos, no perspective).
  Derive the style from the owner-approved test images (`style-onboarding-from-sample`); keep them as the reference set.
- **Asset brief CSV** (`art/briefs/*.csv`): id, class, prompt-action block, size, frame, background key, count, status. One row per asset; this is the single authority (`canon-as-single-source-of-thresholds`).
- **Generation driver** (`tools/art/gen.py` or Node): reads the briefs, calls the Grok CLI headless in parallel (bounded concurrency, default 4, `GROK_MAX_PARALLEL_*`), writes raw outputs plus a
  JSON sidecar (prompt, seed if any, model, timestamp, attempt number), resumable, idempotent, and keeps the **generation history as an artifact** (`generation-history-as-artifact`).
- **Budget guard**: a counter file of images and videos spent this week, a hard cap set in `art/budget.json` (the owner raises it), and a **gate before every spend** (`gate-before-every-credit-spend`):
  a batch runs a 1-image proof first; unspent budget is reported, not hoarded (`unspent-budget-is-a-defect`). The Grok subscription's real limit is unknown from here: the driver must stop and log on the first rate-limit or quota error and never retry in a loop.

Done when: one command regenerates the five test cars and five tiles from briefs into `art/raw/`, resumably, with a history log and a budget file.

### P2 Post-processing and acceptance (local, deterministic first, local VLM second)

- **Post-process**: key out the background colour (despill edges), trim, normalise to the scale contract, pad to a power-of-two cell, pivot from the art not the canvas
  (`sprite-sequence-timing-and-pivot-stability`), gutter for atlas bleed (`atlas-packing-and-bleed-margins`), palette drift check across a family (`palette-discipline-across-frames`).
- **Deterministic gates** (unconditional fails, `unconditional-fail-criteria`, `unmeasured-is-not-pass`): non-empty alpha, subject within the frame with margin (catches the cropped Bastion), aspect and
  size band, orientation check (principal axis along +x), background fully removed, **tiles: wrap-around edge difference under a calibrated threshold** (`wrap-around-edge-diff`, `seam-threshold-calibration`)
  plus a repetition score (autocorrelation peak) that catches the visible-repeat asphalt and oil tiles. Calibrate thresholds on the existing test images and record them.
- **Local VLM grader** (Ollama `mimo-9b` or `qwen3.8:27b`, schema from `vision-model-grading-schema`, two-grader disagreement rule `two-grader-disagreement-rule`): answers fixed questions only (is it true top-down?
  is there a driver or text? does it match the family palette? is the silhouette distinct from the other classes?) and returns JSON; a disagreement or low confidence routes to the owner contact sheet. The grader never
  accepts, it only rejects or routes. Record its false-accept and false-reject on a hand-labelled set of 30 images before trusting it, and write that number down.
- **Rejection memory**: failed prompts and failure codes are stored as negative evidence and fed into the retry prompt (`rejections-as-negative-evidence`), bounded retries (`bounded-refine-iteration`, max 3), a defect-class
  to remedy map (`defect-class-to-remedy-map`), best-of-n only where the economics allow (`reroll-economics-per-credit`).
- **Contact sheets** for the owner: auto-generated PNG sheets per batch with ids, verdicts and failure codes.

Done when: the five test cars and five tiles are run through the gates and the failures seen on 2026-10-01 (three-quarter Trail, cropped Bastion, repeating asphalt/oil) are **caught by the pipeline**, with the numbers in `art/ACCEPTANCE.md`.

### P3 Car family at scale (the hard consistency problem)

- Per class: a **reference sheet** approved by the owner first (`approved-reference-sheet`, `character-identity-continuity`: `reference-shows-only-invariants`, `identity-split-from-state`), then derived states from it with
  `image_edit` where it keeps identity: clean, damaged-1, damaged-2, wreck/burnt, and colour variants for rival liveries (`assigned-colour-roles`). Use a control arm to measure consistency (`consistency-control-arm`).
- Heading strategy decision, tested not assumed: (a) rotate one neutrally lit sprite in-engine (cheapest, needs the flat-light contract), (b) 16 or 32 pre-rotated frames, (c) generated frames. Measure memory and look on the Stick before choosing; write the result into `PITFALLS.md`.
- Target roster for art: the five current classes plus **at least five new classes** that the Content stream defines (C1); each with reference sheet, four states, three liveries.

### P4 World kit

Tiles (asphalt in 3 wear levels, gravel, ice, oil, kerb, grass, dirt, concrete, metal), barriers and walls (modular, straight, corner, hazard stripe), props (tyre stacks, crates, cones, signs, oil drums), pickup art
(ammo, repair, cash, mine, turbo), decals (skid marks, oil, scorch, cracks, blood-free impact marks), effect sprites (muzzle flash, explosion frames, smoke, sparks, fire) as animation sheets
(`game-animation-frames` skill, `motion-sampled-under-a-frame-budget`), HUD frames and icons (`game-ui-icons`), rival portraits for the campaign, track-theme backdrops. Tiles must tile; props are isolated on key colour.
Autotile completeness for track edges and barriers: enumerate the full rule set and fail on a missing case (`autotile-rule-set-completeness`, 47 cases for eight-neighbour).

## c. Content stream (worktree/branch `deathride/content`, data and core only, no art dependency)

Targets exceed the public benchmark: **at least 10 car classes in tiers, at least 24 tracks across themes, at least 6 weapons/consumables, a deeper economy and a longer career.**

### C1 Roster v2

Eight to ten cars on a tier ladder (rookie to elite) with a readable identity and a price curve, built on the W2 stat model and mapping; extra stats where the game needs them (turbo, ammo capacity, mounts). A headless
class-versus-course matrix proves no dominant class on every track type (`tier-band-peer-outlier-linting`, `cost-curve-object-audit`). Sizes: classes must differ visibly in length and width within the scale contract.

### C2 Tracks v2

Extend the W6 track format and linter to 24+ tracks in 4+ themes (the track-theme list is data: surfaces, palette keys, prop sets, hazard sets), with class-restricted pools, acceleration zones, shortcuts, hazards, and a pacing linter
(`pacing-linter-rules`, `landmark-and-sightline-legibility`). A seeded generator is allowed only if the linter is its acceptance test and the stored plan, not the seed, is what ships (`seed-determinism-contract`).

### C3 Combat and economy depth

More weapons and one-race consumables (spikes, turbo boost, fuel, sabotage-like sneaky options, a shotgun-style close weapon), pickups on track, repair in increments, trade-in value, loans and debts, contraband-style side contracts, bonuses
(clean race, win streak, total destruction). Registry: `realtime-combat-semantics` (one HP authority, hit dedup, wreck as state tag, telegraph), `game-economy-tuning` (structure before numbers, faucet/sink band, no winner-take-all loop, tornado sweep), `encounter-balance-simulation` (2,000 seeded races per scenario).

### C4 Career v2 and rivals

A career ladder of many more events, named rival drivers with personalities as data profiles who buy cars and upgrades (an economy for rivals, not scripted), cups, a final duel, difficulty tiers by skill not power
(`skill-scaling-versus-power-scaling`), and a pacing simulation (2,000 seeded careers: races to first upgrade, to each tier, bankruptcy rate). Early-wreck fairness gets its own metric, because Phase 1 hardware sessions had both humans wrecked inside lap one.

## d. Integration (after both streams, one Astra run on a merge branch)

- **I1 Renderer integration**: a libGDX `TextureAtlas` loader with the **procedural drawing kept as the fallback for any asset missing or failing**, so the game never breaks on missing art. Cars, tiles, barriers, props, pickups, effects, HUD from the atlas;
  rotation, tint for liveries, damage-state swap, and decals driven from sim state through the existing read-only snapshot (the rules never see a sprite).
- **I2 Stick budget**: texture memory on a 1.7 GB device with a 32-bit userland. Declare a texture budget in MB per scene and per atlas page, measure PSS on the Stick (`dumpsys meminfo`), use ETC2 or reduce atlas sizes if needed, and keep frame time inside the Phase 1 figures
  (frame p50 16.7 ms, no growth over a 15-minute soak). If a heading strategy or an effect breaks the budget, it is cut, not tuned around.
- **I3 Gate G2** (owner): a session with real art on the Stick; the owner judges "better than the 1996 original?" Write `G2-REPORT.md` with evidence and the tier of truth for each claim (exists, valid, wired, behaves, felt); only the owner certifies felt.

## e. Ground rules

- No pixel of the original game, no extraction, decompilation, scraping of its art or audio, and no names, geography or tuning values copied from it. Study it only through public descriptions. Our names, tracks, cars and art are original.
- Grok usage is a **budget**: log every call in the generation history, stop at the first quota or rate-limit error, never loop on errors, and report spent versus remaining at the end of each batch. Do not delete or overwrite accepted assets; versions go to new ids.
- The Grok output is the owner's account usage. Do not run video generation unless a brief explicitly needs it (effect frames can be image sheets); video is out of scope for this phase unless the owner asks.
- Art lives under `deathride/art/` (briefs, style, raw is git-ignored, accepted assets committed under `deathride/assets/` with their sidecars). Keep the repo size sane: accepted atlas pages only, no raw dumps.
- One authority per number; build green at every commit: `:core:test`, `:link:test`, `:app:assembleDebug`; core stays pure JVM and deterministic with the zero-allocation guarantee.
- The Stick is at a DHCP address that changes; scan the /24 for port 5555. If it is offline, do the work that does not need it and say `not measured`.
- Each wave: design note first (`docs/concepts/deathride/<id>-*.md`), tests or gates with content assertions, a status row and a session-log entry below, one commit per wave on its branch, never push, no questions.

## f. Status table

| Stream | Id | Wave | Depends on | Status | Commit | Date |
|---|---|---|---|---|---|---|
| Art | P1 | Style bible, briefs, generation driver, budget guard | - | complete; ten raw candidates, not accepted | art-p1-20261001 | 2026-10-01 |
| Art | P2 | Post-processing, deterministic gates, local VLM grader, contact sheets | P1 | gates complete; human calibration pending | art-p2-20261001 | 2026-10-01 |
| Art | P3 | Car family: reference sheets, states, liveries, heading strategy | P2, C1 | ten references and heading decision; states/liveries await owner reference approval | art-p3-20261001 | 2026-10-01 |
| Art | P4 | World kit: tiles, barriers, props, pickups, decals, effects, HUD, portraits | P2 | 69 technical assets, 172 atlas regions; owner quality and I1 integration pending | art-p4-20261001 | 2026-10-01 |
| Content | C1 | Roster v2 (10 cars / five paired tiers) | - | core validated; Stick checked; owner feel not measured | fd6b51a | 2026-10-01 |
| Content | C2 | Tracks v2 (25 courses / five themes) | - | core validated; Stick checked; owner readability not measured | f922aa1 | 2026-10-01 |
| Content | C3 | Combat and economy depth | C1 | implemented / core and Stick checked; human fairness not measured | e1640f0 | 2026-10-01 |
| Content | C4 | Career v2 and rivals | C2, C3 | implemented / core and Stick checked; duration and boss pacing targets remain open | this commit (C4) | 2026-10-01 |
| Integration | I1 | Atlas renderer with procedural fallback | P3, P4, C2 | wired / GL and Stick checked; car families await approval | integration-i1-20261001 | 2026-10-01 |
| Integration | V1 | Reachable verge and complete linter mutants | I1 | verified on all ten sizes / green | integration-v1-20261001 | 2026-10-01 |
| Integration | IP | Endurance career and legal promotion fields | V1, C4 | measured mean 5.85-6.54 h; boss/tail/first-purchase limits retained | integration-ip-20261001 | 2026-10-01 |
| Integration | I2 | Stick texture and frame budget | I1 | 15-minute load/memory/median passed; tail/transition misses retained | integration-i2-20261001 | 2026-10-01 |
| Integration | I3 | Gate G2 report, owner session | I2, C4 | evidence/report complete; G2 owner quality/feel pending | integration-i3-20261001 | 2026-10-01 |

## g. Session log

(each run appends: wave, date, what changed, commands with results, what is `not measured`, spend of the Grok budget, next wave)

### C1 restart ? 2026-10-01

Reviewed and retained the interrupted WIP: ten IDs/shapes, migration, device harness and prior evidence. Applied the progression override: five paired tiers, shared derived-stat PR with calibrated data weights, explicit strength/weakness lint, and Champion decision skill. Corrected an uninformative entry-share instrument and retained rejected tuning evidence. Accepted 40,000 actual fixed-step races (2,000 per tier/scenario), independent raw-row audit, replay hashes, and serial/parallel equivalence. Maximum mixed class winner share 51.7875%; all tier budgets within 3%. See [C1 design and limitations](deathride/C1-roster-v2.md) and `deathride/evidence/phase2/c1-accepted/`.

Validation: `:core:test :link:test :app:assembleDebug` green (57 core / 3 link); `:core:rosterReport -ProsterSamples=1` matches twenty accepted first-seed rows; `python tools/audit-roster.py --calibrate` independently validates all 40,000 raw records. `/24` scan found AFTKM at 10.0.0.139. Installed APK; `content-check.mjs ... c1-restart` selected all ten classes and drove Quill to results at 35.10 seconds with 368 shots. This short wreck-prone combat result is not a fairness pass; C3 owns that work. Human feel, warning-color rendering, optical latency and physical-phone comfort: **not measured**. Grok calls/spend this restart: **0**; historical spend untouched. Next: C2 tracks.

### C2 ? 2026-10-01

Added twenty stored plans to the five retained circuits, five-theme metadata, competitive tier pools, real gravel inside-line shortcuts, clear acceleration sections, and feature/pacing lint. No drawing/art changes. `:core:test :link:test :app:assembleDebug` green (62 core / 3 link). Headless: 200 competitive and 100 unrestricted six-car races across all 25 courses; all finish, replay matches, zero warmed step allocations. Reproducible stored-plan hashes and results are in `deathride/evidence/phase2/c2-accepted/`; [design](deathride/C2-tracks-v2.md).

Scanned /24; AFTKM reachable at 10.0.0.139. Installed APK and selected/prepared all 25 circuits, then drove Quill to results. Initial High Pass readiness timeout is retained; repeat maximum course-selection/preparation observation 1.70 s. Owner readability/variety/feel and new landmark artwork: **not measured**. Grok calls/spend: **0**. Next: C3 combat/economy.

### C3 ? 2026-10-01

Added Scatter, four one-race utilities, class hull/utility budgets, cash pickups, ownership/trade, bounded fixed-fee debt, incremental manual repair alongside default insurance, optional contracts and bounded bonuses. Version 3 save migration preserves existing progress. Minimal host/controller command bindings expose the core features; no rendering art or asset changes. [Design and limits](deathride/C3-combat-economy.md).

Validation: 74 core / 3 link tests and APK green. Four ? 2,000 actual six-car scenarios: zero lead early wrecks / zero unresolved / zero one-shot kills; Crown has 154 later lead wrecks. Independent raw-row audit and four final-runtime replays pass. Economic sweep: 2,000 paths per scenario; baseline engine 2.007 / Club 8.6695 races under its explicit synthetic income assumptions, with physical career pacing deferred to C4. Evidence under `deathride/evidence/phase2/c3-accepted/`.

Scanned /24, installed on AFTKM 10.0.0.139, passed paired garage transactions, Scatter use, manual repair/trade, restart recovery and a protected Scrap career race. Human fairness/feel, physical-phone reach and new item artwork: **not measured**. Unrestricted practice retains its harsher combat. Grok calls/spend: **0**. Next: C4.

### C4 - 2026-10-01

Implemented The Ash Circuit: 35 events / five acts / all 25 courses, original three-line stories and six rival biographies/taunts with P4 keys. Rivals own saved garages and buy real shared-price parts from fixed sponsor grants and race income; remembered grudges affect decisions only. Rookie/Club/Pro share physical and monetary rules. Version 4 preserves v1-v3 property/progress, including all twelve old round positions, pending points and earned access. The finale is a true two-car Marrow duel; ordinary P2 retains the named boss and receives equal division prizes, while finale P2 spectates without consuming items or receiving a payout. No rendering art, art-directory or asset changes. [Design, measured curves and remaining work](deathride/C4-ash-circuit.md).

Validation: `:core:test :link:test :app:assembleDebug` green (83 core / 3 link). `:core:careerV2Report` runs 30,240 actual physical races (eight seeds per cell) and 2,000 sampled careers per setting, with 3,780 replay checks. A separate final-runtime single-seed run matches all 3,780 corresponding full-library rows exactly. `tools/audit-career.py` independently reconciles 214,470 settlements and plots/stamps the four curves. All 6,000 careers complete; zero bankruptcy / zero lap-one lead wreck. Best declared spending cap: eight parts by completion then mean PR, not proof of global optimality. Raw CSVs, audit, source hashes, plots and logs: `deathride/evidence/phase2/c4-measured/`; earlier calibration retained separately.

Measured first part: Rookie 1.75 / Club 2.00 / Pro 2.00 races; first Club car 7.00 / 7.42 / 8.42. Later tier intervals sometimes run faster than the proposed 7-9 races. Club opening P/F 0.8966 and finale 1.0570 meet their proposals; bosses 0.9245 / 0.9930 / 0.9984 / 0.9996 miss the proposed 0.85-0.90 dips. Active duration is 48.69 / 51.01 / 53.41 minutes, **not five to eight hours**. Remaining: longer race/series format with new validation, legal boss shopping/field composition and tier-join tuning, then owner judgment. Physical-library ratio mismatch reaches 0.06349; no human balance claim is made.

The /24 scan found AFTKM 10.0.0.139. Installed the build and checked two opening races, story/actual rival publication, v3 device-save migration and restart, a real final-duel fixture with P2 spectator, and an ordinary two-controller race with owned-car gate / named-boss retention / correctly scaled guest payout. A loss correctly retained the final event; on-device victory and an earned full-career device playthrough are **not measured**. Core tests cover victory/repeat season. Human story quality, sofa comfort, perceived tension, optical latency and a new thermal soak are **not measured**. OWNER-CHECKS updated. Grok calls/spend: **0**; historical WIP/spend preserved. No push. Integration and owner gates remain separate.
### P1, 2026-10-01 (restart of interrupted art work)
Design first in `deathride/P1-style-and-pipeline.md`. Preserved the inherited style, budget and eight charges; audited four interrupted jobs and issued new revision IDs. Explicit Grok session binding verifies the exact prompt and one image call, live quota observation latches stop, and resume refuses to spend on uncertain or corrupted prior outputs. `python deathride/tools/art/gen.py` now materializes all five cars and five tiles from `p1-current.csv`; a second run added zero reservations. Seven Python contract tests pass. `:core:test :link:test :app:assembleDebug`: BUILD SUCCESSFUL (47 up-to-date tasks). Car and tile raw contact sheets are in `deathride/art/contact-sheets/`. Eight new calls this wave; weekly ledger 16/180 images, 164 remaining, zero videos, no quota error. Car key colours and tile subject intrusion are visible defects for P2, not acceptance. Device and owner quality not measured. Next P2.
### P2, 2026-10-01
Design first in `deathride/P2-acceptance.md`. Added deterministic keyed extraction/despill/scale/pivot/gutters, palette and frame gates, full-resolution source and shipping-tile seam metrics, autocorrelation, and hash-bound acceptance reports/contact sheets. Historical Trail, Bastion, asphalt and oil defects are caught; exact numbers are in `deathride/art/ACCEPTANCE.md`. Both local Ollama models graded 30 frozen agent-labelled images (28 natural, two mutations): MiMo diagnostic false-clean 5/8 defect fields, Qwen 1/8; human-labelled calibration remains pending and models never accept. Initial schema failures are retained; confidence enum fixes their cause. Six Grok correction calls; empty material prompts remove vehicles, final oil passes pixel gates, gravel reaches its three-attempt cap still repetitive. Weekly ledger 22/180 reserved, 158 remain, zero videos, no quota error. Seventeen Python tests pass; `:core:test :link:test :app:assembleDebug` BUILD SUCCESSFUL (47 up-to-date). Owner sheets per batch under `deathride/art/contact-sheets/`. Device/owner quality not measured. Next P3, with explicit reference approval dependency preserved.
### P3, 2026-10-01
Design first in `deathride/P3-car-family.md`. Captured the C1 ten-class scale authority from `09d849d` read-only, with hash and integration mismatch checks. Ten invariant references pass pixel gates after one Needle camera correction and one Kestrel margin correction; both local models supplied semantic and family observations. Per-class and batch owner sheets are in `art/contact-sheets/`. Prepared 40 state and 30 livery briefs, but generated none: the plan explicitly requires owner reference approval first, and no new reference has that approval. The driver rejects missing evidence or changed reference bytes before any spend; approval remains pending without a question.
The approved original Line provided a small conditioning control: silhouette IoU 0.9980 with image_edit versus 0.9499 without a reference (one per arm). A generated 16-heading sheet had sixteen cars but failed heading sequence and added grid lines. The isolated AFTKM probe measured one/16/32 representations at p50 16.753/16.776/16.758 ms and 0.25/4/8 MiB RGBA storage; runtime rotation is preferred. PSS, p95, raw logs and screenshots are recorded; the prior game activity was restored. Full gameplay performance, soak and owner quality remain not measured. Findings are in `PITFALLS.md`. Twenty Python tests pass; `:core:test :link:test :app:assembleDebug` BUILD SUCCESSFUL. Fifteen image calls this wave; weekly ledger 37/180, 143 remain, zero videos, no quota error. Next P4; revisit derived car states only after exact reference approval.
### P4, 2026-10-01
Design first in `deathride/P4-world-kit.md`, with recorded local-remedy and C4-preview addenda. Versioned briefs, one-image proofs, bounded corrective generation and both Ollama graders produced 73 current review records: 69 technical selections, two seam-failed originals superseded by measured wrap derivatives, and two visually rejected ice exports. The final ice centre crop and gravel unique period have retained fixed trials and direct 2x2 review; numeric gates were not loosened. Effects have six distinct exported phases, fixed pivots, durations, cell/key gates and separate model observations of actual exported pixels. Every batch has owner contact sheets; `deathride/art/review.html` is the review entry point.
Immutable `deathride/assets/phase2-v1` contains four libGDX atlas pages with 172 regions, eleven repeating ground textures and five separately resident backdrops. Track-edge and barrier families each contain all 47 physical cases with all 256 masks resolved. C2's five themes/25 tracks and all C3 weapon/consumable IDs are covered from committed Content `e1640f0`; C1 dimensions remain byte-identical to the P3 snapshot. A sixth portrait, Marrow, is sourced from hash-recorded uncommitted C4 data and remains explicitly provisional. Declared art residency is 30.75 MiB including two reserved car pages and one backdrop. The old 3072-square scenery target, fonts and runtime overhead require I1/I2 reconciliation; assets are not yet wired into the APK.
`python -m unittest discover -s deathride/tools/art -p test_*.py`: 30 pass. Standalone bundle validation passes hashes, visible pixels, packing, content aliases, frame metadata, autotiles and residency. The actual libGDX 1.13.5 parser reads all four atlases/172 regions. `:core:test :link:test :app:assembleDebug`: BUILD SUCCESSFUL, 47 up-to-date tasks. P4 spent 93 image reservations; weekly total 130/180, 50 remain, zero videos. This execution added 122 reservations to eight inherited charges; 126 outputs succeeded and four inherited interruptions remain conservatively spent. One false stop matched output_tokens=429; exact successful-session evidence recovered the existing image with zero new calls, and contextual/nested error tests now distinguish real quota status from usage numbers. No actual quota error was observed.
Not measured/remaining: owner approval of ten exact car references before 40 state and 30 livery jobs; human-labelled grader calibration; committed C4 reconciliation; I1 renderer/fallback integration; I2 full-game texture/frame budget and Stick soak; G2 owner quality/feel. The remaining 50-image capacity is reported, not consumed on arbitrary variants or across the owner reference gate. No push. Next handoff is I1 plus those explicit outstanding gates.

### I1 - 2026-10-01

[Design and limits](deathride/I1-atlas-renderer.md). Packaged the immutable world/UI atlas kit, repeating tiles, cached road geometry, barriers/props/decals, bounded catalog-timed effects, hull-relative HUD, rival portraits and one story backdrop. Added fixed read-only combat snapshot fields. Missing/failed pages retain procedural drawing; all ten car references remain unapproved, so production car states/liveries are absent and procedural cars remain. Runtime car rotation/pivots, state lookup and optional panel tints are wired for approved future assets. The old 36 MiB scenery target is now 16 MiB; live road quads preserve texture detail.

`:core:test :link:test :game:test :app:assembleDebug` green: **84 core / 3 link / 2 renderer tests**. Actual GL upload/draw and missing-catalog/failed-page injection pass; no-art desktop smoke reaches a race. /24 scan found AFTKM at 10.0.0.139; final installed APK selected all ten cars and all 25 courses, captured real art during normal LAN driving, showed story/portraits and recovered from Home/resume. Fixed the discovered new-track/old-ready telemetry race. The final practice probe reached a result at 17.18 seconds with 118 shots; short practice wrecks remain visible and are not fairness evidence. Evidence/manifest/logs: `deathride/evidence/phase2/i1-*`.

Not measured: approved car art behavior, owner quality/feel, full-game sustained memory/frame budget (I2), revised C4 endurance/boss pacing. New Grok spend **0**; historical 130/180, **50 remain**, zero videos. No push. Next: forge verge/lint correction, physical career pacing, final I2 soak and I3 owner report.

### V1 - 2026-10-01

[Design and result](deathride/V1-verge-and-lint.md). Reproduced the unreachable centre-only verge on all ten roster cars, both sides; saved the failing regression and before/after rows. Surface detection and AI look-ahead now use the outer lateral collision radius for kerb/verge, retaining centre queries for authored interior materials. Walls, widths and car geometry are unchanged. Added the six missing base linter mutants plus nine feature/content mutants.

`:core:test :link:test :game:test :app:assembleDebug` green: **87 core / 3 link / 2 renderer**. All 20 edge cases now experience Offtrack drag, with reachable kerb and unchanged asphalt centre; deterministic replay and zero-allocation tests pass. Evidence: `deathride/evidence/phase2/v1/`. Old physical outcome hashes are superseded for current-runtime claims; IP will rebuild its library. Owner handling/fairness remains not measured. Grok spend **0**, still 130/180 with **50 left**. No push. Next: IP career format, legal boss fields and measured pacing.

### IP - 2026-10-01

[Design, actual curves and limits](deathride/IP-career-pacing.md). Career now uses 18/21/24 laps with matching TV/phone finish and timeout rules; practice stays at three. Promotion opponents buy the next division through the common shop one event early and retain purchases across the join. No HP, damage, reward, repair or player-dependent power change. Removed stale measured columns from runtime curve data; authoring tools reproduce the new format.

Green `:core:test :link:test :game:test :app:assembleDebug`: **89 core / 3 link / 2 renderer**. The current library has **15,120 physical races**, **3,780 first-seed replays**, four independent seeds per cell and six upgrade bands. All **6,000 sampled careers** complete; the independent audit checks **215,895 settlements**. Mean active hours **5.850 / 6.102 / 6.535** now meet the mean duration target, with zero sampled bankruptcy or lap-one player wreck. Eighty-five samples exceed eight hours, including an 11.697-hour Pro tail. First purchases are early in Rookie/Club; following-tier intervals meet seven-to-nine races. Boss ratios **0.9279 / 0.9428 / 0.9311 / 0.9625** still miss the proposed band. Field joins improve to approximately **0% / +2.0% / +0.6% / -0.4%**, but the player still drops 4.93% at the Pro join and the upper field plateaus. Hard PR ceilings and nearest-band error are retained, not hidden.

Stick opening: two completed 18-lap races at **466.92 / 587.87 s**, one payout each and nested save recovery. Exact IP release finale: an isolated funded **24-lap duel, 873.38 s, second place**, correctly remains round 35; P2 spectator keeps cash/debt/item/race count. Interrupted foreground attempts stay in evidence. The IP live shot exposed an inactive-slot HUD footer overlap queued for I2. Evidence: `deathride/evidence/phase2/ip-*`, including compressed raw rows, plots, source/APK hashes and failed/successful logs.

Not measured: human endurance comfort, story/tension, owner quality/feel. Late boss dips, first-purchase timing, trade/field discontinuities and retry tails remain documented. Grok spend **0**, still 130/180 with **50 left**, zero videos. No push. Next: final I2 guarded-loader/HUD checks and full Stick budget soak, then I3/G2 handoff.

### I2 - 2026-10-01

[Design, budgets and all retained runs](deathride/I2-stick-budget.md). Declared 32 MiB art / 4 MiB page / 52 MiB owned textures and 192 MiB PSS; loader checks PNG dimensions/residency before decode and rejects malformed region/animation metadata per entry. Cut hidden scenery grain, duplicate road passes and duplicate procedural effects; cosmetic pool 96 to 64. Corrected inactive-duel-slot footer overlap. Procedural fallback and combat cues remain.

Green `:core:test :link:test :game:test :app:assembleDebug`: **89 core / 3 link / 3 renderer**. Final all-ten-car/all-25-course/story/Home-resume checks, two-entrant HUD and real-GL failure injections pass. Scanned AFTKM at 10.0.0.139; installed APK hash matches the measured release. Final **900.024 s** load completed 11 races/five themes, accepted 27,001 inputs per seat at 30.0003 Hz, with zero rejections/host stalls. PSS **107.018-115.502 MiB**, warm median change **-0.155 MiB**, linear trend **+0.04993 MiB/min**. Owned textures **37.970 MiB**. Active p50 **16.574-16.812 ms**; p95 **21.644 ms** and max **34.920 ms** still miss declared tail comparisons. Initial/preparation peak **241.275 ms**, discarded simulation **741 ms** and three initial stale consume samples per seat remain visible. Previous failed load/rejection runs remain archived. Evidence: `deathride/evidence/phase2/i2-*` and `i2/manifest.json`.

No sustained median/residency failure remains; tail stalls, future approved car pages, cold/contended/other-device behavior, optical latency and owner feel remain unqualified. Grok spend **0 images / 0 videos**; none of integration's initial 50-image allocation used. Parallel art spending/cap changes are separately scoped in G2, not adopted as authorization. No push. Next: I3 source-bound owner handoff.

### I3 - 2026-10-01

[Design and closure](deathride/I3-owner-handoff.md). Wrote [G2-REPORT](deathride/G2-REPORT.md) with a truth tier per claim, current source/APK/evidence bindings and a concrete owner checklist. Updated README/OWNER-CHECKS and linked the historical C4 pacing report to its measured successor. Car rotation/states/tints remain wired-only pending exact approved assets; owner quality/feel is not assigned by automation. All duration, boss/first-purchase/transition/retry limitations and frame-tail misses stay visible.

Final `:core:test :link:test :game:test :app:assembleDebug`: **BUILD SUCCESSFUL**, **89 core / 3 link / 3 renderer tests**; **30 art-tool tests** also pass. Final build, measured soak APK and installed `base.apk` share SHA-256 `871346fef88691cdea96dfbdb6fab33496076cd40f2509051b29b8ba2d0150d0`. I3 manifest binds four prior wave commits and the final reports. All report links and current I2 source/evidence hashes were checked. Earlier failed observations remain retained; no earned full-career device or human fairness claim.

Grok integration spend **0 images / 0 videos**, none of its initial 50-image allocation used. Timestamped local ledger snapshot records integration 130/180 and concurrent art 198/350 separately; the latter cap was not adopted by this run. Owner references, G2 felt, human-labelled grader calibration, audio, physical-phone/optical and wider hardware/network qualification remain pending. Device returned to lobby before the coordinated final art-lab window. Five local integration waves complete; **never pushed**. Next work belongs to the recorded owner/content/art/performance checklist, not an automatic G2 pass.
