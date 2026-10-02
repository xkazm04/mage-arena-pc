import {
  reconcile,
  resolve,
  type Tables,
  type CampState,
  type Decision,
  type Verdict,
} from "@mage/core";
import { groups, request } from "./input.ts";
import { RequestCache, hash } from "./cache.ts";
import { CostGuard } from "./budget.ts";
import { plan, type PlannerDraw } from "./planner.ts";
import { validateGroup } from "./validator.ts";
import type { Provider, ProviderResult } from "./providers.ts";

export interface HarnessOptions {
  provider: Provider;
  cache: RequestCache;
  guard: CostGuard;
  concurrent?: boolean;
  forceLive?: boolean;
}
export async function night(
  t: Tables,
  state: CampState,
  options: HarnessOptions,
) {
  const calls = async ({
    group,
    members,
  }: {
    group: string;
    members: string[];
  }) => {
    const req = request(
        t,
        state,
        group,
        members,
        options.provider.model,
        options.provider.options,
      ),
      key = hash(req);
    let source: "live" | "cache" | "planner" | "budget" = "live";
    const plannerDraws: PlannerDraw[] = [];
    let result: ProviderResult = {
      raw: null,
      elapsedMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: null,
      error: null,
      metadata: {},
    };
    const cached = options.forceLive ? undefined : options.cache.get(req);
    if (options.provider.id === "planner") {
      source = "planner";
      result = await options.provider.decide(req);
      plannerDraws.push(
        ...((result.metadata.plannerDraws as PlannerDraw[]) ?? []),
      );
    } else if (cached !== undefined) {
      source = "cache";
      result.raw = cached;
    } else if (!options.guard.reserve(key)) {
      source = "budget";
      result.error = "budget-denied";
    } else {
      try {
        result = await options.provider.decide(req);
      } catch (e) {
        result.error = e instanceof Error ? e.message : String(e);
      }
      if (!result.error && !options.forceLive) {
        const freshRaw = result.raw;
        options.cache.put(req, freshRaw);
        const pinned = options.cache.get(req);
        if (pinned !== undefined) {
          result.raw = pinned;
          if (hash(pinned) !== hash(freshRaw))
            result.metadata.uncachedRaw = freshRaw;
        }
      }
    }
    const validated = validateGroup(
      t,
      state,
      group,
      members,
      result.error ? null : result.raw,
      plannerDraws,
    );
    return {
      group,
      members,
      key,
      request: req,
      source,
      plannerDraws,
      ...result,
      ...validated,
    };
  };
  const requests = groups(state);
  const results = options.concurrent
    ? await Promise.all(requests.map(calls))
    : await (async () => {
        const rows = [];
        for (const group of requests) rows.push(await calls(group));
        return rows;
      })();
  const proposed: Decision[] = results.flatMap((r) => r.items),
    firstVerdicts = results.flatMap((r) => r.verdicts);
  const capPlannerDraws: PlannerDraw[] = [];
  const accepted = reconcile(t, state, proposed, (id) =>
    plan(t, state, id, true, capPlannerDraws),
  );
  const verdicts: Verdict[] = accepted.verdicts.map((v) =>
    v.rejected
      ? v
      : firstVerdicts.find((old) => old.character === v.character)!,
  );
  const resolution = resolve(t, state, accepted.items);
  return {
    beforeHash: hash(state),
    afterHash: hash(resolution.state),
    day: state.day,
    seed: state.seed,
    groups: results,
    items: accepted.items,
    verdicts,
    capPlannerDraws,
    ...resolution,
  };
}
