# A13 loader contract

Load [sigils.json](sigils.json). All file paths are **repository-root relative**.
This is an engine-ready art candidate, with a working [Canvas loader](loader.js)
and [motion consumer](../../review/a13/motion.html). Game integration and owner
feel are not measured. The [rune language](RUNIC-LANGUAGE.md) governs all glyphs.

The delivery contains four schools' start/hold/release casting clips, ring/cone/
line threats in each school, normal and UNBLOCKABLE warning overlays, ward
start/hold/release and contact, perfect-window and success marks, three floor
decals, selection/target rings, five statuses, collar/wardstone inscriptions,
and the twelve canonical glyph cutouts. The manifest owns exact frame counts.
Warnings compose with **any** threat shape; UNBLOCKABLE is not a fourth hit shape.

Pages are PNG, straight RGBA in sRGB, integer `[x,y,w,h]` rectangles, unrotated,
untrimmed 384×384 frames, with three transparent pixels of atlas padding.
Premultiply exactly once for the renderer's upload format. Do not recrop each
frame to its visible pixels. Glyph PNGs are individually cropped and have their
own centres; animation frames share an anchor and a common sheet scale.
Every page/source has a SHA-256. Load pages on demand in the game, retain while
used and release when a school/scene leaves; the review consumer loads everything.

Use normal alpha blending for the pigmented body and its dark edge. Optional
additive glow should be a secondary pass at **at most 0.2 opacity**, never the
whole decal replacing the normal pass. Floor marks are lowest priority. Draw
ground marks first, then upright actors and A12 occluders sorted by foot Y, then
small status/warning billboards. Use `floor-placement.json` for the plate-registered
floor assets; those placements are already projected and do not get a Y squash.

`cast.<element>.start` and `.release` are one-shots; `.hold` loops. The start's last
frame meets the hold's first, and release ends completely transparent. Bind phase
to real cast state, stretch start duration to the actual windup, and crossfade the
current hold key to release key 0 over roughly 60 ms if they differ. These are
visual defaults, not new spell timings. Stop a one-shot after its last frame;
never clamp a final flare permanently on screen. Hold uses explicit ping-pong
references plus the consumer's short interpolation at frame boundaries.

`ward.hold` has a complete, open-rear glyph semicircle. `progress` lights it from
one tip to the other. The default game absorb is **140°**, so clip the decoration
to the actual game angle, in unprojected ground coordinates, with no visible
procedural outline. `absorb.contact` triggers on a real contact event.
`absorb.window` loops **only while `perfectWindowActive` is true**, and hides
immediately when false. `absorb.perfect` is the separate 300 ms success flare,
triggered only by a confirmed perfect absorb. No art timer grants a perfect hit.

## Position, scale and tint

The v3 art contract retains the far camera, 22.5 px/m at 1080p and ground Y
projection `sin(55°)`. It draws A10's design canvas **1.5×**: 145.8 px for a
384 px master, yielding a nominal 60.75 px body at 1080p, 81 px at 1440p.
Scale screen-dependent measurements by viewport height / 1080. Body size does
not multiply spell range. The accepted A12 compact layout is unchanged.

Ground sheets are **unprojected**. Transform as `translate × groundProjection ×
rotation × localScale`: rotate in XY, then squash Y exactly once. Do not rotate
a projected ellipse. Warning and status icons stay upright in screen space.
Anchor `[.5,.5]` is the ring/ward centre; cone `[1/3,.5]` is its apex; line
`[.1,.5]` is the start of its lane. A radius or length comes from simulation data,
never an alpha bounding box. `designFrameSize1080` is the whole frame, including
transparent margin; it is not the hit diameter.

Ring frame width/height = `radiusMetres * pxPerMetre / .36`.
Cone frame width/height = `rangeMetres * pxPerMetre / (150/384)`.
Line frame width = `lengthMetres * pxPerMetre / .8`; height =
`widthMetres * pxPerMetre / .286`. The large-shape ornament is decorative:
visible pigment feathering can cross the exact data boundary. Keep a debug-only
geometry view for validation; never reinstate bright geometric production strokes.

The canonical cone is 90°. For another angle, sample it with an **inverse polar
UV warp around the apex**: preserve radius, multiply destination angle by
`90 / requestedDegrees`, then sample the canonical texture. The Canvas consumer
demonstrates 30°, 90° and 145° without changing radial range. Use bilinear
sampling in a GPU implementation. The data shape remains the collision source.
All raster decals can scale to authored hit extents; enlarged textures do not
gain detail. At extreme lane aspect ratios, repeat the painted middle rails and
inlay additional canonical element glyphs at 24–40 screen-pixel spacing, keeping
the endcaps and warning at their anchors. Do not stretch small status glyphs with
world radius. Clamp their display size to at least 24 screen pixels at 1080p.

