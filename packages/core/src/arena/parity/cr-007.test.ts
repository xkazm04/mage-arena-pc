// CR-007 outcome parity: the hand checks of mage-arena-vr AirTests.cpp (T23), re-run on the PC kernel with VR's numbers
// (state.balance 'canonical'). Every expected number is read from cr-007.json, which cites its AirTests.cpp case. The PC
// feel layer VR's kernel does not have (acceleration, hit stun, knockback, cast slow, cast recovery) is switched off with a
// tuning, never by editing a canonical number. VR has no Air scenario summary (cr-007.json scenariosNote).
import { describe, expect, it } from 'vitest';
import { addMage, createArena, DT, resolveHit, spawnProjectile, stateHash, stepArena, ticks } from '../kernel.ts';
import { airCooldownUntil, airRules, airRollStaminaMult, airSheet, airSpellRangeMult, airSpellsPierce, arcPoint, momentumRules, movingAboveMps, veerArc, veerSide, type AirProjectile, type AirSchoolState } from '../air.ts';
import { combat, runtime } from '../kernel.ts';
import { attachMageAI, mageInput } from '../mage-ai.ts';
import { balancedSpell, canonicalSpells, newSchoolState, schoolPresets } from '../schools.ts';
import { defaultTuning, type CombatTuning } from '../tuning.ts';
import { distance, sub, unit, type Vec } from '../math.ts';
import { idleInput, type Actor, type ArenaState, type Family, type Hit, type InputFrame } from '../types.ts';
import cr from './cr-007.json' with { type: 'json' };

/** VR's kernel has no acceleration, hit stun, knockback, cast slow, commit window or cast recovery: the PC feel layer off. */
const vrFeel: CombatTuning = { ...defaultTuning, spells: {}, accelerationMps2: 0, decelerationMps2: 0, hitStunS: 0, hitStunPerDamageS: 0, knockbackM: 0,
  castMoveMultiplier: 1, castCommitFraction: 1, castRecoveryS: 0, rollRecoveryMoveMultiplier: 1 };
const centre = runtime.geometry.arenaCentre;
const slotOf = (id: string): number => airSheet.findIndex(r => r.id === id);
const momentum = (a: Actor): number => (a.schoolState as AirSchoolState).value;
const ss = (a: Actor): AirSchoolState => a.schoolState as AirSchoolState;
/** VR MakeAir: an Air caster at the centre (tier IV, deep pools, Momentum 0, whole catalogue) and a still target. */
function makeAir(rangeM: number, seed = 23, target: Vec = { x: centre.x + rangeM, y: centre.y }): { state: ArenaState; gale: Actor; target: Actor } {
  const state = createArena(seed); state.balance = 'canonical'; state.tuning = vrFeel;
  const gale = addMage(state, 0, centre, 'Gale'), other = addMage(state, 1, target, 'Target');
  gale.schoolState = { ...newSchoolState(schoolPresets.air[0]!), catalogue: true }; gale.tier = 4;
  for (const a of [gale, other]) { a.maxHp = a.hp = 1000; a.maxMana = a.mana = 500; }
  return { state, gale, target: other };
}
const step = (state: ArenaState, a: Actor, input: InputFrame): void => stepArena(state, { [a.id]: input });
const castAt = (aim: Vec, slot: number): InputFrame => ({ ...idleInput(aim), slot, cast: true });
const aimAhead = (a: Actor): Vec => ({ x: a.pos.x + 1, y: a.pos.y });
const count = (state: ArenaState, kind: string, actorId: number): number => state.events.filter(e => e.kind === kind && e.actorId === actorId).length;
const lock = (a: Actor, level: number): void => { const s = ss(a); s.value = level; s.lockValue = level; s.lockedUntil = 1000; };

