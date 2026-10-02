import {
  decision,
  legalProblem,
  safeFallback,
  seededUnit,
  type CampState,
  type Tables,
  type Decision,
  type Intent,
} from "@mage/core";
import config from "./config.json" with { type: "json" };

export interface PlannerDraw {
  seed: number;
  day: number;
  actor: string;
  action: string;
  unit: number;
  score: number;
}

export function candidates(
  t: Tables,
  state: CampState,
  id: string,
): Decision[] {
  const c = state.characters[id],
    result: Decision[] = [];
  const put = (intent: Intent, args: Record<string, string> = {}) => {
    const d = decision(t, state, id, intent, args);
    if (!legalProblem(t, state, d)) result.push(d);
  };
  for (const verb of ["REST", "WORK", "PLOT"] as const) put(verb);
  for (const stat of t.rules.stats.names) put("TRAIN", { stat });
  for (const other of Object.values(state.characters))
    if (other.id !== id && other.life === "Alive") {
      const target = other.id;
      for (const intent of [
        "BEFRIEND",
        "PROTECT",
        "WATCH",
        "RECRUIT",
        "REPORT",
      ] as const)
        put(intent, { target });
      for (const factId of c.knowledge.slice(
        -config.limits.promptFactsPerMember,
      ))
        if (!other.knowledge.includes(factId))
          put("CONFIDE", { target, factId });
      for (const kind of Object.keys(t.rules.schemes)) {
        if (kind === "rumour")
          for (const topic of Object.keys(t.rules.schemes.rumour.reactions))
            put("SCHEME", { target, kind, topic });
        else put("SCHEME", { target, kind });
      }
      if (c.id === "venno") put("OFFER", { target, terms: "back_entrant" });
    }
  for (const s of t.schools) put("DEFECT", { toTent: s.tent });
  return result;
}

export function plan(
  t: Tables,
  state: CampState,
  id: string,
  excludeCapped = false,
  draws?: PlannerDraw[],
  include?: (d: Decision) => boolean,
): Decision {
  const c = state.characters[id],
    p = config.planner;
  const school = t.schools.find((s) => s.id === c.school);
  const choices = candidates(t, state, id).filter(
    (d) =>
      (!excludeCapped || !Object.hasOwn(t.rules.caps, d.intent)) &&
      (!include || include(d)),
  );
  const goals: Record<string, string[]> = p.goalIntents;
  const scored = choices.map((d) => {
    const other = state.characters[d.args.target];
    let score = p.base;
    if (goals[c.goal.id]?.includes(d.intent)) score += p.goalBonus;
    if (d.intent === "REST" && c.fatigue >= p.restFatigueAt)
      score += p.needBonus;
    if (
      d.intent === "WORK" &&
      (c.gold < p.workGoldBelow || c.hunger >= t.rules.effects.daily.hungryAt)
    )
      score += p.needBonus;
    if (
      d.intent === "PROTECT" &&
      other &&
      c.traits.warmth >= p.protectWarmthAt &&
      other.hunger >= p.protectHungerAt
    )
      score += p.needBonus;
    if (
      d.intent === "BEFRIEND" ||
      d.intent === "PROTECT" ||
      d.intent === "CONFIDE"
    )
      score +=
        (state.trust[`${id}>${d.args.target}`] ?? 0) * p.relationshipScale;
    if (d.intent === "SCHEME")
      score -=
        (state.trust[`${id}>${d.args.target}`] ?? 0) * p.relationshipScale;
    if (c.goal.target && d.args.target === c.goal.target) score += p.goalBonus;
    if (
      d.intent === "BEFRIEND" &&
      other?.role === "elder" &&
      c.goal.id === "rise_in_tent" &&
      other.tent === c.tent
    )
      score += p.goalBonus;
    if (d.intent === "RECRUIT" && other?.tent === "strays")
      score += p.goalBonus;
    const specific = `${d.intent}:${d.args.kind ?? d.args.stat ?? ""}`;
    score *=
      school?.weights[specific] ??
      school?.weights[d.intent] ??
      school?.weights[`${d.intent}:*`] ??
      p.base;
    const action = `planner:${d.intent}:${JSON.stringify(d.args)}`,
      unit = seededUnit(state.seed, state.day, id, action);
    score += (unit * 2 - 1) * p.noiseAmplitude;
    draws?.push({
      seed: state.seed,
      day: state.day,
      actor: id,
      action,
      unit,
      score,
    });
    return { d, score };
  });
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      JSON.stringify(a.d).localeCompare(JSON.stringify(b.d)),
  );
  return scored[0]?.d ?? safeFallback(t, state, id);
}
