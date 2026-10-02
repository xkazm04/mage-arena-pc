# Mage Arena — core stream

Start with [the project plan](docs/MAGE-ARENA-PLAN.md). Active camp quantities live
in [the reconciled data](docs/design/reconciled/data); the contest designs are
historical references. The core is pure TypeScript, and the Director owns external
processes, validation, caching and budgets.

Requires Node 24 or newer and npm. From the repository root:

```powershell
npm ci
npm run gate
npm run report
```

The gate runs strict compilation, ESLint, Vitest, the original reference tests and
the design consistency checker. The report revalidates stored model responses and
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

W6 owns Parley, W7 durable saves and arena/camp integration, W10 death gameplay
and W11 deeper arcs. Arena bouts and endings are not yet connected to this camp.
