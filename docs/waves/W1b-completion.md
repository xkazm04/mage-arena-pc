# W1b completion plan — 2026-10-02

Resume the original experiment at night 155, preserving all raw rows, the
checkpoint and charged ledger. Use its pinned pre-W0-fix table snapshot for all
remaining nights and offline audits. This keeps one controlled sample and does
not mislabel the newer balance as measured. No additional subscription calls:
the 150-call / 30-night cap is already spent.

Run a hidden detached supervisor with ten-night child chunks. Each child records
every completed night durably. The supervisor then runs the local judge on both
providers in ten-night chunks. Persist progress and wall-clock heartbeat gaps;
sleep/interruption changes elapsed measurements, not the target or sample.
Retain the old orphan reservation and permit exactly one extra local reservation
so all 1,500 recorded live group calls can finish. Failed calls remain charged.

Gate commands: `npm run gate`, `npm run report`,
`npx tsx packages/tools/src/cache-replay.ts`,
`npx tsx packages/tools/src/archive.ts`, and
`npx tsx packages/tools/src/blind.ts local-soak`.
Pass requires 300 local and 30 subscription nights, complete character diagnostic,
500-case fuzz, exact replay and the local item rejection rate at or below 15%.
Owner blind reading stays pending; it is never substituted by a model verdict.
Check the blind HTML in headless Chrome at desktop and mobile sizes with
`npx tsx packages/tools/src/blind-check.ts`; preserve screenshots and check that
no provider/source labels or horizontal overflow reach the owner page.

Measured continuation: the local sample finished at 300 nights, 213/4,500 items
rejected (4.73%). The first verbose judge request timed out at 120 seconds. Its
request and charge are retained in `sonnet/judge-attempts.jsonl`. The judge now
uses a compact, schema-checked Y/N string in fixed goal/values/voice/knowledge/
continuity order, with a short reason, an 8K context and a bounded six-attempt
local budget per night. All successful judgments use this same compact format;
failed attempts are archived separately and never counted as completed coverage.
No local-soak prompts or recorded decisions changed. No additional subscription
calls are permitted. Initial compact calls completed in 11–17 seconds.

At local judgment 185, two more 120-second attempts timed out; the third finished
in 97 seconds. The read-only provider log showed active generation falling below
one token per second at times, rather than a stopped process. Subsequent judge
chunks use a separate ten-minute hard timeout and six attempts maximum per night
to avoid repeatedly aborting slow diagnostic output. This does not change the
night-soak settings, its evidence, or the subscription cap. Every attempt remains
charged and archived; the precise cause of throughput variation is not established.

At local judgment 78, measured prompt usage reached 7,010 tokens plus 392 output
tokens, within 8K. A 16K headroom probe at judgment 91 timed out; its identical
in-flight retry was stopped and retained as a charged interrupted attempt, with
request identity proven against the ledger hash. The judge resumed at the same
night with the working 8K context. Calls whose reported prompt-plus-output usage
exceeds context capacity are rejected. The reason for the 16K stalls is not
established. A separate charged local calibration distinguished all five planted
contradictions from quiet-rest controls. No successful judgments were discarded.

Start/restart: `powershell -NoProfile -File packages/tools/start-w1b.ps1`.
Progress: `.director-runtime/w1b-progress.json`; durable chunk and heartbeat log:
`docs/waves/W1-evidence/w1b-process.jsonl` (archived at completion).

Final decision: engineering PASS. All 300 local nights / 1,500 calls and the
unchanged 30 Sonnet nights / 150 calls replay exactly. Local rejection is
213/4,500 = 4.7333%, below the 15% kill rule. The local judge completed all 330
nights / 4,950 character decisions, with five failed attempts retained and one
separate calibration call. The calibration distinguishes gross contradictions;
some live reasons and answer categories disagree, so this remains a fallible
diagnostic. Local lines were repaired 821 times (18.24%); passing the intent gate
does not certify voice quality. Owner blind reading remains pending.

Measured: `npm run gate` passes build, lint, 20 TypeScript and ten replayer tests;
`npm run report` audits every request, rejection census and final state;
`npx tsx packages/tools/src/cache-replay.ts` yields 1,650 hits with zero calls;
`npx tsx packages/tools/src/provenance.ts` proves the original 155 local and all
30 Sonnet rows unchanged byte for byte; full archives pass row-count, SHA and
compression round-trip checks. Blind HTML passes desktop/mobile browser checks.
The detached supervisor completed at 10:45:08 UTC. No new wall-clock gaps were
recorded; the earlier session's interruption stays in the evidence.

Cost: 150/150 subscription reservations, USD 3.7934884 CLI reference cost (not
an invoice); 1,852 local reservations including pilot, soak, judge and calibration.
The original unrecorded local reservation remains charged. Reported judge usage
is 2,072,489 input / 130,737 output tokens, plus calibration 2,381 / 508.
Local electricity and marginal subscription dollars are not measured. Next: W5.
