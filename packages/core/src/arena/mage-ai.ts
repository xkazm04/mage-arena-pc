import { tuningFor } from './tuning.ts';
import { arenaContains, arenaGeometry } from './geometry.ts';
import { enemyData } from './data.generated.ts';
import { spellFor, spells } from './catalog.ts';
import { bolt, combat, random, runtime, ticks } from './kernel.ts';
import { clamp, distance, inArc, rotate, segmentHit, sub, unit, type Vec } from './math.ts';
import { hasLineOfSight } from './water.ts';
import { idleInput, type Actor, type ArenaState, type InputFrame } from './types.ts';
export function competence(level: number) {
  const rows = enemyData.mages.competence, bounded = clamp(level, rows[0].level, rows.at(-1)!.level);
  const lo = rows[Math.floor(bounded) - 1]!, hi = rows[Math.ceil(bounded) - 1]!, fraction = bounded - Math.floor(bounded);
  const interpolate = (key: 'reactionDelayS' | 'absorbChanceVsAbsorbable' | 'perfectAbsorbChance' | 'aimErrorDeg' | 'decisionCadenceS'): number => lo[key] + (hi[key] - lo[key]) * fraction;
  return { level: bounded, reactionDelayS: Math.max(enemyData.mages.caps.reactionDelayMinS, interpolate('reactionDelayS')),
    absorbChance: interpolate('absorbChanceVsAbsorbable'), perfectChance: Math.min(enemyData.mages.caps.perfectAbsorbChanceMax, interpolate('perfectAbsorbChance')),
    aimErrorDeg: interpolate('aimErrorDeg'), decisionCadenceS: interpolate('decisionCadenceS') };
}
export function attachMageAI(a: Actor, level: number, tick = 0): void {
  a.mageAI = { competence: level, nextDecisionTick: tick, input: idleInput(), observed: [], defendUntil: 0, plannedRaiseTick: 1e9, plannedReleaseTick: 0,
    targetPoint: { ...a.pos }, decisionTicks: [], reactionAges: [] };
}
interface Threat { id: number; family: string; origin: Vec; impactTick: number; aimedAtUs: boolean }
function threats(state: ArenaState, a: Actor): Threat[] {
  const result: Threat[] = [];
  for (const p of state.projectiles) {
    const owner = state.actors.find(o => o.id === p.ownerId); if (owner?.team === a.team || !hasLineOfSight(state, a.pos, p.pos)) continue;
    const speed = Math.hypot(p.velocity.x, p.velocity.y), d = unit(p.velocity);
    const end = { x: p.pos.x + d.x * p.remainingM, y: p.pos.y + d.y * p.remainingM };
    result.push({ id: p.activationId, family: p.family, origin: p.pos, impactTick: state.tick + Math.max(1, ticks((distance(p.pos, a.pos) - p.radius - a.radius) / speed)), aimedAtUs: segmentHit(p.pos, end, a.pos, a.radius + p.radius) !== undefined });
  }
  for (const t of state.telegraphs) {
    const owner = state.actors.find(o => o.id === t.ownerId); if (owner?.team === a.team || !hasLineOfSight(state, a.pos, t.origin)) continue;
    const end = t.kind === 'area' ? t.target : { x: t.origin.x + unit(sub(t.target, t.origin)).x * t.rangeM, y: t.origin.y + unit(sub(t.target, t.origin)).y * t.rangeM };
    const aimedAtUs = t.kind === 'area' ? distance(t.target, a.pos) < t.widthM + a.radius
      : t.kind === 'melee' ? distance(t.origin, a.pos) < t.rangeM + a.radius && inArc(sub(t.target, t.origin), sub(a.pos, t.origin), t.widthM)
      : segmentHit(t.origin, end, a.pos, a.radius + (t.kind === 'projectile' ? runtime.geometry.projectileRadiusM : t.widthM / 2)) !== undefined;
    result.push({ id: t.activationId, family: t.family, origin: t.origin, impactTick: t.resolveTick + (t.kind === 'projectile' ? ticks(distance(t.origin, a.pos) / t.speedMps) : 0), aimedAtUs });
  }
  for (const enemy of state.actors) {
    if (enemy.team === a.team || enemy.down || !enemy.pending || !hasLineOfSight(state, a.pos, enemy.pos)) continue;
    const p = enemy.pending;
    const s = spells.find(s => s.id === p.spellId);
    if (s?.kind === 'self' || s?.kind === 'passive') continue;
    const centre = s?.kind === 'zone' || s?.kind === 'target' ? p.aim : enemy.pos;
    const aimedAtUs = s?.kind === 'zone' ? distance(centre, a.pos) <= s.radiusM + a.radius
      : s?.kind === 'target' ? p.targetId === a.id
      : s?.kind === 'cone' || s?.kind === 'ring' ? distance(centre, a.pos) <= s.rangeM + a.radius && inArc(sub(p.aim, enemy.pos), sub(a.pos, centre), s.arcDeg)
      : true;
    result.push({ id: p.activationId, family: p.kind === 'staff' ? 'physical' : s?.family ?? 'magic', origin: centre,
      impactTick: p.releaseTick + (s?.kind === 'projectile' ? ticks(distance(enemy.pos, a.pos) / s.speedMps) : 0), aimedAtUs });
  }
  return result;
}
export function mageInput(state: ArenaState, a: Actor): InputFrame {
  const brain = a.mageAI; if (!brain || a.down) return idleInput();
  const tune = tuningFor(state), baseProfile = competence(brain.competence);
  const profile = { ...baseProfile, reactionDelayS: Math.max(enemyData.mages.caps.reactionDelayMinS, baseProfile.reactionDelayS * tune.enemyReactionScale), aimErrorDeg: baseProfile.aimErrorDeg * tune.enemyAimErrorScale };
  const target = state.actors.filter(t => t.team !== a.team && !t.down && hasLineOfSight(state, a.pos, t.pos)).sort((x, y) => distance(a.pos, x.pos) - distance(a.pos, y.pos) || x.id - y.id)[0];
  const seen = threats(state, a);
  for (const threat of seen) {
    let memory = brain.observed.find(m => m.id === threat.id);
    if (!memory) { memory = { id: threat.id, firstSeenTick: state.tick, reacted: false }; brain.observed.push(memory); }
    if (memory.reacted || !threat.aimedAtUs || state.tick - memory.firstSeenTick < ticks(profile.reactionDelayS)) continue;
    memory.reacted = true; brain.reactionAges.push(state.tick - memory.firstSeenTick);
    if (threat.family === 'magic') {
      if (random(state, `mage ${a.id} absorb ${threat.id}`) < profile.absorbChance) {
        brain.targetPoint = { ...threat.origin };
        const perfect = random(state, `mage ${a.id} perfect ${threat.id}`) < profile.perfectChance;
        brain.plannedRaiseTick = perfect ? Math.max(state.tick + 1, threat.impactTick - Math.floor(ticks(tune.absorbWindowS) / 2)) : state.tick + 1;
        brain.plannedReleaseTick = threat.impactTick + 1; brain.defendUntil = brain.plannedReleaseTick;
      }
    } else if (a.stamina >= combat.roll.staminaCost) {
      brain.input.roll = true; const away = unit(sub(a.pos, threat.origin)); brain.input.move = { x: -away.y, y: away.x };
      brain.defendUntil = state.tick + ticks(runtime.games.mageDefenceHoldS);
    }
  }
  // Drop stale observation ids only after their activation is absent; projectile ids retain cast ids.
  brain.observed = brain.observed.filter(m => seen.some(t => t.id === m.id));
  if (state.tick >= brain.nextDecisionTick) {
    brain.nextDecisionTick = state.tick + ticks(profile.decisionCadenceS); brain.decisionTicks.push(state.tick);
    if (state.tick >= brain.defendUntil) {
      const input = idleInput(brain.targetPoint); brain.input = input;
      if (target) {
        const d = distance(a.pos, target.pos), direction = unit(sub(target.pos, a.pos));
        const strafe = Math.floor(state.tick / ticks(runtime.games.mageStrafePeriodS)) % 2 ? 1 : -1;
        const aggression = brain.aggression ?? 1;
        const preferred = runtime.games.magePreferredDistanceM.map(v => v * (1.3 - .3 * aggression));
        input.move = d > preferred[1]! ? direction : d < preferred[0]! ? { x: -direction.x, y: -direction.y } : { x: -direction.y * strafe, y: direction.x * strafe };
        // Turn inward at the arena edge instead of getting pinned by the clamp.
        if (!arenaContains(a.pos, runtime.games.spawnMarginM)) input.move = unit(sub(arenaGeometry.centre, a.pos));
        const aimPoint = target.water.decoy?.pos ?? target.pos;
        const velocity = sub(target.pos, target.previousPos), lead = d / bolt.speedMps * combat.simStepHz * runtime.games.mageAimLeadFraction;
        const prediction = target.water.decoy ? aimPoint : { x: aimPoint.x + velocity.x * lead, y: aimPoint.y + velocity.y * lead };
        const error = (random(state, `mage ${a.id} aim`) * 2 - 1) * profile.aimErrorDeg * Math.PI / 180;
        const aimDirection = rotate(sub(prediction, a.pos), error); input.aim = { x: a.pos.x + aimDirection.x, y: a.pos.y + aimDirection.y };
        const available = Array.from({ length: combat.lines.slots + 1 }, (_, slot) => ({ slot, s: spellFor(a, slot, state)! })).filter(({ s }) => s.kind !== 'passive' && (a.water.cooldowns[s.line] ?? 0) <= state.tick + 1 && (a.water.flow >= combat.flow.max || s.mana <= a.mana) && (!s.rangeM || d <= s.rangeM));
        const useful = available.filter(({ s }) => s.damage > 0 || (['heal','hot'].includes(s.effect) && a.hp < a.maxHp) || (s.effect === 'font' && a.mana < a.maxMana) || (s.effect === 'ward' && seen.some(t => t.family === 'magic')) || s.kind === 'zone' || s.effect === 'decoy' || s.effect === 'sheen' || s.effect === 'encase');
        const choices = useful.length ? useful : available;
        if (choices.length) {
          const choice = profile.level < 2 ? choices[Math.floor(random(state, `mage ${a.id} spell`) * choices.length)]!
            : choices.sort((x, y) => {
              const sustainX = ['heal','hot'].includes(x.s.effect) && a.hp < a.maxHp / 2, sustainY = ['heal','hot'].includes(y.s.effect) && a.hp < a.maxHp / 2;
              const counterX = profile.level >= 3 && target.absorb && x.s.family === 'unblockable', counterY = profile.level >= 3 && target.absorb && y.s.family === 'unblockable';
              return Number(counterY) - Number(counterX) || Number(sustainY) - Number(sustainX) || Number(y.s.line !== a.water.lastLine) - Number(x.s.line !== a.water.lastLine) || y.s.damage * y.s.count - x.s.damage * x.s.count || x.slot - y.slot;
            })[0]!;
          input.slot = choice.slot; input.cast = brain.aggression === undefined || brain.aggression >= 1 || random(state, `mage ${a.id} aggression`) < brain.aggression;
        }
      }
    }
  }
  const result: InputFrame = { ...brain.input, move: { ...brain.input.move }, aim: { ...brain.input.aim } };
  result.absorb = state.tick + 1 >= brain.plannedRaiseTick && state.tick + 1 <= brain.plannedReleaseTick;
  if (result.absorb) { result.cast = false; result.aim = { ...brain.targetPoint }; }
  if (!target) { result.cast = false; result.move = { x: 0, y: 0 }; }
  brain.input.roll = false; return result;
}
