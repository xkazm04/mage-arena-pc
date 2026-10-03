# A9 — arena material and structure restoration

2026-10-03, ART session 6. D27: restore the A6 concept's visible quality of
ground, masonry, objects and magical architecture across verdigris, rust/sand
and moonlit palettes. A7's broad flat slabs are the failure comparison, not the
fidelity target. Camp and portrait files remain unchanged.

Design: separately generated dense mineral floor swatches and modular oblique
architecture/prop sheets. Wear belongs to real stone layers, mortar, fractured
edges and old metal; it is not paper grain. A bare ground contains no repeated
baked rune circles or figures. Original seals, scorch and damage are separate
decals. A9 supplies rim segments, stands, arches, gates, banners, wardstone
pylons and smaller debris/props, with authored base lines and placement data.

One Verdigris floor proof first. Grok is preferred for this material work after
its A8 mineral correction showed stronger physical painting; agy remains
available behind its own latch. Serial requests, budget reservation, immutable
briefs and exact source provenance remain mandatory. New individual exports
route to owner review only.

Ground targets 32 source pixels/metre on unprojected ground, enough for 30
screen pixels/metre at 1440p (22.5 at 1080p) with the existing 55-degree camera.
No upscaled file will be described as new source detail. Deterministic periodic
edge conditioning may make generated swatches tileable and must be disclosed.
All sprite exports retain a common physical scale and an explicit base line.
The layout is a presentation proposal; it must not silently change core walls,
collisions, spawn locations or arena dimensions.

Deliver native 1080p/1440p composites for three palettes, source-density and
seam measurements, and side-by-side A6 comparisons. The proof will make fidelity
differences reviewable; a numeric gate cannot certify "no loss of fidelity."
Any remaining loss is named, not covered by a passing export check.

Planned gates: `python tools/art/restoration_arena.py check`,
`python tools/art/covenant.py check A9`, owner-board browser checks and portable
rebuild. Results, limits and budget are appended before the wave commit.

## Delivery and evidence

A9 delivery candidate: three native-density periodic grounds, 36 keyed structures/props, 15 decals and explicit core-preserving layout. Six 1080p/1440p composites and three A6 side-by-side comparisons are on art/review/a9/index.html. Eleven serial Grok reservations; cumulative 241/300. Clipped rust banner replaced; generated letter-like decal cells and unrequested figure excluded. Rim mapping, rune stencils, matte extraction and damage feathering are labeled derived. Material detail improved; repeated stands, derived rim and less integrated atmospheric lighting mean concept equivalence remains unproven. Owner review and game integration remain open.

Delivery: `art/delivery/a9/{arena,layout,decals}.json` and README. Ground tiles retain 1280x720 native source detail at 32px/metre, with opposite 64px bands conditioned. Source RGB edges, alpha, source/export hashes, baselines and density gates pass. Owner board browser checks pass at 1080p, 1440p and 390px. Portable rebuild forbids raw access and reproduces delivery hashes. Offline suite: 68 tests pass. These checks do not measure gameplay, FPS or owner feel.

The isolated build environment pins NumPy 2.4.6 and SciPy 1.15.3 for component labeling; global Python packages were not replaced. The first layout proof is retained under art/waves/A9 as a rejected assembly study, not the selected delivery.
