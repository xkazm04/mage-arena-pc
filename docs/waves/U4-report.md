# U4 — art wiring round 2

2026-10-03, GAME / integration. [Native gallery](U4-evidence/index.html),
[design note](U4-art-wiring.md). The owner described the delivered effects and
characters as a very significant improvement. This report measures their game
integration; it does not infer owner approval of the game's motion or feel.

Five sub-waves: assets `b318fca`, effects `d041397`, characters `b19c9aa`,
camp `7a9c71c`, then this verification/polish commit. Selective import from art
commit `f000c26` copied 35 allowlisted delivery files with SHA-256 and sidecars.
The art worktree was read only. No raw images, generation, providers or pushes.
Integration's plan content and the existing ground/rim loader were preserved.

**Implemented.** A8 supplies cast, projectile travel, impact, hit and aura clips
for all four elemental presentation families. Every current Water spell uses
the shared cast/release/hit path, including non-projectile spells. Auras sit
behind bodies. The held absorb membrane follows aim in unprojected ground
coordinates, then projects once and clips to the exact 140-degree forward arc.
Real blocked-hit metrics trigger compression while held; perfect events trigger
compression and a localized flare. Emissive clips use additive blend with authored
opacity trims. Data-owned telegraph footprints retain their outlines, radii,
widths and angles; A8's generic raster telegraph proposals never set a hitbox.

The animator has a 256-sprite pool, 64 transient limit and a 2 ms update budget
for optional decoration. One-shots expire even when not drawn, and saved/historical
events do not replay on entry. Physical ammunition, collision outlines and
status indicators retain their distinct engine shapes. Water is still the only
playable spell catalogue: Fire/Earth/Air captures are labelled presentation
fixtures, not new W8 gameplay.

A10 replaces eligible mages and enemies with the 198 delivered state/direction
clips. Velocity selects running direction; aim selects actions; stationary bodies
retain facing. Idle/run/absorb loop, actions hold their last key, and hit/death
follow observed simulation state. Whole-body mirroring includes equipment and
handedness. Upright bodies never rotate; baseline sorting stays intact. The full
384px frame draws at 97.2px at 1080p and 129.6px at 1440p, with the delivered
40.5/54px nominal body height.

The game resolves the 90 absent requests explicitly: 66 use the same entity's
nearest direction or compatible held state; the hound's 24 retain its procedural
animal. No creature substitution. Missing death animation holds the last body
frame instead of animating locomotion. F8 opens the once-per-fallback log;
brackets page through it. Training dummies and unavailable entity pages retain
procedural failure fallbacks. Unit coverage checks all 288 requests; browser
fixtures exercise every state and diagonal direction.

A11 supplies the 32px header icons and layered 96px Tideglass: four sky plates,
water clipping from remaining hours, narrowing meniscus, mist, glass, rim, marks
and orbiting bead. Noon is an art-only phase split; the core day schedule is
unchanged. Low-hours words/colour remain. Reduced motion snaps to the actual
hours and omits mist. Missing A11 art preserves the rest of the UI kit.

**Measured verification.** `npm run gate`: 176 TypeScript tests, 11 reference
tests, zero design contradictions. `npm run smoke:u4` builds production and runs
both native-resolution art suites and the complete two-week screen tour,
including ordinary mouse/keyboard combat, native aiming, emulated controller,
Trials/Games, Parley/listening, results, pause/settings and exact camp/combat
save-load. Art fixtures add all elements, motion pairs, body states/directions,
fallback overlay, clock phases/full-empty/reduced motion, and missing body,
corrupt effect and missing clock cases. No page errors or button overflow.
The final gallery has 117 distinct successful PNGs (121 capture events), plus
one clearly separated failed stress-fixture capture.

| Resolution | FPS | Frame p95 | App CPU p95 | Effect update sample p95 | Estimated texture storage |
|---|---:|---:|---:|---:|---:|
| 1920×1080 | 60.00 | 16.7 ms | 2.0 ms | 0.5 ms | 228.8 MiB |
| 2560×1440 | 60.00 | 16.7 ms | 2.4 ms | 0.5 ms | 228.8 MiB |

