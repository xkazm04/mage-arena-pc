// Spell shapes Fire and Air share and the Water kernel lacks: a spell-owned line, a delayed ground detonation (Pyre,
// Sunfall, Downdraft), a channelled beam (Brand Wrath, Cyclone), a dash with or without a trail (Cinder Step,
// Slipstream). W8 lane F owns this file and implements it first; lane A codes against these signatures.
// Semantics follow the VR C++ kernel (mage-arena-vr Kernel/Fire.cpp HitAlongSegment, UpdateFireOngoing; ArenaThreats.cpp
// UpdateTelegraphs for the detonation). Every contact goes through the kernel's resolveHit, so perfects, the ledger tap,
// stagger and the school onHit hooks behave as for any other hit.
import { resolveHit } from './kernel.ts';
import { constrainToArena } from './geometry.ts';
import { distance, segmentHit, unit, type Vec } from './math.ts';
import { activationBlocked, type Actor, type ArenaState, type Hit, type SchoolEffect, type SlotSchool } from './types.ts';

/** A school hit: `heat` is paid to a Fire owner when the blow connects (CR-002 HeatOnHit); `pierceShields` skips a Scutum
 * front block; `suppressPerfect` refuses the fresh-raise window (Brand Wrath after its first tick).
 * Interim until types.ts carries them (lane F request R1): resolveHit has no flags, so pierce rides `delivery: 'area'`
 * (its only shield bypass) and suppress masks the target's absorbFreshTick for the one call. */
export type SchoolHit = Hit & { heat?: number; pierceShields?: boolean; suppressPerfect?: boolean };

/** The fields a shape needs across ticks beyond SchoolEffect (lane F request R2 asks types.ts to carry them). */
export interface ShapeEffect extends SchoolEffect {
  /** The contact template every tick copies (base damage, before any live multiplier). */
  hit: SchoolHit;
  everyTicks?: number; lengthM?: number; radiusM?: number; perfectFirstTickOnly?: boolean; ticksDone?: number;
}

/** Per-school answers a shape reads at resolve time, filled by the school module at load (no state, no closures in state).
 * `liveDamageMult` is read on every trail and beam tick (CR-002: "each trail tick and each beam tick read live heat").
 * `step` advances an effect kind this file does not own (Air's 'volley'); it returns false when the effect is finished. */
export const shapeHooks: {
  liveDamageMult: Partial<Record<SlotSchool, (state: ArenaState, owner: Actor) => number>>;
  step: Partial<Record<SchoolEffect['kind'], (state: ArenaState, effect: SchoolEffect) => boolean>>;
} = { liveDamageMult: {}, step: {} };

const hostile = (owner: Actor, target: Actor): boolean => !target.tags.includes('DEFEATED') && target.team !== owner.team && target.id !== owner.id;
const liveMult = (state: ArenaState, owner: Actor): number => (owner.schoolState && shapeHooks.liveDamageMult[owner.schoolState.school]?.(state, owner)) ?? 1;
/** One contact. A fresh object per call: hooks key on the hit identity (fire.ts onHit guard). */
export function contact(state: ArenaState, target: Actor, hit: SchoolHit): { damage: number; perfect: boolean } {
  const sent: SchoolHit = { ...hit, source: { ...hit.source }, ...(hit.pierceShields ? { delivery: 'area' as const } : {}) };
  if (!hit.suppressPerfect) return resolveHit(state, target, sent);
  const fresh = target.absorbFreshTick; target.absorbFreshTick = -1e9;
  try { return resolveHit(state, target, sent); } finally { target.absorbFreshTick = fresh; }
}
function addEffect(state: ArenaState, effect: ShapeEffect): ShapeEffect {
  (state.schoolEffects ??= []).push(effect);
  return effect;
}
const base = (state: ArenaState, owner: Actor, hit: SchoolHit, kind: SchoolEffect['kind'], spellId: string, origin: Vec, target: Vec, nextTick: number, endTick: number): ShapeEffect => ({
  id: state.nextId++, ownerId: owner.id, activationId: hit.activationId, spellId, kind, startTick: state.tick, nextTick, endTick,
  origin: { ...origin }, target: { ...target }, damage: hit.damage, family: hit.family, tier: hit.tier, hitLog: [], hit: { ...hit, source: { ...hit.source } },
});

