# Mage Arena — core stream

Start with [the project plan](docs/MAGE-ARENA-PLAN.md). Active camp quantities live
in [the reconciled data](docs/design/reconciled/data); the contest designs are
historical references. The core is pure TypeScript, and the Director owns external
processes, validation, caching and budgets.

## Core law: a replayable transition function

`packages/core/src` is what saves, replays and the VR pin depend on, so the same seed and
inputs must give the same state on every machine. Inputs and the seed arrive as values;
time is the tick (`FixedStepper`); every random value comes from the seeded RNG in
`packages/core/src/arena/kernel.ts` (`random(state, purpose)`), which logs each draw for
replay. Never reach for `Math.random`, `Date`, timers, `process`, `crypto`, `Intl`, the DOM,
Node modules, dynamic `import()` or the game, tools and Director packages. Pass what
you need in, and let the game or the Director act on what the core returns.

Three gates hold this, each proven to fire: the core block in `eslint.config.mjs` with its
canaries in `packages/core/src/determinism-wall.test.ts`, the pinned replay hashes in
`packages/core/src/arena/replay-golden.test.ts`, and the `types: []` compile in
`packages/core/tsconfig.purity.json`. When you add a restriction, add its canary; when an
intended combat or data change rehashes the replay pin, re-pin it in the same commit.

## Data law: canon is authored once and checked where it is read

`docs/design/reconciled/data` is the canon that core, the Director and the VR pin read. A value
lives in one file; code-side data (`packages/core/src/arena/data/*.json`) authors only what
canon lacks and names canon by id rather than copying it (training attacks name an enemy
attack). Every authored value meets the validator that guards the same value from a player
or a model (`packages/core/src/authored-data.test.ts`), and a JSON value narrowed into a type
goes through `member()` in `packages/core/src/arena/doors.ts`, never a cast. Every
cross-file reference is checked by `npm run check:design` (`packages/tools/replay/check.mjs`,
whose list of checked files covers what core imports directly). Prose that the arena compiler
parses (`packages/core/scripts/arena-data.mjs`) must match whole sentences or stop the build.

Derived files are checked through the same function that writes them and never silently
rewritten: the reconciled README, schema and fixtures fail `check:design` on drift and on an
orphan in `fixtures/`; `data.generated.ts` is gitignored and rebuilt by every build. Saves
refuse rather than migrate (`packages/director/src/save.ts`: version, source hash, checksum,
strict schema, full replay); Lab tuning exports migrate by version with tests. Adding a canon
file or reference means adding its check and a planted fault in `replay.test.mjs`.

Requires Node 24 or newer and npm. From the repository root:

```powershell
npm ci
npm run gate
npm run report
```

The gate runs strict compilation, ESLint, Vitest, the original reference tests and
the design consistency checker. Run `npm run hooks:install` once per clone so every push
runs it first (the Git LFS hook still runs after). The report revalidates stored model responses and
replays their state transitions. Neither command makes model calls.

Offline development:

```powershell
npm run soak -- --provider planner --run offline --nights 42
```

Recorded wave evidence and exact commands are in
[the W1 report](docs/waves/W1-report.md). Live runs consume the durable budget in
`.director-runtime/cost-ledger.json`; failed calls count. Do not delete that ledger
to retry a failed experiment. The Sonnet experiment uses a fixed run identity
regardless of command-line output name. Its completed subscription allocation is
not permission to start another experiment.

The [blind morning read](docs/waves/W1-evidence/OWNER-READ.html) hides sources; keep
its adjacent source map away from the reader until the owner records a preference.

Play the camp with `npm run camp` at `http://127.0.0.1:5173`. It uses offline
planning by default; `$env:CAMP_DIRECTOR='local'` selects the capped local
Director before launch. Refresh reconnects to the in-memory camp. Production
client build: `npm run build:game`. Browser gate while the server runs:
`npx tsx packages/tools/src/camp-browser.ts`. Screens, limitations and the measured
night-latency sample are in [the W5 report](docs/waves/W5-report.md).

Parley opens at held Knowing moments with a present character. The three authored
cards work offline; local mode interprets optional typed dialogue through the
Director and core checks. See [W6 evidence and limits](docs/waves/W6-report.md).
W7 owns durable saves and arena/camp integration, W10 death gameplay and W11
deeper arcs. Arena bouts and endings are not yet connected to this camp.
