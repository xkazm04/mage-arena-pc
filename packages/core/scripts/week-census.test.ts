import { describe, expect, it } from 'vitest';
// index.ts first: it loads kernel.ts before fire.ts/air.ts (the schools.ts import-order trap).
import { createGames, presets, runFight, runtime, tiro } from '../src/arena/index.ts';
import { rivalBuildIds, rivalBuilds } from '../src/arena/archetypes.ts';
import profileData from '../src/arena/data/progression-weeks.pc.json' with { type: 'json' };
import { createHash } from 'node:crypto';
import weeksEvidence from '../../../docs/change-requests/evidence/d1-weeks.json' with { type: 'json' };
import lagEvidence from '../../../docs/change-requests/evidence/d1-weeks-arm-lag.json' with { type: 'json' };
import { armOption, levelMages, mageArms, opponentSpellRanks, profileSpellRanks, rivalProfiles, runWeekBuildFight, runWeekFight, weekProfileProblems, weekProfiles, weeks, type MageArm } from './week-census.ts';
import { runBuildFight } from './builds-census.ts';

// The week sweep (D1 4.4) is a reading: these checks pin that its inputs are what the data says and that week 1 of a profile
// at rank 1 is exactly the plain census fight (no enemy level, no ranks).
describe('week sweep (D1 4.4): enemy level = week, profile ranks from data', () => {
  it('the profiles file validates strictly; a short, falling or off-grid profile is refused', () => {
    expect(weekProfileProblems(profileData)).toEqual([]);
    expect(weeks).toEqual([1, 2, 3, 4, 5, 6]);
    expect(weekProfileProblems({ profiles: { short: [1, 2] } })).toEqual(['progression-weeks.pc.json short: needs 6 weeks']);
    expect(weekProfileProblems({ profiles: { falling: [1, 2, 1, 2, 3, 4] } })).toEqual(['progression-weeks.pc.json falling week 3: rank falls']);
    expect(weekProfileProblems({ profiles: { odd: [1, 1.3, 2, 3, 4, 5] } })).toHaveLength(1);
    expect(weekProfileProblems({ profiles: {}, extra: 1 })).toEqual(['progression-weeks.pc.json: unknown key extra']);
  });

  it('an average rank ranks the bolt and every line row; a .5 alternates the two ranks around it', () => {
    const rotation = presets.find(p => p.name === runtime.games.referencePreset)!;
    expect(profileSpellRanks(rotation, 1)).toEqual({});
    const three = profileSpellRanks(rotation, 3);
    expect(Object.keys(three)).toHaveLength(1 + rotation.lines.length * 4);
    expect(new Set(Object.values(three))).toEqual(new Set([3]));
    const half = Object.values(profileSpellRanks(rotation, 2.5));
    expect(half.filter(r => r === 3).length - half.filter(r => r === 2).length).toBe(1);
  });

  it('week 1 at rank 1 is the plain census fight; a later week levels regular enemies only', () => {
    const seed = runtime.games.censusSeedStart;
    expect(runWeekFight(seed, 0, 1, 'untrained').hash).toBe(runFight(seed, 0).hash);
    expect(runWeekFight(seed, 0, 3, 'untrained').durationS).toBeGreaterThan(runFight(seed, 0).durationS);
    // Mage waves and rival builds carry no level: an untrained week-3 fight is the week-1 fight.
    expect(runWeekFight(seed, 2, 3, 'untrained').hash).toBe(runFight(seed, 2).hash);
  }, 60000);

  it('a rival build fight in week 1 at rank 1 is the plain builds-census fight', () => {
    expect(runWeekBuildFight(runtime.games.censusSeedStart, 'fire_close', 1, 'untrained').hash).toBe(runBuildFight(runtime.games.censusSeedStart, 'fire_close').hash);
  }, 60000);
});

