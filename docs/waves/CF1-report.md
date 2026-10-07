# CF1 — Combat Feel Lab delivered

2026-10-04. [Design first](CF1-combat-feel-lab.md), [owner start guide](../START-HERE.md).
Main menu and pause menu lead to one dummy or one mage. Four explicitly labelled
school practice profiles, competence 1–4, aggression, spacing, seed and composition;
canvas sliders/numeric entry, presets, validated JSON export/paste/drop import;
live metrics and bounded 20-second replay. No global tuning mutations or season
state access. Pausing/stepping replay does not advance the live bout.

The guide is also reproduced at the top of OWNER-CHECKS. It includes exact Windows
PowerShell installation/gate/build/preview commands, URL, controls, ten-minute
comparison and a feel-report template. Earlier checks are labelled historical.

Validation:

- `npm run gate`: 183 TypeScript + 11 reference tests, zero contradictions.
- `npm run build:game`; `npx tsx packages/tools/src/cf1-browser.ts`: native 1080p
  and 1440p, both menu entries, setup/loadout, numeric typing, slider dragging,
  spell override, export/reimport, damage toggle, reset, fixed seed, pause/step,
  real movement/casting and replay returning an unchanged live state. Ten PNGs,
  zero page errors, no HUD button text overflow. Screens inspected.
- Frame p95 16.8/16.7 ms, application CPU p95 1.2/1.1 ms in the short Lab browser
  sample. This is not physical input latency or a long-session memory benchmark.
- `npm --prefix packages/core run report:w4 -- --evidence CF1-evidence --tag census`:
  2,000 fresh fights per wave. All four complete per-fight digests equal U5 exactly.
  Medians 38.483 / 45.083 / 45.483 / 58 s; no band changes.
- `$env:MAGE_EVIDENCE='CF1'; npx tsx packages/tools/src/u3-replay.ts`: exact
  1,300,369-byte source-versioned save round-trip and authoritative replay.
- `npx tsx packages/tools/src/cf-report.ts before`: 400 fixed-seed Lab reference
  fights recorded in CF2-evidence/before.json before changing shipping feel.

Limitations are visible, not hidden: only Water has the full authored catalogue;
other schools are coefficient/art practice profiles. The tuning panel covers the
arena while open; return to combat to judge the change in motion. Metrics use
incoming contacts, excluding misses and i-frame avoidance. Mixed runs are labelled.
Replay is a bounded observation history, not an exported input replay or season save.
The relatively large HUD and incomplete directional body art still need owner
judgment. No physical mouse/keyboard latency, audio quality or human feel claims.

Next: CF2, using this committed Lab and baseline; no art-branch edits or push.
