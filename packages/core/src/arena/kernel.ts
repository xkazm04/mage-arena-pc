import { feelPolicy, paceFor, paceOf, paced, profileFor, tuningFor } from './tuning.ts';
import { combat, statRules, bolt, rankRange } from './data.generated.ts';
import runtime from './data/runtime.json' with { type: 'json' };
import { constrainToArena } from './geometry.ts';
import { distance, inArc, length, sectorSweep, segmentHit, sub, unit, type Vec } from './math.ts';
import { activationBlocked, idleInput, type Actor, type ArenaState, type Difficulty, type Hit, type InputFrame, type Projectile, type Ranks, type Telegraph } from './types.ts';
import { newWaterState } from './catalog.ts';
import { reflectProjectile, refundMult, releaseSpell, resetWater, trySpellCast, updateWater, wardDrainMult, waterAbsorbed } from './water.ts';
import { curvedStep, hasSchoolLoadout, releaseSchoolSpell, resetSchool, schoolBusy, schoolInterrupted, schoolRooted, schoolAfterMove, schoolDeflects, schoolDrainMult, schoolEvades, schoolOnHit, schoolRollStaminaMult, schoolStaminaRegenMult, schoolTick, trySchoolCast } from './schools.ts';
import { stepSchoolEffects } from './shapes.ts';
import { agileRecoveryS, agilityDrainMult, agilityRecoveryMult } from './progression.ts';
import { exchangeAfterHit } from './exchange.ts';
import { contactVerdict, type ContactOutcome, type ContactVerdict } from './contact.ts';

export { combat, statRules, bolt, runtime };
export const DT = 1 / combat.simStepHz;
export const ticks = (seconds: number): number => Math.ceil(seconds * combat.simStepHz - 1e-9);
export const seconds = (tickCount: number): number => tickCount / combat.simStepHz;
export const drainPerSecond = (rank: number): number => Math.max(0, statRules.drain.base + statRules.drain.perRank * rank);
export const perfectReturn = (tier: number, nerve: number): number => tier === 0 ? statRules.refund.tierZero : statRules.refund.perTier * tier * (1 + statRules.refund.perRank * nerve);
const maximum = (rule: { base: number; perRank: number }, rank: number): number => rule.base + rule.perRank * rank;

/** A difficulty paces every actor spawned into the state (tuning.ts paceFor); without one, actors keep the authored 1x. */
export function createArena(seed = 1, difficulty?: Difficulty): ArenaState {
  const state: ArenaState = { tick: 0, seed: seed >>> 0, rng: seed >>> 0, nextId: 1, actors: [], projectiles: [], telegraphs: [], zones: [], events: [], randomLog: [] };
  if (difficulty !== undefined) { paceFor(0, difficulty); state.difficulty = difficulty; }
  return state;
}
// Mulberry32; even seed zero is a valid independent sequence. Every draw is serialized for replay.
export function random(state: ArenaState, purpose: string): number {
  state.rng = (state.rng + 0x6d2b79f5) >>> 0;
  let t = state.rng; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  state.randomLog.push({ tick: state.tick, purpose, value }); return value;
}
/** A mage's vitals for its ranks: HP and stamina from vigor, mana from focus (the shared stat mapping). Three stats, or four with
 * the optional agility (progression.ts); every present rank is an integer on the shared mapping, else it throws. addMage and an
 * applied build (mage-build.ts) size an actor through this one rule. */
