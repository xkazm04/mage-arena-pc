// Air: Momentum and the ten Air rows, as mage-arena-vr docs/schools/AIR.md reads them (T23; accepted 2026-10-23 as CR-007).
// W8 lane A owns this file. The C++ reference is VR Kernel/Air.cpp; every reading that is not the literal cell is AIR.md
// "Kernel readings". Numbers come from the canon through schools.ts (slotSpell, balancedSpell, identityNumber); the prose
// cells (shape, damage, momentum_gain, notes) are parsed here strictly, as VR KernelDataAir.cpp does: a cell this file
// cannot read exactly throws at load.
import { combat, DT, emit, interrupt, random, spawnProjectile, ticks } from './kernel.ts';
import { airRows, schoolIdentity } from './data.generated.ts';
import { pacedWarning, paceOf, paced, warningFloor } from './tuning.ts';
import { clamp, distance, rotate, segmentHit, sub, unit, type Vec } from './math.ts';
import { cancelOwnedBeams, dash, queueDetonation, resolveLine, startBeam } from './shapes.ts';
import { identityNumber, schoolSpellById, balancedSpell, rankedSpell, slotSpell, type SchoolRules, type SchoolSpell } from './schools.ts';
import { agileCastS, agileWarningS } from './progression.ts';
import { activationBlocked, type Actor, type ArenaState, type Family, type Hit, type InputFrame, type Projectile, type SchoolState } from './types.ts';

// ---------------------------------------------------------------------------------------------------------------------
// The sheet's prose cells, read once at load.

