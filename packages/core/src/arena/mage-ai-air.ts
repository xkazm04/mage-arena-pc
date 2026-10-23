// The Gale mage's choices (mage-arena-vr docs/schools/AIR.md, ChooseAirSpell; VR Kernel/MageAI.cpp): the competence curve
// (level 1 a random draw, level 2+ a sort with Veering Bolt and Squall first, then damage x count) over the useful rows,
// with three priorities on top that draw no spell random: Tempest Lance whenever legal and the target is not mid-roll (no
// banking), Air Form against an aimed blockable threat when Momentum allows, Slipstream under Air Form's 40. W8 lane A.
import { combat, random, runtime, ticks } from './kernel.ts';
import { arenaContains } from './geometry.ts';
import { distance, rotate, segmentHit, sub, unit, type Vec } from './math.ts';
import { hasLineOfSight } from './water.ts';
import { airCastLegal, airRow, airSheet, airSpellRangeMult, momentumOf, veerArc, veerSide, type AirKind, type AirRow, type AirSchoolState } from './air.ts';
import { balancedSpell, schoolSpellById, slotSpell, type SchoolSpell } from './schools.ts';
import { archetypeChoose, rivalBuildOf } from './archetypes.ts';
import type { SchoolBrain } from './mage-ai-schools.ts';
import type { ShapeClass, Threat } from './mage-ai.ts';
import type { Actor, ArenaState } from './types.ts';

const boltRow = airRow('air_bolt')!;
const formRow = airSheet.find(r => r.kind === 'form')!;
const reaches = (row: AirRow): boolean => row.kind !== 'dash' && row.kind !== 'self' && row.kind !== 'form';
const useful = (spell: SchoolSpell, row: AirRow): boolean => spell.damage > 0 || row.kind === 'zone';
/** The shape class an Air blow presents to its defender (mage-ai.ts ShapeClass). */
export function airShapeClass(kind: AirKind): ShapeClass {
  return kind === 'beam' ? 'beam' : kind === 'line' ? 'line' : kind === 'zone' ? 'area' : kind === 'dash' || kind === 'self' || kind === 'form' ? 'close' : 'projectile';
}

/** VR AirOfferable: tier (slotSpell), the cooldown by `readyTick` (the press lands next step), mana, Momentum need, range x the 80 band. */
export function airOfferable(state: ArenaState, a: Actor, spell: SchoolSpell, row: AirRow, distanceM: number, readyTick = state.tick + 1): boolean {
  if (!airCastLegal(state, a, spell, readyTick)) return false;
  return !reaches(row) || !(spell.rangeM > 0) || distanceM <= spell.rangeM * airSpellRangeMult(state, a);
}
/** Slots this actor can press: a catalogue rival has slot n = row n (CR-002 slots 0-9), a loadout has the bolt plus four. */
function offered(state: ArenaState, a: Actor): { slot: number; spell: SchoolSpell; row: AirRow }[] {
  const count = a.schoolState?.catalogue ? airSheet.length : 5, out: { slot: number; spell: SchoolSpell; row: AirRow }[] = [];
  for (let slot = 0; slot < count; slot++) {
    const spell = slotSpell(a, slot, state), row = spell && airRow(spell.id);
    if (spell && row) out.push({ slot, spell, row });
  }
  return out;
}
/** Slipstream's dash end, along the current move (sideways to the target when standing), kept inside the arena. */
export function slipstreamAim(a: Actor, target: Actor, move: Vec, dashM: number): Vec {
  const along = Math.hypot(move.x, move.y) > 0 ? unit(move) : rotate(unit(sub(target.pos, a.pos)), Math.PI / 2);
  const toCentre = unit(sub(runtime.geometry.arenaCentre, a.pos), along);
  const end = (d: Vec): Vec => ({ x: a.pos.x + d.x * dashM, y: a.pos.y + d.y * dashM });
  const pick = [along, { x: -along.x, y: -along.y }, toCentre].find(d => arenaContains(end(d), a.radius)) ?? toCentre;
  return end(pick);
}

