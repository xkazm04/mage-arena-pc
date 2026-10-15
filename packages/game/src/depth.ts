import type { Container } from "pixi.js";

/**
 * Ground depth (foot y, metres) of the figures layer's children. Kept outside Pixi's `zIndex`: every zIndex change,
 * however small, rebuilds the whole stage's render instructions (~4.5 ms a frame on the Fire TV), while the order
 * itself changes only when two figures cross.
 */
const depths = new WeakMap<Container, number>();
export function setDepth(c: Container, y: number) {
  depths.set(c, y);
}
export function depthOf(c: Container): number {
  return depths.get(c) ?? 0;
}
/** Stable by current order, as Pixi's zIndex sort was; restructures the parent only when the order changes. */
export function orderByDepth(parent: Container) {
  const kids = parent.children;
  for (let i = 1; i < kids.length; i++)
    if (depthOf(kids[i - 1]!) > depthOf(kids[i]!)) {
      const order = kids.toSorted((a, b) => depthOf(a) - depthOf(b));
      order.forEach((c, j) => {
        if (kids[j] !== c) parent.setChildIndex(c, j);
      });
      return;
    }
}