export type AirKind = 'projectile' | 'twin' | 'dash' | 'veer' | 'zone' | 'form' | 'squall' | 'self' | 'line' | 'beam';
export type MomentumMode = 'hit' | 'target' | 'tick' | 'instant' | 'spend' | 'lock';
/** What the prose cells of one spells-air.csv row say. Every number the canon carries in a numeric column stays in schools.ts. */
export interface AirRow {
  id: string; kind: AirKind; family: Family | 'self';
  speedMps: number; count: number; spreadDeg: number; dashM: number; radiusM: number; durationS: number; tickS: number; intervalS: number; entryDeg: number;
  momentum: { mode: MomentumMode; amount: number; lockValue: number; lockS: number };
  /** "Absorb drain xN" in the notes (Eye of the Storm), else 1. */
  drainMult: number;
  evadePhysical: number; evadeMagic: number; needMomentum: number;
  /** The notes say "rooted" (Tempest Lance). */
  roots: boolean;
  bolt: boolean;
}
const header = 'id,name,tier,shape,cast_s,cooldown_s,mana,damage,blockable,telegraph_s,range_m,momentum_gain,notes'.split(',');
const num = '(\\d+(?:\\.\\d+)?)';
const whole = (cell: string, pattern: string): string[] | undefined => {
  const m = new RegExp(`^${pattern}$`).exec(cell);
  return m ? m.slice(1) : undefined;
};
const counts = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];
function countWord(word: string): number | undefined {
  const index = counts.indexOf(word);
  if (index >= 0) return index;
  return /^\d+$/.test(word) ? Number(word) : undefined;
}
/** Parse the prose of every row; throws on the first cell it cannot read (VR MageArena.Air.StrictLoad). */
export function parseAirRows(rows: readonly Readonly<Record<string, string>>[]): AirRow[] {
  const out: AirRow[] = [];
  for (const row of rows) {
    const keys = Object.keys(row);
    if (keys.join(',') !== header.join(',')) throw Error(`spells-air.csv: header is not '${header.join(',')}'`);
    const id = row.id!, fail = (what: string): never => { throw Error(`spells-air.csv ${id}: ${what}`); };
    if (!/^air_[a-z]+$/.test(id) || !row.name) fail('bad id or name');
    for (const column of ['tier', 'cast_s', 'cooldown_s', 'mana', 'telegraph_s', 'range_m']) if (!/^\d+(?:\.\d+)?$/.test(row[column]!)) fail(`${column} cell '${row[column]}' is not a number`);
    const tier = Number(row.tier), rangeM = Number(row.range_m);
    if (!Number.isInteger(tier) || tier > 4) fail(`tier ${row.tier} is not 0-4`);
    const family = row.blockable === 'UNBLOCKABLE' ? 'unblockable' : row.blockable === 'absorbable' ? 'magic' : row.blockable === 'n/a' ? 'self' : fail(`blockable cell not understood: ${row.blockable}`);
    const r: AirRow = { id, kind: 'projectile', family, speedMps: 0, count: 1, spreadDeg: 0, dashM: 0, radiusM: 0, durationS: 0, tickS: 0, intervalS: 0, entryDeg: 0,
      momentum: { mode: 'hit', amount: 0, lockValue: 0, lockS: 0 }, drainMult: 1, evadePhysical: 0, evadeMagic: 0, needMomentum: 0, roots: false, bolt: id === 'air_bolt' };
    const reach = (value: number): void => { if (Math.abs(value - rangeM) > 1e-9) fail(`shape reach ${value} disagrees with range_m ${rangeM}`); };
    // Shape (ParseAirShape).
    const shape = row.shape!;
    let g: string[] | undefined;
    if ((g = whole(shape, `projectile ${num} m/s`))) { r.kind = 'projectile'; r.speedMps = +g[0]!; }
    else if ((g = whole(shape, `two projectiles ${num} m/s at \\+-${num} deg`))) { r.kind = 'twin'; r.count = 2; r.speedMps = +g[0]!; r.spreadDeg = 2 * +g[1]!; }
    else if ((g = whole(shape, `dash ${num} m`))) { r.kind = 'dash'; r.dashM = +g[0]!; reach(r.dashM); }
    else if ((g = whole(shape, `curving projectile ${num} m/s entering ${num} deg off the line of sight`))) {
      r.kind = 'veer'; r.speedMps = +g[0]!; r.entryDeg = +g[1]!;
      if (!(r.entryDeg > 0 && r.entryDeg < 90)) fail('entry angle must be in (0, 90) degrees');
    }
    else if ((g = whole(shape, `ground circle r ${num} m at a point`))) { r.kind = 'zone'; r.radiusM = +g[0]!; }
    else if ((g = whole(shape, `self ${num} s`))) { r.kind = 'form'; r.durationS = +g[0]!; }
    else if ((g = whole(shape, `([a-z]+|\\d+) projectiles ${num} m/s released ${num} s apart`))) {
      const count = countWord(g[0]!);
      if (count === undefined || count < 2) fail(`volley count '${g[0]}' is not a number of two or more`);
      r.kind = 'squall'; r.count = count!; r.speedMps = +g[1]!; r.intervalS = +g[2]!;
    }
    else if (shape === 'self') r.kind = 'self';
    else if ((g = whole(shape, `line ${num} m(?: lightning)?`))) { r.kind = 'line'; reach(+g[0]!); }
    else if ((g = whole(shape, `channelled beam ${num} m for ${num} s`))) { r.kind = 'beam'; r.durationS = +g[1]!; reach(+g[0]!); }
    else fail(`shape not understood: ${shape}`);
    // Damage (ParseAirDamage). The number itself is schools.ts's; the tick interval is read here.
    if ((g = whole(row.damage!, `${num} per ${num} s tick`))) r.tickS = +g[1]!;
    else if (!whole(row.damage!, `${num}(?: each)?`)) fail(`damage cell not understood: ${row.damage}`);
    if (r.kind === 'beam' && !(r.tickS > 0)) fail('a beam needs a tick interval');
    if (r.kind !== 'beam' && r.tickS > 0) fail('only a beam ticks');
    // Momentum (ParseAirMomentum).
    const cell = row.momentum_gain!;
    if ((g = whole(cell, `${num} per hit`))) r.momentum = { ...r.momentum, mode: 'hit', amount: +g[0]! };
    else if ((g = whole(cell, `${num} per target`))) r.momentum = { ...r.momentum, mode: 'target', amount: +g[0]! };
    else if ((g = whole(cell, `${num} per tick`))) r.momentum = { ...r.momentum, mode: 'tick', amount: +g[0]! };
    else if ((g = whole(cell, `\\+${num} instant`))) r.momentum = { ...r.momentum, mode: 'instant', amount: +g[0]! };
    else if ((g = whole(cell, `spends ${num}`))) r.momentum = { ...r.momentum, mode: 'spend', amount: +g[0]! };
    else if ((g = whole(cell, `Momentum locked at ${num} for ${num} s`))) r.momentum = { mode: 'lock', amount: 0, lockValue: +g[0]!, lockS: +g[1]! };
    else fail(`momentum_gain not understood: ${cell}`);
    if ((r.momentum.mode === 'tick') !== (r.kind === 'beam') || (r.momentum.mode === 'spend') !== (r.kind === 'form') || (r.momentum.mode === 'lock' && r.kind !== 'self'))
      fail(`momentum_gain '${cell}' does not fit shape '${shape}'`);
    // Notes (ParseAirNotes).
    const notes = row.notes!;
    r.roots = /rooted/i.test(notes);
    const drain = /Absorb drain x(\d+(?:\.\d+)?)/.exec(notes);
    if (drain) r.drainMult = +drain[1]!;
    if (r.kind === 'form') {
      const physical = /evade (\d+(?:\.\d+)?) % of physical/.exec(notes), magic = /(\d+(?:\.\d+)?) % of magic/.exec(notes), need = /Needs Momentum (\d+(?:\.\d+)?) or more/.exec(notes);
      if (!physical || !magic || !need) fail('the form notes need the evade chances and the Momentum it needs');
      r.evadePhysical = +physical![1]! / 100; r.evadeMagic = +magic![1]! / 100; r.needMomentum = +need![1]!;
      if (r.evadePhysical > 1 || r.evadeMagic > 1) fail('an evade chance is above 100 %');
      if (!notes.includes('unblockables are not evaded')) fail('the form notes no longer say unblockables are not evaded');
    }
    if ((r.kind === 'dash' || r.kind === 'form' || r.kind === 'self') !== (family === 'self')) fail('n/a belongs to the self and dash rows only');
    if (out.some(o => o.id === id)) fail('duplicate id');
    out.push(r);
  }
  if (!out.length) throw Error('spells-air.csv: no rows');
  return out;
}
export const airSheet: AirRow[] = parseAirRows(airRows as unknown as Readonly<Record<string, string>>[]);
export const airRow = (id: string): AirRow | undefined => airSheet.find(r => r.id === id);

