# m9 bundle split (partial)

Source: `npm run build:game` output, before and after.

| | main chunk | pixi chunk | warning |
|---|---|---|---|
| before | index 807.34 kB (265.05 kB gzip) | none | yes |
| after (pixi.js in its own chunk) | index 514.26 kB (179.87 kB gzip) | 619.77 kB (179.04 kB gzip) | yes, for the pixi chunk |

- Main chunk reduced 807.34 -> 514.26 kB (-36%). The 500 kB warning remains: pixi.js alone minifies to 619.77 kB.
- `npm run gate` green. `npm run smoke:preload` exit 0, menu first paint 1256 ms and 1282 ms on two runs (baseline 1.8 s); no pin file changed.
- Not done: lazy `import()` of the Lab and slice. They are entered from `arena-entry.ts` (`LabUI`, `createLabSetup`, `SliceScene`, `SliceFixture`, `pickSliceOptions`), not from `main.ts`/`game-shell.ts`, and that file is outside this task's declared paths. They weigh about 100 kB of source (roughly 40 kB minified), so lazy loading alone would take the main chunk to about 475 kB but not remove the pixi warning. Because no lazy chunk exists, there is no (d) proof line.
