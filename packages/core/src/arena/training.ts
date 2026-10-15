import { reviveActor, addMage, createArena, random, runtime, ticks, seconds, spawnProjectile, stepArena, stateHash, combat } from './kernel.ts';
import { distance, sub, unit } from './math.ts';
import { idleInput, type Actor, type ArenaState, type Difficulty, type Family, type InputFrame } from './types.ts';
import { enemyRoster, pacedWindupS } from './enemies.ts';
import { defaultDifficulty, paceOf } from './tuning.ts';
const canonAttack = (id: string) => {
  const attack = enemyRoster.flatMap(e => e.attacks).find(a => a.id === id);
  if (!attack) throw Error(`Unknown training attack ${id}`);
  return attack;
};
const laneSize = (text: string | undefined, pattern: RegExp): number => {
  const match = text?.match(pattern); if (!match) throw Error(`Missing lane size: ${text}`); return Number(match[1]);
};
const ranged = (spec: { attack: string; rangeM: number }) => {
  const a = canonAttack(spec.attack);
  return { damage: a.damage, tier: a.tier ?? 0, windupS: a.windupS, speedMps: a.projectileMps ?? 0, rangeM: spec.rangeM };
};
const chargeAttack = canonAttack(runtime.training.charge.attack);
/** Training attacks are canon enemy attacks by id; runtime.json authors only the range canon leaves to the arena. */
export const trainingAttacks = {
  magic: ranged(runtime.training.magic), physical: ranged(runtime.training.physical),
  charge: { damage: chargeAttack.damage, windupS: chargeAttack.windupS, rangeM: laneSize(chargeAttack.telegraph, /x ([\d.]+) m/), widthM: laneSize(chargeAttack.telegraph, /lane ([\d.]+) m/) },
};
export type TrainingKind = 'magic' | 'physical' | 'flanker' | 'charge' | 'stream' | 'performance';
export type BotKind = 'perfect' | 'holder' | 'never' | 'late';
export interface Training { state: ArenaState; player: Actor; dummy: Actor; kind: TrainingKind; nextAttack: number; attacks: number }
export function createTraining(kind: TrainingKind = 'magic', seed = 1, difficulty: Difficulty = defaultDifficulty): Training {
  const state = createArena(seed, difficulty);
  const player = addMage(state, 0, runtime.training.player, 'Cassia');
  const dummy = addMage(state, 1, kind === 'physical' ? runtime.training.side : runtime.training.front, 'Training target');
  dummy.dummy = true; dummy.hp = dummy.maxHp = runtime.training.dummyHp;
  return { state, player, dummy, kind, nextAttack: ticks(runtime.training.firstAttackS), attacks: 0 };
}
export function scheduleTraining(t: Training): void {
  const { state, dummy, player } = t;
  if (dummy.tags.includes("DEFEATED") || player.tags.includes("DEFEATED")) return;
  if (t.kind === 'performance') {
    const field = runtime.training.performanceField;
    while (state.projectiles.length < runtime.training.performanceProjectiles) {
      const origin = { x: player.pos.x + (random(state, 'performance x') - 0.5) * field.widthM, y: player.pos.y + (random(state, 'performance y') - 0.5) * field.heightM };
      spawnProjectile(state, { ownerId: dummy.id, activationId: state.nextId++, damage: 0, family: 'magic', tier: 0, source: origin }, origin, { x: 1, y: 0 }, field.speedMps, field.rangeM);
    }
    return;
  }
  if (state.tick + 1 < t.nextAttack) return;
  t.nextAttack += ticks(runtime.training.attackIntervalS); t.attacks++;
  if (t.kind === 'flanker') dummy.pos = { x: t.attacks % 2 ? runtime.training.front.x : 2 * runtime.training.player.x - runtime.training.front.x, y: runtime.training.front.y };
  const spec = t.kind === 'physical' ? trainingAttacks.physical : trainingAttacks.magic;
  const count = t.kind === 'stream' ? runtime.training.streamCount : 1;
  const family: Family = t.kind === 'charge' ? 'unblockable' : t.kind === 'physical' ? 'physical' : 'magic';
  // The dummy's canon attack runs at the dummy's pace like any enemy's; the drill cadence (interval, stream gap) stays in seconds.
  const windupS = pacedWindupS(dummy, { family, windupS: t.kind === 'charge' ? trainingAttacks.charge.windupS : spec.windupS });
  for (let i = 0; i < count; i++) {
    const id = state.nextId++;
    state.telegraphs.push({ id, activationId: id, ownerId: dummy.id, family,
      damage: t.kind === 'charge' ? trainingAttacks.charge.damage : spec.damage, tier: spec.tier,
      source: { ...dummy.pos }, origin: { ...dummy.pos }, target: { ...player.pos }, startTick: state.tick + 1,
      resolveTick: state.tick + 1 + ticks(windupS) + i * ticks(runtime.training.streamIntervalS),
      kind: t.kind === 'charge' ? 'lane' : 'projectile', speedMps: spec.speedMps * paceOf(dummy),
      rangeM: t.kind === 'charge' ? trainingAttacks.charge.rangeM : spec.rangeM, widthM: trainingAttacks.charge.widthM });
  }
}
/** Instrumented timing oracle for mechanics evidence, not an opponent AI or human-feel claim. */
export function timingBot(t: Training, kind: BotKind, leadTicks?: number): InputFrame {
  const { state, player, dummy } = t;
  const input = idleInput(dummy.pos);
  if (kind === 'never') return input;
  if (kind === 'holder') { input.absorb = true; return input; }
  const lead = leadTicks ?? ticks(kind === 'perfect' ? runtime.training.perfectBotLeadS : runtime.training.lateBotLeadS);
  const incoming = state.projectiles.filter(p => p.ownerId !== player.id && p.family === 'magic').map(p => {
    const d = distance(p.pos, player.pos) - p.radius - player.radius;
    const toward = unit(sub(player.pos, p.pos));
    const speed = p.velocity.x * toward.x + p.velocity.y * toward.y;
    return { p, impactInTicks: speed > 0 ? Math.max(1, Math.ceil(d / (speed / combat.simStepHz) - 1e-9)) : Infinity };
  }).sort((a, b) => a.impactInTicks - b.impactInTicks)[0];
  if (incoming) {
    input.aim = incoming.p.pos;
    // Input applies on the following tick. A lead of nine yields an age of nine at impact.
    input.absorb = incoming.impactInTicks <= lead + 1;
  }
  return input;
}
export function stepTraining(t: Training, input: InputFrame): void {
  scheduleTraining(t); stepArena(t.state, { [t.player.id]: input });
  // Replenish expired/hit field particles before presenting the completed tick.
  if (t.kind === 'performance') scheduleTraining(t);
}
export function runTimingBot(kind: BotKind, durationS = runtime.training.reportDurationS, leadTicks?: number) {
  const t = createTraining('magic');
  // The report resets HP only on Down to continue observation; resources are never refilled.
  let downs = 0; const manaCurve: { second: number; mana: number; perfects: number }[] = [];
  for (let i = 0; i < ticks(durationS); i++) {
    stepTraining(t, timingBot(t, kind, leadTicks));
    if (t.player.tags.includes("DEFEATED")) { downs++; reviveActor(t.state, t.player); t.player.hp = t.player.maxHp; }
    if (t.state.tick % combat.simStepHz === 0) manaCurve.push({ second: seconds(t.state.tick), mana: t.player.mana, perfects: t.player.metrics.perfects });
  }
  return { kind, durationS, leadTicks: leadTicks ?? (kind === 'perfect' ? ticks(runtime.training.perfectBotLeadS) : kind === 'late' ? ticks(runtime.training.lateBotLeadS) : null),
    attacks: t.attacks, ...t.player.metrics, downs, finalMana: t.player.mana, perfectRate: t.player.metrics.perfects / t.player.metrics.hits,
    unlockSeconds: t.player.unlockTicks.map(seconds), manaCurve, hash: stateHash(t.state) };
}
