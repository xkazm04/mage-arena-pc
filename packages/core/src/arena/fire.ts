// Fire: Heat and the ten Fire rows, to VR CR-002 to the letter (mage-arena-vr docs/change-requests/CR-002-fire-school.md;
// semantics, tick order and draw order from mage-arena-vr Kernel/Fire.cpp and KernelDataHeat.cpp). W8 lane F owns this file.
// Numbers come from the canonical rows through schools.ts (overlay unless the state runs canonical); prose cells (shape,
// damage tick, heat gain, notes) are read strictly here at load and a cell this file cannot read exactly throws.
// Load order: this module must be reached through schools.ts (kernel.ts imports it), never as the first import, because
// schools.ts reads `fireRules` at its own load. Nothing below touches kernel.ts or schools.ts exports at load.
import { fireRows, schoolIdentity } from './data.generated.ts';
import { DT, emit, spawnProjectile, ticks } from './kernel.ts';
import { balancedSpell, identityNumber, schoolSpellById, slotSpell, type SchoolRules, type SchoolSpell } from './schools.ts';
import { dash, ownerBeam, queueDetonation, resolveLine, shapeHooks, startBeam, contact, type SchoolHit } from './shapes.ts';
import { paceOf, paced, pacedWarning, warningFloor } from './tuning.ts';
import { constrainToArena } from './geometry.ts';
import { clamp, distance, inArc, sub, unit, type Vec } from './math.ts';
import type { Actor, ArenaState, Family, Hit, SchoolState } from './types.ts';

