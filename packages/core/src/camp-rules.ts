// The camp rulebook: one row per intent holds what the intent does (effect), what the player is told it will do (preview),
// which argument sets the camp offers (options), its label, whether the target must be present, and the contests it rolls.
// resolve, actionPreview and campActions dispatch through the row, so a formula is written once. Pure: no IO, clock or RNG.
import { calendar } from "./camp.ts";
import type { CampSession } from "./camp-session.ts";
import type { CampState, Character, Decision, Fact, Intent, Roll, Tables } from "./types.ts";

type Rules = Tables["rules"];
type Args = Record<string, string>;
/** A contest succeeds when `bonus` plus one die of rules/contests/dieSides, rolled by the actor under `action`, beats `dc`. */
export interface Contest {
  action: string;
  bonus: number;
  dc: number;
}
export type ContestOf = (r: Rules, a: Character, b: Character, args: Args) => Contest;
/** What resolve lends a row while it applies one decision: the live state, its trace-writing helpers and the day's carry. */
export interface EffectCtx {
  t: Tables;
  r: Rules;
  state: CampState;
  item: Decision;
  a: Character;
  b: Character;
  e: Record<string, number>;
  ref: string;
  /** A daytime act (settleNight false): the night that releases the stocks has not come yet. */
  dayAct: boolean;
  carry: { helped: Set<string>; working: Set<string>; stopped: Set<string>; freshStocks: Set<string> };
  set(path: string, value: unknown, rule: string): void;
  add(path: string, amount: number, rule: string, range?: number[]): void;
  change(id: string, field: string, amount: number, rule: string): void;
  trust(from: string, to: string, amount: number, rule: string): void;
  train(id: string, stat: string, points: number, rule: string): void;
  fact(type: string, actor: string, target: string, visibility: string, text: string, truth?: boolean): void;
  /** Roll `c` for the acting character; `record` is the Roll entry the die wrote. */
  roll(c: Contest): { score: number; success: boolean; record: Roll };
}
export interface IntentRule {
  /** Shown instead of the lower-cased intent name. */
  label?: string;
  /** The player may only choose it while the target is at the same place. */
  needsPresence?: boolean;
  /** Every argument set the camp offers at a place; `stat` is the place token's suffix (TRAIN:vigor). */
  options(t: Tables, s: CampSession, stat?: string): Args[];
  preview(t: Tables, s: CampSession, d: Decision): string;
  effect(x: EffectCtx): void;
  /** The contests the effect rolls, by name, so a preview can read the same bonus and DC. */
  contests?: Record<string, ContestOf>;
}

/** The day's cap for an intent: SCHEME has its own on a Games eve. Undefined means uncapped. */
export function capFor(t: Tables, day: number, intent: string): number | undefined {
  const caps: Record<string, number> = t.rules.caps;
  return intent === "SCHEME" && calendar(t, day).eve ? caps.SCHEME_eve : caps[intent];
}
/** The board text of a fact the player can see, by how it reached them. */
export function boardLine(f: Pick<Fact, "visibility" | "text">): string {
  return f.visibility === "secret" ? `Journal: ${f.text}` : f.visibility === "witnessed" ? `Someone saw: ${f.text}` : f.text;
}
export function trainPoints(r: Rules, a: Character): number {
  const e = r.effects;
  let p = a.hunger >= e.daily.hungryAt ? e.TRAIN.hungryPoints : e.TRAIN.points;
  if (a.fatigue >= e.daily.fatiguedAt) p = Math.floor(p * e.daily.fatigueTrainMultiplier);
  return p;
}
export function befriendGain(r: Rules, a: Character, b: Character): number {
  const e = r.effects.BEFRIEND;
  let gain = e.trust;
  if (a.tent !== b.tent && a.rank === b.rank) gain *= e.peerMultiplier;
  if (Math.abs(a.traits.aggression - b.traits.aggression) >= e.aggressionGap) gain *= e.gapMultiplier;
  return Math.floor(gain);
}

