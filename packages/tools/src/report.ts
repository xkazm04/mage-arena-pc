import { mkdirSync, writeFileSync } from "node:fs";
import { Ajv } from "ajv";
import { join, resolve as pathResolve } from "node:path";
import { createState, resolve, reconcile, type CampState } from "@mage/core";
import {
  loadTables,
  plan,
  hash,
  validateGroup,
  type PlannerDraw,
} from "@mage/director";
import { fuzz } from "../../director/src/fuzz.ts";
import config from "../../director/src/config.json" with { type: "json" };
import {
  readNights,
  readEvidence,
  hasEvidence,
  summarize,
} from "./evidence.ts";

const root = pathResolve("docs/waves/W1-evidence");
mkdirSync(root, { recursive: true });
const t = loadTables();
const sources = ["local-pilot-a", "local-soak", "sonnet"];
const reports: Record<string, ReturnType<typeof summarize>> = {};
for (const name of sources)
  if (hasEvidence(join(root, name, "nights.jsonl")))
    reports[name] = summarize(readNights(join(root, name, "nights.jsonl")));
const fuzzReport = fuzz(t);
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
  items: number;
  no: Record<string, { count: number; rate: number | null }>;
}
const judgeReports: Record<string, JudgeSummary> = {};
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
          error: string | null;
          raw: { judgments: Record<string, unknown>[] };
          requestHash: string;
          request: { format: Record<string, unknown> };
        },
    );
  for (const judgment of judgments) {
    if (hash(judgment.request) !== judgment.requestHash)
      throw new Error("Judge request hash mismatch");
    if (
      !judgment.error &&
      !judgeValidator.validate(judgment.request.format, judgment.raw)
    )
      throw new Error("Stored judge verdict violates its schema");
    if (
      !judgment.error &&
      new Set(judgment.raw.judgments.map((j) => j.character)).size !==
        judgment.raw.judgments.length
    )
      throw new Error("Stored judge verdict contains duplicate actors");
  }
  const valid = judgments
    .filter((j) => !j.error)
    .flatMap((j) => j.raw.judgments);
  judgeReports[name] = {
    label: "model diagnostic; not felt",
    judgeModel: judgments[0]?.judgeModel,
    nights: judgments.length,
    failedCalls: judgments.filter((j) => j.error).length,
    items: valid.length,
    no: Object.fromEntries(
      ["goal", "values", "voice", "knowledge", "continuity"].map((q) => [
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
const seasonDays = t.season.weeks * t.season.daysPerWeek;
const interruptionPath = join(root, "interruption.json");
const interruption = hasEvidence(interruptionPath)
  ? (JSON.parse(readEvidence(interruptionPath)) as Record<string, unknown>)
  : null;
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
writeFileSync(
  join(root, "summary.json"),
  JSON.stringify(
    {
      label: "measured",
      complete,
      judgeComplete,
      interruption,
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
    const plannerDraws: PlannerDraw[] = [];
    if (state.ended) state = createState(t, state.seed + 1);
    if (hash(state) !== row.beforeHash)
      throw new Error(`${name} before hash mismatch ${row.index}`);
    const accepted = row.groups.flatMap((g) => {
      if (hash(g.request) !== g.key)
        throw new Error("Logged request/hash mismatch");
      cacheKeysChecked++;
      return validateGroup(
        t,
        state,
        g.group,
        g.members,
        g.error ? null : g.raw,
        plannerDraws,
      ).items;
    });
    const capped = reconcile(t, state, accepted, (id) =>
        plan(t, state, id, true, plannerDraws),
      ),
      replayed = resolve(t, state, capped.items);
    if (
      hash(replayed.state) !== row.afterHash ||
      hash(row.state) !== row.afterHash
    )
      throw new Error(`${name} replay mismatch ${row.index}`);
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
  `Status: ${complete ? "requested live night counts completed" : interruption ? "stopped after wall-clock window; W1 gate incomplete" : "measurement in progress"}. Local kill threshold result: ${kill ? "STOP — rejection exceeds the authored threshold" : "not exceeded in recorded samples"}.`,
  ...(interruption
    ? [
        "",
        "An unexpected execution interruption exceeded seven hours during a requested short wait. The final saved local night includes a timeout and that elapsed interval; the raw latency data is retained. The runner was stopped after resumption because the requested wall-clock window had passed. One additional in-flight local reservation has no saved response and remains charged. The judge made no calls. Remaining: finish the local sample and run the character diagnostic. See `W1-evidence/interruption.json` and the session log.",
      ]
    : []),
  "",
  "All model runs are **measured** on this host. State outcomes are **simulated**. Balancing data is **authored**; owner feel is **not measured**.",
  "",
  "| Run | Nights | Calls | Rejected items | Rejection rate | Line repairs | Call p50 / p95 (ms) |",
  "|---|---:|---:|---:|---:|---:|---:|",
  ...Object.entries(reports).map(
    ([name, r]) =>
      `| ${name} | ${r.nights} | ${r.liveCalls} | ${r.rejected}/${r.items} | ${fmt((r.rejectionRate ?? 0) * 100)}% | ${r.lineRepairs} | ${fmt(r.callLatencyMs.p50)} / ${fmt(r.callLatencyMs.p95)} |`,
  ),
  "",
  "Rejection includes malformed/illegal decisions, unavailable transport and camp cap drops. Line-only repairs preserve legal acts and are reported separately. The owner should evaluate how often the authored bank replaces model voice; low intent rejection alone does not establish character quality.",
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
  "Commands: `npm run gate`; `npm run report`. The report command revalidates every recorded raw group output and replays each night from the previous state, verifying complete request keys and final state hashes. The W0 fixture oracle remains unchanged.",
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
  "## Character diagnostic and owner read",
  "",
  Object.keys(judgeReports).length
    ? `Judge coverage ${judgeComplete ? "complete" : "in progress"}. Questions below show the share of negative judgments on raw proposals before validation or line repair.`
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
  "",
  "## Boundaries",
  "",
  "The harness exercises a season of guarded main acts, shelter and bond progression. Full Parley, arena result bridges, detailed quest/duality/fodder arcs and death gameplay remain the waves listed in the reconciled defect register. Knowledge citation checks cannot prove absence of implicit cross-member inference in a shared group call. Quantitative projection buckets may legitimately share a cache key; cached output is always revalidated against the current numeric state.",
  "",
  "Text checks are lexical guardrails, not proof of narrative truth. The fuzz claim concerns the enforced schema and domain rules. Model prompts, voice quality, implied knowledge and invented natural-language details remain fallible and are assessed diagnostically and by the owner.",
  "",
  "The orchestrator supplied Fable's W0 review: accepted for handover with six fixes owed. Those residual fixes are recorded in the defect register and session log; they are not silently marked closed. Owner blind reading remains pending. Nothing is labelled felt.",
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
