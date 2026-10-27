import { expect, it } from "vitest";
import {
  freeNumberSlot,
  feedbackPolicy as policy,
  ImpactClock,
  numberSlotOffset,
} from "./combat-feedback.ts";
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

it("gives N simultaneous numbers over one target N distinct, non-overlapping spots", () => {
  const taken: number[] = [];
  for (let n = 1; n <= policy.maxNumbers; n++) {
    taken.push(freeNumberSlot(taken));
    const boxes = taken.map((slot) => {
      const o = numberSlotOffset(slot);
      return { x: o.x, y: o.y, w: 24 * 3, h: 24 * 1.22 };
    });
    expect(new Set(taken).size).toBe(n);
    for (const [i, a] of boxes.entries())
      for (const b of boxes.slice(i + 1))
        expect(
          a.x < b.x + b.w &&
            b.x < a.x + a.w &&
            a.y < b.y + b.h &&
            b.y < a.y + a.h,
        ).toBe(false);
  }
  // a freed slot is reused before climbing higher
  expect(freeNumberSlot([0, 2])).toBe(1);
});
