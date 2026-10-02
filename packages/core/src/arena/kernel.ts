import { combat, statRules, bolt } from './data.generated.ts';
import runtime from './data/runtime.json' with { type: 'json' };
import { constrainToArena } from './geometry.ts';
import { distance, inArc, length, segmentHit, sub, unit, type Vec } from './math.ts';
import { idleInput, type Actor, type ArenaState, type Hit, type InputFrame, type Projectile, type Ranks } from './types.ts';
import { newWaterState } from './catalog.ts';
import { reflectProjectile, refundMult, releaseSpell, resetWater, trySpellCast, updateWater, wardDrainMult, waterAbsorbed } from './water.ts';
import { enemySpec } from './enemies.ts';

export { combat, statRules, bolt, runtime };
export const DT = 1 / combat.simStepHz;
export const ticks = (seconds: number): number => Math.ceil(seconds * combat.simStepHz - 1e-9);
export const seconds = (tickCount: number): number => tickCount / combat.simStepHz;
export const drainPerSecond = (rank: number): number => Math.max(0, statRules.drain.base + statRules.drain.perRank * rank);
export const perfectReturn = (tier: number, nerve: number): number => tier === 0 ? statRules.refund.tierZero : statRules.refund.perTier * tier * (1 + statRules.refund.perRank * nerve);
const maximum = (rule: { base: number; perRank: number }, rank: number): number => rule.base + rule.perRank * rank;

