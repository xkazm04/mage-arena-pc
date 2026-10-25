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
| Sound gaps | no death, absorb raise/hold/contact, telegraph/warning, status, projectile travel or crowd cues; one hit sample; `stagger` resolves to the existing `hit-a` sample (pitched down; fixed in 3e349a4, pinned by `audio-events.test.ts`); no Heat/Momentum or beam sounds | `arena-entry.ts:1415-1454`, `docs/audio/AUDIO-BIBLE.md` |

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

**Status (2026-10-24): slice asset candidates generated; the owner's pick is pending.** Wave D2S, agy only, 27 calls (project 409/450, 41 left).
- **Targets:** `art/targets/` holds T1-A and T2-A **stand-ins**, regenerated from the verbatim D4 A prompts, because the owner's Leonardo images are not on disk. The owner can drop the originals in to replace them.
- **Bodies:** three candidates each for the water and the fire mage of T1-A. Each candidate style matches the T1-A figure, keeps the roster identity (Cassia, Brennic), or follows the Covenant bar. Every body has a provider-painted normal map (aligned within 1 px) and a derived one (no calls).
- **Plates:** three layered plate sets (floor, back wall, near rim) in the verdigris, rust-sand and moonlit palettes. Only verdigris, after one correction, matches T2-A's 45° view; the other two read at eye level.
- **Pick sheet:** `art/delivery/d2s/pick-sheet.html` shows each slot next to its target, with the builder's ranks and reasons. Data is in `art/delivery/d2s/candidates.json`.
- **Authoring cost per body (section 5 measure):**
  - 2 calls: one colour image plus one painted normal map. One body needed 4: a rejected first try, and a normal-map call lost to a local path bug.
  - Cleanup is fully scripted, with about a second of compute and no hand-painting: magenta key, crop, normal-map masking by the colour alpha, and resize.
  - A plate set costs 3 calls, or 5 with a camera correction.
- **Not yet done:** nothing is wired into the game. The slice scene follows the owner's pick.
- **Update 2026-10-25:** the slice scene is built on a **provisional** pick (the builder's rank-1 candidates, verdigris
  plates), off by default and swappable through data, so the owner can judge the look in the running game and pick in
  context. What to judge and how to swap are in section 6.4; the frame numbers are in 7.3.

## 6. Recommended first slice

1. Save the chosen A targets in `art/targets/` as the reference set.
2. The 2.5D mastery slice and its measurement (section 5).
3. In parallel, work that does not depend on the slice:
   - the missing sound cues;
   - the procedural sigil shapes (filled circle, beam, arc), drawn for the new camera;
   - a normal-map and lighting test on one existing body.
4. After the slice passes: the asset production plan (bodies, rivals, creatures, arenas), priced against a new
   generation budget.

## 6.1 Step 3 groundwork status (2026-10-24)

