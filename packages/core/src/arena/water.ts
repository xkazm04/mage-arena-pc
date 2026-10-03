import { adjustedSpell, tuningFor } from './tuning.ts';
import { combat } from './data.generated.ts';
import { newWaterState, spellFor, spells, type Spell } from './catalog.ts';
import { constrainToArena } from './geometry.ts';
import { distance, inArc, rotate, segmentHit, sub, unit, type Vec } from './math.ts';
import { emit, interrupt, resolveHit, runtime, spawnProjectile, ticks } from './kernel.ts';
import type { Actor, ArenaState, Hit, InputFrame, Projectile } from './types.ts';

export const effectSpell = (effect: string): Spell => spells.find(s => s.effect === effect)!;
export function flowCast(a: Actor, line: string, tick: number): { crest: boolean; damageMult: number } {
  const w = a.water, crest = w.flow >= combat.flow.max;
  if (crest) { w.flow = 0; w.crests++; }
  else if (line === w.lastLine && combat.flow.resetOnSameLineTwice) w.flow = 0;
  else if (w.lastLine && tick - w.lastCastTick <= ticks(combat.flow.differentLineWithinS)) w.flow = Math.min(combat.flow.max, w.flow + 1);
  w.lastLine = line; w.lastCastTick = tick; w.lastActivityTick = tick;
  return { crest, damageMult: crest ? combat.flow.crest.damageMult : 1 + w.flow * combat.flow.perStackDamage };
}
export function trySpellCast(state: ArenaState, a: Actor, input: InputFrame): boolean {
  const s = spellFor(a, input.slot, state); if (!s || s.kind === 'passive' || state.tick < (a.water.cooldowns[s.line] ?? 0)) return false;
  const cost = a.water.flow >= combat.flow.max ? combat.flow.crest.manaCost : s.mana;
  if (a.mana < cost) return false;
  let targetId: number | undefined;
  if (s.kind === 'target') {
    targetId = state.actors.filter(t => !t.down && t.team !== a.team && distance(a.pos, t.pos) <= s.rangeM && distance(input.aim, t.pos) <= runtime.water.tombCursorRadiusM)
      .sort((x, y) => distance(x.pos, input.aim) - distance(y.pos, input.aim) || x.id - y.id)[0]?.id;
    if (targetId === undefined) return false;
  }
  const flow = flowCast(a, s.line, state.tick);
  if (state.lab) a.metrics.manaCast = (a.metrics.manaCast ?? 0) + cost;
  a.mana -= cost; a.water.cooldowns[s.line] = state.tick + ticks(s.cooldownS);
  const d = unit(sub(input.aim, a.pos), a.facing), range = Math.min(distance(a.pos, input.aim), s.rangeM);
  const aim = s.kind === 'zone' || s.effect === 'decoy' ? { x: a.pos.x + d.x * range, y: a.pos.y + d.y * range } : { ...input.aim };
  a.pending = { kind: 'spell', startTick: state.tick, releaseTick: state.tick + ticks(Math.max(s.castS, s.telegraphS)), aim, activationId: state.nextId++, spellId: s.id, damageMult: flow.damageMult, targetId };
  a.pending.spell = { ...s };
  a.metrics.casts++; emit(state, 'cast', a, s.tier); return true;
}
function applyControl(state: ArenaState, a: Actor, target: Actor, s: Spell): void {
  if (target.down || state.tick < target.immuneUntil || state.tick < target.water.encasedUntil) return;
  if (s.effect === 'pull' || s.effect === 'push') {
    const direction = unit(sub(target.pos, a.pos));
    const amount = s.effect === 'pull' ? -Math.min(s.amount, Math.max(0, distance(a.pos, target.pos) - a.radius - target.radius)) : s.amount;
    target.pos = constrainToArena({ x: target.pos.x + direction.x * amount, y: target.pos.y + direction.y * amount }, target.radius);
    a.water.controlTicks++;
  }
  if (s.effect === 'root') { target.water.rootUntil = Math.max(target.water.rootUntil, state.tick + ticks(s.durationS)); a.water.controlTicks += ticks(s.durationS); }
}
function heal(a: Actor, amount: number): void {
  const actual = Math.min(a.maxHp - a.hp, amount); a.hp += actual; a.water.healing += actual;
}
export function releaseSpell(state: ArenaState, a: Actor): void {
  const p = a.pending; if (!p || p.kind !== 'spell') return;
  const s = p.spell ?? adjustedSpell(spells.find(s => s.id === p.spellId)!, a, state); a.pending = undefined;
  emit(state, 'release', a, s.tier);
  Object.assign(state.events.at(-1)!, { activationId:p.activationId, spellId:s.id, at:{...(s.kind === 'zone' || s.effect === 'decoy' ? p.aim : s.kind === 'target' ? state.actors.find(t=>t.id===p.targetId)?.pos ?? p.aim : a.pos)} });
  const recovery = tuningFor(state).castRecoveryS;
  if (recovery > 0) a.recoveryUntil = Math.max(a.recoveryUntil, state.tick + ticks(recovery));
  const direction = unit(sub(p.aim, a.pos), a.facing), damage = s.damage * (p.damageMult ?? 1);
  const hit: Hit = { ownerId: a.id, activationId: p.activationId, damage, family: s.family, tier: s.tier, source: { ...a.pos }, bolt: s.line === 'bolt' };
  if (s.kind === 'projectile') {
    for (let i = 0; i < s.count; i++) {
      const angle = s.count > 1 ? (-s.spreadDeg / 2 + i * s.spreadDeg / (s.count - 1)) * Math.PI / 180 : 0;
      const projectile = spawnProjectile(state, hit, a.pos, rotate(direction, angle), s.speedMps, s.rangeM, s.radiusM || runtime.geometry.projectileRadiusM);
      if (s.burstRadiusM) projectile.burstRadiusM = s.burstRadiusM;
    }
  } else if (s.kind === 'cone' || s.kind === 'ring' || (s.kind === 'zone' && s.effect === 'root')) {
    const centre = s.kind === 'zone' ? p.aim : a.pos;
    const range = s.kind === 'zone' ? s.radiusM : s.rangeM;
    for (const target of state.actors) {
      if (target.down || target.team === a.team || distance(centre, target.pos) > range || !inArc(direction, sub(target.pos, centre), s.arcDeg)) continue;
      const result = resolveHit(state, target, { ...hit, source: { ...centre }, delivery: 'area' });
      if (!result.perfect && result.damage > 0) applyControl(state, a, target, s);
    }
  } else if (s.kind === 'zone') {
    state.zones.push({ id: p.activationId, ownerId: a.id, pos: p.aim, radiusM: s.radiusM, until: state.tick + ticks(s.durationS), kind: s.effect as 'slow' | 'fog', slowMult: 1 - s.amount });
  } else if (s.kind === 'target') {
    const target = state.actors.find(t => t.id === p.targetId);
    if (target && !target.down && distance(a.pos, target.pos) <= s.rangeM && state.tick >= target.immuneUntil) {
      target.water.encasedUntil = state.tick + ticks(s.durationS); target.water.flow = 0; target.water.stored = 0;
      target.absorb = false; interrupt(state, target); a.water.controlTicks += ticks(s.durationS);
    }
  } else if (s.kind === 'wave') {
    const stored = Math.min(a.water.stored, s.amount); a.water.stored = 0;
    const projectile = spawnProjectile(state, { ...hit, damage: stored * (p.damageMult ?? 1) }, a.pos, direction, runtime.water.returnWaveSpeedMps, s.rangeM, runtime.water.returnWaveRadiusM);
    projectile.piercing = true;
  } else {
    if (s.effect === 'heal') heal(a, s.amount);
    if (s.effect === 'hot') { a.water.hotUntil = state.tick + ticks(s.durationS); a.water.hotPerTick = s.amount / ticks(s.durationS); }
    if (s.effect === 'ward') a.water.wardUntil = state.tick + ticks(s.durationS);
    if (s.effect === 'font') a.mana = Math.min(a.maxMana, a.mana + s.amount);
    if (s.effect === 'sheen') a.water.sheenUntil = state.tick + ticks(s.durationS);
    if (s.effect === 'decoy') a.water.decoy = { pos: p.aim, until: state.tick + ticks(s.durationS) };
  }
}
export function updateWater(state: ArenaState, a: Actor): void {
  const w = a.water;
  if (state.tick - w.lastActivityTick >= ticks(combat.flow.resetAfterIdleS)) w.flow = 0;
  if (state.tick <= w.hotUntil) heal(a, w.hotPerTick);
  if (w.decoy && w.decoy.until <= state.tick) w.decoy = undefined;
  for (const zone of state.zones) {
    const owner = state.actors.find(o => o.id === zone.ownerId);
    if (zone.kind !== 'slow' || owner?.team === a.team || zone.until <= state.tick || distance(zone.pos, a.pos) > zone.radiusM) continue;
    w.slowUntil = state.tick + 1; w.slowMult = zone.slowMult;
    if (owner) owner.water.controlTicks++;
  }
}
export function wardDrainMult(state: ArenaState, a: Actor): number { return state.tick < a.water.wardUntil ? 1 - effectSpell('ward').amount : 1; }
export function refundMult(state: ArenaState, a: Actor): number { return state.tick < a.water.sheenUntil ? 1 + effectSpell('sheen').amount : 1; }
export function waterAbsorbed(state: ArenaState, a: Actor, hit: Hit, prevented: number, perfect: boolean): void {
  if (a.water.composition.lines.includes('mirror')) {
    const source = spells.find(s => s.effect === 'return')!;
    // Fraction is extracted from the CSV note by the catalog module's dedicated export.
    a.water.stored = Math.min(source.amount, a.water.stored + prevented * storedFraction);
  }
  if (!perfect) return;
  a.water.flow = Math.min(combat.flow.max, a.water.flow + combat.flow.perfectAbsorbGives);
  // A perfect starts the idle grace too, otherwise a fresh stack would disappear next tick.
  a.water.lastActivityTick = state.tick;
  if (hit.reaction || !a.water.composition.lines.includes('mirror') || a.tier < 2 || a.water.composition.branches.mirror !== 'B') return;
  const ripple = effectSpell('ripple');
  const activationId = state.nextId++;
  for (const target of state.actors) if (!target.down && target.team !== a.team && distance(a.pos, target.pos) <= ripple.rangeM) resolveHit(state, target, {
    ownerId: a.id, activationId, damage: ripple.damage, family: 'magic', tier: ripple.tier, source: { ...a.pos }, reaction: true, delivery: 'area'
  });
}
export function reflectProjectile(state: ArenaState, target: Actor, p: Projectile): void {
  if (p.reflected || p.family !== 'magic' || p.tier > target.tier || target.tier < 2 || !target.water.composition.lines.includes('mirror') || target.water.composition.branches.mirror !== 'A') return;
  const owner = state.actors.find(a => a.id === p.ownerId);
  const origin = owner?.pos ?? p.source;
  const reflected = spawnProjectile(state, { ...p, ownerId: target.id, activationId: state.nextId++, source: { ...target.pos } }, target.pos, sub(origin, target.pos), Math.hypot(p.velocity.x, p.velocity.y), Math.max(p.remainingM, distance(target.pos, origin) + target.radius));
  reflected.reflected = true;
}
export function hasLineOfSight(state: ArenaState, a: Vec, b: Vec): boolean {
  return !state.zones.some(z => z.kind === 'fog' && z.until > state.tick && segmentHit(a, b, z.pos, z.radiusM) !== undefined);
}
export function resetWater(a: Actor): void { a.water = newWaterState(a.water.composition); }
import { waterRows } from './data.generated.ts';
const storedFraction = Number(waterRows.find(r => r.line === 'mirror' && r.tier === '4')!.notes.match(/stores ([\d.]+)%/)![1]) / 100;
