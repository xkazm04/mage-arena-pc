import { describe, expect, it } from "vitest";
import {
  createLab,
  defaultLabConfig,
  labDefaultLoadout,
  type SlotSchool,
} from "@mage/core/arena";
import { feetArcPoint, feetMeter } from "./feet-meter.ts";

const lab = (school: "water" | SlotSchool) => {
  const l = createLab({
    ...defaultLabConfig,
    playerSchool: school,
    dummyAttack: "still",
    ...(school === "water"
      ? {}
      : { playerBuild: { loadout: labDefaultLoadout(school) } }),
  });
  return l.training;
};

describe("feet meter", () => {
  it("Fire fills from Heat and marks 50 and 80", () => {
    const t = lab("fire");
    t.player.schoolState!.value = 25;
    const m = feetMeter(t.player, t.state)!;
    expect(m.school).toBe("fire");
    expect(m.fill).toBeCloseTo(0.25);
    expect(m.marks).toEqual([0.5, 0.8]);
    expect(m.locked).toBe(false);
  });

  it("Air fills from Momentum and marks 40 and 80", () => {
    const t = lab("air");
    t.player.schoolState!.value = 100;
    const m = feetMeter(t.player, t.state)!;
    expect(m.school).toBe("air");
    expect(m.fill).toBe(1);
    expect(m.marks).toEqual([0.4, 0.8]);
  });

  it("Water has no meter", () => {
    const t = lab("water");
    expect(feetMeter(t.player, t.state)).toBeUndefined();
  });

  it("reports a lock while lockedUntil is ahead of the tick, and places arc points left to right", () => {
    const t = lab("air");
    t.player.schoolState!.lockedUntil = t.state.tick + 30;
    expect(feetMeter(t.player, t.state)!.locked).toBe(true);
    t.player.schoolState!.lockedUntil = t.state.tick;
    expect(feetMeter(t.player, t.state)!.locked).toBe(false);
    const a = feetArcPoint(0, 0, 10, 4, 0),
      b = feetArcPoint(0, 0, 10, 4, 0.5),
      c = feetArcPoint(0, 0, 10, 4, 1);
    expect(a.x).toBeLessThan(b.x);
    expect(b.x).toBeLessThan(c.x);
    expect(b.x).toBeCloseTo(0);
    expect(b.y).toBeCloseTo(4);
  });
});
