// PC build depth WP1 (progression.ts): Agility, spell ranks, enemy levels. Every input is neutral at its default and a
// canonical state ignores it; the goldens (replay-golden.test.ts) and the CR-002/CR-007 parity suites prove the default.
// kernel.ts is imported first: fire.ts and air.ts must load through schools.ts (see the fire.ts header).
import { describe, expect, it } from 'vitest';
import { addMage, createArena, DT, resolveHit, stateHash, stepArena, ticks } from './kernel.ts';
import { createGames, stepGames, tiro } from './games.ts';
import { presets, spells, type Spell } from './catalog.ts';
import { enemyRoster } from './enemies.ts';
import { balancedSpell, canonicalSpells, newSchoolState, rankedSpell, schoolPresets, schoolSpellById, type SchoolSpell } from './schools.ts';
import { fireShape, fireWindupTicks } from './fire.ts';
import { airRow, airWindupTicks } from './air.ts';
import { waterWindupTicks } from './water.ts';
import { adjustedSpell, defaultTuning, paceFor, warningFloor } from './tuning.ts';
import { difficulties, idleInput, type Actor, type ArenaState, type Ranks, type SlotSchool } from './types.ts';
import {
  agileRecoveryS, agilityCastMult, agilityDrainMult, agilityPerfectWindowAddS, agilityRecoveryMult, enemyHpMult, maxEnemyLevel, progression,
  rankPower, rankSteps, rankedWaterSpell, setSpellRanks, spellRankKeys, spellRanksProblems, ultimateFor, waterRankKey,
} from './progression.ts';

const ranksAt = (agility?: number): Ranks => ({ vigor: 1, focus: 1, nerve: 1, ...(agility === undefined ? {} : { agility }) });
function mage(state: ArenaState, agility?: number, team = 0): Actor {
  const a = addMage(state, team, { x: 20, y: 20 }, 'Probe', ranksAt(agility));
  a.maxMana = a.mana = 500; a.maxHp = a.hp = 1000;
  return a;
}
function schoolMage(state: ArenaState, school: SlotSchool, agility?: number): Actor {
  const a = mage(state, agility);
  a.schoolState = { ...newSchoolState(schoolPresets[school][0]!), catalogue: true }; a.tier = 4; a.lastUnlockTick = 1e9;
  return a;
}
const per = (key: 'castMultPerRank' | 'recoveryMultPerRank' | 'drainMultPerRank', rank: number): number => 1 + progression.agility[key] * (rank - 1);
const hit = (target: Actor) => ({ ownerId: 999, activationId: 1, damage: 10, family: 'magic' as const, tier: 1, source: { x: target.pos.x + 5, y: target.pos.y } });
const fireRow = (id: string): SchoolSpell => schoolSpellById(id)!;