export type FireKind = 'projectile' | 'cone' | 'dash' | 'self' | 'line' | 'ring' | 'zone' | 'meteor' | 'beam';
export type HeatMode = 'hit' | 'target' | 'tick' | 'instant' | 'lock';
/** The prose of one Fire row, read as VR's ParseFireSpell reads it. Numeric columns stay in schools.ts. */
export interface FireShape {
  id: string; kind: FireKind; speedMps: number; arcDeg: number; dashM: number; durationS: number; radiusM: number; knockbackM: number; tickS: number;
  heatMode: HeatMode; heat: number; lockS: number;
  /** Notes: "rooted", "shadow grows" (Sunfall's cast and shadow are sequential), "only catch the first tick", "Pierces"/shape "piercing", "doubled". */
  roots: boolean; sequential: boolean; perfectFirstTickOnly: boolean; pierceShields: boolean; bolt: boolean; drainMult: number;
}
function number(text: string, pattern: RegExp, id: string, cell: string): number {
  const m = pattern.exec(text);
  if (!m) throw Error(`spells-fire.csv ${id}: ${cell} cell "${text}" does not read as ${pattern}`);
  return parseFloat(m[1]!);
}
/** Read one CSV row's prose strictly (exported for the strictness tests). */
export function readFireShape(row: { [K in keyof (typeof fireRows)[number]]: string }): FireShape {
  const id = row.id, shape = row.shape, heat = row.heat_gain, notes = row.notes, range = +row.range_m;
  const out: FireShape = { id, kind: 'self', speedMps: 0, arcDeg: 0, dashM: 0, durationS: 0, radiusM: 0, knockbackM: 0, tickS: 0, heatMode: 'hit', heat: 0, lockS: 0,
    roots: false, sequential: false, perfectFirstTickOnly: false, pierceShields: false, bolt: id === 'fire_bolt', drainMult: 1 };
  const reach = (value: number): void => { if (Math.abs(value - range) > 1e-9) throw Error(`spells-fire.csv ${id}: shape reach ${value} disagrees with range_m ${range}`); };
  if (shape.startsWith('projectile')) { out.kind = 'projectile'; out.speedMps = number(shape, /([\d.]+) m\/s/, id, 'shape'); }
  else if (shape.startsWith('cone')) { out.kind = 'cone'; out.arcDeg = number(shape, /([\d.]+) deg/, id, 'shape'); reach(number(shape, /x ([\d.]+) m/, id, 'shape')); }
  else if (shape.startsWith('dash')) { out.kind = 'dash'; out.dashM = number(shape, /dash ([\d.]+) m/, id, 'shape'); out.durationS = number(shape, /trail ([\d.]+) s/, id, 'shape'); reach(out.dashM); }
  else if (shape === 'self') out.kind = 'self';
  else if (shape.startsWith('line')) { out.kind = 'line'; reach(number(shape, /line ([\d.]+) m/, id, 'shape')); }
  else if (shape.startsWith('ring')) { out.kind = 'ring'; out.radiusM = number(shape, /r ([\d.]+) m/, id, 'shape'); out.knockbackM = number(shape, /knockback ([\d.]+) m/, id, 'shape'); out.arcDeg = 360; reach(out.radiusM); }
  else if (shape.startsWith('ground circle')) { out.kind = 'zone'; out.radiusM = number(shape, /r ([\d.]+) m/, id, 'shape'); }
  else if (shape.startsWith('meteor circle')) { out.kind = 'meteor'; out.radiusM = number(shape, /r ([\d.]+) m/, id, 'shape'); }
  else if (shape.startsWith('channelled beam')) { out.kind = 'beam'; reach(number(shape, /beam ([\d.]+) m/, id, 'shape')); out.durationS = number(shape, /for ([\d.]+) s/, id, 'shape'); }
  else throw Error(`spells-fire.csv ${id}: shape not understood: ${shape}`);
  if (row.damage.includes('tick')) out.tickS = number(row.damage, /per ([\d.]+) s tick/, id, 'damage');
  if ((out.kind === 'dash' || out.kind === 'beam') && !(out.tickS > 0)) throw Error(`spells-fire.csv ${id}: no tick interval`);
  if (heat.includes('locked')) { out.heatMode = 'lock'; out.heat = number(heat, /locked at ([\d.]+)/, id, 'heat_gain'); out.lockS = number(heat, /for ([\d.]+) s/, id, 'heat_gain'); }
  else if (heat.includes('instant')) { out.heatMode = 'instant'; out.heat = number(heat, /([\d.]+) instant/, id, 'heat_gain'); }
  else if (heat.includes('per tick')) { out.heatMode = 'tick'; out.heat = number(heat, /([\d.]+) per tick/, id, 'heat_gain'); }
  else if (heat.includes('per target')) { out.heatMode = 'target'; out.heat = number(heat, /([\d.]+) per target/, id, 'heat_gain'); }
  else if (heat.includes('per hit')) { out.heatMode = 'hit'; out.heat = number(heat, /([\d.]+) per hit/, id, 'heat_gain'); }
  else throw Error(`spells-fire.csv ${id}: heat gain not understood: ${heat}`);
  const lower = notes.toLowerCase();
  out.roots = lower.includes('rooted');
  out.sequential = lower.includes('shadow grows');
  out.perfectFirstTickOnly = lower.includes('only catch the first tick');
  out.pierceShields = shape.toLowerCase().includes('piercing') || notes.includes('Pierces');
  // The notes say the drain "is doubled": that word is the number 2, stacked on the Blazing threshold (FIRE.md Owner line).
  if (lower.includes('doubled')) out.drainMult = 2;
  return out;
}
/** The ten rows, slot order = CSV order (CR-002 slots 0-9). */
export const fireShapes: FireShape[] = fireRows.map(readFireShape);
export const fireShape = (id: string): FireShape | undefined => fireShapes.find(s => s.id === id);
const lockRows = fireShapes.filter(s => s.heatMode === 'lock');
if (lockRows.length !== 1) throw Error('spells-fire.csv: expected exactly one Heat lock row (Furnace Heart)');
const lockRow = lockRows[0]!;

// schools-combat.json fire (CR-002 "Heat"), checked strictly at load; values are read through identityNumber at use.
const identity = schoolIdentity.fire;
if (identity.resource !== 'heat') throw Error('schools-combat.json fire.resource is not heat');
if (!/none/i.test(identity.perfectAbsorbExtra)) throw Error('schools-combat.json fire.perfectAbsorbExtra is not the "none" reading this kernel implements');
const nearKeys = Object.keys(identity.gain).filter(k => /^perSecondEnemyWithin[\d.]+m$/.test(k));
const knownGain = ['perBoltHit', 'perFlickTarget', 'perHitTakenUnabsorbed'];
if (nearKeys.length !== 1 || Object.keys(identity.gain).some(k => !knownGain.includes(k) && k !== nearKeys[0]) || knownGain.some(k => !(k in identity.gain)))
  throw Error('schools-combat.json fire.gain is not the four rules CR-002 names');
