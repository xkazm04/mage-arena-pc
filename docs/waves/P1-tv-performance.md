# P1 TV performance: the arena on the Fire TV Stick

**Result.** In the arena the Stick went from about 23 fps, with every second frame late and a p95 frame
of 100 ms, to about 58 fps with a p95 of 16.8 ms. 2% of frames are now late, against 54-56% before. The
gain comes from three wins on all platforms (two overdraw cuts and a CPU churn fix) plus a TV quality
profile: render at 1440x810 with MSAA off. Desktop stays at 60 fps and looks the same.

## Setup

Device: Fire TV Stick AFTKM (MT8696, 4x ARM, PowerVR Rogue GE9215, 1.7 GB RAM, Fire OS 8, Amazon
WebView 148). Output is 4K, but the app's surface is **1920x1080**: `wm size` override is 1920x1080, and
SurfaceFlinger scales the surface to 3840x2160. The page sees 960x540 CSS px at devicePixelRatio 4.

```powershell
npm run build:game
npx tsx node_modules/vite/bin/vite.js preview --config packages/game/vite.config.ts --host 127.0.0.1 --port 4174 --strictPort
adb -s 10.0.0.139:5555 reverse tcp:4174 tcp:4174
adb -s 10.0.0.139:5555 shell am start -S -n dev.magearena.tv/.MainActivity --es url "'http://127.0.0.1:4174/training?harness'"
adb forward tcp:9222 localabstract:webview_devtools_remote_$(adb -s 10.0.0.139:5555 shell pidof dev.magearena.tv)
# from a scratch dir, REPO=<worktree>:
node docs/waves/P1-tv-performance/tools/bench.mjs <label> training|tiro3|stress|menu 600 [query]
```

- **The build.** Production build served by `vite preview`, through `adb reverse`. Playwright
  `connectOverCDP` attaches to the WebView. Each run gets a fresh app process (`am start -S`; see
  `tools/matrix2.sh`). The baseline is HEAD `be1d8f6`, built the same way and served on :4175.
- **Measures.** Frame interval from an in-page requestAnimationFrame loop (600 frames, about 10 s at
  60 fps). Per-frame JS time by phase comes from the new `__ui.performance().phases`. Long tasks come
  from a PerformanceObserver. GL memory comes from `dumpsys meminfo` (GL mtrack).
- **Scenarios:**
  - `training`: the first magic lesson, with scripted WASD and mouse casts.
  - `tiro3`: Tiro wave 3. The reference AI clears waves 1-2 through `runGamesTicks`, then plays the duel
    live against the Water rival.
  - `stress`: `artFixture("stress")`, 100 projectiles and 12 figures.
  - `menu`: the training select screen.
- **Phone card.** The shell's phone card was hidden for the runs (hold Menu). No phone was attached.

## Baseline (HEAD) vs now, same scenarios, 600 frames each

| Scenario | Build | fps | Frame p50 / p95 / p99 ms | Frames > 16.7 ms | JS ms mean / p95 | Backing | GL mem |
|---|---|---|---|---|---|---|---|
| training | before | 23.2 | 33.3 / 100.3 / 133.5 | 56% | 11.8 / 21.8 | 1920x1080 | 419 MB |
| training | **after** | **58.1** | 16.7 / 16.8 / 33.4 | **1.8%** | 8.6 / 13.8 | 1440x810 | 262 MB |
| tiro3 | before | 23.1 | 33.3 / 100.2 / 116.9 | 54% | 12.6 / 17.4 | 1920x1080 | 478 MB |
| tiro3 | **after** | **58.2** | 16.7 / 16.8 / 33.4 | **2.0%** | 11.4 / 16.3 | 1440x810 | 368 MB |
| stress | before | 20.2 | 33.4 / 133.5 / 150.2 | 61% | 20.8 / 27.7 | 1920x1080 | 497 MB |
| stress | after | 44.5 | 16.7 / 33.5 / 66.6 | 29% | 18.0 / 28.2 | 1440x810 | 335 MB |
| menu | before | 38.7 | 33.3 / 33.5 / 50.1 | 51% | 4.8 / 8.2 | 1920x1080 | 242 MB |
| menu | after | 51.1 | 16.7 / 33.4 / 33.4 | 17% | 2.6 / 4.4 | 1440x810 | 116 MB |

Command: `tools/matrix2.sh m3` (raw JSON per run is printed).

