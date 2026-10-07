# U2 ? Covenant art wiring

2026-10-03 ? GAME / integration ? [design note](U2-art-wiring.md) ?
[evidence gallery](U2-evidence/index.html)

U2 wires the Covenant delivery throughout the canvas game. Five commits cover
assets, UI, arena, camp and polish. The real art merge preserves integration's
plan and owner-check history; the art worktree was not edited. This is authorized
integration of review-labelled deliveries, not a new owner acceptance decision.

**Authored implementation.** 246 allowlisted files have verified SHA-256 hashes,
per-file sidecars and an accepted runtime manifest. A5b's 90 atlas regions,
nine-slice metadata, independent selection/focus, cursor states, cast/cooldown
bars, Cinzel / Source Sans 3 type and reduced-motion-aware feedback replace the
procedural default. A4c supplies three time maps, eight hotspots/backdrops and
six thematic story illustrations with Hollow Board atlas frames. A2c supplies
all sixteen identities and 112 expressions, with portraits in character choice,
the cast journal, place residents, Parley, Trials and closure. A failed asset
retains its procedural fallback; cast navigation does not depend on art data.

Arena palettes are data-driven: training and Games 1?2 verdigris, 3?4 rust/sand,
5?6 moonlit. The latter Games remain unimplemented; all palettes have review
captures. A7 floor crops and native-scale pylons/rim stones render in the far
fixed camera, with props and actors sorted by their feet. A3c painted Water
aura/bolt/impact motifs accompany exact code-owned ward and telegraph geometry.
All twelve roster figures remain procedural, with per-identity gate decisions
in `packages/game/data/covenant.json`; static rear keys cannot supply the missing
facings, cast validity and animation. No discarded A2/A3 image is loaded. `npx tsx packages/tools/src/u2-audit.ts`
verifies source, accepted and production hashes for all 246 assets, excludes
tracked legacy deliveries and confirms the unchanged gameplay/replay/census.

**Measured validation.** `npm run gate`: 156 TypeScript tests plus ten reference
tests PASS, zero design contradictions. `npm run smoke:u2` and
`npm run smoke:u2:art` use isolated saves and offline Director. The full route passes at both resolutions: **80 capture events / 76 distinct
PNGs**, zero page errors and no text overflow. The route
checks every screen, focus graph, safe bounds, native mouse/keyboard and emulated
controller, both weeks, ordinary combat input, and exact camp/combat save-load.
Delivery fixtures pass at both resolutions (56 PNGs), covering every expression,
place, time map and story. Six fault cases pass (12 menu/arena PNGs), bringing
the gallery to 144 final captures. The injected
failures exercise missing all art, missing/corrupt UI, corrupt portrait, missing
backdrop and missing fonts through both camp and combat.

| Resolution | FPS | Frame p95 | CPU p95 | JS heap used | Estimated texture storage |
|---|---:|---:|---:|---:|---:|
| 1080p | 60.00 | 16.7 ms | 2.0 ms | 42.1 MiB | 193.0 MiB |
| 1440p | 60.00 | 16.8 ms | 2.2 ms | 42.5 MiB | 199.1 MiB |

Samples use 100 continuously visible moving projectiles over 360 frames in
headless Chromium with ANGLE D3D11 on Windows. Host: Ryzen 7 7800X3D; RTX 4090
and integrated Radeon adapters installed (selected adapter not independently
verified). CPU time covers application frame work, not GPU timing or physical
input latency. Texture figures estimate decoded RGBA8 image/font/UI/derived
floor storage, counting shared atlas pages once; exclude driver overhead,
framebuffers and small procedural graphics. Cached assets reflect the route at
the measurement point, not a worst-case preload of every delivered image.

**Simulated unchanged gameplay.** `npx tsx packages/tools/src/u2-replay.ts`
produces an exact 1,296,151-byte save envelope, restores it byte-for-byte and
matches U1's SHA-256
`a344b92d448a932148f292ac69a8c5e47e9c479214336ca0544c67bbadcdfacd`.
`npm --prefix packages/core run report:w4 -- --evidence U2-evidence --tag census`
passes 2,000 fights per wave (8,000 total), with medians
**38.233 / 44.633 / 45.483 / 58.000 seconds** and U1-identical census digests.
No core, Director, balance, geometry, save-schema or source-fingerprint changes.
The report command alone gained U2 as an evidence destination.

**Next art round / still visibly provisional.**

- Highest priority: consistent directional, animated figures for all twelve
  combat identities at 3?4.5% viewport height, valid staff/cast/absorb actions,
  enemy attack tells and death/contact sequences. Current pale-cloth/staff
  silhouettes and enemy shapes are static procedural placeholders.
- Deliver a tileable bare ground, separate rune decals, transparent pylons and
  curved rim segments for all three palettes. Current A7 flattened paintings
  require blended repeating floor crops and polygon prop masks; rune repetition,
  rim gaps, crop edges and palette alignment remain visible. The outside arena
  and part of the boundary remain procedural.
- Painted effects are static motifs with procedural motion/trails. Animated
  spell/impact sheets and a coherent set for later schools are still needed.
- Camp scenes are static paintings; eight place backdrops each have one authored
  light condition. Live camp inhabitants, ambient loops and per-place day/dusk/
  night variants have not been delivered. Some portrait expressions vary in
  framing/detail; the expression gallery makes that reviewable.

Screen transitions and focus feedback are implemented, but **sofa readability,
physical controller/aim feel and desire to keep playing are not measured/felt**.
No new long soak or G1 sign-off. Failed stale-preview and prop-order attempts
are retained under `U2-evidence/attempts`; the sorting defect was fixed and the
full final build rerun. No push, art-worktree edits or provider calls.
