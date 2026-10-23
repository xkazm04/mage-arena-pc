// Spell shapes Fire and Air share and the Water kernel lacks: a spell-owned line, a delayed ground detonation (Pyre,
// Sunfall, Downdraft), a channelled beam (Brand Wrath, Cyclone), a dash with or without a trail (Cinder Step,
// Slipstream). W8 lane F owns this file and implements it first; lane A codes against these signatures.
import type { Actor, ArenaState, Hit, SchoolEffect } from './types.ts';
import type { Vec } from './math.ts';

const pending = (shape: string): never => { throw Error(`shapes.ts ${shape}: not built yet (W8 lane F)`); };

/** Resolve a straight line from the caster at once (Brand Lance, Tempest Lance); returns the ids it hit. */
export function resolveLine(_state: ArenaState, _owner: Actor, _hit: Hit, _from: Vec, _to: Vec, _widthM: number, _options: { piercing?: boolean } = {}): number[] { return pending('resolveLine'); }
/** Queue a ground circle that lands after `delayTicks` (fill telegraph); `survivesOwner` keeps a committed shadow. */
export function queueDetonation(_state: ArenaState, _owner: Actor, _hit: Hit, _at: Vec, _radiusM: number, _delayTicks: number, _options: { survivesOwner?: boolean } = {}): SchoolEffect { return pending('queueDetonation'); }
/** Start a beam along the owner's live facing, ticking every `everyTicks` for `durationTicks`. */
export function startBeam(_state: ArenaState, _owner: Actor, _hit: Hit, _lengthM: number, _everyTicks: number, _durationTicks: number, _options: { perfectFirstTickOnly?: boolean } = {}): SchoolEffect { return pending('startBeam'); }
/** Move the owner up to `distanceM` along `direction` (arena clamp); with `trail`, leave a burning segment. Returns the segment travelled. */
export function dash(_state: ArenaState, _owner: Actor, _direction: Vec, _distanceM: number, _trail?: { hit: Hit; everyTicks: number; durationTicks: number }): { from: Vec; to: Vec } { return pending('dash'); }
/** Advance every live school effect one tick. No-op while the state has none, so Water states step unchanged. */
export function stepSchoolEffects(state: ArenaState): void {
  if (!state.schoolEffects?.length) return;
  pending('stepSchoolEffects');
}
