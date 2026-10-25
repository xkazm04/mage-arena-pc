// npm run smoke -- list | status | run <ids|all> [--allow-paid] [--parallel N]
// The operator's one surface over the browser suites: what exists, what passes now, and a run
// that builds the game once, refuses retired and paid suites, and ends in one table + exit code.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { REGISTRY, type SuiteEntry } from "./registry.ts";
import { BUILD_STEP, commandFor, plan } from "./plan.ts";
import { LAST_RUN, status, summarize, table, type RunResult } from "./status.ts";

const usage = "usage: npm run smoke -- list | status | run <ids|all> [--allow-paid] [--parallel N]";

function list(): string {
  return table(
    ["id", "status", "kind", "port", "aliases", "notes"],
    REGISTRY.map((e) => [
      e.id,
      e.paid ? `${e.status}, paid` : e.status,
      e.kind,
      e.port === null ? "-" : String(e.port),
      e.aliases.join(" ") || "-",
      e.reason ?? [e.summary, ...(e.flags ?? [])].join("; "),
    ]),
  );
}

function statusTable(): string {
  return table(
    ["id", "state", "at", "error"],
    REGISTRY.map((e) => {
      const s = status(e);
      const at = "at" in s ? s.at.toISOString().slice(0, 16).replace("T", " ") : "-";
      return [e.id, e.status === "retired" ? `${s.state} (retired)` : s.state, at, "error" in s ? s.error : ""];
    }),
  );
}

function child(cmd: string, args: string[], env: Record<string, string>, tag: string, shell = false): Promise<RunResult> {
  const started = performance.now();
  return new Promise((done) => {
    let tail = "";
    const p = spawn(cmd, args, { env: { ...process.env, ...env }, shell, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    const relay = (out: NodeJS.WriteStream) => (chunk: Buffer) => {
      const text = chunk.toString();
      tail = (tail + text).slice(-4000);
      out.write(text.replace(/^(?=.)/gm, `[${tag}] `));
    };
    p.stdout.on("data", relay(process.stdout));
    p.stderr.on("data", relay(process.stderr));
    const finish = (code: number | null, error?: string) => {
      const ms = performance.now() - started;
      const lines = tail.split("\n").map((l) => l.trim()).filter(Boolean);
      const last = lines.findLast((l) => /Error|assert/i.test(l)) ?? lines.at(-1) ?? `exit ${code}`;
      done(code === 0 ? { suite: tag, ok: true, ms } : { suite: tag, ok: false, ms, error: error ?? last });
    };
    p.on("error", (e) => finish(null, String(e)));
    p.on("close", (code) => finish(code));
  });
}

async function run(ids: string[], allowPaid: boolean, parallel: number): Promise<number> {
  const p = plan(ids, { allowPaid, parallel });
  for (const r of p.refused) console.log(`skip ${r.id}: ${r.status} - ${r.reason}`);
  if (p.suites.length === 0) {
    console.log("nothing to run");
    return p.refused.length > 0 ? 1 : 0;
  }
  console.log(`plan: ${p.steps.join(" -> ")}${parallel > 1 ? ` (batches: ${p.batches.map((b) => b.join("+")).join(" | ")})` : ""}`);
  const results: RunResult[] = [];
  if (p.steps[0] === BUILD_STEP) {
    const build = await child("npm", ["run", BUILD_STEP], {}, BUILD_STEP, process.platform === "win32");
    if (!build.ok) {
      console.log(summarize([build]).text);
      return 1;
    }
  }
  const byId = new Map<string, SuiteEntry>(p.suites.map((s) => [s.id, s]));
  for (const b of p.batches) {
    results.push(
      ...(await Promise.all(
        b.map((id) => {
          const c = commandFor(byId.get(id)!);
          return child(process.execPath, c.args, c.env, id);
        }),
      )),
    );
  }
  const s = summarize(results);
  console.log(`\n${s.text}`);
  mkdirSync(dirname(LAST_RUN), { recursive: true });
  writeFileSync(LAST_RUN, JSON.stringify({ at: new Date().toISOString(), steps: p.steps, refused: p.refused, rows: s.rows, exitCode: s.exitCode }, null, 2) + "\n");
  console.log(`last run: ${LAST_RUN}`);
  return s.exitCode;
}

async function main(argv: string[]): Promise<number> {
  const [verb, ...rest] = argv;
  if (verb === "list") return console.log(list()), 0;
  if (verb === "status") return console.log(statusTable()), 0;
  if (verb !== "run") return console.error(usage), 2;
  const allowPaid = rest.includes("--allow-paid");
  const at = rest.indexOf("--parallel");
  const parallel = at >= 0 ? Number(rest[at + 1]) : 1;
  if (!Number.isInteger(parallel) || parallel < 1) return console.error(`--parallel needs a positive integer\n${usage}`), 2;
  const ids = rest.filter((a, i) => !a.startsWith("--") && !(at >= 0 && i === at + 1));
  if (ids.length === 0) return console.error(usage), 2;
  try {
    return await run(ids, allowPaid, parallel);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    return 2;
  }
}

process.exitCode = await main(process.argv.slice(2));
