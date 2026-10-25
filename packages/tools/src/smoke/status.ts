// Answers "which suites pass right now" from the evidence each suite already writes, and folds a
// run into one table plus an exit code. The CLI's own last-run record lives in the OS temp dir:
// .gitignore is operator-owned, so nothing here writes inside the repo.
import { existsSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { REGISTRY, type SuiteEntry } from "./registry.ts";

export const LAST_RUN = join(tmpdir(), "mage-arena-smoke", "last-run.json");

export type SuiteState =
  | { state: "pass"; at: Date }
  | { state: "fail"; at: Date; error: string }
  | { state: "never-run" }
  | { state: "untracked" };

const firstLine = (s: unknown) => String(s ?? "").split("\n")[0]!.trim();

function record(path: string): { at: Date; body: Record<string, unknown> | null } | null {
  if (!existsSync(path)) return null;
  const at = statSync(path).mtime;
  try {
    return { at, body: JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown> };
  } catch {
    return { at, body: null };
  }
}

/** pass / fail (newer failure record, or passed:false) / never-run, read from the suite's evidence dir. */
export function status(e: SuiteEntry, root = "."): SuiteState {
  if (!e.evidence || !e.pass) return { state: "untracked" };
  const dir = resolve(root, e.evidence);
  const pass = record(join(dir, e.pass));
  const fail = e.failure ? record(join(dir, e.failure)) : null;
  if (fail && (!pass || fail.at > pass.at)) {
    return { state: "fail", at: fail.at, error: firstLine(fail.body?.error) || "failure record" };
  }
  if (!pass) return { state: "never-run" };
  if (!pass.body) return { state: "fail", at: pass.at, error: `unreadable ${e.pass}` };
  if (pass.body.passed === false) return { state: "fail", at: pass.at, error: firstLine(pass.body.error) || "passed: false" };
  return { state: "pass", at: pass.at };
}

export interface RunResult {
  suite: string;
  ok: boolean;
  ms: number;
  error?: string;
}

export interface SummaryRow {
  suite: string;
  result: "pass" | "fail";
  seconds: number;
  evidence: string;
  error: string;
}

export function table(header: readonly string[], rows: readonly (readonly string[])[]): string {
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)));
  const line = (r: readonly string[]) => r.map((c, i) => c.padEnd(widths[i]!)).join("  ").trimEnd();
  return [line(header), ...rows.map(line)].join("\n");
}

/** One row per suite, with where its evidence lives; exit code 1 when any suite failed. */
export function summarize(results: readonly RunResult[], registry: readonly SuiteEntry[] = REGISTRY) {
  const rows: SummaryRow[] = results.map((r) => ({
    suite: r.suite,
    result: r.ok ? "pass" : "fail",
    seconds: Math.round(r.ms / 1000),
    evidence: registry.find((e) => e.id === r.suite)?.evidence ?? "-",
    error: r.ok ? "" : firstLine(r.error),
  }));
  const failed = rows.filter((r) => r.result === "fail").length;
  const body = table(
    ["suite", "result", "time", "evidence", "error"],
    rows.map((r) => [r.suite, r.result, `${r.seconds}s`, r.evidence, r.error]),
  );
  const text = `${body}\n${rows.length - failed}/${rows.length} passed`;
  return { rows, exitCode: failed > 0 ? 1 : 0, text };
}
