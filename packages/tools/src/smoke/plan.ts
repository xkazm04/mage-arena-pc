// Turns `smoke run <ids|all>` into steps: one game build, the suites in request order, retired
// suites refused with their reason, paid suites refused unless asked for, and parallel batches in
// which no two suites claim the same --strictPort.
import { REGISTRY, SUITE_DIR, type SuiteEntry } from "./registry.ts";

export const BUILD_STEP = "build:game";

export interface PlanOptions {
  allowPaid?: boolean;
  /** Suites per batch; 1 (serial) by default. */
  parallel?: number;
}

export interface Refusal {
  id: string;
  status: "retired";
  reason: string;
}

export interface Plan {
  /** `build:game` (at most once, first) then suite ids. */
  steps: string[];
  suites: SuiteEntry[];
  refused: Refusal[];
  /** Suite ids grouped into concurrent batches; batches run one after another. */
  batches: string[][];
}

export function plan(request: readonly string[], opts: PlanOptions = {}, registry: readonly SuiteEntry[] = REGISTRY): Plan {
  const picked: SuiteEntry[] = [];
  for (const id of request) {
    if (id === "all") {
      picked.push(...registry.filter((e) => !e.paid));
      continue;
    }
    const e = registry.find((x) => x.id === id);
    if (!e) throw new Error(`unknown suite '${id}'; known: ${registry.map((x) => x.id).join(", ")}`);
    if (e.paid && !opts.allowPaid) {
      const env = Object.entries(e.env ?? {}).map(([k, v]) => `${k}=${v}`).join(" ");
      throw new Error(`'${id}' is a paid suite (${env} makes live provider calls); pass --allow-paid to run it`);
    }
    picked.push(e);
  }
  const unique = picked.filter((e, i) => picked.indexOf(e) === i);
  const suites = unique.filter((e) => e.status === "live");
  const refused = unique
    .filter((e) => e.status === "retired")
    .map((e): Refusal => ({ id: e.id, status: "retired", reason: e.reason ?? "retired" }));
  const steps = [...(suites.some((e) => e.needsBuild) ? [BUILD_STEP] : []), ...suites.map((e) => e.id)];
  return { steps, suites, refused, batches: batch(suites, Math.max(1, Math.floor(opts.parallel ?? 1))) };
}

/** Greedy in request order: a suite joins the current batch while it has room and none of its port. */
function batch(suites: readonly SuiteEntry[], width: number): string[][] {
  const out: SuiteEntry[][] = [];
  for (const s of suites) {
    const last = out.at(-1);
    const fits = last && last.length < width && (s.port === null || !last.some((x) => x.port === s.port));
    if (fits) last.push(s);
    else out.push([s]);
  }
  return out.map((b) => b.map((s) => s.id));
}

/** How the CLI spawns one suite: `node --import tsx <file>` with the registry env on top. */
export function commandFor(e: SuiteEntry): { args: string[]; env: Record<string, string> } {
  return { args: ["--import", "tsx", `${SUITE_DIR}/${e.file}`], env: { ...e.env } };
}
