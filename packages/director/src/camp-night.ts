import { type CampState, type Decision, type Tables } from "@mage/core";
import { groups, request, type ProviderRequest } from "./input.ts";
import { hash } from "./cache.ts";
import { plan } from "./planner.ts";
import { validateGroup } from "./validator.ts";
import type { HarnessOptions } from "./harness.ts";
export interface NightCheckpoint {
  state: CampState;
  caps: Tables['rules']['caps'];
  completed: { group: string; items: Decision[] }[];
  audit: CampNight['audit'];
  requests: { group: string; key: string; request: ProviderRequest }[];
}

/** Partial results survive slow groups. Closing a job seals both results and cache. */
export class CampNight {
  readonly controller = new AbortController();
  readonly completed = new Map<string, Decision[]>();
  readonly audit: {
    group: string;
    key: string;
    source: string;
    elapsedMs: number;
    rejected: number;
    error: string | null;
  }[] = [];
  readonly done: Promise<void>;
  private closed = false;
  readonly requests: NightCheckpoint['requests'];
  constructor(
    readonly tables: Tables,
    readonly state: CampState,
    readonly options: HarnessOptions,
    checkpoint?: NightCheckpoint,
  ) {
    this.requests = checkpoint?.requests ?? groups(state).map(({ group, members }) => { const req = request(tables, state, group, members, options.provider.model, options.provider.options); return { group, key: hash(req), request: req }; });
    if (checkpoint) {
      for (const { group, items } of checkpoint.completed) this.completed.set(group, structuredClone(items));
      this.audit.push(...structuredClone(checkpoint.audit));
      this.closed = true;
      this.done = Promise.resolve();
    } else this.done = this.run();
  }
  checkpoint(): NightCheckpoint {
    this.close();
    return structuredClone({ state: this.state, caps: this.tables.rules.caps, completed: [...this.completed].map(([group, items]) => ({ group, items })), audit: this.audit, requests: this.requests });
  }
  private async run() {
    for (const { group, members } of groups(this.state)) {
      if (this.closed) break;
      const req = request(
        this.tables,
        this.state,
        group,
        members,
        this.options.provider.model,
        this.options.provider.options,
      );
      const key = hash(req);
      let raw: unknown = this.options.cache.get(req);
      let source = "cache",
        error: string | null = null,
        elapsedMs = 0;
      if (this.options.provider.id === "planner") {
        raw = {
          group,
          decisions: members.map((id) => plan(this.tables, this.state, id)),
        };
        source = "planner";
      } else if (raw === undefined) {
        if (!this.options.guard.reserve(key)) {
          source = "budget";
          error = "budget-denied";
        } else {
          source = "live";
          try {
            const result = await this.options.provider.decide(
              req,
              this.controller.signal,
            );
            raw = result.raw;
            error = result.error;
            elapsedMs = result.elapsedMs;
          } catch (e) {
            error = e instanceof Error ? e.message : String(e);
          }
          if (this.closed) break;
          if (!error) {
            this.options.cache.put(req, raw);
            raw = this.options.cache.get(req) ?? raw;
          }
        }
      }
      if (this.closed) break;
      const result = validateGroup(
        this.tables,
        this.state,
        group,
        members,
        error ? null : raw,
      );
      this.completed.set(group, result.items);
      this.audit.push({
        group,
        key,
        source,
        error,
        elapsedMs,
        rejected: result.verdicts.filter((v) => v.rejected).length,
      });
    }
  }
  /** An act can end before inference. Grace is bounded even if transport ignores abort. */
  async finish(graceMs: number): Promise<Decision[]> {
    if (!this.closed) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        this.done,
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, graceMs);
        }),
      ]);
      if (timer) clearTimeout(timer);
      this.close();
    }
    return [...this.completed.values()].flat().map((d) => structuredClone(d));
  }
  close() {
    this.closed = true;
    this.controller.abort();
  }
}