- **Before.** The old pattern was GPU backpressure: three 17 ms frames, then one or two of 50-100 ms
  (`17 17 17 100 50 67`).
- **After, frame time.** In `tiro3` the JS time per frame splits as input 0.2, sim step 0.7, events 0.3,
  scene update 3.5, HUD 0.8 and Pixi render 5.9 ms (means).
- **After, CPU profile.** GC is about 3% of CPU in the profile (`(garbage collector)` 306 ms of 10 s),
  and there are no long tasks.
- **Draw calls.** 34-39 a frame.
- **Memory.** Texture memory as the game counts it fell from 325 to 270 MiB in `tiro3`.
- **Stress.** `stress` stays CPU-bound in the scene update (11 ms for 100 projectiles and 12 figures).
- **Low memory.** One baseline run had its WebView renderer killed by the low-memory killer
  (`Process dev.magearena.tv has died`, with a dozen system processes killed just before it). The lower
  GL memory now matters for staying alive, not only for speed.
- **Memory pressure costs speed.** Late in the session the Stick's swap was 95% full and `kswapd0` used
  35% of a core. The same build then measured 47.5 and 50.7 fps in `tiro3` (JS 15 ms mean, every phase
  about 40% slower), while training still held 58.1 (`tools/matrix2.sh m4` with `BUILDS=final`). On a
  1.7 GB device, memory is speed; this is why option 2 below ranks high.

## Experiments, one change at a time

These were run on the Stick, on the `training` scenario unless noted. Each fps is the mean of 600 frames.
Run-to-run noise is about ±2 fps.

| Change | Result | Kept |
|---|---|---|
| **Prime suspect: a 4K backing store.** | False. `resolution: min(dpr, 2)` already gave a 1920x1080 canvas, so it was not 4K. | n/a |
| Render scale 1 (960x540), alone | 22 → 43.4 fps | No, too soft alone |
| MSAA off, alone | 22 → 31.1 fps | TV only |
| Scale 1 and MSAA off | 52.9 fps: GPU fill-bound, not CPU | n/a |
| Layer ablation (`tools/ablate.mjs`, stress) | Hiding the floor layer: 18 → 46 fps. No other layer was worth more than 3 fps. | n/a |
| **The procedural floor `Graphics` drawn under the opaque A12 plate.** 900 alpha ellipses, 360 tesserae, 11.4k triangles, every frame, invisible. | stress 19 → 34 fps | **Yes, all platforms**: hidden while the plate covers the view |
| **Cleanup overlay.** A second full-plate 3072x1728 sprite, 94-98% transparent, plus 6 decals. | Baked once with the plate into one opaque texture: stress 35 → 45 fps | **Yes, all platforms** |
| Bake at 0.75 or 0.5 of plate density | 44.0 / 39.7 fps, no gain | No |
| Blend `none` on the opaque plate | No change (tile GPU) | No |
| After floor and bake, 1080p with MSAA | training 22 → 49.7, tiro3 → 44.5 | n/a |
| MSAA off at 1080p, then 1440x810, then 1280x720 | training 53.4, then 53.9-58.1, then 59.0. tiro3 52.3, then 58.2-59.5, then 58.5. | **810p, MSAA off (TV)** |
| 810p with MSAA | tiro3 56.1, training 50.9 | No |
| **Hit flash** (ColorMatrixFilter, a render-target switch). Frames with an FBO switch compared with frames without. | 17.9 vs 17.8 ms mean: no measurable cost | Kept as is |
| **Pixi instruction rebuilds** (1.19 a frame at 4.5 ms on the Stick). Causes: every effect, sigil and rune hidden then re-shown each frame; figure `zIndex` writes; each slot's mask removed and re-added; the cursor and bars redrawn in batched `Graphics`; a Pixi 8.22 bug that rebuilds the stage for every unbatched `Graphics` redraw. | Rebuild triggers per frame: water fixture 1.00 → 0.14, tiro3 1.00 → 0.71 (desktop trace, `tools/churn.mjs`). On the Stick, tiro3 rebuilds 1.20 → 0.88 a frame. JS time difference is within run-to-run noise. | **Yes, all platforms**, pixel-identical |
| HUD as its own render group | tiro3 JS 11.4 → 10.6 ms in one pair, the reverse in the next | No, noise |
| World layers as render groups | JS 12.7 → 15.9 ms, worse | No |
| Font atlases at resolution 1 on TV (was 2) | Font textures 44 → 11 MiB. No visible change at 810p (crop below). | **Yes, TV** |
| Ticker / maxFPS | The game drives its own rAF with `autoStart: false`. Nothing to change. | n/a |

