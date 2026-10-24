// PC rank-5 ultimate forms (spark combat-system-depth WP3; progression.pc.json spellRanks.ultimates). Each of the six fires only at
// rank 5 (rank 4 has the same power and no extra), does its extra effect, and reads its numbers from the data file. A canonical
// state and every rank below 5 see none of it, so the goldens and the CR-002/CR-007 parity suites stay as they were.
// kernel.ts is imported first: fire.ts and air.ts must load through schools.ts (see the fire.ts header).
import { describe, expect, it } from 'vitest';
import { addMage, createArena, stepArena, ticks } from './kernel.ts';
import { canonicalSpells, newSchoolState, schoolPresets } from './schools.ts';
import { heatValue } from './fire.ts';
import { actorUltimate, progression, setSpellRanks, type UltimateForm } from './progression.ts';
import { ultimateContact } from './shapes.ts';
import { idleInput, type Actor, type ArenaState, type SlotSchool } from './types.ts';
import type { Vec } from './math.ts';

const form = <K extends UltimateForm['effect']>(id: string, effect: K): UltimateForm & { effect: K } => {
  const f = progression.spellRanks.ultimates[id]!;
  expect(f.effect).toBe(effect);
  return f as UltimateForm & { effect: K };
};
function mage(state: ArenaState, team: number, pos: Vec): Actor {
  const a = addMage(state, team, pos, team ? 'Target' : 'Caster', { vigor: 1, focus: 1, nerve: 1 });
  a.maxMana = a.mana = 500; a.maxHp = a.hp = 1000;
  return a;
}
interface Run { state: ArenaState; caster: Actor; target: Actor; releaseTick: number; hits: { tick: number; contactDamage: number }[]; spawned: number }
/** One cast of `spellId` (catalogue slots, collar at tier IV) at a target `distanceM` along +x, then `steps` idle ticks. */
function cast(spellId: string, rank: number | undefined, distanceM: number, options: { steps?: number; balance?: 'canonical'; each?: (run: Run) => void } = {}): Run {
  const school: SlotSchool = spellId.startsWith('fire') ? 'fire' : 'air';
  const state = createArena(11);
  if (options.balance) state.balance = options.balance;
  const caster = mage(state, 0, { x: 20, y: 20 }), target = mage(state, 1, { x: 20 + distanceM, y: 20 });
  caster.schoolState = { ...newSchoolState(schoolPresets[school][0]!), catalogue: true }; caster.tier = 4; caster.lastUnlockTick = 1e9;
  target.lastUnlockTick = 1e9;
  if (rank !== undefined) setSpellRanks(caster, { [spellId]: rank });
  const slot = canonicalSpells[school].findIndex(s => s.id === spellId), aim = { ...target.pos };
  const run: Run = { state, caster, target, releaseTick: -1, hits: [], spawned: 0 };
  for (let i = 0; i < (options.steps ?? 90); i++) {
    const before = state.events.length, projectiles = state.projectiles.length;
    stepArena(state, { [caster.id]: { ...idleInput(aim), slot, cast: i === 0 }, [target.id]: idleInput({ x: target.pos.x - 1, y: target.pos.y }) });
    for (const e of state.events.slice(before)) {
      if (e.kind === 'release' && e.actorId === caster.id && e.spellId === spellId && run.releaseTick < 0) { run.releaseTick = e.tick; run.spawned = state.projectiles.length - projectiles; }
      if (e.kind === 'hit' && e.actorId === target.id && e.targetId === caster.id) run.hits.push({ tick: e.tick, contactDamage: (e as { contactDamage?: number }).contactDamage ?? 0 });
    }
    options.each?.(run);
  }
  expect(run.releaseTick, `${spellId} released`).toBeGreaterThan(0);
  return run;
}

