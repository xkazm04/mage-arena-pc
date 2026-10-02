import { Ajv } from "ajv";
import {
  legalProblem,
  lineProblem,
  type Tables,
  type CampState,
  type Decision,
  type Verdict,
} from "@mage/core";
import { plan, type PlannerDraw } from "./planner.ts";
import { itemSchema } from "./schema.ts";

const ajv = new Ajv({ allErrors: true, strict: true });
const validators = new WeakMap<Tables, ReturnType<typeof ajv.compile>>();
export function parseOutput(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}
function record(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

export function validateGroup(
  t: Tables,
  state: CampState,
  group: string,
  members: string[],
  raw: unknown,
  draws?: PlannerDraw[],
) {
  const parsed = parseOutput(raw);
  const envelopeOK =
    record(parsed) &&
    parsed.group === group &&
    Array.isArray(parsed.decisions) &&
    Object.keys(parsed).every((k) => ["group", "decisions"].includes(k));
  const incoming: unknown[] = envelopeOK ? (parsed.decisions as unknown[]) : [];
  const validator = validators.get(t) ?? ajv.compile(itemSchema(t));
  validators.set(t, validator);
  const verdicts: Verdict[] = [],
    items: Decision[] = [];
  const foreignItems = incoming.filter(
    (x) => !record(x) || !members.includes(String(x.character)),
  ).length;
  for (const id of members) {
    const matches = incoming.filter((x) => record(x) && x.character === id);
    const candidate = matches[0];
    let reason: string | null = !envelopeOK
      ? "envelope"
      : matches.length !== 1
        ? matches.length
          ? "duplicate"
          : "missing"
        : !validator(candidate)
          ? "schema"
          : null;
    if (!reason) reason = legalProblem(t, state, candidate as Decision);
    let item = reason
      ? plan(t, state, id, false, draws)
      : structuredClone(candidate as Decision);
    const lineReplaced = lineProblem(t, item.line);
    if (lineReplaced) item = { ...item, line: t.phrases[item.intent] };
    if (legalProblem(t, state, item))
      throw new Error(`Invalid planner item for ${id}`);
    items.push(item);
    verdicts.push({
      character: id,
      rejected: Boolean(reason),
      reason,
      lineReplaced,
    });
  }
  return { items, verdicts, foreignItems };
}
