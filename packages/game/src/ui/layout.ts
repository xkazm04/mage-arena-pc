import metrics from "../../data/ui.json" with { type: "json" };
export { metrics };
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Target extends Rect {
  id: string;
  disabled?: boolean;
}
export const contains = (r: Rect, x: number, y: number) =>
  x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h;
export function viewportLayout(width: number, height: number) {
  const scale = Math.min(
    width / metrics.designWidth,
    height / metrics.designHeight,
  );
  return {
    scale,
    x: (width - metrics.designWidth * scale) / 2,
    y: (height - metrics.designHeight * scale) / 2,
    safe: {
      x: metrics.designWidth * metrics.safeFraction,
      y: metrics.designHeight * metrics.safeFraction,
      w: metrics.designWidth * (1 - 2 * metrics.safeFraction),
      h: metrics.designHeight * (1 - 2 * metrics.safeFraction),
    },
  };
}
export function nextFocus(
  targets: Target[],
  current: string,
  direction: "left" | "right" | "up" | "down" | "next" | "previous",
): string {
  const enabled = targets.filter((t) => !t.disabled);
  if (!enabled.length) return "";
  const index = enabled.findIndex((t) => t.id === current);
  if (index < 0) return enabled[0]!.id;
  if (direction === "next" || direction === "previous")
    return enabled[
      (index + (direction === "next" ? 1 : -1) + enabled.length) %
        enabled.length
    ]!.id;
  const from = enabled[index]!,
    horizontal = direction === "left" || direction === "right",
    sign = direction === "left" || direction === "up" ? -1 : 1;
  let best = current,
    score = Infinity;
  for (const to of enabled) {
    if (to.id === current) continue;
    const dx = to.x + to.w / 2 - from.x - from.w / 2,
      dy = to.y + to.h / 2 - from.y - from.h / 2;
    const forward = (horizontal ? dx : dy) * sign,
      lateral = Math.abs(horizontal ? dy : dx);
    if (forward <= 1) continue;
    const candidate =
      forward + lateral * 3 + (lateral * lateral) / Math.max(1, forward);
    if (candidate < score) {
      best = to.id;
      score = candidate;
    }
  }
  return best;
}
