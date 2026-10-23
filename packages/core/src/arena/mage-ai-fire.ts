// The Ember mage's choices (VR CR-002 "Fire mage"): T07 competence model, 18 m/s aim lead, the Sunfall bank rule.
// W8 lane F owns this file. Ported from mage-arena-vr Kernel/MageAI.cpp ChooseFireSpell, FireOfferable, FireUseful and
// the Fire branches of CollectThreats. The shared mage AI (mage-ai.ts) already applies the competence profile: reaction,
// absorb and perfect rolls, aim error, cadence; this file answers the spell pick (level < 2 draws `mage <id> spell`,
// level >= 2 sorts) and the threats a Fire actor presents.
// Import order matters: schools.ts (through kernel.ts) must load before fire.ts (see fire.ts header).
import { combat, random, ticks } from './kernel.ts';
import { balancedSpell, canonicalSpells, slotSpell, type SchoolSpell } from './schools.ts';
import { fireShape, heatDamageMult, sunfallLoosed, fireState, type FireKind } from './fire.ts';
import { paceOf } from './tuning.ts';
import { distance, inArc, segmentHit, sub, unit } from './math.ts';
import { hasLineOfSight } from './water.ts';
import { archetypeChoose, rivalBuildOf } from './archetypes.ts';
import type { SchoolBrain } from './mage-ai-schools.ts';
import type { ShapeClass, Threat } from './mage-ai.ts';
import type { Actor } from './types.ts';

const sunfallId = 'fire_sunfall';
/** Slots this actor can press: a catalogue rival walks the ten rows (slot n = row n); a loadout walks bolt + four. */
const slotCount = (a: Actor): number => a.schoolState?.catalogue ? canonicalSpells.fire.length : 5;
/** VR FireOfferable: tier (slotSpell), cooldown one tick ahead (the press lands next step), mana, and reach; a dash and the self rows have none. */
function offerable(a: Actor, spell: SchoolSpell, distanceM: number, readyTick: number): boolean {
  const kind = fireShape(spell.id)!.kind;
  if ((fireState(a)!.cooldowns[spell.id] ?? 0) > readyTick || spell.mana > a.mana) return false;
  return kind === 'dash' || kind === 'self' || !(spell.rangeM > 0) || distanceM <= spell.rangeM;
}
/** Useful means damage above 0, or a zone (Pyre); Kindle and Furnace are cast only when no useful row is legal. */
const useful = (spell: SchoolSpell): boolean => spell.damage > 0 || fireShape(spell.id)!.kind === 'zone';
/** The shape class a Fire blow presents to its defender (mage-ai.ts ShapeClass). */
export function fireShapeClass(kind: FireKind | undefined): ShapeClass {
  return kind === 'projectile' ? 'projectile' : kind === 'beam' ? 'beam' : kind === 'line' ? 'line' : kind === 'zone' || kind === 'meteor' ? 'area' : 'close';
}