/** Resolve a straight line from the caster at once (Brand Lance, Tempest Lance); returns the ids it hit.
 * No authored width is `widthM` 0: the segment is tested against the body radius (VR HitAlongSegment). */
export function resolveLine(state: ArenaState, owner: Actor, hit: Hit, from: Vec, to: Vec, widthM: number, options: { piercing?: boolean; suppressPerfect?: boolean } = {}): number[] {
  const ids: number[] = [];
  for (const target of state.actors) {
    if (!hostile(owner, target) || segmentHit(from, to, target.pos, target.radius + widthM / 2) === undefined) continue;
    contact(state, target, { ...hit, source: { ...from }, ...(options.piercing ? { pierceShields: true } : {}), ...(options.suppressPerfect ? { suppressPerfect: true } : {}) });
    ids.push(target.id);
  }
  return ids;
}
/** Queue a ground circle that lands after `delayTicks` (fill telegraph); `survivesOwner` keeps a committed shadow. */
export function queueDetonation(state: ArenaState, owner: Actor, hit: Hit, at: Vec, radiusM: number, delayTicks: number, options: { survivesOwner?: boolean; spellId?: string } = {}): SchoolEffect {
  const effect = base(state, owner, hit, 'detonation', options.spellId ?? '', owner.pos, at, state.tick + delayTicks, state.tick + delayTicks);
  effect.radiusM = radiusM;
  if (options.survivesOwner) effect.survivesOwner = true;
  return addEffect(state, effect);
}
/** Start a beam along the owner's live facing, ticking every `everyTicks` for `durationTicks`. */
export function startBeam(state: ArenaState, owner: Actor, hit: Hit, lengthM: number, everyTicks: number, durationTicks: number, options: { perfectFirstTickOnly?: boolean; spellId?: string } = {}): SchoolEffect {
  const every = Math.max(1, everyTicks), end = { x: owner.pos.x + owner.facing.x * lengthM, y: owner.pos.y + owner.facing.y * lengthM };
  const effect = base(state, owner, hit, 'beam', options.spellId ?? '', owner.pos, end, state.tick + every, state.tick + durationTicks);
  Object.assign(effect, { everyTicks: every, lengthM, ticksDone: 0 }, options.perfectFirstTickOnly ? { perfectFirstTickOnly: true } : {});
  return addEffect(state, effect);
}
/** Move the owner up to `distanceM` along `direction` (arena clamp); with `trail`, leave a burning segment. Returns the segment travelled. */
export function dash(state: ArenaState, owner: Actor, direction: Vec, distanceM: number, trail?: { hit: Hit; everyTicks: number; durationTicks: number; spellId?: string }): { from: Vec; to: Vec } {
  const from = { ...owner.pos }, d = unit(direction, owner.facing);
  owner.pos = constrainToArena({ x: from.x + d.x * distanceM, y: from.y + d.y * distanceM }, owner.radius);
  if (trail) {
    const every = Math.max(1, trail.everyTicks);
    const effect = base(state, owner, trail.hit, 'trail', trail.spellId ?? '', from, owner.pos, state.tick + every, state.tick + trail.durationTicks);
    effect.everyTicks = every;
    addEffect(state, effect);
  }
  return { from, to: { ...owner.pos } };
}

/** A beam stops when its owner is interrupted (VR Interrupt -> CancelFireChannel). PC's interrupt() has no school hook
 * (lane F request R3), so the PC causes are read here: a roll, a stagger or a defeat this tick, or an encasement. */
