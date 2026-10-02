# U1 evidence

[Open the gallery](index.html). All 30 distinct views are captured at both
1920x1080 and 2560x1440. Screenshots are measured output of the procedural kit,
not final art approval. [Execution report](../U1-report.md) explains methods,
limits, sub-waves and the art handoff.

| File | Meaning |
|---|---|
| [browser.json](browser.json) | Both two-week routes, native aim, emulated gamepad, save/load, layout/focus checks, frame/CPU samples, 64 capture events |
| [kit-loader.json](kit-loader.json) | Synthetic atlas success/failure integration and fullscreen round trip |
| [replay-save.json](replay-save.json) | Exact deterministic state/save bytes and receipts |
| [census.json](census.json) | 2,000 fights per wave; detailed seeds in `census-wave-1.json` through `census-wave-4.json` |
| [art-ui-contract.md](art-ui-contract.md) | Read-only snapshot of the parallel art UI contract v1 |
| [art-scale-contract-v2.json](art-scale-contract-v2.json) | Read-only snapshot used to align the runtime camera |
| `attempt-01-gamepad-bootstrap.*` | Retained failed harness bootstrap, superseded by the passing final route |

From the repo root in PowerShell; run browser suites sequentially:

```powershell
npm run gate
npm run smoke:u1
npx tsx packages/tools/src/u1-kit-browser.ts
npx tsx packages/tools/src/u1-replay.ts
npm --prefix packages/core run report:w4 -- --evidence U1-evidence --tag census
```

The browser scripts boot production previews on ports 4188/4189, close their
servers afterward, use temporary save folders, and force offline planning.
`smoke:u1` builds first; the atlas probe uses that build. `--quick` on
`u1-browser.ts` runs 1080p only and is not the final two-resolution evidence.
