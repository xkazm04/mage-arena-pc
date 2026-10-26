import type { Rect } from "../ui/layout.ts";

/** Portrait chips on the camp map: at most this many, the rest are a +n marker. */
export const CHIPS = 3;
export const CHIP_W = 40;
export const CHIP_H = 48;
export const CHIP_PITCH = 44;
/** Clear space the chips and the marker keep below the nav row. */
export const NAV_CLEARANCE = 8;
export const MARKER_SIZE = 28;
const GAP = 6;
const INSET = 6;
const PLATE_W = 68;
const PLATE_H = 40;
const STAGE: Rect = { x: 0, y: 0, w: 1920, h: 1080 };

export type ChipSide = "above" | "below" | "right" | "left";
export interface ChipLayout {
  side: ChipSide;
  chips: Rect[];
  /** The +n marker: its text origin and size, and the plate drawn under it. */
  marker?: { plate: Rect; x: number; y: number; size: number };
  /** The bounding box of every chip and the marker. */
  bounds: Rect;
}

export const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** The row of `count` people with its top-left at (x, y): chips, then the marker plate when some are over the cap. */
function row(x: number, y: number, count: number, side: ChipSide): ChipLayout {
  const shown = Math.min(count, CHIPS);
  const chips = Array.from({ length: shown }, (_, i) => ({ x: x + INSET + i * CHIP_PITCH, y, w: CHIP_W, h: CHIP_H }));
  const layout: ChipLayout = { side, chips, bounds: { x, y, w: 0, h: CHIP_H } };
  let right = chips.length ? chips[chips.length - 1]!.x + CHIP_W : x;
  if (count > CHIPS) {
    const plate = { x: right + INSET, y: y + (CHIP_H - PLATE_H) / 2, w: PLATE_W, h: PLATE_H };
    layout.marker = { plate, x: plate.x + 10, y: plate.y + 3, size: MARKER_SIZE };
    right = plate.x + PLATE_W;
  }
  layout.bounds.w = right - x;
  return layout;
}

/**
 * Where a place's presence chips go. One rule: try above the button, then below, then to its right, then to its left, and
 * take the first row that is on the stage, at least NAV_CLEARANCE below the nav row and clear of every obstacle (the place
 * buttons, the selected-place panel, other places' chips). If none fits, the row overlapping the least is used.
 */
export function chipLayout(place: Rect, count: number, navBottom: number, obstacles: Rect[]): ChipLayout {
  const minY = navBottom + NAV_CLEARANCE;
  const midY = place.y + (place.h - CHIP_H) / 2;
  const w = row(0, 0, count, "above").bounds.w;
  const candidates = [
    row(place.x, place.y - GAP - CHIP_H, count, "above"),
    row(place.x, place.y + place.h + GAP, count, "below"),
    row(place.x + place.w + GAP, midY, count, "right"),
    row(place.x - GAP - w, midY, count, "left"),
  ];
  const cost = (c: ChipLayout) => {
    const b = c.bounds;
    const outside = Math.max(0, minY - b.y) + Math.max(0, STAGE.x - b.x) + Math.max(0, b.x + b.w - STAGE.w) + Math.max(0, b.y + b.h - STAGE.h);
    return outside * 1000 + obstacles.filter((o) => overlaps(b, o)).length;
  };
  return candidates.find((c) => cost(c) === 0) ?? candidates.reduce((best, c) => (cost(c) < cost(best) ? c : best));
}
