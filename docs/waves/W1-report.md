# W1 Director harness report

Status: requested live night counts completed. Local kill threshold result: not exceeded in recorded samples.

The first session had an interruption exceeding seven hours. Its last saved local night retains that elapsed interval and a timeout; the unsaved in-flight reservation remains charged. W1b resumes the original evidence in detached ten-night chunks. See `W1-evidence/interruption.json` and the supervisor evidence for subsequent wall-clock gaps.

All model runs are **measured** on this host. State outcomes are **simulated**. Balancing data is **authored**; owner feel is **not measured**.

W1b supervisor recorded 0 wall-clock gaps beyond its heartbeat tolerance. Gaps are retained, not attributed to sleep without evidence.

| Run | Nights | Calls | Rejected items | Rejection rate | Line repairs | Call p50 / p95 (ms) |
|---|---:|---:|---:|---:|---:|---:|
| local-pilot-a | 3 | 15 | 2/45 | 4.44% | 6 | 4955.32 / 7808.56 |
| local-soak | 300 | 1500 | 213/4500 | 4.73% | 821 | 5690.39 / 12596.77 |
| sonnet | 30 | 150 | 0/450 | 0.00% | 89 | 5760.80 / 8483.08 |

Rejection includes malformed/illegal decisions, unavailable transport and camp cap drops. Line-only repairs preserve legal acts and are reported separately. The owner should evaluate how often the authored bank replaces model voice; low intent rejection alone does not establish character quality.
Local line repairs: 821/4500 (18.24%). These are not added to the item-rejection kill numerator because the intent remains valid, but they are a material voice-quality limitation.

Local calls run serially to avoid GPU queue contention. Sonnet groups run concurrently. Night latency is separately recorded in `W1-evidence/summary.json`; per-call latency must not be confused with the duration of a whole night.

The player remains idle in this headless experiment. After each season ends, the runner starts a new independent season with the next seed. Arena results and Parley events are not injected. These are Director night samples, not a full-game balance or player-choice study.

| Run | Accepted intent distribution |
|---|---|
| local-pilot-a | TRAIN: 17, WATCH: 8, PROTECT: 3, RECRUIT: 2, BEFRIEND: 5, CONFIDE: 3, WORK: 2, OFFER: 3, SCHEME: 1, REST: 1 |
| local-soak | TRAIN: 1642, BEFRIEND: 510, WATCH: 542, CONFIDE: 279, WORK: 535, OFFER: 299, PROTECT: 234, RECRUIT: 173, SCHEME: 66, REST: 178, REPORT: 10, PLOT: 32 |
| sonnet | TRAIN: 181, WATCH: 144, RECRUIT: 30, BEFRIEND: 64, REST: 2, WORK: 10, PROTECT: 19 |

## Validation

The hostile fuzz census generated 500 cases (500 unique malformed outputs): no invalid item escaped, no fallback was illegal, and no valid sibling was lost. Details: W1-evidence/fuzz.json.

Commands: `npm run gate`; `npm run report`. The report revalidates every raw group output and replays each night, verifying complete request keys and final state hashes. The live experiment uses the pinned pre-review-fix tables in `W1-evidence/experiment-tables.json` throughout all 300 local nights; the original 155 nights are retained. Current authored balance has regenerated W0 fixtures and the 500-case fuzz gate, not a separate 300-night live claim.

`npx tsx packages/tools/src/cache-replay.ts` restores each forced-live night's pinned response snapshot and repeats it with a zero-call budget. Normal cache records are immutable after the first valid write; independent forced-live samples do not share an immutable timeline. `W1-evidence/seeded-draws.jsonl.gz` records deterministic replays of all planner and contest draws, including samples collected before runtime planner-draw logging was added.

## Provider invocation and cost

CLI flags were verified with `claude --help` and version captured before any call. `--bare` disables subscription OAuth on this installation; the provider uses `--safe-mode`, empty tools/settings/MCP, a supplied system prompt, no session persistence and a hard timeout. Full exact argv and measured durations are stored with every call in the Sonnet evidence. Model usage reports confirm the actual model identity.

