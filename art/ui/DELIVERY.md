# Covenant kit delivery

Load `kit.json` by the unchanged version-1 [contract](README.md). The two 2048px
RGBA pages contain 90 regions: 41 interface primitives/states and 49 icon IDs.
Nine-slice insets, content insets, minimum sizes, anchors, cursor hot spots and
component state maps are explicit. Two pixels of transparent gutter surround
every region. Selection and focus are separate layers for slots/tabs; focus
overlays have transparent interiors. Bars clip fills; the clock hand rotates
around its centre. Do not rotate the rim or scale frame corners with bar value.

The source panel, slot, button and clock are locally keyed generated ornaments;
state overlays, bars, hands, cursors and icon geometry are original deterministic
art. `source-crops.json` and `provenance.json` bind source bytes and transformations.
No superseded A5 image is imported. `icons.json` lists exact IDs and maps all
baseline Water rows to line marks. Other schools currently supply school/resource
marks; later game spell catalogues can add optional regions without renaming IDs.

Cinzel is the display/heading face; Source Sans 3 is the body/secondary face.
Font files and their OFL licenses ship in `fonts/`. Design sizes are 64/40/28/24,
scaled uniformly with the 1920x1080 design rectangle. Wrap or paginate text;
never shrink it below these sizes. Preserve the five-percent safe area.

`preview.html` is an HTTP-served canvas art review harness, not the game framework.
Number keys select review screens, arrows move focus and Enter shows press
feedback. `window.setCovenantScreen(name)` selects any of the eleven layouts.
Game code owns real navigation, gamepad input, focus order, text entry, mechanics
and animation. The kit supplies motion durations and reduced-motion guidance.

Checks: `python tools/art/covenant_ui.py check` validates loading data, alpha,
bounds, gutters, states, fonts/licenses and exact nine-slice corner bytes.
`python tools/art/covenant_ui_browser.py` loads the actual atlases/fonts and
captures eleven layouts at 1080p/1440p, with keyboard focus checks. Deliberate
missing-file/schema/region/bounds mutations must fail in unit tests.

All assets remain owner-review. Runtime engine performance, physical gamepad
navigation and sofa-distance feel are not measured by these static captures.
