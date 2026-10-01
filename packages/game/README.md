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
