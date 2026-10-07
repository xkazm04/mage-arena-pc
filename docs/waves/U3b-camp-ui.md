# U3b — the hours beneath the collar

Authored 2026-10-03, D26. Place buttons carry only their names. Closed places
use the UI kit's disabled/hatch treatment; selecting a place has no time cost.
Gold, reputation and fatigue occupy the top-right header with loader-backed
icons. The daily dial is a verdigris ring with one rune per waking hour; spent
runes darken, the hand advances, and the remaining arc drains. Its low-hours
warning uses both colour and words. Reduced motion snaps to the truthful value.

Read-only art inspection: `mage-arena-art/art/ui/README.md`, `DELIVERY.md`,
`kit.json`, `icons.json`; current delivery is A5b, no A11-specific contract yet.
Optional `daily-clock.rim/face/hand` regions override the existing `clock.*`
ornament or procedural geometry. `icon.gold`, `icon.reputation`, `icon.fatigue`
are the optional stat keys; absent regions use engine drawings. The atlas loader
continues to own validation and missing-art fallback.

Facility actions show their actual hour duration; Board, journal, Parley and
saves carry hour context. Measured captures and validation recorded below.


Measured: `npm run gate` passes (162 TypeScript + 11 reference tests, zero
contradictions). `npm run smoke:u3` completes both 14-day routes, ordinary combat,
Trials/Games, real listening/Parley, pointer/keyboard/emulated controller and
exact camp/combat save-load at 1080p/1440p. It checks name-only map buttons,
closed visual states, free travel, the settled dial count, safe bounds and
button text overflow. 26 final PNGs, zero page errors; the gallery deliberately
retains camp/time screens while the route still validates all screens.
`npx tsx packages/tools/src/u3-gallery.ts` builds [the gallery](U3-evidence/index.html).
The before-fix capture and run are retained in `U3-evidence/attempts`: explicit
arc start points fixed the dial drawing from the canvas origin. Native captures
were visually inspected; sofa legibility and animated pacing still need owner play.

A prose-only U3a clarification records the existing per-day contest draw policy:
hour namespaces distinguish event facts; repeating an act does not reroll its
contest. No core/arena/save changes in U3b. The art worktree was read only.
Next: AU4. A11 art remains an optional loader swap.
