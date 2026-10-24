import type { Edges } from "../ui/layout.ts";

/**
 * Corner clusters sit against the real screen edges: `dl` moves a left-edge item out, `dr` a right-edge item (in design
 * units; both are 0 at 16:9 and UI scale 1).
 */
export function hudAnchors(edges: Edges) {
  return { dl: edges.left, dr: edges.right - 1920 };
}
/** Changes when a resize or a UI scale change moves the viewport edges, so a built HUD knows it is stale. */
export const edgeKey = (e: Edges) =>
  [e.left, e.top, e.right, e.bottom].map((v) => v.toFixed(2)).join(",");
