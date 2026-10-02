# W4b — approved oblique camera and scale

Design recorded before implementation, 2026-10-02. ARENA branch only; no director or camp changes. Sources read: the complete project plan (including j and the final angle note), CAMERA-OK, scale-contract-v1, A1b board/manifest and chosen full-size source, W2–W4 notes and game README.

## Authority and decisions

- Import `art/scale-contract-v1.json` as the sole camera/size authority. Near = 1.2, elevation = 55°, ground X = 36 px/m at 1080p, ground Y = X × sin(55°), upright mage head-to-sole = 64.8 px. Resolution means the browser viewport, with a full-viewport canvas and overlaid HUD. Figures are not foreshortened or rotated flat with the floor.
- Read the approved image `art/review/sources/01-tessera-open-oval-sparse-near-a01.jpg`: broad pale floor, a curved terracotta perimeter and narrow blue/ochre edge bands, sparse figures. Implement those geometric cues procedurally. The image's approximate 4.7% body measurement, duplicate blue figure and rearward absorb are documented defects, not authorities over the confirmed 6% target or 140° forward mechanic. Do not fit the whole oval on screen.
- The arena is a playable 192 × 144 m ellipse. Keep existing bout-local coordinates and place the ellipse centre at (16, 62), putting opening encounters near its north edge; this authored placement is supplemental layout data, not another arena-size authority. Movement, pushes, pulls and charges use a common ellipse boundary. Sparse opening spacing follows the contract; close combat may naturally violate spawn separation. Existing W4 pacing measurements belong to the earlier compact court and must not be claimed for this layout.
- Camera follows the player, with stable upright billboards sorted by interpolated foot depth and actor ID. Ground markings project metre geometry; damage shapes remain exact, while a distinct dotted locator may supply a larger minimum warning footprint without enlarging hit tests. Projectile core/outline minimums are screen-space readability floors, not collision radii. Arc radius is visual only.
- Cursor coordinates invert the camera that displayed the frame, including CSS bounds/resizing. A stationary cursor remaps when the follow camera moves. No billboard aim snapping: aim at feet/ground marker. W4c tests should prove ground hits are independent of resolution, elevation and zoom.
- A versioned optional sprite manifest defines image URL, normalized foot anchor and source head-to-sole bounds. Load once, validate, retain procedural fallback on missing/invalid files, and keep billboard height independent of transparent padding. No A3 production artwork is assumed.

## Gate plan

Core build/tests; game build and pure projection/contract/input/loader tests; production Playwright at 1920×1080 and 2560×1440 (near and far, debug overlay, live combat/ground warnings, occlusion); 100 visible moving projectiles with measured frame rate and CPU p95 at both resolutions. Retain screenshots and machine-readable results in `W4b-evidence/`. Exercise prior composition/Tiro controls with projected mouse coordinates. Record measured results, remaining limitations, owner checks, status/session log and one green commit; never push.

Owner alone judges camera distance, motion readability, and oblique aiming/absorb feel. Physical input latency remains not measured.

## Implementation and measured gate

`camera.ts` imports the contract and owns pure forward/inverse transforms. It clamps zoom to the contract and rejects elevations outside 45–60°, including 90°. `arena-scene.ts` draws the procedural open floor, ground-space effects and individually foot-anchored billboards. `FigureLibrary` loads a versioned optional manifest once, validates source dimensions/body bounds and falls back per missing image. Directional images can be dropped in without changing physics. Full A3 animation/atlas conventions await its delivery; no production art acceptance is implied.

Core `geometry.ts` is the shared oval boundary for movement, roll, charge, knockback/pull and AI edge avoidance. The inset is homothetic and conservative: the entire collision disk stays inside the oval even on diagonals. Tiro and roster openings use a sparse rectangular formation with `ceil(sqrt(count))` rows, spacing = contract separation + twice maximum jitter, guaranteeing >=6 m spacing in the current roster. All Tiro opening feet are inside the near viewport's unobscured play region in tested seeds. Close combat may close gaps normally. Flanker practice now mirrors its origin around the player's authored start instead of the removed rectangular wall.