`npm run soak -- --provider claude --run sonnet --nights 30` resumes the same durable run budget, including the first-night probe. It cannot reset the subscription cap by changing the output run name. Failed calls also consume reservations. The local pilot and soak have separate run caps and a shared UTC-day ledger.

- local-pilot-a: 36287 reported input tokens, 4491 output tokens; 0 transport failures. CLI reference cost: not reported.
- local-soak: 4378318 reported input tokens, 523884 output tokens; 1 transport failures. CLI reference cost: not reported.
- sonnet: 1248026 reported input tokens, 73436 output tokens; 0 transport failures. CLI reference cost: USD 3.7935.

CLI-reported cost is a provider reference/API-equivalent figure, **not an invoice or measured subscription debit**. Marginal subscription dollars and local electricity cost are not measured. Ollama has no hosted token charge. No placeholder API pricing is presented as actual spend.

Charged subscription reservations: 150/150; unrecorded local reservations retained: 1. Local judge token usage and season projections are in W1-evidence/cost-report.json. Judge calls use only the local model.

## Character diagnostic and owner read

Judge coverage complete. Questions below show negative judgments on raw proposals before validation or line repair where available. A missing proposal is judged using its recorded planner item; each request records this distinction in judgedSource.

| Run / judge | Items | Goal no | Values no | Voice no | Knowledge no | Continuity no |
|---|---:|---:|---:|---:|---:|---:|
| local-soak / qwen3.8:27b-64k | 4500 | 4 (0.09%) | 4 (0.09%) | 57 (1.27%) | 1 (0.02%) | 70 (1.56%) |
| sonnet / qwen3.8:27b-64k | 450 | 0 (0.00%) | 0 (0.00%) | 0 (0.00%) | 0 (0.00%) | 0 (0.00%) |

The local judge is a model diagnostic, not an independent human certification. It answers goal, values, voice, knowledge and continuity questions against supplied personal context. The same local model judging itself is a limitation. Blind morning material and source mapping are generated separately; no source labels appear on the owner page.
Traceable negative examples (the first three per question and source, without cherry-picking) are in W1-evidence/judge-examples.json. Each names the original night index, actor and request hash; the full context and verdict remain in the compressed judge evidence.
Observed diagnostic limitation: some reasons describe a knowledge violation while the compact answer marks continuity (for example local sample index 3). The code preserves the actual returned answers; it does not silently relabel them. The calibration below tests gross contradictions versus clean controls, not isolated sensitivity of every answer position. Per-question rates therefore remain fallible model assessments, not ground-truth defect rates.

Judge calibration: passed. The same prompt and output format distinguish planted goal, value, voice, unknown-fact and continuity contradictions from quiet-rest controls. Broad approval of ordinary samples should still be treated as a lenient model diagnostic, not proof of character quality. Evidence: W1-evidence/judge-calibration.json.

The first verbose judge request timed out. A later 16K-context headroom probe also timed out, and its identical in-flight retry was stopped and remains charged. Requests and charges are retained in judge-attempts.jsonl.gz. Successful judging uses an 8K context, compact Y/N answers in fixed question order, brief reasons, and a bounded local retry policy. Reported prompt-plus-output token counts are checked against context capacity. Failed attempts retained: 5. Successful coverage is counted separately from attempts.

## Boundaries

The harness exercises a season of guarded main acts, shelter and bond progression. Full Parley, arena result bridges, detailed quest/duality/fodder arcs and death gameplay remain the waves listed in the reconciled defect register. Knowledge citation checks cannot prove absence of implicit cross-member inference in a shared group call. Quantitative projection buckets may legitimately share a cache key; cached output is always revalidated against the current numeric state.

Text checks are lexical guardrails, not proof of narrative truth. The fuzz claim concerns the enforced schema and domain rules. Model prompts, voice quality, implied knowledge and invented natural-language details remain fallible and are assessed diagnostically and by the owner.

Fable's six W0 fixes and lower-severity followups are closed in the preceding W0 commit. Owner blind reading remains pending. Nothing is labelled felt.

W1 engineering decision: PASS — required sample, character diagnostic, deterministic audit and rejection gate complete. Proceed to W5; owner blind read remains pending.
