import { spawn } from "node:child_process";
import {
  openSync,
  closeSync,
  readFileSync,
  existsSync,
  writeFileSync,
  appendFileSync,
  unlinkSync,
  renameSync,
} from "node:fs";
import { createHash } from "node:crypto";
import process from "node:process";
import { setInterval, clearInterval } from "node:timers";
import config from "../director/src/config.json" with { type: "json" };

const runtime = ".director-runtime/",
  root = "docs/waves/W1-evidence/";
const lock = runtime + "w1b.lock";
if (existsSync(lock)) {
  const pid = Number(readFileSync(lock, "utf8"));
  let alive = false;
  try {
    process.kill(pid, 0);
    alive = true;
  } catch {
    /* stale lock: the prior supervisor exited */
  }
  if (alive) throw new Error(`W1b already running as ${pid}`);
  unlinkSync(lock);
}
const fd = openSync(lock, "wx");
writeFileSync(fd, String(process.pid));
closeSync(fd);
const record = (event) =>
  appendFileSync(
    root + "w1b-process.jsonl",
    JSON.stringify({ at: new Date().toISOString(), ...event }) + "\n",
  );
const progress = (stage, completed, target) => {
  writeFileSync(
    runtime + "w1b-progress.json.tmp",
    JSON.stringify({
      pid: process.pid,
      stage,
      completed,
      target,
      at: new Date().toISOString(),
    }),
  );
  renameSync(runtime + "w1b-progress.json.tmp", runtime + "w1b-progress.json");
};
const count = (path) =>
  existsSync(path)
    ? readFileSync(path, "utf8").trim().split("\n").filter(Boolean).length
    : 0;
const run = async (args) => {
  record({ event: "chunk-start", args });
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", ...args], {
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", resolve);
  });
  record({ event: "chunk-end", code });
  if (code !== 0) throw new Error(`Child exited ${code}`);
};
let heartbeat = Date.now();
const timer = setInterval(() => {
  const now = Date.now();
  if (
    now - heartbeat >
    config.completion.heartbeatMs * config.completion.gapMultiplier
  )
    record({
      event: "wall-clock-gap",
      elapsedMs: now - heartbeat,
      expectedMs: config.completion.heartbeatMs,
    });
  heartbeat = now;
}, config.completion.heartbeatMs);
try {
  const ledger = JSON.parse(readFileSync(runtime + "cost-ledger.json", "utf8"));
  if (
    ledger.runs["claude:W1-sonnet-total"] !==
    config.budget.w1.sonnetNights * config.groups.length
  )
    throw new Error("Unexpected subscription ledger");
  const initial = readFileSync(root + "local-soak/nights.jsonl");
  record({
    event: "start",
    pid: process.pid,
    preservedRows: count(root + "local-soak/nights.jsonl"),
    preservedBytes: initial.length,
    preservedSha256: createHash("sha256").update(initial).digest("hex"),
  });
  while (
    count(root + "local-soak/nights.jsonl") < config.budget.w1.localNights
  ) {
    progress(
      "soak",
      count(root + "local-soak/nights.jsonl"),
      config.budget.w1.localNights,
    );
    await run([
      "packages/tools/src/soak.ts",
      "--provider",
      "ollama",
      "--run",
      "local-soak",
      "--nights",
      String(config.budget.w1.localNights),
      "--chunk",
      String(config.completion.chunkNights),
      "--w1-experiment",
    ]);
  }
  for (const [name, target] of [
    ["sonnet", config.budget.w1.sonnetNights],
    ["local-soak", config.budget.w1.localNights],
  ]) {
    while (count(root + name + "/judge.jsonl") < target) {
      progress("judge-" + name, count(root + name + "/judge.jsonl"), target);
      await run([
        "packages/tools/src/judge.ts",
        name,
        "--chunk",
        String(config.completion.chunkNights),
      ]);
    }
  }
  const total = config.budget.w1.sonnetNights + config.budget.w1.localNights;
  progress("complete", total, total);
  record({ event: "complete" });
} catch (error) {
  record({ event: "error", error: String(error) });
  progress("stopped", 0, 0);
  process.exitCode = 1;
} finally {
  clearInterval(timer);
  unlinkSync(lock);
}
