// One `vite preview` lifecycle for the browser suites: an OS-assigned port (so any set of suites can
// run side by side), readiness that fails fast with the server log when the child dies or the budget
// runs out, and one teardown. Suites used to hand-pick a --strictPort and poll 100 x 100 ms.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

const HOST = "127.0.0.1";
const handedOut = new Set<number>();

/** A port the OS just assigned on 127.0.0.1, never one this process already handed out. */
export async function freePort(): Promise<number> {
  for (;;) {
    const port = await new Promise<number>((done, fail) => {
      const s = createServer();
      s.once("error", fail);
      s.listen(0, HOST, () => {
        const address = s.address();
        s.close(() => (typeof address === "object" && address ? done(address.port) : fail(Error("no port"))));
      });
    });
    if (!handedOut.has(port)) {
      handedOut.add(port);
      return port;
    }
  }
}

export interface ReadyProbe {
  /** The child's exit code, or null while it runs. */
  exited: () => number | null;
  log: string | (() => string);
  budgetMs?: number;
  intervalMs?: number;
}

/** Resolves when `url` answers ok; rejects with the server log once the child exits or the budget runs out. */
export async function waitReady(url: string, probe: ReadyProbe): Promise<void> {
  const { budgetMs = 10000, intervalMs = 100 } = probe;
  const log = () => (typeof probe.log === "function" ? probe.log() : probe.log);
  const deadline = Date.now() + budgetMs;
  for (;;) {
    const code = probe.exited();
    if (code !== null) throw Error(`vite preview exited (${code}) before ${url} was ready:\n${log()}`);
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* starting */
    }
    if (Date.now() >= deadline) throw Error(`${url} not ready after ${budgetMs} ms:\n${log()}`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

/** `node <args>` for a strictPort preview of the built game. */
export const previewArgs = (port: number) => [
  "--import",
  "tsx",
  "node_modules/vite/bin/vite.js",
  "preview",
  "--config",
  "packages/game/vite.config.ts",
  "--host",
  HOST,
  "--port",
  String(port),
  "--strictPort",
];

export interface Preview {
  port: number;
  base: string;
  log(): string;
  close(): void;
}

export interface PreviewOptions {
  /** Prefix of the throwaway save directory under the OS temp dir. */
  savePrefix: string;
  /** Extra env on top of the offline Director and the throwaway save directory. */
  env?: Record<string, string>;
  budgetMs?: number;
}

/** Starts the built game's preview on a free port and waits for /api/health. */
export async function startPreview(opts: PreviewOptions): Promise<Preview> {
  const port = await freePort();
  const child = spawn(process.execPath, previewArgs(port), {
    windowsHide: true,
    stdio: "pipe",
    env: {
      ...process.env,
      CAMP_DIRECTOR: "offline",
      MAGE_SAVE_DIRECTORY: mkdtempSync(join(tmpdir(), opts.savePrefix)),
      ...opts.env,
    },
  });
  let log = "";
  child.stdout.on("data", (b) => (log += String(b)));
  child.stderr.on("data", (b) => (log += String(b)));
  const base = `http://${HOST}:${port}`;
  const preview: Preview = { port, base, log: () => log, close: () => void child.kill() };
  try {
    await waitReady(`${base}/api/health`, { exited: () => child.exitCode, log: () => log, budgetMs: opts.budgetMs });
  } catch (error) {
    preview.close();
    throw error;
  }
  return preview;
}