const alone = (): Args[] => [{}];
/** One argument set per living character other than the player, extended by `more`. */
const perTarget =
  (more: (t: Tables, s: CampSession, target: string) => Args[] = (_t, _s, target) => [{ target }]) =>
  (t: Tables, s: CampSession): Args[] =>
    Object.values(s.camp.characters)
      .filter((c) => c.id !== s.camp.player && c.life === "Alive")
      .flatMap((c) => more(t, s, c.id));
const player = (s: CampSession) => s.camp.characters[s.camp.player];
const text = (line: string) => () => line;

const guile = (r: Rules, c: Character) => c.stats.guile * r.contests.guileMultiplier;
const watch: ContestOf = (r, a, b) => ({ action: `WATCH:${b.id}`, bonus: guile(r, a), dc: r.contests.baseDc + guile(r, b) });
const report: ContestOf = (r, _a, b) => ({ action: `REPORT:${b.id}`, bonus: r.contests.vigilBonus, dc: r.contests.baseDc + guile(r, b) });
/** The scheme's DC by kind; a PROTECT warning on the target raises it. */
const scheme: ContestOf = (r, a, b, { kind }) => {
  const c = r.contests;
  let dc = c.baseDc + guile(r, b) + c.patrol;
  if (kind === "persuade") dc = c.baseDc + Math.floor(b.loyalty / c.loyaltyDivisor);
  if (kind === "rumour") dc = c.rumourBaseDc + Math.floor(b.renown / c.renownDivisor);
  if (b.warned) dc += r.effects.PROTECT.warningDc;
  return { action: `SCHEME:${kind}:${b.id}`, bonus: guile(r, a), dc };
};
/** After a failed scheme the Vigil rolls against the schemer's guile. */
const caught: ContestOf = (r, a, b, { kind }) => ({
  action: `CAUGHT:${kind}:${b.id}`,
  bonus: r.contests.vigilBonus,
  dc: guile(r, a) + r.contests.baseDc,
});
const recruit: ContestOf = (r, a, b) => ({
  action: `RECRUIT:${b.id}`,
  bonus: guile(r, a) + Math.floor(a.renown / r.contests.renownDivisor),
  dc: r.contests.baseDc + b.loyalty,
});

function schemeEffect(x: EffectCtx) {
  const { r, state, item, a, b, carry } = x,
    kind = item.args.kind;
  x.set(`characters/${a.id}/lastScheme`, { day: state.day, target: b.id }, "intents/SCHEME");
  const c = scheme(r, a, b, item.args),
    { score, record } = x.roll(c);
  const success = !carry.stopped.has(a.id) && score > c.dc &&
    !(kind === "rumour" && record.value <= (r.reviewPolicy?.rumourFailsAtOrBelow ?? 0));
  record.score = score;
  record.dc = c.dc;
  record.success = success;
  if (success) {
    if (kind === "poison") x.set(`characters/${b.id}/sick`, true, `rules/schemes/${kind}`);
    if (kind === "steal") x.add(`stores/${b.tent}`, r.schemes.steal.stores, `rules/schemes/${kind}/stores`, r.ranges.stores);
    if (kind === "persuade") x.change(b.id, "loyalty", r.schemes.persuade.loyalty, `rules/schemes/${kind}/loyalty`);
    if (kind === "rumour") {
      x.change(b.id, "renown", r.schemes.rumour.renown, `rules/schemes/${kind}/renown`);
      const reactions: Record<string, { values: string[]; trust: number }> = r.schemes.rumour.reactions;
      const reaction = reactions[item.args.topic];
      for (const listener of Object.values(state.characters))
        if (
          listener.id !== b.id &&
          (!r.reviewPolicy?.rumourExcludesAuthor || listener.id !== a.id) &&
          ([a.tent, b.tent].includes(listener.tent) || (b.role === "main" && listener.role === "main")) &&
          state.trust[`${listener.id}>${b.id}`] < r.schemes.rumour.disbeliefTrust &&
          listener.values.some((v) => reaction.values.includes(v))
        )
          x.trust(listener.id, b.id, reaction.trust, `rules/schemes/rumour/reactions/${item.args.topic}/trust`);
      x.fact("rumour", a.id, b.id, "public", `A rumour questions ${b.name}'s conduct.`, false);
    }
  } else if (x.roll(caught(r, a, b, item.args)).success) {
    x.set(`characters/${a.id}/stocks`, true, "rules/effects/caught");
    if (x.dayAct) carry.freshStocks.add(a.id);
    x.change(a.id, "renown", r.effects.caught.renown, "rules/effects/caught/renown");
    x.trust(b.id, a.id, r.effects.caught.trust, "rules/effects/caught/trust");
    x.fact("caught", a.id, b.id, "public", `The Vigil stopped ${a.name} meddling with ${b.name}.`);
  }
}

