import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";
import type { Tables, CampState } from "@mage/core";
import { plan, type PlannerDraw } from "./planner.ts";
import config from "./config.json" with { type: "json" };
import type { ProviderRequest } from "./input.ts";

export interface ProviderResult {
  raw: unknown;
  elapsedMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  error: string | null;
  metadata: Record<string, unknown>;
}
export interface Provider {
  id: string;
  model: string;
  options: ProviderRequest["options"];
  decide(request: ProviderRequest): Promise<ProviderResult>;
}

export async function runChild(
  executable: string,
  args: string[],
  input: string,
  timeoutMs: number,
  cwd?: string,
): Promise<{
  stdout: string;
  stderr: string;
  code: number | null;
  timedOut: boolean;
}> {
  return await new Promise((resolve) => {
    const env = { ...process.env };
    // Subscription only. Do not inherit nested-session markers or API billing credentials.
    for (const key of [
      "CLAUDECODE",
      "CLAUDE_CODE_ENTRYPOINT",
      "ANTHROPIC_API_KEY",
      "ANTHROPIC_AUTH_TOKEN",
    ])
      delete env[key];
    const child = spawn(executable, args, {
      cwd,
      env,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
    });
    let stdout = "",
      stderr = "",
      timedOut = false,
      settled = false,
      bytes = 0;
    const kill = () => {
      timedOut = true;
      child.stdin.destroy();
      if (process.platform === "win32" && child.pid) {
        const killer = spawn(
          "taskkill",
          ["/PID", String(child.pid), "/T", "/F"],
          { windowsHide: true, stdio: "ignore" },
        );
        killer.unref();
      } else child.kill("SIGKILL");
    };
    const timer = setTimeout(kill, timeoutMs);
    const finish = (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, code, timedOut });
    };
    child.stdout.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > config.limits.responseBytes) kill();
      else stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < config.limits.responseBytes)
        stderr += chunk.toString();
    });
    child.on("error", (e) => {
      stderr = e.message;
      finish(null);
    });
    child.on("close", finish);
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}

export function claudeArgs(request: ProviderRequest): string[] {
  return [
    "-p",
    "--model",
    request.model,
    "--effort",
    String(request.options.effort),
    "--output-format",
    "json",
    "--json-schema",
    JSON.stringify(request.schema),
    "--system-prompt",
    request.system,
    "--safe-mode",
    "--tools",
    "",
    "--setting-sources",
    "",
    "--settings",
    "{}",
    "--strict-mcp-config",
    "--mcp-config",
    '{"mcpServers":{}}',
    "--disable-slash-commands",
    "--no-session-persistence",
    "--no-chrome",
    "--permission-mode",
    "dontAsk",
    "--permission-prompts",
    "none",
  ];
}
export class ClaudeProvider implements Provider {
  id = "claude";
  model = config.claude.model;
  options = { effort: config.claude.effort };
  constructor(
    readonly cwd: string,
    readonly executable = "claude",
    readonly timeoutMs = config.claude.timeoutMs,
    readonly runner: typeof runChild = runChild,
  ) {}
  async decide(request: ProviderRequest): Promise<ProviderResult> {
    const args = claudeArgs(request),
      start = performance.now();
    const result = await this.runner(
      this.executable,
      args,
      JSON.stringify(request.input),
      this.timeoutMs,
      this.cwd,
    );
    const elapsedMs = performance.now() - start;
    let envelope: Record<string, unknown> = {};
    try {
      envelope = JSON.parse(result.stdout) as Record<string, unknown>;
    } catch {
      /* Report malformed envelope, never parse prose as a decision. */
    }
    const usage = envelope.usage as Record<string, number> | undefined;
    const error = result.timedOut
      ? "timeout"
      : result.code !== 0
        ? "process-exit"
        : envelope.is_error
          ? "provider-error"
          : !envelope.structured_output
            ? "missing-structured-output"
            : null;
    const modelUsage = envelope.modelUsage as
      Record<string, unknown> | undefined;
    const actualModels = Object.keys(modelUsage ?? {});
    const mismatch =
      actualModels.length &&
      actualModels.some((m) => !m.startsWith(config.claude.model));
    return {
      raw: envelope.structured_output ?? null,
      elapsedMs,
      inputTokens: usage
        ? (usage.input_tokens ?? 0) +
          (usage.cache_creation_input_tokens ?? 0) +
          (usage.cache_read_input_tokens ?? 0)
        : null,
      outputTokens: usage?.output_tokens ?? null,
      costUsd:
        typeof envelope.total_cost_usd === "number"
          ? envelope.total_cost_usd
          : null,
      error: error ?? (mismatch ? "wrong-model" : null),
      metadata: {
        argv: [this.executable, ...args],
        code: result.code,
        stderr: result.stderr,
        actualModels,
        usage: usage ?? null,
        subtype: envelope.subtype ?? null,
        result: envelope.result ?? null,
      },
    };
  }
}

export class OllamaProvider implements Provider {
  id = "ollama";
  options = {
    temperature: config.ollama.temperature,
    num_predict: config.ollama.numPredict,
    num_ctx: config.ollama.numCtx,
    think: false,
  };
  constructor(
    readonly model: string = config.ollama.model,
    readonly endpoint: string = config.ollama.endpoint,
    readonly timeoutMs = config.ollama.timeoutMs,
  ) {}
  async decide(request: ProviderRequest): Promise<ProviderResult> {
    const start = performance.now();
    try {
      const { think, ...options } = request.options;
      const response = await fetch(`${this.endpoint}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(this.timeoutMs),
        body: JSON.stringify({
          model: request.model,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: JSON.stringify(request.input) },
          ],
          format: request.schema,
          stream: false,
          think,
          options,
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.text();
      if (Buffer.byteLength(body) > config.limits.responseBytes)
        throw new Error("response-too-large");
      const result = JSON.parse(body) as {
        message?: { content: string };
        prompt_eval_count?: number;
        eval_count?: number;
        done?: boolean;
        done_reason?: string;
        model?: string;
      };
      return {
        raw: result.message?.content ?? null,
        elapsedMs: performance.now() - start,
        inputTokens: result.prompt_eval_count ?? null,
        outputTokens: result.eval_count ?? null,
        costUsd: null,
        error:
          result.done &&
          result.message?.content &&
          result.done_reason !== "length"
            ? null
            : "incomplete-output",
        metadata: {
          model: result.model ?? null,
          doneReason: result.done_reason ?? null,
        },
      };
    } catch (e) {
      return {
        raw: null,
        elapsedMs: performance.now() - start,
        inputTokens: null,
        outputTokens: null,
        costUsd: null,
        error: e instanceof Error ? e.message : String(e),
        metadata: {},
      };
    }
  }
}

export class PlannerProvider implements Provider {
  id = "planner";
  model = "offline";
  options = {};
  constructor(
    readonly tables: Tables,
    readonly state: () => CampState,
  ) {}
  async decide(request: ProviderRequest): Promise<ProviderResult> {
    const draws: PlannerDraw[] = [];
    const state = this.state();
    return {
      raw: {
        group: request.input.group,
        decisions: request.input.members.map((member) =>
          plan(this.tables, state, member.id, false, draws),
        ),
      },
      elapsedMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      error: null,
      metadata: { offline: true, plannerDraws: draws },
    };
  }
}