function ownerInterrupted(state: ArenaState, owner: Actor): boolean {
  if (owner.tags.includes('DEFEATED') || state.tick < owner.water.encasedUntil) return true;
  for (let i = state.events.length - 1; i >= 0 && state.events[i]!.tick === state.tick; i--) {
    const e = state.events[i]!;
    if (e.actorId === owner.id && (e.kind === 'roll' || e.kind === 'stagger' || e.kind === 'down')) return true;
  }
  return false;
}
const note = (effect: ShapeEffect, tick: number, ids: number[]): void => { effect.hitLog = ids.map(targetId => ({ tick, targetId })); };
/** One trail tick (VR UpdateFireOngoing): live damage, a fresh activation id, targets deduped per owner per tick. */
function stepTrail(state: ArenaState, effect: ShapeEffect, owner: Actor, claimed: Set<number>): boolean {
  if (state.tick >= effect.nextTick && state.tick <= effect.endTick) {
    const damage = effect.hit.damage * liveMult(state, owner), activationId = state.nextId++, ids: number[] = [];
    for (const target of state.actors) {
      if (!hostile(owner, target) || claimed.has(target.id) || segmentHit(effect.origin, effect.target, target.pos, target.radius) === undefined) continue;
      claimed.add(target.id); ids.push(target.id);
      contact(state, target, { ...effect.hit, activationId, damage, source: { ...effect.origin }, delivery: 'area' });
    }
    note(effect, state.tick, ids);
    effect.nextTick += effect.everyTicks!;
  }
  return effect.nextTick <= effect.endTick;
}
/** One beam tick: along the owner's current facing, live damage, perfect only on the first tick when asked. */
function stepBeam(state: ArenaState, effect: ShapeEffect, owner: Actor): boolean {
  const length = effect.lengthM!;
  effect.origin = { ...owner.pos }; effect.target = { x: owner.pos.x + owner.facing.x * length, y: owner.pos.y + owner.facing.y * length };
  if (state.tick >= effect.nextTick && state.tick <= effect.endTick) {
    const hit: SchoolHit = { ...effect.hit, activationId: state.nextId++, damage: effect.hit.damage * liveMult(state, owner), source: { ...owner.pos } };
    const ids = resolveLine(state, owner, hit, owner.pos, effect.target, 0, { piercing: effect.hit.pierceShields, suppressPerfect: !!effect.perfectFirstTickOnly && (effect.ticksDone ?? 0) > 0 });
    note(effect, state.tick, ids);
    effect.ticksDone = (effect.ticksDone ?? 0) + 1; effect.nextTick += effect.everyTicks!;
  }
  return effect.nextTick <= effect.endTick;
}
/** The detonation lands as VR's area telegraph: hostiles within radius plus body radius of the point, source the point. */
function stepDetonation(state: ArenaState, effect: ShapeEffect, owner: Actor | undefined): boolean {
  if (state.tick < effect.endTick) return true;
  if (!owner || (!effect.survivesOwner && (activationBlocked(owner) || state.tick < owner.water.encasedUntil))) return false;
  const ids: number[] = [];
  for (const target of state.actors) {
    if (target.tags.includes('DEFEATED') || target.team === owner.team || distance(effect.target, target.pos) > effect.radiusM! + target.radius) continue;
    ids.push(target.id);
    contact(state, target, { ...effect.hit, source: { ...effect.target }, delivery: 'area' });
  }
  note(effect, state.tick, ids);
  return false;
}
/** Advance every live school effect one tick. No-op while the state has none, so Water states step unchanged.
 * Order: per owner in actor order its trails then its beam (VR steps them inside each actor's turn), then detonations
 * and other kinds in creation order. A defeated owner's trails and beams stop; a committed shadow survives its owner. */
export function stepSchoolEffects(state: ArenaState): void {
  if (!state.schoolEffects?.length) return;
  const done = new Set<SchoolEffect>(), effects = [...state.schoolEffects] as ShapeEffect[];
  for (const owner of state.actors) {
    const own = effects.filter(e => e.ownerId === owner.id && (e.kind === 'trail' || e.kind === 'beam'));
    if (!own.length) continue;
    const claimed = new Set<number>();
    for (const effect of own.filter(e => e.kind === 'trail')) if (owner.tags.includes('DEFEATED') || !stepTrail(state, effect, owner, claimed)) done.add(effect);
    for (const effect of own.filter(e => e.kind === 'beam')) if (ownerInterrupted(state, owner) || !stepBeam(state, effect, owner)) done.add(effect);
  }
  for (const effect of effects) {
    if (effect.kind === 'trail' || effect.kind === 'beam') { if (!state.actors.some(a => a.id === effect.ownerId)) done.add(effect); continue; }
    const owner = state.actors.find(a => a.id === effect.ownerId);
    const alive = effect.kind === 'detonation' ? stepDetonation(state, effect, owner) : shapeHooks.step[effect.kind]?.(state, effect) ?? false;
    if (!alive) done.add(effect);
  }
  state.schoolEffects = state.schoolEffects.filter(e => !done.has(e));
}
/** Live beams of an owner (casting is refused while one runs, VR FireChannelBusy). */
export const ownerBeam = (state: ArenaState, owner: Actor): SchoolEffect | undefined => state.schoolEffects?.find(e => e.kind === 'beam' && e.ownerId === owner.id);