The performance field covers an authored 40×20 m patch with 100 moving zero-damage projectiles. Replenishment occurs after expiration/collision as well as before the tick. An initial stricter browser assertion caught occasional 99-projectile frames; a core regression now checks every completed tick and the final browser report checks all 360 samples, not just the final snapshot. Performance excludes concurrent census/other browser runs. Exact final figures are in [browser.json](W4b-evidence/browser.json), with the CPU, GPU, browser and timing limitations identified. Both requested resolutions sustain approximately **60 fps**, with CPU p95 comfortably below the **8 ms** budget. This is measured headless scheduling/render submission, not physical display latency.

Passed commands (from root):

```powershell
npm --prefix packages/core run build
npm --prefix packages/core test -- --reporter=json --outputFile=../../docs/waves/W4b-evidence/core-tests.json
npm --prefix packages/game test -- --reporter=json --outputFile=../../docs/waves/W4b-evidence/game-tests.json
npm --prefix packages/game run build
npm --prefix packages/game run smoke:w4b
npm --prefix packages/game run smoke -- W4b-evidence/controls
npm --prefix packages/game run smoke:w3 -- W4b-evidence/water
npm --prefix packages/core run report:w4:ladder -- W4b-evidence
npm --prefix packages/game run smoke:w4 -- W4b-evidence/games
```

51 core tests and 13 game tests pass. The browser checks both resolutions and zoom endpoints, upright overlap, live charge warnings, sprite success/individual failure/invalid-manifest fallback, stationary-cursor camera follow and **32** real pointer hit cases. The matrix is 2 resolutions × 2 zooms × 8 directions; the earlier running commentary's 64-case description was a count error, not extra measurements. A separate [W4c note](W4c-ground-aim.md) records aim/hit semantics. Ordinary controls, composition, roster practice, loss/retry and the complete Tiro lifecycle pass. Seed 30 is the new explicitly selected winning integration fixture (159.05 simulated seconds, no buffs); it is not an unbiased success-rate claim.

## Pacing regression and stop

The large oval and 6 m opening separation supersede W4's small court and 2.2 m rows. This necessarily changes approach time, flanking and how many enemies a spell catches. No old W4 pacing pass is claimed for this geometry.

The first 2,000-fight-per-wave row-layout census is retained as `oval-row-census*.json`. Its first wave median was 46.75 s. That formation placed some opening enemies below the near viewport; it was replaced with a compact sparse grid to keep every initial opponent visible, not to pad or force outcomes. A 200-seed probe is retained as `oval-grid-probe*.json`. The final full grid census is `oval-census*.json`:

| Wave | Target median band | Measured simulated median | Wins / losses / timeouts | Result |
|---|---|---|---|---|
| Soldiers | 25–40 s | 44.3833 s | 2000 / 0 / 0 | FAIL |
| Creatures | 30–45 s | 45.55 s | 2000 / 0 / 0 | FAIL |
| Semifinal | 45–70 s | 45.4833 s | 1831 / 169 / 0 | PASS |
| Final | 45–80 s | 58 s | 1394 / 606 / 0 | PASS |

Reproduce with `npm --prefix packages/core run report:w4 -- --evidence W4b-evidence --tag oval-census`; it returns **exit 1**. Zero early Downs, invalid states and sampled replay mismatches. Raw rows include losing seeds and duration tails. Final repeated runs after moving the performance-only field values into data produced identical fight digests. The competence ladder retains W4's disclosed level-4 overdefence issue; this pass does not claim later-tier balance.

**Stop balance tuning here.** W4b/W4c camera, scale, input and performance gates are green; the broader W4 pacing gate is reopened and G1 stays open. No damage, HP, mana, stamina, competence or target-band changes were made. Proposed follow-up: shorten the initial approach of the two multi-enemy waves by moving their formation anchor toward the player while preserving >=6 m separation, then re-run the unchanged 2,000-seed census and owner trial. If that cannot restore the authored bands, a separate reviewed enemy-health/encounter composition calibration is needed; do not shrink the confirmed arena, drop losing seeds or edit the bands to pass. This proposal is unimplemented and not claimed effective.

## Handoff and remaining owner work

[Evidence gallery](W4b-evidence/index.html), [owner checks](../OWNER-CHECKS.md) and [sprite/integration instructions](../../packages/game/README.md) are the entry points. The comparison/overlap screenshots use paused, zero-damage authored fixtures; live charge, controls, Tiro and performance images are separately labelled. No static screenshot closes motion readability or feel. Aim-at-feet comfort, camera distance and HUD coverage are owner decisions. Physical input latency is not measured. No A3 production textures, animation system, director, camp, school expansion or push was included.
