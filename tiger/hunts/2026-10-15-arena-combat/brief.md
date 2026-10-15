# Territory dossier - arena combat and feel (packages/core/src/arena, packages/game/src)

Commit: 64d55fef48 - written 2026-10-15

Anchors are repo-relative at this commit. `packages/core/src/arena/data.generated.ts` is
gitignored (built by `packages/core/scripts/compile-arena-data.mjs` from
`docs/design/reconciled/data/arena/*` and `art/scale-contract-v3.json`), so numbers are
anchored in those source files, never in the generated file.

## Why this area

Mage Arena is an action RPG with two halves that feed each other: a Persona-style camp run by
an LLM Director, and an arena of top-down real-time combat with spell tiers on a 15 s collar
clock and a mana-costed directional absorb with a perfect window (docs/MAGE-ARENA-PLAN.md:9-12).
The arena is where the season pays out (food, gold, renown) and where the game ends: the
Breaking, the ending, "is the absorb mechanic played as trust" (docs/MAGE-ARENA-PLAN.md:12).
It is the hottest code in the repo over 180 days. `tiger hunt` measured heat 97 (151 commits)
for packages/game/src and 40 (54 commits) for packages/core/src/arena, the two largest
feature areas. The owner chose it for this hunt over the camp Director and the season bridge.
In the owner's own words it is also the part they trust least: "I see the combat now as the
weakest point" (docs/MAGE-ARENA-PLAN.md:249, D31) and "most painful is the design of the
characters and their one-axis movement" (docs/MAGE-ARENA-PLAN.md:230). Since then the
waves CF1, CF2, H1, U6, U6b and U6c rebuilt feel, hits and presentation. This hunt asks
what would make it formidable.

## Who uses it, for what

- **The player** (Windows, mouse and keyboard first; gamepad works). Before a Games day they
  build a three-line composition. In the arena they run four Tiro bouts (soldiers,
  creatures, a mage semifinal, a mage final) to earn missio, gold and renown, which feed back
  into camp. The design intent is a battle mage "overpowering with sparkles and energy", in a
  "raw and brutal tone" (docs/MAGE-ARENA-PLAN.md:173). "Magic is absorbed, steel is rolled,
  unblockable is left or broken" (docs/gameplay/opponents-and-arena-tiers.md:10).
  Done well means reads, decisions and mastery: a perfect absorb that shortens the clock to
  the next tier.
- **The owner** is the only judge of feel (docs/MAGE-ARENA-PLAN.md:138). They tune in the
  Combat Feel Lab: they freeze, step, replay and export tuning with seed and setup "for your
  feel report" (packages/game/src/lab-ui.ts:748-750).
- **Agents** verify by headless census and screenshots (docs/MAGE-ARENA-PLAN.md D5).

## What it does today

**Kernel** (packages/core/src/arena/kernel.ts):
- `stepArena` runs one fixed 60 Hz tick over absolute InputFrames (kernel.ts:275-292).
- For each actor it updates, in order: water state, regen, encase or stagger gating, facing
  from the aim point, ward, move, release cast, start cast. After the actors it updates
  telegraphs, projectiles, zones and the collar clock.
- Seeded Mulberry32 with every draw logged with a purpose (kernel.ts:19-28). FNV-1a state
  hash over the full state (kernel.ts:303-308). `FixedStepper` clamps frame delta to 0.25 s
  (kernel.ts:309-316).
- A test bans Math.random, Date.now, performance.now and DOM from source
  (kernel.test.ts:129-132).

**Mechanics:**
- Walk 4.5 m/s, sprint 6.5 m/s.
- Roll: 4 m in 0.35 s, 0.25 s i-frames, 25 stamina, edge-triggered (kernel.ts:141-146).
- Accel 60 and brake 90 m/s² (packages/core/src/arena/data/feel.json:4-5).
- Directional ward: 140° arc (docs/design/reconciled/data/arena/combat.json:50), raise cost
  5 mana, drain (30-3*nerve)/s, exhaustion latch (kernel.ts:122-132).
- Perfect absorb: a magic hit within 0.15 s (9 ticks) of a fresh raise. It refunds
  10*tier*(1+0.1*nerve) mana and pulls the next collar tier 2 s earlier (kernel.ts:76-83).
  Holding through a stream perfects only the first hit (kernel.test.ts:53).
- Collar unlocks at 0/15/30/45 s with a minimum 6 s gap (combat.json:38; kernel.ts:267-273).
- Casting pays at start. Release comes at max(cast, telegraph). A roll can cancel before 65%
  of the cast (kernel.ts:139; feel.json:16), followed by 0.05 s recovery
  (packages/core/src/arena/water.ts:32-60).
