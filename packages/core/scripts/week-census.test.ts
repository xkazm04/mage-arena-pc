import { describe, expect, it } from 'vitest';
// index.ts first: it loads kernel.ts before fire.ts/air.ts (the schools.ts import-order trap).
import { presets, runFight, runtime } from '../src/arena/index.ts';
import profileData from '../src/arena/data/progression-weeks.pc.json' with { type: 'json' };
import { profileSpellRanks, runWeekBuildFight, runWeekFight, weekProfileProblems, weeks } from './week-census.ts';
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