// The Momentum identity (schools-combat.json air), read strictly at load; values through identityNumber so the PC overlay
// applies unless the state runs canonical.
const identity = schoolIdentity.air;
const movingKeys = Object.keys(identity.gain);
const moving = movingKeys.length === 1 ? /^perSecondMovingAbove(\d+(?:\.\d+)?)Mps$/.exec(movingKeys[0]!) : null;
if (!moving) throw Error(`schools-combat.json air.gain: expected one perSecondMovingAbove<N>Mps key, got ${movingKeys.join(', ')}`);
/** "Moving above 4 m/s": the speed is parsed from the key, as VR KernelDataHeat.cpp does. */
export const movingAboveMps = Number(moving[1]);
if (Object.keys(identity.decay).join() !== 'perSecondStill') throw Error('schools-combat.json air.decay: expected perSecondStill only');
const bandKeys = ['spellsPierce', 'rollStaminaMult', 'spellRangeMult'] as const;
type BandKey = typeof bandKeys[number];
const bands = (identity.thresholds as readonly Record<string, number>[]).map((t, i) => {
  const extra = Object.keys(t).filter(k => k !== 'at' && !(bandKeys as readonly string[]).includes(k));
  if (extra.length || typeof t.at !== 'number') throw Error(`schools-combat.json air.thresholds.${i}: unknown keys ${extra.join(', ')}`);
  return { index: i, keys: bandKeys.filter(k => typeof t[k] === 'number') };
});
export function momentumRules(state?: ArenaState): { min: number; max: number; gainPerS: number; decayPerS: number; drainMult: number } {
  return { min: identityNumber('air', 'range.0', state), max: identityNumber('air', 'range.1', state), gainPerS: identityNumber('air', `gain.${movingKeys[0]}`, state),
    decayPerS: identityNumber('air', 'decay.perSecondStill', state), drainMult: identityNumber('air', 'absorbDrainMult', state) };
}

// ---------------------------------------------------------------------------------------------------------------------
// Air's state. The kernel types carry `schoolState`; the volley and the lock value are Air's own optional keys, present
// only on an Air actor that needs them (types.ts request in the lane A report).

export interface AirVolley { spellId: string; startTick: number; aim: Vec; left: number; intervalTicks: number; nextTick: number; damage: number; rangeMult: number; pierceLeft: number }
export type AirSchoolState = SchoolState & { volley?: AirVolley; lockValue?: number; lockDrainMult?: number };
/** A hit that pays its owner Momentum when it resolves (VR FHit::MomentumOnHit; types.ts `Hit.momentumOnHit`). */
export type AirHit = Hit;
/** The fixed-curvature flight of a Veering Bolt (VR FProjectile bCurved, ArcCentre, ArcRadiusM, ArcAngle, ArcSign, ArcLeftM). */
export interface ProjectileArc { centre: Vec; radiusM: number; angle: number; sign: number; leftM: number }
export type AirProjectile = Projectile;

