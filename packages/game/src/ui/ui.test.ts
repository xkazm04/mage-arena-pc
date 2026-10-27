import { describe, expect, it } from "vitest";
import { nextFocus, viewportLayout } from "./layout.ts";
import {
  anchor,
  columns,
  noticeHome,
  noticeRect,
  rectsIntersect,
  safeArea,
  safeEdges,
  uiScale,
} from "./anchors.ts";
import { requiredRegions, validateAtlas } from "./kit.ts";
describe("canvas UI contracts", () => {
  it("preserves a five percent safe rectangle at 1080p and 1440p", () => {
    for (const h of [1080, 1440]) {
      const l = viewportLayout((h * 16) / 9, h);
      expect(l.safe.x * l.scale).toBeCloseTo(((h * 16) / 9) * 0.05);
      expect(l.safe.y * l.scale).toBeCloseTo(h * 0.05);
      expect(l.x).toBe(0);
      expect(l.y).toBe(0);
    }
  });
  it("navigates spatially, skips disabled controls and wraps tab order", () => {
    const items = [
      { id: "a", x: 0, y: 0, w: 100, h: 60 },
      { id: "blocked", x: 110, y: 0, w: 100, h: 60, disabled: true },
      { id: "b", x: 220, y: 0, w: 100, h: 60 },
      { id: "c", x: 0, y: 100, w: 100, h: 60 },
    ];
    expect(nextFocus(items, "a", "right")).toBe("b");
    expect(nextFocus(items, "a", "down")).toBe("c");
    expect(nextFocus(items, "c", "next")).toBe("a");
    expect(nextFocus(items, "a", "previous")).toBe("c");
    expect(nextFocus(items, "deleted", "down")).toBe("a");
  });
  it("rejects corrupt atlas geometry before creating any textures", () => {
    const frame = {
      page: "a",
      rect: [0, 0, 100, 100],
      anchor: [0, 0],
      nineSlice: [12, 12, 12, 12],
    };
    const valid = {
      schemaVersion: 1,
      designSize: [1920, 1080],
      pages: [
        { id: "a", file: "a.png", size: [128, 128], sha256: "a".repeat(64) },
      ],
      regions: Object.fromEntries(requiredRegions.map((id) => [id, frame])),
    };
    expect(validateAtlas(valid)).toEqual(valid);
    for (const rect of [
      [-1, 0, 10, 10],
      [0, 0, 0, 10],
      [0, 0, 10, 10],
      [NaN, 0, 10, 10],
      [100, 0, 100, 100],
    ])
      expect(() =>
        validateAtlas({
          ...valid,
          regions: { ...valid.regions, "panel.body": { ...frame, rect } },
        }),
      ).toThrow();
    expect(() => validateAtlas({ ...valid, regions: {} })).toThrow(
      "Missing required",
    );
    for (const bad of [
      { anchor: [] },
      { anchor: [0] },
      { minSize: [NaN, 64] },
      { contentInsets: [60, 0, 60, 0] },
      { contentInsets: [-1, 0, 0, 0] },
    ])
      expect(() =>
        validateAtlas({
          ...valid,
          regions: { ...valid.regions, "panel.body": { ...frame, ...bad } },
        }),
      ).toThrow();
    expect(() =>
      validateAtlas({ ...valid, pages: [...valid.pages, ...valid.pages] }),
    ).toThrow("Duplicate UI page");
  });
});
describe("layout helper", () => {
  it("derives the safe area from the design metrics", () => {
    expect(safeArea()).toEqual({ x: 96, y: 54, w: 1728, h: 972 });
    expect(safeArea(2520, 1080)).toEqual({ x: 96, y: 54, w: 2328, h: 972 });
  });
  it("anchors boxes to edges, corners and the centre", () => {
    const area = safeArea();
    expect(anchor(area, "top-left", 200, 60)).toEqual({
      x: 96,
      y: 54,
      w: 200,
      h: 60,
    });
    expect(anchor(area, "bottom-right", 250, 68)).toEqual({
      x: 1574,
      y: 958,
      w: 250,
      h: 68,
    });
    expect(anchor(area, "center", 100, 100)).toEqual({
      x: 910,
      y: 490,
      w: 100,
      h: 100,
    });
    expect(anchor(area, "bottom-left", 236, 68, 0, -12).y).toBe(946);
  });
  it("splits a span into equal columns that keep today's screen grid", () => {
    const area = safeArea();
    expect(columns(area, 4, 32)).toEqual(
      [0, 1, 2, 3].map((i) => ({ x: 96 + i * 440, w: 408 })),
    );
    expect(columns(area, 2, 32)).toEqual(
      [0, 1].map((i) => ({ x: 96 + i * 880, w: 848 })),
    );
  });
  it("clamps the UI scale setting", () => {
    expect(uiScale(1.5)).toBe(1.5);
    expect(uiScale(1, 2)).toBe(1.5);
    expect(uiScale(1, 0.5)).toBe(0.75);
    expect(uiScale(1, Number.NaN)).toBe(1);
  });
});
describe("viewport layout", () => {
  it("is the design stage at 1920x1080", () => {
    const l = viewportLayout(1920, 1080);
    expect(l.scale).toBe(1);
    expect([l.x, l.y]).toEqual([0, 0]);
    expect(l.edges).toEqual({ left: 0, top: 0, right: 1920, bottom: 1080 });
  });
  it("scales 16:9 with no extra edge at 2560x1440", () => {
    const l = viewportLayout(2560, 1440);
    expect(l.scale).toBeCloseTo(4 / 3);
    expect(l.edges.left).toBeCloseTo(0);
    expect(l.edges.right).toBeCloseTo(1920);
  });
  it("reports wider edges at 21:9 while content keeps the 16:9 stage", () => {
    const l = viewportLayout(3440, 1440);
    expect(l.scale).toBeCloseTo(4 / 3);
    expect(l.x).toBeCloseTo(440);
    expect(l.edges.left).toBeCloseTo(-330);
    expect(l.edges.right).toBeCloseTo(2250);
    expect(l.edges.top).toBeCloseTo(0);
    expect(l.edges.bottom).toBeCloseTo(1080);
    expect(safeEdges(l.edges).x).toBeCloseTo(-234);
    expect(safeEdges(viewportLayout(1920, 1080).edges)).toEqual(safeArea());
  });
  it("multiplies the layout scale by the clamped UI scale", () => {
    const l = viewportLayout(1920, 1080, 1.25);
    expect(l.scale).toBeCloseTo(1.25);
    expect(l.edges.left).toBeCloseTo(192);
    expect(l.edges.right).toBeCloseTo(1728);
    expect(viewportLayout(1920, 1080, 9).scale).toBe(1.5);
  });
});

describe("notice plate", () => {
  // the bout results screen (screens/results.ts): panels and buttons
  const results = [
    { x: 1080, y: 270, w: 750, h: 650 },
    { x: 250, y: 270, w: 790, h: 350 },
    { x: 250, y: 650, w: 790, h: 76 },
    { x: 1130, y: 710, w: 650, h: 76 },
    { x: 1130, y: 812, w: 650, h: 76 },
  ];
  it("home slot collides with the results screen, so the plate moves", () => {
    expect(results.some((r) => rectsIntersect(noticeHome, r))).toBe(true);
    const plate = noticeRect(results);
    expect(results.some((r) => rectsIntersect(plate, r))).toBe(false);
    expect(plate.y + plate.h).toBeLessThanOrEqual(1080);
  });
  it("stays home when nothing is in the way", () => {
    expect(noticeRect([{ x: 0, y: 0, w: 400, h: 300 }])).toEqual(noticeHome);
  });
});
