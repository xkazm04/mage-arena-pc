import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { Ajv } from "ajv";
import { join, resolve as pathResolve } from "node:path";
import { createState, type CampState } from "@mage/core";
import { loadTables, hash } from "@mage/director";
import { auditNight } from "./audit.ts";
import { decodeJudgments, judgeQuestions } from "./judge-format.ts";
import { fuzz } from "../../director/src/fuzz.ts";
import config from "../../director/src/config.json" with { type: "json" };
import { experimentTables, experimentHash } from "./experiment.ts";
import {
  readNights,
  readEvidence,
  hasEvidence,
  summarize,
} from "./evidence.ts";

const root = pathResolve("docs/waves/W1-evidence");
mkdirSync(root, { recursive: true });
const t = experimentTables();
const sources = ["local-pilot-a", "local-soak", "sonnet"];
const reports: Record<string, ReturnType<typeof summarize>> = {};
for (const name of sources)
  if (hasEvidence(join(root, name, "nights.jsonl")))
    reports[name] = summarize(readNights(join(root, name, "nights.jsonl")));
const fuzzReport = fuzz(loadTables());
writeFileSync(
  join(root, "fuzz.json"),
  JSON.stringify(fuzzReport, null, 2) + "\n",
);
const local = reports["local-soak"],
  sonnet = reports.sonnet;
const complete =
  local?.nights === config.budget.w1.localNights &&
  sonnet?.nights === config.budget.w1.sonnetNights &&
  local.liveCalls === config.budget.w1.localNights * config.groups.length &&
  sonnet.liveCalls === config.budget.w1.sonnetNights * config.groups.length;
const kill =
  local?.rejectionRate !== null &&
  local?.rejectionRate !== undefined &&
  local.rejectionRate > config.budget.w1.rejectionKillRate;
interface JudgeSummary {
  label: string;
  judgeModel: string;
  nights: number;
  failedCalls: number;
  failedAttempts: number;
  items: number;
  tokens: { input: number; output: number };
  no: Record<string, { count: number; rate: number | null }>;
}
const judgeReports: Record<string, JudgeSummary> = {};
const judgeExamples: Record<string, unknown> = {};
const judgeValidator = new Ajv({ allErrors: true });
for (const name of ["local-soak", "sonnet"]) {
  const path = join(root, name, "judge.jsonl");
  if (!hasEvidence(path)) continue;
  const judgments = readEvidence(path)
    .trim()
    .split("\n")
    .filter(Boolean)
    .map(
      (l) =>
        JSON.parse(l) as {
          judgeModel: string;
          index: number;
          formatVersion?: string;
          error: string | null;
          raw: unknown;
          requestHash: string;
          request: {
            format: Record<string, unknown>;
            options: { num_ctx: number };
          };
          inputTokens?: number;
          outputTokens?: number;
        },
    );
  for (const judgment of judgments) {
    if (
      !judgment.error &&
      (judgment.inputTokens ?? 0) + (judgment.outputTokens ?? 0) >
        judgment.request.options.num_ctx
    )
      throw new Error("Stored judge output exceeded context capacity");
    if (hash(judgment.request) !== judgment.requestHash)
      throw new Error("Judge request hash mismatch");
    if (
      !judgment.error &&
      !judgeValidator.validate(judgment.request.format, judgment.raw)
    )
      throw new Error("Stored judge verdict violates its schema");
    if (
      !judgment.error &&
      new Set(
        decodeJudgments(judgment.raw, judgment.formatVersion).map(
          (j) => j.character,
        ),
      ).size !== decodeJudgments(judgment.raw, judgment.formatVersion).length
    )
      throw new Error("Stored judge verdict contains duplicate actors");
  }
  const valid = judgments
    .filter((j) => !j.error)
    .flatMap((j) => decodeJudgments(j.raw, j.formatVersion));
  judgeExamples[name] = Object.fromEntries(
    judgeQuestions.map((question) => [
      question,
      judgments
        .filter((j) => !j.error)
        .flatMap((row) =>
          decodeJudgments(row.raw, row.formatVersion)
            .filter((j) => !j[question])
            .map((j) => ({
              index: row.index,
              character: j.character,
              reason: j.reason,
              requestHash: row.requestHash,
              evidence: `${name}/judge.jsonl.gz`,
            })),
        )
        .slice(0, 3),
    ]),
  );
  if (judgments.some((j, index) => j.index !== index))
    throw new Error("Judge sample coverage mismatch");
  const attemptsPath = join(root, name, "judge-attempts.jsonl");
  const attempts = hasEvidence(attemptsPath)
    ? readEvidence(attemptsPath)
        .trim()
        .split("\n")
        .filter(Boolean)
        .map(
          (line) =>
            JSON.parse(line) as {
              error: string | null;
              inputTokens?: number;
              outputTokens?: number;
            },
        )
    : judgments;
  judgeReports[name] = {
    label: "model diagnostic; not felt",
    judgeModel: judgments[0]?.judgeModel,
    nights: judgments.length,
    failedCalls: judgments.filter((j) => j.error).length,
    failedAttempts: attempts.filter((j) => j.error).length,
    items: valid.length,
    tokens: {
      input: attempts.reduce((n, j) => n + (j.inputTokens ?? 0), 0),
      output: attempts.reduce((n, j) => n + (j.outputTokens ?? 0), 0),
    },
    no: Object.fromEntries(
      judgeQuestions.map((q) => [
        q,
        {
          count: valid.filter((j) => j[q] === false).length,
          rate: valid.length
            ? valid.filter((j) => j[q] === false).length / valid.length
            : null,
        },
      ]),
    ),
  };
}
const judgeComplete = ["local-soak", "sonnet"].every(
  (name) =>
    judgeReports[name]?.nights === reports[name]?.nights &&
    judgeReports[name]?.items === reports[name]?.items &&
    judgeReports[name]?.failedCalls === 0,
);
writeFileSync(
  join(root, "judge-examples.json"),
  JSON.stringify(
    {
      label:
        "measured model diagnostic examples; not established character defects",
      selection:
        "first three negative judgments per question and source, zero-based night index",
      examples: judgeExamples,
    },
    null,
    2,
  ) + "\n",
);
const seasonDays = t.season.weeks * t.season.daysPerWeek;
const calibrationPath = join(root, "judge-calibration.json");
const calibration = hasEvidence(calibrationPath)
  ? (JSON.parse(readEvidence(calibrationPath)) as {
      passed: boolean;
      inputTokens: number;
      outputTokens: number;
      raw: unknown;
      expectedNegativeIds: string[];
      requestHash: string;
      request: { format: Record<string, unknown> };
    })
  : null;
