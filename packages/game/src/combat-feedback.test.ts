import { expect, it } from "vitest";
import { ImpactClock } from "./combat-feedback.ts";
it("holds two frames for an ordinary hit, then returns the entire remaining time", () => {
  const c = new ImpactClock();
  c.hit(10);
  expect(c.advance(1 / 60)).toBe(0);
  expect(c.advance(1 / 60)).toBe(0);
  expect(c.advance(1 / 60)).toBeCloseTo(1 / 60);
});
it("caps large hit stops, slows perfect compression, and disables motion on request", () => {
  const c = new ImpactClock();
  c.hit(999);
  expect(c.stopS).toBe(0.05);
  c.reset();
  c.hit(0, true);
  expect(c.advance(0.1)).toBeCloseTo(0.035);
  c.hit(99);
  expect(c.advance(0.1, true)).toBe(0.1);
  expect(c.offset(1)).toEqual({ x: 0, y: 0 });
});
