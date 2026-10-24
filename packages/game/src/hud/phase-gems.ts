// The named rival's phase gems (D3 4.5): one gem per HP-gated phase, lit until it breaks. Presentation only: the model
// reads the read-only rivalRuntime of the state, so a bout without named phases yields nothing and draws nothing.
import { rivalRuntime, type ArenaState, type SlotSchool } from "@mage/core/arena";
import { frameGraphics } from "../pixi-fixes.ts";
import { colours } from "../ui/kit.ts";
import type { CanvasUI } from "../ui/ui.ts";

export interface PhaseGemsView {
  rivalId: string;
  school: SlotSchool;
  /** One entry per phase, in order: true once that phase has broken. */
  broken: boolean[];
  /** HP fraction at which the next phase breaks; undefined once every phase has broken. */
  nextAtHpFraction?: number;
}

/** The gems to show, or undefined when phases are off or no rival is bound (any non-named bout). */
export function phaseGems(state: ArenaState): PhaseGemsView | undefined {
  const rt = rivalRuntime(state),
    rival = rt?.rival;
  if (!rt || !rival) return undefined;
  const next = rival.phases[rt.phasesBroken];
  return {
    rivalId: rival.id,
    school: rival.school,
    broken: rival.phases.map((_, i) => i < rt.phasesBroken),
    ...(next ? { nextAtHpFraction: next.atHpFraction } : {}),
  };
}

const gemSize = 13,
  gemGap = 38,
  flashS = 0.7;

/** Draws the gem row with its right edge at `right`, baseline `y`; returns the per-frame update. */
export function phaseGemRow(
  u: CanvasUI,
  right: number,
  y: number,
  reduced: () => boolean,
): (state: ArenaState) => void {
  const g = frameGraphics();
  u.content.addChild(g);
  const label = u.text("", right, y - 14, 22, colours.muted, 400);
  let seen = 0,
    flashAt = -Infinity,
    flashIndex = -1;
  return (state) => {
    const view = phaseGems(state);
    g.clear();
    label.visible = !!view;
    if (!view) {
      seen = 0;
      return;
    }
    const nowS = performance.now() / 1000,
      broken = view.broken.filter(Boolean).length;
    if (broken > seen && !reduced()) {
      flashAt = nowS;
      flashIndex = broken - 1;
    }
    seen = broken;
    const colour = colours[view.school],
      n = view.broken.length,
      x0 = right - (n - 1) * gemGap - gemSize;
    label.text =
      view.nextAtHpFraction === undefined
        ? `${view.rivalId.toUpperCase()}  /  UNBROKEN NO MORE`
        : `${view.rivalId.toUpperCase()}  /  BREAKS AT ${Math.round(view.nextAtHpFraction * 100)}%`;
    label.x = right - label.width;
    view.broken.forEach((isBroken, i) => {
      const cx = x0 + i * gemGap,
        poly = [cx, y - gemSize, cx + gemSize, y, cx, y + gemSize, cx - gemSize, y];
      g.poly(poly).fill(
        isBroken ? { color: colours.panel, alpha: 0.9 } : { color: colour },
      ).stroke({ color: isBroken ? colours.edge : colours.gold, width: 2 });
      const age = nowS - flashAt;
      if (i === flashIndex && age >= 0 && age < flashS)
        g.poly(poly).fill({ color: colours.text, alpha: 0.9 * (1 - age / flashS) });
    });
  };
}