// The mage-side arms (D1 6.8) are a reading: opt-in, and with none the sweep is exactly the 6.3 sweep.
describe('week sweep mage-side arms (D1 6.8): opt-in, week 1 untouched', () => {
  const seed = runtime.games.censusSeedStart, arms = Object.keys(mageArms) as MageArm[];

  it('with no arm, week 1 of either profile is the plain census fight on every wave and build, hash for hash', () => {
    expect(weekProfiles).toEqual({ untrained: [1, 1, 1, 1, 1, 1], steady: [1, 1.5, 2.5, 3.5, 4.5, 5] });
    for (const profile of Object.keys(weekProfiles)) {
      tiro.waves.forEach((_, wave) => expect(runWeekFight(seed, wave, 1, profile).hash).toBe(runFight(seed, wave).hash));
      for (const id of rivalBuildIds) expect(runWeekBuildFight(seed, id, 1, profile).hash).toBe(runBuildFight(seed, id).hash);
    }
  }, 120000);

  it('with no arm, a ranked and levelled 6.3 cell still has its d1-weeks.json digest (steady week 4, the final)', () => {
    const cell = weeksEvidence.cells.find(c => c.profile === 'steady' && c.week === 4)!, final = cell.waves[3]!;
    const fights = Array.from({ length: weeksEvidence.countPerCell }, (_, i) => runWeekFight(seed + i, 3, 4, 'steady'));
    expect(createHash('sha256').update(fights.map(f => `${f.seed}:${f.hash}`).join('\n')).digest('hex')).toBe(final.digest);
  }, 120000);

  it('the lag arm rides the createGames opponentMage option and keeps its d1-weeks-arm-lag.json digest (steady week 4, fire_heavy)', () => {
    expect(armOption(4, 'lag')).toEqual({ averageRank: 2.5 });
    expect(armOption(3, 'level')).toEqual({ level: 3 });
    expect(armOption(4, undefined)).toBeUndefined();
    const cell = lagEvidence.cells.find(c => c.profile === 'steady' && c.week === 4)!, build = cell.builds.find(b => b.id === 'fire_heavy')!;
    const fights = Array.from({ length: lagEvidence.countPerCell }, (_, i) => runWeekBuildFight(seed + i, 'fire_heavy', 4, 'steady', 'lag'));
    expect(createHash('sha256').update(fights.map(f => `${f.seed}:${f.hash}`).join('\n')).digest('hex')).toBe(build.digest);
  }, 240000);

  it('rivalProfiles validates like the player profiles; every arm that ranks names one', () => {
    expect(weekProfileProblems({ profiles: {}, rivalProfiles: { short: [1] } })).toEqual(['progression-weeks.pc.json short: needs 6 weeks']);
    for (const arm of Object.values(mageArms)) if ('ranks' in arm) expect(rivalProfiles[arm.ranks]![0]).toBe(1);
  });

  it('every arm leaves week 1 alone, authored build ranks included', () => {
    for (const arm of arms) {
      expect(runWeekFight(seed, 3, 1, 'steady', runtime.games.fightTimeoutS, arm).hash).toBe(runFight(seed, 3).hash);
      expect(runWeekBuildFight(seed, 'fire_heavy', 1, 'steady', arm).hash).toBe(runBuildFight(seed, 'fire_heavy').hash);
    }
  }, 120000);

  it('an arm levels the opponent mage only: its HP by the week, its ranks never below the authored ones', () => {
    const fresh = (week: number, arm: MageArm) => { const g = createGames(seed, presets[0], rivalBuilds.fire_heavy!.wave, true, undefined, undefined, undefined, { rivalBuild: 'fire_heavy' }); levelMages(g, week, arm); return g.state.actors.find(a => a.team !== g.player.team)!; };
    const plain = createGames(seed, presets[0], rivalBuilds.fire_heavy!.wave, true, undefined, undefined, undefined, { rivalBuild: 'fire_heavy' }).state.actors.find(a => a.team !== 0)!;
    expect(fresh(3, 'level').maxHp).toBeCloseTo(plain.maxHp * 1.2);
    expect(fresh(3, 'level').spellRanks).toEqual(plain.spellRanks);
    expect(fresh(3, 'ranked').maxHp).toBe(plain.maxHp);
    expect(fresh(6, 'ranked').spellRanks).toEqual({ fire_bolt: 5, fire_ring: 5, fire_pyre: 5, fire_sunfall: 5, fire_wrath: 5 });
    expect(opponentSpellRanks(plain, 2.5).fire_wrath).toBe(5);
    // Regular-enemy waves carry no mage: an armed week-3 wave 1 is the unarmed one.
    for (const arm of arms) expect(runWeekFight(seed, 0, 3, 'steady', runtime.games.fightTimeoutS, arm).hash).toBe(runWeekFight(seed, 0, 3, 'steady').hash);
  }, 120000);
});