describe('ultimates: six signature rows, rank 5 only', () => {
  it('the registry holds one signature row per archetype per school; rank 4 and canonical balance see none', () => {
    expect(Object.keys(progression.spellRanks.ultimates).sort()).toEqual(['air_bolt', 'air_cyclone', 'air_shear', 'fire_bolt', 'fire_flick', 'fire_wrath']);
    const state = createArena(1), a = mage(state, 0, { x: 20, y: 20 });
    for (const id of Object.keys(progression.spellRanks.ultimates)) {
      setSpellRanks(a, { [id]: 4 }); expect(actorUltimate(a, id, state)).toBeUndefined();
      setSpellRanks(a, { [id]: 5 }); expect(actorUltimate(a, id, state)).toBe(progression.spellRanks.ultimates[id]);
      state.balance = 'canonical'; expect(actorUltimate(a, id, state)).toBeUndefined(); delete state.balance;
    }
    expect(actorUltimate(mage(state, 0, { x: 30, y: 20 }), 'fire_flick', state)).toBeUndefined();
  });

  it('a rank-4 or canonical rank-5 cast of every signature row leaves no trace of an ultimate (no tag, no embers, no root, no slow)', () => {
    for (const [id, d] of [['fire_flick', 3], ['fire_bolt', 8], ['fire_wrath', 6], ['air_shear', 8], ['air_bolt', 8], ['air_cyclone', 6]] as const) {
      for (const run of [cast(id, 4, d), cast(id, 5, d, { balance: 'canonical' })]) {
        expect(run.state.projectiles.some(p => p.ultimate !== undefined), id).toBe(false);
        expect(run.target.water.rootUntil, id).toBe(0);
        expect(run.target.water.slowUntil, id).toBe(0);
      }
    }
  });

  it('fire_flick Searing Hold: the cone roots its target for rootS at rank 5, not at rank 4', () => {
    const f = form('fire_flick', 'root');
    const r4 = cast('fire_flick', 4, 3), r5 = cast('fire_flick', 5, 3);
    expect(r4.hits).toHaveLength(1); expect(r5.hits).toHaveLength(1);
    expect(r4.target.water.rootUntil).toBe(0);
    expect(r5.target.water.rootUntil).toBe(r5.hits[0]!.tick + ticks(f.rootS));
    expect(r5.hits[0]!.contactDamage).toBeCloseTo(r4.hits[0]!.contactDamage, 12);
  });

  it('fire_bolt Kindling Darts: a connecting dart pays heatPerHit more Heat at rank 5', () => {
    const f = form('fire_bolt', 'heat');
    const heatAtHit = (rank: number): number => {
      let heat = -1;
      cast('fire_bolt', rank, 8, { steps: 40, each: run => { if (heat < 0 && run.hits.length) heat = heatValue(run.caster); } });
      return heat;
    };
    expect(heatAtHit(5) - heatAtHit(4)).toBeCloseTo(f.heatPerHit, 9);
  });

  it('fire_wrath Brand Drag: every beam tick that connects slows its target (slowMult for slowS) at rank 5, not at rank 4', () => {
    const f = form('fire_wrath', 'slow');
    const slowed: boolean[] = [];
    const r4 = cast('fire_wrath', 4, 6, { steps: 200 });
    const r5 = cast('fire_wrath', 5, 6, { steps: 200, each: run => { const last = run.hits.at(-1); if (last && last.tick === run.state.tick) slowed.push(run.target.water.slowUntil === last.tick + ticks(f.slowS) && run.target.water.slowMult === f.slowMult); } });
    expect(r4.hits.length).toBeGreaterThan(1);
    expect(r5.hits).toHaveLength(r4.hits.length);
    expect(r4.target.water.slowUntil).toBe(0);
    expect(slowed.length).toBe(r5.hits.length);
    expect(slowed.every(Boolean)).toBe(true);
  });

  it('embers (an effect kind the census rejected for Pyre, kept for placed circles): tickDamage every tickS for durationS, at rank 5 only', () => {
    // Put the first-draft Fire heavy form on Pyre for this test only (progression.pc.json registers none).
    const f = { name: 'Ember Field', summary: 'test', effect: 'embers', tickDamage: 6, tickS: 0.5, durationS: 2 } as const;
    const registry = progression.spellRanks.ultimates;
    expect(registry.fire_pyre).toBeUndefined();
    registry.fire_pyre = f;
    let r4: Run, r5: Run;
    try { r4 = cast('fire_pyre', 4, 6, { steps: 200 }); r5 = cast('fire_pyre', 5, 6, { steps: 200 }); } finally { delete registry.fire_pyre; }
    expect(r4.hits).toHaveLength(1);
    const embers = Math.floor(ticks(f.durationS) / ticks(f.tickS));
    expect(r5.hits).toHaveLength(1 + embers);
    expect(r5.hits.slice(1).map(h => h.tick - r5.releaseTick)).toEqual(Array.from({ length: embers }, (_, i) => (i + 1) * ticks(f.tickS)));
    // Pyre pays 8 Heat: below Kindled, so each ember lands at the data's tickDamage.
    for (const h of r5.hits.slice(1)) expect(h.contactDamage).toBeCloseTo(f.tickDamage, 9);
    expect(r5.state.schoolEffects ?? []).toHaveLength(0);
  });

  it('air_shear Pinning Edge: a blade that reaches its target roots it for rootS at rank 5, not at rank 4', () => {
    const f = form('air_shear', 'root');
    // The blades diverge at +-12 deg (CR-007), so a body straight down the aim line meets them only close in.
    const r4 = cast('air_shear', 4, 1.2), r5 = cast('air_shear', 5, 1.2);
    expect(r4.spawned).toBe(2); expect(r5.spawned).toBe(2);
    expect(r5.hits).toHaveLength(r4.hits.length); expect(r5.hits.length).toBeGreaterThan(0);
    expect(r4.target.water.rootUntil).toBe(0);
    expect(r5.target.water.rootUntil).toBe(r5.hits.at(-1)!.tick + ticks(f.rootS));
    expect(r5.hits[0]!.contactDamage).toBeCloseTo(r4.hits[0]!.contactDamage, 12);
  });

  it('extraProjectiles (Third Blade, retired by D1 6.2, kept for fan rows): rank 5 throws count more blades over the same spread', () => {
    // Put the retired Air close form back on Shear for this test only.
    const f = { name: 'Third Blade', summary: 'test', effect: 'extraProjectiles', count: 1 } as const;
    const registry = progression.spellRanks.ultimates, saved = registry.air_shear!;
    registry.air_shear = f;
    let lines: number[] = [], r4: Run, r5: Run;
    try { r4 = cast('air_shear', 4, 8); r5 = cast('air_shear', 5, 8, { each: run => { if (run.state.tick === run.releaseTick) lines = run.state.projectiles.map(p => p.velocity.y / Math.hypot(p.velocity.x, p.velocity.y)); } }); } finally { registry.air_shear = saved; }
    expect(r4.spawned).toBe(2);
    expect(r5.spawned).toBe(2 + f.count);
    expect(lines).toHaveLength(2 + f.count);
    expect(lines.some(y => Math.abs(y) < 1e-9)).toBe(true);
  });

  it('air_bolt Headwind: a dart that reaches its target slows it (slowMult for slowS) at rank 5, not at rank 4', () => {
    const f = form('air_bolt', 'slow');
    const r4 = cast('air_bolt', 4, 8, { steps: 30 }), r5 = cast('air_bolt', 5, 8, { steps: 30 });
    expect(r4.hits).toHaveLength(1); expect(r5.hits).toHaveLength(1);
    expect(r4.target.water.slowUntil).toBe(0);
    expect(r5.target.water.slowUntil).toBe(r5.hits[0]!.tick + ticks(f.slowS));
    expect(r5.target.water.slowMult).toBe(f.slowMult);
  });

  it('air_cyclone Eye-wall: every beam tick that connects roots its target for rootS at rank 5, not at rank 4', () => {
    const f = form('air_cyclone', 'root');
    const rooted: boolean[] = [];
    const r4 = cast('air_cyclone', 4, 6, { steps: 200 });
    const r5 = cast('air_cyclone', 5, 6, { steps: 200, each: run => { const last = run.hits.at(-1); if (last && last.tick === run.state.tick) rooted.push(run.target.water.rootUntil === last.tick + ticks(f.rootS)); } });
    expect(r4.hits.length).toBeGreaterThan(1);
    expect(r5.hits).toHaveLength(r4.hits.length);
    expect(r4.target.water.rootUntil).toBe(0);
    expect(rooted.length).toBe(r5.hits.length);
    expect(rooted.every(Boolean)).toBe(true);
  });

  it('an on-hit ultimate needs damage through, no perfect, and an owner that still plays the row at rank 5', () => {
    const state = createArena(2), owner = mage(state, 0, { x: 20, y: 20 }), target = mage(state, 1, { x: 25, y: 20 });
    const hit = { ownerId: owner.id, activationId: 1, damage: 5, family: 'magic' as const, tier: 0, source: { ...owner.pos }, ultimate: 'air_bolt' };
    ultimateContact(state, target, owner, hit, { damage: 5, perfect: false });
    expect(target.water.slowUntil).toBe(0); // owner unranked (a reflected blow keeps the tag but changes owner)
    setSpellRanks(owner, { air_bolt: 5 });
    ultimateContact(state, target, owner, hit, { damage: 5, perfect: true });
    ultimateContact(state, target, owner, hit, { damage: 0, perfect: false });
    expect(target.water.slowUntil).toBe(0);
    ultimateContact(state, target, owner, hit, { damage: 5, perfect: false });
    expect(target.water.slowUntil).toBe(state.tick + ticks(form('air_bolt', 'slow').slowS));
  });
});