if (calibration) {
  if (
    hash(calibration.request) !== calibration.requestHash ||
    !judgeValidator.validate(calibration.request.format, calibration.raw)
  )
    throw new Error("Calibration evidence mismatch");
  const checks = decodeJudgments(calibration.raw, "compact-v2");
  calibration.passed = checks.every((j) =>
    judgeQuestions.every(
      (q) => j[q] === !calibration.expectedNegativeIds.includes(j.character),
    ),
  );
}
const interruptionPath = join(root, "interruption.json");
const interruption = hasEvidence(interruptionPath)
  ? (JSON.parse(readEvidence(interruptionPath)) as Record<string, unknown>)
  : null;
const processPath = join(root, "w1b-process.jsonl");
const processEvents = hasEvidence(processPath)
  ? readEvidence(processPath)
      .trim()
      .split("\n")
      .filter(Boolean)
      .map(
        (line) =>
          JSON.parse(line) as { event: string; elapsedMs?: number; at: string },
      )
  : [];
const wallClockGaps = processEvents.filter(
  (event) => event.event === "wall-clock-gap",
);
const projections = Object.fromEntries(
  Object.entries(reports).map(([name, r]) => [
    name,
    {
      label: "arithmetic projection from measured nightly means; not billed",
      seasonDays,
      inputTokens: Math.round((r.tokens.input / r.nights) * seasonDays),
      outputTokens: Math.round((r.tokens.output / r.nights) * seasonDays),
      cliReferenceCostUsd:
        r.cliReportedReferenceCostUsd === null
          ? null
          : (r.cliReportedReferenceCostUsd / r.nights) * seasonDays,
    },
  ]),
);
const ledger = JSON.parse(
  readFileSync(".director-runtime/cost-ledger.json", "utf8"),
) as { runs: Record<string, number> };
const costReport = {
  label:
    "measured token usage and charged call reservations; dollars only where reported",
  runs: ledger.runs,
  subscriptionCalls: ledger.runs["claude:W1-sonnet-total"] ?? 0,
  subscriptionCap: config.budget.w1.sonnetNights * config.groups.length,
  localUnrecordedReservations:
    (ledger.runs["ollama:local-soak"] ?? 0) - (local?.liveCalls ?? 0),
  subscriptionReferenceUsd: sonnet?.cliReportedReferenceCostUsd,
  marginalSubscriptionUsd: null,
  localElectricityUsd: null,
  calibrationTokens: calibration
    ? { input: calibration.inputTokens, output: calibration.outputTokens }
    : null,
  judgeTokens: Object.fromEntries(
    Object.entries(judgeReports).map(([name, r]) => [name, r.tokens]),
  ),
  projections,
};
if (costReport.subscriptionCalls > costReport.subscriptionCap)
  throw new Error("Subscription cap exceeded");