Built with no generation spend. Wired into the live arena on 2026-10-24 (section 6.3); the probe numbers are in 7.2:
- **Procedural sigils:** filled disc, beam and arc in `sigil-contract.ts` (exact signed-distance witnesses), `sigil-shader.ts` and `SigilPlayer.procedural()`; data in `data/sigils.json`; tests in `sigil.test.ts`.
- **Normal map and light test:** `packages/tools/art/derive-normal-map.py` derives `public/normal-maps/cassia.png` from the Cassia A10 page (luminance height, blur, Sobel; deterministic, no generation) and a lit proof strip; `packages/game/src/lighting/` holds the shared point-light model, a lit-body shader mesh and `lighting.test.ts`. The proof strip is rendered on the CPU with the same constants, and a test pins the constants together. Both shaders have since been run in a real WebGL2 context (section 6.2); that run found and fixed three shader defects.
- **Audio cues:** `audio-events.test.ts` enumerates the sim event kinds (read from core's `ArenaEvent`) against `data/audio.json`. Kinds with no cue, allowlisted for 4.5: `cast`, `down`, `interrupt`, `phase`.

## 6.2 GL proof (2026-10-24)

Method: `node --import tsx packages/tools/art/gl-proof/gl-proof.mts [outDir]` from the repo root (no build needed). A standalone page (`gl-proof/gl-proof.html`, set into headless Chromium by Playwright, no server) compiles the repo's own fragment sources, `litBodyFragment` and `proceduralFragment` (now exported), on a bare quad into an RGBA8 framebuffer and reads the pixels back. It does not go through Pixi, `arena-entry.ts` or `game-shell.ts`. Captures are written to `<tmp>/mage-gl-proof/` and not committed. Exit 0 = pass, 1 = a comparison failed, 2 = WebGL could not start. Errors are in 8-bit levels.

GPU and backend: headless Chromium, ANGLE on Direct3D 11, NVIDIA GeForce RTX 4090 (WebGL 2.0, OpenGL ES 3.0 Chromium).

| Shader pass | Reference | Texels | Max err | Mean err | Result |
|---|---|---|---|---|---|
| Lit Cassia body, 4 lights | committed proof strip `cassia-lit-proof.png` (Python, same constants) | 458,184 channel samples | 1 | 0.466 (bias +0.47) | pass (max 1, mean 0.5) |
| Lit Cassia body, 4 lights | TS `lightAmount` / `litFactor` on the decoded normal map | 458,184 | 1 | 0.041 | pass |
| Disc, filled to 0.5 | `proceduralDistance` / `proceduralFillCoord` | 495,216 | 1 | 0.350 | pass (max 1, mean 0.5) |
| Beam, filled to 0.4 | same | 239,200 | 1 | 0.440 | pass |
| Arc 90 degrees, filled to 0.7 | same | 112,284 | 1 | 0.064 | pass |
| Disc, no fill pass | same | 502,704 | 1 | 0.238 | pass |

Lit body: the opaque texels of the 868x344 crop the proof strip uses, lights at x = 868 * (0.15 + 0.23 i), y = 120, nearest-filtered, the light moved half a pixel because a GL fragment sits at a texel centre. Partially transparent texels are not compared (the tool's strip leaves the tint unscaled by alpha). The strip's +0.47 bias is Python truncating to uint8 where the GPU rounds. Sigils: every texel of a 100 px/m capture; disc r 2 m, beam 6 x 1 m, arc r 3 m / 0.6 m / 90 degrees, with the feather, rim and opacities of `data/sigils.json`. The expected value is built from the contract's signed-distance witnesses; texels outside the shape must be discarded (0 failures), and texels within 1.5 px of the hard fill edge are skipped. The GPU reads about 0.1-0.4 levels below the float64 reference on sigils (rounding, never more than one level).

What the GPU run found, all fixed and pinned by tests (`sigil.test.ts`, `lighting.test.ts`):
1. The procedural sigil shader **did not compile**: `half` is a reserved word in GLSL ES 3.00. Renamed `halfArc`.
2. The arc shader used `degrees * pi/180` as the half-angle, so a 90 degree arc drew 180 degrees (28,300 texels outside the contract shape, max error 217). It is `degrees * pi/360`, as in `proceduralDistance`.
3. The lit-body shader multiplied the lambert term by the light colour (a coloured, darker body: max error 55, mean 1.4). The CPU model and the proof strip use a colourless `ambient + amount`, with the light colour only in the added tint; the shader now does the same.

Not covered by this proof: the Pixi `Shader`/`Mesh` plumbing (uniform groups, the world matrix, premultiplied-alpha textures) and the wired scene; section 6.3 covers those in the running game. Other GPUs and the software (SwiftShader) path are not run.

Re-run after the wiring (2026-10-24, same method, same host): `pass`, every row as in the table above (lit body vs strip max 1 / mean 0.466, vs TS model max 1 / mean 0.041; disc 0.350, beam 0.440, arc 0.064, disc no-fill 0.238). Nothing regressed.

## 6.3 Step 3 wired into the arena (2026-10-24)

- **Procedural sigils where the contract calls for them.** `SigilPlayer.schoolShapes()` (called once per frame from `arena-scene.ts`) maps the sim's school effects through `schoolEffectSigil()` in `sigil-contract.ts`: a delayed detonation (Pyre, Sunfall, Downdraft) is a disc that fills until it lands, a channelled beam (Brand Wrath, Cyclone) and a dash trail (Cinder Step) are strips over their simulated segment; `veeringArcSigil()` draws the rest of a Veering Bolt's curved flight as an arc band about its centre of curvature. A volley has no ground shape. The sim gives beams and trails no width (they hit along a segment), so the strip widths are presentation constants, `proceduralWidthM` (beam 0.7 m, trail 0.5 m). `__arena.snapshot().sigils.procedural` counts the shapes drawn this frame.
- **Lit body.** `BodyPlayer.light()` draws the one body whose A10 page has a derived normal map (cassia, `public/normal-maps/cassia.png`, as in e8ea1aa) with `litBodyMesh`, from the sprite's own transform, trim and mirror. One scene point light, a key light placed from that body's foot (`keyLight` in `lighting/tier.ts`: 0.6 m to the screen left, 1.1 m up, 0.7 m out, 4 m falloff, the shared warm colour). The light is mapped into the quad's page pixels, so a mirrored body mirrors the light with it.
- **Quality tier.** `?lighting=unlit` keeps every body on the painted sprite. The lit body also falls back to the sprite while its normal map loads, during a hit flash, and for a second cassia body in the same frame (one lit body). `__arena.snapshot().animation.lighting` gives the tier, the lit actor and the normal-map state; each displayed body carries `lit` and `litChoice`. The tier lives in `lighting/tier.ts` for now; moving it into `data/quality.json` is outside this lane.
- **Bar fixture.** `__arena.artFixture("bar")` (`barScene` in `art-fixture.ts`): eight painted bodies with the lit cassia among them, two beams that follow their owners' facing, two dash trails, two detonation discs refilling every 1.5 s, a Veering Bolt arc, and 24 projectiles. a8 has no trail clip, so the projectiles' travel clips stand in for spell trails. `d2-wiring.test.ts` pins the composition (by kind and by procedural shape) and the tier fallback. The `stress` fixture is unchanged, but its cassia body is now lit.
- **Look.** In the bar frame the lit cassia reads warmer and darker than the painted sprite. With the model's ambient of 0.35, a body outside the key light's falloff is darker than unlit. The light placement is a presentation default for the owner's eye, not a judged look.

## 6.4 Slice scene (provisional pick) (2026-10-25)

**Status: provisional, Director default 2026-10-25, owner pick pending.** The scene is built from the builder's rank-1
candidates so the owner has a frame to judge. `candidates.json` `ownerPick` is still `pending`: it is the owner's
field, and no code writes it. No generation calls were made (0 spend).

**How to open it** (nothing changes without one of these):
- `npm run camp`, open `http://127.0.0.1:5173/training?slice=d2s`, choose Training, then Start. The slice replaces the
  arena scene. The bout does not step while the slice is up, and the HUD stays on.
- In the harness (`?harness=1`): `__arena.artFixture("slice")`; `__arena.artFixture()` puts the arena back.
- Comparison switches on the same URL:
  - `&sliceNormals=derived`: derived normal maps (0 calls) instead of the painted ones;
  - `&lighting=unlit`: plain painted sprites;
  - `&sliceGrade=off`: no grade and no vignette;
  - `&sliceAt=2.2`: holds one moment of the 4 s loop (0.9 s shows the cone telegraph and the meteor disc; 2.2 s shows
    the flame on the ward; 3.5 s shows the meteor impact).

**What is in the frame** (`packages/game/src/slice/`; `d2-slice.test.ts` pins the composition):
- **Pick as data:** `packages/game/data/slice-d2s.json` holds `water: body-water-target`, `fire: body-fire-covenant` and
  `plates: verdigris`. Only those files are served, byte for byte, from `packages/game/public/slice/d2s/`: per body the
  colour image plus the painted and derived normal maps, and the floor, wall and rim plates. That is 6.1 MB in all,
  pinned under 6.5 MB, with sha256 values in `manifest.json`.
- **Camera and size (presentation constants, `slicePresentation`):**
  - 40 degrees, T1-A's angle. Today's arena camera stays at 55.
  - Bodies are drawn **190 px tall at 1440p** (142.5 px at 1080p), so they are inside the 140-200 px band whether it
    is read at 1440p or at 1080p.
  - Bodies are at true scale: 1.8 m = 190 px, which puts the ground at 105.6 px/m at 1440p.
  - The duelists stand 5.2 m apart, where the floor plate paints its sand oval, 60% down the frame.
- **Bodies:**
  - Both are lit through `litBodyMesh` with their provider-painted normal maps. If the painted map fails to load, the
    derived one is used.
  - Each body has up to four lights: a key light (`keyLight`, as in the arena), the flame, the meteor, and the
    lightning. The lightning beam lights each body from the beam's nearest point to it.
  - The fire mage is mirrored to face the water mage, and his light is mirrored with him (`lightInQuad`).
  - Each body has a contact shadow, plus one projected silhouette shadow cast away from the strongest spell light.
- **Spells:**
  - The flame cone: its telegraph is the a13 painted cone (`SigilPlayer.threat`), filling over 1.2 s. The flame itself
    is nine a8 `fire.travel` clips fanned through the cone, with `fire.impact` on the water ward.
  - The meteor: a procedural filled disc that fills over 3.4 s (`SigilPlayer.schoolShapes`, `schoolEffectSigil`),
    while a procedural meteor falls onto it, then an a8 impact and a light flash.
  - The lightning beam: the procedural beam strip on the ground, plus a procedural jagged bolt 1.1 m above it. It is
    cast from off frame by an air caster with no body, because the slice has two bodies.
  - The water mage holds her ward: the a13 ward sigil at 1.1 m, plus the a8 membrane.
- **Floor light:** additive light pools in each light's colour, an ellipse of its reach (17 along the beam). This is
  **not** normal-mapped floor lighting.
- **Plates, grade and atmosphere:**
  - The verdigris floor, back wall and near rim are drawn screen-fitted, with the sand oval's centre on the duel.
  - A slow camera sway moves them at parallax 1, 0.8 and 1.25.
  - On top: one colour-matrix grade (contrast, warmer highlights, cooler shadows), a vignette, 70 dust motes and 40
    embers. No new art.

**What the owner judges next.** The side-by-side sheets are `docs/waves/D2-evidence/side-by-side-T1-A.png` and
`side-by-side-T2-A.png`, made by `packages/tools/art/slice-side-by-side.py`. The PNGs are git-ignored and regenerate
from the commands in 7.3.
1. **Is this "the A look" (section 5 bar)?** Judge the frame as a whole against T1-A and T2-A.
2. **The water mage pick:** body-water-target (rank 1) against roster (Cassia's identity) and covenant, at 190 px.
3. **The fire mage pick:** body-fire-covenant (rank 1) against target and roster (Brennic). His staff runs across his
   body.
4. **The plate set:** verdigris, the only set at T2-A's view.
5. **Camera and body size:** 40 degrees and 190 px at 1440p.
   - The 140-200 px band gives a body about 13% of the frame height.
   - T1-A frames its duelists at about 70%.
   - The owner decides whether the band or T1-A's closeness is the target. Either is one constant
     (`slicePresentation.bodyPxAt1440`, `elevationDeg`).
6. **Lighting:**
   - painted against derived normal maps (`&sliceNormals=derived`);
   - lit against unlit (`&lighting=unlit`);
   - the grade (`&sliceGrade=off`).

**How to swap a candidate:**
1. Put the candidate's id in `packages/game/data/slice-d2s.json`: a body's `scene` from `candidates.json` (for
   example `body-water-roster`), or a plate set's `palette` (`rust`, `moonlit`).
2. Run `node --import tsx packages/tools/art/slice-assets.mts` from the repo root. It copies the picked files and
   removes the unpicked ones; `--check` reports drift.
3. Run `npm run build:game`.
4. `d2-slice.test.ts` pins the provisional ids. When the owner picks, update its first test in the same commit.

Recording the owner's pick in `candidates.json` stays the owner's act.

**Gaps (stated, not hidden):**
- **Floor lighting:** the floor has no normal map, so spells light it with additive pools, not with the lit-body
  model. The deferred-style light buffer of 4.1 is not built.
- **Shadows:**
  - One projected silhouette per body, from the strongest spell light.
  - Bodies cast no shadows onto each other or onto the plates' walls.
- **Clips and poses:**
  - The a8 clips are painted for the far TV camera, so at the slice's scale they read soft.
  - The flame, meteor and bolt are procedural or a8 stand-ins; no slice-specific effect art exists.
  - Each body is one static pose: no clips, no windup or reaction.
- **Plate fit:**
  - The plate's sand oval is painted flatter than a 40-degree ground. A 2 m disc reads rounder than the oval around
    it.
  - `plateDuel` (`slice-scene.ts`) is measured on verdigris. A rust or moonlit swap may need it moved.
- **Frame contents:** the HUD stays on. The beam's caster has no body.


## 7. How success is measured

- The owner judges the slice frame against the target images (side by side).
- 60 fps at 1440p with the stress scene (two beams, trails, eight bodies), measured by `frame-probe.ts`.
- Every answerable event has a cue: a test enumerates sim event kinds against `data/audio.json`.
- Every rival has its own body; no Cassia re-skins remain.

### 7.1 Frame probe, 1440p baseline (2026-10-24)

Method: `node --import tsx packages/tools/art/frame-probe-1440.mts 1440 12` after `npm run build:game`. It opens the preview build at 2560x1440 (deviceScaleFactor 1), enters the training arena, starts the art fixture `stress`, waits 2 s, resets the counters, samples 12 s through `__ui.performance()` and the per-phase log of `frame-probe.ts`. Headless Chromium on ANGLE/D3D11, NVIDIA GeForce RTX 4090. The fixture is the heaviest scene that exists without new assets: 100 projectiles, 12 painted A10 figures, 104 live effect clips.

| Measure (last 360 frames) | Result |
|---|---|
| Frame time | mean 16.67 ms, p95 16.80, max 16.80 (60.0 fps, vsync-locked) |
| Frame CPU | mean 1.35 ms, p95 1.80, p99 2.00, max 2.40 |
| Phase CPU (mean) | scene 0.62 ms, render 0.52 ms, hud 0.06 ms, all others under 0.03 ms |
| Effects budget | 104 active, 0 dropped, 0.10 ms of the 2 ms budget |

What this does and does not show:
- It holds 60 fps at 1440p on the **current look** with the existing stress fixture. The frame time is pinned to the display's refresh, so GPU headroom is **not measured**; CPU time is the usable number.
- **Not evaluated:** the section 7 bar scene (two beams, trails, eight bodies in the new camera with lit bodies and layered plates), the 4K case, and any GPU below an RTX 4090. The fixture has no beams or trails, and the new lighting and procedural sigils are not wired in, so the bar itself is still open.
- Re-run the probe, with the procedural sigils and the lit bodies added to the fixture, once `arena-entry.ts` is free.

### 7.2 Frame probe after the step 3 wiring (2026-10-24)

Method: as in 7.1, `node --import tsx packages/tools/art/frame-probe-1440.mts <height> 12 <fixture> [query]` after `npm run build:game`, on the tree of commit ab0731c. The probe now takes a fixture kind, a URL query and a screenshot path. Host KAZIHO: AMD Ryzen 7 7800X3D, NVIDIA GeForce RTX 4090; headless Chromium (Playwright 1.63) on ANGLE/D3D11; Node 24.14; deviceScaleFactor 1. 4K is a 3840x2160 viewport. Each row is the last 360 frames, with sigil and effect counts from `__arena.snapshot()`.

| Run | Scene | Frame ms (mean / p95 / max), fps | Frame CPU ms (mean / p95 / p99 / max) | Phase CPU mean ms |
|---|---|---|---|---|
| 7.1 baseline, 1440p | `stress`, unlit, no procedural sigils | 16.67 / 16.80 / 16.80, 60.0 | 1.35 / 1.80 / 2.00 / 2.40 | scene 0.62, render 0.52, hud 0.06 |
| `stress` 1440p | 12 bodies (cassia lit), 100 projectiles, 104 effect clips, 13 sigils | 16.67 / 16.70 / 16.80, 60.0 | 1.11 / 1.50 / 1.70 / 1.80 | scene 0.56, render 0.45, hud 0.05 |
| `bar` 1440p | 8 bodies (cassia lit), 2 beams, 2 trails, 2 discs, 1 arc, 24 projectiles, 28 effect clips, 16 sigils | 16.67 / 16.70 / 16.80, 60.0 | 0.63 / 0.90 / 1.10 / 1.30 | scene 0.29, render 0.28, hud 0.04 |
| `bar` 1440p, `lighting=unlit` | same, no lit body | 16.67 / 16.70 / 16.80, 60.0 | 0.67 / 0.90 / 1.30 / 1.50 | scene 0.31, render 0.30, hud 0.05 |
| `bar` 4K | as `bar` 1440p | 16.67 / 16.70 / 16.80, 60.0 | 0.76 / 1.10 / 1.40 / 2.30 | scene 0.30, render 0.33, hud 0.04 |
| `stress` 4K | as `stress` 1440p | 16.67 / 16.80 / 16.80, 60.0 | 1.05 / 1.40 / 1.70 / 1.90 | scene 0.55, render 0.46, hud 0.05 |

Per-phase log (mean ms, `bar` 1440p, lit): input 0.010, arena.pre 0.008, step 0.001, events 0.012, scene 0.290, hud 0.041, onFrame 0.001, ui 0.013, render 0.281. Phase p95: scene 0.4, render 0.4. Effects budget in every run: 0 dropped, 0.0-0.2 ms of 2 ms. Page errors: none. Every `bar` run reported `procedural {disc 2, beam 4, arc 1}` and `lighting.tier lit, litActor 1, cassia ready` (unlit run: `tier unlit`, cassia `litChoice tier-unlit`).

What this shows:
- The bar scene that exists without new assets holds **60 fps at 1440p and at 4K** with the procedural sigils and the lit body on. Frame CPU stays near half the baseline's, because the bar scene has a quarter of the stress scene's projectiles and effect clips.
- The lit body and the procedural sigils cost nothing measurable on the CPU: lit and unlit `bar` differ by less than run-to-run noise (0.63 against 0.67 ms). The `stress` rerun reads about 0.2 ms below the 7.1 baseline with more drawn (a lit body), so read about ±0.2 ms as noise.
- As in 7.1, frame time is pinned to the display refresh, so **GPU headroom is still not measured**. The 4K case shows no frame-time cost on an RTX 4090; slower GPUs are not run.
- **Still open for the section 7 bar:** the new closer camera, the 140-200 px bodies, layered plates and spell-driven lights. They need assets or the slice, so they are not in this scene. The bar is met for the current camera and assets only.

### 7.3 Frame probe of the slice scene (2026-10-25)

Method: as in 7.2, `node --import tsx packages/tools/art/frame-probe-1440.mts <height> 12 slice [query]` after
`npm run build:game`, on the tree of commit bfe684e. The probe change after that commit only adds the `-` fixture. The
fixture plays its 4 s loop. Screenshots used `MAGE_PROBE_SHOT=<png>` with `sliceAt=0.9`, `2.2`, `3.5`.
- Host KAZIHO: AMD Ryzen 7 7800X3D, NVIDIA GeForce RTX 4090.
- Headless Chromium (Playwright 1.63) on ANGLE/D3D11, Node 24.14, deviceScaleFactor 1.
- Each row is the last 360 frames.
- The JSON of every run is committed in `docs/waves/D2-evidence/` (`slice-1440.json`, `slice-2160.json`,
  `slice-1440-unlit.json`, `slice-1440-nograde.json`, `bar-1440-control.json`).

The `bar` row is a control run in the same session. It reads about 0.6 ms of frame CPU above its 7.2 figure (1.20
against 0.63), so this session's host was busier: compare the slice rows with that control, not with 7.2.

| Run | Scene | Frame ms (mean / p95 / max), fps | Frame CPU ms (mean / p95 / p99 / max) | Phase CPU mean ms |
|---|---|---|---|---|
| `slice` 1440p | 2 lit bodies (painted normals, 4 lights each), 3 plates, cone telegraph or flame stream, meteor disc, beam, 17 light pools, 11 a8 clips, grade | 16.67 / 16.70 / 16.80, 60.0 | 1.29 / 1.60 / 1.80 / 2.70 | scene 0.32, render 0.89, hud 0.07 |
| `slice` 4K | as `slice` 1440p | 16.67 / 16.70 / 16.80, 60.0 | 1.60 / 2.10 / 2.40 / 2.70 | scene 0.35, render 1.00, hud 0.09 |
| `slice` 1440p, `lighting=unlit` | same, painted sprites | 16.67 / 16.70 / 16.80, 60.0 | 1.58 / 1.90 / 2.70 / 6.60 | scene 0.39, render 1.01, hud 0.09 |
| `slice` 1440p, `sliceGrade=off` | same, no grade or vignette | 16.67 / 16.70 / 16.80, 60.0 | 1.50 / 2.00 / 2.50 / 5.00 | scene 0.37, render 0.94, hud 0.08 |
| `bar` 1440p (control, same session) | as 7.2 | 16.67 / 16.80 / 16.80, 60.0 | 1.20 / 1.60 / 2.70 / 4.60 | scene 0.46, render 0.54, hud 0.10 |

- Per-phase log (mean ms, `slice` 1440p): input 0.021, arena.pre 0.021, step 0.002, events 0.015, scene 0.32, hud
  0.07, onFrame 0.002, ui 0.025, render 0.89. Phase p95: scene 0.5, render 1.2.
- Page errors: none. Slice diagnostics: none. Effects: 0 dropped.
- Every slice run reported both bodies loaded with `normals painted` and 4 lights, all three plates, and `grade true`
  (except the no-grade run).
- The procedural count in each JSON is the moment of the snapshot: the beam is always drawn, and the disc only while
  the meteor falls.

What this shows:
- The slice holds **60 fps at 1440p and at 4K** on this host. Frame CPU is 1.3 ms at 1440p and 1.6 ms at 4K, within
  about 0.1-0.4 ms of the same-session `bar` control.
- The slice's cost moves to **render**: 0.9-1.0 ms against `bar`'s 0.5 ms. That is the full-screen plates, the grade
  pass, the additive pools and the lit meshes. Its scene phase is lighter than `bar`'s (0.32 against 0.46 ms): two
  bodies against eight.
- Lit against unlit, and grade against none, differ by less than this session's noise. The unlit and no-grade runs
  read slightly *higher* than the lit, graded one, with higher maxima from host spikes. So the lit material and the
  grade cost nothing measurable on the CPU here.
- As in 7.1 and 7.2, frame time is pinned to the refresh, so **GPU headroom is not measured**. The grade is a
  full-screen pass at 4K, and slower GPUs are not run.
- The section 5 bar's "holds 60 fps at 1440p" is met for this scene on an RTX 4090. The bar's other half, "the A look",
  is the owner's to judge (6.4).


## 8. Open questions for the spark

1. The exact camera angle and body size inside the chosen range (35-45°, 140-200 px)? The slice settles it.
   **Slice value, provisional (2026-10-25), for the owner's judgement:** 40° and 190 px at 1440p (6.4, item 5).
2. How much new generation budget, and from which providers? Painted normal maps double the cost per body.
3. Skeletal cut-out animation or more painted frames?
4. Does PC keep VR's element-identity rules exactly, or diverge in look (W8 decision A3 says PC keeps its own direction)?
   **Provisional answer:** PC keeps its own look direction per W8 A3, Director default 2026-10-24, owner to confirm.