export const campRules: Record<Intent, IntentRule> = {
  REST: {
    options: alone,
    preview: (t) => `${t.rules.effects.REST.fatigue} fatigue`,
    effect: (x) => x.change(x.a.id, "fatigue", x.e.fatigue, `${x.ref}/fatigue`),
  },
  TRAIN: {
    options: (_t, _s, stat) => [{ stat: stat! }],
    preview: (t, s, d) => `+${trainPoints(t.rules, player(s))} ${d.args.stat} practice`,
    effect: (x) => x.train(x.a.id, x.item.args.stat, trainPoints(x.r, x.a), x.ref),
  },
  WORK: {
    options: alone,
    preview: ({ rules: { effects: e } }) => `+${e.WORK.gold} gold · +${e.WORK.stores} tent stores · +${e.WORK.fatigue} fatigue`,
    effect: (x) => {
      const { a, e, ref, state } = x;
      x.change(a.id, "gold", e.gold, `${ref}/gold`);
      x.change(a.id, "fatigue", e.fatigue, `${ref}/fatigue`);
      x.carry.working.add(a.id);
      if (Object.hasOwn(state.stores, a.tent)) x.add(`stores/${a.tent}`, e.stores, `${ref}/stores`, x.r.ranges.stores);
    },
  },
  BEFRIEND: {
    needsPresence: true,
    options: perTarget(),
    preview: (t, s, d) => `+${befriendGain(t.rules, player(s), s.camp.characters[d.args.target])} mutual trust`,
    effect: (x) => {
      const { a, b, ref } = x,
        gain = befriendGain(x.r, a, b);
      x.trust(a.id, b.id, gain, ref);
      x.trust(b.id, a.id, gain, ref);
      x.fact("befriended", a.id, b.id, "public", `${a.name} shared a quiet moment with ${b.name}.`);
    },
  },
  PROTECT: {
    needsPresence: true,
    options: perTarget(),
    preview: (t) => `Costs ${t.rules.effects.PROTECT.costGold} gold · feed and warn them; hungry friends gain trust`,
    effect: (x) => {
      const { r, a, b, e, ref } = x;
      const socialGain = !r.reviewPolicy?.protectNeedsHungerForSocialGain || b.hunger > r.ranges.hunger[0];
      x.change(a.id, "gold", -e.costGold, `${ref}/costGold`);
      x.change(b.id, "hunger", e.hunger, `${ref}/hunger`);
      if (socialGain) {
        x.trust(b.id, a.id, e.trust, `${ref}/trust`);
        x.add(`debt/${b.id}>${a.id}`, e.debt, `${ref}/debt`, r.ranges.debt);
      }
      x.set(`characters/${b.id}/warned`, true, `${ref}/warningDc`);
      x.carry.helped.add(b.id);
      x.fact("protected", a.id, b.id, "witnessed", `${a.name} brought bread to ${b.name}.`);
    },
  },
  CONFIDE: {
    needsPresence: true,
    options: perTarget((_t, s, target) => player(s).knowledge.map((factId) => ({ target, factId }))),
    preview: (t) => `Share a known fact · +${t.rules.effects.CONFIDE.trust} mutual trust`,
    effect: (x) => {
      const { a, b, e, ref, item } = x;
      x.trust(a.id, b.id, e.trust, `${ref}/trust`);
      x.trust(b.id, a.id, e.trust, `${ref}/trust`);
      if (!b.knowledge.includes(item.args.factId))
        x.set(`characters/${b.id}/knowledge`, [...b.knowledge, item.args.factId], "intents/CONFIDE");
      x.fact("confided", a.id, b.id, "secret", `${a.name} confided in ${b.name}.`);
    },
  },
  WATCH: {
    needsPresence: true,
    options: perTarget(),
    preview: text("Guile contest · discover a fact; being noticed costs trust"),
    contests: { WATCH: watch },
    effect: (x) => {
      const { a, b, state } = x,
        { success } = x.roll(watch(x.r, a, b, x.item.args));
      const known = state.facts.find((f) => b.knowledge.includes(f.id) && f.visibility !== "secret" && !a.knowledge.includes(f.id));
      if (success && known) x.set(`characters/${a.id}/knowledge`, [...a.knowledge, known.id], "intents/WATCH");
      if (!success) x.trust(b.id, a.id, x.e.noticedTrust, `${x.ref}/noticedTrust`);
    },
  },
  REPORT: {
    options: perTarget(),
    preview: text("Ask the Vigil to investigate · a contested outcome"),
    contests: { REPORT: report },
    effect: (x) => {
      const { a, b, state } = x,
        { success } = x.roll(report(x.r, a, b, x.item.args));
      if (success) x.carry.stopped.add(b.id);
      x.set("investigations", [...state.investigations, { actor: a.id, target: b.id, day: state.day, substantiated: success }], "intents/REPORT");
      if (a.role === "main" && b.role === "main") x.set("bond", "fractured", "rules/arcs/bondFractureTrust");
    },
  },
  SCHEME: {
    options: perTarget((t, _s, target) =>
      Object.keys(t.rules.schemes).flatMap((kind) =>
        kind === "rumour" ? Object.keys(t.rules.schemes.rumour.reactions).map((topic) => ({ target, kind, topic })) : [{ target, kind }],
      ),
    ),
    preview: text("Guile contest · failure risks the stocks"),
    contests: { SCHEME: scheme, CAUGHT: caught },
    effect: schemeEffect,
  },
  RECRUIT: {
    needsPresence: true,
    options: perTarget(),
    preview: text("Guile contest · invite them to your cause"),
    contests: { RECRUIT: recruit },
    effect: (x) => {
      const { a, b, e, ref, state } = x;
      if (!x.roll(recruit(x.r, a, b, x.item.args)).success) return;
      x.change(b.id, "loyalty", e.loyalty, `${ref}/loyalty`);
      x.trust(b.id, a.id, e.trust, `${ref}/trust`);
      if (b.tent === "strays" && !state.fifth.includes(b.id)) x.set("fifth", [...state.fifth, b.id], "intents/RECRUIT");
      x.fact("recruited", a.id, b.id, "witnessed", `${b.name} listened to ${a.name}'s invitation.`);
    },
  },
  DEFECT: {
    options: (t) => t.schools.map((school) => ({ toTent: school.tent })),
    preview: text("Change tents and loyalties"),
    effect: (x) => {
      const { a, item } = x;
      x.set(`characters/${a.id}/tent`, item.args.toTent, "intents/DEFECT");
      x.set(`characters/${a.id}/loyalty`, x.e.newLoyalty, `${x.ref}/newLoyalty`);
      x.fact("joined", a.id, a.id, "public", `${a.name} now sleeps in the ${item.args.toTent} tent.`);
    },
  },
  PLOT: {
    label: "Plan the bond",
    options: alone,
    preview: (t) => `+${t.rules.effects.PLOT.progress} bond progress`,
    effect: (x) => {
      x.add("bondProgress", x.e.progress, `${x.ref}/progress`);
      x.set("bond", "plotting", "intents/PLOT");
    },
  },
  OFFER: {
    options: perTarget((_t, _s, target) => [{ target, terms: "back_entrant" }]),
    preview: text("Offer a private favour"),
    effect: (x) => x.fact("offered", x.a.id, x.b.id, "secret", `${x.a.name} offered ${x.b.name} a favour.`),
  },
};