Samples cover 360 frames with 100 continuously visible moving projectiles and
12 animated figures using all 11 available A10 identities/pages. No additional
effects are dropped during either stress sample. Chromium uses ANGLE D3D11 on
Windows; host Ryzen 7 7800X3D, RTX 4090 and integrated Radeon installed. Selected
physical adapter, GPU timestamps and physical input latency are not measured.
CPU includes application work and render submission. Effect p95 uses twelve
samples; the application/frame p95 uses the 360-frame window.

Texture figures estimate decoded RGBA8 images, shared atlas pages once, bitmap
fonts, UI and derived arena floor; they exclude driver/framebuffer overhead and
small procedural graphics. They describe this measured route, not simultaneous
loading of every portrait/expression asset. The full screen tour measures 255.7 MiB at 1080p and 261.9 MiB at 1440p,
also below budget; those samples are in `tour/browser.json`.

**Texture mitigation.** Loading every original body page alongside the rest of
the game would exceed the 300 MiB budget. `python packages/tools/art/pack-a10.py`
packs common per-entity alpha bounds with two-pixel gutters, without resampling
or discarding any nonzero-alpha pixel. `orig`/`trim` retain the 384px coordinate
system, anchors and scale. The 11 pages fall from 174.6 MiB to 42.5 MiB.
Original deliveries remain byte-pinned alongside the derived pages and sidecars.
Pixel-copy equality is asserted during packing. Pages load on demand; reference
leases destroy body/effect sources and close bitmaps on arena exit, including
late-loading pages. The browser checks that residency actually drops.

**Simulated unchanged gameplay.**
`$env:MAGE_EVIDENCE='U4'; npx tsx packages/tools/src/u3-replay.ts` reproduces the
1,300,369-byte envelope and SHA-256
`0f0bdc7c698c45f2fa6b205bd805e3f80506fd92cc7452027c207e9d03a6fc0c` exactly.
`npm --prefix packages/core run report:w4 -- --evidence U4-evidence --tag census`
reruns 2,000 fights per wave (8,000 total): all pass, with unchanged digests and
median durations 38.233 / 44.633 / 45.483 / 58.000 seconds.
`npm run audit:u4` checks all 289 accepted/production file hashes and sidecars,
the exact census/save matches, and no diff from `61d63d8` in gameplay/Director
sources, reconciled data, camera or the arena-ground renderer.

**Still visibly provisional.**

- Arena ground, repeated rune surface, rim gaps, cropped props and procedural
  outer boundary remain the largest environment weakness. They were deliberately
  left behind the existing loader while the art stream rebuilds the plate set.
- A10 has two generated diagonal views plus mirrors, not eight unique facings.
  Creature front views and the 90 clips remain absent; nearest-direction holds
  can visibly disagree with travel, and compatible-state holds are static.
  Some delivered gaits repeat a leading leg; cross-view costume/identity shifts
  remain in the art. The hound and training dummy are procedural.
- A8 is a small-key-count family library. Tier/branch spells share components;
  they do not yet have individually painted choreography. Ground status fills,
  telegraph outlines, physical ammunition, encasement and targeting/health marks
  remain authored engine drawings. Effects can still obscure a small figure
  during a bright cast; perceptual tuning needs owner play.
- A11 is an authored composite using an existing generated rim and mist.
  Its stat relief and clock scenery are not newly generated paintings. The art
  handoff explicitly leaves richer painted icons/clock art in its backlog.
- Camp paintings remain static, without live inhabitants or per-place animated
  lighting. Existing audio approval/backlog is unchanged.

The first stress test wrapped projectiles relative to the offset fixture mage,
leaving only 70 on screen. Its failed JSON/PNG are retained under `attempts`;
anchoring the fixture field to the camera centre fixes it, with 100 visible in
every final sample. Initial unit assumptions about an entirely absent hound
manifest entry and an existing moth death clip were corrected against the actual
delivery; the policy itself was not weakened. Human motion quality, sofa
readability, physical controller feel and G1 approval remain unmeasured/not felt.
