# ART session 8 — A13

Branch `art`, 2026-10-03/04. A13 delivery candidate complete; owner visual
acceptance and game integration remain open. One local commit, never pushed.

Start with the [owner board](review/a13/index.html),
[combined contact sheet](review/a13/contact-sheet.jpg),
[motion and progress consumer](review/a13/motion.html), and
[loader contract](delivery/a13/README.md).
The static board opens directly; serve the repository over HTTP for motion.

## Delivered

- Twelve original painted radicals, [glyph sheet](delivery/a13/glyph-sheet.png)
  and [construction language](delivery/a13/RUNIC-LANGUAGE.md), including collar
  and wardstone inscription assets.
- Four schools with start/hold/release casting; ring, cone and line telegraphs
  with progress masks; common warning and distinct UNBLOCKABLE warning.
- Forward ward start/hold/release, contact pulse, independently gated perfect
  window inner ring and separate confirmed-perfect flare.
- Three floor sentences with optional registered old-rune cleanup overlays;
  selection, target, slowed, rooted, burning, wet and shielded marks.
- 44 animated/static clips, 305 frame references, 44 RGBA atlas pages, explicit
  anchors, timings, tint, blend, projection, scale and fill metadata.
- Six native after composites and six matching geometric-before witnesses on
  all three A12 plates, plus catalogue/progress captures at 1080p and 1440p.
  A10 nominal head-to-sole size is 60.75/81px: 1.5 times the old size. Camera
  remains 22.5px/m at 1080p and 55 degrees. A8 travel art remains in the scenes.

## Painting and derivation

Ten generated source paintings supply the delivered pigment. Glyph placement,
school tint, alpha extraction, registration, timing, start/release reveal,
rank masks and pulses are authored. Six generated hold keys are reused in
ping-pong loops. The fan uses an authored UV warp of generated ring paint after
two generated cone attempts failed. The ward has a strict authored half-mask.
The letter-like warning source cell is excluded; the canonical warning uses
three isolated painted splinters from GATHER. All nineteen generated attempts
remain archived with local advice and direct reject/owner-review findings.

Floor cleanup is local Telea reconstruction through authored masks, not another
generated painting. Mask coverage is 0.76% moonlit, 1.62% rust-sand and 3.76%
verdigris. Some faint old scratches remain and reconstructed mineral detail can
soften. Existing A8/A10/A12, camp, portraits and UI assets are byte unchanged.

Hold silhouettes share a common construction; motion is chiefly light and
elemental tips. Canonical glyphs and especially small status modifiers need
owner judgment at the far camera. A10's incomplete direction coverage remains.
Technical checks do not establish production animation quality or owner feel.

## Game handoff

Use [sigils.json](delivery/a13/sigils.json), `loader.js` and the loading note.
The current game hooks were read from integration commit `72d0fb7`; no other
worktree was changed. Its A8 effect loader needs A13 state, projection, anchor,
mask and world-extent support. Remove visible geometric Graphics strokes when
wiring these assets; retain exact collision and timing data. The before boards
reproduce that renderer's logic and are honestly labelled, not game captures.
Do not multiply spell/world radii by the figure's 1.5 scale. The perfect-window
ring follows the live simulation flag, not the confirmed-perfect event.

All atlas pages decoded together cost 208,681,200 RGBA bytes (about 199MiB),
before mipmaps and cleanup overlays. Load relevant families on demand.
Actual engine integration, combat overlap/readability, GPU performance,
sofa/controller feel and owner acceptance remain unmeasured.

## Provider accounting

297 inherited + 21 session charges = **318/345**, leaving **27** under the
recorded combined ceiling. Twenty jobs produced nineteen archived source images;
one agy job started two image calls and was terminated. Session charges: agy 4,
Grok 17. Calls were serial, agy first, single proof before siblings.

agy remains latched on `EXTRA_TOOL_CALL`; Grok remains clear. The exact-request
parent/worker transcript audit found no further late calls. No reset, refund,
third provider or new quota assumption. Provider guards remain agy 400 / Grok
330; combined project ceiling 345. Actual shared-account allowance and monetary
image spend were not measured. [Spend](delivery/a13/spend.json),
[audit](delivery/a13/session-audit.json),
[provider evidence](waves/A13/provider-final-audit.json).

## Validation and next boundary

Integrity: 44 clips / 305 references, transparent gutters and correct source
hashes. Browser: five viewport cases, sixteen native captures; monotonic fill,
persistent boundary, hidden perfect window outside its flag, zero rear ward
pixels, fan angle mapping and animation changes. Offline master rebuild checks
byte equality with raw/provider access and network blocked. Python suite:
**81 tests pass**. Reports are beside the delivery.

The installed SciPy emits a NumPy-version warning; the deterministic rebuild
and tests pass on this recorded environment. No dependencies were upgraded.
Next work is owner visual review and game-side integration/feel verification.
No additional generation is queued; preserve the agy latch.
