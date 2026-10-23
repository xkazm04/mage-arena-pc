// Named-rival phases: HP-gated breaks, the tier surge and the granted signature (VR CR-005, the rule as
// mage-arena-vr Kernel/VrRivals.cpp runs it; owner decision 2026-10-23: only the named Brennic and Lio phase, PC data).
// Every piece of runtime lives in a WeakMap keyed by the state and reaches the kernel through hookArena, so the state
// hash never reads it and a state without phases steps exactly as before. games.ts enables it for schoolRivals 'named'.
import rivalData from './data/rivals.json' with { type: 'json' };
import { arenaTiers } from './data.generated.ts';
import { emit, hookArena } from './kernel.ts';
import { rivalSchool } from './school-rivals.ts';
import { schoolBusy, schoolSpellById, startGrantedSchoolCast } from './schools.ts';
import { activationBlocked, isDefeated, slotSchools, type Actor, type ArenaState, type SlotSchool } from './types.ts';
import type { Vec } from './math.ts';

export interface RivalPhase { atHpFraction: number; opensWith?: string }
export interface RivalSpec { id: string; school: SlotSchool; wave: number; phases: RivalPhase[]; surgeTiers: number;
  /** The named rival's max HP (PC balance, owner 2026-10-23); absent keeps the ranks' HP. */
  maxHp?: number }
/** The collar's last tier (kernel updateClock stops at IV; VR TierCap 4). */
export const tierCap = 4;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const unknownKeys = (v: Record<string, unknown>, known: string[]): string[] => Object.keys(v).filter(k => !k.startsWith('_') && !known.includes(k));
/** Problems with a rivals data file (data/rivals.json shape). Empty means every rival binds and every phase can fire. */
export function rivalProblems(candidate: unknown): string[] {
  if (!isRecord(candidate) || !isRecord(candidate.rivals)) return ['rivals.json: no rivals object'];
  const out: string[] = unknownKeys(candidate, ['rivals']).map(k => `rivals.json: unknown key ${k}`);
  const waves = arenaTiers.tiers[0]!.waves, seen = new Set<number>();
  for (const [id, rival] of Object.entries(candidate.rivals)) {
    const at = `rivals.json ${id}`;
    if (!isRecord(rival)) { out.push(`${at}: not an object`); continue; }
    out.push(...unknownKeys(rival, ['school', 'wave', 'phases', 'surgeTiers', 'maxHp']).map(k => `${at}: unknown key ${k}`));
    const school = rival.school, wave = rival.wave;
    if (typeof school !== 'string' || !(slotSchools as readonly string[]).includes(school)) out.push(`${at}: school ${String(school)} is not fire or air`);
    if (typeof wave !== 'number' || !Number.isInteger(wave) || wave < 0 || wave >= waves.length || !waves[wave]!.spawns.some(s => 'competence' in s)) out.push(`${at}: wave ${String(wave)} is not a Tiro mage wave`);
    else {
      if (seen.has(wave)) out.push(`${at}: a second rival on wave ${wave}`);
      seen.add(wave);
      if (school !== rivalSchool('named', wave)) out.push(`${at}: the named bracket spawns ${rivalSchool('named', wave)} on wave ${wave}, not ${String(school)}`);
    }
    if (rival.maxHp !== undefined && (typeof rival.maxHp !== 'number' || !Number.isFinite(rival.maxHp) || rival.maxHp <= 0)) out.push(`${at}: maxHp ${String(rival.maxHp)} is not a positive number`);
    const tiers = rival.surgeTiers;
    if (typeof tiers !== 'number' || !Number.isInteger(tiers) || tiers < 0 || tiers >= tierCap) out.push(`${at}: surgeTiers ${String(tiers)} is not an integer 0..${tierCap - 1}`);
    const phases = rival.phases;
    if (!Array.isArray(phases) || phases.length === 0) { out.push(`${at}: no phases`); continue; }
    let previous = 1;
    phases.forEach((phase: unknown, i) => {
      if (!isRecord(phase)) { out.push(`${at} phase ${i}: not an object`); return; }
      out.push(...unknownKeys(phase, ['atHpFraction', 'opensWith']).map(k => `${at} phase ${i}: unknown key ${k}`));
      const f = phase.atHpFraction;
      if (typeof f !== 'number' || !(f > 0 && f < previous)) out.push(`${at} phase ${i}: atHpFraction ${String(f)} is not in (0, ${previous})`);
      else previous = f;
      const spell = phase.opensWith;
      if (spell !== undefined && (typeof spell !== 'string' || schoolSpellById(spell)?.school !== school)) out.push(`${at} phase ${i}: opensWith ${String(spell)} is not one of the ${String(school)} spells`);
    });
  }
  return out;
}
const loadProblems = rivalProblems(rivalData);
if (loadProblems.length) throw Error(loadProblems.join(' '));
/** The authored rivals, in file order. */
export const rivals: RivalSpec[] = Object.entries(rivalData.rivals).map(([id, r]) => ({ id, school: r.school as SlotSchool, wave: r.wave,
  phases: r.phases.map(p => ({ atHpFraction: p.atHpFraction, ...('opensWith' in p ? { opensWith: p.opensWith } : {}) })), surgeTiers: r.surgeTiers, ...('maxHp' in r && typeof r.maxHp === 'number' ? { maxHp: r.maxHp } : {}) }));
