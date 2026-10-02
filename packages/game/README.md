# Arena stream

Windows, mouse and keyboard, browser first. From the repository root:

```powershell
npm --prefix packages/core ci
npm --prefix packages/core run build
npm --prefix packages/game ci
npm --prefix packages/game run dev
```

Open the local URL printed by Vite. WASD moves, mouse aims, left button casts the selected slot, 1–4 or wheel selects, right button holds the ward, Space rolls, Shift sprints. Click the arena to focus it. A short press is queued until the next fixed simulation tick; losing focus clears held input. Restart resets training, Pause freezes the simulation.

Validation:

```powershell
npm --prefix packages/core test
npm --prefix packages/core run report:w2
npm --prefix packages/game run build
cd packages/game
npx playwright install chromium
npm run smoke
```

The smoke harness serves the **production build** on loopback port 4175, launches headless Chromium, drives real keyboard/mouse input and closes both processes. Screenshots and measured performance live in `docs/waves/W2-evidence/`. The browser uses D3D11 for Windows performance evidence; other platforms may need a different backend and must identify it in their results.

Integration: this branch deliberately creates no root package/workspace config. Each package has its own manifest and lockfile. Core's arena-only compiler is `tsconfig.arena.json`; source exports are `@mage-arena/core/arena`. `src/arena/data.generated.ts` is ignored and rebuilt from baseline data by `npm --prefix packages/core run data`. The core stream can merge the manifests and retain that prebuild step when it creates the shared workspace. No director implementation or dependencies here.

Water practice: **Compose** opens the three-line preparation screen. Presets and custom branches reset the bout on entry; the screen pauses combat. `npm --prefix packages/core run report:w3` generates catalog/curve evidence; `npm --prefix packages/game run smoke:w3` verifies the preparation flow and in-place tier upgrade against the built app.

Tiro: **Tiro Games** opens preparation, then starts the four data-defined bouts. Composition is locked for that Games. Use **Next bout** to recover and advance; losing ends the Games with missio. **Training** also includes all eight roster enemies. Mage opponents are visibly labelled Water proxies until W8 supplies their other schools.

W4 validation, from the repository root:

```powershell
npm --prefix packages/core run build
npm --prefix packages/core test
npm --prefix packages/core run report:w3
npm --prefix packages/core run report:w4
npm --prefix packages/core run report:w4:ladder
npm --prefix packages/game run build
npm --prefix packages/game run smoke:w3
npm --prefix packages/game run smoke:w4
npm --prefix packages/game run smoke -- W4-evidence/performance
```

The census runs 2,000 independent fresh starts per Tiro wave and checks completed-bout medians against the data bands; it keeps losing seeds and reports tails. The ladder adds 500 duels per competence row and selects a disclosed full-Games completion fixture. Run it before `smoke:w4`, which reads that fixture. These are simulated controllers, not human skill or feel measurements. Browser scripts use separate loopback preview ports (4175–4177), but run them sequentially for uncontended performance evidence. Harness mutation controls exist only with `?harness=1`; normal play uses real D4 input.

W7 boundary: import `createGames`, `stepGames`, `advanceGames` and `gamesResult` from `@mage-arena/core/arena`. Call `stepGames` once per fixed tick with the player's `InputFrame`; explicit `advanceGames` is valid only at intermission. Terminal `gamesResult` returns one highest-wave payout, qualification flags and missio/champion outcome. Camp must apply it once using its own persisted Games identity; this arena stream does not credit a wallet, save state or grant mastery. Serializable state contains the RNG and AI observations. `stateHash` covers arena state; save the encompassing Games lifecycle as well when W7 implements persistence.

The W4 calibration modifies the authoritative baseline `spells-water.csv` and `enemies.json` directly; there is no runtime damage multiplier. Keep these changes when merging or moving the baseline into reconciled data, update `compile-arena-data.mjs` to that single location, and rerun all arena gates. Do not leave two editable spell/enemy tables. Runtime supplements own only missing geometry, policy and presentation values. Historical W2/W3 measurements remain in their commits; W3 curves and screenshots were regenerated for W4's final data. No director or camp package is owned by this stream.

## W4b camera and W4c aiming

The canvas fills the browser viewport, with an overlaid HUD. The camera follows the player at **55° elevation**, starts at **near zoom 1.2**, and can pull back to **0.8** using **View**. The wheel still changes spell slots. At a 1920×1080 viewport the mage is 64.8 px head-to-sole at near, 43.2 px at far; at 2560×1440 those heights are 86.4 and 57.6 px. Browser viewport pixels define the scale, so browser zoom changes the effective viewport. Screenshots use device scale 1.

