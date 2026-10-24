import { describe, expect, it } from "vitest";
import { viewportLayout } from "./ui/layout.ts";
import { edgeKey, hudAnchors } from "./hud/hud-anchors.ts";

const sizes = [
  ["1080p", 1920, 1080],
  ["1440p", 2560, 1440],
  ["21:9", 3440, 1440],
] as const;
/** The arena HUD's corner clusters: [design x of the left edge of the left cluster, design x of the right edge of the right one]. */
const clusters = (width: number, height: number) => {
  const { edges } = viewportLayout(width, height),
    { dl, dr } = hudAnchors(edges);
  return { edges, left: 96 + dl, right: 1644 + dr + 180 };
};

describe("arena HUD anchoring", () => {
  it.each(sizes)(
    "%s: the corner clusters keep the 96 unit margin from the real edges",
    (_, w, h) => {
      const { edges, left, right } = clusters(w, h);
      expect(left - edges.left).toBeCloseTo(96, 6);
      expect(edges.right - right).toBeCloseTo(96, 6);
    },
  );
  it("is the build-time layout at 16:9 and reaches the edges at 21:9", () => {
    expect(hudAnchors(viewportLayout(1920, 1080).edges)).toEqual({
      dl: 0,
      dr: 0,
    });
    expect(hudAnchors(viewportLayout(2560, 1440).edges).dl).toBeCloseTo(0, 6);
    const wide = hudAnchors(viewportLayout(3440, 1440).edges);
    expect(wide.dl).toBeCloseTo(-330, 6);
    expect(wide.dr).toBeCloseTo(330, 6);
  });
  it("keeps every cluster inside the viewport at each size", () => {
    for (const [, w, h] of sizes) {
      const { edges, left, right } = clusters(w, h);
      expect(left).toBeGreaterThanOrEqual(edges.left);
      expect(right).toBeLessThanOrEqual(edges.right);
    }
  });
  it("flags a built HUD as stale after a resize or a UI scale change, and not otherwise", () => {
    const key = (w: number, h: number, ui = 1) =>
      edgeKey(viewportLayout(w, h, ui).edges);
    expect(key(1920, 1080)).toBe(key(1920, 1080));
    expect(key(1920, 1080)).not.toBe(key(3440, 1440));
    expect(key(2560, 1440)).toBe(key(1920, 1080));
    expect(key(1920, 1080, 1.15)).not.toBe(key(1920, 1080));
  });
});