describe('agility: each effect scales with (rank - 1); rank 1 and an absent rank are no effect', () => {
  it('absent, rank 1, 3 and 5 multipliers follow the data', () => {
    const state = createArena(3);
    expect([agilityCastMult(mage(state)), agilityRecoveryMult(mage(state)), agilityDrainMult(mage(state)), agilityPerfectWindowAddS(mage(state))]).toEqual([1, 1, 1, 0]);
    for (const r of [1, 3, 5]) {
      const a = mage(state, r);
      expect(agilityCastMult(a)).toBeCloseTo(per('castMultPerRank', r), 12);
      expect(agilityRecoveryMult(a)).toBeCloseTo(per('recoveryMultPerRank', r), 12);
      expect(agilityDrainMult(a)).toBeCloseTo(per('drainMultPerRank', r), 12);
      expect(agilityPerfectWindowAddS(a)).toBeCloseTo(progression.agility.perfectWindowAddSPerRank * (r - 1), 12);
    }
    expect(agilityCastMult(mage(state, 1))).toBe(1);
  });

  it('cast time: a Fire Brand Lance press releases sooner at agility 3 and 5', () => {
    const windup = (r: number): number => {
      const state = createArena(5), a = schoolMage(state, 'fire', r);
      stepArena(state, { [a.id]: { ...idleInput({ x: 30, y: 20 }), slot: canonicalSpells.fire.findIndex(s => s.id === 'fire_lance'), cast: true } });
      return a.pending!.releaseTick - a.pending!.startTick;
    };
    const lance = fireRow('fire_lance').castS;
    expect([1, 3, 5].map(windup)).toEqual([1, 3, 5].map(r => ticks(lance * per('castMultPerRank', r))));
    expect(windup(5)).toBeLessThan(windup(1));
  });

  it('perfect window: a fresh raise catches a magic hit later at agility 3 and 5', () => {
    const lastPerfectAge = (r: number): number => {
      let age = 0;
      for (let k = 0; k < 30; k++) {
        const state = createArena(7); state.tick = 100;
        const t = mage(state, r); t.facing = { x: 1, y: 0 }; t.absorb = true; t.absorbFreshTick = state.tick - k;
        if (resolveHit(state, t, hit(t)).perfect) age = k;
      }
      return age;
    };
    expect([1, 3, 5].map(lastPerfectAge)).toEqual([1, 3, 5].map(r => ticks(defaultTuning.absorbWindowS + progression.agility.perfectWindowAddSPerRank * (r - 1))));
    expect(lastPerfectAge(5)).toBeGreaterThan(lastPerfectAge(1));
  });

  it('recovery: roll recovery and the ward re-raise gap shorten at agility 3 and 5', () => {
    const rollRecovery = (r: number): number => {
      const state = createArena(9), a = mage(state, r);
      stepArena(state, { [a.id]: { ...idleInput({ x: 30, y: 20 }), roll: true, move: { x: 1, y: 0 } } });
      return a.recoveryUntil - a.rollUntil;
    };
    expect([1, 3, 5].map(rollRecovery)).toEqual([1, 3, 5].map(r => ticks(defaultTuning.rollRecoveryS * per('recoveryMultPerRank', r))));
    const reRaiseGap = (r: number): number => {
      const state = createArena(9), a = mage(state, r), aim = { x: 30, y: 20 };
      stepArena(state, { [a.id]: { ...idleInput(aim), absorb: true } });
      stepArena(state, { [a.id]: idleInput(aim) });
      const released = a.releaseTick;
      while (!a.absorb && state.tick < 200) stepArena(state, { [a.id]: { ...idleInput(aim), absorb: true } });
      return a.absorbFreshTick - released;
    };
    expect(reRaiseGap(5)).toBeLessThan(reRaiseGap(1));
    expect(reRaiseGap(3)).toBeLessThanOrEqual(reRaiseGap(1));
    // Cast and staff-strike recoveries read the same helper.
    for (const r of [1, 3, 5]) expect(agileRecoveryS(mage(createArena(1), r), 0.3)).toBeCloseTo(0.3 * per('recoveryMultPerRank', r), 12);
  });

  it('drain: the held ward costs less at agility 3 and 5, stacking with nerve multiplicatively', () => {
    const drained = (agility: number | undefined, nerve: number): number => {
      const state = createArena(13), a = addMage(state, 0, { x: 20, y: 20 }, 'Probe', { vigor: 1, focus: 1, nerve, ...(agility ? { agility } : {}) });
      a.maxMana = a.mana = 500;
      for (let i = 0; i < 61; i++) stepArena(state, { [a.id]: { ...idleInput({ x: 30, y: 20 }), absorb: true } });
      return a.metrics.manaDrained;
    };
    for (const r of [3, 5]) {
      expect(drained(r, 1) / drained(undefined, 1)).toBeCloseTo(per('drainMultPerRank', r), 9);
      expect(drained(r, 5) / drained(undefined, 5)).toBeCloseTo(per('drainMultPerRank', r), 9);
    }
    // Nerve keeps its own, larger rule: rank 5 nerve saves more than rank 5 agility.
    expect(drained(undefined, 5)).toBeLessThan(drained(5, 1));
    expect(drained(1, 1)).toBe(drained(undefined, 1));
    expect(DT).toBeGreaterThan(0);
  });
});