const air = (a: Actor | undefined): AirSchoolState | undefined => a?.schoolState?.school === 'air' ? a.schoolState as AirSchoolState : undefined;
export const isAir = (a: Actor | undefined): boolean => air(a) !== undefined;
export const momentumOf = (a: Actor): number => air(a)?.value ?? 0;

/** Highest band at or below the current Momentum that names the effect (a higher band replaces only what it names). */
function band(state: ArenaState | undefined, a: Actor, key: BandKey, fallback: number): number {
  const s = air(a); if (!s) return fallback;
  let result = fallback;
  for (const b of bands) if (b.keys.includes(key) && s.value >= identityNumber('air', `thresholds.${b.index}.at`, state)) result = identityNumber('air', `thresholds.${b.index}.${key}`, state);
  return result;
}
export const airSpellsPierce = (state: ArenaState | undefined, a: Actor): number => band(state, a, 'spellsPierce', 0);
export const airRollStaminaMult = (state: ArenaState | undefined, a: Actor): number => band(state, a, 'rollStaminaMult', 1);
export const airSpellRangeMult = (state: ArenaState | undefined, a: Actor): number => band(state, a, 'spellRangeMult', 1);

export function gainMomentum(state: ArenaState, a: Actor, amount: number): void {
  const s = air(a); if (!s || !(amount > 0) || state.tick < s.lockedUntil) return;
  const m = momentumRules(state);
  s.value = clamp(s.value + amount, m.min, m.max);
}
/** UpdateAirResource: this tick's locomotion speed decides gain (above the key's speed), decay (zero displacement) or neither. */
function updateMomentum(state: ArenaState, a: Actor, speedMps: number): void {
  const s = air(a)!;
  if (state.tick < s.lockedUntil) { s.value = s.lockValue ?? s.value; return; }
  const m = momentumRules(state);
  if (speedMps > movingAboveMps) gainMomentum(state, a, m.gainPerS * DT);
  else if (!(speedMps > 1e-9)) s.value = clamp(s.value - m.decayPerS * DT, m.min, m.max);
}

// ---------------------------------------------------------------------------------------------------------------------
// Veering Bolt geometry (VR AirVeerArc / AirArcPoint / AirCurvedStep), shared by the kernel, the AI and the presentation.

export interface AirArc { from: Vec; to: Vec; centre: Vec; radiusM: number; startAngle: number; turnSign: number; lengthM: number; launchDir: Vec; straight: boolean }
/** Side +1 launches to the left of the line of sight (even activation id), -1 to the right. No random draw. */
export const veerSide = (activationId: number): number => activationId % 2 === 0 ? 1 : -1;
/** A circular arc through C and T leaving and arriving at E off the chord: R = L / (2 sin E), length 2 E R. */
export function veerArc(from: Vec, to: Vec, entryDeg: number, side: number): AirArc {
  const chord = distance(from, to), along = unit(sub(to, from));
  const arc: AirArc = { from: { ...from }, to: { ...to }, centre: { ...from }, radiusM: 0, startAngle: 0, turnSign: 1, lengthM: chord, launchDir: along, straight: true };
  if (!(chord > 1e-6) || !(entryDeg > 0)) return arc;
  const entry = entryDeg * Math.PI / 180;
  arc.straight = false;
  arc.radiusM = chord / (2 * Math.sin(entry));
  arc.lengthM = 2 * entry * arc.radiusM;
  arc.launchDir = rotate(along, side * entry);
  const toCentre = rotate(arc.launchDir, -side * Math.PI / 2);
  arc.centre = { x: from.x + toCentre.x * arc.radiusM, y: from.y + toCentre.y * arc.radiusM };
  arc.startAngle = Math.atan2(from.y - arc.centre.y, from.x - arc.centre.x);
  arc.turnSign = -side;
  return arc;
}
/** The point `distanceM` along the flight; past T the bolt flies straight along its arrival tangent. */
export function arcPoint(arc: AirArc, distanceM: number): Vec {
  if (arc.straight) return { x: arc.from.x + arc.launchDir.x * distanceM, y: arc.from.y + arc.launchDir.y * distanceM };
  const s = clamp(distanceM, 0, arc.lengthM), angle = arc.startAngle + arc.turnSign * s / arc.radiusM;
  const point = { x: arc.centre.x + arc.radiusM * Math.cos(angle), y: arc.centre.y + arc.radiusM * Math.sin(angle) };
  if (distanceM <= arc.lengthM) return point;
  const tangent = { x: -arc.turnSign * Math.sin(angle), y: arc.turnSign * Math.cos(angle) };
  return { x: point.x + tangent.x * (distanceM - arc.lengthM), y: point.y + tangent.y * (distanceM - arc.lengthM) };
}
/** This tick's end of a curved flight, plus the arc state to commit when the projectile moves on (kernel updateProjectiles). */
export function curvedStep(p: AirProjectile, travel: number): { end: Vec; arc?: ProjectileArc; velocity: Vec } {
  const arc = p.arc, speed = Math.hypot(p.velocity.x, p.velocity.y);
  if (!arc || !(arc.leftM > 0) || !(arc.radiusM > 0)) {
    const d = unit(p.velocity);
    return { end: { x: p.pos.x + d.x * travel, y: p.pos.y + d.y * travel }, velocity: { ...p.velocity }, ...(arc ? { arc: { ...arc } } : {}) };
  }
  const onArc = Math.min(travel, arc.leftM), angle = arc.angle + arc.sign * onArc / arc.radiusM;
  let end = { x: arc.centre.x + arc.radiusM * Math.cos(angle), y: arc.centre.y + arc.radiusM * Math.sin(angle) };
  const tangent = { x: -arc.sign * Math.sin(angle), y: arc.sign * Math.cos(angle) };
  if (travel > onArc) end = { x: end.x + tangent.x * (travel - onArc), y: end.y + tangent.y * (travel - onArc) };
  return { end, velocity: { x: tangent.x * speed, y: tangent.y * speed }, arc: { ...arc, angle, leftM: arc.leftM - onArc } };
}