**Scale overlay** (or `?debug=1`) shows the imported contract, measured viewport, projected metres per pixel, figure ruler, 6 m ground rulers, warning/projectile minimums, aim point and loader diagnostics. Ordinary play keeps it off. Circles on the ground are foreshortened; bodies remain upright and are sorted by their interpolated feet. Original procedural figures remain until A3 is accepted. Distant enemy arrows indicate opponents beyond the view or behind the HUD.

Aim at the **foot ring/ground**, not the head of a billboard. The pointer is inverted through the displayed camera, including CSS bounds and viewport resize. It remaps when the camera moves even if the mouse stays still. There is no body-snapping assist. Hits, ranges, rolls and the 140° ward remain in ground metres/degrees. The 2.4 m ward radius is visual, not a larger collision shield. Solid warning outlines give actual hit geometry; outer radial ticks locate small warnings at a minimum 4 m diameter, without expanding damage. Projectile cores have a screen-space readability floor independent of their collision radii.

The playable oval is **192×144 m**, not a rectangle painted to look oval. Its centre at (16, 62) keeps opening bouts near the northern perimeter in existing local coordinates. Shared ellipse constraints handle walk/roll, pushes/pulls, charges and AI edge avoidance. The inset conservatively contains each actor's collision disk. Opening formations use at least 6 m centre spacing, including deterministic jitter; melee can subsequently close that distance. The arena is several camera widths across. The approved proof supplies the quiet open floor and curved border, not a literal screenshot-sized enclosure.

Current validation, from the repository root (run browser commands sequentially):

```powershell
npm --prefix packages/core run build
npm --prefix packages/core test
npm --prefix packages/game test
npm --prefix packages/game run build
npm --prefix packages/game run smoke:w4b
npm --prefix packages/game run smoke -- W4b-evidence/controls
npm --prefix packages/game run smoke:w3 -- W4b-evidence/water
npm --prefix packages/core run report:w4:ladder -- W4b-evidence
npm --prefix packages/game run smoke:w4 -- W4b-evidence/games
npm --prefix packages/core run report:w4 -- --evidence W4b-evidence --tag oval-census
```

The last command currently **exits 1 for pacing**, not simulation invalidity: the new layout produces soldier/creature medians 44.38/45.55 s versus targets 25–40/30–45 s. Both mage medians remain in band. See [W4b note](../../docs/waves/W4b-camera-scale.md) and [evidence](../../docs/waves/W4b-evidence/index.html). Do not reuse the old compact-court W4 pacing pass as a claim about this arena. No damage, HP, resources, opponent competence or target bands were retuned for W4b. The Tiro lifecycle and selected full-Games completion still pass; pacing needs a separate follow-up before G1.

## A3 sprite handoff

`public/arena-sprites.json` ships with an empty `frames` map, so no unaccepted artwork is silently enabled. To integrate accepted A3 files, put them below `public/` and populate this manifest. A development override is `?sprites=/path/to/manifest.json`. URLs resolve relative to the manifest URL. The renderer validates the manifest, loads each image once, verifies intrinsic dimensions and falls back independently for missing frames. A broken manifest leaves all procedural figures playable; diagnostics are visible in Scale overlay. Asset loading never mutates simulation or hit geometry.

```json
{
  "version": 1,
  "frames": {
    "mage.player": {
      "url": "figures/cassia.png",
      "width": 256, "height": 256,
      "headY": 24, "soleY": 224, "footX": 128
    }
  }
}
```

`headY`/`soleY` are source-pixel head-to-sole bounds, excluding weapons, shadows and transparent padding; `footX` is the source-pixel horizontal ground anchor. `0 <= headY < soleY <= height` and `0 <= footX <= width`. The renderer scales that body span to the contract and anchors the sole on the projected ground; it never scales a padded texture to the body height. Keys are `mage.player`, `mage.enemy`, `dummy`, or a roster ID (`conscript`, `shieldman`, `slinger`, `netter`, `cinder_hound`, `mire_maw`, `thornback`, `hush_moth`). Optional `.e/.se/.s/.sw/.w/.nw/.n/.ne` suffixes select directional frames; an unsuffixed frame is the fallback. Bodies are never rotated flat with aim. Animated pose/atlas conventions can be added behind `FigureLibrary` when A3 supplies its actual delivery; this boundary currently accepts static directional images.

Integration change: `combat.arena.widthM/heightM` and fixed presentation pixels-per-metre are removed. Import `arenaGeometry`, `arenaContains`, `constrainToArena` and `openingPosition` from the arena export. The data compiler imports the art scale contract and checks its absorb angle against combat; do not restore a second editable dimension table. Camp/director code remains untouched. Existing W4 save hashes and completion fixtures belong to their original geometry; regenerate arena fixtures after merging this pass.