## Movement smoothness

Measured with `tools/smooth.mjs`, which records per frame the on-screen position of the player and of
the floor (the camera).

- **Interpolation.** FixedStepper alpha interpolation is correct. At a steady walk, the per-frame
  displacement is exactly proportional to frame time: 0.85 px per 16.7 ms frame, 1.69 px per 33.4 ms
  frame. So "lag" on the Stick was never stale positions.
  - Judder came from frame-time variance. Alternating 17 ms and 100 ms frames show 1x and 6x steps.
  - At the new stable 60 the step is constant (frame-time CV 0.004 over a training run).
- **Camera follow.** It is smooth: exponential and frame-rate independent. When the player leaves the
  dead zone, the camera speeds up and the player's on-screen speed falls, both smoothly
  (0.64 → 0.97 px a frame, and 0.36 → 0.03).
  - **Found:** at the plate edge `clampPlateCamera` stops the camera within one frame (0.97 → 0.66 → 0
    px a frame), a visible jolt at the arena border. Not changed (camera feel); see the options below.
- **Time loss.** At 100 ms frames `dt` is clamped to 0.05 s, so the simulation also lost time, which
  felt like slow motion. At 60 fps this no longer happens.

## What landed

Everything below is presentation only; combat is untouched.

**On every platform:**
- `arena-scene.ts`: the procedural floor is hidden while the opaque A12 plate covers the view. It stays
  on for the tiled fallback and for views wider than the plate.
- `arena-art.ts`: the plate, cleanup overlay and decals are baked once into one opaque render texture.
  Their three sources are released afterwards.
  - Desktop pixel check against HEAD on the floor layer: at 1440p identical (max diff 0); at 1080p mean
    0.05, max 12/255 on 0.001% of pixels.
- **Instruction-rebuild churn**, all pixel-identical on desktop:
  - `effect-player`, `sigil-player`, `rival-collar-view`: unused pool items are hidden in `end()`
    instead of hiding everything in `begin()`. Per-layer pools, so meshes never move between layers. A
    mask is assigned only when it changes.
  - `depth.ts`: figure depth order without `zIndex`; the layer is reordered only when two figures cross.
  - `pixi-fixes.ts`: per-frame `Graphics` are unbatched (`frameGraphics`), together with a narrow fix
    for Pixi 8.22's `GraphicsPipe.validateRenderable`. Its "was batched" check is always true, so an
    unbatched redraw rebuilt the whole stage. **Remove this when Pixi is upgraded.**
  - Pixel check: same frame rendered both ways, max diff 0 on 4 fixtures.

**TV profile (new):** `packages/game/data/quality.json`, read by `quality.ts`.
- **Selection.** The profile is picked by user agent: the Stick's WebView UA carries `AFT`.
  `?quality=tv|desktop` overrides it, and `?q.<knob>=<value>` overrides one knob for profiling.
- **Why the UA.** The shell is unchanged, so it needs no APK rebuild and no conflict with the phone
  work. Any Fire TV browser gets the profile too.
- **Profiles:**
  - **desktop**: resolution 2, MSAA on, font resolution 2. As before.
  - **tv**: max resolution 1.5 (1440x810 backing), MSAA off, font resolution 1.

**Profiling hooks:**
- `__ui.performance().phases` reports per-phase JS ms (`frame-probe.ts`).
- `__ui.performance().quality` reports the active profile.
- `?harness` exposes `window.__pixi` (the Pixi app) for layer ablation.

**Bug fixed on the way (owner-visible).**
- **Symptom.** Tiro could **freeze** between waves with `Cannot read properties of null
  (reading 'addressModeU')`. Reproduced on HEAD in 2 of 5 desktop runs of "clear wave, Next bout at
  once".
- **Cause.** `EffectPlayer` and `BodyPlayer` cache frame textures cut from an atlas page. When a wave
  change unloads and reloads that page, the cached frame still points at the destroyed source. The
  render throws and the rAF loop stops.
- **Fix.** The cache now checks the page source: 0 of 5 desktop runs froze after the fix.
- **Still open.** One more freeze was logged on the Stick after that fix. Its stack was not captured.
  The same guard now also covers the HUD inscription and portrait frame caches (`ui/artwork.ts`,
  `art.ts`).