describe('agility never shortens a defender-facing warning below its reaction-band floor', () => {
  const paces = [1, ...difficulties.flatMap(d => [paceFor(0, d), paceFor(1, d)])];
  it('every Fire and Air row at agility 5, at every pace', () => {
    const state = createArena(1);
    for (const pace of paces) for (const school of ['fire', 'air'] as const) for (const row of canonicalSpells[school]) {
      const spell = balancedSpell(row, state), fast = schoolMage(state, school, 5), plain = schoolMage(state, school);
      fast.pace = plain.pace = pace;
      const family = spell.family === 'self' ? 'magic' : spell.family;
      const placed = school === 'fire' ? ['zone', 'meteor'].includes(fireShape(spell.id)!.kind) : airRow(spell.id)!.kind === 'zone';
      const windup = (a: Actor): number => school === 'fire' ? fireWindupTicks(a, spell, state) : airWindupTicks(a, spell, airRow(spell.id)!, state);
      const floor = warningFloor(family, placed), sequential = school === 'fire' && fireShape(spell.id)!.sequential;
      if (spell.telegraphS > 0 && !sequential) expect(windup(fast), `${spell.id} at pace ${pace}`).toBeGreaterThanOrEqual(ticks(Math.min(spell.telegraphS, floor)));
      expect(windup(fast), spell.id).toBeLessThanOrEqual(windup(plain));
    }
  });
  it('the floor binds: Tempest Lance at the hard pace and Sunfall\'s shadow keep 0.8 s at agility 5', () => {
    const state = createArena(1), floor = warningFloor('unblockable', false);
    const tempest = balancedSpell(fireRow('air_tempest'), state), fast = schoolMage(state, 'air', 5), plain = schoolMage(state, 'air');
    fast.pace = plain.pace = paceFor(1, 'hard');
    expect(airWindupTicks(fast, tempest, airRow('air_tempest')!, state)).toBe(ticks(floor));
    expect(airWindupTicks(plain, tempest, airRow('air_tempest')!, state)).toBe(ticks(floor));
    // Sunfall: the shadow (the warning) is queued at release; at the hard pace and agility 5 it still lasts the floor.
    const fire = createArena(2), caster = schoolMage(fire, 'fire', 5); caster.pace = paceFor(1, 'hard');
    const slot = canonicalSpells.fire.findIndex(s => s.id === 'fire_sunfall');
    let input = { ...idleInput({ x: 26, y: 20 }), slot, cast: true };
    for (let i = 0; i < 200 && !(fire.schoolEffects ?? []).some(e => e.kind === 'detonation'); i++) { stepArena(fire, { [caster.id]: input }); input = idleInput({ x: 26, y: 20 }); }
    const shadow = fire.schoolEffects!.find(e => e.kind === 'detonation')!;
    expect(shadow.nextTick - fire.tick).toBe(ticks(floor));
  });
  it('Water: Drown Coil (unblockable, at its floor) and Puddle (positional, at its floor) keep their warning; Freeze Field shortens', () => {
    const state = createArena(1), fast = mage(state, 5), plain = mage(state);
    const row = (id: string, a: Actor): Spell => adjustedSpell(spells.find(s => s.id === id)!, a, state);
    expect(waterWindupTicks(state, fast, row('lash:4:base', fast))).toBe(ticks(warningFloor('unblockable', false)));
    expect(waterWindupTicks(state, fast, row('mire:1:base', fast))).toBe(ticks(warningFloor('magic', true)));
    expect(waterWindupTicks(state, fast, row('mire:3:base', fast))).toBeLessThan(waterWindupTicks(state, plain, row('mire:3:base', plain)));
    for (const pace of paces) {
      fast.pace = pace;
      for (const s of spells.filter(s => s.telegraphS > 0)) expect(waterWindupTicks(state, fast, row(s.id, fast)), `${s.id} at ${pace}`).toBeGreaterThanOrEqual(ticks(Math.min(s.telegraphS, warningFloor(s.family, s.kind === 'zone'))));
    }
  });
});

