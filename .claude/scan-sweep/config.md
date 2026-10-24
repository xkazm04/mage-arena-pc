# scan-sweep overlay - mage-arena (PC channel)

| Key | Value |
| --- | --- |
| `contextMap` | `context-map.json` (generated 2026-10-25 from `git ls-files` by first-match rules; 15 contexts, 5 groups) |
| `memoryOutbox` | `.personas/memory-outbox.jsonl` |
| `openBacklogs` | `.claude/scan-history/open-backlogs.jsonl` |
| `handoff` | `on` |
| `challenge.cohort` | 6 (one per group, so at most 5 here) |
| `challenge.waveSize` | 4 |
| `challenge.worktrees` | `false` - the gates need the root `node_modules` (npm workspaces); builders share the checkout |

## Gates

Asserted by exit code, each in its own invocation, `&&`-chained into the commit.

- **Full gate (integration, and every builder before its last commit):** `npm run gate`
  = `build` (core data compile + `tsc` root + `tsconfig.arena.json` + `tsconfig.purity.json`)
  `&& lint` (`eslint packages --max-warnings 0`) `&& test` (vitest over `packages/**/*.test.ts`
  + `node --test` over `packages/tools/replay`, `packages/core/scripts`, `packages/tools/vr`)
  `&& check:design`. Baseline 2026-10-25 at `9871d87`: 78 vitest files / 649 tests, 31 node tests,
  0 contradictions, exit 0.
- **Game bundle:** `npm run build:game` for any change under `packages/game/`.
- **Art pipeline (Python):** `cd tools/art && python -m unittest <test_module>` - synthetic images, zero
  remote calls. Never run a script that reaches a provider.
- **Audio pipeline:** `node --test tools/audio/*.test.mjs`. Never run `run-*.mjs` / `elevenlabs.mjs` live
  (paid API).

## Never touch / never run

- Slow or network gates stay with the coordinator: `smoke:*` (Playwright), `soak`, any provider or
  ElevenLabs call, any paid Director call (`CAMP_DIRECTOR` must stay `offline`).
- `docs/history-rewrite-2026-10-07.tsv`, `art/budget.json` spend ledgers, archive manifests.

## Challenge mode

Repo law a builder will trip:

- **Determinism is the canon.** `packages/core` is an IO-free deterministic simulator
  (`tsconfig.purity.json`, `determinism-wall.test.ts`). Replay golden hashes
  (`arena/replay-golden.test.ts`) and the VR parity vectors (`arena/parity/cr-*.json`,
  `packages/tools/vr/vectors/`) are a contract with the VR repository: a change that re-pins a
  hash or a vector is a cross-repo contract and is never built under `--challenge`.
- **Balance numbers are owner calls.** Tuning values, AI ladder rows and rival plans
  (`tiger/backlog.md` "owner decisions") are `direction`; never change them to make a test pass.
- **No Fire TV work** (D40, 2026-10-23). Owner doctrine: no class triangles.
- Generated: `packages/core/src/arena/data.generated.ts` (gitignored) is compiled by
  `npm --prefix packages/core run data` from `docs/design/reconciled/data/` and
  `art/scale-contract-v3.json`; edit the sources, never the generated file.
  `packages/core/src/arena/data/*.json` are hand-edited sources.

## Skill improvement log