// ---------------------------------------------------------------------------------------------------------------------
// Casting.

export const airCooldownUntil = (a: Actor, id: string): number => air(a)?.cooldowns[id] ?? 0;
/** A live beam this actor owns (shapes.ts startBeam). */
const ownBeams = (state: ArenaState, a: Actor) => (state.schoolEffects ?? []).filter(e => e.ownerId === a.id && e.kind === 'beam' && e.endTick >= state.tick);
/** A Cyclone channel or the rest of a Squall volley keeps the hands busy (VR AirChannelBusy); SchoolRules.busy gates startCast. */
export const airChannelBusy = (state: ArenaState, a: Actor): boolean => air(a)?.volley !== undefined || ownBeams(state, a).length > 0;
/** The pending cast roots its caster (Tempest Lance's notes say "rooted"); SchoolRules.rooted, read by moveActor. */
export const airCastRoots = (a: Actor): boolean => isAir(a) && a.pending?.kind === 'spell' && airRow(a.pending.spellId ?? '')?.roots === true;
/** Tier (slotSpell), cooldown, mana and Air Form's Momentum need: the cast and the AI ask the same question (VR AirCastLegal). */
export function airCastLegal(state: ArenaState, a: Actor, spell: SchoolSpell, readyTick = state.tick): boolean {
  const s = air(a), row = airRow(spell.id); if (!s || !row) return false;
  if (readyTick < (s.cooldowns[spell.id] ?? 0) || a.mana < spell.mana) return false;
  return !(row.needMomentum > 0) || s.value >= row.needMomentum;
}
const hitFamily = (spell: SchoolSpell): Family => spell.family === 'self' ? 'magic' : spell.family;
function makeHit(a: Actor, spell: SchoolSpell, row: AirRow, activationId: number, damage: number): AirHit {
  const paid = row.momentum.mode === 'hit' || row.momentum.mode === 'target' || row.momentum.mode === 'tick' ? row.momentum.amount : 0;
  return { ownerId: a.id, activationId, damage, family: hitFamily(spell), tier: spell.tier, source: { ...a.pos }, ...(row.bolt ? { bolt: true } : {}), ...(paid > 0 ? { momentumOnHit: paid } : {}) };
}
function spawnAir(state: ArenaState, a: Actor, row: AirRow, hit: AirHit, direction: Vec, rangeM: number, pierceLeft: number): AirProjectile {
  const p = spawnProjectile(state, hit, a.pos, direction, row.speedMps * paceOf(a), rangeM) as AirProjectile;
  if (pierceLeft > 0) p.pierceLeft = pierceLeft;
  return p;
}
/** Windup: one, the longer of cast_s and telegraph_s (every Fire row but Sunfall), at the actor's pace above its warning floor.
 * Agility (progression.ts) shortens it with the floor kept; a state that runs canonical ignores it. */
