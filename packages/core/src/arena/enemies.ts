import { enemyData } from './data.generated.ts';
import { checkBehaviourTable, compileBehaviour, type AttackShape, type AttackSpec, type EnemyBehaviour, type EnemySpec } from './enemy-behaviour.ts';
import { addMage, combat, runtime, ticks, travelLine } from './kernel.ts';
import { distance, sub, unit, type Vec } from './math.ts';
import { idleInput, type Actor, type ArenaState, type InputFrame, type Telegraph } from './types.ts';
import { hasLineOfSight } from './water.ts';
import { paceOf, paced, pacedWarning, warningFloor } from './tuning.ts';
export type { AttackShape, AttackSpec, BehaviourRule, EnemyBehaviour, EnemySpec } from './enemy-behaviour.ts';
export { behaviourTable, compileBehaviour } from './enemy-behaviour.ts';
export const enemyRoster: readonly EnemySpec[] = [...enemyData.soldiers, ...enemyData.creatures];
const defined = new Map<string, { spec: EnemySpec; behaviour: EnemyBehaviour }>();
/** Registers an enemy: its behaviour compiles here, once, so a prose or table error throws at load rather than mid-bout. */
export function defineEnemy(spec: EnemySpec): EnemyBehaviour {
  if (defined.has(spec.id)) throw Error(`Enemy ${spec.id} is already defined`);
  const behaviour = compileBehaviour(spec); defined.set(spec.id, { spec, behaviour }); return behaviour;
}
checkBehaviourTable(enemyRoster); for (const spec of enemyRoster) defineEnemy(spec);
export const enemySpec = (a: Actor): EnemySpec | undefined => a.enemy && defined.get(a.enemy.id)?.spec;
const behaviourOf = (a: Actor): EnemyBehaviour => defined.get(a.enemy!.id)!.behaviour;
export function addEnemy(state: ArenaState, id: string, pos: Vec): Actor {
  const spec = defined.get(id)?.spec; if (!spec) throw Error(`Unknown enemy ${id}`);
  const a = addMage(state, 1, pos, spec.name); a.hp = a.maxHp = spec.hp; a.poise = spec.poise; a.speedMps = spec.speedMps;
  a.enemy = { id, readyTick: state.tick, backoffUntil: 0, stunnedUntil: 0, attackIndex: 0, deathQueued: false };
  return a;
}
/** An enemy windup is a warning: paced, but never below its reaction-band floor (every enemy windup counts as positional). */
export const pacedWindupS = (a: Actor, attack: Pick<AttackSpec, 'family' | 'windupS'>): number => pacedWarning(a, attack.windupS, warningFloor(attack.family, true));
/** The range an attack plants at: its own shape first, then the band a kiter holds, then the authored or shared range. */
function attackRangeM(spec: EnemySpec, attack: AttackSpec, shape: AttackShape): number {
  if (shape.kind === 'net') return runtime.games.netRangeM;
  if (shape.kind === 'lane') return runtime.games.tongueRangeM;
  if (shape.kind === 'charge') return shape.rangeM;
  // A kiter must reach its authored engagement band before planting to shoot.
  // Projectile travel range remains unchanged in scheduleAttack.
  if (spec.keepDistanceM) return spec.keepDistanceM[1]!;
  // A projectile attack approaches to its own rangeM when set, the shared ranged range otherwise (VR CR-003 Attack.RangeM).
  return attack.rangeM ?? (attack.projectileMps ? runtime.games.rangedRangeM : runtime.games.defaultMeleeRangeM);
}
function scheduleAttack(state: ArenaState, a: Actor, target: Actor, b: EnemyBehaviour, attack: AttackSpec, shape: AttackShape): void {
  const id = state.nextId++, brain = a.enemy!, windupS = pacedWindupS(a, attack);
  const t: Telegraph = { id, activationId: id, ownerId: a.id, family: attack.family, tier: attack.tier ?? 0, damage: attack.damage, source: { ...a.pos },
    kind: attack.projectileMps ? 'projectile' : 'melee', origin: { ...a.pos }, target: { ...target.pos }, startTick: state.tick + 1,
    resolveTick: state.tick + 1 + ticks(windupS), speedMps: (attack.projectileMps ?? 0) * paceOf(a),
    rangeM: attack.rangeM ?? (attack.projectileMps ? runtime.games.rangedRangeM : runtime.games.defaultMeleeRangeM), widthM: runtime.games.meleeArcDeg };
  if (shape.kind === 'net') { t.kind = 'area'; t.rangeM = runtime.games.netRangeM; t.widthM = shape.widthM; t.rootS = shape.rootS; }
  if (shape.kind === 'lane') { t.kind = 'lane'; t.rangeM = runtime.games.tongueRangeM; t.widthM = runtime.games.tongueWidthM; t.pullM = shape.pullM; }
  if (shape.kind === 'charge') { t.kind = 'charge'; t.widthM = shape.widthM; t.rangeM = shape.rangeM; t.wallStunS = shape.wallStunS; }
  // The body travels after the full warning; travelM + reachM stays inside the authored range (compile-arena-data checks it).
  if (attack.travelM !== undefined) { t.travelM = attack.travelM; t.travelTicks = ticks(paced(a, attack.travelS!)); if (attack.reachM !== undefined) t.reachM = attack.reachM; }
  state.telegraphs.push(t); brain.attackIndex++;
  const cooldown = attack.cooldownS !== undefined ? paced(a, attack.cooldownS) : b.cooldown ? paced(a, runtime.games[b.cooldown])
    : windupS + paced(a, attack.travelS ?? 0) + paced(a, attack.recoveryS ?? runtime.games.defaultRecoveryS);
  brain.readyTick = state.tick + 1 + ticks(cooldown);
  if (b.reload) brain.recoveryUntil = state.tick + 1 + ticks(windupS + paced(a, runtime.games[b.reload]));
  if (b.backoffS !== undefined) { brain.backoffUntil = brain.readyTick + ticks(paced(a, b.backoffS)); brain.readyTick = brain.backoffUntil; }
}
export function enemyInputs(state: ArenaState): Record<number, InputFrame> {
  const inputs: Record<number, InputFrame> = {};
  const enemies = state.actors.filter(a => a.enemy && !a.tags.includes("DEFEATED"));
  // A pack is every living enemy of one id whose behaviour shares engagement slots.
  const packs = new Map<string, Actor[]>();
  for (const a of enemies) if (behaviourOf(a).engagementSlots !== undefined) { const pack = packs.get(a.enemy!.id); if (pack) pack.push(a); else packs.set(a.enemy!.id, [a]); }
  for (const a of enemies) {
    const spec = enemySpec(a)!, b = behaviourOf(a), brain = a.enemy!;
    const targets = state.actors.filter(t => t.team !== a.team && !t.tags.includes("DEFEATED") && (distance(a.pos, t.pos) <= runtime.games.contactRangeM || hasLineOfSight(state, a.pos, t.pos)));
    targets.sort((x, y) => (b.target === 'absorb-first' ? Number(y.absorb) - Number(x.absorb) : 0) || distance(a.pos, x.pos) - distance(a.pos, y.pos) || x.id - y.id);
    const target = targets[0]; if (!target) continue;
    const input = idleInput(target.pos); inputs[a.id] = input;
    if (state.tick < (a.staggerUntil ?? 0) || state.tick < brain.stunnedUntil || state.tick < a.water.encasedUntil) continue;
    const windup = state.telegraphs.find(t => t.ownerId === a.id && !t.survivesOwner);
    // A travelling body keeps facing along its committed line, even past the point it aimed at.
    if (windup) { const line = travelLine(windup); input.aim = windup.contacted ? { x: line.end.x + line.dir.x, y: line.end.y + line.dir.y } : { ...windup.target }; continue; }
    if (state.tick < (brain.recoveryUntil ?? 0)) continue;
    if (b.backoffS !== undefined && state.tick < brain.backoffUntil - ticks(paced(a, b.backoffS))) continue;
    const delta = sub(target.pos, a.pos), d = distance(target.pos, a.pos), toward = unit(delta);
    let desired = { ...toward };
    const index = brain.attackIndex % spec.attacks.length, attack = spec.attacks[index]!, shape = b.attacks[index]!;
    const attackRange = attackRangeM(spec, attack, shape);
    if (b.approach === 'band') {
      desired = d < spec.keepDistanceM![0]! ? { x: -toward.x, y: -toward.y } : d > spec.keepDistanceM![1]! ? toward : { x: 0, y: 0 };
    } else if (b.approach === 'stationary') desired = d <= attackRange ? { x: 0, y: 0 } : toward;
    else if (b.approach === 'net-strafe') desired = d < runtime.games.netRangeM / 2 ? { x: -toward.x, y: -toward.y } : d > runtime.games.netRangeM ? toward : { x: -toward.y, y: toward.x };
    else if (b.backoffS !== undefined && state.tick < brain.backoffUntil) desired = d < runtime.games.conscriptBackoffM ? { x: -toward.x, y: -toward.y } : { x: 0, y: 0 };
    else if (d < attackRange * 0.8) desired = { x: 0, y: 0 };
    // Engagement belongs to the nearest available pack members, not spawn order.
    // Distant first-spawned pack members must not reserve both slots while a close one circles.
    const engaged = b.engagementSlots === undefined
      || [...packs.get(brain.id)!].sort((x, y) => distance(x.pos, target.pos) - distance(y.pos, target.pos) || x.id - y.id).indexOf(a) < b.engagementSlots;
    if (!engaged) desired = d > runtime.games.houndOrbitM ? toward : { x: -toward.y, y: toward.x };
    if (b.contactDrain && shape.kind === 'drain') {
      desired = d > runtime.games.contactRangeM ? toward : { x: 0, y: 0 };
      if (d <= runtime.games.contactRangeM && state.tick + 1 >= target.immuneUntil && state.tick + 1 >= target.water.encasedUntil) {
        const drain = shape.manaPerS / combat.simStepHz;
        target.mana = Math.max(0, target.mana - drain); if (target.mana === 0) { target.absorb = false; target.absorbExhausted = true; }
      }
    } else if (engaged && d <= attackRange && state.tick + 1 >= brain.readyTick) { scheduleAttack(state, a, target, b, attack, shape); desired = { x: 0, y: 0 }; }
    if (desired.x || desired.y) {
      for (const other of enemies) if (other !== a) {
        const gap = distance(a.pos, other.pos);
        if (gap > 0 && gap < runtime.games.separationM) { const away = unit(sub(a.pos, other.pos)); desired.x += away.x * runtime.games.separationWeight; desired.y += away.y * runtime.games.separationWeight; }
      }
      input.move = unit(desired);
      // Close open-ground gaps using the same stamina-costed sprint as any actor.
      // Backoff, attack windup and recovery retain the authored walk/stop rules.
      input.sprint = b.sprint && state.tick >= brain.backoffUntil && d > attackRange;
    }
  }
  return inputs;
}
export function queueDeathEffects(state: ArenaState): void {
  for (const a of state.actors) {
    if (!a.tags.includes("DEFEATED") || !a.enemy || a.enemy.deathQueued) continue;
    a.enemy.deathQueued = true; const spec = enemySpec(a)!;
    if (!spec.onDeath) continue;
    const d = spec.onDeath, id = state.nextId++;
    state.telegraphs.push({ id, activationId: id, ownerId: a.id, family: d.family, tier: d.tier, damage: d.damage, source: { ...a.pos },
      kind: 'area', origin: { ...a.pos }, target: { ...a.pos }, startTick: state.tick, resolveTick: state.tick + ticks(d.delayS), speedMps: 0, rangeM: d.radiusM, widthM: d.radiusM, survivesOwner: true });
  }
}