export const fireBrain: SchoolBrain = {
  boltSpeedMps: () => fireShape('fire_bolt')!.speedMps,
  choose(state, a, { target, distanceM, seen, profile, readyTick }) {
    if (!fireState(a)) return undefined;
    const slots = Array.from({ length: slotCount(a) }, (_, slot) => ({ slot, spell: slotSpell(a, slot, state) })).filter((c): c is { slot: number; spell: SchoolSpell } => c.spell !== undefined);
    // A build rival plays its archetype plan (archetypes.ts) in place of the competence pick; reactions, aim and wards stay the competence's.
    if (rivalBuildOf(a)) {
      const pick = archetypeChoose(state, a, target, distanceM, seen, slots.map(c => ({ ...c, can: offerable(a, c.spell, distanceM, readyTick) })));
      if (pick?.aim && a.mageAI) a.mageAI.input.aim = pick.aim;
      return pick && { slot: pick.slot, cast: true };
    }
    // Session beat on top of the competence curve: from tier IV until the first Sunfall releases, a legal Sunfall is the
    // cast and does not draw the spell random; short of its mana, only a cast that keeps that mana banked may go.
    const sun = a.tier >= 4 && !sunfallLoosed(a) ? slots.find(c => c.spell.id === sunfallId) : undefined;
    if (sun && offerable(a, sun.spell, distanceM, readyTick)) return { slot: sun.slot, cast: true };
    const bank = sun ? balancedSpell(sun.spell, state).mana : undefined;
    const available = slots.filter(c => offerable(a, c.spell, distanceM, readyTick) && (bank === undefined || a.mana >= bank || a.mana - c.spell.mana >= bank));
    if (!available.length) return undefined;
    const usefulChoices = available.filter(c => useful(c.spell)), choices = usefulChoices.length ? usefulChoices : available;
    if (profile.level < 2) return { slot: choices[Math.floor(random(state, `mage ${a.id} spell`) * choices.length)]!.slot, cast: true };
    const counter = (s: SchoolSpell): boolean => profile.level >= 3 && target.absorb && s.family === 'unblockable';
    const ordered = [...choices].sort((x, y) => Number(counter(y.spell)) - Number(counter(x.spell)) || y.spell.damage - x.spell.damage || x.slot - y.slot);
    return { slot: ordered[0]!.slot, cast: true };
  },
  threats(state, owner, a) {
    const result: Threat[] = [];
    if (!fireState(owner) || owner.tags.includes('DEFEATED')) return result;
    const mult = heatDamageMult(state, owner);
    const p = owner.pending;
    // The pending cast (VR CollectThreats, pending branch). Self rows and a dash are not blows the defender answers.
    if (p && hasLineOfSight(state, a.pos, owner.pos)) {
      const row = p.spellId ? canonicalSpells.fire.find(s => s.id === p.spellId) : undefined, shape = row && fireShape(row.id), spell = row && balancedSpell(row, state);
      if (!(shape && (shape.kind === 'self' || shape.kind === 'dash'))) {
        const zone = shape && (shape.kind === 'zone' || shape.kind === 'meteor');
        const centre = zone ? p.aim : owner.pos;
        let aimedAtUs = true;
        if (shape && spell) {
          if (zone) aimedAtUs = distance(centre, a.pos) <= shape.radiusM + a.radius;
          else if (shape.kind === 'cone' || shape.kind === 'ring') aimedAtUs = distance(centre, a.pos) <= (shape.kind === 'ring' ? shape.radiusM : spell.rangeM) + a.radius && inArc(sub(p.aim, owner.pos), sub(a.pos, centre), shape.arcDeg);
          else if (shape.kind === 'line' || shape.kind === 'beam') {
            const d = unit(sub(p.aim, owner.pos)), end = { x: owner.pos.x + d.x * spell.rangeM, y: owner.pos.y + d.y * spell.rangeM };
            aimedAtUs = segmentHit(owner.pos, end, a.pos, a.radius) !== undefined;
          }
        }
        const impactTick = p.releaseTick + (shape?.kind === 'projectile' && shape.speedMps > 0 ? ticks(distance(owner.pos, a.pos) / (shape.speedMps * paceOf(owner))) : 0);
        result.push({ id: p.activationId, family: p.kind === 'staff' ? 'physical' : spell && spell.family !== 'self' ? spell.family : 'magic', origin: { ...centre }, impactTick, aimedAtUs,
          damage: p.kind === 'staff' ? combat.staffStrike.damage : (spell?.damage ?? 0) * (p.damageMult ?? 1) * mult, shape: p.kind === 'staff' ? 'close' : fireShapeClass(shape?.kind) });
      }
    }
    for (const effect of state.schoolEffects ?? []) {
      if (effect.ownerId !== owner.id) continue;
      if (effect.kind === 'detonation' && hasLineOfSight(state, a.pos, effect.origin)) {
        // The committed shadow reads as VR's area telegraph: aimed when the body is inside, impact on its landing tick.
        result.push({ id: effect.activationId, family: effect.family, origin: { ...effect.origin }, impactTick: effect.endTick, aimedAtUs: distance(effect.target, a.pos) < effect.radiusM! + a.radius, damage: effect.damage, shape: 'area' });
      } else if (effect.kind === 'beam' && hasLineOfSight(state, a.pos, owner.pos)) {
        // An active beam is a threat with a stable id (minus the owner id) along the owner's current facing.
        const end = { x: owner.pos.x + owner.facing.x * effect.lengthM!, y: owner.pos.y + owner.facing.y * effect.lengthM! };
        result.push({ id: -owner.id, family: effect.family, origin: { ...owner.pos }, impactTick: effect.nextTick, aimedAtUs: segmentHit(owner.pos, end, a.pos, a.radius) !== undefined, damage: (effect.hit?.damage ?? effect.damage) * mult, shape: 'beam' });
      }
    }
    return result;
  },
};