export const airWindupTicks = (a: Actor, spell: SchoolSpell, row: AirRow, state?: ArenaState): number => {
  const floor = warningFloor(hitFamily(spell), row.kind === 'zone'), windup = pacedWarning(a, Math.max(spell.castS, spell.telegraphS), floor);
  // A warning keeps its floor; a windup that is only cast time (no telegraph) is the caster's own and shortens freely.
  return ticks(spell.telegraphS > 0 ? agileWarningS(a, windup, floor, state) : agileCastS(a, windup, state));
};

function tryCast(state: ArenaState, a: Actor, input: InputFrame): boolean {
  const s = air(a);
  if (!s || activationBlocked(a) || a.pending || airChannelBusy(state, a)) return false;
  const spell = slotSpell(a, input.slot, state), row = spell && airRow(spell.id);
  if (!spell || !row || !airCastLegal(state, a, spell)) return false;
  beginCast(state, a, s, spell, row, input.aim, true);
  return true;
}
/** VR StartGrantedAirCast (CR-005): a named rival's signature skips the tier gate, the cooldown, the mana and any
 * Momentum need or spend once; the cooldown, windup and resolution are the row's own. */
function grantedCast(state: ArenaState, a: Actor, spellId: string, aim: Vec): boolean {
  const s = air(a);
  if (!s || activationBlocked(a) || a.pending || airChannelBusy(state, a)) return false;
  const base = schoolSpellById(spellId), row = base && base.school === 'air' ? airRow(base.id) : undefined;
  if (!base || !row) return false;
  beginCast(state, a, s, balancedSpell(base, state), row, aim, false);
  return true;
}
/** The cast start every Air row shares (VR BeginAirCast); `pay` false is the granted signature. */
function beginCast(state: ArenaState, a: Actor, s: SchoolState, spell: SchoolSpell, row: AirRow, inputAim: Vec, pay: boolean): void {
  if (pay) {
    if (state.lab) a.metrics.manaCast = (a.metrics.manaCast ?? 0) + spell.mana;
    a.mana -= spell.mana;
    // Air Form's "spends 40" is paid at the press, with the mana; under Eye of the Storm the lock restores it next tick.
    if (row.momentum.mode === 'spend') { const m = momentumRules(state); s.value = clamp(s.value - row.momentum.amount, m.min, m.max); }
  }
  s.cooldowns[spell.id] = state.tick + ticks(paced(a, spell.cooldownS));
  let aim = { ...inputAim };
  if (row.kind === 'zone') {
    // A placed circle lands at the aim point, no farther than the range (x1.3 at Momentum 80).
    const d = unit(sub(inputAim, a.pos), a.facing), reach = Math.min(distance(a.pos, inputAim), spell.rangeM * airSpellRangeMult(state, a));
    aim = { x: a.pos.x + d.x * reach, y: a.pos.y + d.y * reach };
  }
  a.pending = { kind: 'spell', startTick: state.tick, releaseTick: state.tick + airWindupTicks(a, spell, row, state), aim, activationId: state.nextId++, spellId: spell.id };
  a.metrics.casts++; emit(state, 'cast', a, spell.tier);
}

