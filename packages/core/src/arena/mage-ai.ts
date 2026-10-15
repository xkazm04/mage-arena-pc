import { paceOf, tuningFor, feelPolicy } from './tuning.ts';
import { arenaContains, arenaGeometry } from './geometry.ts';
import { enemyData } from './data.generated.ts';
import { spellFor, spells, type Spell } from './catalog.ts';
import { bodyContact, bolt, combat, committedBody, random, runtime, ticks, travelLine } from './kernel.ts';
import { clamp, distance, inArc, rotate, segmentHit, sub, unit, type Vec } from './math.ts';
import { hasLineOfSight } from './water.ts';
import { rivalGate, rivalSkipsWard, rivalSteer, rivalTick } from './rival-plan.ts';
import { idleInput, type Actor, type ArenaState, type InputFrame } from './types.ts';
export function competence(level: number) {
  const rows = enemyData.mages.competence, bounded = clamp(level, rows[0].level, rows.at(-1)!.level);
  const lo = rows[Math.floor(bounded) - 1]!, hi = rows[Math.ceil(bounded) - 1]!, fraction = bounded - Math.floor(bounded);
  const curve = (feelPolicy.ai.tierCurvePlay as string[]).includes(lo.usesTierCurve);
  const interpolate = (key: 'reactionDelayS' | 'absorbChanceVsAbsorbable' | 'perfectAbsorbChance' | 'aimErrorDeg' | 'decisionCadenceS'): number => lo[key] + (hi[key] - lo[key]) * fraction;
  return { level: bounded, reactionDelayS: Math.max(enemyData.mages.caps.reactionDelayMinS, interpolate('reactionDelayS')),
    absorbChance: interpolate('absorbChanceVsAbsorbable'), perfectChance: Math.min(enemyData.mages.caps.perfectAbsorbChanceMax, interpolate('perfectAbsorbChance')),
    aimErrorDeg: interpolate('aimErrorDeg'), decisionCadenceS: interpolate('decisionCadenceS'), curve,
    aimLeadFraction: curve ? (feelPolicy.ai.curveAimLeadFraction as Record<string, number>)[lo.level]! : runtime.games.mageAimLeadFraction };
}
export function attachMageAI(a: Actor, level: number, tick = 0): void {
  a.mageAI = { competence: level, nextDecisionTick: tick, input: idleInput(), observed: [], defendUntil: 0, plannedRaiseTick: 1e9, plannedReleaseTick: 0,
    targetPoint: { ...a.pos }, decisionTicks: [], reactionAges: [] };
}
export interface Threat { id: number; family: string; origin: Vec; impactTick: number; aimedAtUs: boolean; damage: number }
/** What an actor can see coming: live projectiles, telegraphs and enemy windups, each with its activation id. */
export function threats(state: ArenaState, a: Actor): Threat[] {
  const result: Threat[] = [];
  for (const p of state.projectiles) {
    const owner = state.actors.find(o => o.id === p.ownerId); if (owner?.team === a.team || !hasLineOfSight(state, a.pos, p.pos)) continue;
    const speed = Math.hypot(p.velocity.x, p.velocity.y), d = unit(p.velocity);
    const end = { x: p.pos.x + d.x * p.remainingM, y: p.pos.y + d.y * p.remainingM };
    result.push({ id: p.activationId, family: p.family, origin: p.pos, impactTick: state.tick + Math.max(1, ticks((distance(p.pos, a.pos) - p.radius - a.radius) / speed)), aimedAtUs: segmentHit(p.pos, end, a.pos, a.radius + p.radius) !== undefined, damage: p.damage });
  }
  for (const t of state.telegraphs) {
    const owner = state.actors.find(o => o.id === t.ownerId); if (owner?.team === a.team || !hasLineOfSight(state, a.pos, t.origin)) continue;
    if (owner && committedBody(t)) {
      // A charge or lunge is read along what is left of its committed line; a body already met cannot meet us again.
      const line = travelLine(t), from = t.contacted ? owner.pos : t.origin, at = t.contacted?.includes(a.id) ? undefined : bodyContact(t, from, line.end, a.pos, a.radius);
      const contactS = distance(t.origin, from) + (at ?? 0) * distance(from, line.end), step = line.distanceM / Math.max(1, t.travelTicks ?? 1);
      result.push({ id: t.activationId, family: t.family, origin: from, impactTick: t.resolveTick + (at === undefined ? 0 : Math.max(0, Math.ceil(contactS / step - 1e-9) - 1)), aimedAtUs: at !== undefined, damage: t.damage });
      continue;
    }
    const end = t.kind === 'area' ? t.target : { x: t.origin.x + unit(sub(t.target, t.origin)).x * t.rangeM, y: t.origin.y + unit(sub(t.target, t.origin)).y * t.rangeM };
    const aimedAtUs = t.kind === 'area' ? distance(t.target, a.pos) < t.widthM + a.radius
      : t.kind === 'melee' ? distance(t.origin, a.pos) < t.rangeM + a.radius && inArc(sub(t.target, t.origin), sub(a.pos, t.origin), t.widthM)
      : segmentHit(t.origin, end, a.pos, a.radius + (t.kind === 'projectile' ? runtime.geometry.projectileRadiusM : t.widthM / 2)) !== undefined;
    result.push({ id: t.activationId, family: t.family, origin: t.origin, impactTick: t.resolveTick + (t.kind === 'projectile' ? ticks(distance(t.origin, a.pos) / t.speedMps) : 0), aimedAtUs, damage: t.damage });
  }
  for (const enemy of state.actors) {
    if (enemy.team === a.team || enemy.tags.includes("DEFEATED") || !enemy.pending || !hasLineOfSight(state, a.pos, enemy.pos)) continue;
    const p = enemy.pending;
    const s = p.spell ?? spells.find(s => s.id === p.spellId);
    if (s?.kind === 'self' || s?.kind === 'passive') continue;
    const centre = s?.kind === 'zone' || s?.kind === 'target' ? p.aim : enemy.pos;
    const aimedAtUs = s?.kind === 'zone' ? distance(centre, a.pos) <= s.radiusM + a.radius
      : s?.kind === 'target' ? p.targetId === a.id
      : s?.kind === 'cone' || s?.kind === 'ring' ? distance(centre, a.pos) <= s.rangeM + a.radius && inArc(sub(p.aim, enemy.pos), sub(a.pos, centre), s.arcDeg)
      : true;
    result.push({ id: p.activationId, family: p.kind === 'staff' ? 'physical' : s?.family ?? 'magic', origin: centre,
      impactTick: p.releaseTick + (s?.kind === 'projectile' ? ticks(distance(enemy.pos, a.pos) / s.speedMps) : 0), aimedAtUs,
      damage: p.kind === 'bolt' ? bolt.damage : p.kind === 'staff' ? combat.staffStrike.damage : (s?.damage ?? 0) * (s?.count ?? 1) * (p.damageMult ?? 1) });
  }
  return result;
}
const deniedDriftS = enemyData.mages.plans.deniedPerfectMarginS;
const fitsBeforeRaise = (state: ArenaState, raiseTick: number, s: Spell): boolean =>
  raiseTick <= state.tick || raiseTick >= state.tick + ticks(Math.max(s.castS, s.telegraphS) + feelPolicy.ai.reactionCastSafetyS);
