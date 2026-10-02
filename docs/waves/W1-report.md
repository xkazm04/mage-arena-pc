# W1 Director harness report

Status: stopped after wall-clock window; W1 gate incomplete. Local kill threshold result: not exceeded in recorded samples.

An unexpected execution interruption exceeded seven hours during a requested short wait. The final saved local night includes a timeout and that elapsed interval; the raw latency data is retained. The runner was stopped after resumption because the requested wall-clock window had passed. One additional in-flight local reservation has no saved response and remains charged. The judge made no calls. Remaining: finish the local sample and run the character diagnostic. See `W1-evidence/interruption.json` and the session log.

All model runs are **measured** on this host. State outcomes are **simulated**. Balancing data is **authored**; owner feel is **not measured**.

| Run | Nights | Calls | Rejected items | Rejection rate | Line repairs | Call p50 / p95 (ms) |
|---|---:|---:|---:|---:|---:|---:|
| local-pilot-a | 3 | 15 | 2/45 | 4.44% | 6 | 4955.32 / 7808.56 |
| local-soak | 155 | 775 | 110/2325 | 4.73% | 454 | 5075.25 / 9240.46 |
| sonnet | 30 | 150 | 0/450 | 0.00% | 89 | 5760.80 / 8483.08 |

Rejection includes malformed/illegal decisions, unavailable transport and camp cap drops. Line-only repairs preserve legal acts and are reported separately. The owner should evaluate how often the authored bank replaces model voice; low intent rejection alone does not establish character quality.

Local calls run serially to avoid GPU queue contention. Sonnet groups run concurrently. Night latency is separately recorded in `W1-evidence/summary.json`; per-call latency must not be confused with the duration of a whole night.

The player remains idle in this headless experiment. After each season ends, the runner starts a new independent season with the next seed. Arena results and Parley events are not injected. These are Director night samples, not a full-game balance or player-choice study.

| Run | Accepted intent distribution |
|---|---|
| local-pilot-a | TRAIN: 17, WATCH: 8, PROTECT: 3, RECRUIT: 2, BEFRIEND: 5, CONFIDE: 3, WORK: 2, OFFER: 3, SCHEME: 1, REST: 1 |
| local-soak | TRAIN: 805, BEFRIEND: 266, WATCH: 304, CONFIDE: 143, WORK: 276, OFFER: 154, PROTECT: 123, RECRUIT: 95, SCHEME: 37, REST: 81, REPORT: 9, PLOT: 32 |
| sonnet | TRAIN: 181, WATCH: 144, RECRUIT: 30, BEFRIEND: 64, REST: 2, WORK: 10, PROTECT: 19 |

## Validation

The hostile fuzz census generated 500 cases (500 unique malformed outputs): no invalid item escaped, no fallback was illegal, and no valid sibling was lost. Details: W1-evidence/fuzz.json.

Commands: `npm run gate`; `npm run report`. The report command revalidates every recorded raw group output and replays each night from the previous state, verifying complete request keys and final state hashes. The W0 fixture oracle remains unchanged.

`npx tsx packages/tools/src/cache-replay.ts` restores each forced-live night's pinned response snapshot and repeats it with a zero-call budget. Normal cache records are immutable after the first valid write; independent forced-live samples do not share an immutable timeline. `W1-evidence/seeded-draws.jsonl.gz` records deterministic replays of all planner and contest draws, including samples collected before runtime planner-draw logging was added.

## Provider invocation and cost

CLI flags were verified with `claude --help` and version captured before any call. `--bare` disables subscription OAuth on this installation; the provider uses `--safe-mode`, empty tools/settings/MCP, a supplied system prompt, no session persistence and a hard timeout. Full exact argv and measured durations are stored with every call in the Sonnet evidence. Model usage reports confirm the actual model identity.

`npm run soak -- --provider claude --run sonnet --nights 30` resumes the same durable run budget, including the first-night probe. It cannot reset the subscription cap by changing the output run name. Failed calls also consume reservations. The local pilot and soak have separate run caps and a shared UTC-day ledger.

- local-pilot-a: 36287 reported input tokens, 4491 output tokens; 0 transport failures. CLI reference cost: not reported.
- local-soak: 2267071 reported input tokens, 270529 output tokens; 1 transport failures. CLI reference cost: not reported.
- sonnet: 1248026 reported input tokens, 73436 output tokens; 0 transport failures. CLI reference cost: USD 3.7935.

CLI-reported cost is a provider reference/API-equivalent figure, **not an invoice or measured subscription debit**. Marginal subscription dollars and local electricity cost are not measured. Ollama has no hosted token charge. No placeholder API pricing is presented as actual spend.

## Character diagnostic and owner read

Local judge diagnostic: pending. No character-quality claim yet.

| Run / judge | Items | Goal no | Values no | Voice no | Knowledge no | Continuity no |
|---|---:|---:|---:|---:|---:|---:|

The local judge is a model diagnostic, not an independent human certification. It answers goal, values, voice, knowledge and continuity questions against supplied personal context. The same local model judging itself is a limitation. Blind morning material and source mapping are generated separately; no source labels appear on the owner page.

## Boundaries

The harness exercises a season of guarded main acts, shelter and bond progression. Full Parley, arena result bridges, detailed quest/duality/fodder arcs and death gameplay remain the waves listed in the reconciled defect register. Knowledge citation checks cannot prove absence of implicit cross-member inference in a shared group call. Quantitative projection buckets may legitimately share a cache key; cached output is always revalidated against the current numeric state.

Text checks are lexical guardrails, not proof of narrative truth. The fuzz claim concerns the enforced schema and domain rules. Model prompts, voice quality, implied knowledge and invented natural-language details remain fallible and are assessed diagnostically and by the owner.

The orchestrator supplied Fable's W0 review: accepted for handover with six fixes owed. Those residual fixes are recorded in the defect register and session log; they are not silently marked closed. Owner blind reading remains pending. Nothing is labelled felt.