const nearKey = nearKeys[0]!;
/** The metres are the number in the key ("perSecondEnemyWithin3m" is 3 m), as VR parses them. */
export const heatNearM = parseFloat(/([\d.]+)m$/.exec(nearKey)![1]!);
if (Object.keys(identity.decay).sort().join() !== 'afterNoGainSeconds,perSecond') throw Error('schools-combat.json fire.decay is not perSecond + afterNoGainSeconds');
const thresholdFields = ['at', 'name', 'spellDamageMult', 'absorbDrainMult', 'staminaRegenMult'];
if (!identity.thresholds.length || identity.thresholds.some(t => Object.keys(t).some(k => !thresholdFields.includes(k)) || typeof t.at !== 'number'))
  throw Error('schools-combat.json fire.thresholds has an unknown field or no at');
// CR-002: "perBoltHit 2 is the same payment as Ember Dart's 2 per hit" - one rule, checked equal, not a second grant.
if (identity.gain.perBoltHit !== fireShape('fire_bolt')!.heat || identity.gain.perFlickTarget !== fireShape('fire_flick')!.heat)
  throw Error('schools-combat.json perBoltHit/perFlickTarget disagree with the Ember Dart / Flick Flame heat cells');

const num = (path: string, state?: ArenaState): number => identityNumber('fire', path, state);
type ThresholdKey = 'spellDamageMult' | 'absorbDrainMult' | 'staminaRegenMult';
/** Thresholds apply at heat >= at; a higher band replaces each effect it names (it does not multiply the lower band). */
function band(state: ArenaState, a: Actor, key: ThresholdKey): number {
  const s = fireState(a); if (!s) return 1;
  const rows = identity.thresholds.map((t, i) => ({ i, at: num(`thresholds.${i}.at`, state), has: key in t })).sort((x, y) => x.at - y.at || x.i - y.i);
  let value = 1;
  for (const row of rows) if (s.value >= row.at && row.has) value = num(`thresholds.${row.i}.${key}`, state);
  return value;
}
export const fireState = (a: Actor | undefined): SchoolState | undefined => a?.schoolState?.school === 'fire' ? a.schoolState : undefined;
/** Spell damage multiplier from Heat now (snapshotted at release for projectiles and placed areas; live for trail and beam ticks). */
export const heatDamageMult = (state: ArenaState, a: Actor): number => band(state, a, 'spellDamageMult');
export const heatValue = (a: Actor): number => fireState(a)?.value ?? 0;
const heatRange = (state: ArenaState): [number, number] => [num('range.0', state), num('range.1', state)];
/** The grant every Heat source uses. A non-fire actor, a non-positive amount, or a running lock pays nothing (VR GainHeat). */
export function gainHeat(state: ArenaState, a: Actor, amount: number): void {
  const s = fireState(a);
  if (!s || !(amount > 0) || state.tick < s.lockedUntil) return;
  const [min, max] = heatRange(state);
  s.value = clamp(s.value + amount, min, max); s.lastGainTick = state.tick; s.gained = true;
}
/** Release tick of this actor's first Sunfall this bout (VR bSunfallLoosed). Kept in cooldowns until SchoolState carries it (request R4). */
export const sunfallLoosedKey = 'fire_sunfall.loosed';
export const sunfallLoosed = (a: Actor): boolean => fireState(a)?.cooldowns[sunfallLoosedKey] !== undefined;