- Staff strike replaces slot 0 within 1.6 m (kernel.ts:193-198).
- H1 stagger: clamp((0.1+0.003*dmg)/poise, 0.1, 0.2) s plus a 0.18 s immune tail. It
  interrupts casts and telegraphs (kernel.ts:47-51, 96-108). DEFEATED is atomic (kernel.ts:53-68).
- Swept projectile hits with pierce and burst dedup (kernel.ts:239-266).

**Water catalogue:**
- 24 spells parsed from docs/design/reconciled/data/arena/spells-water.csv
  (packages/core/src/arena/catalog.ts:15-53).
- Rain Needle is the fixed slot 1. Five lines (tide_orb, lash, mire, mend, mirror), tiers
  I-IV, A/B branches at tiers II and IV (catalog.ts:54-74).
- Flow: +1 when a different line is cast within 2 s, reset on a repeat or after 3 s idle,
  +6% damage per stack, +1 on a perfect. At 5 it becomes a free x1.5 Crest
  (water.ts:11-22, 101-120).
- Mirror-A reflects on a perfect (water.ts:130-136).
- Warning floors are 0.8 s for unblockable and 0.4 s for positional. `lintSpells` enforces
  them (catalog.ts:75-86).

**Opponents** (packages/core/src/arena/enemies.ts, mage-ai.ts):
- Four soldiers (conscript, shieldman with a front block, kiting slinger, netter with a
  root).
- Four creatures (cinder_hound pack with engagement slots, mire_maw, thornback charge with a
  wall stun, hush_moth mana drain) (docs/design/reconciled/data/arena/enemies.json).
- AI mages run on the same kernel and stats. Competence 1-4 is interpolated, with caps of a
  reaction delay ≥0.25 s and perfect chance ≤0.45 (mage-ai.ts:9-16; enemies.json:188-234).
- The AI builds a line-of-sight-filtered threat list, then decides absorb, perfect or roll,
  spacing, a lead-aimed shot and a spell choice by counter, sustain, line change and damage
  (mage-ai.ts:22-114).

**Games** (packages/core/src/arena/games.ts):
- Only Tiro is wired (games.ts:8). Four waves with seeded spawn jitter.
- Between waves: heal 30% of missing HP, refill mana and stamina, reset the collar
  (kernel.ts:293-302).
- Single idempotent payout: gold 20/40/60/100, renown 5/10/15/25 (games.ts:44-50;
  arena-tiers.json).
- `runFight` runs a headless bout with a reference AI player (games.ts:71-84).

**Presentation** (packages/game/src; it never writes sim state):
- `ArenaGame` steps the kernel through FixedStepper with render interpolation
  (packages/game/src/arena-entry.ts:856-970).
- Season bouts flush inputs to the server in batches with a bout hash. A desync pauses with
  "Checkpoint failed" (arena-entry.ts:539-558, 913-923).
- Composition screen: preset tabs, three line slots, A/B toggle, four-tier evolution panel
  (packages/game/src/game-shell.ts:1606-1779).
- Results flow: intermission, Tiro victor or Missio, and return to camp with a receipt
  (game-shell.ts:1863-1955).

**Feel layer** (packages/game/src/combat-feedback.ts, data in packages/game/data/combat-feedback.json):
- Hit stop of 2+floor(dmg/20) frames, capped at 3, only when the player is involved
  (combat-feedback.ts:18-70; arena-entry.ts:1003-1004).
- Perfect-absorb time compression: 0.12 s at x0.35, with a ward squash.
- Shake of 0.28 px per damage, capped at 6 px. White flash, directional recoil, red edge
  cue.
- Pooled damage numbers; perfects show "+x mana" in cyan (combat-feedback.ts:132-236).
- Reduced motion turns all of this off (game-shell.ts:2041-2057).

**Telegraphs:** A13 painted sigils on a GLSL shader, with a rank-mask fill for progress,
cone polar warp, lane rails and an `absorb.window` glyph while the perfect window is open
(packages/game/src/sigil-player.ts:171-376). The procedural fallback is coloured by threat
family (packages/game/src/arena-scene.ts:37-43, 181-334).

**Audio:**
- Spatial cues for cast, hit, stagger, roll, perfect and collar, with policy admission
  (arena-entry.ts:971-1013; packages/game/src/audio-policy.ts:112-144).
- Per-tier music playlists with a 2 s crossfade (packages/game/src/audio.ts:386-446).

**Camera:** 55° oblique orthographic, a wide dead zone, zoom locked at 0.75
(packages/game/src/camera.ts:59-150; packages/game/data/camera.json).

**HUD:** vitality, mana and stamina bars; four slots with cooldowns; FLOW n/5; the collar
clock with "Next rune in Xs"; a cast bar labelled "Shaping / roll cancels" or "Committed";
and "PERFECT ABSORB +x MANA" (arena-entry.ts:578-855).