writeFileSync(
  join(root, "cost-report.json"),
  JSON.stringify(costReport, null, 2) + "\n",
);
writeFileSync(
  join(root, "summary.json"),
  JSON.stringify(
    {
      label: "measured",
      experimentHash: experimentHash(),
      complete,
      judgeComplete,
      judgeCalibrationPassed: calibration?.passed ?? false,
      interruption,
      wallClockGaps,
      kill,
      threshold: config.budget.w1.rejectionKillRate,
      reports,
      fuzz: fuzzReport,
      judge: judgeReports,
      projections,
    },
    null,
    2,
  ) + "\n",
);

// Independently revalidate and replay recorded provider output against logged requests.
const audit: Record<string, unknown> = {};
const replayDraws: unknown[] = [];
for (const name of ["local-soak", "sonnet"]) {
  const path = join(root, name, "nights.jsonl");
  if (!hasEvidence(path)) continue;
  const rows = readNights(path);
  let state: CampState = createState(t, rows[0].seed, rows[0].day),
    cacheKeysChecked = 0;
  for (const row of rows) {
    if (state.ended) state = createState(t, state.seed + 1);
    const { result: replayed, draws: plannerDraws } = auditNight(t, state, row);
    cacheKeysChecked += row.groups.length;
    state = replayed.state;
    replayDraws.push({
      run: name,
      index: row.index,
      label: "deterministic replay of seeded draws",
      plannerDraws,
      contestDraws: replayed.rolls,
    });
  }
  audit[name] = {
    nights: rows.length,
    cacheKeysChecked,
    exactStateReplays: rows.length,
    exactRejectionCensuses: rows.length,
  };
}
writeFileSync(
  join(root, "replay-audit.json"),
  JSON.stringify(audit, null, 2) + "\n",
);
writeFileSync(
  join(root, "seeded-draws.jsonl"),
  replayDraws.map((r) => JSON.stringify(r)).join("\n") + "\n",
);

const fmt = (x: number | null | undefined) =>
  x === null || x === undefined ? "not measured" : x.toFixed(2);
