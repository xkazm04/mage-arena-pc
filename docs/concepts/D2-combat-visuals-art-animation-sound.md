# D2. Combat visuals: an original art direction, animation and sound for PC

Status: **direction menu**, written 2026-10-23 for future sessions; nothing here is built. The best-case target images
to generate first are in `docs/concepts/D4-visual-target-prompts.md`. Those images feed the engine spike in section 5,
which decides between PixiJS and a native engine.

## 1. The owner's words

> "Visual part of combat - Mastering assets to achieve original art directions, animations and sound effects of the game"

> "I fear almost no asset will be reusable from FireTV version due to its oldschool graphics and camera from top to bottom."

> On tech: "We will need to spike there [...] create image generation prompt for Leonardo with expected ceiling/to-be state [...] whether PixiJS can be beautiful and chase, or whether to jump into native engine"

All four art routes are in scope: new generated content, animation depth, procedural/shader effects, and a remaster for
PC resolution. Sound aims at full cue coverage per the Audio Bible, then an owner listening pass.

## 2. Where things stand

| Area | Today | Evidence |
|---|---|---|
| Style bible | "Covenant family": sculpted volumes, pale layered cloth, dark lower silhouettes, worn metal, localized magic; element identity by shape and value (flame forks, water crescents, angular stone, branching wind) | `art/STYLE.md`; decisions D16-D20 in `docs/MAGE-ARENA-PLAN.md` |
| Camera | Far, fixed, 55° elevation, zoom locked at 0.75, 30 px/m at 1080p | `packages/game/src/camera.ts`, `data/camera.json` (D17) |
| Bodies | Painted billboards, 4 directions x 9 states (`animation-contract.ts`), 384 px frames drawn at about **60 px** at 1080p | `assets/accepted/covenant/a10`, `characters.json` |
| Who has a body | Cassia, Brennic, Garran, Iskar (gaps: Iskar run se/sw, Garran absorb/hit ne/nw); humanoid enemies mostly; creatures rear-only; Cinder Hound none; **no Lio or Nysa**; `rivalBody: "cassia"`, so **every rival renders as Cassia** | `data/animation.json`, `characters.json` backlog (97 entries) |
| Effects | a8 atlas: one generic clip set per element (cast, travel, impact, hit, aura, telegraph), absorb clips | `a8/effects.json`, `effect-player.ts:160-215` |
| Telegraphs | a13 sigils support only **ring, cone, line**; Sunfall's meteor shadow, beams, dash trails and Veering Bolt's arc have no art | `sigil-contract.ts`, W8 concept A1 |
| Fire/Air identity | no Heat or Momentum meter, no per-spell choreography | W8 concept, presentation lane P (unbuilt) |
| Feedback | hit stop, flash, shake capped at 6 px, perfect slow-motion; blending tuned for a distant TV viewer | `combat-feedback.ts`, `data/combat-feedback.json` |
| Budgets | `maxSprites` 256, `maxOneShots` 64, `cpuBudgetMs` 2; desktop at 60 fps (TV-era measurement) | `data/animation.json`, `docs/waves/P1-tv-performance.md` |
| Generation | agy is the only working provider (Grok latched on HTTP 402); about 382 of 398 budgeted images used; no true inpainting or alpha | `art/budget.json`, `docs/PROVIDER-LEDGER.md` |
| Sound | 25 files (casts per element, one hit, one impact, roll, collar, UI, voice, 6 music tracks); AU4 mix awaits the owner's listening | `packages/game/public/audio`, `data/audio.json` |
| Sound gaps | no death, absorb raise/hold/contact, telegraph/warning, status, projectile travel or crowd cues; one hit sample; `stagger` is triggered but has no cue; no Heat/Momentum or beam sounds | `arena-entry.ts:1415-1454`, `docs/audio/AUDIO-BIBLE.md` |

