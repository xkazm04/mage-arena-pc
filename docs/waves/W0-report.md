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

Fable review: **pending orchestrator dispatch**. Owner feel: **not measured**.
Next: W1 strict TypeScript core and Director harness; W0 fixture bytes become its
regression oracle.