describe('spell ranks: ranks 1-4 power only, rank 5 = rank 4 power plus an ultimate form', () => {
  it('rankedSpell multiplies damage by the rank power over the balanced row; cost, cast and cooldown unchanged', () => {
    const state = createArena(1);
    for (const id of ['fire_lance', 'fire_bolt', 'air_shear', 'air_tempest']) for (const r of [1, 2, 3, 4]) {
      const a = mage(state); setSpellRanks(a, { [id]: r });
      const base = balancedSpell(fireRow(id), state), ranked = rankedSpell(fireRow(id), a, state);
      expect(ranked.damage).toBeCloseTo(base.damage * progression.spellRanks.power[r - 1]!, 12);
      expect([ranked.mana, ranked.castS, ranked.cooldownS, ranked.telegraphS, ranked.rangeM]).toEqual([base.mana, base.castS, base.cooldownS, base.telegraphS, base.rangeM]);
    }
    expect(progression.spellRanks.power[0]).toBe(1);
    expect(rankedSpell(fireRow('fire_lance'), mage(state), state)).toEqual(balancedSpell(fireRow('fire_lance'), state));
  });
  it('a ranked Ember Dart flies with its rank power (release reads rankedSpell)', () => {
    const dart = (r: number | undefined): number => {
      const state = createArena(4), a = schoolMage(state, 'fire');
      if (r) setSpellRanks(a, { fire_bolt: r });
      stepArena(state, { [a.id]: { ...idleInput({ x: 30, y: 20 }), slot: 0, cast: true } });
      for (let i = 0; i < 5 && !state.projectiles.length; i++) stepArena(state, { [a.id]: idleInput({ x: 30, y: 20 }) });
      return state.projectiles[0]!.damage;
    };
    expect(dart(3) / dart(undefined)).toBeCloseTo(rankPower(3), 12);
    expect(dart(1)).toBe(dart(undefined));
  });
  it('rank 5 keeps rank 4 power; an ultimate answers only at rank 5 and only for a registered row (WP3: six)', () => {
    expect(rankPower(5)).toBe(rankPower(4));
    const registered = Object.keys(progression.spellRanks.ultimates);
    expect(registered).toHaveLength(6);
    for (const row of [...canonicalSpells.fire, ...canonicalSpells.air]) {
      for (const r of [1, 2, 3, 4]) expect(ultimateFor(row.id, r)).toBeUndefined();
      expect(ultimateFor(row.id, 5) !== undefined).toBe(registered.includes(row.id));
    }
  });
  it('spell-rank maps refuse unknown keys and ranks off 1..5; an empty map leaves the actor key absent', () => {
    expect(spellRanksProblems({ fire_lance: 5, 'tide_orb:2': 3, 'bolt:0': 1 })).toEqual([]);
    expect(spellRanksProblems({ fire_lancer: 2 })).toEqual(['Unknown spell-rank key fire_lancer.']);
    expect(spellRanksProblems({ 'tide_orb:2:A': 2 })).toEqual(['Unknown spell-rank key tide_orb:2:A.']);
    expect(spellRanksProblems({ fire_lance: 6 })).toEqual(['Spell rank fire_lance=6 is not an integer 1..5.']);
    expect(spellRanksProblems({ fire_lance: 1.5 })).toHaveLength(1);
    const a = mage(createArena(1)); setSpellRanks(a, {}); expect('spellRanks' in a).toBe(false);
    expect(() => setSpellRanks(a, { fire_lance: 0 })).toThrow(/not an integer/);
    expect(spellRankKeys).toContain('mirror:4');
  });
});

describe("rank steps (D1 6.10): the mean power rank above 1 over the actor's rows", () => {
  it('0 unranked; a Fire actor averages its bolt and four slots; rank 5 counts as 4; canonical reads 0', () => {
    const state = createArena(1), fire = schoolMage(state, 'fire'), { bolt, slots } = fire.schoolState!.loadout;
    expect(rankSteps(fire, state)).toBe(0);
    setSpellRanks(fire, { [bolt]: 3, [slots[0]!]: 5 });
    expect(rankSteps(fire, state)).toBeCloseTo((2 + 3) / 5, 12);
    state.balance = 'canonical'; expect(rankSteps(fire, state)).toBe(0);
  });
  it('a Water actor averages the bolt and every line row of its composition', () => {
    const state = createArena(1), water = mage(state), rows = 1 + water.water.composition.lines.length * 4;
    setSpellRanks(water, { 'bolt:0': 2, [`${water.water.composition.lines[0]}:1`]: 4 });
    expect(rankSteps(water, state)).toBeCloseTo((1 + 3) / rows, 12);
  });
});