const lines = [
  "# W1 Director harness report",
  "",
  `Status: ${complete ? "requested live night counts completed" : "measurement in progress; W1 gate incomplete"}. Local kill threshold result: ${kill ? "STOP — rejection exceeds the authored threshold" : "not exceeded in recorded samples"}.`,
  ...(interruption
    ? [
        "",
        "The first session had an interruption exceeding seven hours. Its last saved local night retains that elapsed interval and a timeout; the unsaved in-flight reservation remains charged. W1b resumes the original evidence in detached ten-night chunks. See `W1-evidence/interruption.json` and the supervisor evidence for subsequent wall-clock gaps.",
      ]
    : []),
  "",
  "All model runs are **measured** on this host. State outcomes are **simulated**. Balancing data is **authored**; owner feel is **not measured**.",
  "",
  `W1b supervisor recorded ${wallClockGaps.length} wall-clock gaps beyond its heartbeat tolerance. Gaps are retained, not attributed to sleep without evidence.`,
  "",
  "| Run | Nights | Calls | Rejected items | Rejection rate | Line repairs | Call p50 / p95 (ms) |",
  "|---|---:|---:|---:|---:|---:|---:|",
  ...Object.entries(reports).map(
    ([name, r]) =>
      `| ${name} | ${r.nights} | ${r.liveCalls} | ${r.rejected}/${r.items} | ${fmt((r.rejectionRate ?? 0) * 100)}% | ${r.lineRepairs} | ${fmt(r.callLatencyMs.p50)} / ${fmt(r.callLatencyMs.p95)} |`,
  ),
  "",
  "Rejection includes malformed/illegal decisions, unavailable transport and camp cap drops. Line-only repairs preserve legal acts and are reported separately. The owner should evaluate how often the authored bank replaces model voice; low intent rejection alone does not establish character quality.",
  `Local line repairs: ${local?.lineRepairs ?? 0}/${local?.items ?? 0} (${fmt((local?.lineRepairRate ?? 0) * 100)}%). These are not added to the item-rejection kill numerator because the intent remains valid, but they are a material voice-quality limitation.`,
  "",
  "Local calls run serially to avoid GPU queue contention. Sonnet groups run concurrently. Night latency is separately recorded in `W1-evidence/summary.json`; per-call latency must not be confused with the duration of a whole night.",
  "",
  "The player remains idle in this headless experiment. After each season ends, the runner starts a new independent season with the next seed. Arena results and Parley events are not injected. These are Director night samples, not a full-game balance or player-choice study.",
  "",
  "| Run | Accepted intent distribution |",
  "|---|---|",
  ...Object.entries(reports).map(
    ([name, r]) =>
      `| ${name} | ${Object.entries(r.intentCounts)
        .map(([intent, count]) => `${intent}: ${count}`)
        .join(", ")} |`,
  ),
  "",
  "## Validation",
  "",
  `The hostile fuzz census generated ${fuzzReport.cases} cases (${fuzzReport.uniqueOutputs} unique malformed outputs): no invalid item escaped, no fallback was illegal, and no valid sibling was lost. Details: W1-evidence/fuzz.json.`,
  "",
  "Commands: `npm run gate`; `npm run report`. The report revalidates every raw group output and replays each night, verifying complete request keys and final state hashes. The live experiment uses the pinned pre-review-fix tables in `W1-evidence/experiment-tables.json` throughout all 300 local nights; the original 155 nights are retained. Current authored balance has regenerated W0 fixtures and the 500-case fuzz gate, not a separate 300-night live claim.",
  "",
  "`npx tsx packages/tools/src/cache-replay.ts` restores each forced-live night's pinned response snapshot and repeats it with a zero-call budget. Normal cache records are immutable after the first valid write; independent forced-live samples do not share an immutable timeline. `W1-evidence/seeded-draws.jsonl.gz` records deterministic replays of all planner and contest draws, including samples collected before runtime planner-draw logging was added.",
  "",
  "## Provider invocation and cost",
  "",
  "CLI flags were verified with `claude --help` and version captured before any call. `--bare` disables subscription OAuth on this installation; the provider uses `--safe-mode`, empty tools/settings/MCP, a supplied system prompt, no session persistence and a hard timeout. Full exact argv and measured durations are stored with every call in the Sonnet evidence. Model usage reports confirm the actual model identity.",
  "",
  "`npm run soak -- --provider claude --run sonnet --nights 30` resumes the same durable run budget, including the first-night probe. It cannot reset the subscription cap by changing the output run name. Failed calls also consume reservations. The local pilot and soak have separate run caps and a shared UTC-day ledger.",
  "",
  ...Object.entries(reports).map(
    ([name, r]) =>
      `- ${name}: ${r.tokens.input} reported input tokens, ${r.tokens.output} output tokens; ${r.transportFailures} transport failures. CLI reference cost: ${r.cliReportedReferenceCostUsd === null ? "not reported" : `USD ${r.cliReportedReferenceCostUsd.toFixed(4)}`}.`,
  ),
  "",
  "CLI-reported cost is a provider reference/API-equivalent figure, **not an invoice or measured subscription debit**. Marginal subscription dollars and local electricity cost are not measured. Ollama has no hosted token charge. No placeholder API pricing is presented as actual spend.",
  "",
  `Charged subscription reservations: ${costReport.subscriptionCalls}/${costReport.subscriptionCap}; unrecorded local reservations retained: ${costReport.localUnrecordedReservations}. Local judge token usage and season projections are in W1-evidence/cost-report.json. Judge calls use only the local model.`,
  "",
  "## Character diagnostic and owner read",
  "",
  Object.keys(judgeReports).length
    ? `Judge coverage ${judgeComplete ? "complete" : "in progress"}. Questions below show negative judgments on raw proposals before validation or line repair where available. A missing proposal is judged using its recorded planner item; each request records this distinction in judgedSource.`
    : "Local judge diagnostic: pending. No character-quality claim yet.",
  "",
  "| Run / judge | Items | Goal no | Values no | Voice no | Knowledge no | Continuity no |",
  "|---|---:|---:|---:|---:|---:|---:|",
  ...Object.entries(judgeReports).map(
    ([name, r]) =>
      `| ${name} / ${r.judgeModel} | ${r.items} | ${["goal", "values", "voice", "knowledge", "continuity"].map((q) => `${r.no[q].count} (${fmt((r.no[q].rate ?? 0) * 100)}%)`).join(" | ")} |`,
  ),
  "",
  "The local judge is a model diagnostic, not an independent human certification. It answers goal, values, voice, knowledge and continuity questions against supplied personal context. The same local model judging itself is a limitation. Blind morning material and source mapping are generated separately; no source labels appear on the owner page.",
  "Traceable negative examples (the first three per question and source, without cherry-picking) are in W1-evidence/judge-examples.json. Each names the original night index, actor and request hash; the full context and verdict remain in the compressed judge evidence.",
  "Observed diagnostic limitation: some reasons describe a knowledge violation while the compact answer marks continuity (for example local sample index 3). The code preserves the actual returned answers; it does not silently relabel them. The calibration below tests gross contradictions versus clean controls, not isolated sensitivity of every answer position. Per-question rates therefore remain fallible model assessments, not ground-truth defect rates.",
  "",
  `Judge calibration: ${calibration?.passed ? "passed" : "not passed"}. The same prompt and output format distinguish planted goal, value, voice, unknown-fact and continuity contradictions from quiet-rest controls. Broad approval of ordinary samples should still be treated as a lenient model diagnostic, not proof of character quality. Evidence: W1-evidence/judge-calibration.json.`,
  "",
  `The first verbose judge request timed out. A later 16K-context headroom probe also timed out, and its identical in-flight retry was stopped and remains charged. Requests and charges are retained in judge-attempts.jsonl.gz. Successful judging uses an 8K context, compact Y/N answers in fixed question order, brief reasons, and a bounded local retry policy. Reported prompt-plus-output token counts are checked against context capacity. Failed attempts retained: ${Object.values(judgeReports).reduce((n, r) => n + r.failedAttempts, 0)}. Successful coverage is counted separately from attempts.`,
  "",
  "## Boundaries",
  "",
  "The harness exercises a season of guarded main acts, shelter and bond progression. Full Parley, arena result bridges, detailed quest/duality/fodder arcs and death gameplay remain the waves listed in the reconciled defect register. Knowledge citation checks cannot prove absence of implicit cross-member inference in a shared group call. Quantitative projection buckets may legitimately share a cache key; cached output is always revalidated against the current numeric state.",
  "",
  "Text checks are lexical guardrails, not proof of narrative truth. The fuzz claim concerns the enforced schema and domain rules. Model prompts, voice quality, implied knowledge and invented natural-language details remain fallible and are assessed diagnostically and by the owner.",
  "",
  "Fable's six W0 fixes and lower-severity followups are closed in the preceding W0 commit. Owner blind reading remains pending. Nothing is labelled felt.",
  "",
  `W1 engineering decision: ${complete && judgeComplete && calibration?.passed && !kill ? "PASS — required sample, character diagnostic, deterministic audit and rejection gate complete. Proceed to W5; owner blind read remains pending." : kill ? "STOP — rejection kill rule exceeded; do not begin W5." : "INCOMPLETE — do not begin W5 until all required measurements finish."}`,
  "",
];
writeFileSync(pathResolve("docs/waves/W1-report.md"), lines.join("\n"));
if (kill && complete) {
  console.error(
    "STOP: local rejection exceeds the wave threshold. Options: shrink the vocabulary, or make the planner the default with model narration only.",
  );
  process.exitCode = 2;
}
console.log(
  JSON.stringify(
    {
      complete,
      kill,
      localNights: local?.nights,
      sonnetNights: sonnet?.nights,
      fuzzCases: fuzzReport.cases,
      audit,
      judge: judgeReports,
    },
    null,
    2,
  ),
);
