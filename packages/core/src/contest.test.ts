import { describe, expect, it } from "vitest";
import { tables as t } from "../scripts/skill-census.ts";
import { campRules, previewContests, type Contest, type EffectCtx } from "./camp-rules.ts";
import { actCamp, campActions, campView, createCampSession, moveCamp, spendHours, type CampSession } from "./camp-session.ts";
import { calendar, createState } from "./camp.ts";
import { contestOdds } from "./contest.ts";
import type { Decision, Roll } from "./types.ts";

const sides = t.rules.contests.dieSides,
  seeds = Array.from({ length: 400 }, (_, i) => i + 1);
function at(place: string, hour = t.season.wakeHour, day = 1): CampSession {
  let s = createCampSession(t, 73, createState(t, 73, day));
  if (hour > s.hour) s = spendHours(s, hour - s.hour);
  return moveCamp(t, s, place);
}
/** SCHEME is only offered on a Games eve. */
const eveDay = Array.from({ length: t.season.daysPerWeek }, (_, i) => i + 1).find((d) => calendar(t, d).eve)!;
const openAtWake = t.locations.filter((p) => p.openHour <= t.season.wakeHour).map((p) => p.id);
/** Every row the camp view offers for `intent` at each place open at wake on `day`, with the session that offers it. */
const rows = (intent: string, day = 1) =>
  openAtWake.flatMap((p) => {
    const s = at(p, t.season.wakeHour, day);
    return campView(t, s)
      .actions.filter((a) => a.intent === intent)
      .map((a) => ({ s, a, d: campActions(t, s).find((x) => x.id === a.id)!.decision }));
  });
/** The same session rolled under another seed: only the dice change. */
const reseed = (s: CampSession, seed: number) => {
  const c = structuredClone(s);
  c.camp.seed = seed;
  return c;
};
/** The contests resolve's effect row rolls for `d` on the planted state, in order (every roll fails, so SCHEME reaches CAUGHT). */
function rolled(s: CampSession, d: Decision): Contest[] {
  const seen: Contest[] = [],
    noop = () => undefined,
    state = structuredClone(s.camp);
  const x: EffectCtx = {
    t, r: t.rules, state, item: d, a: state.characters[d.character], b: state.characters[d.args.target],
    e: t.rules.effects[d.intent], ref: `rules/effects/${d.intent}`, dayAct: true,
    carry: { helped: new Set(), working: new Set(), stopped: new Set(), freshStocks: new Set() },
    set: noop, add: noop, change: noop, trust: noop, train: noop, fact: noop,
    roll: (c) => {
      seen.push(c);
      return { score: Number.NEGATIVE_INFINITY, success: false, record: { value: sides } as Roll };
    },
  };
  campRules[d.intent].effect(x);
  return seen;
}
const share = (hits: number) => hits / seeds.length;

describe("contest odds", () => {
  it("case 1: success iff bonus + die > dc, die uniform 1..sides", () => {
    expect(contestOdds({ bonus: 0, dc: 10, sides: 20 })).toBe(0.5);
    expect(contestOdds({ bonus: 25, dc: 10, sides: 20 })).toBe(1);
    expect(contestOdds({ bonus: 0, dc: 20, sides: 20 })).toBe(0);
    expect(contestOdds({ bonus: 0, dc: 0, sides: 20, failsAtOrBelow: 1 })).toBe(0.95);
  });
  it("case 2: WATCH rows carry the resolver's own odds, exactly and over 400 seeds", () => {
    const watch = rows("WATCH");
    expect(watch.length).toBeGreaterThan(0);
    for (const { s, a, d } of watch) {
      const p = previewContests(t, s, d)!;
      const mine = s.camp.characters[s.camp.player],
        them = s.camp.characters[d.args.target];
      expect(p.contest.bonus).toBe(mine.stats.guile * t.rules.contests.guileMultiplier);
      expect(p.contest.dc).toBe(t.rules.contests.baseDc + them.stats.guile * t.rules.contests.guileMultiplier);
      expect(rolled(s, d)).toEqual([p.contest]);
      expect(a.odds).toEqual({ success: contestOdds({ ...p.contest, sides }), caught: null });
      const unnoticed = seeds.filter(
        (n) => !actCamp(t, reseed(s, n), d).lastResolution!.trace.some((x) => x.rule === "rules/effects/WATCH/noticedTrust"),
      ).length;
      expect(Math.abs(share(unnoticed) - a.odds!.success)).toBeLessThanOrEqual(0.06);
    }
  });
  it("case 3: SCHEME rows carry success and stocks risk, rumour floor included, exactly and over 400 seeds", () => {
    const schemes = rows("SCHEME", eveDay);
    const kinds = new Set(schemes.map((x) => x.d.args.kind));
    expect(kinds.has("rumour")).toBe(true);
    const sample = [...kinds].map((k) => schemes.find((x) => x.d.args.kind === k)!);
    for (const { s, a, d } of sample) {
      const p = previewContests(t, s, d)!;
      expect(p.failsAtOrBelow).toBe(d.args.kind === "rumour" ? (t.rules.reviewPolicy?.rumourFailsAtOrBelow ?? 0) : 0);
      expect(rolled(s, d)).toEqual([p.contest, p.caught]);
      const success = contestOdds({ ...p.contest, sides, failsAtOrBelow: p.failsAtOrBelow });
      expect(a.odds!.success).toBe(success);
      expect(a.odds!.caught).toBeCloseTo((1 - success) * contestOdds({ ...p.caught!, sides }), 12);
      let stocks = 0;
      for (const n of seeds) {
        const after = actCamp(t, reseed(s, n), d),
          roll = after.lastResolution!.rolls.find((r) => r.action === p.contest.action)!;
        expect([roll.score! - roll.value, roll.dc]).toEqual([p.contest.bonus, p.contest.dc]);
        if (after.camp.characters[s.camp.player].stocks) stocks++;
      }
      expect(Math.abs(share(stocks) - a.odds!.caught!)).toBeLessThanOrEqual(0.06);
    }
  });
  it("case 4: a hidden PROTECT warning never moves the previewed odds; the preview names it", () => {
    const { s, a, d } = rows("SCHEME", eveDay)[0];
    const warned = structuredClone(s);
    warned.camp.characters[d.args.target].warned = true;
    expect(rolled(warned, d)[0].dc).toBeGreaterThan(rolled(s, d)[0].dc);
    expect(campView(t, warned).actions.find((x) => x.id === a.id)!.odds).toEqual(a.odds);
    expect(a.gains).toMatch(/warned/);
  });
  it("case 4b: intents without a contest carry odds null; RECRUIT and REPORT carry the resolver's inputs", () => {
    for (const p of openAtWake)
      for (const a of campView(t, at(p, t.season.wakeHour, eveDay)).actions)
        expect(a.odds === null).toBe(!campRules[a.intent as Decision["intent"]].contests);
    for (const intent of ["RECRUIT", "REPORT"]) {
      expect(rows(intent).length).toBeGreaterThan(0);
      for (const { s, a, d } of rows(intent)) {
        const p = previewContests(t, s, d)!;
        expect(rolled(s, d)).toEqual([p.contest]);
        expect(a.odds).toEqual({ success: contestOdds({ ...p.contest, sides }), caught: null });
      }
    }
  });
});
