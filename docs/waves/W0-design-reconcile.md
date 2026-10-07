# W0 — reconciled season contract

Design note written before implementation, 2026-10-01. Scope: documentation,
authoritative camp tables, and a headless reference replayer; no game or art.

The project plan supersedes the archived contest packages. Preserve those archives
for review; `docs/design/reconciled/data` owns the active camp rules. Arena data
belongs to the arena stream and is not duplicated here. All balancing quantities
are authored until an evidence report labels them simulated or measured.

Decisions:

- Calendar advances through a season. There is no reset, Echo stat, or remembered
  alternate timeline. The Fourth Watch meets at the Edge; Quill studies the Cistern.
- A night selects and resolves that calendar day's main acts as an atomic headless
  transaction. The UI can stage tomorrow's acts later; the request explicitly names
  the resolution day. Repeat-target checks always compare consecutive resolution days.
- Social gain is symmetric, gains the cross-tent peer multiplier, then halves for
  the aggression gap and floors. Only the effects table owns these quantities.
- Protected Strays receive the feeding reduction and skip nightly hunger growth.
  Working unprotected Strays use the working increment. Every eligible same-tent
  directed relationship decays, not just the pair mentioned by prose.
- `PLOT` means nonlethal bond planning. Death `Plot` records and `Executed` life
  state are reserved, disabled, and cannot be produced by any current intent.
- Numeric claims in active prose are generated from explicit table references.
  The checker checks those references, vocabularies, foreign keys, and exact
  replay of stored fixtures. It is not a natural-language theorem prover.
- Golden scenarios author choices and starting conditions only. Outcomes, dice,
  effects, facts and boards are generated. Never edit an expected delta by hand.
- Death gameplay, arena outcomes, Parley and complete quest arcs remain the later
  waves assigned in the plan. The defect register distinguishes these reservations
  from implemented night rules.

Commands planned: `node packages/tools/replay/cli.mjs generate`,
`node packages/tools/replay/cli.mjs check`, `node --test packages/tools/replay/*.test.mjs`,
and `node packages/tools/replay/cli.mjs build`. Mutation tests must demonstrate
that planted prose, table and fixture contradictions fail.

Fable review is dispatched by the orchestrator after this wave; no executing-agent
substitute verdict is claimed. Owner feel is not measured.
