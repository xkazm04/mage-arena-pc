# ART session 7 — A12

Branch `art`, 2026-10-03. One local commit, never pushed. A12 candidate delivery
is complete; owner visual acceptance and game integration remain open.

Start with [owner board](review/a12/index.html),
[contact sheet](review/a12/contact-sheet.jpg) and
[live camera/occlusion proof](review/a12/canvas-demo.html).
The live consumer needs the repository served over HTTP; the board also opens
directly. [Design note](../docs/waves/A12-arena-plates.md).

## Delivered

- Three single coherent reference-guided arena plates, 3072×1728: Verdigris,
  rust-sand and moonlit. Rim, floor, pylons and banners are painted together.
- Seven foreground pylon depth overlays, exact plate RGB with authored silhouette
  alpha, pixel anchors and world base lines. No modular floor or repeated stands.
- [arena-plates.json](delivery/a12/arena-plates.json),
  [geometry.json](delivery/a12/geometry.json), tested `loader.js` and
  [integration contract](delivery/a12/README.md).
- Six equal-size A6 comparisons, six native crop boards including structure detail,
  six A10/A8 composites at v2 body/effect scale, six clean views and seven
  behind/front witnesses. Training/1/2 → Verdigris; 3/4 → rust-sand; 5/6 → moonlit.
- Hash-bound reviews, local vision/OCR advice, drift/seam/repetition diagnostics,
  positive controls, rejected sources/trial and complete spend evidence.

The paintings restore scene coherence, but exact reference quality is not claimed.
Fine cracks, glyphs and some pylon modelling are softer/different; overscan and
the floor beneath removed figures are inferred. Local models missed defects in
earlier rejected attempts. They may reject or route to the owner only.

## Camera and integration boundary

Keep v2's 22.5 px/m at 1080p, sin(55°) ground Y and 40.5px nominal bodies
(54px at 1440p). The 102.4×70.3166m plate renders 20% larger than one 16:9 view.
Proposed playable ellipse: 94×62m, centre [16,62]. Camera mostly stays still,
following softly only outside a broad dead zone and clamping to painted coverage.
Do not apply another Y squash to the plate. Sort fixed overlays with actors by
world foot Y; the same object already exists in the background.

The inherited game ellipse is 192×144m. Existing initial spawns [8,10], [24,10],
[12,10] are outside the compact footprint. Game work remains: migrate boundary,
spawns/saves, load the plate/overlays, and check combat distances, waves, collisions,
balance and performance. Do not shrink actors or spell ranges. No game code was
modified. This is an explicit layout proposal, not a drop-in legacy arena.

## Provider recovery and spend

agy's old anomaly had two causes: duplicate output/source saves and three hidden
worker image calls. Exact scoped transcript evidence is archived; old ledger rows
are unchanged and the missing third historical charge is appended separately.
The driver now deduplicates aliases, isolates archival copies, rejects unchanged
reference returns and monitors linked parent/worker calls. Extra calls or first
rate/quota errors stop and latch the affected provider. Detection cannot cancel
an already started call retroactively; unresolved evidence fails closed.

Both old latches were archived before the authorized reset. Grok's one-image
proof succeeded after its old temporarily-at-capacity 429. agy's proof also
succeeded. Current latches are clear; future first errors must stop the provider.

**11 new images (agy 6, Grok 5) + one historical reconciliation = 297/345 project
charges.** Guards: agy 400 / Grok 330. Remaining combined local allowance: 48;
provider-local remainders: 315 / 141 (agy includes four known external probes).
Actual account allowance and image monetary price are unknown. No automatic
resets, retries or paid calls are needed to rebuild this delivery.

## Resolution and tools

Native wide sources are 1376×768. Masters use 35% local RealESRGAN_x4plus and
65% Lanczos plus a measured whole-image colour match. This is inferred texture
and edge processing, not recovered native 1440p detail. Upscale comparisons and
licence/source/hash are recorded under `waves/A12`; model weights stay ignored.
The desktop Comfy configured base is missing; the working alternate CUDA runtime
at `C:/Users/kazda/comfyui` was used. Existing EasyOCR weights were reused with
downloads disabled. Regular rebuild uses checked-in source/upscale archives.

## Validation and retained work

75 unit tests pass. [Technical gates](delivery/a12/checks.json),
[Chrome checks](delivery/a12/browser-check.json) at 1080p/1440p and a 390px owner
board, and [portable rebuild](delivery/a12/portable-check.json) pass. All 46
generated product files match in the disposable copy without raw outputs or
model weights. [Session audit](delivery/a12/session-audit.json) verifies unchanged
history, one call per new image, and 156 unchanged camp/portrait files.

Rebuild/check commands are in the delivery README. Runtime proof screenshots
live in ignored `review/browser/a12`; measured reports are committed. Earlier
A9, A10 partial direction coverage and A11 design limitations remain historical
evidence; this session is only A12 and does not claim to finish unrelated work.
Next work is owner visual disposition and the compact-layout game migration.
