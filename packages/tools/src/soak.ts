import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { resolve as pathResolve, join } from "node:path";
import { performance } from "node:perf_hooks";
import { createState, type CampState } from "@mage/core";
import {
  ClaudeProvider,
  OllamaProvider,
  PlannerProvider,
  RequestCache,
  CostGuard,
  loadTables,
  night,
  type Provider,
} from "@mage/director";
import config from "../../director/src/config.json" with { type: "json" };

const args = process.argv.slice(2);
const opt = (name: string, fallback: string) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : fallback;
};
const mode = opt("provider", "planner"),
  run = opt("run", `${mode}-w1`),
  limit = Number(
    opt(
      "nights",
      String(
        mode === "claude"
          ? config.budget.w1.sonnetNights
          : config.budget.w1.localNights,
      ),
    ),
  );
if (
  !["planner", "ollama", "claude"].includes(mode) ||
  !Number.isInteger(limit) ||
  limit <= 0 ||
  !/^[a-z0-9-]+$/.test(run)
)
  throw new Error("Invalid run arguments");
if (mode === "claude" && limit > config.budget.w1.sonnetNights)
  throw new Error("Sonnet night cap");
const directory = pathResolve(opt("out", `docs/waves/W1-evidence/${run}`));
mkdirSync(directory, { recursive: true });
const log = join(directory, "nights.jsonl"),
  checkpoint = join(directory, "checkpoint.json"),
  t = loadTables();
const provider: Provider =
  mode === "claude"
    ? new ClaudeProvider(pathResolve(".director-runtime"))
    : mode === "ollama"
      ? new OllamaProvider(opt("model", config.ollama.model))
      : new PlannerProvider(t, () => saved.state);
mkdirSync(".director-runtime", { recursive: true });
const cap =
  mode === "claude"
    ? config.budget.w1.sonnetNights * config.groups.length
    : limit * config.groups.length;
// One fixed Sonnet run identity for all invocations/probes; command-line run names cannot reset its cap.
const localDayCap =
  (config.budget.w1.localNights + config.budget.w1.pilotLocalNights) *
    config.groups.length +
  config.budget.w1.localNights +
  config.budget.w1.sonnetNights;
const guard = new CostGuard(
  pathResolve(".director-runtime/cost-ledger.json"),
  mode === "claude" ? "W1-sonnet-total" : run,
  mode,
  cap,
  mode === "ollama" ? localDayCap : cap,
);
const cache = new RequestCache(pathResolve(`.director-runtime/cache/${mode}`));
type Checkpoint = {
  completed: number;
  state: CampState;
  model: string;
  startedAt: string;
};
let saved: Checkpoint = existsSync(checkpoint)
  ? (JSON.parse(readFileSync(checkpoint, "utf8")) as Checkpoint)
  : {
      completed: 0,
      state: createState(
        t,
        Number(opt("seed", "73")),
        Number(opt("start-day", "1")),
      ),
      model: provider.model,
      startedAt: new Date().toISOString(),
    };
if (saved.model !== provider.model)
  throw new Error("Cannot resume a run with a different model");
if (existsSync(log)) {
  const rows = readFileSync(log, "utf8").trim().split("\n").filter(Boolean);
  if (rows.length !== saved.completed)
    throw new Error("Log/checkpoint mismatch; inspect before resuming");
}
console.log(
  JSON.stringify({
    run,
    provider: mode,
    model: provider.model,
    completed: saved.completed,
    target: limit,
    startedAt: saved.startedAt,
  }),
);
for (let i = saved.completed; i < limit; i++) {
  if (saved.state.ended) saved.state = createState(t, saved.state.seed + 1);
  const start = performance.now();
  const result = await night(t, saved.state, {
    provider,
    cache,
    guard,
    forceLive: true,
    concurrent: mode === "claude",
  });
  const row = {
    index: i,
    label: mode === "planner" ? "simulated" : "measured",
    provider: mode,
    model: provider.model,
    elapsedMs: performance.now() - start,
    ...result,
  };
  appendFileSync(log, JSON.stringify(row) + "\n");
  saved = { ...saved, completed: i + 1, state: result.state };
  writeFileSync(`${checkpoint}.tmp`, JSON.stringify(saved));
  renameSync(`${checkpoint}.tmp`, checkpoint);
  console.log(
    JSON.stringify({
      night: i + 1,
      day: result.day,
      seed: result.seed,
      calls: result.groups.filter((g) => g.source === "live").length,
      errors: result.groups.filter((g) => g.error).map((g) => g.error),
      rejected: result.verdicts.filter((v) => v.rejected).length,
      repairedLines: result.verdicts.filter((v) => v.lineReplaced).length,
      ms: Math.round(row.elapsedMs),
    }),
  );
  // A provider/auth failure must not burn the remaining subscription by retrying every night.
  if (result.groups.every((g) => g.error)) {
    console.log("STOP: all groups failed; evidence and budget retained.");
    process.exitCode = 2;
    break;
  }
}