export function mageVitals(ranks: Ranks): { maxHp: number; maxMana: number; maxStamina: number } {
  const keys = Object.keys(ranks);
  if (!(keys.length === 3 || (keys.length === 4 && keys.includes('agility'))) || ['vigor', 'focus', 'nerve', ...(keys.length === 4 ? ['agility'] : [])].some(key => { const r = ranks[key as keyof Ranks]; return !Number.isInteger(r) || r! < rankRange.min || r! > rankRange.max; })) throw Error('Arena ranks are outside the shared mapping');
  return { maxHp: maximum(statRules.hp, ranks.vigor), maxMana: maximum(statRules.mana, ranks.focus), maxStamina: maximum(statRules.stamina, ranks.vigor) };
}
export function addMage(state: ArenaState, team: number, pos: Vec, label = 'Water mage', ranks: Ranks = runtime.training.defaultRanks): Actor {
  const { maxHp, maxMana, maxStamina } = mageVitals(ranks);
  const actor: Actor = {
    id: state.nextId++, team, label, pos: { ...pos }, previousPos: { ...pos }, facing: { x: 1, y: 0 }, radius: runtime.geometry.mageRadiusM,
    ranks: { ...ranks }, hp: maxHp, maxHp, mana: maxMana, maxMana, stamina: maxStamina, maxStamina,
    tags: [], poise: feelPolicy.poise.mage, dummy: false, absorb: false, absorbFreshTick: -1e9, releaseTick: -1e9, absorbExhausted: false, water: newWaterState(),
    lastInput: idleInput(), rollUntil: 0, immuneUntil: 0, recoveryUntil: 0, rollDirection: { x: 1, y: 0 },
    staminaUsedTick: -1e9, cooldownUntil: 0, waveStartTick: state.tick, tier: 1, lastUnlockTick: state.tick,
    clockAdvanceTicks: 0, unlockTicks: [state.tick],
    metrics: { perfects: 0, blocks: 0, hits: 0, damageDealt: 0, damageTaken: 0, manaDrained: 0, manaRaised: 0, manaReturned: 0, casts: 0, rolls: 0 }
  };
  if (state.difficulty !== undefined) actor.pace = paceFor(team, state.difficulty);
  state.actors.push(actor); return actor;
}
export function emit(state: ArenaState, kind: ArenaState['events'][number]['kind'], actor: Actor, value = 0, targetId?: number): void {
  state.events.push({ tick: state.tick, kind, actorId: actor.id, value, ...(targetId === undefined ? {} : { targetId }) });
}
export function interrupt(state: ArenaState, actor: Actor): void {
  const channel = schoolInterrupted(state, actor);
  const hadCast = channel || actor.pending !== undefined || state.telegraphs.some(t => t.ownerId === actor.id);
  actor.pending = undefined; state.telegraphs = state.telegraphs.filter(t => t.ownerId !== actor.id);
  if (hadCast) emit(state, 'interrupt', actor);
}
/** Atomically establish defeat before cancelling commitments. Costs remain spent. */
export function defeatActor(state: ArenaState, actor: Actor, direction: Vec = actor.facing): void {
  if (actor.tags.includes('DEFEATED')) return;
  actor.tags = ['DEFEATED']; actor.hp = 0; actor.defeatedTick = state.tick; actor.defeatDirection = {...direction};
  actor.velocity = {x:0,y:0}; actor.previousPos = {...actor.pos}; actor.absorb = false;
  actor.rollUntil = state.tick; actor.immuneUntil = state.tick;
  emit(state, 'down', actor); interrupt(state, actor);
  for (const other of state.actors) if (other.pending?.targetId === actor.id) interrupt(state, other);
}
/** Explicit Lab/refill revival; ordinary healing never clears defeat. */
export function reviveActor(state: ArenaState, actor: Actor): void {
  actor.tags = []; delete actor.defeatedTick; delete actor.defeatDirection;
  actor.hp = actor.maxHp; actor.velocity = {x:0,y:0}; actor.previousPos = {...actor.pos};
  actor.staggerUntil = actor.staggerImmuneUntil = state.tick;
  actor.rollUntil = actor.immuneUntil = actor.recoveryUntil = state.tick;
  actor.absorb = false; actor.pending = undefined; delete actor.exchange;
}
/** Observer seam kept outside the hashed state: every tap sees each contact before resolveHit applies it, including
 * the contacts immunity swallows without an event. Taps read and never write; ledger.ts is the client. */
export type ContactTap = (state: ArenaState, target: Actor, hit: Hit) => void;
const contactTaps = new WeakMap<ArenaState, ContactTap[]>();
export function tapContacts(state: ArenaState, tap: ContactTap): () => void {
  const list = contactTaps.get(state) ?? []; list.push(tap); contactTaps.set(state, list);
  return () => { const i = list.indexOf(tap); if (i >= 0) list.splice(i, 1); };
}
/** Second observer seam, same rules as tapContacts: once per contact, after resolveHit's gates and before it applies the
 * blow, the gate that ended it or the kernel's own verdict (contact.ts). The ledger grades from it. */
