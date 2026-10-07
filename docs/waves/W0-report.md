# W0 gate report

Measured on this Windows host, Node v24.14.0. Commands run from repository root:

| Command | Result |
|---|---|
| `node packages/tools/replay/cli.mjs generate` | Generated the season fixtures and table-backed README |
| `node packages/tools/replay/cli.mjs check` | Zero contradictions; three nights; 237 traced changes |
| `node --test packages/tools/replay/*.test.mjs` | Seven tests passed, including three independent planted contradictions |
| `node packages/tools/replay/cli.mjs build` | Reference tool syntax build passed |

The fixtures are **simulated**, not live model output. All numeric balancing data
remains **authored**. A reconstruction test starts from each initial state, applies
only the recorded trace and obtains exactly the final state. Content assertions
pin fed hunger, floored aggression-gap gain, repeat-target rejection, forbidden
poison, cap priority, every rival pair's decay and calendar placement.

The consistency checker covers the reconciled package's generated contract,
foreign keys, vocabularies, phrases, delta references and exact fixture replay.
It deliberately does not claim to understand arbitrary historical prose.
The defect register records deferred arc/arena integrations rather than inventing
outcomes for systems that do not exist yet.

Fable review: accepted with six fixes owed; the second-session fixes below close
those findings. Owner feel: **not measured**.

## Second-session review closure — 2026-10-02

`npm run gate`: strict build, lint, 18 Director tests and ten replayer tests pass.
`node packages/tools/replay/cli.mjs build`: syntax check passes.
`node packages/tools/replay/cli.mjs generate` regenerates three golden nights
(216 traced changes under the corrected authored balance), five branch nights,
the decision schema and README. `check` reports zero contradictions within its
explicit template, reference, schema and fixture scope. It cannot prove the
meaning of prose edited identically in the template and README.

All review items have dispositions in `W0-review-fixes.md`: structured goal
plans, placed intents, calendar-only Trial, generated schema, attempt wording,
scheme window; rumour/protection corrections; school exceptions keyed to the
two officials; all-verb and branch fixtures; committed replayer adapter; explicit
PLOT-versus-death-Plot distinction. The tests assert all these content boundaries.

The old 155 local nights and 30 subscription nights remain unchanged. Their
pre-fix tables are pinned in `W1-evidence/experiment-tables.json` for controlled
completion of W1. W1 live measurements therefore assess that original authored
ruleset; current balance has deterministic regression coverage, not a fresh
300-night model claim. W11 still owns empirical balance.
