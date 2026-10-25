import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { tables as t } from "../scripts/skill-census.ts";
import { boardLine, campRules, capFor, type IntentRule } from "./camp-rules.ts";
import { actCamp, campActions, createCampSession, moveCamp, playerProblem, remainingCaps, spendHours, type CampSession } from "./camp-session.ts";
import { calendar, createState, decision, legalProblem, reconcile } from "./camp.ts";
import type { Decision, Intent } from "./types.ts";

const eveDay = Array.from({ length: t.season.daysPerWeek }, (_, i) => i + 1).find((d) => calendar(t, d).eve)!;
/** A session at `place` from `hour` on `day`, waiting out the hours before it, then `edit`ed. */
function at(place: string, hour = t.season.wakeHour, day = 1, edit?: (s: CampSession) => void): CampSession {
  let s = createCampSession(t, 73, createState(t, 73, day));
  if (hour > s.hour) s = spendHours(s, hour - s.hour);
  s = moveCamp(t, s, place);
  edit?.(s);
  return s;
}
const openAtWake = t.locations.filter((p) => p.openHour <= t.season.wakeHour).map((p) => p.id);
/** No preview number hits a range bound here: fatigue and gold sit mid-range and the bond is formed, so PLOT is offered. */
const unclamped = (s: CampSession) => {
  const p = s.camp.characters[s.camp.player];
  p.fatigue = 3;
  p.gold = 20;
  s.camp.bond = "first_watch";
};
/** The trace paths each numeric preview names, in the order the preview text lists its numbers. */
const previewPaths: Partial<Record<Intent, (s: CampSession, d: Decision) => string[]>> = {
  TRAIN: (s, d) => [`characters/${s.camp.player}/points/${d.args.stat}`],
  WORK: (s) => [`characters/${s.camp.player}/gold`, `stores/${s.camp.characters[s.camp.player].tent}`, `characters/${s.camp.player}/fatigue`],
  REST: (s) => [`characters/${s.camp.player}/fatigue`],
  BEFRIEND: (s, d) => [`trust/${s.camp.player}>${d.args.target}`],
  PLOT: () => ["bondProgress"],
};
/** Case 2's property: every number `rule.preview` shows equals the delta `actCamp` writes on that path. Returns the mismatches. */
function drift(s: CampSession, d: Decision, rule: IntentRule = campRules[d.intent]): string[] {
  const shown = (rule.preview(t, s, d).match(/[+-]?\d+/g) ?? []).map(Number);
  const trace = actCamp(t, s, d).lastResolution!.trace;
  return previewPaths[d.intent]!(s, d).flatMap((path, i) => {
    const hit = trace.find((x) => x.path === path);
    const delta = hit ? (hit.after as number) - (hit.before as number) : 0;
    return delta === shown[i] ? [] : [`${d.intent} ${JSON.stringify(d.args)} ${path}: shows ${shown[i]}, writes ${delta}`];
  });
}
const numericSessions = () => [
  ...openAtWake.map((p) => at(p, t.season.wakeHour, 1, unclamped)),
  at("pit", t.season.phases.dusk, 1, unclamped),
  at("edge", t.season.phases.night, 1, unclamped),
];
const numericActions = () =>
  numericSessions().flatMap((s) => campActions(t, s).filter((a) => Object.hasOwn(previewPaths, a.decision.intent)).map((a) => ({ s, d: a.decision })));

