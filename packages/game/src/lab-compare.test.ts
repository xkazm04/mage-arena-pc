import { describe, expect, it } from "vitest";
import { defaultLabConfig, makeTuning, type DuelForecast } from "@mage/core/arena";
import type { ForecastResult } from "./forecast-job.ts";
import { changedKnobs, duelDelta, duelDeltaText, LabCompare } from "./lab-compare.ts";

const duel = (winRate: number, ttkMedianS: number | null): DuelForecast => ({ duels: 10, wins: winRate * 10, winRate, ttkMedianS, damagePerMana: null });
const result = (base: DuelForecast, cand: DuelForecast): ForecastResult => ({
  id: 1,
  sameAsCurrent: false,
  current: { waves: [], duel: base },
  candidate: { waves: [], duel: cand },
});

describe("Lab compare: the pinned baseline", () => {
  it("pins a named tuning + builds, labels the forecast with it, and unpins back to Current", () => {
    const c = new LabCompare(),
      t = { ...makeTuning(), walkMps: 5 };
    expect(c.label).toBe("vs Current");
    expect(c.baseline).toBeUndefined();
    expect(c.pin(t, defaultLabConfig, "Brawler v2")).toBeUndefined();
    expect(c.label).toBe("vs pinned Brawler v2");
    expect(c.baselineName).toBe("pinned Brawler v2");
    expect(c.baseline).toEqual({ tuning: t, lab: defaultLabConfig });
    t.walkMps = 6;
    expect(c.baseline!.tuning.walkMps).toBe(5);
    c.unpin();
    expect(c.label).toBe("vs Current");
    expect(c.baseline).toBeUndefined();
  });
  it("refuses an unplayable draft with the validator's reason and keeps the pin", () => {
    const c = new LabCompare();
    c.pin(makeTuning(), defaultLabConfig, "Good");
    const reason = c.pin(makeTuning(), { ...defaultLabConfig, competence: 9 }, "Broken");
    expect(reason).toBe("Invalid Lab setup.");
    expect(c.label).toBe("vs pinned Good");
    expect(c.pin({ ...makeTuning(), walkMps: 99 }, defaultLabConfig, "Fast")).toMatch(/^walkMps: expected/);
    expect(c.label).toBe("vs pinned Good");
  });
  it("signs the duel delta against the baseline", () => {
    const r = result(duel(0.4, 20), duel(0.6, 18.5));
    expect(duelDelta(r).winRate).toBeCloseTo(0.2, 12);
    expect(duelDelta(r).ttkMedianS).toBeCloseTo(-1.5, 12);
    expect(duelDeltaText(r, "pinned Good")).toBe("(+20% win, -1.5 s TTK vs pinned Good)");
    expect(duelDelta(result(duel(0.4, null), duel(0.6, 18.5))).ttkMedianS).toBeNull();
  });
  it("names the changed knobs against the baseline, up to a limit", () => {
    const base = makeTuning();
    expect(changedKnobs(base, base)).toBe("No knobs changed");
    expect(changedKnobs(base, { ...base, walkMps: 5 })).toBe(`Walk speed ${base.walkMps} -> 5 m/s`);
    const many = { ...base, walkMps: 5, sprintMps: 9, absorbWindowS: 0.25, spells: { "bolt:0:base": { castS: 0.4, cooldownS: 1.5, speedMps: 30 } } };
    expect(changedKnobs(base, many, 2)).toBe(`Walk speed ${base.walkMps} -> 5 m/s, Sprint speed ${base.sprintMps} -> 9 m/s, +2 more`);
    expect(changedKnobs(base, { ...base, spells: many.spells })).toBe("bolt:0:base override added");
  });
});