- **Since.** No hang in the 13 later Tiro runs that cleared waves 1-2 on the Stick. Treat the freeze as
  likely fixed, not proven fixed.

**Visual cost.** Screenshots are TV `screencap`s of the same paused fixture, in this folder:
- `tv-before-1080p-msaa.jpg`
- `tv-after-810p-tv-profile.jpg`
- `tv-after-code-only-1080p-msaa.jpg`, the TV with the desktop profile
- `crop-hud-before-top-after-bottom.png` and `crop-fig-before-top-after-bottom.png`, 1:1 crops

At 810p, text and figure edges are slightly softer than at 1080p with MSAA. The HUD text is equally
legible. The painted plate, the effects and the colour are unchanged. The desktop profile on the TV
(code wins only) holds 50-52 fps at full 1080p with MSAA (`?quality=desktop`).

## The ceiling, and what remains

**60 is nearly reached:** 98% of frames are on time in the duel and in training. The remaining 2% are
JS spikes, CPU p95 16.3 ms in `tiro3`:
- **Pixi rebuilds** still run 0.7-0.9 times a frame at about 4.5 ms. The cause is HUD `BitmapText`
  changes (the cooldown "x.xs recovering" text, mana), which Pixi 8 can only apply by rebuilding.
- **The scene update** takes 3.5 ms.

A locked 30 is not needed: the 30-60 jitter is gone.

## Further options, ranked by expected gain for effort

1. **HUD text updates at most every 100 ms and only on change**, or cooldown digits drawn as sprites.
   - Gain: about 3 ms of the 4.5 ms rebuilds in combat, the last 2% of late frames. Effort S-M.
2. **Release camp, menu and portrait art while in the arena.** `arena-moonlit-2560`, the portrait pages
   and `place.door` stay resident in the arena (`__ui.snapshot().art.residentKeys`).
   - Gain: about 20-30 MiB of GL memory, and lower low-memory-kill risk. Effort S.
3. **Pre-baked TV atlases at about 0.6x**, or ETC2/ASTC-compressed atlases. The Stick samples
   1440x810. A10 bodies, A8 effects and A13 sigils are authored for 1440p, and decoded RGBA is
   174 MiB of art plus 64 MiB of UI kit.
   - Gain: 40-60% less GL memory and bandwidth, and faster first load (17-19 s now). Effort M
     (asset pipeline, two manifests).
4. **Scene update.** It allocates `new Matrix` and `Float32Array`s per sigil or effect per frame, and
   uses `filter/map/find` over the actors (`stress`: 11 ms for 100 projectiles).
   - Gain: 1-3 ms in big fights. Effort M.
5. **Upgrade Pixi** past 8.22 and drop `pixi-fixes.ts` if the validate bug is fixed upstream; re-measure
   rebuilds. Effort S-M.
6. **Soft camera clamp at the plate edge.** Ease the follow into `clampPlateCamera` instead of a one-frame
   stop. Feel, not fps. Effort S.
7. **Fewer animation frames** for TV effect clips (A8 at 12 fps instead of 24 frames). Saves memory
   only, since frame count costs no GPU per frame. Effort M (art).
8. **The training select screen is 51 fps, not 60.** CPU is 2.6 ms there, so it is the backdrop's GPU
   cost; not profiled further. Effort S to investigate.

## Checks

- Hash rule:
  - `npx vitest run packages/core/src/arena/replay-golden.test.ts` passes (3 tests).
  - Census digests are identical: wave1 `e7b5714f…`, wave2 `b0ebe596…`, wave3 `3212e0d1…`,
    wave4 `2ea15bdc…`.
- `npm run gate` exits 0 (vitest 50 files, 339 tests).
- **Desktop.** `stress` and `water` fixtures at 1080p and 1440p, headless Chromium (`--use-angle=d3d11`),
  HEAD vs now: 60 fps both. Renderer CPU p95 2.4-3.4 ms against 2.5-4.2 before. Texture memory 409 → 387
  MiB.
- **`npm run smoke:u4` fails on HEAD as well**, before reaching its performance step:
  - Its body-size assertion expects `fullFramePx` 97.2 at 1080p, and HEAD draws 145.8.
  - Its texture budget of 300 MiB is below HEAD's 409 MiB.
  - The smoke needs updating for the A14 art scale. That is out of scope here.
