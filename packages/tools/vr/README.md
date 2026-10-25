# VR dual-development tools

Node scripts for keeping this PC repo and the VR channel (`mage-arena-vr`, read-only from here) in step. Node
built-ins only; git through `child_process.execFileSync`. The kernel-reading tools load
`packages/core/src/arena` through Node's type stripping, so run `npm run build` once first (it writes
`data.generated.ts`). The VR checkout defaults to `C:/Users/kazda/kiro/mage-arena-vr`.

| Command | What it does |
| --- | --- |
| `npm run vr:drift [-- --vr <path>] [--json] [--vectors]` | Reads VR's `apps/vr/data/PINNED.json` and lists this repo's commits from the pinned commit to HEAD that touch `packages/core/src/arena`, `packages/core/scripts` or `docs/design/reconciled/data`, plus each pinned file whose bytes at HEAD differ from the pin (sha256). `--vectors` replays VR's conformance vectors (`apps/vr/data/conformance/*.json`) against the PC kernel and prints pass or the first diff per vector (the raw report, the default). `--triage` replays them again with the PC-only event kinds in `divergences.json` masked and prints the raw and masked pass counts side by side, then the failures grouped by driver and field: groups matching a `divergences.json` cause (with its CR) as explained, the rest as unexplained. `--fail-on-unexplained` (implies `--triage`) exits 1 while any group is unexplained. Exit 0 when the report ran. |
| `npm run vr:tuning-return [-- --evidence <wave json>] [--out <file>]` | Writes a markdown addendum for a CR: every key of `packages/core/src/arena/data/school-balance.pc.json` as `<key>: VR <canonical> -> PC <value>`, the canonical value read from `docs/design/reconciled/data/arena/spells-*.csv` or `schools-combat.json`, and an optional census summary (a `docs/waves/*-evidence/*-wave-N.json` file). An empty overlay prints "no deviations". `--overlay`/`--canon` point at other files (tests use a temp copy). |
| `npm run vr:vectors [-- <file or dir> ...] [--json]` | Replays reverse vectors (format: [VECTORS.md](VECTORS.md)) against the PC kernel and reports the first checkpoint mismatch. No paths: `vectors/`. Exit 1 if any vector fails. `node packages/tools/vr/vectors.mjs --record <skeleton> --out <file>` fills a skeleton's checkpoints from the PC kernel. |

Files:

- `conformance.mjs`: a JavaScript port of VR's conformance replay (`Tests/KernelConformanceTests.cpp`), with the
  oracle's snapshot export and tolerance copied from `apps/vr/tools/conformance/oracle.mjs`. No VR code is
  imported at run time. One adapter: PC replaced the actor's boolean `down` with the `DEFEATED` tag, and the replay
  reads either form.
- `harness.mjs`: what both replayers share: `createBout` (a Games bout through createGames options only; difficulty
  `null` is unpaced, as VR and the pinned kernel run, so VR's games conformance vectors replay unpaced too), `compare`
  with a field policy per format (`POLICY.conformance`, `POLICY.reverse`), the one first-difference record
  `{tick, when, path, expected, actual, detail}` and `renderDiff`, its one-line form. A new vector format adapts onto these.
- `drift.mjs`, `tuning-return.mjs`, `vectors.mjs`: the three commands.
- `triage.mjs`, `divergences.json`: the `vr:drift --triage` view. `mask` lists event kinds PC emits and VR's pinned
  kernel never records (each replay refuses a mask that hides a kind its vector carries); `causes` are verified
  PC-vs-VR differences, `{id, cr, note, match: {driver?, field, tick?}}` with the field index-normalised (`actors[].x`).
- `vectors/water-hand.vector.json`: the hand-authored Water reverse vector (inputs and checkpoint ticks by hand,
  values recorded from the PC kernel).
- `*.test.mjs`: `node --test`, run by `npm run test`. The tests that read the real VR checkout skip when it is absent.

The CR inbox these tools feed is [docs/change-requests/](../../../docs/change-requests/README.md).
