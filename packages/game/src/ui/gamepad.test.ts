import { describe, expect, it } from "vitest";
import { PadNavigation, stick, type Pad } from "./gamepad.ts";
function pad(down: number[] = [], axes = [0, 0, 0, 0]): Pad {
  return {
    connected: true,
    index: 0,
    axes,
    buttons: Array.from({ length: 17 }, (_, i) => ({
      pressed: down.includes(i),
      value: down.includes(i) ? 1 : 0,
    })),
  };
}
describe("TV standard gamepad", () => {
  it("only activates on an edge, releases on disconnect, and does not repeat accept", () => {
    const n = new PadNavigation();
    expect(n.poll(pad([0]), 0).accept).toBe(true);
    expect(n.poll(pad([0]), 500).accept).toBe(false);
    expect(n.poll(undefined, 600).release).toBe(true);
    expect(n.poll(pad([0]), 700).accept).toBe(true);
  });
  it("uses initial and held navigation delays, resets on neutral, and ignores drift", () => {
    const n = new PadNavigation();
    expect(n.poll(pad([], [0.1, 0.15]), 0).direction).toBeUndefined();
    expect(n.poll(pad([15]), 1).direction).toBe("right");
    expect(n.poll(pad([15]), 200).direction).toBeUndefined();
    expect(n.poll(pad([15]), 361).direction).toBe("right");
    expect(n.poll(pad([15]), 450).direction).toBeUndefined();
    expect(n.poll(pad(), 460).direction).toBeUndefined();
    expect(n.poll(pad([13]), 461).direction).toBe("down");
  });
  it("normalizes diagonal sticks and preserves analog magnitude above the dead zone", () => {
    expect(stick(pad([], [0.1, 0.1]), 0)).toEqual({ x: 0, y: 0 });
    const d = stick(pad([], [1, 1]), 0);
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(1);
    expect(stick(pad([], [0.5, 0]), 0).x).toBeGreaterThan(0);
    expect(stick(pad([], [0.5, 0]), 0).x).toBeLessThan(1);
  });
});