const hostile = (a: Actor, t: Actor): boolean => !t.tags.includes('DEFEATED') && t.team !== a.team && t.id !== a.id;
const placed = (shape: FireShape): boolean => shape.kind === 'zone' || shape.kind === 'meteor';
/** The point a placed spell lands on: along the aim, no farther than its range (VR PlacedPoint). */
function placedPoint(a: Actor, aim: Vec, rangeM: number): Vec {
  const d = unit(sub(aim, a.pos), a.facing), reach = Math.min(distance(a.pos, aim), rangeM);
  return { x: a.pos.x + d.x * reach, y: a.pos.y + d.y * reach };
}
const hitFamily = (spell: SchoolSpell): Family => spell.family === 'self' ? 'magic' : spell.family;
/** The warning a pace may not shorten below its reaction-band floor (PC pace law; 1x at parity). */
const warning = (a: Actor, spell: SchoolSpell, shape: FireShape): number => pacedWarning(a, spell.telegraphS, warningFloor(hitFamily(spell), placed(shape)));
/** Ticks from press to release: max(cast, telegraph), except Sunfall whose cast and shadow are sequential (cast only). */
export function fireWindupTicks(a: Actor, spell: SchoolSpell): number {
  const shape = fireShape(spell.id)!;
  return ticks(shape.sequential ? paced(a, spell.castS) : Math.max(paced(a, spell.castS), warning(a, spell, shape)));
}
const heatPaid = (shape: FireShape): number => shape.heatMode === 'hit' || shape.heatMode === 'target' || shape.heatMode === 'tick' ? shape.heat : 0;
// Both the target's and the owner's school are asked about one contact; when both are Fire the same call arrives twice.
const answered = new WeakMap<Hit, true>();