/** Named bracket: give the spawned rival of this wave its authored HP (with or without phases). */
export function applyRivalHp(actor: Actor, wave: number, specs: RivalSpec[] = rivals): void {
  const rival = specs.find(r => r.wave === wave && r.school === actor.schoolState?.school);
  if (rival?.maxHp !== undefined) { actor.maxHp = rival.maxHp; actor.hp = rival.maxHp; }
}

/** Phase runtime of one duel (VR FVrRivalRuntime): cleared on every wave spawn, never in the state hash. */
export interface RivalRuntime {
  specs: RivalSpec[]; rival?: RivalSpec; actorId?: number; phasesBroken: number; breakTicks: number[];
  grantPending: boolean; grantSpell?: string; grantUsed: boolean; grantTick?: number;
}
const runtimes = new WeakMap<ArenaState, RivalRuntime>();
const fresh = (specs: RivalSpec[]): RivalRuntime => ({ specs, phasesBroken: 0, breakTicks: [], grantPending: false, grantUsed: false });
/** Read-only view for tests and measurement; undefined when phases are not enabled on this state. */
export const rivalRuntime = (state: ArenaState): Readonly<RivalRuntime> | undefined => runtimes.get(state);

/** Turn phases on for this state (games.ts, named mode). Idempotent per state. */
export function enableRivalPhases(state: ArenaState, specs: RivalSpec[] = rivals): void {
  if (runtimes.has(state)) return;
  runtimes.set(state, fresh(specs));
  hookArena(state, { afterHits: tickRivalPhases, beforeCast: (s, a, input) => tryGrantedCast(s, a, input.aim) });
}
/** A rival belongs to one wave: every spawn starts empty, and the spawn binds again or leaves it empty. */
export function beginRivalWave(state: ArenaState): void {
  const rt = runtimes.get(state); if (rt) runtimes.set(state, fresh(rt.specs));
}
/** Bind a freshly spawned school mage when a rival names its wave and school (the first such mage only). */
export function bindRival(state: ArenaState, actor: Actor, wave: number): boolean {
  const rt = runtimes.get(state), school = actor.schoolState?.school;
  if (!rt || rt.actorId !== undefined || !school) return false;
  const rival = rt.specs.find(r => r.wave === wave && r.school === school);
  if (!rival) return false;
  rt.rival = rival; rt.actorId = actor.id;
  return true;
}

/** One surge step per tier, each a normal unlock; the minimum gap is not checked, and the clock counts its gap from here. */
function surge(state: ArenaState, a: Actor, tiers: number): void {
  for (let step = 0; step < tiers && a.tier < tierCap; step++) {
    a.tier++; a.lastUnlockTick = state.tick; a.unlockTicks.push(state.tick); emit(state, 'unlock', a, a.tier);
  }
}
/** Once per tick, after every hit and before the tier clocks (VR TickRivalPhases). */
export function tickRivalPhases(state: ArenaState): void {
  const rt = runtimes.get(state), rival = rt?.rival; if (!rt || !rival) return;
  const actor = state.actors.find(a => a.id === rt.actorId);
  // A downed rival ends the duel: its last hit is the victory, not a phase.
  if (!actor || isDefeated(actor)) return;
  let broke = false;
  while (rt.phasesBroken < rival.phases.length) {
    const index = rt.phasesBroken, phase = rival.phases[index]!;
    if (!(actor.hp <= phase.atHpFraction * actor.maxHp)) break;
    rt.phasesBroken++; rt.breakTicks.push(state.tick); broke = true;
    // Value is the phase now entered (2, then 3); targetId is the index of the threshold that broke.
    emit(state, 'phase', actor, index + 2, index);
    surge(state, actor, rival.surgeTiers);
    for (const other of state.actors) {
      if (other.id === actor.id || other.team === actor.team || isDefeated(other) || other.enemy || other.dummy) continue;
      surge(state, other, rival.surgeTiers);
    }
    if (phase.opensWith && !rt.grantUsed && !rt.grantPending) { rt.grantPending = true; rt.grantSpell = phase.opensWith; }
  }
  // The break tick itself when the rival is free; otherwise the actor step starts it once the current action ends.
  if (broke && rt.grantPending) tryGrantedCast(state, actor, actor.lastInput.aim);
}
/** Start the pending granted signature when the rival's hands are free (VR TryGrantedCast). Spent when the cast starts. */
export function tryGrantedCast(state: ArenaState, a: Actor, aim: Vec): boolean {
  const rt = runtimes.get(state);
  if (!rt?.grantPending || rt.grantSpell === undefined || rt.actorId !== a.id || isDefeated(a)) return false;
  if (activationBlocked(a) || a.pending || schoolBusy(state, a) || a.absorb || state.tick < a.rollUntil || state.tick < a.recoveryUntil || state.tick < a.water.encasedUntil) return false;
  if (!startGrantedSchoolCast(state, a, rt.grantSpell, aim)) return false;
  rt.grantPending = false; rt.grantUsed = true; rt.grantTick = state.tick;
  return true;
}