**Combat Feel Lab** (packages/game/src/lab-ui.ts; packages/core/src/arena/lab.ts):
- Targets: dummy, AI mage or the four creatures. Settings for school, competence, seed,
  aggression and distance.
- 40 live tuning fields over 7 pages, plus per-archetype spell overrides. Presets Current,
  Snappier and Heavier (feel.json:36-66).
- A 20 s replay ring with step and pause. Hotkeys R/P/./G/H/T/L/V.
- Metrics line: hits, absorbs, perfects, staggers, cancels, damage per mana, time to kill
  (lab-ui.ts:118-198, 499-737, 837-865).
- Fire, Earth and Air are only multiplier profiles over the Water archetypes
  (packages/core/src/arena/data/lab-schools.json:2-38).

**Unusually strong** (this is what to evolve):
- Byte-exact determinism with serialized continuation (hit.test.ts, feel.test.ts,
  lab.test.ts). A season replay of 1,300,369 bytes has kept the same hash since H1
  (docs/waves/U6c-report.md:125-127).
- Visuals are event-sourced and re-derive from `state.events` on a state swap, so replays
  render correctly (combat-feedback.ts:99-113; sigil-player.ts:106-116).
- A 2,000-fight census per wave (packages/core/scripts/report-w4.ts).
- One authority per number: the data compiler throws on contradiction
  (compile-arena-data.mjs).
- AI fairness: the same kernel for the AI, with competence living only in its inputs.
- A deep, opinionated tuning Lab.

## Measured state

All of this is simulated or headless. **No mechanic has been felt by the owner yet**: gate G1
is open (docs/gameplay/status.md:4).

- **Tests:** `npx vitest run` on 2026-10-15 passed 226/226 across 33 files, including
  uncommitted quest tests outside this area. Arena core has 76 `it` cases; packages/game/src
  about 55. `npm run gate` fails at lint today only on the uncommitted
  packages/core/src/quest.ts (2 prefer-const), which is outside this area.
- **Pacing census (H1, current):**
  - 2,000 fights per wave. Medians: soldiers 36.03, creatures 45.93, semifinal 57.10,
    final 62.00 s. In band: 90/90/88/93%.
  - U6c reran all 8,000 fights with records identical to H1 (docs/waves/H1-report.md:73-81;
    docs/waves/U6c-report.md:128-133).
- **Reference duel win rates** after CF2 fell from 91.45%/70.35% to 38.25%/39.70%. Whether
  that difficulty is right is an open owner check (docs/waves/CF-report.md:85-87).
- **AI competence ladder:** reference wins out of 500 were L1 443, L2 287, L3 115, L4 184.
  **Level 4 is weaker than level 3** ("over-defends", logged for W9, with no fix in code)
  (docs/waves/W4-tiro-games.md:45; docs/gameplay/opponents-and-arena-tiers.md:55).
- **Perfect-absorb bots** (W2): leads of 0-8 ticks give a perfect rate of 1.0; 9+ ticks give
  0. A bot that perfects 40/40 unlocks tiers at 0/9/18/27 s instead of 0/15/30/45
  (docs/waves/W2-evidence/bots.json).
- **Lab duels**, 100 seeds per school (Water reference L3 vs L2 profile):
  - Wins after CF2: Fire 21, Water 32, Earth 53, Air 8 (docs/waves/CF-report.md:53-63).
  - H1 winning time to kill is about 65-72 s (docs/waves/H1-report.md:51-58).
- **Performance** (U6c): 60.002 fps with 12 figures and 100 projectiles. Decoded textures are
  325.716 MiB, only 4.284 MiB under the 330 MiB threshold (docs/waves/U6c-report.md:144-153).
  CPU p95 is 1.2-2.6 ms against an 8 ms budget.
- **Not measured:**
  - Physical input latency (docs/gameplay/combat-feel-lab.md:151).
  - Whether humans perfect more or less often than bots (docs/gameplay/ward-and-absorb.md:91).
  - Human difficulty, audio mix and subjective weight.
- **Registry:** declared (software-engineering), unmapped; no context map or registry map.

## Recent history (90 days, from git log and wave reports)

