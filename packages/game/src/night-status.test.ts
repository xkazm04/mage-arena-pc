import { describe, expect, it } from "vitest";
import type { NightProgress } from "@mage/director";
import { isNightChanged, nightStatus } from "./night-status.ts";

const night = (states: NightProgress["groups"][number]["state"][], plannerMode = false): NightProgress => {
  const groups = states.map((state, i) => ({ group: `tent-${i}`, state, rejected: 0 }));
  const decided = groups.filter((g) => g.state !== "deciding").length;
  return { total: groups.length, decided, pending: decided < groups.length, plannerMode, groups };
};

describe("night status", () => {
  it("case 5: an early dawn names the tents that will follow habit and stays the player's choice", () => {
    const status = nightStatus({ nightFinished: true, night: night(["live", "cache", "live", "deciding", "deciding"]) });
    expect(status.label).toBe("Meet the morning");
    expect(status.subtitle).toContain("2 tents will follow habit");
    expect(status.enabled).toBe(true);
    expect(status.hint).toBe("The camp is still deciding: 3 of 5 tents");
  });
  it("case 5b: one undecided tent reads in the singular", () => {
    expect(nightStatus({ nightFinished: true, night: night(["live", "deciding"]) }).subtitle).toContain("1 tent will follow habit");
  });
  it("case 6: a fully decided night keeps today's copy; planner mode never warns about habit", () => {
    const decided = nightStatus({ nightFinished: true, night: night(["live", "cache", "live", "live", "cache"]) });
    expect(decided.subtitle).toBe("Read the Hollow Board");
    expect(decided.hint).toBeNull();
    const planner = nightStatus({ nightFinished: true, night: night(["planner", "planner", "planner"], true) });
    expect(planner.subtitle).toBe("Read the Hollow Board");
    expect(planner.hint).toBeNull();
    expect(`${planner.subtitle} ${planner.hint}`).not.toMatch(/habit/);
  });
  it("case 6b: settled fallbacks (budget, error, sealed) are named once the night is done", () => {
    const status = nightStatus({ nightFinished: true, night: night(["live", "budget", "error"]) });
    expect(status.subtitle).toBe("Read the Hollow Board");
    expect(status.hint).toBe("2 of 3 tents follow habit tonight");
  });
  it("case 6c: no night job keeps today's copy", () => {
    expect(nightStatus({ nightFinished: true, night: null })).toEqual({ label: "Meet the morning", subtitle: "Read the Hollow Board", enabled: true, hint: null });
  });
  it("case 7: a poll whose only difference is night.decided triggers a redraw", () => {
    const prev = night(["live", "deciding", "deciding"]);
    const next = night(["live", "live", "deciding"]);
    expect(isNightChanged(prev, next)).toBe(true);
    expect(isNightChanged(prev, structuredClone(prev))).toBe(false);
    expect(isNightChanged(null, null)).toBe(false);
    expect(isNightChanged(null, prev)).toBe(true);
    expect(isNightChanged(prev, { ...prev, pending: false })).toBe(true);
  });
});
