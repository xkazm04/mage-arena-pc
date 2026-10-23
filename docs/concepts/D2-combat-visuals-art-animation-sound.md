# D2. Combat visuals: an original art direction, animation and sound for PC

Status: **direction menu**, written 2026-10-23 for future sessions; nothing here is built.

**Decision (owner, 2026-10-24): painted 2.5D is the primary direction.** The owner compared the Leonardo targets
(`docs/concepts/D4-visual-target-prompts.md`) and chose the **A variants**:

> "Im sold to 2.5D, adjust the documents so we can try to reach it and master as primary choice over 3D"

What follows from that:
- PixiJS is the engine we commit to.
- Stylised 3D and a native engine are a **fallback only**, opened if the mastery slice in section 5 fails its bar.
- The A images saved in `art/targets/` are the reference every asset is judged against.

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
5. The painted 2.5D look **mastered in PixiJS**, proven by a measured slice before the asset production starts.

## 4. Candidate directions

### 4.1 Camera and art direction: painted 2.5D (chosen)

**The target:**
- **Camera:** a closer three-quarter camera, 35-45° elevation instead of today's far 55°.
- **Bodies:** painted billboards at **140-200 px** at 1080p, with normal-mapped lighting.
- **Arenas:** painted plates in layers for parallax and lighting.
- **Spells:** they light bodies and floor.

This is what targets T1-A and T2-A show.

**The 2.5D techniques to master in Pixi:**

| Technique | What it buys | Pixi route |
|---|---|---|
| Normal-mapped painted sprites | bodies and props lit by spells and torches, not just tinted | a lighting filter or shader with a normal atlas per body (the provider paints the normal map from the colour map, or a tool derives it) |
| Dynamic 2D lights | the meteor, beams and flames light the floor and bodies | additive light layer and a deferred-style light buffer rendered to a texture |
| Layered arena plates | depth: floor, walls, balconies, crowd, sky | separate plates with small parallax; baked plate kept as the fallback quality tier |
| Depth and sorting | bodies pass in front of and behind props correctly | today's `depth.ts` sorting, extended for the closer camera |
| Shadows | grounded bodies, cast shadows from spell light | blurred contact shadows (exist today) plus projected light shadows |
| Atmosphere | dust, haze, embers, drizzle | particle containers and screen-space shaders, within `animation.json` budgets |
| Colour grading | the dusk and night moods of the targets | a final LUT filter per arena palette |

**Not chosen, kept as the fallback** (open only if section 5 fails its bar):
- **Stylised 3D** in a native engine.
- **Hybrid:** 3D-rendered sprites baked to atlases.

**Rejected:** a remaster of the current far camera. It does not answer the owner's concern about reuse.

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
- Skeletal animation for painted 2.5D (a Spine-style runtime for Pixi, cut-out painted parts) versus more painted frames
  per clip: the mastery slice tries both on one body and keeps the one that holds the painted look.

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

## 5. The 2.5D mastery slice (shared with D3)

**Goal:** prove PixiJS reaches the chosen A targets before any asset production. The slice is not a contest between
engines; it is the first build of the chosen look.

1. **Scene:**
   - one close duel in one arena at the new camera;
   - two painted bodies at the new scale, the water mage and the fire mage of T1-A;
   - a flame cone and a meteor with a filled-circle telegraph;
   - a lightning beam;
   - floor and body lighting from the spells;
   - layered plates, colour grade and atmosphere.
2. **Assets:**
   - generate only what the slice needs: two bodies with their normal maps, one arena plate set;
   - each asset is judged next to its target image.
3. **Measure:**
   - frame time at 1440p and 4K with the stress scene, via `frame-probe.ts`;
   - the visual gap to T1-A and T2-A, owner-judged side by side;
   - authoring cost per body: generation calls and cleanup time.
4. **Bar:** the slice passes when the owner judges it "the A look" and it holds 60 fps at 1440p. Each shortfall is fixed
   inside Pixi first (shader, lighting, asset quality).
5. **Fallback:** only if the bar cannot be met after a fix round, price the native 3D route. That includes how the
   deterministic TS core would move: a port, a bridge, or a transpile.

## 6. Recommended first slice

1. Save the chosen A targets in `art/targets/` as the reference set.
2. The 2.5D mastery slice and its measurement (section 5).
3. In parallel, work that does not depend on the slice:
   - the missing sound cues;
   - the procedural sigil shapes (filled circle, beam, arc), drawn for the new camera;
   - a normal-map and lighting test on one existing body.
4. After the slice passes: the asset production plan (bodies, rivals, creatures, arenas), priced against a new
   generation budget.

## 7. How success is measured

- The owner judges the slice frame against the target images (side by side).
- 60 fps at 1440p with the stress scene (two beams, trails, eight bodies), measured by `frame-probe.ts`.
- Every answerable event has a cue: a test enumerates sim event kinds against `data/audio.json`.
- Every rival has its own body; no Cassia re-skins remain.

## 8. Open questions for the spark

1. The exact camera angle and body size inside the chosen range (35-45°, 140-200 px)? The slice settles it.
2. How much new generation budget, and from which providers? Painted normal maps double the cost per body.
3. Skeletal cut-out animation or more painted frames?
4. Does PC keep VR's element-identity rules exactly, or diverge in look (W8 decision A3 says PC keeps its own direction)?
