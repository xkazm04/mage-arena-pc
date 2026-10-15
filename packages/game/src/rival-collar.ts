import {
  combat,
  seconds,
  tuningFor,
  type Actor,
  type ArenaState,
  type Vec,
} from "@mage/core/arena";
import policy from "../data/rival-collar.json" with { type: "json" };

export interface CollarClock {
  tier: number;
  untilS: number;
  progress: number;
}
/** The kernel's updateClock condition read as a countdown: wave time plus perfect advance against the interval, floored by the minimum gap between unlocks. */
export function collarClock(state: ArenaState, a: Actor): CollarClock {
  const tier = a.tier,
    interval = tuningFor(state).collarIntervalS;
  if (tier >= 4) return { tier, untilS: 0, progress: 1 };
  const elapsed = seconds(state.tick - a.waveStartTick + a.clockAdvanceTicks);
  const untilS = Math.max(
    0,
    tier * interval - elapsed,
    combat.tierClock.minimumSecondsBetweenUnlocks -
      seconds(state.tick - a.lastUnlockTick),
  );
  return { tier, untilS, progress: 1 - untilS / interval };
}

export interface RivalRune extends CollarClock {
  actorId: number;
  /** Rune I-IV, in the HUD clock's order. */
  lit: boolean[];
  /** Seconds since the latest unlock; undefined while only rune I is awake. */
  unlockAgeS?: number;
}
/** Only mage duelists carry a readable collar; soldiers and creatures run the clock but never show it. */
export function rivalRune(
  state: ArenaState,
  a: Actor,
  viewer: Actor,
): RivalRune | undefined {
  if (!a.mageAI || a.team === viewer.team || a.tags.includes("DEFEATED"))
    return;
  const clock = collarClock(state, a);
  return {
    ...clock,
    actorId: a.id,
    lit: [0, 1, 2, 3].map((i) => i < clock.tier),
    unlockAgeS:
      clock.tier > 1 ? seconds(state.tick - a.lastUnlockTick) : undefined,
  };
}
export function rivalRunes(state: ArenaState, viewer: Actor): RivalRune[] {
  return state.actors.flatMap((a) => rivalRune(state, a, viewer) ?? []);
}

/** Rune i sits on the front arc of the foot ring, west to east, so the figure never hides it. */
export function runeOffset(i: number): Vec {
  const deg =
    policy.arcStartDeg + ((policy.arcEndDeg - policy.arcStartDeg) * i) / 3;
  const r = (deg * Math.PI) / 180;
  return { x: Math.cos(r) * policy.radiusM, y: Math.sin(r) * policy.radiusM };
}
/** Crop of rune i (N, E, S, W on the painted inscription) in frame UV. */
export function runeCrop(i: number): [number, number, number, number] {
  const a = -Math.PI / 2 + (i * Math.PI) / 2,
    s = policy.runeCropUV;
  return [
    0.5 + Math.cos(a) * policy.runeCentreUV - s / 2,
    0.5 + Math.sin(a) * policy.runeCentreUV - s / 2,
    s,
    s,
  ];
}
/** Brightness pulse of the newest rune; flat under reduced motion. */
export function unlockPulse(rune: RivalRune, reduced: boolean): number {
  if (reduced || rune.unlockAgeS === undefined) return 0;
  const t = rune.unlockAgeS / policy.unlockPulseS;
  return t >= 1 ? 0 : 1 - t;
}
export { policy as rivalCollarPolicy };