describe('CR-007 Air parity (VR AirTests.cpp hand checks, canonical balance)', () => {
  it('Literals: ten rows in VR order with the CSV numbers, windup and cooldown ticks, shapes and the Momentum identity', () => {
    expect(airSheet.map(r => r.id)).toEqual(cr.rows.map(r => r.id));
    for (const [i, expected] of cr.rows.entries()) {
      const spell = canonicalSpells.air[i]!, row = airSheet[i]!;
      expect({ id: spell.id, kind: row.kind, tier: spell.tier, castS: spell.castS, cooldownS: spell.cooldownS, mana: spell.mana, damage: spell.damage, family: spell.family,
        telegraphS: spell.telegraphS, rangeM: spell.rangeM, momentumMode: row.momentum.mode, momentum: row.momentum.amount,
        // ticks(0) is -0 (ceil of -1e-9); + 0 normalises it.
        windupTicks: ticks(Math.max(spell.castS, spell.telegraphS)) + 0, cooldownTicks: ticks(spell.cooldownS) + 0 }).toEqual(expected);
    }
    const row = (id: string) => airSheet[slotOf(id)]!, s = cr.shapes;
    expect([row('air_bolt').speedMps, row('air_bolt').bolt, row('air_shear').speedMps, row('air_shear').count, row('air_shear').spreadDeg, row('air_slipstream').dashM])
      .toEqual([s.boltSpeedMps, true, s.shearSpeedMps, s.shearCount, s.shearSpreadDeg, s.slipstreamDashM]);
    expect([row('air_veer').speedMps, row('air_veer').entryDeg, row('air_downdraft').radiusM, row('air_form').durationS, row('air_form').evadePhysical, row('air_form').evadeMagic, row('air_form').needMomentum])
      .toEqual([s.veerSpeedMps, s.veerEntryDeg, s.downdraftRadiusM, s.formDurationS, s.formEvadePhysical, s.formEvadeMagic, s.formNeedMomentum]);
    expect([row('air_squall').count, row('air_squall').speedMps, row('air_squall').intervalS, row('air_eye').momentum.lockValue, row('air_eye').momentum.lockS, row('air_eye').drainMult])
      .toEqual([s.squallCount, s.squallSpeedMps, s.squallIntervalS, s.eyeLockValue, s.eyeLockS, s.eyeDrainMult]);
    expect([row('air_tempest').roots, row('air_cyclone').durationS, row('air_cyclone').tickS]).toEqual([s.tempestRoots, s.cycloneDurationS, s.cycloneTickS]);
    const state = createArena(1); state.balance = 'canonical';
    const m = cr.momentumRules, rules = momentumRules(state);
    expect({ ...rules, movingAboveMps }).toEqual({ min: m.min, max: m.max, gainPerS: m.gainPerS, decayPerS: m.decayPerS, drainMult: m.drainMult, movingAboveMps: m.movingAboveMps });
    expect([combat.movement.walkMps, combat.roll.staminaCost, combat.simStepHz]).toEqual([4.5, 25, 60]);
  });

  it('Momentum: 30 walking ticks +10, 12 still ticks -5, clamps at 0 and 100, a held-ward walk neither gains nor decays', () => {
    const { state, gale, target } = makeAir(10), m = cr.momentum;
    for (let t = 0; t < m.walkTicks; t++) stepArena(state, { [gale.id]: { ...idleInput(aimAhead(gale)), move: { x: 0, y: 1 } }, [target.id]: { ...idleInput({ x: target.pos.x - 1, y: target.pos.y }), move: { x: 0, y: 1 } } });
    expect(momentum(gale)).toBeCloseTo(m.afterWalk, 9);
    expect('schoolState' in target).toBe(false);
    for (let t = 0; t < m.stillTicks; t++) step(state, gale, idleInput(aimAhead(gale)));
    expect(momentum(gale)).toBeCloseTo(m.afterStill, 9);
    for (let t = 0; t < 18; t++) step(state, gale, idleInput(aimAhead(gale)));
    expect(momentum(gale)).toBe(0);
    ss(gale).value = m.heldWalkFrom;
    expect(combat.movement.walkMps * combat.absorb.moveSpeedWhileHeldMult).toBeLessThan(movingAboveMps);
    for (let t = 0; t < m.heldWalkTicks; t++) step(state, gale, { ...idleInput(aimAhead(gale)), move: { x: 0, y: 1 }, absorb: true });
    expect(momentum(gale)).toBe(m.heldWalkFrom);
    ss(gale).value = m.clampFrom;
    step(state, gale, { ...idleInput(aimAhead(gale)), move: { x: 0, y: -1 } });
    expect(momentum(gale)).toBe(m.clamp);
  });

  it('Thresholds: pierce, roll and range bands at the band edges; roll stamina 15 vs 25; dart range 18.2 vs 14; drain 1.2 and 1.8', () => {
    const probe = makeAir(10), t = cr.thresholds;
    for (const level of t.levels) {
      ss(probe.gale).value = level;
      expect([airSpellsPierce(probe.state, probe.gale), airRollStaminaMult(probe.state, probe.gale), airSpellRangeMult(probe.state, probe.gale)])
        .toEqual([level >= 40 ? 1 : 0, level >= 40 ? 0.6 : 1, level >= 80 ? 1.3 : 1]);
    }
    expect([airSpellsPierce(probe.state, probe.target), airRollStaminaMult(probe.state, probe.target)]).toEqual([0, 1]);
    for (const [level, cost] of [[50, t.rollStamina.at50], [0, t.rollStamina.at0]] as const) {
      const { state, gale } = makeAir(10); lock(gale, level);
      const before = gale.stamina;
      step(state, gale, { ...idleInput(aimAhead(gale)), move: { x: 0, y: 1 }, roll: true });
      expect(before - gale.stamina).toBeCloseTo(cost, 9);
    }
    for (const [level, range] of [[80, t.dartRange.at80], [79, t.dartRange.at79]] as const) {
      const { state, gale } = makeAir(10, 23, { x: centre.x, y: centre.y + 8 }); lock(gale, level);
      step(state, gale, castAt(aimAhead(gale), slotOf('air_bolt')));
      const shot = state.projectiles.find(p => p.ownerId === gale.id)!;
      expect(shot.remainingM + 24 / 60).toBeCloseTo(range, 9);
    }
    const { state, gale, target } = makeAir(10);
    expect(airRules.drainMult(state, gale)).toBeCloseTo(t.drain.air, 12);
    ss(gale).lockedUntil = state.tick + 10; ss(gale).lockDrainMult = 1.5;
    expect(airRules.drainMult(state, gale)).toBeCloseTo(t.drain.eye, 12);
    expect(airRules.drainMult(state, target)).toBe(1);
  });

  it('Thresholds: a dart at Momentum 40 pierces one extra target, at 39 it does not', () => {
    for (const level of [40, 39]) {
      const { state, gale, target } = makeAir(4); lock(gale, level);
      const second = addMage(state, 1, { x: gale.pos.x + 6, y: gale.pos.y }, 'Second'); second.maxHp = second.hp = 1000;
      step(state, gale, castAt(aimAhead(gale), slotOf('air_bolt')));
      for (let t = 0; t < 30; t++) step(state, gale, idleInput(aimAhead(gale)));
      expect(1000 - target.hp).toBe(cr.thresholds.pierce.first);
      expect(1000 - second.hp).toBe(level >= 40 ? cr.thresholds.pierce.secondAt40 : cr.thresholds.pierce.secondAt39);
    }
  });

  it('Rows: mana at the press, the cooldown, the windup and one cast event; a press inside the cooldown does nothing', () => {
    for (const row of cr.rows) {
      const { state, gale, target } = makeAir(5); ss(gale).value = 50;
      step(state, gale, castAt(target.pos, slotOf(row.id)));
      expect(500 - gale.mana).toBeCloseTo(row.mana, 9);
      expect(airCooldownUntil(gale, row.id)).toBe(state.tick + row.cooldownTicks);
      expect(count(state, 'cast', gale.id)).toBe(1);
      if (row.windupTicks > 0) expect(gale.pending!.releaseTick - gale.pending!.startTick).toBe(row.windupTicks);
      else expect(gale.pending).toBeUndefined();
      for (let i = 0; i < row.windupTicks + 2; i++) step(state, gale, idleInput(target.pos));
      const manaBefore = gale.mana;
      step(state, gale, castAt(target.pos, slotOf(row.id)));
      expect(count(state, 'cast', gale.id)).toBe(1);
      expect(gale.mana).toBeGreaterThanOrEqual(manaBefore);
    }
    const { state, gale, target } = makeAir(5); gale.tier = 3;
    step(state, gale, castAt(target.pos, slotOf('air_tempest')));
    expect(count(state, 'cast', gale.id)).toBe(0);
  });

  const firstHit = (id: string, distanceM: number, maxTicks: number) => {
    const { state, gale, target } = makeAir(distanceM);
    step(state, gale, castAt(target.pos, slotOf(id)));
    for (let t = 0; target.hp >= 1000 && t < maxTicks; t++) step(state, gale, idleInput(target.pos));
    return { damage: 1000 - target.hp, momentum: momentum(gale) };
  };
  for (const hit of cr.hits) {
    it(`Hits: ${hit.id} first connecting damage ${hit.damage}, Momentum paid ${hit.momentum}`, () => {
      expect(firstHit(hit.id, hit.distance, hit.maxTicks)).toEqual({ damage: hit.damage, momentum: hit.momentum });
    });
  }
  const total = (id: string): number => {
    const { state, gale, target } = makeAir(6);
    step(state, gale, castAt(target.pos, slotOf(id)));
    for (let t = 0; t < 200; t++) step(state, gale, idleInput(target.pos));
    return 1000 - target.hp;
  };
  it('Hits: Squall lands four orbs of 11 (44)', () => expect(total('air_squall')).toBe(cr.totals.air_squall));
  it('Hits: Cyclone lands eight 0.25 s ticks of 12 (96)', () => expect(total('air_cyclone')).toBe(cr.totals.air_cyclone));

  it('SquallTicks: windup 18, orbs on R, R+15, R+30, R+45, each its own activation id, all four land, the volley ends', () => {
    const { state, gale, target } = makeAir(cr.squall.distance), aim = { ...target.pos };
    step(state, gale, castAt(aim, slotOf('air_squall')));
    const press = state.tick, seen = new Set<number>(), releases: number[] = [], activations = new Set<number>();
    for (let t = 0; t < 140; t++) {
      for (const p of state.projectiles) if (p.ownerId === gale.id && !seen.has(p.id)) { seen.add(p.id); releases.push(state.tick); activations.add(p.activationId); }
      step(state, gale, idleInput(aim));
    }
    expect(releases).toEqual(cr.squall.offsets.map(o => press + cr.squall.windupTicks + o));
    expect(activations.size).toBe(cr.squall.activations);
    expect(1000 - target.hp).toBe(cr.squall.landed);
    expect(ss(gale).volley).toBeUndefined();
  });

  it('Slipstream: 6 m along the aim at once and +30 Momentum', () => {
    const { state, gale } = makeAir(10), start = { ...gale.pos };
    step(state, gale, castAt({ x: start.x, y: start.y + 20 }, slotOf('air_slipstream')));
    expect(distance(start, gale.pos)).toBeCloseTo(cr.slipstream.distanceM, 9);
    expect(momentum(gale)).toBe(cr.slipstream.momentum);
  });
  it('Tempest Lance: 85 through a held ward', () => {
    const { state, gale, target } = makeAir(8);
    stepArena(state, { [gale.id]: castAt(target.pos, slotOf('air_tempest')), [target.id]: { ...idleInput(gale.pos), absorb: true } });
    for (let t = 0; t < 80; t++) stepArena(state, { [gale.id]: idleInput(target.pos), [target.id]: { ...idleInput(gale.pos), absorb: true } });
    expect(target.metrics.manaRaised).toBeGreaterThan(0);
    expect(1000 - target.hp).toBe(cr.tempest.throughWard);
  });
  it('Tempest Lance roots its caster for the windup', () => {
    const { state, gale, target } = makeAir(8), start = { ...gale.pos };
    step(state, gale, castAt(target.pos, slotOf('air_tempest')));
    for (let t = 0; t < 30; t++) step(state, gale, { ...idleInput(target.pos), move: { x: 0, y: 1 } });
    expect(distance(start, gale.pos)).toBe(cr.tempest.rootedMovementM);
  });

  it('Air Form: refused at 39 (the pre-release decay leaves 38.58), cast at 50 leaves 50 - 25/60 - 40, the window is 180 ticks from release', () => {
    const { state, gale, target } = makeAir(10), f = cr.form;
    ss(gale).value = f.refusedAt;
    step(state, gale, castAt(target.pos, slotOf('air_form')));
    expect(count(state, 'cast', gale.id)).toBe(0);
    ss(gale).value = f.castAt;
    step(state, gale, castAt(target.pos, slotOf('air_form')));
    expect(momentum(gale)).toBeCloseTo(f.afterPress, 9);
    const release = gale.pending!.releaseTick;
    while (state.tick < release) step(state, gale, idleInput(target.pos));
    expect(ss(gale).formUntil).toBe(release + f.durationTicks);
  });

  it('Eye of the Storm: Momentum locked at 100 for 300 ticks, then decay resumes', () => {
    const { state, gale, target } = makeAir(10), e = cr.eye;
    step(state, gale, castAt(target.pos, slotOf('air_eye')));
    const release = gale.pending!.releaseTick;
    while (state.tick < release) step(state, gale, idleInput(target.pos));
    expect(momentum(gale)).toBe(e.lock);
    expect(ss(gale).lockedUntil).toBe(release + e.lockTicks);
    for (let t = 0; t < e.lockTicks - 1; t++) step(state, gale, idleInput(target.pos));
    expect(momentum(gale)).toBe(e.lock);
    step(state, gale, idleInput(target.pos));
    expect(momentum(gale)).toBeCloseTo(e.afterLock, 9);
  });

  it('VeerArc: R = L / (2 sin E), arc 2ER, launch and arrival 60 deg off the chord, midpoint R (1 - cos E) off the line, side by activation parity', () => {
    const v = cr.veer, from = { x: 0, y: 0 }, to = { x: v.chord, y: 0 };
    for (const side of [1, -1]) {
      const arc = veerArc(from, to, v.entryDeg, side);
      expect(arc.radiusM).toBeCloseTo(v.radius, 12);
      expect(arc.lengthM).toBeCloseTo(v.length, 12);
      const end = arcPoint(arc, arc.lengthM);
      expect(end.x).toBeCloseTo(v.chord, 9); expect(end.y).toBeCloseTo(0, 9);
      expect(arc.launchDir.x).toBeCloseTo(v.launchX, 12); expect(arc.launchDir.y).toBeCloseTo(side * v.launchY, 12);
      const tangent = unit(sub(end, arcPoint(arc, arc.lengthM - 1e-6)));
      expect(tangent.x).toBeCloseTo(v.launchX, 5); expect(tangent.y).toBeCloseTo(-side * v.launchY, 5);
      const mid = arcPoint(arc, arc.lengthM / 2);
      expect(mid.x).toBeCloseTo(v.midX, 9); expect(mid.y).toBeCloseTo(side * v.midY, 9);
    }
    expect([veerSide(8), veerSide(9)]).toEqual([v.evenSide, v.oddSide]);
  });

  it('VeerArc: the released bolt carries the arc VR flies (centre, radius, turn sign) and the arc length plus the unused range', () => {
    const { state, gale, target } = makeAir(cr.veer.flightTargetM), caster = { ...gale.pos }, aim = { ...target.pos };
    step(state, gale, castAt(aim, slotOf('air_veer')));
    const activation = gale.pending!.activationId, release = gale.pending!.releaseTick;
    while (state.tick < release - 1) step(state, gale, idleInput(aim));
    step(state, gale, idleInput(aim));
    const bolt = state.projectiles.find(p => p.activationId === activation) as AirProjectile, arc = veerArc(caster, aim, cr.veer.entryDeg, veerSide(activation));
    // The release tick's own flight already ran (straight until kernel R1, along the arc after it), so only the fixed fields compare.
    expect({ centre: bolt.arc!.centre, radiusM: bolt.arc!.radiusM, sign: bolt.arc!.sign }).toEqual({ centre: arc.centre, radiusM: arc.radiusM, sign: arc.turnSign });
    expect(bolt.arc!.leftM).toBeGreaterThanOrEqual(arc.lengthM - 16 / 60 - 1e-9);
    expect(bolt.remainingM + 16 / 60).toBeCloseTo(arc.lengthM + Math.max(0, 14 - cr.veer.flightTargetM), 9);
  });

  it('VeerArc: the kernel flies the arc, 16 k / 60 m after k ticks, and hits on the 44th flight tick for 24', () => {
    const fly = (seed: number): string => {
      const { state, gale, target } = makeAir(cr.veer.flightTargetM, seed), caster = { ...gale.pos }, aim = { ...target.pos };
      step(state, gale, castAt(aim, slotOf('air_veer')));
      const activation = gale.pending!.activationId, release = gale.pending!.releaseTick, arc = veerArc(caster, aim, cr.veer.entryDeg, veerSide(activation));
      let hitTick = -1;
      for (let guard = 0; guard < 200 && hitTick < 0; guard++) {
        step(state, gale, idleInput(aim));
        if (state.tick < release) continue;
        if (target.hp < 1000) { hitTick = state.tick; break; }
        const bolt = state.projectiles.find(p => p.activationId === activation)!, k = state.tick - release + 1, at = arcPoint(arc, 16 * k / 60);
        expect(bolt.pos.x).toBeCloseTo(at.x, 9); expect(bolt.pos.y).toBeCloseTo(at.y, 9);
      }
      expect(hitTick - release + 1).toBe(cr.veer.hitFlightTick);
      expect(1000 - target.hp).toBe(cr.veer.damage);
      return stateHash(state);
    };
    expect(fly(31)).toBe(fly(31));
  });

  it('FormEvasion: seed 23023, 100 magic then 100 physical hits: 72 and 37 land, unblockables never evaded and never draw', () => {
    const e = cr.evasion, state = createArena(e.seed); state.tuning = vrFeel; state.balance = 'canonical';
    const player = addMage(state, 0, runtime.games.playerSpawn, 'Cassia'), gale = addMage(state, 1, centre, 'Gale');
    gale.schoolState = newSchoolState(schoolPresets.air[0]!); gale.maxHp = gale.hp = 1e6; gale.maxMana = gale.mana = 95;
    ss(gale).formUntil = state.tick + 180;
    const hitOf = (family: Family): Hit => ({ ownerId: player.id, activationId: state.nextId++, damage: 1, family, tier: 0, source: { ...runtime.games.playerSpawn } });
    const throwAt = (target: Actor, family: Family, n: number): number => {
      let landed = 0;
      for (let i = 0; i < n; i++) { const hpBefore = target.hp; resolveHit(state, target, hitOf(family)); landed += target.hp < hpBefore ? 1 : 0; }
      return landed;
    };
    const magic = throwAt(gale, 'magic', e.hits);
    expect(state.randomLog[0]!.value).toBe(e.firstDraw);
    expect(state.randomLog[0]!.purpose).toMatch(new RegExp(`^air ${gale.id} evade \\d+$`));
    const physical = throwAt(gale, 'physical', e.hits), draws = state.randomLog.length;
    const unblockable = throwAt(gale, 'unblockable', e.hits);
    expect([magic, physical, unblockable]).toEqual([e.magicLand, e.physicalLand, e.hits]);
    expect(state.randomLog.length).toBe(draws);
    expect(1e6 - gale.hp).toBe(e.magicLand + e.physicalLand + e.hits);
    expect(gale.metrics.hits).toBe(e.magicLand + e.physicalLand + e.hits);
    ss(gale).formUntil = state.tick;
    const after = state.randomLog.length;
    expect(throwAt(gale, 'magic', 10)).toBe(10);
    expect(state.randomLog.length).toBe(after);
    expect(throwAt(player, 'magic', 1)).toBe(1);
  });

  it('Deflect: a perfect absorb sends a tier <= own tier bolt along the aim, same speed, damage and tier, never again; a higher tier is not deflected', () => {
    const d = cr.deflect;
    for (const tier of [...d.deflectedTiers, ...d.refusedTiers]) {
      const state = createArena(d.seed); state.tuning = vrFeel; state.balance = 'canonical';
      const player = addMage(state, 0, { x: centre.x - 8, y: centre.y }, 'Cassia'), gale = addMage(state, 1, centre, 'Gale');
      gale.schoolState = newSchoolState(schoolPresets.air[0]!); gale.tier = d.galeTier;
      spawnProjectile(state, { ownerId: player.id, activationId: state.nextId++, damage: d.boltDamage, family: 'magic', tier, source: { x: centre.x - 8, y: centre.y } },
        { x: centre.x - 3, y: centre.y }, { x: 1, y: 0 }, d.boltSpeedMps, 10);
      const facing = unit({ x: -1, y: 1 }), aim = { x: centre.x + facing.x, y: centre.y + facing.y };
      for (let t = 1; t <= 20 && gale.metrics.perfects === 0; t++) step(state, gale, { ...idleInput(aim), absorb: t >= d.wardFromStep });
      expect(gale.metrics.perfects).toBe(1);
      const back = state.projectiles.find(p => p.ownerId === gale.id);
      if (tier <= d.galeTier) {
        expect(back).toBeDefined();
        expect(unit(back!.velocity).x).toBeCloseTo(facing.x, 12); expect(unit(back!.velocity).y).toBeCloseTo(facing.y, 12);
        expect(Math.hypot(back!.velocity.x, back!.velocity.y)).toBeCloseTo(d.boltSpeedMps, 12);
        expect([back!.damage, back!.reflected, back!.tier]).toEqual([d.boltDamage, true, tier]);
      } else expect(back).toBeUndefined();
    }
  });

  it('Mind: Tempest at tier IV with no spell draw; not at a rolling target; Air Form against a bolt in flight; Slipstream under 40 not at the target; level 2 prefers Squall', () => {
    const decide = (gale: Actor, state: ArenaState, level: number): InputFrame => { attachMageAI(gale, level, state.tick); return mageInput(state, gale); };
    {
      const { state, gale } = makeAir(8); ss(gale).value = 60;
      const draws = state.randomLog.length, input = decide(gale, state, 1.5);
      expect([input.cast, input.slot]).toEqual([true, slotOf('air_tempest')]);
      expect(state.randomLog.slice(draws).some(r => r.purpose.endsWith(' spell'))).toBe(false);
    }
    {
      const { state, gale, target } = makeAir(8); target.rollUntil = state.tick + 10;
      const input = decide(gale, state, 1.5);
      expect(input.cast && input.slot === slotOf('air_tempest')).toBe(false);
    }
    {
      const { state, gale, target } = makeAir(8); gale.tier = 2; ss(gale).value = 50;
      spawnProjectile(state, { ownerId: target.id, activationId: state.nextId++, damage: 8, family: 'magic', tier: 0, source: { ...target.pos } }, target.pos, { x: -1, y: 0 }, 12, 12);
      const input = decide(gale, state, 1);
      expect([input.cast, input.slot]).toEqual([true, slotOf('air_form')]);
    }
    {
      const { state, gale, target } = makeAir(6.5); gale.tier = 2; ss(gale).value = 10;
      const input = decide(gale, state, 1);
      expect([input.cast, input.slot]).toEqual([true, slotOf('air_slipstream')]);
      const dash = unit(sub(input.aim, gale.pos)), atTarget = unit(sub(target.pos, gale.pos));
      expect(dash.x * atTarget.x + dash.y * atTarget.y).toBeLessThan(0.99);
      expect(distance(input.aim, gale.pos)).toBeCloseTo(airSheet[slotOf('air_slipstream')]!.dashM, 9);
    }
    {
      const { state, gale } = makeAir(8); gale.tier = 3; ss(gale).value = 60;
      const input = decide(gale, state, 2);
      expect([input.cast, input.slot]).toEqual([true, slotOf('air_squall')]);
    }
  });

  it('runs canonical: an overlay key never reaches a parity state', () => {
    const { state } = makeAir(5);
    for (const spell of canonicalSpells.air) expect(balancedSpell(spell, state)).toBe(spell);
    expect(DT).toBe(1 / 60);
  });
});
