import { describe, expect, it } from "vitest";
import { chipLayout, NAV_CLEARANCE, overlaps, MARKER_SIZE } from "./camp-chip-layout.ts";

const NAV_BOTTOM = 273;
const button = { x: 305, y: 306, w: 272, h: 80 };
const panel = { x: 96, y: 806, w: 1728, h: 72 };

describe("chipLayout (D3 4.3 polish)", () => {
  it("puts the row above the button when there is room", () => {
    const l = chipLayout({ ...button, y: 540 }, 2, NAV_BOTTOM, [panel]);
    expect(l.side).toBe("above");
    expect(l.chips).toHaveLength(2);
    expect(l.marker).toBeUndefined();
  });
  it("falls back below the button when above would crowd the nav row", () => {
    const l = chipLayout(button, 3, NAV_BOTTOM, [button, panel]);
    expect(l.side).toBe("below");
    expect(l.bounds.y).toBeGreaterThanOrEqual(button.y + button.h);
  });
  it("falls back beside the button when above and below are taken", () => {
    const blocker = { x: button.x, y: button.y + button.h, w: 272, h: 80 };
    const l = chipLayout(button, 3, NAV_BOTTOM, [button, blocker, panel]);
    expect(l.side).toBe("right");
  });
  it("never lets a row sit within the nav clearance", () => {
    for (const y of [200, 280, 306, 320, 340]) {
      const l = chipLayout({ ...button, y }, 5, NAV_BOTTOM, []);
      expect(l.bounds.y).toBeGreaterThanOrEqual(NAV_BOTTOM + NAV_CLEARANCE);
    }
  });
  it("gives the +n marker a 28px font on a plate that does not touch a chip", () => {
    const l = chipLayout({ ...button, y: 540 }, 6, NAV_BOTTOM, []);
    expect(l.marker!.size).toBeGreaterThanOrEqual(28);
    expect(MARKER_SIZE).toBeGreaterThanOrEqual(28);
    expect(l.chips).toHaveLength(3);
    for (const c of l.chips) expect(overlaps(c, l.marker!.plate)).toBe(false);
    expect(l.marker!.plate.x).toBeGreaterThanOrEqual(l.marker!.x - 10);
    expect(l.marker!.y).toBeGreaterThanOrEqual(l.marker!.plate.y);
  });
  it("is deterministic", () => {
    expect(chipLayout(button, 4, NAV_BOTTOM, [button])).toEqual(chipLayout(button, 4, NAV_BOTTOM, [button]));
  });
});
