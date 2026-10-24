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
import { resolveCall } from "./call.ts";
import type { Provider } from "./providers.ts";

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
    // Raw policy: W1 experiments and tools/cache-replay read back exactly what the provider said.
    const call = await resolveCall({
      request: req,
      key,
      provider: options.provider,
      cache: options.cache,
      guard: options.guard,
      forceLive: options.forceLive,
      cachePolicy: "raw",
    });
    const source = call.source as "live" | "cache" | "planner" | "budget",
      plannerDraws = call.plannerDraws,
      result = call.result;
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
