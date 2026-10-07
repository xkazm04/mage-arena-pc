import { historicalSystemPrompt } from "./historical-prompt.ts";
import {
  reconcile,
  resolve,
  type CampState,
  type Tables,
  type Verdict,
} from "@mage/core";
import {
  hash,
  plan,
  request,
  groups,
  validateGroup,
  type PlannerDraw,
} from "@mage/director";
import type { NightEvidence } from "./evidence.ts";

export function auditNight(t: Tables, state: CampState, row: NightEvidence) {
  if (hash(state) !== row.beforeHash) throw new Error("Before hash mismatch");
  if (
    hash(groups(state)) !==
    hash(row.groups.map((g) => ({ group: g.group, members: g.members })))
  )
    throw new Error("Group membership mismatch");
  const draws: PlannerDraw[] = [],
    first: Verdict[] = [];
  const accepted = row.groups.flatMap((g) => {
    const actual = request(
      t,
      state,
      g.group,
      g.members,
      row.model,
      g.request.options,
    );
    // Frozen W1 evidence predates hour facts. Verify its complete original
    // envelope using the pinned prompt, while current requests keep their time facts.
    const historical = !Object.hasOwn(g.request.input, "time");
    const { time: _time, ...oldInput } = actual.input;
    const comparable = historical ? { ...actual, system: historicalSystemPrompt, input: oldInput } : actual;
    if (hash(comparable) !== g.key || hash(g.request) !== g.key)
      throw new Error("Provider request mismatch");
    const valid = validateGroup(
      t,
      state,
      g.group,
      g.members,
      g.error ? null : g.raw,
      draws,
    );
    first.push(...valid.verdicts);
    if (hash(valid.verdicts) !== hash(g.verdicts))
      throw new Error("Group verdict mismatch");
    return valid.items;
  });
  const capped = reconcile(t, state, accepted, (id) =>
    plan(t, state, id, true, draws),
  );
  const verdicts = capped.verdicts.map((v) =>
    v.rejected ? v : first.find((f) => f.character === v.character)!,
  );
  if (hash(verdicts) !== hash(row.verdicts))
    throw new Error("Rejection census mismatch");
  if (hash(capped.items) !== hash(row.items))
    throw new Error("Accepted items mismatch");
  const result = resolve(t, state, capped.items);
  if (hash(result.state) !== row.afterHash || hash(row.state) !== row.afterHash)
    throw new Error("State replay mismatch");
  return { result, draws };
}
