import { scaleContract } from './data.generated.ts';
import runtime from './data/runtime.json' with { type: 'json' };
import type { Vec } from './math.ts';
export const arenaGeometry = { centre: runtime.geometry.arenaCentre, widthM: scaleContract.arena_metres[0], heightM: scaleContract.arena_metres[1] };
function axes(inset: number): Vec {
  const rx = arenaGeometry.widthM / 2, ry = arenaGeometry.heightM / 2;
  // Homothetic inset conservatively contains an entire actor disk, even at diagonal edges.
  const factor = Math.max(0.001, 1 - inset / Math.min(rx, ry));
  return { x: rx * factor, y: ry * factor };
}
export function arenaContains(p: Vec, inset = 0): boolean {
  const r = axes(inset); return Math.hypot((p.x - arenaGeometry.centre.x) / r.x, (p.y - arenaGeometry.centre.y) / r.y) <= 1 + 1e-12;
}
export function constrainToArena(p: Vec, inset = 0): Vec {
  const r = axes(inset), dx = p.x - arenaGeometry.centre.x, dy = p.y - arenaGeometry.centre.y;
  const ratio = Math.hypot(dx / r.x, dy / r.y);
  if (ratio <= 1) return { ...p };
  return { x: arenaGeometry.centre.x + dx / ratio, y: arenaGeometry.centre.y + dy / ratio };
}
export const openingSeparationM = scaleContract.minimum_combatant_centre_separation_metres;
/** A compact sparse formation leaves room between bodies without a long off-screen queue. */
export function openingPosition(index: number, count: number, jitter: Vec = { x: 0, y: 0 }, approachReductionM = 0): Vec {
  const rows = Math.ceil(Math.sqrt(count)), spacing = openingSeparationM + 2 * runtime.games.spawnJitterM;
  return constrainToArena({ x: runtime.games.enemySpawn.x - approachReductionM + Math.floor(index / rows) * spacing + jitter.x,
    y: runtime.games.enemySpawn.y + (index % rows - (rows - 1) / 2) * spacing + jitter.y }, runtime.games.spawnMarginM);
}
