// The opponent's school meter at its feet (D3 4.2 follow-up): a pure model of the Heat or Momentum arc the arena
// scene draws under a Fire or Air actor. Fill and marks come from the HUD's own identity reader, so they cannot drift.
import type { Actor, ArenaState, SlotSchool } from "@mage/core/arena";
import { resourceMeter } from "./hud/school-hud.ts";

export interface FeetMeter {
  school: SlotSchool;
  /** 0..1 of the school's range. */
  fill: number;
  /** The two threshold marks as 0..1 positions along the arc, low to high. */
  marks: number[];
  /** A lock (Air's Momentum lock) is active at this tick. */
  locked: boolean;
}

/** The feet meter for a Fire or Air actor; Water has no school state, so nothing. */
export function feetMeter(a: Actor, state: ArenaState): FeetMeter | undefined {
  const m = resourceMeter(a, state);
  if (!m) return undefined;
  const span = Math.max(1, m.max - m.min),
    unit = (v: number) => Math.min(1, Math.max(0, (v - m.min) / span));
  return {
    school: m.school,
    fill: unit(m.value),
    marks: m.marks.map((k) => unit(k.at)),
    locked: state.tick < (a.schoolState?.lockedUntil ?? 0),
  };
}

/** Points along the lower front arc of an ellipse centred `(cx, cy)`, for t in 0..1 (left to right, below the feet). */
export function feetArcPoint(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  t: number,
) {
  const angle = Math.PI * (0.1 + 0.8 * t);
  return { x: cx - Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry };
}
