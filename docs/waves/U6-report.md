# U6 ? painted sigils and complete screen pass

2026-10-04. GAME / integration. Design: [U6-design.md](U6-design.md).

A13 source `8908c10144418db22be3e278318fd64b4fcb3788` was read without changing the art worktree. The selective importer records hashes for 68 delivery files. Delivery owner-review status is preserved; integration does not declare owner acceptance.

The verified loader now supplies all 44 clip contracts, twelve radical glyphs, casting start/hold/release, normal/unblockable threat marks and rank-mask progress, ward start/hold/release/contact and perfect feedback, target/selection and supported status marks. Start and hold use the actual windup; release is a simulation event. Ground marks rotate before one ground projection and never inherit the enlarged character scale. A GPU polar mapping shapes the painted cone; lanes repeat their middle rail while retaining end caps. Pages are leased lazily, expire after five unused seconds and release on scene exit. Missing pages use existing procedural warning/ward/target geometry. Floor sentences and cleanup overlays are registered to all three A12 plates. Collar and wardstone inscriptions also appear in the HUD/menu and Lab respectively.

The core currently represents slowed, rooted, ward and sheen statuses. Their delivered marks are wired to those real states. Burning and wet assets are accepted/available but do not invent statuses absent from the simulation. This remains a Water combat kernel with authored practice-school modifiers, as before.

The geometry test measures the convex envelope of alpha >= 40 pigment in all 120 frames of the twelve threat clips, verifies atlas hashes and tests authored spell/enemy boundaries against the renderer mapping. Coverage calibration: ring 1.12x, cone 1.04x, lane 1.3x longitudinal / 1.8x transverse (segment caps included). Allowed inward error: two 384-master texels plus 3% of the narrow dimension. This is a conservative footprint envelope, not a claim that every interior pixel is opaque. The data geometry remains the only damage authority; the debug view shows that geometry independently.

Shared tooltip wrapping/insets, painted school icons, menu/header inscriptions, save portrait, resource-bar insets and spell-slot labels were corrected. Composition buttons no longer split Inspect across lines; card metadata sits inside its frame. Parley text and Lab controls have larger insets. Redundant place-button and clock captions were removed. Native 1080p/1440p evidence includes all eight places at their available times, main menu, character pick, map, Board, journal, Parley, composition, results, pause/settings/audio, save/load, calendar and every Lab panel.

## Measured checks

- `npm run gate`: 194 TypeScript tests + 11 reference tests; zero design contradictions.
- `npm run build:game`: passed (existing bundle-size advisory).
- `npx tsx packages/tools/src/u6-tour.ts`: passed, 106 captures across the full two-resolution Playwright screen/season walk; navigation, keyboard reach, zero overflow/DOM form controls, saved season restored.
- `npx tsx packages/tools/src/u6-browser.ts`: passed, 74 captures covering all element/shape combinations, four progress phases, casting, ward/perfect, statuses, floors and Lab controls; 100 projectiles/12 bodies maintained throughout the timed sample. Both native resolutions measured 60.002 fps and 256.97 MiB of decoded textures. Final exact timing/memory lives in [browser.json](U6-evidence/browser.json).
- `$env:MAGE_EVIDENCE="U6"; npx tsx packages/tools/src/u3-replay.ts`: same-seed and save/load byte equality, 1,300,369-byte envelope, hash `aed6cb288bfd1ed73dd00fd88fec9eee6e041368abf2693304dd2c1875eeeec9`.

[Native gallery](U6-evidence/index.html) links every capture. Texture memory is decoded RGBA plus UI/font/derived textures; Chromium heap is reported separately and is not GPU VRAM. The 60 fps check is headless Chromium/D3D11 on this machine, with a 2% frame-cadence tolerance and an 8 ms p95 CPU ceiling. Human TV readability, aesthetic acceptance and combat feel are not measured by these scripts. H1 follows as a separate sub-wave.
