import type { CampState, Tables } from "@mage/core";
import { hash, type RequestCache } from "./cache.ts";
import type { CostGuard } from "./budget.ts";
import { plan, type PlannerDraw } from "./planner.ts";
import type { ProviderResult } from "./providers.ts";

/** Where one Director answer came from. */
export type CallSource = "planner" | "cache" | "budget" | "live" | "aborted";
/**
 * What a live answer may write to the cache.
 * - "raw": the provider output, before validation (harness and camp nights: replays stay
 *   byte-identical and validation re-runs on every read).
 * - "validated": only the record `validate` returns; an invalid reply is never cached (parley).
 */
export type CachePolicy = "raw" | "validated";
export interface CallProvider<Req> {
  id: string;
  decide(request: Req, signal?: AbortSignal): Promise<ProviderResult>;
}
export type CallOptions<Req> = {
  request: Req;
  key: string;
  provider: CallProvider<Req>;
  cache: Pick<RequestCache, "get" | "put">;
  guard: Pick<CostGuard, "reserve">;
  signal?: AbortSignal;
  /** Skip the cache entirely: no read, no write. */
  forceLive?: boolean;
  /** Planner provider only: plan from the caller's own tables and state instead of asking it. */
  planner?: { tables: Tables; state: CampState; group: string; members: string[] };
} & (
  | { cachePolicy: "raw" }
  | { cachePolicy: "validated"; validate: (raw: unknown) => unknown }
);
export interface CallResult {
  source: CallSource;
  result: ProviderResult;
  plannerDraws: PlannerDraw[];
}

const empty = (): ProviderResult => ({
  raw: null,
  elapsedMs: 0,
  inputTokens: 0,
  outputTokens: 0,
  costUsd: null,
  error: null,
  metadata: {},
});

/** One source resolution for every Director call: planner, cache, budget, live, abort. */
export async function resolveCall<Req>(
  options: CallOptions<Req>,
): Promise<CallResult> {
  const { request, provider, cache } = options;
  if (provider.id === "planner") {
    if (options.planner) {
      const { tables, state, group, members } = options.planner,
        draws: PlannerDraw[] = [];
      const raw = {
        group,
        decisions: members.map((id) => plan(tables, state, id, false, draws)),
      };
      return {
        source: "planner",
        result: { ...empty(), costUsd: 0, raw, metadata: { offline: true, plannerDraws: draws } },
        plannerDraws: draws,
      };
    }
    const result = await provider.decide(request);
    return {
      source: "planner",
      result,
      plannerDraws: [...((result.metadata.plannerDraws as PlannerDraw[]) ?? [])],
    };
  }
  const cached = options.forceLive ? undefined : cache.get(request);
  if (cached !== undefined)
    return { source: "cache", result: { ...empty(), raw: cached }, plannerDraws: [] };
  if (!options.guard.reserve(options.key))
    return {
      source: "budget",
      result: { ...empty(), error: "budget-denied" },
      plannerDraws: [],
    };
  let result = empty();
  try {
    result = await provider.decide(request, options.signal);
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
  }
  // A late answer after abort is never cached; the caller decides whether to use it.
  if (options.signal?.aborted) return { source: "aborted", result, plannerDraws: [] };
  if (!result.error && !options.forceLive) {
    const record =
      options.cachePolicy === "raw" ? result.raw : options.validate(result.raw);
    if (record !== undefined) {
      cache.put(request, record);
      const pinned = cache.get(request);
      if (pinned !== undefined) {
        result.raw = pinned;
        if (hash(pinned) !== hash(record)) result.metadata.uncachedRaw = record;
      } else if (options.cachePolicy === "validated") result.raw = record;
    }
  }
  return { source: "live", result, plannerDraws: [] };
}