describe('Water ranks key a line row <line>:<tier>; rank 1 is the pinned Water numbers', () => {
  const pinned = { 'tide_orb:2:base': { damage: 12, amount: 0 }, 'mend:1:base': { damage: 0, amount: 12 }, 'mend:3:base': { damage: 0, amount: 30 }, 'mirror:4:base': { damage: 40, amount: 40 }, 'mend:2:base': { damage: 0, amount: 0.5 }, 'lash:4:base': { damage: 25, amount: 0 } } as const;
  it('rank 1 (absent or explicit) returns the row unchanged; rank 3 scales damage and effect size, not ratios', () => {
    const state = createArena(1);
    for (const [id, numbers] of Object.entries(pinned)) {
      const row = spells.find(s => s.id === id)!, key = waterRankKey(row);
      expect({ damage: row.damage, amount: row.amount }, id).toEqual(numbers);
      expect(rankedWaterSpell(row, mage(state), state)).toBe(row);
      const one = mage(state); setSpellRanks(one, { [key]: 1 }); expect(rankedWaterSpell(row, one, state)).toBe(row);
      const three = mage(state); setSpellRanks(three, { [key]: 3 });
      const ranked = rankedWaterSpell(row, three, state), effect = ['heal', 'hot', 'font', 'return'].includes(row.effect);
      expect(ranked.damage).toBeCloseTo(row.damage * rankPower(3), 12);
      expect(ranked.amount).toBeCloseTo(effect ? row.amount * rankPower(3) : row.amount, 12);
      expect([ranked.castS, ranked.cooldownS, ranked.mana, ranked.durationS]).toEqual([row.castS, row.cooldownS, row.mana, row.durationS]);
    }
    expect(waterRankKey(spells.find(s => s.id === 'tide_orb:4:A')!)).toBe('tide_orb:4');
    expect(waterRankKey(spells.find(s => s.id === 'bolt:0:base')!)).toBe('bolt:0');
  });
  it('a reference Games with every Water row at rank 1 steps exactly as an unranked one; rank 3 does not', () => {
    const run = (ranks?: Record<string, number>): string => {
      const g = createGames(41, presets[0]!, 0, true, undefined, undefined, undefined, ranks ? { spellRanks: ranks } : {});
      for (let i = 0; i < 1500 && g.phase === 'active'; i++) stepGames(g);
      delete g.player.spellRanks; return stateHash(g.state);
    };
    const waterKeys = spellRankKeys.filter(k => k.includes(':'));
    expect(run(Object.fromEntries(waterKeys.map(k => [k, 1])))).toBe(run());
    expect(run(Object.fromEntries(waterKeys.map(k => [k, 3])))).not.toBe(run());
  });
});

describe('enemy levels: regular enemies only, level 1 = authored HP', () => {
  const enemies = (g: ReturnType<typeof createGames>) => g.state.actors.filter(a => a.enemy);
  it('levels 1, 3 and 6 multiply soldier and creature HP; level 1 is the default', () => {
    for (const wave of [0, 1]) for (const level of [1, 3, maxEnemyLevel]) {
      const g = createGames(5, presets[0]!, wave, true, undefined, undefined, undefined, { enemyLevel: level });
      expect(enemies(g).length).toBeGreaterThan(0);
      for (const a of enemies(g)) {
        const authored = enemyRoster.find(s => s.id === a.enemy!.id)!.hp;
        expect(a.maxHp).toBeCloseTo(authored * progression.enemyLevels.hpMult[level - 1]!, 9);
        expect(a.hp).toBe(a.maxHp);
      }
    }
    expect(stateHash(createGames(5, presets[0]!, 0, true, undefined, undefined, undefined, { enemyLevel: 1 }).state)).toBe(stateHash(createGames(5, presets[0]!, 0, true).state));
    expect(maxEnemyLevel).toBe(6);
  });
  it('named rivals and Water entrants keep their HP at any level; bad levels throw', () => {
    const mageWave = tiro.waves.findIndex(w => w.spawns.some(s => !('enemy' in s)));
    for (const options of [{}, { schoolRivals: 'named' as const }]) {
      const plain = createGames(5, presets[0]!, mageWave, true, undefined, undefined, undefined, options);
      const levelled = createGames(5, presets[0]!, mageWave, true, undefined, undefined, undefined, { ...options, enemyLevel: 6 });
      expect(levelled.state.actors.map(a => a.maxHp)).toEqual(plain.state.actors.map(a => a.maxHp));
    }
    for (const bad of [0, 7, 1.5]) expect(() => createGames(5, presets[0]!, 0, true, undefined, undefined, undefined, { enemyLevel: bad })).toThrow(/enemy level/i);
    expect(() => enemyHpMult(0)).toThrow();
  });
});

