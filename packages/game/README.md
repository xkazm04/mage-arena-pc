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

The W4 calibration modifies the authoritative baseline `spells-water.csv` and `enemies.json` directly; there is no runtime damage multiplier. Keep these changes when merging or moving the baseline into reconciled data, update `compile-arena-data.mjs` to that single location, and rerun all arena gates. Do not leave two editable spell/enemy tables. Runtime supplements own only missing geometry, policy and presentation values. Historical W2/W3 measurements remain in their commits; W3 curves and screenshots have been regenerated for W4's final data. No root workspace config, director package, tools package or art assets were added by this stream.
