// Pure per-shot assertions over a `__ui.snapshot()`: the same rules every canvas tour re-typed,
// testable without a browser. Each returns the violations as strings; [] means the shot passes.
import { nextFocus, type Target } from "../../../game/src/ui/layout.ts";

export interface Viewport {
  width: number;
  height: number;
}

/** Buttons in screen pixels, as the snapshot reports them. */
export type ShotButton = Target;

/** Outside the 5% safe area of the 16:9 stage, or a target under 64 px at 1080p (scaled with the height). */
export function shotViolations(s: { buttons: readonly ShotButton[] }, { height }: Viewport): string[] {
  const stage = (height * 16) / 9,
    min = (64 * height) / 1080,
    out: string[] = [];
  for (const b of s.buttons) {
    if (
      b.x < stage * 0.05 - 1 ||
      b.y < height * 0.05 - 1 ||
      b.x + b.w > stage * 0.95 + 1 ||
      b.y + b.h > height * 0.95 + 1
    )
      out.push(`${b.id} outside safe area`);
    if (b.w < min || b.h < min) out.push(`${b.id} target too small`);
  }
  return out;
}

/** Enabled controls the D-pad cannot reach from the first enabled one, walking nextFocus in four directions. */
export function unreachable(buttons: readonly ShotButton[]): string[] {
  const enabled = buttons.filter((b) => !b.disabled),
    seen = new Set<string>(enabled.length ? [enabled[0]!.id] : []),
    queue = [...seen];
  for (let i = 0; i < queue.length; i++)
    for (const direction of ["left", "right", "up", "down"] as const) {
      const id = nextFocus([...buttons], queue[i]!, direction);
      if (id && !seen.has(id)) {
        seen.add(id);
        queue.push(id);
      }
    }
  return enabled.filter((b) => !seen.has(b.id)).map((b) => b.id);
}

interface Placed {
  layout: { x: number; y: number; scale: number };
  texts: readonly { text: string; x: number; y: number; w: number; h: number }[];
  buttons: readonly ShotButton[];
}

/** Non-empty text (design units, placed through the layout) and buttons (screen pixels) outside the viewport. */
export function outsideViewport(s: Placed, w: number, h: number): string[] {
  const out: string[] = [];
  for (const t of s.texts) {
    if (!t.text) continue;
    const x = s.layout.x + t.x * s.layout.scale,
      y = s.layout.y + t.y * s.layout.scale;
    if (x < 0 || y < 0 || x + t.w * s.layout.scale > w + 1 || y + t.h * s.layout.scale > h + 1)
      out.push(`text "${t.text}"`);
  }
  for (const b of s.buttons) if (b.x < 0 || b.y < 0 || b.x + b.w > w + 1 || b.y + b.h > h + 1) out.push(`button ${b.id}`);
  return out;
}
