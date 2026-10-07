# A12 — arena to reference quality

ART session 7, 2026-10-03, branch `art`. Delivered three coherent arena paintings
and their evidence, replacing A9's assembly method for this candidate. The owner
considers camp and portraits production quality and A8/A10 a significant
improvement. Those assets remain unchanged. Only the owner accepts visual quality.

[Owner board](../../art/review/a12/index.html) ·
[Contact sheet](../../art/review/a12/contact-sheet.jpg) ·
[Runtime manifest](../../art/delivery/a12/arena-plates.json) ·
[Loader contract](../../art/delivery/a12/README.md)

## Provider diagnosis and repair

The old agy Brennic attempt saved byte-identical `output.png` and `source.png`
(SHA-256 `ba906082d6fef716c611637fc4f68535a3f31ef5a75333f27433da93977d24a7`).
Scoped parent/worker transcripts show the parent explicitly ran `Copy-Item
output.png source.png`. This was a duplicate save, not a wrapper file collision.
The parent also overwrote its CLI output, explaining duplicate final prose.

The deeper finding is separate: the linked worker made **three** `generate_image`
calls despite the one-image/no-retry instruction. The previous filename-based
audit charged two. All historical job rows remain unchanged; a separate
`A12-audit` reservation adds the missing third charge. Extracted tool arguments,
conversation IDs and original transcript hashes are preserved in
[provider evidence](../../art/waves/A12/provider-evidence/a10-brennic-north-agy-a01.json).

The driver groups output aliases by exact hash, retains alias evidence and puts
its own archive under `_driver/`. Distinct extra images still fail closed.
Unchanged reference bytes are rejected. Exact-request-linked agy parent/worker
transcripts expose internal image calls; a second observed call or first rate/
quota error terminates the process tree and latches that provider. This detects
extra calls once logged; it cannot retroactively prevent a started call.
Unverifiable agy call counts fail closed. Spend survives decode/archive failures.
Duplicate saves retain conservative charges rather than inferred refunds.

Both session-6 latch files and pre-change histories were archived before the
authorized reset. Grok's single-image proof succeeded in about 28 seconds after
the old “temporarily at capacity” HTTP 429. This is consistent with a transient
capacity failure; success does not reveal the allowance type or balance.
agy's proof succeeded too, with one internal image call recovered and archived.
Later agy calls ran under live transcript monitoring. Calls were serial throughout.

**Spend:** 11 new images, six agy and five Grok, plus one historical reconciliation.
Project 285 → **297/345**; 48 local reservations remain. Independent guards are
agy 400 and Grok 330. Current project charges: agy 81, Grok 189, with 27 older
charges on other providers. agy's four known external probes also count against
its guard. Both latches are clear, with no new quota/rate error. Real account
allowance and image money cost are unknown. CLI token cost is not image-generation
cost. [Spend record](../../art/delivery/a12/spend.json).

## Painting choice and camera geometry

Inspected Moonchalk A6 a01 and a02, Verdigris Covenant arena a02 and Ragged Oracle
arena a03, their boards and A9. A6 Moonchalk a02 is the active moonlit anchor.
Each selected palette received a reference-guided clean scene, then one coherent
wide painting generated around an overlapping guide containing that entire clean
scene. The centre five-sixths corresponds to the concept view. Architecture,
pylons, banners, rune geometry, floor and light remain painted together. There
are no assembled floor modules or extension-panel joins.

Four Grok clean-up attempts were rejected: a surviving thornback, floating earth
fragments and an over-corrected floor with bright slab islands. A local masked
repair experiment also failed direct review: patch detail and residual embers.
Its rejected evidence is retained; none of its patched pixels enters delivery.
The old figure boxes only exclude combatants when measuring a single whole-image
colour gain. Selected sources are the three agy `a12-*-wide-agy-a01` images,
native 1376×768.

The v2 camera remains 22.5 px/m at 1080p, with ground Y multiplied by sin(55°),
nominal 1.8m bodies at 40.5px (54px at 1440p), and a visible 85.333×58.597m.
The master is 3072×1728, corresponding to 102.4×70.3166m and rendering at
2304×1296 in a 1080p view: 20% overscan in each dimension. No extra Y squash
applies to the already projected painting. The proposed playable ellipse is
94×62m, centred [16,62]. A large dead zone keeps the far camera still through
central play; edge follow is soft and clamped to painted coverage.