function release(state: ArenaState, a: Actor): void {
  const s = air(a), pending = a.pending;
  if (!s || !pending || pending.kind !== 'spell') return;
  a.pending = undefined;
  const base = pending.spellId ? schoolSpellById(pending.spellId) : undefined, row = base && airRow(base.id);
  if (!base || !row) return;
  const spell = rankedSpell(base, a, state);
  emit(state, 'release', a, spell.tier);
  Object.assign(state.events.at(-1)!, { activationId: pending.activationId, spellId: spell.id, at: { ...(row.kind === 'zone' ? pending.aim : a.pos) } });
  const damage = spell.damage * (pending.damageMult ?? 1), rangeMult = airSpellRangeMult(state, a), range = spell.rangeM * rangeMult;
  const direction = unit(sub(pending.aim, a.pos), a.facing), pierce = airSpellsPierce(state, a);
  switch (row.kind) {
    case 'projectile':
      spawnAir(state, a, row, makeHit(a, spell, row, pending.activationId, damage), direction, range, pierce);
      break;
    case 'twin': {
      // The Twin Tides fan: Count bolts spread evenly over the full spread, one activation (Shear diverges; CR-007).
      const hit = makeHit(a, spell, row, pending.activationId, damage);
      for (let i = 0; i < row.count; i++) spawnAir(state, a, row, hit, rotate(direction, (-row.spreadDeg / 2 + i * row.spreadDeg / (row.count - 1)) * Math.PI / 180), range, pierce);
      break;
    }
    case 'veer': {
      // The aim point is the arc's end, clamped to the range (the 14 m limits the chord); past it the bolt flies on straight.
      const chord = Math.min(distance(a.pos, pending.aim), range), to = { x: a.pos.x + direction.x * chord, y: a.pos.y + direction.y * chord };
      const arc = veerArc(a.pos, to, row.entryDeg, veerSide(pending.activationId));
      const p = spawnAir(state, a, row, makeHit(a, spell, row, pending.activationId, damage), arc.launchDir, arc.lengthM + Math.max(0, range - chord), pierce);
      if (!arc.straight) p.arc = { centre: arc.centre, radiusM: arc.radiusM, angle: arc.startAngle, sign: arc.turnSign, leftM: arc.lengthM };
      break;
    }
    case 'squall': {
      // The first orb leaves now with the cast's activation; the rest follow, each its own activation, from where the caster
      // stands then, toward the aim fixed at the press. Range and pierce are snapshotted here.
      spawnAir(state, a, row, makeHit(a, spell, row, pending.activationId, damage), direction, range, pierce);
      const intervalTicks = Math.max(1, ticks(row.intervalS));
      if (row.count > 1) s.volley = { spellId: spell.id, startTick: state.tick, aim: { ...pending.aim }, left: row.count - 1, intervalTicks, nextTick: state.tick + intervalTicks, damage, rangeMult, pierceLeft: pierce };
      break;
    }
    case 'zone':
      // Lands this tick: VR resolves the circle at release, so it is already committed. shapes.ts steps it after the actor
      // loop (before projectiles); survivesOwner keeps a stagger or defeat of the caster later in this tick from cancelling it.
      queueDetonation(state, a, { ...makeHit(a, spell, row, pending.activationId, damage), source: { ...pending.aim }, delivery: 'area' }, pending.aim, row.radiusM, 0, { spellId: spell.id, survivesOwner: true });
      break;
    case 'line':
      // Tempest Lance: one 16 m line from the caster along the aim fixed at the press; every body on it (width: the body).
      // shapes.ts `piercing` means "skips a front shield" (Brand Lance); an unblockable already does, so it is not asked for.
      resolveLine(state, a, { ...makeHit(a, spell, row, pending.activationId, damage), delivery: 'area' }, { ...a.pos },
        { x: a.pos.x + direction.x * range, y: a.pos.y + direction.y * range }, 0);
      break;
    case 'beam':
      // Cyclone: the Brand Wrath channel along the live facing, each tick its own activation, EVERY tick perfectable.
      startBeam(state, a, makeHit(a, spell, row, pending.activationId, damage), range, Math.max(1, ticks(row.tickS)), ticks(row.durationS), { perfectFirstTickOnly: false, spellId: spell.id });
      break;
    case 'dash':
      // Slipstream: Cinder Step's dash without the trail, along the aim, not lengthened at Momentum 80.
      dash(state, a, direction, row.dashM);
      break;
    case 'form':
      s.formUntil = state.tick + ticks(row.durationS);
      break;
    case 'self':
      break;
  }
  if (row.momentum.mode === 'instant') gainMomentum(state, a, row.momentum.amount);
  else if (row.momentum.mode === 'lock') {
    // Eye of the Storm: set and held for the lock (gains discarded, no decay); its drain multiplier lasts as long.
    const m = momentumRules(state);
    s.value = clamp(row.momentum.lockValue, m.min, m.max); s.lockValue = s.value;
    s.lockedUntil = state.tick + ticks(row.momentum.lockS); s.lockDrainMult = row.drainMult;
  }
}

/** VR CancelAirChannel, from the kernel's interrupt() (SchoolRules.interrupted): the unthrown orbs and this actor's beam end.
 * True when something was cancelled. */
export function cancelAirChannel(state: ArenaState, a: Actor): boolean {
  const s = air(a); if (!s) return false;
  const volley = s.volley !== undefined;
  delete s.volley;
  return cancelOwnedBeams(state, a) || volley;
}
function stepVolley(state: ArenaState, a: Actor): void {
  const s = air(a)!, v = s.volley; if (!v) return;
  const base = schoolSpellById(v.spellId), row = airRow(v.spellId);
  if (base && row && state.tick >= v.nextTick && v.left > 0) {
    const spell = balancedSpell(base, state);
    spawnAir(state, a, row, makeHit(a, spell, row, state.nextId++, v.damage), unit(sub(v.aim, a.pos), a.facing), spell.rangeM * v.rangeMult, v.pierceLeft);
    v.left--; v.nextTick += v.intervalTicks;
  }
  if (!base || !row || v.left <= 0) delete s.volley;
}