export type VerdictTap = (state: ArenaState, target: Actor, hit: Hit, outcome: ContactOutcome, verdict?: ContactVerdict) => void;
const verdictTaps = new WeakMap<ArenaState, VerdictTap[]>();
export function tapVerdicts(state: ArenaState, tap: VerdictTap): () => void {
  const list = verdictTaps.get(state) ?? []; list.push(tap); verdictTaps.set(state, list);
  return () => { const i = list.indexOf(tap); if (i >= 0) list.splice(i, 1); };
}
function hearVerdict(state: ArenaState, target: Actor, hit: Hit, outcome: ContactOutcome, verdict?: ContactVerdict): void {
  for (const tap of verdictTaps.get(state) ?? []) tap(state, target, hit, outcome, verdict);
}
/** Rule seam kept outside the hashed state (like tapContacts), so a state without hooks steps exactly as before.
 * `beforeCast` runs in the actor's step after its release and before its own cast press (true: a cast was started and
 * releases now if due); `afterHits` runs once per tick after every hit has landed and before the tier clocks.
 * The named-rival phases (rival-phases.ts, VR CR-005) are the client. A cloned state carries no hooks. */
export interface ArenaHooks { beforeCast?(state: ArenaState, a: Actor, input: InputFrame): boolean; afterHits?(state: ArenaState): void }
const arenaHooks = new WeakMap<ArenaState, ArenaHooks[]>();
export function hookArena(state: ArenaState, hooks: ArenaHooks): () => void {
  const list = arenaHooks.get(state) ?? []; list.push(hooks); arenaHooks.set(state, list);
  return () => { const i = list.indexOf(hooks); if (i >= 0) list.splice(i, 1); };
}
export function resolveHit(state: ArenaState, target: Actor, hit: Hit): { damage: number; perfect: boolean; evaded?: true } {
  for (const tap of contactTaps.get(state) ?? []) tap(state, target, hit);
  const gate: ContactOutcome | undefined = target.tags.includes("DEFEATED") ? 'defeated' : state.tick < target.immuneUntil ? 'roll' : state.tick < target.water.encasedUntil ? 'encase' : undefined;
  if (gate) { hearVerdict(state, target, hit, gate); return { damage: 0, perfect: false }; }
  if (schoolEvades(state, target, hit)) { hearVerdict(state, target, hit, 'evaded'); return { damage: 0, perfect: false, evaded: true }; }
  const tune = tuningFor(state);
  const owner = state.actors.find(a => a.id === hit.ownerId);
  const verdict = contactVerdict(state, target, owner, hit);
  hearVerdict(state, target, hit, 'resolved', verdict);
  const { incomingDamage, warded, perfect, reduction, damage } = verdict, windowReduction = verdict.guard === 'window' ? reduction : undefined, guarded = verdict.guard !== undefined;
  if (perfect) {
    target.metrics.perfects++;
    const refund = Math.min(target.maxMana - target.mana, perfectReturn(hit.tier, target.ranks.nerve) * refundMult(state, target) * tune.perfectRefundScale);
    target.mana += refund; target.metrics.manaReturned += refund;
    target.clockAdvanceTicks += ticks(combat.tierClock.perfectAbsorbAdvanceS);
    emit(state, 'perfect', target, refund, hit.ownerId);
  } else if (reduction > 0) target.metrics.blocks++;
  if (reduction > 0 && warded) waterAbsorbed(state, target, hit, incomingDamage - damage, perfect);
  const applied = state.lab?.damageEnabled === false ? 0 : damage;
  const hpRemoved = Math.min(target.hp, applied);
  target.hp = Math.max(0, target.hp - applied); target.metrics.damageTaken += hpRemoved;
  if (owner) owner.metrics.damageDealt += hpRemoved;
  target.metrics.hits++; emit(state, 'hit', target, hpRemoved, hit.ownerId);
  Object.assign(state.events.at(-1)!, { family: hit.family, contactDamage: damage, guarded: guarded && reduction > 0, activationId: hit.activationId, at: {...target.pos} });
  const direction = unit(sub(target.pos, hit.source), target.facing);
  Object.assign(state.events.at(-1)!, { direction });
  if (hpRemoved > 0) {
    if (tune.hitStunS + tune.hitStunPerDamageS > 0 && state.tick >= (target.staggerImmuneUntil ?? 0)) {
      const poise = Math.max(0.1, target.poise * tune.poiseScale);
      const duration = Math.min(tune.hitStunMaxS, Math.max(tune.hitStunS, (tune.hitStunS + hpRemoved * tune.hitStunPerDamageS) / poise));
      target.staggerUntil = state.tick + ticks(duration);
      target.staggerImmuneUntil = target.staggerUntil + ticks(tune.hitStunGraceS);
      if (!target.tags.includes('STAGGERED')) target.tags.push('STAGGERED');
      target.velocity = {x:0,y:0}; target.rollUntil = state.tick;
      interrupt(state, target);
      emit(state, 'stagger', target, seconds(ticks(duration)), hit.ownerId);
      Object.assign(state.events.at(-1)!, { direction });
    }
    if (tune.knockbackM > 0) { const amount = tune.knockbackM * Math.min(2, hpRemoved / 10) / Math.max(1,target.poise); target.pos = constrainToArena({ x: target.pos.x + direction.x * amount, y: target.pos.y + direction.y * amount }, target.radius); }
  }
  schoolOnHit(state, target, owner, hit, { damage, perfect, reduction });
  exchangeAfterHit(state, target, owner, hpRemoved, guarded && reduction > 0, windowReduction !== undefined);
  if (target.hp === 0) defeatActor(state, target, unit(sub(target.pos, hit.source)));
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
  } else if (!a.absorb && !a.absorbExhausted && state.tick >= a.rollUntil && !a.pending && state.tick - a.releaseTick >= ticks(combat.absorb.minReleaseBeforeReRaiseS * agilityRecoveryMult(a, state))) {
    if (a.mana >= combat.absorb.raiseCostMana) {
      a.mana -= combat.absorb.raiseCostMana; a.metrics.manaRaised += combat.absorb.raiseCostMana;
      a.absorb = true; a.absorbFreshTick = state.tick;
    } else a.absorbExhausted = true;
  }
  if (a.absorb) {
    const cost = drainPerSecond(a.ranks.nerve) * wardDrainMult(state, a) * schoolDrainMult(state, a) * agilityDrainMult(a, state) * tuningFor(state).absorbDrainScale * DT;
    const paid = Math.min(a.mana, cost); a.mana -= paid; a.metrics.manaDrained += paid;
    if (paid < cost || a.mana <= 1e-9) { a.mana = Math.max(0, a.mana); a.absorb = false; a.absorbExhausted = true; }
  }
}
function moveActor(state: ArenaState, a: Actor, input: InputFrame): void {
  if (activationBlocked(a)) return;
  a.previousPos = { ...a.pos };
  const tune = tuningFor(state);
  const canCancel = !a.pending || tune.castCommitFraction >= 1 || state.tick < a.pending.startTick + Math.ceil((a.pending.releaseTick - a.pending.startTick) * tune.castCommitFraction);
  const rooted = state.tick < a.water.rootUntil || a.pending?.spellId === 'mend:4:base' || schoolRooted(state, a);
  if (!rooted && canCancel && input.roll && !a.lastInput.roll && state.tick >= a.rollUntil && state.tick >= a.recoveryUntil && a.stamina >= combat.roll.staminaCost * schoolRollStaminaMult(state, a)) {
    a.rollDirection = unit(input.move, a.facing); a.rollUntil = state.tick + ticks(paced(a, tune.rollDurationS));
    a.immuneUntil = state.tick + ticks(paced(a, tune.rollIFramesS)); a.recoveryUntil = a.rollUntil + ticks(agileRecoveryS(a, tune.rollRecoveryS, state)); a.rollRecoveryUntil = a.recoveryUntil;
    a.stamina -= combat.roll.staminaCost * schoolRollStaminaMult(state, a); a.staminaUsedTick = state.tick; a.metrics.rolls++;
    a.absorb = false; if (input.absorb) a.absorbExhausted = true; interrupt(state, a); emit(state, 'roll', a);
  }
  let velocity = { x: 0, y: 0 };
  const pace = paceOf(a);
  if (state.tick < a.rollUntil) {
    // The roll keeps its distance; pace only shortens it.
    const speed = tune.rollDistanceM / (ticks(paced(a, tune.rollDurationS)) * DT);
    velocity = { x: a.rollDirection.x * speed, y: a.rollDirection.y * speed };
  } else if (!rooted && length(input.move) > 0) {
    const move = unit(input.move); let speed: number = a.speedMps ?? tune.walkMps;
    const sprintCost = combat.movement.sprintStaminaPerSecond * DT;
    if (input.sprint && !a.absorb && !a.pending && a.stamina >= sprintCost) {
      speed = tune.sprintMps; a.stamina -= sprintCost; a.staminaUsedTick = state.tick;
    }
    if (state.tick < (a.rollRecoveryUntil ?? 0)) speed *= tune.rollRecoveryMoveMultiplier;
    speed *= profileFor(a).move * pace;
    if (a.pending) speed *= tune.castMoveMultiplier;
    if (a.absorb) speed *= combat.absorb.moveSpeedWhileHeldMult;
    if (state.tick < a.water.slowUntil) speed *= a.water.slowMult;
    velocity = { x: move.x * speed, y: move.y * speed };
  }
  if (state.tick >= a.rollUntil && !rooted && (tune.accelerationMps2 > 0 || tune.decelerationMps2 > 0)) {
    const previous = a.velocity ?? { x: 0, y: 0 }, dx = velocity.x - previous.x, dy = velocity.y - previous.y;
    // Pace squared: time to top speed shrinks by the pace while the distance it takes is kept.
    const acceleration = (length(input.move) > 0 ? tune.accelerationMps2 : tune.decelerationMps2) * pace * pace;
    const amount = acceleration === 0 ? 1 : Math.min(1, acceleration * DT / Math.max(1e-9, Math.hypot(dx, dy)));
    velocity = { x: previous.x + dx * amount, y: previous.y + dy * amount };
    a.velocity = { ...velocity };
  } else if (a.velocity) a.velocity = state.tick < a.rollUntil ? {x:0,y:0} : { ...velocity };
  a.pos = constrainToArena({ x: a.pos.x + velocity.x * DT, y: a.pos.y + velocity.y * DT }, a.radius);
}
function releaseCast(state: ArenaState, a: Actor): void {
  if (activationBlocked(a)) return;
  const pending = a.pending; if (!pending || state.tick < pending.releaseTick) return;
  if (pending.kind === 'spell') { if (hasSchoolLoadout(a)) releaseSchoolSpell(state, a); else releaseSpell(state, a); return; }
  a.pending = undefined;
  emit(state, 'release', a); Object.assign(state.events.at(-1)!, { activationId: pending.activationId, at: {...a.pos} });
  const direction = unit(sub(pending.aim, a.pos), a.facing);
  if (pending.kind === 'bolt') {
    spawnProjectile(state, { ownerId: a.id, activationId: pending.activationId, damage: bolt.damage, family: 'magic', tier: 0, source: { ...a.pos }, bolt: true },
      a.pos, direction, bolt.speedMps * paceOf(a), bolt.rangeM);
  } else {
    for (const target of state.actors) {
      if (target.team === a.team || target.tags.includes("DEFEATED") || distance(a.pos, target.pos) > combat.staffStrike.rangeM || !inArc(direction, sub(target.pos, a.pos), runtime.geometry.staffArcDeg)) continue;
      resolveHit(state, target, { ownerId: a.id, activationId: pending.activationId, damage: combat.staffStrike.damage, family: 'physical', tier: 0, source: { ...a.pos }, delivery: 'melee' });
    }
    a.recoveryUntil = state.tick + ticks(agileRecoveryS(a, combat.staffStrike.recoveryS, state));
  }
}
function startCast(state: ArenaState, a: Actor, input: InputFrame): void {
  if (activationBlocked(a) || !input.cast || a.pending || a.absorb || state.tick < a.rollUntil || state.tick < a.recoveryUntil || schoolBusy(state, a)) return;
  const nearby = input.slot === 0 && state.actors.some(t => t.team !== a.team && !t.tags.includes("DEFEATED") && distance(a.pos, t.pos) <= combat.staffStrike.rangeM && inArc(a.facing, sub(t.pos, a.pos), runtime.geometry.staffArcDeg));
  if (nearby) {
    if (a.stamina < combat.staffStrike.staminaCost || state.tick < a.cooldownUntil) return;
    a.stamina -= combat.staffStrike.staminaCost; a.staminaUsedTick = state.tick;
    a.pending = { kind: 'staff', startTick: state.tick, releaseTick: state.tick + ticks(paced(a, combat.staffStrike.windupS)), aim: { ...input.aim }, activationId: state.nextId++ };
    a.cooldownUntil = a.pending.releaseTick + ticks(agileRecoveryS(a, combat.staffStrike.recoveryS, state));
  } else {
    if (hasSchoolLoadout(a) ? trySchoolCast(state, a, input) : trySpellCast(state, a, input)) releaseCast(state, a);
    return;
  }
  a.metrics.casts++; emit(state, 'cast', a); releaseCast(state, a);
}
/** A charge or a lunge: once its warning ends, the owner's body carries the attack along the committed line. */
export const committedBody = (t: Telegraph): boolean => t.kind === 'charge' || t.travelM !== undefined;
export function travelLine(t: Telegraph): { dir: Vec; distanceM: number; end: Vec } {
  const dir = unit(sub(t.target, t.origin)), distanceM = t.travelM ?? t.rangeM;
  return { dir, distanceM, end: { x: t.origin.x + dir.x * distanceM, y: t.origin.y + dir.y * distanceM } };
}
/** Earliest fraction of the body's from->to step at which its envelope meets a disk: the lane width for a charge, the weapon sector for a lunge. */
export function bodyContact(t: Telegraph, from: Vec, to: Vec, centre: Vec, radius: number): number | undefined {
  return t.kind === 'charge' ? segmentHit(from, to, centre, t.widthM / 2 + radius) : sectorSweep(from, to, travelLine(t).dir, centre, (t.reachM ?? t.rangeM) + radius, t.widthM);
}
const endTelegraph = (state: ArenaState, t: Telegraph): void => { state.telegraphs = state.telegraphs.filter(x => x !== t); };
/** One fixed travel step from the origin-based path; each target is contacted at most once per activation, earliest first. */
function travel(state: ArenaState, t: Telegraph, owner: Actor): void {
  const n = Math.max(1, t.travelTicks ?? 1), k = state.tick - t.resolveTick + 1, { dir, distanceM } = travelLine(t), s = distanceM * Math.min(1, k / n);
  const want = { x: t.origin.x + dir.x * s, y: t.origin.y + dir.y * s }, next = constrainToArena(want, owner.radius), from = { ...owner.pos };
  const wall = next.x !== want.x || next.y !== want.y;
  owner.pos = next; if (owner.velocity) owner.velocity = { x: 0, y: 0 };
  const met: { target: Actor; at: number }[] = [];
  for (const target of state.actors) {
    if (target.team === owner.team || target.tags.includes("DEFEATED") || t.contacted!.includes(target.id)) continue;
    const at = bodyContact(t, from, next, target.pos, target.radius);
    if (at !== undefined) met.push({ target, at });
  }
  met.sort((x, y) => x.at - y.at || x.target.id - y.target.id);
  for (const { target, at } of met) {
    t.contacted!.push(target.id);
    resolveHit(state, target, { ...t, source: { x: from.x + (next.x - from.x) * at, y: from.y + (next.y - from.y) * at }, delivery: t.kind === 'melee' ? 'melee' : 'area' });
    // A reaction that staggers or downs the owner has already cancelled the travel.
    if (!state.telegraphs.includes(t)) return;
  }
  if (wall && t.wallStunS && owner.enemy) owner.enemy.stunnedUntil = state.tick + ticks(t.wallStunS);
  if (wall || k >= n) endTelegraph(state, t);
}
function updateTelegraphs(state: ArenaState): void {
  const due = state.telegraphs.filter(t => t.resolveTick <= state.tick);
  state.telegraphs = state.telegraphs.filter(t => t.resolveTick > state.tick || t.contacted);
  for (const t of due) {
    const owner = state.actors.find(a => a.id === t.ownerId);
    // Stagger, defeat or encasement stops a committed body where it stands.
    if (!owner || (owner.tags.includes("DEFEATED") && !t.survivesOwner) || (!t.survivesOwner && (activationBlocked(owner) || state.tick < owner.water.encasedUntil))) { if (t.contacted) endTelegraph(state, t); continue; }
    if (t.contacted) { if (state.telegraphs.includes(t)) travel(state, t, owner); continue; }
    emit(state, 'release', owner, t.tier); Object.assign(state.events.at(-1)!, {activationId:t.activationId, at:{...t.origin}});
    const direction = unit(sub(t.target, t.origin));
    if (committedBody(t)) { t.contacted = []; state.telegraphs.push(t); travel(state, t, owner); }
    else if (t.kind === 'projectile') spawnProjectile(state, t, t.origin, direction, t.speedMps, t.rangeM);
    else {
      const end = { x: t.origin.x + direction.x * t.rangeM, y: t.origin.y + direction.y * t.rangeM };
      for (const target of state.actors) {
        if (target.team === owner.team || target.tags.includes("DEFEATED")) continue;
        const inShape = t.kind === 'area' ? distance(t.target, target.pos) <= t.widthM + target.radius
          : t.kind === 'melee' ? distance(t.origin, target.pos) <= t.rangeM + target.radius && inArc(direction, sub(target.pos, t.origin), t.widthM)
          : segmentHit(t.origin, end, target.pos, t.widthM / 2 + target.radius) !== undefined;
        if (!inShape) continue;
        const immune = state.tick < target.immuneUntil || state.tick < target.water.encasedUntil;
        const result = resolveHit(state, target, { ...t, source: t.kind === 'area' ? { ...t.target } : t.source, delivery: t.kind === 'melee' ? 'melee' : 'area' });
        if (!immune && !result.perfect && !target.tags.includes("DEFEATED")) {
          if (t.rootS) target.water.rootUntil = Math.max(target.water.rootUntil, state.tick + ticks(t.rootS));
          if (t.pullM) {
            const direction = unit(sub(owner.pos, target.pos)), amount = Math.min(t.pullM, Math.max(0, distance(owner.pos, target.pos) - owner.radius - target.radius));
            target.pos = constrainToArena({ x: target.pos.x + direction.x * amount, y: target.pos.y + direction.y * amount }, target.radius);
          }
        }
      }
    }
  }
}
function updateProjectiles(state: ArenaState): void {
  // Reactions append projectiles; do not advance those until the next tick.
  for (const p of [...state.projectiles]) {
    const travel = Math.min(length(p.velocity) * DT, p.remainingM), direction = unit(p.velocity);
    p.previousPos = { ...p.pos };
    const curved = p.arc ? curvedStep(p, travel) : undefined;
    const end = curved?.end ?? { x: p.pos.x + direction.x * travel, y: p.pos.y + direction.y * travel };
    const moveOn = (): void => { p.pos = end; p.remainingM -= travel; if (curved) { p.velocity = curved.velocity; if (curved.arc) p.arc = curved.arc; } };
    const owner = state.actors.find(a => a.id === p.ownerId);
    let first: Actor | undefined, firstT = Infinity;
    for (const a of state.actors) {
      if (a.tags.includes("DEFEATED") || a.team === owner?.team || a.id === p.ownerId || p.hitIds.includes(a.id)) continue;
      const t = segmentHit(p.pos, end, a.pos, a.radius + p.radius);
      if (t !== undefined && t < firstT) { firstT = t; first = a; }
    }
    if (first) {
      // Incoming direction is the last segment, even when the original caster moved.
      p.source = { ...p.pos }; const result = resolveHit(state, first, { ...p, delivery: p.burstRadiusM || p.piercing ? 'area' : 'projectile' }); p.hitIds.push(first.id);
      // Air Form: an evaded projectile flies on through the body.
      if (result.evaded) { moveOn(); continue; }
      if (result.perfect && !schoolDeflects(state, first, p)) reflectProjectile(state, first, p);
      if (p.burstRadiusM && !result.perfect) {
        for (const target of state.actors) if (!target.tags.includes("DEFEATED") && target.team !== owner?.team && !p.hitIds.includes(target.id) && distance(target.pos, first.pos) <= p.burstRadiusM) {
          resolveHit(state, target, { ...p, source: { ...first.pos }, delivery: 'area' }); p.hitIds.push(target.id);
        }
      }
      if (!p.piercing && !result.perfect && (p.pierceLeft ?? 0) > 0) { p.pierceLeft!--; moveOn(); }
      else if (!p.piercing || result.perfect) p.remainingM = 0;
      else moveOn();
    } else moveOn();
  }
  state.projectiles = state.projectiles.filter(p => p.remainingM > 1e-9);
}
export function updateClock(state: ArenaState, a: Actor): void {
  const next = (a.tier + 1) as 2 | 3 | 4;
  if (next > 4) return;
  if (state.tick - a.waveStartTick + a.clockAdvanceTicks >= ticks((next - 1) * tuningFor(state).collarIntervalS) && state.tick - a.lastUnlockTick >= ticks(combat.tierClock.minimumSecondsBetweenUnlocks)) {
    a.tier = next; a.lastUnlockTick = state.tick; a.unlockTicks.push(state.tick); emit(state, 'unlock', a, next);
  }
}
/** Exactly one fixed simulation tick. Inputs are absolute and do not contain timestamps. */
export function stepArena(state: ArenaState, inputs: Readonly<Record<number, InputFrame>> = {}): void {
  state.tick++;
  const hooks = arenaHooks.get(state);
  for (const a of state.actors) {
    if (a.tags.includes("DEFEATED")) continue;
    if (state.tick >= (a.staggerUntil ?? 0)) a.tags = a.tags.filter(tag => tag !== "STAGGERED");
    schoolTick(state, a);
    updateWater(state, a);
    a.mana = Math.min(a.maxMana, a.mana + maximum(statRules.manaRegen, a.ranks.focus) * tuningFor(state).manaRegenScale * DT);
    if (state.tick - a.staminaUsedTick >= ticks(combat.stamina.regenDelayS)) a.stamina = Math.min(a.maxStamina, a.stamina + combat.stamina.regenPerSecond * schoolStaminaRegenMult(state, a) * DT);
    if (state.tick < a.water.encasedUntil) { a.previousPos = { ...a.pos }; continue; }
    if (state.tick < (a.staggerUntil ?? 0)) { a.previousPos = { ...a.pos }; updateWard(state, a, inputs[a.id] ?? idleInput()); if (a.velocity) a.velocity = { x: 0, y: 0 }; continue; }
    const input = inputs[a.id] ?? idleInput({ x: a.pos.x + a.facing.x, y: a.pos.y + a.facing.y });
    a.facing = unit(sub(input.aim, a.pos), a.facing);
    updateWard(state, a, input); moveActor(state, a, input); schoolAfterMove(state, a); releaseCast(state, a);
    if (hooks) for (const h of hooks) if (h.beforeCast?.(state, a, input)) releaseCast(state, a);
    startCast(state, a, input);
    a.lastInput = { ...input, move: { ...input.move }, aim: { ...input.aim } };
  }
  // VR steps trails and beams before projectiles (Kernel UpdateFireOngoing); a no-op without school effects.
  updateTelegraphs(state); stepSchoolEffects(state); updateProjectiles(state); state.zones = state.zones.filter(z => z.until > state.tick);
  // Every hit of this tick has landed: a rule hook (a rival's phase break and its surge) goes before the normal clock.
  if (hooks) for (const h of hooks) h.afterHits?.(state);
  for (const a of state.actors) if (!a.tags.includes("DEFEATED")) updateClock(state, a);
}
export function resetWave(state: ArenaState, actor: Actor): void {
  actor.tags = []; delete actor.defeatedTick; delete actor.defeatDirection;
  actor.hp += (actor.maxHp - actor.hp) * combat.betweenWaves.healFractionOfMissingHp;
  actor.mana = actor.maxMana * combat.betweenWaves.manaRefill; actor.stamina = actor.maxStamina * combat.betweenWaves.staminaRefill;
  actor.tier = 1; actor.waveStartTick = state.tick; actor.lastUnlockTick = state.tick; actor.clockAdvanceTicks = 0; actor.unlockTicks = [state.tick];
  actor.absorb = false; actor.absorbExhausted = false; actor.absorbFreshTick = -1e9; actor.releaseTick = -1e9;
  actor.pending = undefined; actor.cooldownUntil = state.tick; actor.rollUntil = state.tick; actor.immuneUntil = state.tick; actor.recoveryUntil = state.tick;
  actor.velocity = {x:0,y:0}; actor.staggerUntil = state.tick; actor.staggerImmuneUntil = state.tick; actor.rollRecoveryUntil = state.tick;
  actor.lastInput = idleInput(); state.projectiles = []; state.telegraphs = []; state.zones = []; if (state.schoolEffects) state.schoolEffects = []; resetWater(actor); resetSchool(actor); delete actor.exchange;
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
