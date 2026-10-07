# U5 design: coherent ground, larger figures

Authored 2026-10-03 before implementation. D31/D32, plan section j.

Use A12's 94 x 62 m playable ellipse, centred on **[16,10]**. Translate the
delivered painting and every overlay by [0,-52] metres; keep all opening
formations, actor radii, spell ranges and movement speeds unchanged. This is a
layout change, not merely presentation. The old 192 x 144 m boundary is retired.
The existing source-hash save compatibility guard rejects older combat saves;
do not silently clamp old saved actors. Re-run 2,000 fights per wave and document
boundary-induced changes separately from the presentation-only figure increase.

The 102.4 x 70.316616 m painting covers 2304 x 1296 display pixels at 1080p.
Keep 22.5 ground pixels/metre and 55-degree ground projection, fixed standard
zoom. Centre [16,10] initially, dead zone [0.16,0.18,0.84,0.80], 0.35 s easing;
clamp the viewport to painting coverage (16:9 centre ranges X 7.4667..24.5333,
Y 4.1403..15.8597). At other aspect ratios fit the painting with a quiet outer
matte where coverage is insufficient. Preprojected painting and overlays get
exactly one projection; overlay anchors and baseline sorting remain registered.
The previous tiled renderer is a missing/corrupt-delivery fallback.

Scale contract v3 owns nominal body draw multiplier 1.5: 60.75 px / 81 px,
5.625% of viewport height. Ground projection and collision radii stay unchanged.
Foot locator, bar thickness, effect scale and minimum telegraph locators follow
the larger presentation; exact damage outlines remain true geometry. Absorb
visual radius increases to 3.6 m; its 140-degree coverage remains unchanged.
A13 sigils remain an optional loader-owned skin over authoritative geometry.

Verification: geometry/spawn/camera tests, gate and game build; 8,000-fight
census; native 1080p/1440p gameplay, palettes, occlusion and fallback captures;
short frame-time and decoded texture-residency samples. Owner motion/feel is
not measured by those checks. No edits to the art worktree.
