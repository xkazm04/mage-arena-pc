# U5 — plates and readable figures

2026-10-03. [Design first](U5-plates-scale.md), [native gallery](U5-evidence/index.html).

A12's three 3072×1728 paintings and seven exact-RGB depth overlays are imported
with hashes and source-commit sidecars. The art worktree was read only. Palette
mapping follows the table: training/Games 1–2 verdigris, 3–4 rust-sand, 5–6 moonlit.
The current season still implements only the first two Games. Missing/corrupt
plates fall back to the prior tiled renderer. Plate sources release on exit or
palette change. A13 has an [optional loader boundary](A13-loader-boundary.md).

The playable ellipse is now 94×62 m centred [16,10], with A12 translated by
[0,-52] m. Opening positions, six-metre minimum separation, spell distances and
actor collision radii are preserved. Standard ground scale remains 22.5 px/m
and 55 degrees. The camera starts at the arena centre, follows beyond the wide
dead zone, and clamps to the painting. Art pylons are decorative, not collisions.
The boundary is a gameplay change; source-version saves are explicitly rejected.

Scale v3 draws figures 50% larger: nominal 60.75 px at 1080p, 81 px at 1440p
(5.625% of height). Foot locators, bars, effects and minimum telegraph cues grow
with them. The ward's visual radius is 3.6 m, still exactly 140 degrees with an
open rear. Actual attack footprints and actor hit radii remain unchanged.

`npm --prefix packages/core run report:w4 -- --evidence U5-evidence --tag layout`
initially failed the old creature ceiling by five ticks. Layout changed median
durations from U4's **38.233 / 44.633 / 45.483 / 58.000** to
**38.483 / 45.083 / 45.483 / 58.000 s**. The new provisional creature band is
30–46 s: a one-second boundary allowance, not a claim that longer combat feels
better. No compensating damage/speed changes were made. `--tag census` passes
2,000 fights per wave, with identical per-fight hashes to the layout run.
Presentation therefore contributes no further change. Zero timeouts, invalid
states, early losses or sampled replay failures. [Comparison](U5-evidence/comparison.json).

`npm run gate`: 177 TypeScript tests plus 11 reference tests, zero design
contradictions. `npm run build:game` and `npx tsx packages/tools/src/u5-browser.ts`
verify 1080p/1440p, all palettes, front/behind baseline sorting, ordinary keyboard
movement, and missing/corrupt plate fallback (22 PNGs, zero page errors).
`$env:MAGE_EVIDENCE='U5'; npx tsx packages/tools/src/u3-replay.ts` reproduces and
round-trips the 1,300,369-byte season envelope exactly.

Initial 360-frame stress samples with 100 moving projectiles and 12 figures:
60 fps at both resolutions; frame p95 16.8/16.7 ms, application CPU p95 1.6/1.4 ms,
decoded texture estimate 232.7 MiB. Final measurements are recorded in
[browser.json](U5-evidence/browser.json). Chromium ANGLE D3D11; estimate includes
shared textures/fonts/UI once, excludes driver/framebuffer overhead. Physical
input latency and GPU timestamps are not measured.

Captures were visually inspected. Southern-edge actors can pass beneath the
large inherited HUD; camera coverage cannot follow beyond the painting. Larger
body silhouettes still require ground-foot aim, and A10's incomplete directions
remain visible. Those are owner checks, not certified feel. No push or provider
calls. CF1 follows before further combat changes.
