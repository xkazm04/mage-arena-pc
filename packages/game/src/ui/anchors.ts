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

/** UI scale bounds for the settings option (1 = the authored design size). */
export const uiScaleRange = { min: 0.75, max: 1.5 } as const;

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
  const s = Number.isFinite(setting) ? setting : 1;
  return fit * Math.min(uiScaleRange.max, Math.max(uiScaleRange.min, s));
}