export function createArena(seed = 1): ArenaState {
  return { tick: 0, seed: seed >>> 0, rng: seed >>> 0, nextId: 1, actors: [], projectiles: [], telegraphs: [], zones: [], events: [], randomLog: [] };
}
// Mulberry32; even seed zero is a valid independent sequence. Every draw is serialized for replay.
export function random(state: ArenaState, purpose: string): number {
  state.rng = (state.rng + 0x6d2b79f5) >>> 0;
  let t = state.rng; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  state.randomLog.push({ tick: state.tick, purpose, value }); return value;
}
export function addMage(state: ArenaState, team: number, pos: Vec, label = 'Water mage', ranks: Ranks = runtime.training.defaultRanks): Actor {
  if (Object.values(ranks).some(r => !Number.isInteger(r) || r < 1 || r > 5)) throw Error('Arena ranks must be integers from 1 to 5');
  const actor: Actor = {
    id: state.nextId++, team, label, pos: { ...pos }, previousPos: { ...pos }, facing: { x: 1, y: 0 }, radius: runtime.geometry.mageRadiusM,
    ranks: { ...ranks }, hp: maximum(statRules.hp, ranks.vigor), maxHp: maximum(statRules.hp, ranks.vigor),
    mana: maximum(statRules.mana, ranks.focus), maxMana: maximum(statRules.mana, ranks.focus),
    stamina: maximum(statRules.stamina, ranks.vigor), maxStamina: maximum(statRules.stamina, ranks.vigor),
    down: false, dummy: false, absorb: false, absorbFreshTick: -1e9, releaseTick: -1e9, absorbExhausted: false, water: newWaterState(),
    lastInput: idleInput(), rollUntil: 0, immuneUntil: 0, recoveryUntil: 0, rollDirection: { x: 1, y: 0 },
    staminaUsedTick: -1e9, cooldownUntil: 0, waveStartTick: state.tick, tier: 1, lastUnlockTick: state.tick,
    clockAdvanceTicks: 0, unlockTicks: [state.tick],
    metrics: { perfects: 0, blocks: 0, hits: 0, damageDealt: 0, damageTaken: 0, manaDrained: 0, manaRaised: 0, manaReturned: 0, casts: 0, rolls: 0 }
  };
  state.actors.push(actor); return actor;
}
export function emit(state: ArenaState, kind: ArenaState['events'][number]['kind'], actor: Actor, value = 0, targetId?: number): void {
  state.events.push({ tick: state.tick, kind, actorId: actor.id, value, ...(targetId === undefined ? {} : { targetId }) });
}
export function interrupt(state: ArenaState, actor: Actor): void {
  const hadCast = actor.pending !== undefined || state.telegraphs.some(t => t.ownerId === actor.id);
  actor.pending = undefined; state.telegraphs = state.telegraphs.filter(t => t.ownerId !== actor.id);
  if (hadCast) emit(state, 'interrupt', actor);
}
export function resolveHit(state: ArenaState, target: Actor, hit: Hit): { damage: number; perfect: boolean } {
  if (target.down || state.tick < target.immuneUntil || state.tick < target.water.encasedUntil) return { damage: 0, perfect: false };
  const spec = target.enemy ? enemySpec(target) : undefined;
  const shielded = spec?.frontBlockDeg && hit.delivery !== 'area' && hit.family !== 'unblockable' && inArc(target.facing, sub(hit.source, target.pos), spec.frontBlockDeg);
  const incomingDamage = hit.damage * (hit.bolt ? spec?.armourMultVsBolt ?? 1 : 1) * (shielded ? spec?.frontBlockMult ?? 1 : 1);
  const guarded = target.absorb && inArc(target.facing, sub(hit.source, target.pos), combat.absorb.arcDeg);
  const perfect = guarded && hit.family === 'magic' && state.tick - target.absorbFreshTick <= ticks(combat.absorb.perfect.windowS);
  const reduction = guarded ? (perfect ? combat.absorb.perfect.reduction : combat.absorb.reduction[hit.family]) : combat.absorb.reduction.outsideArc;
  const damage = incomingDamage * (1 - reduction);
  if (perfect) {
    target.metrics.perfects++;
    const refund = Math.min(target.maxMana - target.mana, perfectReturn(hit.tier, target.ranks.nerve) * refundMult(state, target));
    target.mana += refund; target.metrics.manaReturned += refund;
    target.clockAdvanceTicks += ticks(combat.tierClock.perfectAbsorbAdvanceS);
    emit(state, 'perfect', target, refund, hit.ownerId);
  } else if (reduction > 0) target.metrics.blocks++;
  if (reduction > 0) waterAbsorbed(state, target, hit, incomingDamage - damage, perfect);
  const hpRemoved = Math.min(target.hp, damage);
  target.hp = Math.max(0, target.hp - damage); target.metrics.damageTaken += hpRemoved;
  const owner = state.actors.find(a => a.id === hit.ownerId);
  if (owner) owner.metrics.damageDealt += hpRemoved;
  target.metrics.hits++; emit(state, 'hit', target, hpRemoved, hit.ownerId);
  if (target.hp === 0) { target.down = true; target.absorb = false; interrupt(state, target); emit(state, 'down', target); }
  return { damage, perfect };
}
export function spawnProjectile(state: ArenaState, hit: Hit, origin: Vec, direction: Vec, speedMps: number, rangeM: number, radius = runtime.geometry.projectileRadiusM): Projectile {
  const d = unit(direction);
  const p: Projectile = { ...hit, delivery: 'projectile', source: { ...origin }, id: state.nextId++, pos: { ...origin }, previousPos: { ...origin },
    velocity: { x: d.x * speedMps, y: d.y * speedMps }, radius, remainingM: rangeM, hitIds: [] };
  state.projectiles.push(p); return p;
}
function updateWard(state: ArenaState, a: Actor, input: InputFrame): void {
  if (!input.absorb) {
    if (a.lastInput.absorb || a.absorb) a.releaseTick = state.tick;
    a.absorb = false; a.absorbExhausted = false;
  } else if (!a.absorb && !a.absorbExhausted && state.tick >= a.rollUntil && !a.pending && state.tick - a.releaseTick >= ticks(combat.absorb.minReleaseBeforeReRaiseS)) {
    if (a.mana >= combat.absorb.raiseCostMana) {
      a.mana -= combat.absorb.raiseCostMana; a.metrics.manaRaised += combat.absorb.raiseCostMana;
      a.absorb = true; a.absorbFreshTick = state.tick;
    } else a.absorbExhausted = true;
  }
  if (a.absorb) {
    const cost = drainPerSecond(a.ranks.nerve) * wardDrainMult(state, a) * DT;
    const paid = Math.min(a.mana, cost); a.mana -= paid; a.metrics.manaDrained += paid;
    if (paid < cost || a.mana <= 1e-9) { a.mana = Math.max(0, a.mana); a.absorb = false; a.absorbExhausted = true; }
  }
}
function moveActor(state: ArenaState, a: Actor, input: InputFrame): void {
  a.previousPos = { ...a.pos };
  const rooted = state.tick < a.water.rootUntil || a.pending?.spellId === 'mend:4:base';
  if (!rooted && input.roll && !a.lastInput.roll && state.tick >= a.rollUntil && state.tick >= a.recoveryUntil && a.stamina >= combat.roll.staminaCost) {
    a.rollDirection = unit(input.move, a.facing); a.rollUntil = state.tick + ticks(combat.roll.durationS);
    a.immuneUntil = state.tick + ticks(combat.roll.iFramesS); a.recoveryUntil = a.rollUntil + ticks(combat.roll.recoveryS);
    a.stamina -= combat.roll.staminaCost; a.staminaUsedTick = state.tick; a.metrics.rolls++;
    a.absorb = false; if (input.absorb) a.absorbExhausted = true; interrupt(state, a); emit(state, 'roll', a);
  }
  let velocity = { x: 0, y: 0 };
  if (state.tick < a.rollUntil) {
    const speed = combat.roll.distanceM / (ticks(combat.roll.durationS) * DT);
    velocity = { x: a.rollDirection.x * speed, y: a.rollDirection.y * speed };
  } else if (!rooted && length(input.move) > 0) {
    const move = unit(input.move); let speed: number = a.speedMps ?? combat.movement.walkMps;
    const sprintCost = combat.movement.sprintStaminaPerSecond * DT;
    if (input.sprint && !a.absorb && !a.pending && a.stamina >= sprintCost) {
      speed = combat.movement.sprintMps; a.stamina -= sprintCost; a.staminaUsedTick = state.tick;
    }
    if (a.absorb) speed *= combat.absorb.moveSpeedWhileHeldMult;
    if (state.tick < a.water.slowUntil) speed *= a.water.slowMult;
    velocity = { x: move.x * speed, y: move.y * speed };
  }
  a.pos = constrainToArena({ x: a.pos.x + velocity.x * DT, y: a.pos.y + velocity.y * DT }, a.radius);
}
function releaseCast(state: ArenaState, a: Actor): void {
  const pending = a.pending; if (!pending || state.tick < pending.releaseTick) return;
  if (pending.kind === 'spell') { releaseSpell(state, a); return; }
  a.pending = undefined;
  const direction = unit(sub(pending.aim, a.pos), a.facing);
  if (pending.kind === 'bolt') {
    spawnProjectile(state, { ownerId: a.id, activationId: pending.activationId, damage: bolt.damage, family: 'magic', tier: 0, source: { ...a.pos }, bolt: true },
      a.pos, direction, bolt.speedMps, bolt.rangeM);
  } else {
    for (const target of state.actors) {
      if (target.team === a.team || target.down || distance(a.pos, target.pos) > combat.staffStrike.rangeM || !inArc(direction, sub(target.pos, a.pos), runtime.geometry.staffArcDeg)) continue;
      const hit = resolveHit(state, target, { ownerId: a.id, activationId: pending.activationId, damage: combat.staffStrike.damage, family: 'physical', tier: 0, source: { ...a.pos }, delivery: 'melee' });
      if (hit.damage > 0 && combat.staffStrike.interruptsCasts) interrupt(state, target);
    }
    a.recoveryUntil = state.tick + ticks(combat.staffStrike.recoveryS);
  }
}
function startCast(state: ArenaState, a: Actor, input: InputFrame): void {
  if (!input.cast || a.pending || a.absorb || state.tick < a.rollUntil || state.tick < a.recoveryUntil) return;
  const nearby = input.slot === 0 && state.actors.some(t => t.team !== a.team && !t.down && distance(a.pos, t.pos) <= combat.staffStrike.rangeM && inArc(a.facing, sub(t.pos, a.pos), runtime.geometry.staffArcDeg));
  if (nearby) {
    if (a.stamina < combat.staffStrike.staminaCost || state.tick < a.cooldownUntil) return;
    a.stamina -= combat.staffStrike.staminaCost; a.staminaUsedTick = state.tick;
    a.pending = { kind: 'staff', startTick: state.tick, releaseTick: state.tick + ticks(combat.staffStrike.windupS), aim: { ...input.aim }, activationId: state.nextId++ };
    a.cooldownUntil = a.pending.releaseTick + ticks(combat.staffStrike.recoveryS);
  } else {
    if (trySpellCast(state, a, input)) releaseCast(state, a);
    return;
  }
  a.metrics.casts++; emit(state, 'cast', a); releaseCast(state, a);
}
function updateTelegraphs(state: ArenaState): void {
  const due = state.telegraphs.filter(t => t.resolveTick <= state.tick);
  state.telegraphs = state.telegraphs.filter(t => t.resolveTick > state.tick);
  for (const t of due) {
    const owner = state.actors.find(a => a.id === t.ownerId); if (!owner || (owner.down && !t.survivesOwner) || (!t.survivesOwner && state.tick < owner.water.encasedUntil)) continue;
    const direction = unit(sub(t.target, t.origin));
    if (t.kind === 'projectile') spawnProjectile(state, t, t.origin, direction, t.speedMps, t.rangeM);
    else {
      const end = { x: t.origin.x + direction.x * t.rangeM, y: t.origin.y + direction.y * t.rangeM };
      for (const target of state.actors) {
        if (target.team === owner.team || target.down) continue;
        const inShape = t.kind === 'area' ? distance(t.target, target.pos) <= t.widthM + target.radius
          : t.kind === 'melee' ? distance(t.origin, target.pos) <= t.rangeM + target.radius && inArc(direction, sub(target.pos, t.origin), t.widthM)
          : segmentHit(t.origin, end, target.pos, t.widthM / 2 + target.radius) !== undefined;
        if (!inShape) continue;
        const immune = state.tick < target.immuneUntil || state.tick < target.water.encasedUntil;
        const result = resolveHit(state, target, { ...t, source: t.kind === 'area' ? { ...t.target } : t.source, delivery: t.kind === 'melee' ? 'melee' : 'area' });
        if (!immune && !result.perfect && !target.down) {
          if (t.rootS) target.water.rootUntil = Math.max(target.water.rootUntil, state.tick + ticks(t.rootS));
          if (t.pullM) {
            const direction = unit(sub(owner.pos, target.pos)), amount = Math.min(t.pullM, Math.max(0, distance(owner.pos, target.pos) - owner.radius - target.radius));
            target.pos = constrainToArena({ x: target.pos.x + direction.x * amount, y: target.pos.y + direction.y * amount }, target.radius);
          }
        }
      }
      if (t.kind === 'charge') {
        const { x, y } = constrainToArena(end, owner.radius);
        owner.pos = { x, y };
        if ((x !== end.x || y !== end.y) && owner.enemy) owner.enemy.stunnedUntil = state.tick + ticks(t.wallStunS ?? 0);
      }
    }
  }
}
function updateProjectiles(state: ArenaState): void {
  // Reactions append projectiles; do not advance those until the next tick.
  for (const p of [...state.projectiles]) {
    const travel = Math.min(length(p.velocity) * DT, p.remainingM), direction = unit(p.velocity);
    p.previousPos = { ...p.pos };
    const end = { x: p.pos.x + direction.x * travel, y: p.pos.y + direction.y * travel };
    const owner = state.actors.find(a => a.id === p.ownerId);
    let first: Actor | undefined, firstT = Infinity;
    for (const a of state.actors) {
      if (a.down || a.team === owner?.team || a.id === p.ownerId || p.hitIds.includes(a.id)) continue;
      const t = segmentHit(p.pos, end, a.pos, a.radius + p.radius);
      if (t !== undefined && t < firstT) { firstT = t; first = a; }
    }
    if (first) {
      // Incoming direction is the last segment, even when the original caster moved.
      p.source = { ...p.pos }; const result = resolveHit(state, first, { ...p, delivery: p.burstRadiusM || p.piercing ? 'area' : 'projectile' }); p.hitIds.push(first.id);
      if (result.perfect) reflectProjectile(state, first, p);
      if (p.burstRadiusM && !result.perfect) {
        for (const target of state.actors) if (!target.down && target.team !== owner?.team && !p.hitIds.includes(target.id) && distance(target.pos, first.pos) <= p.burstRadiusM) {
          resolveHit(state, target, { ...p, source: { ...first.pos }, delivery: 'area' }); p.hitIds.push(target.id);
        }
      }
      if (!p.piercing || result.perfect) p.remainingM = 0;
      else { p.pos = end; p.remainingM -= travel; }
    } else { p.pos = end; p.remainingM -= travel; }
  }
  state.projectiles = state.projectiles.filter(p => p.remainingM > 1e-9);
}
export function updateClock(state: ArenaState, a: Actor): void {
  const next = (a.tier + 1) as 2 | 3 | 4;
  if (next > 4) return;
  if (state.tick - a.waveStartTick + a.clockAdvanceTicks >= ticks(combat.tierClock.unlockAtSeconds[next]) && state.tick - a.lastUnlockTick >= ticks(combat.tierClock.minimumSecondsBetweenUnlocks)) {
    a.tier = next; a.lastUnlockTick = state.tick; a.unlockTicks.push(state.tick); emit(state, 'unlock', a, next);
  }
}
/** Exactly one fixed simulation tick. Inputs are absolute and do not contain timestamps. */
export function stepArena(state: ArenaState, inputs: Readonly<Record<number, InputFrame>> = {}): void {
  state.tick++;
  for (const a of state.actors) {
    if (a.down) continue;
    updateWater(state, a);
    a.mana = Math.min(a.maxMana, a.mana + maximum(statRules.manaRegen, a.ranks.focus) * DT);
    if (state.tick - a.staminaUsedTick >= ticks(combat.stamina.regenDelayS)) a.stamina = Math.min(a.maxStamina, a.stamina + combat.stamina.regenPerSecond * DT);
    if (state.tick < a.water.encasedUntil) { a.previousPos = { ...a.pos }; continue; }
    const input = inputs[a.id] ?? idleInput({ x: a.pos.x + a.facing.x, y: a.pos.y + a.facing.y });
    a.facing = unit(sub(input.aim, a.pos), a.facing);
    updateWard(state, a, input); moveActor(state, a, input); releaseCast(state, a); startCast(state, a, input);
    a.lastInput = { ...input, move: { ...input.move }, aim: { ...input.aim } };
  }
  updateTelegraphs(state); updateProjectiles(state); state.zones = state.zones.filter(z => z.until > state.tick);
  for (const a of state.actors) if (!a.down) updateClock(state, a);
}
export function resetWave(state: ArenaState, actor: Actor): void {
  actor.hp += (actor.maxHp - actor.hp) * combat.betweenWaves.healFractionOfMissingHp;
  actor.mana = actor.maxMana * combat.betweenWaves.manaRefill; actor.stamina = actor.maxStamina * combat.betweenWaves.staminaRefill;
  actor.tier = 1; actor.waveStartTick = state.tick; actor.lastUnlockTick = state.tick; actor.clockAdvanceTicks = 0; actor.unlockTicks = [state.tick];
  actor.absorb = false; actor.absorbExhausted = false; actor.absorbFreshTick = -1e9; actor.releaseTick = -1e9;
  actor.pending = undefined; actor.cooldownUntil = state.tick; actor.rollUntil = state.tick; actor.immuneUntil = state.tick; actor.recoveryUntil = state.tick;
  actor.lastInput = idleInput(); state.projectiles = []; state.telegraphs = []; state.zones = []; resetWater(actor);
}
/** FNV-1a of the complete serializable state, including cooldowns, RNG and pending actions. */
export function stateHash(state: ArenaState): string {
  const source = JSON.stringify(state); let hash = 2166136261;
  for (let i = 0; i < source.length; i++) { hash ^= source.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
export class FixedStepper {
  private accumulated = 0;
  advance(elapsedS: number, update: () => void): number {
    this.accumulated += Math.max(0, Math.min(elapsedS, runtime.presentation.maxFrameDeltaS));
    while (this.accumulated + 1e-12 >= DT) { update(); this.accumulated -= DT; }
    return Math.max(0, this.accumulated / DT);
  }
}