describe("camp rulebook", () => {
  it("case 1: has one row for every intent the Tables declare", () => {
    expect(Object.keys(campRules).sort()).toEqual(Object.keys(t.intents).sort());
  });
  it("case 2: each numeric preview is the delta its effect writes", () => {
    const acts = numericActions();
    expect(new Set(acts.map((x) => x.d.intent))).toEqual(new Set(Object.keys(previewPaths)));
    expect(acts.flatMap(({ s, d }) => drift(s, d))).toEqual([]);
  });
  it("case 3: one cap rule serves the player, the day's remaining caps and the night's reconcile", () => {
    const cap = t.rules.caps.SCHEME_eve;
    expect(capFor(t, eveDay, "SCHEME")).toBe(cap);
    expect(capFor(t, 1, "SCHEME")).toBe(t.rules.caps.SCHEME);
    expect(capFor(t, eveDay, "BEFRIEND")).toBeUndefined();
    const tent = at("tent", t.season.wakeHour, eveDay);
    const scheme = campActions(t, tent).find((a) => a.decision.intent === "SCHEME")!.decision;
    const spent = (n: number) => ({ ...tent, dayActs: Array.from({ length: n }, () => structuredClone(scheme)) });
    expect(playerProblem(t, spent(cap - 1), scheme)).toBeNull();
    expect(playerProblem(t, spent(cap), scheme)).toBe("The camp's limit for this activity is spent.");
    expect(remainingCaps(t, spent(cap - 1)).rules.caps.SCHEME_eve).toBe(1);
    expect(remainingCaps(t, spent(cap)).rules.caps.SCHEME_eve).toBe(0);
    // cap + 1 NPCs who may each legally scheme on the eve: reconcile keeps exactly `cap` of them.
    const camp = tent.camp,
      schemers: Decision[] = [];
    for (const id of Object.keys(camp.characters).filter((id) => id !== camp.player).sort())
      for (const target of Object.keys(camp.characters)) {
        const d = decision(t, camp, id, "SCHEME", { target, kind: "steal" });
        if (schemers.length <= cap && !schemers.some((x) => x.character === id) && !legalProblem(t, camp, d)) schemers.push(d);
      }
    expect(schemers).toHaveLength(cap + 1);
    const { items, verdicts } = reconcile(t, camp, schemers);
    expect(items.filter((d) => d.intent === "SCHEME")).toHaveLength(cap);
    expect(verdicts.filter((v) => v.reason === "cap")).toHaveLength(1);
  });
  it("case 4: one board line per visibility, written in one file", () => {
    expect(boardLine({ visibility: "secret", text: "x" })).toBe("Journal: x");
    expect(boardLine({ visibility: "witnessed", text: "x" })).toBe("Someone saw: x");
    expect(boardLine({ visibility: "public", text: "x" })).toBe("x");
    const read = (f: string) => readFileSync(new URL(f, import.meta.url), "utf8");
    expect(["./camp.ts", "./camp-session.ts", "./camp-rules.ts"].filter((f) => read(f).includes("Someone saw:"))).toEqual(["./camp-rules.ts"]);
    for (const f of ["./camp.ts", "./camp-session.ts"]) expect(read(f)).toContain("boardLine(");
  });
  it("case 5 (guard): campActions ids and labels are byte-equal to the pre-rulebook capture", () => {
    const sessions = [
      ...openAtWake.map((p) => at(p)),
      at("pit", t.season.phases.dusk, eveDay),
      at("tent", t.season.wakeHour, eveDay),
      at("edge", t.season.phases.night, 1, (s) => void (s.camp.bond = "first_watch")),
      at("tent", t.season.wakeHour, 1, (s) => void (s.camp.characters[s.camp.player].stocks = true)),
    ];
    const capture = JSON.stringify(sessions.map((s) => campActions(t, s).map(({ id, label }) => [id, label])));
    expect([capture.length, createHash("sha256").update(capture).digest("hex")]).toEqual([13947, "93da01631b72ed86e43c2734949b9267e4115cdad1af0b9795255f0695692628"]);
  });
  it("case 7: a row whose preview reads another key than its effect fails the case-2 property", () => {
    const raw: IntentRule = { ...campRules.BEFRIEND, preview: (tt) => `+${tt.rules.effects.BEFRIEND.trust} mutual trust` };
    const befriends = numericActions().filter(({ d }) => d.intent === "BEFRIEND");
    expect(befriends.flatMap(({ s, d }) => drift(s, d))).toEqual([]);
    expect(befriends.flatMap(({ s, d }) => drift(s, d, raw)).length).toBeGreaterThan(0);
  });
});
