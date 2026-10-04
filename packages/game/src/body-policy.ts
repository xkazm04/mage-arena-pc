import type { Actor } from "@mage/core/arena";
import type { Body, BodyState, Clip, Direction } from "./animation-contract.ts";
import policy from "../data/animation.json" with { type: "json" };

const directions: Direction[] = ["ne", "se", "sw", "nw"];
export interface BodySelection {
  state: BodyState;
  direction: Direction;
  clip: Clip;
  held: boolean;
}
export function bodyIdentity(a: Actor): string {
  if (a.enemy) return a.enemy.id;
  if (a.dummy) return "dummy";
  if (a.school) return policy.schoolBodies[a.school];
  const name = a.label.toLowerCase();
  for (const id of Object.values(policy.schoolBodies))
    if (name === id) return id;
  // Anonymous Tiro entrants are explicitly Water proxies in core.
  return name === "water mage" || name === "tiro entrant ? water proxy"
    ? "cassia"
    : "mage.unknown";
}
/** No access to other entities: a fallback cannot change creature identity. */
export function selectBodyClip(
  body: Body | undefined,
  state: BodyState,
  direction: Direction,
  previous?: BodySelection,
): BodySelection | undefined {
  if (!body) return;
  const direct = body.clips[state]?.[direction];
  if (direct) return { state, direction, clip: direct, held: false };
  const distance = (d: Direction) => {
    const n = Math.abs(directions.indexOf(direction) - directions.indexOf(d));
    return Math.min(n, 4 - n);
  };
  const ordered = [...directions].sort(
    (a, b) =>
      distance(a) - distance(b) ||
      Number(b === previous?.direction) - Number(a === previous?.direction),
  );
  for (const d of ordered) {
    const clip = body.clips[state]?.[d];
    if (clip) return { state, direction: d, clip, held: false };
  }
  if ((state === "death" || state === "corpse") && previous)
    return { ...previous, held: true };
  for (const fallback of policy.compatibleStates[state] as BodyState[])
    for (const d of ordered) {
      const clip = body.clips[fallback]?.[d];
      if (clip) return { state: fallback, direction: d, clip, held: true };
    }
  return;
}

/** A corpse must match the death's facing; a nearest-direction lookup would pop at settle. */
export function corpseForDeath(
  body: Body | undefined,
  death: BodySelection,
): BodySelection {
  const clip = body?.clips.corpse?.[death.direction];
  return death.state === "death" && !death.held && clip
    ? { state: "corpse", direction: death.direction, clip, held: false }
    : death;
}
