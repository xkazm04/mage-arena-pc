// The opponent's rune meter at its feet (D3 4.2 follow-up, W8 A2): the player meter's own MeterView (resourceMeter)
// and fraction (meterFraction), drawn as a thin arc on the ground plane in front of a Fire or Air opponent. It sits just
// outside the target ring and the 1.5x body circle, on the scene's ground layer, so every figure draws over it and the
// ring stays clear. Water has no school state, so no meter: Flow keeps its panel.
import type { Graphics } from "pixi.js";
import type { Actor, ArenaState, SlotSchool } from "@mage/core/arena";
import {
  cameraMetrics,
  contract,
  groundToScreen,
  type Camera,
  type Point,
} from "../camera.ts";
import { colours } from "../ui/kit.ts";
import { meterFraction, resourceMeter, type MeterView } from "./school-hud.ts";

/** The target ring's radius under an opponent, in metres (the scene's "target" sigil). */
export const targetRingM = 0.75;
/** Ground metres between the ring (or the 1.5x body circle, if wider) and the inner edge of the meter. */
const gapM = 0.08;
/** The arc runs across the front of the feet, west to east (ground degrees, +y toward the camera). */
const arc = { fromDeg: 160, toDeg: 20, steps: 16 };

/** The MeterView a living opposing Fire or Air actor wears at its feet; undefined otherwise. */
export function opponentMeter(
  a: Actor,
  player: Actor,
  state: ArenaState,
): MeterView | undefined {
  if (a.team === player.team || a.tags.includes("DEFEATED")) return undefined;
  return resourceMeter(a, state);
}

export interface FeetMeterShape {
  school: SlotSchool;
  /** The point at fraction t (0..1, left to right) along the arc. */
  point: (t: number) => Point;
  track: Point[];
  /** The filled part of the track, from the left end to the value; empty at the range's floor. */
  fill: Point[];
  marks: { at: Point; reached: boolean; size: number }[];
  locked: boolean;
  trackWidth: number;
  fillWidth: number;
}

/** The meter's screen geometry for `view` at the ground point `foot`. */
export function feetMeterShape(
  view: MeterView,
  locked: boolean,
  foot: Point,
  c: Camera,
  bodyRadiusM = 0,
): FeetMeterShape {
  const m = cameraMetrics(c),
    trackWidth = m.outlinePx,
    fillWidth = m.outlinePx * (locked ? 1 : 0.75),
    size = m.outlinePx * 0.9,
    // Clear of the ring by the gap plus the larger of the stroke and the mark, on the foreshortened axis.
    radiusM =
      Math.max(
        targetRingM,
        bodyRadiusM * contract.character.draw_multiplier,
      ) +
      gapM +
      Math.max(trackWidth / 2, size) / m.pxPerMetreY,
    point = (t: number) => {
      const r =
        ((arc.fromDeg + (arc.toDeg - arc.fromDeg) * t) * Math.PI) / 180;
      return groundToScreen(
        {
          x: foot.x + Math.cos(r) * radiusM,
          y: foot.y + Math.sin(r) * radiusM,
        },
        c,
      );
    },
    along = (to: number) =>
      Array.from({ length: arc.steps + 1 }, (_, i) =>
        point((to * i) / arc.steps),
      ),
    value = meterFraction(view, view.value);
  return {
    school: view.school,
    point,
    track: along(1),
    fill: value > 0 ? along(value) : [],
    marks: view.marks.map((k) => ({
      at: point(meterFraction(view, k.at)),
      reached: view.value >= k.at,
      size,
    })),
    locked,
    trackWidth,
    fillWidth,
  };
}

/**
 * Draws the meter for `a` at `foot` onto the ground layer and returns its shape, or undefined when `a` wears none.
 * A lock (Air's Momentum lock) is a steady brighter fill, never a pulse. Marks are the HUD meter's diamonds.
 */
export function drawFeetMeter(
  g: Graphics,
  a: Actor,
  player: Actor,
  state: ArenaState,
  foot: Point,
  c: Camera,
): FeetMeterShape | undefined {
  const view = opponentMeter(a, player, state);
  if (!view) return undefined;
  const shape = feetMeterShape(
      view,
      state.tick < (a.schoolState?.lockedUntil ?? 0),
      foot,
      c,
      a.radius,
    ),
    trace = (points: Point[]) =>
      points.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
  // The HUD meter's track (edge at 0.45) reads too faint on the stone, so it sits on an ink underlay here.
  trace(shape.track);
  g.stroke({
    color: colours.ink,
    width: shape.trackWidth,
    alpha: 0.55,
    cap: "round",
  });
  trace(shape.track);
  g.stroke({
    color: colours.edge,
    width: shape.trackWidth * 0.45,
    alpha: 0.8,
    cap: "round",
  });
  if (shape.fill.length) {
    trace(shape.fill);
    g.stroke({
      color: shape.locked ? colours.text : colours[shape.school],
      width: shape.fillWidth,
      cap: "round",
    });
  }
  for (const { at, reached, size } of shape.marks)
    g.poly([at.x, at.y - size, at.x + size, at.y, at.x, at.y + size, at.x - size, at.y])
      .fill(reached ? colours.gold : colours.panel)
      .stroke({ color: colours.gold, width: size * 0.3 });
  return shape;
}
