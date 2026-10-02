# Covenant UI loading contract — version 1

Published first for the parallel game stream. Entry point: `art/ui/kit.json`.
The A5b delivery will populate that file and its PNG pages without changing this
schema. Until it exists, use the same region IDs with temporary engine shapes.
This is an art interchange format, independent of a canvas library.

All paths in the manifest are relative to this directory. PNG pages use sRGB,
straight RGBA, transparent background, no mipmaps, linear filtering, no rotation,
no trimming. Upload with the engine's normal straight-to-premultiplied conversion
exactly once. Regions exclude a 2 px transparent gutter. Do not sample adjacent
regions or stretch ornament corners. Source pixels equal design units at 1080p.

```json
{
  "schemaVersion": 1,
  "id": "covenant-ui-v1",
  "status": "owner-review",
  "designSize": [1920, 1080],
  "safeArea": [96, 54, 96, 54],
  "pages": [{"id": "frames", "file": "atlases/frames.png", "size": [2048, 2048], "sha256": "..."}],
  "regions": {
    "panel.body": {
      "page": "frames", "rect": [2, 2, 256, 256],
      "anchor": [0, 0], "nineSlice": [24, 24, 24, 24],
      "minSize": [96, 96], "contentInsets": [32, 32, 32, 32]
    }
  },
  "components": {
    "button": {"states": {"normal": "button.normal", "hover": "button.hover", "focus": "button.focus", "pressed": "button.pressed", "disabled": "button.disabled"}}
  },
  "tokens": {}, "typography": {}, "motion": {}
}
```

`rect` is integer `[x,y,width,height]`, origin top left. `anchor` is normalized
within that untrimmed rectangle. All insets are `[left,top,right,bottom]` in source
pixels. Nine-slice centers and edges stretch; corners keep their design size.
Reject a requested size below `minSize`. Omitted `nineSlice` means a regular sprite.
Omitted `contentInsets` means no text container. Manifest SHA-256 binds exact bytes.
Unknown schema versions fail with an explicit loader error; unknown optional
fields may be ignored. Missing required IDs are errors, not silent substitutions.

Required region IDs:

- Panels: `panel.body`, `panel.header`, `panel.tooltip`, `panel.modal`, `panel.story`.
- Buttons: `button.normal`, `.hover`, `.focus`, `.pressed`, `.disabled`.
- Tabs: `tab.normal`, `.hover`, `.focus`, `.selected`, `.disabled`.
- Slots: `slot.normal`, `.hover`, `.focus`, `.selected`, `.locked`, `.cooldown`, `.borrowed`.
- Bars: `bar.track`, `bar.hp`, `bar.mana`, `bar.stamina`, `bar.cast`, `bar.cooldown`.
- Clock: `clock.rim`, `clock.face`, `clock.hand`, `clock.pip.off`, `clock.pip.on`.
- Cursor: `cursor.pointer`, `cursor.aim`, `cursor.interact`, `cursor.blocked`.
- Hollow Board: `card.normal`, `card.unread`, `card.selected`, `card.warning`.
- Icons: prefix `icon.`; full IDs and spell mappings ship in `icons.json`.

State priority is disabled/locked, pressed, focus, hover, selected, normal.
Selection persists separately from focus: draw `slot.selected`/`tab.selected`
behind a focus outline. Each component lists its own supported states. Focus has
a bright broken double border and corner pointers; disabled has an X/hatch cue,
so meaning does not depend on colour. Cursor anchor is its actual hot spot.

Bars use `bar.track` plus an interior fill clipped from the left at normalized
`value` in [0,1]; never scale the frame with the value. Cooldown uses a game-owned
radial mask over the slot. Clock rotates only `clock.hand` about `[0.5,0.5]` and
lights game-supplied tier pips; art does not own tier times, spells or resource caps.
Do not rotate upright character sprites. All text is drawn by the canvas engine;
no labels, key bindings, names or numbers are baked into these textures.

Layout scales uniformly by `min(viewportWidth/1920,viewportHeight/1080)` and centers
the design rectangle; preserve the 5% safe area. At 1440p the scale is 4/3.
Minimum navigation target is 64x64 design units with 16-unit gaps. Body text is
28 units, secondary 24, headings 40, display 64. Do not shrink text to fit: wrap
or paginate. Typography files, licensing and exact family names will be declared
in `kit.json`; fallbacks are review-only, never the final visual bar.

All menu, camp, season, board, journal, Parley, composition, HUD, pause, results,
save and load screens use these canvas primitives. Game code owns navigation,
focus order, accessibility, text entry, input hints and state transitions. UI art
supplies explicit mouse/keyboard/gamepad focus visuals, not DOM form controls.
Motion tokens specify visual durations only; reduced motion removes pulses and
translations while retaining state changes. UI textures use normal alpha blend;
glow is baked into small ornaments, never a full-screen noise or paper overlay.

Delivery validation: `python tools/art/covenant_ui.py check`. Expected evidence:
region bounds/gutters, alpha, state coverage, nine-slice stretch proofs, both
resolution captures, missing-file detection and owner board. Engine integration,
runtime performance and sofa-distance feel remain for the game stream/owner.