export const airBrain: SchoolBrain = {
  boltSpeedMps: () => boltRow.speedMps,
  choose(state, a, { target, distanceM, seen, profile, readyTick }) {
    const s = a.schoolState as AirSchoolState | undefined; if (!s) return undefined;
    const slots = offered(state, a), can = (c: { spell: SchoolSpell; row: AirRow }): boolean => airOfferable(state, a, c.spell, c.row, distanceM, readyTick);
    // A build rival plays its archetype plan (archetypes.ts) in place of the priorities and the competence pick.
    if (rivalBuildOf(a)) {
      const pick = archetypeChoose(state, a, target, distanceM, seen, slots.map(c => ({ slot: c.slot, spell: c.spell, can: can(c) })));
      if (pick?.aim && a.mageAI) a.mageAI.input.aim = pick.aim;
      return pick && { slot: pick.slot, cast: true };
    }
    // 1. Tempest Lance from tier IV whenever legal and the target is not blinking.
    const tempest = slots.find(c => c.row.kind === 'line' && c.spell.family === 'unblockable' && a.tier >= 4 && state.tick >= target.rollUntil && can(c));
    if (tempest) return { slot: tempest.slot, cast: true };
    // 2. Air Form against an aimed, blockable threat, the form down and Momentum enough.
    const incoming = seen.some(t => t.aimedAtUs && t.family !== 'unblockable');
    const form = slots.find(c => c.row.kind === 'form' && incoming && state.tick >= s.formUntil && can(c));
    if (form) return { slot: form.slot, cast: true };
    // 3. Slipstream while Momentum is under Air Form's need, dashed along the move and never at the target.
    const slip = slots.find(c => c.row.kind === 'dash' && momentumOf(a) < formRow.needMomentum && can(c));
    if (slip) {
      // The seam returns a slot only; the dash direction rides the brain's input, which mage-ai.ts copies out (report request).
      if (a.mageAI) a.mageAI.input.aim = slipstreamAim(a, target, a.mageAI.input.move, slip.row.dashM);
      return { slot: slip.slot, cast: true };
    }
    // The competence curve over the rest (Slipstream and Air Form only by the priorities above).
    const available = slots.filter(c => c.row.kind !== 'dash' && c.row.kind !== 'form' && can(c));
    if (!available.length) return undefined;
    const usefulOnes = available.filter(c => useful(c.spell, c.row)), choices = usefulOnes.length ? usefulOnes : available;
    if (profile.level < 2) return { slot: choices[Math.floor(random(state, `mage ${a.id} spell`) * choices.length)]!.slot, cast: true };
    const prefer = (row: AirRow): boolean => row.kind === 'veer' || row.kind === 'squall';
    const ordered = [...choices].sort((x, y) => Number(prefer(y.row)) - Number(prefer(x.row)) || y.spell.damage * y.row.count - x.spell.damage * x.row.count || x.slot - y.slot);
    return { slot: ordered[0]!.slot, cast: true };
  },
  threats(state, owner, a) {
    const out: Threat[] = [];
    if (!hasLineOfSight(state, a.pos, owner.pos)) return out;
    const projectileR = runtime.geometry.projectileRadiusM, p = owner.pending;
    if (p?.kind === 'staff') out.push({ id: p.activationId, family: 'physical', origin: { ...owner.pos }, impactTick: p.releaseTick, aimedAtUs: true, damage: combat.staffStrike.damage, shape: 'close' });
    const base = p?.kind === 'spell' && p.spellId ? schoolSpellById(p.spellId) : undefined, row = base && airRow(base.id);
    if (p && base && row && reaches(row)) {
      const spell = balancedSpell(base, state), range = spell.rangeM * airSpellRangeMult(state, owner), dir = unit(sub(p.aim, owner.pos), owner.facing);
      const family = spell.family === 'self' ? 'magic' : spell.family, along = (d: Vec, r: number, len = range): boolean => segmentHit(owner.pos, { x: owner.pos.x + d.x * len, y: owner.pos.y + d.y * len }, a.pos, r) !== undefined;
      let aimedAtUs: boolean, impactTick = p.releaseTick, origin = { ...owner.pos };
      if (row.kind === 'zone') { origin = { ...p.aim }; aimedAtUs = distance(p.aim, a.pos) <= row.radiusM + a.radius; }
      else if (row.kind === 'line') aimedAtUs = along(dir, a.radius);
      else if (row.kind === 'beam') { aimedAtUs = along(dir, a.radius); impactTick += Math.max(1, ticks(row.tickS)); }
      else if (row.kind === 'veer') {
        // The arc ends on the aim point clamped to the range; the body there is the one it is meant for.
        const chord = Math.min(distance(owner.pos, p.aim), range), arc = veerArc(owner.pos, { x: owner.pos.x + dir.x * chord, y: owner.pos.y + dir.y * chord }, row.entryDeg, veerSide(p.activationId));
        aimedAtUs = distance(arc.to, a.pos) <= a.radius + projectileR; impactTick += ticks(arc.lengthM / row.speedMps);
      } else {
        const spread = row.kind === 'twin' ? [-row.spreadDeg / 2, row.spreadDeg / 2] : [0];
        aimedAtUs = spread.some(deg => along(rotate(dir, deg * Math.PI / 180), a.radius + projectileR)); impactTick += ticks(distance(owner.pos, a.pos) / row.speedMps);
      }
      out.push({ id: p.activationId, family, origin, impactTick, aimedAtUs, damage: spell.damage * row.count * (p.damageMult ?? 1), shape: airShapeClass(row.kind) });
    }
    const v = (owner.schoolState as AirSchoolState | undefined)?.volley, volleyRow = v && airRow(v.spellId), volleyBase = v && schoolSpellById(v.spellId);
    if (v && volleyRow && volleyBase) {
      const range = balancedSpell(volleyBase, state).rangeM * v.rangeMult, dir = unit(sub(v.aim, owner.pos), owner.facing);
      out.push({ id: -(owner.id * 100 + v.left), family: 'magic', origin: { ...owner.pos }, impactTick: v.nextTick + ticks(distance(owner.pos, a.pos) / volleyRow.speedMps),
        aimedAtUs: segmentHit(owner.pos, { x: owner.pos.x + dir.x * range, y: owner.pos.y + dir.y * range }, a.pos, a.radius + projectileR) !== undefined, damage: v.damage, shape: 'projectile' });
    }
    for (const e of state.schoolEffects ?? []) {
      if (e.ownerId !== owner.id || e.kind !== 'beam' || e.endTick < state.tick) continue;
      const beamRow = airRow(e.spellId), beamBase = schoolSpellById(e.spellId);
      const len = beamRow && beamBase ? balancedSpell(beamBase, state).rangeM * airSpellRangeMult(state, owner) : distance(e.origin, e.target);
      out.push({ id: -owner.id, family: e.family, origin: { ...owner.pos }, impactTick: e.nextTick,
        aimedAtUs: segmentHit(owner.pos, { x: owner.pos.x + owner.facing.x * len, y: owner.pos.y + owner.facing.y * len }, a.pos, a.radius) !== undefined, damage: e.damage, shape: 'beam' });
    }
    return out;
  },
};
