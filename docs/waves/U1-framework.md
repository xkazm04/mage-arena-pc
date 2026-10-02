# U1 framework — design before implementation

One viewport-filling Pixi canvas owns scenery and UI. The browser document only
hosts that canvas; no HTML panels or browser form controls. A 1920 by 1080 design
space scales together; safe bounds are 5%, primary targets at least 64px high,
body text 30px, secondary labels 24px. Rendering uses bundled open-license
Cinzel and Alegreya Sans, rasterized once into bitmap atlases. Their OFL files
and upstream source URLs ship alongside the fonts.

The shared kit exposes named panel, button, tab, slot, bar, tooltip, cursor and
focus primitives. Nine-slice textures keep borders intact. Until A5b arrives,
generate original dark stone/verdigris/moonchalk textures in code, with restrained
metal edges, cracks, runes and luminous focus; no paper grain. Optional atlases
load through the same texture lookup; errors fall back per component. Art's
`art/ui/README.md` was not present at start; reread and reconcile before handoff.

The retained canvas UI stores semantic IDs, hit bounds, focus state and callbacks.
Keyboard navigation and pointer activation share the same actions. The fourth
sub-wave completes controller routing, virtual keyboard, focus recovery and
TV validation. A read-only semantic snapshot supports Playwright without hidden
HTML buttons. Canvas text entry uses keyboard events; no default form controls.

Framework validation covers atlas schema/bounds rejection, scaling/safe areas,
directional focus and disabled controls. `npm run gate` and production build must
pass before this sub-wave commit; screen migration follows in its own commit.

Contract arrived during this sub-wave: read art/ui/README.md (version 1). Loader now consumes /art/ui/kit.json with pages/regions, exact required IDs, hashes, bounds, anchors, asymmetric slice insets and minimum sizes. Missing/malformed kits retain the procedural kit with explicit diagnostics. `npm run gate`: 150 TypeScript plus ten reference tests PASS. Production build PASS. Census: all 8,000 fights pass; W7 digests identical.
