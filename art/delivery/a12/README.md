# A12 arena plates

Three coherent reference-guided paintings, seven fixed foreground depth overlays,
and a loadable [arena-plates.json](arena-plates.json). Owner review is pending.
[Owner board](../../review/a12/index.html), [contact sheet](../../review/a12/contact-sheet.jpg),
and [interactive art consumer](../../review/a12/canvas-demo.html).

Each master is 3072×1728. Each native generated source is 1376×768. A local
RealESRGAN_x4plus pass contributes 35%, with 65% Lanczos interpolation and a
single whole-image colour match against the approved reference environment.
This improves edge presentation; it does not recover native 1440p detail.
Source, licence, hash and exact settings are recorded in
[upscale evidence](../../waves/A12/upscaling-tools.json).

## Loading and coordinates

All manifest paths are repository-root-relative. `loader.js` is a standalone
Canvas reference consumer, also loading the existing A10 character and A8 effect
manifests. Serve the repository root over HTTP for ES module loading; the static
owner board can also be opened directly.

```js
import {loadArenaPlates} from './art/delivery/a12/loader.js';
const art = await loadArenaPlates();
const palette = art.manifest.paletteForGames[String(gameTier)];
art.render(context, palette, {
  width: 1920, height: 1080, centre: [16, 62]
}, actors, effects, elapsedMs);
```

Actors use `entity`, `state`, `facing` and `positionMetres`; effects use `clip`
and `positionMetres`. An optional `frame` pins the source key for static proofs.
Missing A10 directions are reported as `missingClips`, never invented. Without
`frame`, the reference consumer uses authored durations. Its repeating effect
witness is demonstration timing, not game combat scheduling.

The plate is already projected. World-to-screen ground coordinates use 22.5 px/m
at 1080p on X and `22.5*sin(55°)` on Y. Scale both by viewport height / 1080.
Place the image at `offsetWorldMetres`, rendering 2304×1296 at 1080p or
3072×1728 at 1440p. Do **not** squash its Y a second time. Upright A10 body height
remains nominally 40.5px / 54px (1.8m); atlas bounds include empty pose margins.
The current geometry specifies 16:9 and fixed zoom=1.

Each overlay has `cropMasterPx`, `anchorPx`, `baseLineMasterPx` and
`baseWorldMetres`. Its RGB is byte-identical to the corresponding plate crop;
only silhouette alpha was authored. The background contains the same object.
Redraw the overlay at that fixed location, sorting it with actors by foot world Y.
An actor behind the base is covered; one in front draws last. Never move or repeat
an overlay independently. Paint contact shadows before sorted layers. A8 effects
retain their declared `lighter` or `source-over` blend.

## Compact layout migration

[geometry.json](geometry.json) proposes a 94×62m playable ellipse centred [16,62]
inside a 102.4×70.3166m plate. A normal view covers 85.333×58.597m. The full
painting is 20% wider and taller than the view, so a far camera can remain still
and follow softly only near the edge. Camera clamps are explicit. No extension
panels, floor tiling, repeated stands or assembly joins are used.

This cannot cover the inherited 192×144m core ellipse at unchanged v2 camera scale.
Game integration must migrate the boundary, initial spawns and saved positions,
then check combat spacing/ranges and wave balance. Current initial spawns [8,10],
[24,10] and [12,10] lie outside the compact ellipse. The coordinate transform is
provided for migration planning; do not scale actor bodies, combat ranges or
tightly spaced formations automatically. Painted stones are not collision data.
The game checkout was inspected read-only and has not been integrated.

Training / Games 1–2 use verdigris; Games 3–4 rust-sand; Games 5–6 moonlit.

## Evidence and limits

`proofs/` contains six full-size A6 comparisons, six 1:1 floor/structure crop
boards, six A10/A8 composites, six clean viewports and seven behind/front witnesses.
References are resampled to the same display size; “native crop” means unscaled
pixels from that 1080p/1440p comparison, not native generation at that resolution.
The approved A6 scene itself is 1672×941. [proofs.json](proofs.json) records source
frames and placement. Composites are art witnesses, not gameplay captures.

`metrics/` records raw and colour-matched luminance/RGB drift, boundary-gradient
diagnostics and high-pass autocorrelation with A6/A9 controls. `ocr/` includes a
positive control; `semantics/` contains hash-bound local vision advice.
`reviews/` records direct observations and deficits. None certifies semantic
absence, painting quality, game performance or owner acceptance. Local grading
may reject or route to the owner only. Seven occluders are sufficient for these
paintings; no separate backdrop rim, banner or pylon kit is required.

Fine cracks, glyphs and some pylon modelling drift from A6. Overscan architecture
and floor beneath removed figures are inferred. Learned processing changes some
microtexture, and static scene light does not relight moving characters.

## Rebuild and check

Using the project art Python environment (Pillow, NumPy, SciPy):

```text
python tools/art/arena_plates.py
python tools/art/check_a12.py
python tools/art/a12_board.py
python tools/art/a12_browser.py
python tools/art/a12_portable.py
python -m unittest discover -s tools/art -p "test_*.py"
```

The regular rebuild uses archived sources and the checked-in local upscale
results. It requires neither `art/raw`, provider credentials, paid calls, model
downloads nor GPU inference. Re-running the optional local model requires the
recorded model/runtime. Changed plate bytes invalidate semantic reviews.

[Spend](spend.json): 11 new images (6 agy, 5 Grok), plus one separately recorded
historical reconciliation; project 297/345. Caps: agy 400, Grok 330. Account image
prices and real remaining allowance are unknown. Both old latch files are retained.
