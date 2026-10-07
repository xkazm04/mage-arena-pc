import { createHash } from "node:crypto";
import {
  copyFileSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const root = "docs/waves/W6-evidence";
copyFileSync(
  ".director-runtime/w6-parley-ledger.json",
  `${root}/cost-ledger.json`,
);
copyFileSync(
  ".director-runtime/core-session3-clock.json",
  `${root}/clock-observation.json`,
);
const summaries = [
  "local-pilot",
  "local-short-reply",
  "local-effect-meaning",
  "local-injections",
].map((name) => {
  const report = JSON.parse(readFileSync(`${root}/${name}.json`, "utf8"));
  const rows = report.rows as {
    family: string;
    source: string;
    problem: string | null;
    replyReplaced: string | null;
    elapsedMs: number;
    outcome: { effect: string };
    result: { inputTokens?: number; outputTokens?: number } | null;
  }[];
  const times = rows.map((r) => r.elapsedMs).sort((a, b) => a - b);
  const count = (values: string[]) =>
    values.reduce<Record<string, number>>((a, key) => {
      a[key] = (a[key] ?? 0) + 1;
      return a;
    }, {});
  return {
    name,
    rows: rows.length,
    sources: count(rows.map((r) => r.source)),
    problems: count(rows.filter((r) => r.problem).map((r) => r.problem!)),
    hostileEffects: count(
      rows
        .filter((r) => r.family !== "positive-control")
        .map((r) => r.outcome.effect),
    ),
    controls: rows
      .filter((r) => r.family === "positive-control")
      .map((r) => r.outcome.effect),
    replyRepairs: rows.filter((r) => r.replyReplaced).length,
    p50Ms: times[Math.floor(times.length * 0.5)],
    p95Ms: times[Math.floor(times.length * 0.95)],
    inputTokens: rows.reduce((n, r) => n + (r.result?.inputTokens ?? 0), 0),
    outputTokens: rows.reduce((n, r) => n + (r.result?.outputTokens ?? 0), 0),
  };
});
const ledger = JSON.parse(readFileSync(`${root}/cost-ledger.json`, "utf8"));
const files: { path: string; bytes: number; sha256: string }[] = [];
function walk(dir: string) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.name !== "manifest.json") {
      const bytes = readFileSync(path);
      files.push({
        path: path.replaceAll("\\", "/"),
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    }
  }
}
walk(root);
const manifest = {
  label: "measured local experiments; state outcomes simulated",
  subscriptionCalls: 0,
  localReservations: ledger.reservations.length,
  retainedRows: summaries.reduce((n, r) => n + r.rows, 0),
  orphanReservations: 1,
  electricityCost: "not measured",
  summaries,
  files,
};
writeFileSync(
  `${root}/manifest.json`,
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(JSON.stringify({ ...manifest, files: files.length }, null, 2));