export const fireRules: SchoolRules = {
  // CR-002 resource tick: start of the actor step, before its release and before projectile hits.
  tick(state, a) {
    const s = fireState(a); if (!s) return;
    if (state.tick < s.lockedUntil) { const [min, max] = heatRange(state); s.value = clamp(lockRow.heat, min, max); return; }
    const near = state.actors.filter(o => o.id !== a.id && o.team !== a.team && !o.tags.includes('DEFEATED') && distance(a.pos, o.pos) <= heatNearM).length;
    if (near > 0) gainHeat(state, a, num(`gain.${nearKey}`, state) * near * DT);
    if (s.value > 0 && s.gained && state.tick - s.lastGainTick >= ticks(num('decay.afterNoGainSeconds', state))) {
      const [min, max] = heatRange(state);
      s.value = clamp(s.value - num('decay.perSecond', state) * DT, min, max);
    }
  },
  tryCast(state, a, input) {
    const s = fireState(a); if (!s || a.pending || ownerBeam(state, a)) return false;
    const spell = slotSpell(a, input.slot, state); if (!spell) return false;
    const shape = fireShape(spell.id)!;
    if (state.tick < (s.cooldowns[spell.id] ?? 0) || a.mana < spell.mana) return false;
    a.mana -= spell.mana;
    if (state.lab) a.metrics.manaCast = (a.metrics.manaCast ?? 0) + spell.mana;
    s.cooldowns[spell.id] = state.tick + ticks(paced(a, spell.cooldownS));
    const releaseTick = state.tick + fireWindupTicks(a, spell);
    a.pending = { kind: 'spell', startTick: state.tick, releaseTick, aim: placed(shape) ? placedPoint(a, input.aim, spell.rangeM) : { ...input.aim }, activationId: state.nextId++, spellId: spell.id };
    // VR roots through the release tick's move (FireCastRoots while pending). Interim for a kernel root hook (request R5).
    if (shape.roots) a.water.rootUntil = Math.max(a.water.rootUntil, releaseTick + 1);
    a.metrics.casts++; emit(state, 'cast', a, spell.tier);
    return true;
  },
  release(state, a) {
    const p = a.pending; if (!p || p.kind !== 'spell') return;
    a.pending = undefined;
    const row = p.spellId ? schoolSpellById(p.spellId) : undefined, shape = row && fireShape(row.id);
    if (!row || !shape) return;
    const spell = balancedSpell(row, state);
    emit(state, 'release', a, spell.tier);
    Object.assign(state.events.at(-1)!, { activationId: p.activationId, spellId: spell.id, at: { ...(placed(shape) ? p.aim : a.pos) } });
    const baseDamage = spell.damage * (p.damageMult ?? 1), damage = baseDamage * heatDamageMult(state, a), heat = heatPaid(shape);
    const direction = unit(sub(p.aim, a.pos), a.facing);
    const hit: SchoolHit = { ownerId: a.id, activationId: p.activationId, damage, family: hitFamily(spell), tier: spell.tier, source: { ...a.pos },
      ...(shape.bolt ? { bolt: true } : {}), ...(heat > 0 ? { heat } : {}), ...(shape.pierceShields ? { pierceShields: true } : {}) };
    switch (shape.kind) {
      case 'projectile': spawnProjectile(state, hit, a.pos, direction, shape.speedMps * paceOf(a), spell.rangeM); break;
      case 'cone': case 'ring': {
        const reach = shape.kind === 'ring' && shape.radiusM > 0 ? shape.radiusM : spell.rangeM;
        for (const target of state.actors) {
          if (!hostile(a, target) || distance(a.pos, target.pos) > reach || !inArc(direction, sub(target.pos, a.pos), shape.arcDeg)) continue;
          const result = contact(state, target, { ...hit, delivery: 'area' });
          // Knockback when damage got through and the absorb was not perfect.
          if (shape.knockbackM > 0 && !target.tags.includes('DEFEATED') && !result.perfect && result.damage > 0) {
            const away = unit(sub(target.pos, a.pos));
            target.pos = constrainToArena({ x: target.pos.x + away.x * shape.knockbackM, y: target.pos.y + away.y * shape.knockbackM }, target.radius);
          }
        }
        break;
      }
      case 'line': resolveLine(state, a, hit, a.pos, { x: a.pos.x + direction.x * spell.rangeM, y: a.pos.y + direction.y * spell.rangeM }, 0, { piercing: shape.pierceShields }); break;
      case 'zone':
        // Pyre: its windup was the fill telegraph; one detonation now, nothing left behind (VR resolves it at release).
        for (const target of state.actors) if (hostile(a, target) && distance(p.aim, target.pos) <= shape.radiusM + target.radius) contact(state, target, { ...hit, source: { ...p.aim }, delivery: 'area' });
        break;
      case 'meteor':
        // Sunfall: the shadow is a committed area that survives its owner and any later interrupt.
        queueDetonation(state, a, hit, p.aim, shape.radiusM, ticks(warning(a, spell, shape)), { survivesOwner: true, spellId: spell.id });
        if (!sunfallLoosed(a)) fireState(a)!.cooldowns[sunfallLoosedKey] = state.tick;
        break;
      case 'dash':
        dash(state, a, direction, shape.dashM, { hit: { ...hit, damage: baseDamage }, everyTicks: ticks(shape.tickS), durationTicks: ticks(shape.durationS), spellId: spell.id });
        break;
      case 'beam':
        startBeam(state, a, { ...hit, damage: baseDamage }, spell.rangeM, ticks(shape.tickS), ticks(shape.durationS), { perfectFirstTickOnly: shape.perfectFirstTickOnly, spellId: spell.id });
        break;
      case 'self': {
        const s = fireState(a)!;
        if (shape.heatMode === 'instant') gainHeat(state, a, shape.heat);
        else if (shape.heatMode === 'lock') {
          const [min, max] = heatRange(state);
          s.value = clamp(shape.heat, min, max); s.lockedUntil = state.tick + ticks(shape.lockS); s.lastGainTick = state.tick; s.gained = true;
        }
        break;
      }
    }
  },
  drainMult(state, a) {
    const s = fireState(a); if (!s) return 1;
    // Furnace Heart's doubled drain stacks on Blazing's x1.5 while the lock runs (x3).
    return band(state, a, 'absorbDrainMult') * (state.tick < s.lockedUntil ? lockRow.drainMult : 1);
  },
  staminaRegenMult: (state, a) => band(state, a, 'staminaRegenMult'),
  rollStaminaMult: () => 1,
  evades: () => false,
  onHit(state, target, owner, hit, result) {
    if (answered.has(hit)) return;
    answered.set(hit, true);
    // The caster receives the spell's own heat when the blow connects, a perfect absorb included.
    const heat = (hit as SchoolHit).heat;
    if (owner && heat) gainHeat(state, owner, heat);
    // perHitTakenUnabsorbed: incoming above 0 and an absorb reduction of 0 (a chip, a perfect or a negated blow pays nothing).
    if (fireState(target) && result.reduction <= 0 && result.damage > 0) gainHeat(state, target, num('gain.perHitTakenUnabsorbed', state));
  },
  // A perfect absorb grants Fire nothing beyond the shared refund; the attached water composition still reflects as in VR.
  deflects: () => false,
  afterMove: () => {},
  reset(a) {
    const s = fireState(a); if (!s) return;
    s.value = 0; s.lastGainTick = 0; s.lockedUntil = 0; s.gained = false; s.cooldowns = {}; s.formUntil = 0;
  },
};
shapeHooks.liveDamageMult.fire = heatDamageMult;
