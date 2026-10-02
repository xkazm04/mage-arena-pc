# A5b — Covenant canvas UI kit

ART session 5, 2026-10-02. Contract written first at `art/ui/README.md` and
committed early so the parallel game stream can build its loader. Asset work
follows A7 and A3c. One wave result and session entry will be appended here.

Design: obsidian enamel, aged silver and restrained verdigris, chipped bevels,
broken concentric seals and clear pale typography. Wear belongs on physical
edges; no grain, paper, noisy fill or generated lettering. Native vector sources
and deterministic raster atlases are appropriate for exact UI geometry.
One rendered panel/slot proof receives direct and local review before expansion.
All states, bounds, anchors and nine-slice insets follow the published contract.
Atlas loading and review do not constitute owner acceptance. No old A5 art reused.

## Delivered kit

The original README contract from 06cd5e4 is byte-unchanged. `art/ui/kit.json`
populates schema 1: two 2048-square straight-RGBA atlases, 90 regions (41 states/
primitives plus 49 icon IDs), exact insets/minimum sizes/anchors/hotspots, state
maps, typography and motion/reduced-motion tokens. Fonts and OFL licenses ship.
Generated ornament proof supplies panel/slot/button/clock craftsmanship; all
state overlays, bars, hand, cursors and icon geometry are native original art.
No old A5 image reused. All baseline Water rows map to line icons; additional
school line glyphs await game data. See `art/ui/DELIVERY.md`.

One-image proof passed direct/local routing before derivation. One agy image;
project 180/240 charged, 60 remain; no live quota/refusal/rate-limit incident.
Strict metal-matte cleanup removes pink fringes without changing the separate
lilac-preserving character extraction. Focus has a broken double border and
corner pointers; disabled uses hatch cues. Selection can persist under focus.

[Owner board](../../art/review/a5b/index.html) includes the source, native stretch
proof and actual canvas-loader captures of eleven layouts at 1080p and 1440p.
These are art harness layouts, not game-stream screen implementation. Canvas
text uses bundled Cinzel and Source Sans 3. No browser controls, form elements
or default fonts. Arrow focus and Enter press feedback are implemented in the
harness; the game owns navigation/gamepad/text entry and all live game state.

`python tools/art/covenant_ui.py check`: PASS, 90 regions, two pages, bounds,
transparent gutters, required state coverage, fonts/licenses, nine-slice corner
byte preservation. `covenant_ui_browser.py`: PASS, 22 actual canvas captures,
loaded fonts/atlases, keyboard focus, zero DOM controls/page errors. `covenant.py
check A5b` and `covenant_browser.py A5b`: PASS, 24 board images at desktop/mobile.
59 unit tests PASS, including planted missing-page/schema/region/bounds defects
and impossible nine-slice size. Three actual local UI diagnostics route to owner;
small hints and tight title clearance were corrected before final recapture.

Unmeasured: game-stream integration, runtime performance, physical gamepad input,
sofa-distance feel and owner art acceptance. Atlas decoded pixel storage is
32 MiB before engine allocation/overhead; this is arithmetic, not runtime memory.
Next A4c; no push.
