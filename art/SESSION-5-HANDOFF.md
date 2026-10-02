# ART session 5 - Covenant handoff

Open the [combined owner board](review/covenant/index.html),
[contact sheet](review/covenant/contact-sheet.jpg), or an individual wave below.
New assets remain owner-review candidates. No acceptance or game integration is
claimed, and historical gate failures remain visible.

| Wave | Delivery | Boundary |
|---|---|---|
| [A7](review/a7/index.html) | Covenant data bible, scale v2, three arena palettes at two resolutions | Fixed 55-degree authored camera, nominal body 3.75%; owner visual review |
| [A3c](review/a3c/index.html) | Twelve identities, 38 reviewed keys, twelve RGBA atlases, 32 effects, six native composites | Partial poses; camera/fidelity and animation backlog |
| [A5b](review/a5b/index.html) | 90-region UI kit, two RGBA pages, 49 icons, fonts, states and anchors | Early contract unchanged; game framework integration pending |
| [A4c](review/a4c/index.html) | Three map slots, eight places/backdrops, six story crops, Hollow Board | Exact baseline opening slots; visits have one authored light condition |
| [A2c](review/a2c/index.html) | Sixteen cast identities, neutral plus six moods each, sixteen portrait atlases | Acting/identity review; subtle moods and frame variations disclosed |

## Loading entry points

- Bible: `art/style-covenant.json`; camera: `art/scale-contract-v2.json`.
- Arenas: `art/delivery/a7/manifest.json`.
- Figures: `art/delivery/a3c/figures.json`; see its README for VFX and spell maps.
- UI: `art/ui/kit.json`, [contract](ui/README.md), [delivery notes](ui/DELIVERY.md).
- Camp: `art/delivery/a4c/manifest.json` and [loading notes](delivery/a4c/README.md).
- Portraits: `art/delivery/a2c/manifest.json`, [loading notes](delivery/a2c/README.md),
  [full identity/expression gallery](review/a2c/portraits.html).

Paths inside delivery manifests are repository-root relative except the UI kit,
whose page/font paths follow the unchanged kit-directory-relative contract.
Serve the repository to use the canvas previews. Static owner boards open as
local files. These are art consumers, not the game stream's implementation.

## Budget and providers

Project charged **223/240**, **17 remain**. Session 5 used **64 images**:
A7 3, A3c 17, A5b 1, A4c 13, A2c 30. Provider split: agy 62, Grok 2.
The earlier 159 entries are immutable and all rejected/failed charges remain.
The four external agy probe images are guarded separately from project spend.
Both provider stop latches are clear; no live quota, rate-limit or moderation
incident occurred this session. The real shared-account allowances remain unknown.
The agy guard is 150 images/week, not a claim about the subscription allowance.

## Remaining work

A3c is the main art backlog: stronger painterly continuity, Water ready/cast keys,
valid soldier attacks, consistent additional facings, gait cycles/in-betweens,
full tier/branch spell animation and motion readability. Incorrect source keys
were excluded. Do not consume rejected sheets or infer a complete animation set.

Owner review must judge the new style, character identities, material continuity,
portrait acting and scale. Some expression pairs remain subtle; some closer
portrait busts omit staffs seen in neutral portraits. Quill's collar is partly
hidden. Portrait frame detail can vary between cells. Those are disclosed
candidates, not certified emotion labels or pixel-preserving edits.

Game integration, live Director/camp state, physical gamepad/sofa feel, timing and
runtime performance remain unmeasured. A5b provides state art and motion tokens;
the game stream owns behavior. Camp story copy is authored review text. Backdrops
have one lighting condition per location, not every location times every slot.

Global historical failures `A3 STOP_SNAPSHOT_DRIFT` and
`UNRESOLVED_UI:ui-a3-poses.json` are retained. Current delivery integrity reports
do not erase them. The local grader only rejects or routes to the owner; several
subtle defects were caught by direct review instead. No push was performed.

## Verification

All five current source/board integrity checks pass, with twelve rejected source
attempts retained. Portrait coverage is 112 exact crops, no missing cast/mood keys.
All 112 load and select in the canvas consumer at 1080p/1440p; eight conversation
captures and three gallery viewports pass. Combined board checks pass at both
native resolutions and 390px. There are 59 passing pipeline tests.

A portable rebuild blocked all access to `art/raw`: 266 PNG/JSON delivery files
rebuilt with zero raw access attempts and zero hash changes. Source/reference
hashes, separate provider caps/stops, unchanged first 159 jobs and unchanged early
UI contract pass the [session audit](reports/covenant-session-audit.json).
Known weekly provider charges: agy 66 including four external probes; Grok 134.
The other 27 inherited project charges came from the earlier built-in provider.
See [portable report](reports/covenant-portable-rebuild.json) and per-wave reports.
The final audit corrected the earlier A3c provider split in its design note.