// ---------------------------------------------------------------------------------------------------------------------
// Hit hooks.

/** Air Form: one draw per hit that reaches a formed actor (after immunity, before the ward), keyed as VR; unblockables never draw. */
function evades(state: ArenaState, target: Actor, hit: Hit): boolean {
  const s = air(target); if (!s || state.tick >= s.formUntil || hit.family === 'unblockable') return false;
  const row = airSheet.find(r => r.kind === 'form')!;
  const chance = hit.family === 'physical' ? row.evadePhysical : row.evadeMagic;
  return random(state, `air ${target.id} evade ${hit.activationId}`) < chance;
}
function onHit(state: ArenaState, target: Actor, owner: Actor | undefined, hit: Hit, result: { damage: number; perfect: boolean; reduction: number }, role: 'target' | 'owner'): void {
  // The owner's Momentum: every hit that lands or is warded pays its row's amount (VR AirOnHitResolved).
  if (role === 'owner') { if (owner && hit.momentumOnHit && owner.id === hit.ownerId) gainMomentum(state, owner, hit.momentumOnHit); return; }
  // A connecting staff strike interrupts an Air cast (combat.json staffStrike.interruptsCasts, which the PC kernel does not
  // read; AIR.md Tempest Lance). interrupt() reaches cancelAirChannel through SchoolRules.interrupted.
  if (isAir(target) && combat.staffStrike.interruptsCasts && hit.delivery === 'melee' && owner && !owner.enemy && result.damage > 0
    && !target.tags.includes('DEFEATED') && (target.pending || airChannelBusy(state, target))) interrupt(state, target);
}
/** Perfect absorb by an Air actor: the school's deflect, never the Water mirror (true even when nothing is deflected). */
function deflects(state: ArenaState, target: Actor, p: Projectile): boolean {
  if (!isAir(target)) return false;
  if (p.reflected || p.tier > target.tier) return true;
  const owner = state.actors.find(o => o.id === p.ownerId), origin = owner?.pos ?? p.source;
  const hit: Hit = { ownerId: target.id, activationId: state.nextId++, damage: p.damage, family: p.family, tier: p.tier, source: { ...target.pos }, ...(p.bolt ? { bolt: true } : {}) };
  const deflected = spawnProjectile(state, hit, target.pos, target.facing, Math.hypot(p.velocity.x, p.velocity.y), Math.max(p.remainingM, distance(target.pos, origin) + target.radius));
  deflected.reflected = true;
  return true;
}

/** Ward drain: x1.2 always, times the Eye of the Storm x1.5 while its lock lasts (1.8). */
function drainMult(state: ArenaState, a: Actor): number {
  const s = air(a); if (!s) return 1;
  return momentumRules(state).drainMult * (state.tick < s.lockedUntil ? s.lockDrainMult ?? 1 : 1);
}

export const airRules: SchoolRules = {
  tick: (state, a) => {
    if (!air(a)) return;
    // An encased or staggered actor skips moveActor (and afterMove) this tick: zero displacement, so "still".
    if (state.tick < a.water.encasedUntil || state.tick < (a.staggerUntil ?? 0)) updateMomentum(state, a, 0);
  },
  tryCast,
  grantedCast,
  release,
  drainMult,
  staminaRegenMult: () => 1,
  rollStaminaMult: (state, a) => airRollStaminaMult(state, a),
  evades,
  onHit,
  deflects,
  afterMove: (state, a) => {
    if (!air(a)) return;
    updateMomentum(state, a, distance(a.pos, a.previousPos) / DT);
    stepVolley(state, a);
  },
  interrupted: (state, a) => cancelAirChannel(state, a),
  busy: (state, a) => airChannelBusy(state, a),
  rooted: (_state, a) => airCastRoots(a),
  reset: a => {
    const s = air(a); if (!s) return;
    s.value = 0; s.lockedUntil = 0; s.formUntil = 0; s.cooldowns = {}; s.lastGainTick = 0; s.gained = false;
    delete s.volley; delete s.lockValue; delete s.lockDrainMult;
  },
};

/** The ward-free segment the AI and the presentation read for a pending line or beam (exported for mage-ai-air.ts). */
export function airSegmentThreat(from: Vec, direction: Vec, lengthM: number, centre: Vec, radius: number): boolean {
  return segmentHit(from, { x: from.x + direction.x * lengthM, y: from.y + direction.y * lengthM }, centre, radius) !== undefined;
}
