// The Heat and Momentum rune meter (W8 A2): a curved track drawn procedurally around the school's a13 glyph over a
// faint collar inscription, marked at the identity's thresholds (Heat 50/80, Momentum 40/80). Replaces the text panel
// for the school resources; Water keeps its Flow panel.
import { colours } from "../ui/kit.ts";
import { frameGraphics } from "../pixi-fixes.ts";
import { sigil } from "../ui/artwork.ts";
import type { CanvasUI } from "../ui/ui.ts";
import { meterFraction, meterLayout, type MeterView } from "./school-hud.ts";

const sweep = { from: Math.PI + 0.3, to: Math.PI * 2 - 0.3 };

/** Draws the meter inside the panel at `x, y` (240 x 160) and returns its per-frame update. */
export function runeMeter(
  u: CanvasUI,
  first: MeterView,
  x: number,
  y: number,
): (view: MeterView) => void {
  const cx = x + 120,
    cy = y + 92,
    r = 76,
    colour = colours[first.school];
  sigil(u, "inscription.collar", cx, cy - 30, 90, 0.22);
  u.icon(first.school, cx, cy - 34, 16, u.content, colour);
  const arc = frameGraphics();
  u.content.addChild(arc);
  const label = u.text(
      "",
      cx,
      y + meterLayout.label.y,
      meterLayout.label.size,
      colour,
    ),
    mark = u.text(
      "",
      cx,
      y + meterLayout.mark.y,
      meterLayout.mark.size,
      colours.muted,
    );
  const at = (value: number, view: MeterView) =>
    sweep.from + (sweep.to - sweep.from) * meterFraction(view, value);
  return (view) => {
    label.text = `${view.label}  ${Math.round(view.value)}`;
    mark.text = view.reached
      ? view.reached.name
      : `${view.marks[0]?.name ?? ""} at ${view.marks[0]?.at ?? ""}`;
    mark.style.fill = view.reached ? colours.gold : colours.muted;
    label.x = cx - label.width / 2;
    mark.x = cx - mark.width / 2;
    arc
      .clear()
      .arc(cx, cy, r, sweep.from, sweep.to)
      .stroke({ color: colours.edge, width: 10, alpha: 0.45, cap: "round" });
    if (view.value > view.min)
      arc
        .arc(cx, cy, r, sweep.from, at(view.value, view))
        .stroke({ color: colour, width: 8, cap: "round" });
    for (const m of view.marks) {
      const a = at(m.at, view),
        reached = view.value >= m.at,
        px = cx + Math.cos(a) * r,
        py = cy + Math.sin(a) * r;
      arc
        .moveTo(cx + Math.cos(a) * (r - 14), cy + Math.sin(a) * (r - 14))
        .lineTo(cx + Math.cos(a) * (r + 12), cy + Math.sin(a) * (r + 12))
        .stroke({ color: reached ? colours.gold : colours.muted, width: 2 });
      arc
        .poly([px, py - 7, px + 6, py, px, py + 7, px - 6, py])
        .fill(reached ? colours.gold : colours.panel)
        .stroke({ color: colours.gold, width: 1.5 });
    }
  };
}