Four threat colour variants are already painted/tinted in the atlas. Select the
correct school clip; do not multiply another saturated school tint over it.
For a neutral ward or architectural glyph, a restrained multiply tint is allowed
using `elementTints`, preserving ivory highlights. Warning overlays never take
an elemental tint. Shape cues and values are the second channel of identity.

## Charge fill

`progress` is a simulation-owned `[0,1]` value, for example
`clamp((now-start)/(impactAt-start),0,1)`. It never changes clip playback speed or
collision data. The complete painted boundary remains at `baseOpacity`.
An additional lit layer reveals the **same painted pixels** by a rank texture.
Ring uses a clockwise rank from the top; cone and line sweep from their origins;
ward uses the arc rank. The masks are authored data, not generated painting.
They are 8-bit single-channel PNGs: sample R as linear data, not sRGB colour.

```glsl
float rank = texture(rankMap, uv).r;
float fill = progress <= 0.0 ? 0.0 : progress >= 1.0 ? 1.0
           : clamp((progress - rank) * 255.0 + 1.0, 0.0, 1.0);
vec4 paint = texture(frame, uv); // tint already baked for school threats
// Draw paint at baseOpacity, then paint with alpha multiplied by fill.
// Keep warning overlay independent of both passes and the element tint.
```

For cones, apply the same inverse polar mapping to the paint and rank texture.
At fill 0 and 1 use exact endpoints. Eight-bit rank quantization is a data limit;
the narrow interpolation band avoids hard steps. `progress-1080/1440.png` show
0/25/50/75/100% for all three shapes, including the different UNBLOCKABLE cue.

## Integration with the current game hook

The read-only integration checkout at `72d0fb7` has `EffectPlayer("a13")` hooks
but still paints geometric circles, hatched lanes, cone fills and a two-stroke
absorb arc in `arena-scene.ts`. These visible Graphics strokes must be removed
when A13 is wired; retain their exact shape data and a debug-only view.

| Existing request | A13 selection |
|---|---|
| `casting.<element>` | `cast.<element>.start/hold/release`, selected by cast state |
| `telegraph.area` | `threat.<element>.ring` + warning overlay + progress |
| `telegraph.cone` | `threat.<element>.cone` + angle/range UV mapping + warning |
| `telegraph.line` | `threat.<element>.line` + range/width + warning |
| `absorb.hold` | `ward.hold`, plus independently gated `absorb.window` |
| confirmed perfect event | `absorb.perfect` |

The existing A8 player is **not an unchanged A13 loader**: it expects
`designSize1080`, preprojected sprites and no rank masks, and currently applies
the figure scale to effects. Adapt it to `designFrameSize1080`, `plane`, actual
anchors, progress and explicit world extents above. A simple clip alias would
silently lose those requirements. `loader.js` is the reviewable reference.

## Sources, floor cleanup and boundaries

New sources are generated paintings. The glyph assembly, black-matte alpha,
school tint, sheet registration, soft edge trimming, the fan's UV-warped pigment,
strict ward half-mask, start/release reveals, pulses and rank maps are authored.
Six generated hold keys are not ten new drawings when ping-pong repeats them.
The source's generated glyph-like writing and failed shape attempts stay rejected.
`source-gates.json` records original cell bounds, registration offsets and trims.
Only dim spill below alpha 110 is feathered at cell edges; opaque paint clipping
fails the build. White floor-sheet separators are excluded before extraction.

`floor-cleanup/*.png` are optional **plate-registered replacement overlays**.
They remove old glyph strokes with authored region/stroke masks and local Telea
inpainting, then `floor-placement.json` places the new canonical floor sentence.
Original A12 bytes and occluders are unchanged. Fine mineral detail inside these
masks is inferred and can soften; faint old scratches remain. The overlay is
not generated painting or a claim of perfect source-preserving inpainting.

The native composites use A10 bodies at the larger size and A8 travel art.
“Before” is a labelled Canvas reproduction of the current game geometry,
not a captured game session. [Source evidence](../../waves/A13/before-renderer.json)
and actual A8 texture comparisons remain separate. Actual combat readability,
performance, physical sofa/controller testing and owner acceptance are unmeasured.

Rebuild offline from committed source archives:

```powershell
python tools/art/a13_build.py
python tools/art/a13_floor.py
python tools/art/a13_browser.py --no-board
python tools/art/a13_board.py
python tools/art/check_a13.py
python tools/art/a13_browser.py
python tools/art/a13_portable.py
python -m unittest discover -s tools/art -p "test_*.py"
```

Serve the repository (`python -m http.server 8766`) for the module-based motion
page. The static owner board also opens directly. No paid call, GPU model,
credentials or ignored raw generation file is needed for a normal rebuild.