export function mageInput(state: ArenaState, a: Actor): InputFrame {
  const brain = a.mageAI; if (!brain || a.tags.includes("DEFEATED")) return idleInput();
  const tune = tuningFor(state), baseProfile = competence(brain.competence);
  const profile = { ...baseProfile, reactionDelayS: Math.max(enemyData.mages.caps.reactionDelayMinS, baseProfile.reactionDelayS * tune.enemyReactionScale), aimErrorDeg: baseProfile.aimErrorDeg * tune.enemyAimErrorScale };
  const target = state.actors.filter(t => t.team !== a.team && !t.tags.includes("DEFEATED") && hasLineOfSight(state, a.pos, t.pos)).sort((x, y) => distance(a.pos, x.pos) - distance(a.pos, y.pos) || x.id - y.id)[0];
  const seen = threats(state, a), window = ticks(tune.absorbWindowS);
  // Curve rows: a plain absorb is up for the hit but older than the perfect window; a raise that would land inside it is skipped.
  // A raise is also refused when it could be fresh for another threat whose own perfect roll failed (impact estimates drift, so either side of the raise counts).
  const gifts = (raise: number, id: number): boolean => seen.some(t => t.id !== id && t.aimedAtUs && brain.observed.find(m => m.id === t.id)?.denied && Math.abs(t.impactTick - raise) <= window);
  const wardRaise = (impactTick: number, perfect: boolean, id: number): number | undefined => {
    const fresh = Math.max(state.tick + 1, impactTick - Math.floor(window / 2));
    if (perfect && !gifts(fresh, id)) return fresh;
    const raise = Math.max(state.tick + 1, impactTick - window - ticks(combat.absorb.minReleaseBeforeReRaiseS) - 1);
    return raise < impactTick - window && !gifts(raise, id) ? raise : undefined;
  };
  for (const threat of seen) {
    let memory = brain.observed.find(m => m.id === threat.id);
    if (!memory) { memory = { id: threat.id, firstSeenTick: state.tick, reacted: false }; brain.observed.push(memory); }
    if (memory.reacted || !threat.aimedAtUs || state.tick - memory.firstSeenTick < ticks(profile.reactionDelayS)) continue;
    memory.reacted = true; brain.reactionAges.push(state.tick - memory.firstSeenTick);
    if (threat.family === 'magic') {
      // A threat landing while the planned ward is up rides that ward's decision; no second roll is drawn for it.
      if (profile.curve && brain.plan && state.tick + 1 <= brain.plannedReleaseTick && threat.impactTick >= brain.plannedRaiseTick && threat.impactTick < brain.plannedReleaseTick + window) {
        brain.plannedReleaseTick = Math.max(brain.plannedReleaseTick, threat.impactTick + 1); continue;
      }
      if (brain.rival && rivalSkipsWard(a, threat.damage)) continue;
      if (random(state, `mage ${a.id} absorb ${threat.id}`) < profile.absorbChance) {
        brain.targetPoint = { ...threat.origin };
        const perfect = random(state, `mage ${a.id} perfect ${threat.id}`) < profile.perfectChance;
        if (profile.curve) {
          if (!perfect) memory.denied = true;
          const holding = state.tick + 1 >= brain.plannedRaiseTick && state.tick + 1 <= brain.plannedReleaseTick, raise = wardRaise(threat.impactTick, perfect, threat.id);
          if (holding) brain.plannedReleaseTick = Math.max(brain.plannedReleaseTick, threat.impactTick + 1);
          else if (raise !== undefined) { brain.plan = { threatId: threat.id, perfect }; brain.plannedRaiseTick = raise; brain.plannedReleaseTick = threat.impactTick + 1; }
          continue;
        }
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
  if (brain.plan) {
    // Track the live impact (a pending cast becomes its projectile under the same id) until the raise; then only extend the hold.
    const live = seen.find(t => t.id === brain.plan!.threatId);
    if (state.tick + 1 < brain.plannedRaiseTick) {
      const raise = live ? wardRaise(live.impactTick, brain.plan.perfect, live.id) : brain.plannedRaiseTick;
      if (live) brain.plannedReleaseTick = live.impactTick + 1;
      if (raise === undefined) { brain.plannedRaiseTick = 1e9; brain.plan = undefined; } else brain.plannedRaiseTick = raise;
    } else {
      if (live) brain.plannedReleaseTick = Math.max(brain.plannedReleaseTick, live.impactTick + 1);
      // A raise the kernel delayed (pending cast, roll, re-raise gap) must not become a perfect the roll denied.
      if (!brain.plan.perfect && !a.absorb && state.tick + 1 >= brain.plannedReleaseTick - 1 - window) { brain.plannedRaiseTick = 1e9; brain.plan = undefined; }
    }
  }
  // Curve rows: a ward still fresh drops once a roll-denied threat's live impact falls inside its perfect window (plus the drift margin):
  // impact estimates assume the mage stands still, and at pace the mage and the shot close faster than they predict.
  if (profile.curve && a.absorb && state.tick + 1 - a.absorbFreshTick <= window
    && seen.some(t => t.aimedAtUs && brain.observed.find(m => m.id === t.id)?.denied && t.impactTick - a.absorbFreshTick <= window + ticks(deniedDriftS))) {
    brain.plannedRaiseTick = 1e9; brain.plannedReleaseTick = state.tick; brain.plan = undefined;
  }
  if (brain.rival) rivalTick(state, a, target, seen, window, ticks(profile.reactionDelayS));
  // Curve rows never spend a cadence inside a roll hold; the next decision waits for the hold to end.
  if (state.tick >= brain.nextDecisionTick && (!profile.curve || state.tick >= brain.defendUntil)) {
    brain.nextDecisionTick = state.tick + ticks(profile.decisionCadenceS); brain.decisionTicks.push(state.tick);
    if (state.tick >= brain.defendUntil) {
      const input = idleInput(brain.targetPoint); brain.input = input;
      if (target) {
        const d = distance(a.pos, target.pos), direction = unit(sub(target.pos, a.pos));
        const strafe = Math.floor((state.tick + (state.seed + a.id * 17) % ticks(feelPolicy.ai.strafePhaseS)) / ticks(runtime.games.mageStrafePeriodS)) % 2 ? 1 : -1;
        const aggression = brain.aggression ?? 1, steer = brain.rival && rivalSteer(state, a, target, d, ticks(profile.reactionDelayS));
        const preferred = steer && steer.band ? steer.band : runtime.games.magePreferredDistanceM.map(v => v * (1.3 - .3 * aggression) + ((state.seed + a.id * 31) % 101 / 100 - .5) * feelPolicy.ai.spacingVariationM);
        input.move = steer && steer.move ? steer.move : d > preferred[1]! ? direction : d < preferred[0]! ? { x: -direction.x, y: -direction.y } : { x: -direction.y * strafe, y: direction.x * strafe };
        if (steer && steer.sprint) input.sprint = true;
        // Turn inward at the arena edge instead of getting pinned by the clamp (a plan chasing its target already heads inward).
        if (!arenaContains(a.pos, runtime.games.spawnMarginM) && !(steer && steer.chase)) input.move = unit(sub(arenaGeometry.centre, a.pos));
        const aimPoint = target.water.decoy?.pos ?? target.pos;
        const velocity = sub(target.pos, target.previousPos), lead = d / (bolt.speedMps * paceOf(a)) * combat.simStepHz * profile.aimLeadFraction;
        const prediction = target.water.decoy ? aimPoint : { x: aimPoint.x + velocity.x * lead, y: aimPoint.y + velocity.y * lead };
        const error = (random(state, `mage ${a.id} aim`) * 2 - 1) * profile.aimErrorDeg * Math.PI / 180;
        const aimDirection = rotate(sub(prediction, a.pos), error); input.aim = { x: a.pos.x + aimDirection.x, y: a.pos.y + aimDirection.y };
        // A curve row queues a spell that comes off cooldown by the time its planned ward drops.
        const ready = profile.curve && brain.plannedRaiseTick <= brain.plannedReleaseTick ? Math.max(state.tick, brain.plannedReleaseTick) + 1 : state.tick + 1;
        const available = Array.from({ length: combat.lines.slots + 1 }, (_, slot) => ({ slot, s: spellFor(a, slot, state)! })).filter(({ s }) => s.kind !== 'passive' && (a.water.cooldowns[s.line] ?? 0) <= ready && (a.water.flow >= combat.flow.max || s.mana <= a.mana) && (!s.rangeM || d <= s.rangeM));
        const useful = available.filter(({ s }) => s.damage > 0 || (['heal','hot'].includes(s.effect) && a.hp < a.maxHp) || (s.effect === 'font' && a.mana < a.maxMana) || (s.effect === 'ward' && seen.some(t => t.family === 'magic')) || s.kind === 'zone' || s.effect === 'decoy' || s.effect === 'sheen' || s.effect === 'encase');
        const candidates = useful.length ? useful : available, fitting = candidates.filter(({ s }) => fitsBeforeRaise(state, brain.plannedRaiseTick, s));
        // Curve rows keep choosing while a raise is pending: a spell that cannot finish first waits for the ward to drop.
        const pool = profile.curve && !fitting.length ? candidates : fitting;
        // A rival counter-cast decides among damaging spells only.
        const choices = steer && steer.counter && pool.some(c => c.s.damage > 0) ? pool.filter(c => c.s.damage > 0) : pool;
        const variety = new Map(choices.map(c => [c.slot, random(state, `mage ${a.id} variety ${c.slot}`) * feelPolicy.ai.spellVarietyWeight]));
        const bait = target.absorb || state.tick - target.absorbFreshTick <= ticks(profile.decisionCadenceS);
        const prefers = (s: Spell): boolean => profile.curve ? bait === (s.family === 'unblockable') : profile.level >= 3 && target.absorb && s.family === 'unblockable';
        if (choices.length) {
          const choice = profile.level < 2 ? choices[Math.floor(random(state, `mage ${a.id} spell`) * choices.length)]!
            : choices.sort((x, y) => {
              const sustainX = ['heal','hot'].includes(x.s.effect) && a.hp < a.maxHp / 2, sustainY = ['heal','hot'].includes(y.s.effect) && a.hp < a.maxHp / 2;
              const counterX = prefers(x.s), counterY = prefers(y.s);
              return Number(counterY) - Number(counterX) || Number(sustainY) - Number(sustainX) || Number(y.s.line !== a.water.lastLine) - Number(x.s.line !== a.water.lastLine) || (y.s.damage * y.s.count + variety.get(y.slot)!) - (x.s.damage * x.s.count + variety.get(x.slot)!) || x.slot - y.slot;
            })[0]!;
          input.slot = choice.slot; input.cast = (steer && steer.counter) || brain.aggression === undefined || brain.aggression >= 1 || random(state, `mage ${a.id} aggression`) < brain.aggression;
        }
        if (steer && steer.cast !== undefined) { input.cast = steer.cast; if (steer.slot !== undefined) input.slot = steer.slot; }
      }
    }
  }
  const result: InputFrame = { ...brain.input, move: { ...brain.input.move }, aim: { ...brain.input.aim } };
  result.absorb = state.tick + 1 >= brain.plannedRaiseTick && state.tick + 1 <= brain.plannedReleaseTick;
  if (profile.curve) { const s = spellFor(a, result.slot, state); if (s && !fitsBeforeRaise(state, brain.plannedRaiseTick, s)) result.cast = false; }
  else if (brain.plannedRaiseTick > state.tick && brain.plannedRaiseTick <= state.tick + ticks(profile.decisionCadenceS + feelPolicy.ai.reactionCastSafetyS)) result.cast = false;
  if (brain.rival) rivalGate(state, a, target, result, seen, window, profile.curve);
  if (result.absorb) { result.cast = false; result.aim = { ...brain.targetPoint }; }
  if (!target) { result.cast = false; result.move = { x: 0, y: 0 }; }
  brain.input.roll = false; return result;
}
