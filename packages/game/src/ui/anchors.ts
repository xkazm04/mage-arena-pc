import { clampUiScale, metrics, type Edges, type Rect } from "./layout.ts";

/** Where a box sits inside an area: a corner, an edge midpoint or the centre. */
export type Edge =
  | "top-left"
  | "top"
  | "top-right"
  | "left"
  | "center"
  | "right"
  | "bottom-left"
  | "bottom"
  | "bottom-right";

export { uiScaleRange } from "./layout.ts";

/** The title-safe area of a stage, in design units (5% inset by default, `data/ui.json`). */
export function safeArea(
  width: number = metrics.designWidth,
  height: number = metrics.designHeight,
  fraction: number = metrics.safeFraction,
): Rect {
  const x = metrics.designWidth * fraction,
    y = metrics.designHeight * fraction;
  return { x, y, w: width - 2 * x, h: height - 2 * y };
}

/** A `w` x `h` box placed against `edge` of `area`, nudged by `dx`/`dy` (positive is right and down). */
export function anchor(
  area: Rect,
  edge: Edge,
  w: number,
  h: number,
  dx = 0,
  dy = 0,
): Rect {
  const horizontal = edge.endsWith("left")
      ? 0
      : edge.endsWith("right")
        ? 1
        : 0.5,
    vertical = edge.startsWith("top") ? 0 : edge.startsWith("bottom") ? 1 : 0.5;
  return {
    x: area.x + (area.w - w) * horizontal + dx,
    y: area.y + (area.h - h) * vertical + dy,
    w,
    h,
  };
}

/** The title-safe area of the whole viewport (its `edges`), so corner anchors reach the real screen edges. */
export function safeEdges(
  edges: Edges,
  fraction: number = metrics.safeFraction,
): Rect {
  const x = metrics.designWidth * fraction,
    y = metrics.designHeight * fraction;
  return {
    x: edges.left + x,
    y: edges.top + y,
    w: edges.right - edges.left - 2 * x,
    h: edges.bottom - edges.top - 2 * y,
  };
}

/** `count` equal columns across a span, separated by `gap`. */
export function columns(
  span: { x: number; w: number },
  count: number,
  gap: number,
): { x: number; w: number }[] {
  const w = (span.w - gap * (count - 1)) / count;
  return Array.from({ length: count }, (_, i) => ({
    x: span.x + i * (w + gap),
    w,
  }));
}

/** The pixel scale of the UI: the stage fit times the player's UI scale, clamped to its range. */
export function uiScale(fit: number, setting = 1): number {
  return fit * clampUiScale(setting);
}

/** Where the notice plate sits by default, in design units. */
export const noticeHome: Rect = { x: 450, y: 870, w: 1020, h: 120 };

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  );
}

function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x),
    h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * The notice plate's rect: its home slot, else the strip below it, else the top strip of the safe area, taking the
 * first that touches none of `avoid` (buttons and panel frames), or the one covering the least of them.
 */
export function noticeRect(avoid: readonly Rect[]): Rect {
  const top = metrics.designHeight * metrics.safeFraction;
  const slots = [
    noticeHome,
    { ...noticeHome, y: 930 },
    { ...noticeHome, y: top },
  ];
  let best = slots[0]!,
    bestArea = Infinity;
  for (const slot of slots) {
    const area = avoid.reduce((sum, r) => sum + overlapArea(slot, r), 0);
    if (area === 0) return slot;
    if (area < bestArea) [best, bestArea] = [slot, area];
  }
  return best;
}