Read-only game inspection confirms the inherited 192×144m core ellipse and
initial spawns outside this compact footprint. These cannot fit the one-screen
direction at unchanged body/camera scale. The delivery explicitly requires
boundary, spawn and saved-position migration, with combat/balance checks; it is
not compatible with the old layout without those changes. No game code changed.
[Exact geometry](../../art/delivery/a12/geometry.json) records the mapping,
camera clamps, projection and Games tiers.

Seven foreground pylon overlays come from final plate RGB: two Verdigris, two
rust-sand, three moonlit. Locally traced alpha masks retain the identical painting.
Each has a pixel anchor, horizontal base line and world foot coordinate. The fixed
overlay redraws the same background object in foot-Y depth order with actors.
Behind/front witnesses demonstrate occlusion. Other architecture remains entirely
in the plate; no separate rim or repeated stand kit is delivered.

## Resolution and local processing

The installed ComfyUI desktop points at a missing base directory. A separate
working `C:/Users/kazda/comfyui` runtime has CUDA/spandrel but no dedicated upscale
weights. Searches and paths are recorded. Before downloading a weight, the
official Real-ESRGAN release URL and BSD-3-Clause licence were recorded; licence
text and downloaded SHA-256 are archived. Weight files remain ignored.

Three local RealESRGAN_x4plus runs used that runtime and RTX 4090. Comparisons show
Lanczos, 100% learned processing and the selected **35% learned / 65% Lanczos**
blend. Full learned processing made some surfaces overly smooth or engraved; the
restrained blend preserves more source paint. Inference uses padded memory tiles,
not independently painted arena tiles. A final global RGB gain, capped at
0.8–1.25 per channel, matches environment means without local patches. Raw and
final drift are both retained.

Export density is 1.333 texels/display-pixel at 1080p and 1 at 1440p. Actual source
density is only 0.597 / 0.448 respectively. **Upscaling infers texture and adjusts
edges; it does not recover native 1440p detail.** Settings, hashes, sources,
licence and sample crops are in [upscale evidence](../../art/waves/A12/upscaling-tools.json).

## Evidence, gates and remaining gap

The board presents each approved concept beside its plate at identical 1080p
and 1440p viewport sizes, plus unscaled 640×352 floor/structure crop pairs.
A6 sources are 1672×941 and resampled to those display sizes. Six composites
use actual A10/A8 atlas frames and the confirmed v2 scale; seven depth witnesses
show both sides of the occluder base lines. The live consumer exercises movement,
animation, rare camera follow and palette switching. These are art proofs, not
gameplay captures or game performance evidence.

Final encoded-luminance deltas against A6: Verdigris +0.000558, rust-sand
+0.007097, moonlit −0.009478. Means do not establish identical local lighting.
Guide-boundary gradient checks raise no flags; no extension joins exist.
High-pass lagged autocorrelation peaks are below 0.03, versus at least 0.19 for
each A9 repeated-layout control. The 0.12 routing threshold is calibrated only
against this small set, not a universal repetition or quality guarantee.

Final export hashes bind local Qwen observations, deterministic CPU OCR and
direct reviews. All report no figures, creatures, combat remnants or readable
text; OCR's synthetic positive control succeeds. Local models missed defects in
earlier rejected candidates, so these observations are advisory, never proof or
acceptance. Gates enforce provenance, exact cutout RGB, baselines, camera coverage,
crop sizes, historical ledger integrity and rejection routing. The local grader
can reject or route to the owner only.

Below A6: finer cracks and glyphs drift or soften, some pylon modelling differs,
under-figure floor and overscan architecture are inferred, and learned processing
changes microtexture. Static light does not relight moving actors. The paintings
restore coherence but **reference equivalence is not claimed**. Owner acceptance,
game integration, collision/balance validation and engine performance remain open.

Validation: 75 unit tests, delivery checks, Chrome board checks at 1920, 2560 and
390px widths, both native camera resolutions and all palette/camera corners;
portable rebuild reproduces 46 product files without raw/provider/model dependencies.
Camp/portrait preservation is audited separately. One local commit; no push.
No further images are needed for this submitted candidate set.
