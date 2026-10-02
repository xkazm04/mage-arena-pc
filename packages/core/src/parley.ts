import data from "../../../docs/design/reconciled/data/parley.json" with { type: "json" };
import { legalProblem, decision, lineProblem, seededUnit } from "./camp.ts";
import {
  campPlay,
  passSlot,
  present,
  type CampSession,
} from "./camp-session.ts";
import type { Fact, Roll, Tables, Trace } from "./types.ts";

export const parleyRules = data;
export function seedParleyFacts(before: CampSession): CampSession {
  const s = structuredClone(before);
  for (const { holders, ...fact } of data.facts) {
    if (!s.camp.facts.some((f) => f.id === fact.id)) s.camp.facts.push(fact);
    for (const id of holders)
      if (!s.camp.characters[id].knowledge.includes(fact.id))
        s.camp.characters[id].knowledge.push(fact.id);
  }
  return s;
}
export type ParleyStance =
  "intimidate" | "appeal" | "bargain" | "reveal" | "deceive";
export type ParleyEffect =
  | "shift_trust_small"
  | "shift_trust_large"
  | "flip_next_intent"
  | "reveal_fact"
  | "refuse";
export interface ParleyProposal {
  stance: ParleyStance;
  citedKnowings: string[];
  effect: ParleyEffect;
  npcReply: string;
}
export interface ParleyRecord {
  day: number;
  target: string;
  stance: ParleyStance;
  proposed: ParleyEffect;
  effect: ParleyEffect;
  citedKnowings: string[];
  reply: string;
  reason: string | null;
  trustDelta: number;
  revealedFact: string | null;
  roll: Roll | null;
  trace: Trace[];
}
export function parleyProblem(
  t: Tables,
  s: CampSession,
  target: string,
): string | null {
  if (s.camp.ended || s.listening || s.nightFinished)
    return "This moment has passed.";
  const player = s.camp.characters[s.camp.player],
    npc = s.camp.characters[target];
  if (
    player.life !== "Alive" ||
    player.stocks ||
    !npc ||
    npc.life !== "Alive" ||
    npc.stocks ||
    target === player.id
  )
    return "They cannot speak with you now.";
  if (
    !t.locations.find((p) => p.id === s.location)?.open.includes(s.slot) ||
    !present(s).includes(target)
  )
    return "They are not here.";
  if (s.budget < campPlay.actionCost) return "There is no time to speak.";
  if (s.parleys.filter((p) => p.day === s.camp.day).length >= data.perDay)
    return "You have already made your appeal today.";
  if (!knowingsAbout(s, target).length)
    return "You hold no Knowing about them.";
  return null;
}
export function knowingsAbout(s: CampSession, target: string): Fact[] {
  return s.camp.facts
    .filter(
      (f) =>
        f.type === "knowing" &&
        f.target === target &&
        f.truth === true &&
        s.camp.characters[s.camp.player].knowledge.includes(f.id),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
}
export function parleyCards(s: CampSession, target: string) {
  const known = knowingsAbout(s, target);
  if (!known.length) return [];
  return data.cards.map((card, i) => ({
    id: card.id,
    title: card.title,
    knowingId: known[i % known.length].id,
    knowing: known[i % known.length].text,
    text: card.text.replace("{knowing}", known[i % known.length].text),
  }));
}
export function authoredParley(
  s: CampSession,
  target: string,
  cardId: string,
): ParleyProposal {
  const card = data.cards.find((c) => c.id === cardId),
    visible = parleyCards(s, target).find((c) => c.id === cardId);
  if (!card || !visible) throw new Error("That approach is not available.");
  return {
    stance: card.stance as ParleyStance,
    effect: card.effect as ParleyEffect,
    citedKnowings: [visible.knowingId],
    npcReply: card.reply,
  };
}
export function parleyMoments(t: Tables, s: CampSession) {
  return present(s)
    .filter((id) => !parleyProblem(t, s, id))
    .map((id) => ({
      target: id,
      name: s.camp.characters[id].name,
      cards: parleyCards(s, id),
    }));
}
/** Defense in depth: unknown JSON can never mutate state before these checks. */
export function parleyProposalProblem(
  s: CampSession,
  target: string,
  proposal: unknown,
): string | null {
  if (!proposal || typeof proposal !== "object" || Array.isArray(proposal))
    return "schema";
  const p = proposal as Record<string, unknown>;
  if (
    Object.keys(p).sort().join() !==
      ["stance", "effect", "citedKnowings", "npcReply"].sort().join() ||
    typeof p.stance !== "string" ||
    !data.stances.includes(p.stance) ||
    typeof p.effect !== "string" ||
    !data.effects.includes(p.effect) ||
    typeof p.npcReply !== "string" ||
    !Array.isArray(p.citedKnowings) ||
    p.citedKnowings.length > data.maxCitations ||
    p.citedKnowings.some((id) => typeof id !== "string") ||
    new Set(p.citedKnowings).size !== p.citedKnowings.length
  )
    return "schema";
  const eligible = knowingsAbout(s, target).map((f) => f.id);
  if (p.citedKnowings.some((id) => !eligible.includes(id)))
    return "unheld-or-unrelated-knowing";
  if (
    !["refuse", "shift_trust_small"].includes(p.effect) &&
    !p.citedKnowings.length
  )
    return "knowing-required";
  return null;
}
export function parleyReplyProblem(t: Tables, reply: unknown): string | null {
  if (typeof reply !== "string" || /[\p{Cc}\p{Cf}]/u.test(reply))
    return "reply-control";
  return lineProblem(
    {
      ...t,
      rules: {
        ...t.rules,
        line: { ...t.rules.line, maxLength: data.maxReplyChars },
      },
    },
    reply,
  );
}
export function applyParley(
  t: Tables,
  before: CampSession,
  target: string,
  raw: unknown,
): CampSession {
  const gate = parleyProblem(t, before, target);
  if (gate) throw new Error(gate);
  const invalid = parleyProposalProblem(before, target, raw);
  const p: ParleyProposal = invalid
    ? {
        stance: "appeal",
        effect: "refuse",
        citedKnowings: [],
        npcReply: data.replies.refuse,
      }
    : structuredClone(raw as ParleyProposal);
  const s = passSlot(before),
    player = s.camp.characters[s.camp.player],
    npc = s.camp.characters[target];
  const large = !["refuse", "shift_trust_small"].includes(p.effect);
  const hostile = p.stance === "intimidate" || p.stance === "deceive";
  const stat = p.stance === "intimidate" ? "nerve" : "guile";
  const action = `parley:${target}:${stat}`;
  const unit = seededUnit(s.camp.seed, s.camp.day, s.camp.player, action);
  const value = Math.floor(unit * t.rules.contests.dieSides) + 1;
  const score = player.stats[stat] * t.rules.contests.guileMultiplier + value;
  const success = score > data.contestDc;
  const roll: Roll | null =
    p.effect === "refuse"
      ? null
      : {
          seed: s.camp.seed,
          day: s.camp.day,
          actor: player.id,
          action,
          unit,
          value,
          score,
          dc: data.contestDc,
          success,
          rule: "parley/contestDc + rules/contests",
        };
  let effect = p.effect,
    reason = invalid,
    trustDelta = 0,
    revealedFact: string | null = null;
  const trace: Trace[] = [];
  if (large && !success) {
    effect = hostile ? "shift_trust_small" : "refuse";
    reason = "contest-failed";
  }
  if (effect === "shift_trust_small" || effect === "shift_trust_large") {
    const key = `${target}>${player.id}`,
      old = s.camp.trust[key];
    const magnitude =
      effect === "shift_trust_small" ? data.trustSmall : data.trustLarge;
    const next = Math.max(
      t.rules.ranges.trust[0],
      Math.min(
        t.rules.ranges.trust[1],
        old + magnitude * (hostile && !success ? -1 : 1),
      ),
    );
    s.camp.trust[key] = next;
    trustDelta = next - old;
    trace.push({
      path: `trust/${key}`,
      before: old,
      after: next,
      rule: `parley/${effect === "shift_trust_small" ? "trustSmall" : "trustLarge"}`,
    });
  } else if (effect === "reveal_fact") {
    const fact = s.camp.facts
      .filter(
        (f) =>
          npc.knowledge.includes(f.id) &&
          !player.knowledge.includes(f.id) &&
          f.truth !== false,
      )
      .sort(
        (a, b) =>
          Number(b.type === "knowing") - Number(a.type === "knowing") ||
          a.id.localeCompare(b.id),
      )[0];
    if (fact) {
      revealedFact = fact.id;
      trace.push({
        path: `characters/${player.id}/knowledge`,
        before: [...player.knowledge],
        after: [...player.knowledge, fact.id],
        rule: "parley/reveal_fact",
      });
      player.knowledge.push(fact.id);
    } else {
      effect = "refuse";
      reason = "nothing-to-reveal";
    }
  } else if (effect === "flip_next_intent") {
    const possible = data.friendlyIntents.some(
      (intent) =>
        !legalProblem(
          t,
          s.camp,
          decision(
            t,
            s.camp,
            target,
            intent as "BEFRIEND" | "PROTECT" | "CONFIDE",
            {
              target: player.id,
              ...(intent === "CONFIDE" ? { factId: npc.knowledge[0] } : {}),
            },
          ),
        ),
    );
    if (possible) s.intentPromises.push({ target, day: s.camp.day });
    else {
      effect = "refuse";
      reason = "no-legal-friendly-act";
    }
  }
  let reply = parleyReplyProblem(t, p.npcReply)
    ? data.replies[p.effect]
    : p.npcReply;
  if (reason)
    reply =
      reason === "contest-failed" ? data.replies.failed : data.replies.refuse;
  s.parleys.push({
    day: s.camp.day,
    target,
    stance: p.stance,
    proposed: p.effect,
    effect,
    citedKnowings: p.citedKnowings,
    reply,
    reason,
    trustDelta,
    revealedFact,
    roll,
    trace,
  });
  return s;
}