describe('canonical states (parity) ignore agility, spell ranks and enemy levels', () => {
  it('every accessor is neutral under balance canonical', () => {
    const state = createArena(1); state.balance = 'canonical';
    const a = schoolMage(state, 'fire', 5); setSpellRanks(a, { fire_lance: 4, 'tide_orb:2': 4 });
    const plain = schoolMage(state, 'fire');
    expect([agilityCastMult(a, state), agilityRecoveryMult(a, state), agilityDrainMult(a, state), agilityPerfectWindowAddS(a, state)]).toEqual([1, 1, 1, 0]);
    expect(fireWindupTicks(a, fireRow('fire_lance'), state)).toBe(fireWindupTicks(plain, fireRow('fire_lance'), state));
    expect(rankedSpell(fireRow('fire_lance'), a, state)).toBe(fireRow('fire_lance'));
    const orb = spells.find(s => s.id === 'tide_orb:2:base')!;
    expect(rankedWaterSpell(orb, a, state)).toBe(orb);
    expect(enemyHpMult(6, state)).toBe(1);
    const g = createGames(5, presets[0]!, 0, true, undefined, undefined, undefined, { balance: 'canonical', enemyLevel: 6 });
    for (const e of g.state.actors.filter(x => x.enemy)) expect(e.maxHp).toBe(enemyRoster.find(s => s.id === e.enemy!.id)!.hp);
  });
  it('a canonical duel with an agile, ranked Fire mage steps exactly as one without', () => {
    const duel = (progressed: boolean): string => {
      const state = createArena(17); state.balance = 'canonical';
      const a = schoolMage(state, 'fire', progressed ? 5 : undefined), b = mage(state, undefined, 1); b.pos = { x: 26, y: 20 };
      if (progressed) setSpellRanks(a, { fire_bolt: 4, fire_lance: 4 });
      for (let i = 0; i < 400; i++) stepArena(state, { [a.id]: { ...idleInput(b.pos), slot: i % 2 ? 0 : 4, cast: true }, [b.id]: { ...idleInput(a.pos), absorb: i % 50 < 20 } });
      delete a.spellRanks; delete a.ranks.agility; return stateHash(state);
    };
    expect(duel(true)).toBe(duel(false));
  });
});

describe('addMage accepts three ranks or four with agility', () => {
  it('validates the optional agility on the shared 1..5 mapping and keeps the key absent when not given', () => {
    const state = createArena(1);
    expect('agility' in addMage(state, 0, { x: 1, y: 1 }).ranks).toBe(false);
    expect(addMage(state, 0, { x: 1, y: 1 }, 'A', ranksAt(5)).ranks.agility).toBe(5);
    for (const agility of [0, 6, 2.5]) expect(() => addMage(state, 0, { x: 1, y: 1 }, 'A', ranksAt(agility))).toThrow(/shared mapping/);
    expect(() => addMage(state, 0, { x: 1, y: 1 }, 'A', { vigor: 1, focus: 1, nerve: 1, guile: 2 } as unknown as Ranks)).toThrow(/shared mapping/);
    expect(() => addMage(state, 0, { x: 1, y: 1 }, 'A', { vigor: 1, focus: 1, agility: 2 } as unknown as Ranks)).toThrow(/shared mapping/);
  });
});