- **CF1:** the Combat Feel Lab (4805492).
- **CF2:** cast commitment, impact feedback and measured pacing (0d2e5f8).
- **U5:** compact A12 arenas and figures enlarged 50% (a009284, D32).
- **U6:** painted A13 sigils (dde5f2f, after D34 "sigils look like geometry in elementary
  math").
- **H1:** damage stagger, visible struggle and persistent corpses (3e349a4, after D36/D37).
- **U6b and U6c:** A14 reaction clips and AU3 tracks (8aa0f33, 4d0c06e..1ccfd04).
  U6c changed no sim, tuning or save version.

**Rejected by the owner. Do not re-propose these:**
- Near tracking camera and browser-page presentation (docs/OWNER-CHECKS.md:153).
- A close camera with large characters.
- Paper or book grain under moving figures.
- Absorb sounds that sound like "a notification" or "a cartoon effect". The target is "an
  energy barrier stopping and slowing down another energy source".
- Soccer-like crowd sound; it should be "raw and bloodlust".
- Looping music; the owner wants full 2-3 minute tracks.
- Calming effects in the generator rather than in the app (docs/MAGE-ARENA-PLAN.md:156-234).

## Known limits and open questions

- **Only Water is playable.**
  - Fire, Earth and Air catalogues and their resources (Heat, Footing, Momentum) are planned
    for W8 (docs/gameplay/status.md:32). Season mage opponents are Water proxies
    (docs/gameplay/opponents-and-arena-tiers.md:53).
  - The HUD hardcodes the water icon and the "Cassia of the Tide" heading
    (arena-entry.ts:595,639).
- **Only Tiro is wired.** Veteranus, Primus and Summa exist in arena-tiers.json for W9.
  Mastery and tier eligibility are never awarded (docs/gameplay/open-questions.md:55-58).
  Lethal bouts are reserved.
- **Designed, not built, with no wave:**
  - Crowd mana flask (renown ≥40 in a final).
  - Gear (talisman, garment).
  - Guile scouting.
  - Borrowed line from a sworn cross-tent friend (combat.json:81).
  - Burning and wet statuses: the art exists, but only slow, root, ward, sheen and encase
    are simulated.
- **Data with no reader:** `aimMode` soft-lock (combat.json:31), `interruptsCasts`,
  `threatLanguage`, `usesTierCurve`, `trialWeights`, and several presentation keys in
  packages/game/data (whiteFlashS, anticipationOpacity, cast/hit/barrier/deathOpacity,
  hitHoldMs).
- **Ward facing:** the data says to face the aim direction if aiming, otherwise the
  movement facing. The code always faces aim (kernel.ts:286).
- **AI:** level 4 is weaker than level 3. Lab creatures are stationary.
- **Presentation:**
  - 12 priority and 12 other animation slots fall back (docs/waves/U6c-report.md:77-93).
  - Adaptive music is disabled pending delivery gates.
  - The `perfect` cue reuses a collar sound; there is no dedicated absorb or crowd audio.
  - The HUD covers the southern rim (docs/gameplay/open-questions.md).
  - Texture headroom is 4.3 MiB.
- **Open owner checks:**
  - Is the 0.15 s perfect window right?
  - Threat readability.
  - Does each Water line earn its slot?
  - Is Flow readable?
  - Difficulty after CF2.
  - Current, Snappier or Heavier?
  - H1 interruption feel.

## Constraints

- **Stack:** TypeScript and PixiJS in the browser; Node 24. The core is pure: no DOM, no
  Date.now, no Math.random, and every draw is seeded and logged (docs/MAGE-ARENA-PLAN.md:54,137).
  Presentation never changes the simulation.
- **One authority per number.** Numbers live in docs/design/reconciled/data or
  packages/*/data, and the data file wins over prose (docs/MAGE-ARENA-PLAN.md:61,70,136).
  A proposal that changes a number names the data file it edits.
- **Census rules:**
  - Never pad time, force outcomes, refill resources or secretly scale HP.
  - Never discard losing seeds or retune a band just to pass.
  - No unreviewed global damage buff (docs/waves/W4-tiro-games.md:27-31;
    docs/waves/CF2-combat-feel-design.md:20).
- **AI fairness:** reaction floor 0.25 s, perfect chance ≤0.45, never reads future inputs.
  Warning floors of 0.4 s and 0.8 s are never shortened.
- **Budgets:**
  - 60 fps with 100 projectiles; CPU p95 ≤8 ms; texture ≤330 MiB (4.3 MiB left).
  - Art generation is at 382/450 charges with provider latches. Audio credits are
    effectively spent.
  - So prefer moves that need no new generated art or audio, or name the asset gap
    explicitly.
- **Determinism is a feature:** a change to kernel behaviour must keep replay and hash tests
  green or bump the save version deliberately.
- **Gate:** `npm run gate` (build, eslint --max-warnings 0, vitest, node reference tests,
  design checker). Commits stay local; no push.
- **Out of scope for this hunt:**
  - The camp, the Director and Parley.
  - The uncommitted quest engine (packages/core/src/quest*.ts, story/).
  - Generating new art or audio.
  - Fire TV.
  - Full W8 school catalogues. A seat may propose a slice of one if it is the strongest
    move, but must size it honestly.
- Owner feel is the final judge. A good proposal makes a feel question decidable faster
  (Lab, replay, metrics) or makes the fight better on evidence. It does not claim a feel
  verdict.
