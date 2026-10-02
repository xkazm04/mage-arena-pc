# Covenant battle candidates

`figures.json` contains 12 identities and the individually reviewed keys only.
PNG atlases are straight RGBA, 1024 square, four 512-square cells, no rotation or
trim; explicit frame rectangles and anchors are in the manifest. Unused cells
are transparent. Linear filtering, no mipmaps. The master body is 160 pixels;
scale a frame by `(viewportHeight * 0.0375) / 160`. The foot anchor is independent
of staff/aura bounds. Flying moth scale uses wing silhouette height. Ground
projection and shadows follow scale v2. Do not rotate upright body art.

The sheets are pose studies, not full animation cycles. Cassia has rear run and
absorb only. Several attack keys are excluded for incorrect weapons, framing or
clipping. Shieldman faces the opposite diagonal. More facings, a genuine walk
cycle, matching attack timing and uniform painterly fidelity remain backlog.
An engine must not silently substitute an unrelated pose for a missing state.

`effects.json` contains 20 native geometry sprites: four schools by aura, bolt,
absorb, perfect and telegraph. `painted-effects.json` contains 12 keyed painted
bolt/impact/aura motifs. Their RGB is mapped to the school pigment after matte
removal to prevent magenta spill; alpha and painted brightness are preserved.
Painted ward rings were excluded because their rear was insufficiently open.
Use the native forward arc for the 140-degree absorb. The game owns hitboxes,
facing, timings and masks; decorative auras have no mechanical boundary.

`spell-mappings.json` preserves all baseline Water line/tier/branch rows, mapped
to family motifs only. It does not implement every spell animation. The other
school effects are generic until the game stream supplies line catalogues.

Six `proofs/` composites use empty A7 plates at 1080p/1440p. The scale strip is
native 1080p scale. The contact sheet is enlarged. No screenshot is gameplay.
The owner board preserves all rejected sources and their reasons. No art is
owner-accepted by the model or by an integrity pass.
