import { existsSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { night } from "@mage/director";
export type NightEvidence = Awaited<ReturnType<typeof night>> & {
  index: number;
  label: string;
  provider: string;
  model: string;
  elapsedMs: number;
};
export function readNights(path: string): NightEvidence[] {
  return readEvidence(path)
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as NightEvidence);
}
export function hasEvidence(path: string): boolean {
  return existsSync(path) || existsSync(`${path}.gz`);
}
export function readEvidence(path: string): string {
  return existsSync(path)
    ? readFileSync(path, "utf8")
    : gunzipSync(readFileSync(`${path}.gz`)).toString("utf8");
}
export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)];
}
export function summarize(rows: NightEvidence[]) {
  const calls = rows
      .flatMap((r) => r.groups)
      .filter((g) => g.source === "live"),
    verdicts = rows.flatMap((r) => r.verdicts),
    rejected = verdicts.filter((v) => v.rejected);
  const count = (values: (string | null)[]) =>
    Object.fromEntries(
      [...new Set(values.filter((x) => x !== null))].map((key) => [
        key,
        values.filter((v) => v === key).length,
      ]),
    );
  const input = calls
      .map((c) => c.inputTokens)
      .filter((x): x is number => x !== null),
    output = calls
      .map((c) => c.outputTokens)
      .filter((x): x is number => x !== null);
  return {
    label: "measured",
    model: rows[0]?.model ?? null,
    nights: rows.length,
    items: verdicts.length,
    liveCalls: calls.length,
    cacheGroups: rows
      .flatMap((r) => r.groups)
      .filter((g) => g.source === "cache").length,
    rejected: rejected.length,
    rejectionRate: verdicts.length ? rejected.length / verdicts.length : null,
    reasons: count(rejected.map((v) => v.reason)),
    lineRepairs: verdicts.filter((v) => v.lineReplaced).length,
    lineRepairRate: verdicts.length
      ? verdicts.filter((v) => v.lineReplaced).length / verdicts.length
      : null,
    lineReasons: count(
      verdicts.filter((v) => v.lineReplaced).map((v) => v.lineReplaced),
    ),
    foreignItems: rows
      .flatMap((r) => r.groups)
      .reduce((n, g) => n + g.foreignItems, 0),
    transportFailures: calls.filter((c) => c.error).length,
    transportReasons: count(calls.filter((c) => c.error).map((c) => c.error)),
    callLatencyMs: {
      p50: percentile(
        calls.map((c) => c.elapsedMs),
        0.5,
      ),
      p95: percentile(
        calls.map((c) => c.elapsedMs),
        0.95,
      ),
      max: calls.length ? Math.max(...calls.map((c) => c.elapsedMs)) : null,
    },
    nightLatencyMs: {
      p50: percentile(
        rows.map((r) => r.elapsedMs),
        0.5,
      ),
      p95: percentile(
        rows.map((r) => r.elapsedMs),
        0.95,
      ),
    },
    tokens: {
      input: input.reduce((a, b) => a + b, 0),
      output: output.reduce((a, b) => a + b, 0),
      callsWithInputUsage: input.length,
      callsWithOutputUsage: output.length,
    },
    cliReportedReferenceCostUsd: calls.some((c) => c.costUsd !== null)
      ? calls.reduce((n, c) => n + (c.costUsd ?? 0), 0)
      : null,
    intentCounts: count(rows.flatMap((r) => r.items).map((d) => d.intent)),
    seeds: [...new Set(rows.map((r) => r.seed))],
    stateHashes: rows.map((r) => r.afterHash),
  };
}