**Reuse audit (the owner's fear, checked against the code):** the painted assets are tied to the far 55° camera and
the 60 px body scale. A closer or lower camera makes the bodies, plates and effects read as too small or too flat, so
the owner is right that most combat art would be redone. What carries over is **code and contracts**: the
event-to-effect mapping, the sigil and body players, budget shedding, the feedback system, the audio engine and its bus
rules, and the style bible's element-identity rules.

## 3. Goals

1. A frame of combat that is **original and beautiful at PC resolution** (1440p as the reference, 4K clean).
2. Every school and every rival **reads at a glance**: body, colour language, spell shapes, resource state.
3. Animation that **sells cause and effect**: windup, release, travel, contact, reaction.
4. Every combat event the player must answer **has a sound**, and the mix tells you what is dangerous.
5. The style and pipeline decision (Pixi or native) made from **evidence**, not taste alone.

## 4. Candidate directions

### 4.1 Camera and art direction (decide first, it determines every asset)

| Option | Look | Cost |
|---|---|---|
| **A. Closer 3/4 painted 2.5D** (recommended to test first) | lower camera (35-45°), bodies at 140-200 px, painted billboards with normal-mapped lighting | keeps the Pixi stack; every body re-generated at the new scale |
| B. Stylised 3D | low-poly or toon-shaded 3D models, real lights, rigged animation | likely a native engine; new pipeline (modelling, rigging) |
| C. Hybrid | 3D-rendered character sprites baked to atlases, painted arenas | Pixi stays; a 3D pipeline only offline |
| D. Remaster the current direction | same camera, upscaled and repainted assets | cheapest, but does not answer the owner's fear |

### 4.2 Art content

- **Bodies**: a distinct body per rival (end the Cassia re-skin), Lio and Nysa, Cinder Hound, creature front views; more
  directions (8) if the camera gets closer.
- **Arenas**: plates painted for the chosen camera, with parallax layers and lighting.
- **Budget**: the 398-image budget is nearly spent. A new direction needs a new budget decision, and possibly a second
  provider (the doc for this direction's spark should price it).

### 4.3 Animation depth

- Per-spell cast clips (Brand Lance draws back, Sunfall raises both arms) instead of one cast per element.
- Movement clips: dash (Cinder Step, Slipstream), knockback (Ring of Cinders), stagger, root, slow.
- Choreography: windup -> release -> travel -> contact -> reaction, timed to the sim's ticks and never altering them.
- Skeletal animation (Spine or a native rig) instead of frame atlases, if the engine spike allows it.

### 4.4 Procedural and shader effects

- New sigil shapes: filled circle (Pyre, Sunfall, Downdraft), beam (Wrath, Cyclone), arc (Veering Bolt), trail.
- Heat and Momentum rune meters from the a13 glyphs (W8 decision A2), with threshold marks.
- Status overlays (burning, rooted, slowed) as shaders, not paintings.
- Lighting: spells light the floor and bodies; heat haze, wind streaks, water caustics.

### 4.5 Sound

- Fill every missing cue in the Audio Bible: death, absorb raise/hold/contact, telegraph and warning, status, travel
  loops, crowd, Heat/Momentum, beams.
- Hit variants (armour, flesh, ward), spell-specific releases for the signature rows and ultimates.
- Fix the dangling `stagger` cue.
- An owner listening pass with a scripted bout as the fixed test.

## 5. The engine spike (shared with D3)

**Question:** can PixiJS reach the target images, or does the PC channel move to a native engine after the hackathon?

1. Generate the target images from `D4-visual-target-prompts.md` (two variants each: painted 2.5D and stylised 3D).
2. The owner picks a target look.
3. Build one **vertical-slice frame** in Pixi: one close duel, two bodies at the new scale, one beam, one filled-circle
   telegraph, floor lighting, at 1440p.
4. Measure it: frame time at 1440p and 4K, the visual gap to the target, and authoring cost per body.
5. Decide with these criteria: Pixi stays if it matches the target within an agreed gap at 60 fps; otherwise price a
   native port. The deterministic TS core would need a port, a bridge, or a TS-to-native transpile.

## 6. Recommended first slice

1. Generate the target images (D4) and pick the look.
2. The Pixi vertical-slice frame and its measurement (section 5).
3. In parallel, engine-independent work: the missing sound cues, and the procedural sigil shapes (they port either way).

## 7. How success is measured

- The owner judges the slice frame against the target images (side by side).
- 60 fps at 1440p with the stress scene (two beams, trails, eight bodies), measured by `frame-probe.ts`.
- Every answerable event has a cue: a test enumerates sim event kinds against `data/audio.json`.
- Every rival has its own body; no Cassia re-skins remain.

## 8. Open questions for the spark

1. Which camera (4.1 A-D)? The target images should answer this.
2. How much new generation budget, and from which providers?
3. Skeletal animation or frame atlases?
4. Does PC keep VR's element-identity rules exactly, or diverge in look (W8 decision A3 says PC keeps its own direction)?
