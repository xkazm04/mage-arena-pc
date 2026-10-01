import { enemyData } from './data.generated';
import { addMage, combat, random, runtime, ticks } from './kernel';
import { distance, sub, unit, type Vec } from './math';
import { idleInput, type Actor, type ArenaState, type Family, type InputFrame, type Telegraph } from './types';
import { hasLineOfSight } from './water';
export interface AttackSpec { id: string; family: Family; damage: number; windupS: number; recoveryS?: number; cooldownS?: number; rangeM?: number; projectileMps?: number; tier?: number; effect?: string; telegraph?: string; onWallHit?: string }
export interface EnemySpec { id: string; name: string; hp: number; speedMps: number; attacks: readonly AttackSpec[]; behaviour: string; frontBlockDeg?: number; frontBlockMult?: number; armourMultVsBolt?: number; keepDistanceM?: readonly number[]; packSize?: number; onDeath?: { id: string; family: Family; tier: number; damage: number; radiusM: number; delayS: number } }
export const enemyRoster: readonly EnemySpec[] = [...enemyData.soldiers, ...enemyData.creatures];
export const enemySpec = (a: Actor): EnemySpec | undefined => enemyRoster.find(s => s.id === a.enemy?.id);
export function addEnemy(state: ArenaState, id: string, pos: Vec): Actor {
  const spec = enemyRoster.find(s => s.id === id); if (!spec) throw Error(`Unknown enemy ${id}`);
  const a = addMage(state, 1, pos, spec.name); a.hp = a.maxHp = spec.hp; a.speedMps = spec.speedMps;
  a.enemy = { id, readyTick: state.tick, backoffUntil: 0, stunnedUntil: 0, attackIndex: 0, deathQueued: false };
  return a;
}
const extract = (text: string | undefined, pattern: RegExp): number => { const match = text?.match(pattern); if (!match) throw Error(`Missing enemy magnitude: ${text}`); return Number(match[1]); };
function scheduleAttack(state: ArenaState, a: Actor, target: Actor, spec: EnemySpec, attack: AttackSpec): void {
  const id = state.nextId++, brain = a.enemy!;
  const t: Telegraph = { id, activationId: id, ownerId: a.id, family: attack.family, tier: attack.tier ?? 0, damage: attack.damage, source: { ...a.pos },
    kind: attack.projectileMps ? 'projectile' : 'melee', origin: { ...a.pos }, target: { ...target.pos }, startTick: state.tick + 1,
    resolveTick: state.tick + 1 + ticks(attack.windupS), speedMps: attack.projectileMps ?? 0,
    rangeM: attack.rangeM ?? (attack.projectileMps ? runtime.games.rangedRangeM : runtime.games.defaultMeleeRangeM), widthM: runtime.games.meleeArcDeg };
  if (attack.id === 'net_cast') { t.kind = 'area'; t.rangeM = runtime.games.netRangeM; t.widthM = extract(attack.telegraph, /([\d.]+) m/); t.rootS = extract(attack.effect, /root ([\d.]+) s/); }
  if (attack.id === 'tongue_pull') { t.kind = 'lane'; t.rangeM = runtime.games.tongueRangeM; t.widthM = runtime.games.tongueWidthM; t.pullM = extract(attack.effect, /pull ([\d.]+) m/); }
  if (attack.id === 'thorn_charge') { t.kind = 'charge'; t.widthM = extract(attack.telegraph, /lane ([\d.]+) m/); t.rangeM = extract(attack.telegraph, /x ([\d.]+) m/); t.wallStunS = extract(attack.onWallHit, /self-stun ([\d.]+) s/); }
  state.telegraphs.push(t); brain.attackIndex++;
  const cooldown = attack.cooldownS ?? (spec.id === 'mire_maw' ? runtime.games.mawArtilleryCooldownS : spec.id === 'thornback' ? runtime.games.chargeCooldownS : attack.windupS + (attack.recoveryS ?? runtime.games.defaultRecoveryS));
  brain.readyTick = state.tick + 1 + ticks(cooldown);
  if (spec.id === 'conscript') { brain.backoffUntil = brain.readyTick + ticks(extract(spec.behaviour, /back off ([\d.]+) s/)); brain.readyTick = brain.backoffUntil; }
}
export function enemyInputs(state: ArenaState): Record<number, InputFrame> {
  const inputs: Record<number, InputFrame> = {};
  const enemies = state.actors.filter(a => a.enemy && !a.down);
  const hounds = enemies.filter(a => a.enemy!.id === 'cinder_hound');
  for (const a of enemies) {
    const spec = enemySpec(a)!, brain = a.enemy!;
    const targets = state.actors.filter(t => t.team !== a.team && !t.down && (distance(a.pos, t.pos) <= runtime.games.contactRangeM || hasLineOfSight(state, a.pos, t.pos)));
    targets.sort((x, y) => (spec.id === 'hush_moth' ? Number(y.absorb) - Number(x.absorb) : 0) || distance(a.pos, x.pos) - distance(a.pos, y.pos) || x.id - y.id);
    const target = targets[0]; if (!target) continue;
    const input = idleInput(target.pos); inputs[a.id] = input;
    if (state.tick < brain.stunnedUntil || state.tick < a.water.encasedUntil) continue;
    const windup = state.telegraphs.find(t => t.ownerId === a.id && !t.survivesOwner);
    if (windup) { input.aim = { ...windup.target }; continue; }
    if (spec.id === 'conscript' && state.tick < brain.backoffUntil - ticks(extract(spec.behaviour, /back off ([\d.]+) s/))) continue;
    const delta = sub(target.pos, a.pos), d = distance(target.pos, a.pos), toward = unit(delta);
    let desired = { ...toward };
    const attack = spec.attacks[brain.attackIndex % spec.attacks.length]!;
    let attackRange = attack.rangeM ?? runtime.games.defaultMeleeRangeM;
    if (attack.projectileMps) attackRange = runtime.games.rangedRangeM;
    if (attack.id === 'net_cast') attackRange = runtime.games.netRangeM;
    if (attack.id === 'tongue_pull') attackRange = runtime.games.tongueRangeM;
    if (attack.id === 'thorn_charge') attackRange = extract(attack.telegraph, /x ([\d.]+) m/);
    if (spec.keepDistanceM) {
      desired = d < spec.keepDistanceM[0]! ? { x: -toward.x, y: -toward.y } : d > spec.keepDistanceM[1]! ? toward : { x: -toward.y, y: toward.x };
    } else if (spec.id === 'mire_maw') desired = d <= attackRange ? { x: 0, y: 0 } : toward;
    else if (spec.id === 'netter') desired = d < runtime.games.netRangeM / 2 ? { x: -toward.x, y: -toward.y } : d > runtime.games.netRangeM ? toward : { x: -toward.y, y: toward.x };
    else if (spec.id === 'conscript' && state.tick < brain.backoffUntil) desired = d < runtime.games.conscriptBackoffM ? { x: -toward.x, y: -toward.y } : { x: 0, y: 0 };
    else if (d < attackRange * 0.8) desired = { x: 0, y: 0 };
    const engaged = spec.id !== 'cinder_hound' || hounds.indexOf(a) < extract(spec.behaviour, /uses (\d+) engagement slots/);
    if (!engaged) desired = d > runtime.games.houndOrbitM ? toward : { x: -toward.y, y: toward.x };
    if (spec.id === 'hush_moth') {
      desired = d > runtime.games.contactRangeM ? toward : { x: 0, y: 0 };
      if (d <= runtime.games.contactRangeM && state.tick + 1 >= target.immuneUntil && state.tick + 1 >= target.water.encasedUntil) {
        const drain = extract(attack.effect, /drain ([\d.]+) mana/) / combat.simStepHz;
        target.mana = Math.max(0, target.mana - drain); if (target.mana === 0) { target.absorb = false; target.absorbExhausted = true; }
      }
    } else if (engaged && d <= attackRange && state.tick + 1 >= brain.readyTick) { scheduleAttack(state, a, target, spec, attack); desired = { x: 0, y: 0 }; }
    if (desired.x || desired.y) {
      for (const other of enemies) if (other !== a) {
        const gap = distance(a.pos, other.pos);
        if (gap > 0 && gap < runtime.games.separationM) { const away = unit(sub(a.pos, other.pos)); desired.x += away.x * runtime.games.separationWeight; desired.y += away.y * runtime.games.separationWeight; }
      }
      input.move = unit(desired);
    }
  }
  return inputs;
}
export function queueDeathEffects(state: ArenaState): void {
  for (const a of state.actors) {
    if (!a.down || !a.enemy || a.enemy.deathQueued) continue;
    a.enemy.deathQueued = true; const spec = enemySpec(a)!;
    if (!spec.onDeath) continue;
    const d = spec.onDeath, id = state.nextId++;
    state.telegraphs.push({ id, activationId: id, ownerId: a.id, family: d.family, tier: d.tier, damage: d.damage, source: { ...a.pos },
      kind: 'area', origin: { ...a.pos }, target: { ...a.pos }, startTick: state.tick, resolveTick: state.tick + ticks(d.delayS), speedMps: 0, rangeM: d.radiusM, widthM: d.radiusM, survivesOwner: true });
  }
}
