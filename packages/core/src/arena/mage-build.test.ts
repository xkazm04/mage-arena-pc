import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
// index.ts first: it loads kernel.ts before fire.ts/air.ts (the schools.ts import-order trap).
import { addMage, createArena, createGames, createLab, defaultLabConfig, labBuildProblems, presets, runtime, stateHash, type Games } from './index.ts';
import { rivalBuilds } from './archetypes.ts';
import { compositionRows, mageBuildProblems, ranksAtAverage } from './mage-build.ts';
import { levelMages, opponentSpellRanks, profileSpellRanks } from '../../scripts/week-census.ts';
import { rankedKeys } from '../../scripts/skill-census.ts';

// One mage-build seam (challenge 2026-10-25): the rows, the average-rank rule, sizing, validation and applying a build live in
// mage-build.ts; the Games opponent-mage option is the D1 6.8 lever the census used to apply by hand after spawn.
const seed = runtime.games.censusSeedStart, heavy = rivalBuilds.fire_heavy!;
const games = (opponentMage?: { level?: number; averageRank?: number }): Games =>
  createGames(seed, presets[0], heavy.wave, true, undefined, undefined, undefined, { rivalBuild: 'fire_heavy', ...(opponentMage ? { opponentMage } : {}) });
const rival = (g: Games) => g.state.actors.find(a => a.team !== g.player.team)!;

describe('mage-build: one row list and one average-rank rule', () => {
  it('compositionRows(Rotation) is the bolt then each line at tiers I-IV: the skill census and the week profile agree', () => {
    const rotation = presets.find(p => p.name === runtime.games.referencePreset)!;
    const rows = compositionRows(rotation);
    expect(rows[0]).toBe('bolt:0');
    expect(rows).toEqual(['bolt:0', ...rotation.lines.flatMap(line => [1, 2, 3, 4].map(tier => `${line}:${tier}`))]);
    expect(rows).toHaveLength(13);
    expect(rows).toEqual(rankedKeys);
    expect(rows).toEqual(Object.keys(profileSpellRanks(rotation, 3)));
  });

  it('ranksAtAverage alternates a .5 around the average and never ranks below the authored floor', () => {
    const plain = rival(games()), rows = [heavy.loadout.bolt, ...heavy.loadout.slots];
    const ranked = ranksAtAverage(rows, 2.5, { floor: heavy.spellRanks });
    expect(ranked).toEqual({ fire_pyre: 3, fire_sunfall: 2, fire_wrath: 5, fire_bolt: 3, fire_ring: 2 });
    expect(JSON.stringify(ranked)).toBe(JSON.stringify(opponentSpellRanks(plain, 2.5)));
    expect(ranksAtAverage(rows, 1)).toEqual({});
    expect(ranksAtAverage(rows, 1, { floor: heavy.spellRanks })).toEqual(heavy.spellRanks);
  });
});

describe('createGames opponentMage: the D1 6.8 lever, applied at spawn', () => {
  it('level 3 gives the opponent mage the regular enemies\' week-3 HP, hash for hash with the census\'s post-spawn levelling', () => {
    const plain = rival(games()), levelled = games({ level: 3 }), byHand = games();
    levelMages(byHand, 3, 'level');
    expect(rival(levelled).maxHp).toBeCloseTo(plain.maxHp * 1.2);
    expect(rival(levelled).spellRanks).toEqual(plain.spellRanks);
    expect(stateHash(levelled.state)).toBe(stateHash(byHand.state));
  });

  it('averageRank 5 ranks every row of the build at 5, as the ranked arm does in week 6', () => {
    const ranked = games({ averageRank: 5 }), byHand = games();
    levelMages(byHand, 6, 'ranked');
    expect(rival(ranked).spellRanks).toEqual({ fire_bolt: 5, fire_ring: 5, fire_pyre: 5, fire_sunfall: 5, fire_wrath: 5 });
    expect(stateHash(ranked.state)).toBe(stateHash(byHand.state));
  });

  it('absent, the Games is today\'s; out-of-range levels and ranks are refused', () => {
    expect(stateHash(games().state)).toBe(stateHash(createGames(seed, presets[0], heavy.wave, true, undefined, undefined, undefined, { rivalBuild: 'fire_heavy' }).state));
    expect(stateHash(games({}).state)).toBe(stateHash(games().state));
    expect(() => games({ level: 9 })).toThrow('Invalid enemy level');
    expect(() => games({ averageRank: 0.5 })).toThrow('Invalid opponent mage');
    expect(() => games({ averageRank: 2.3 })).toThrow('Invalid opponent mage');
    expect(() => games({ averageRank: 6 })).toThrow('Invalid opponent mage');
  });
});

describe('Lab builds go through the seam', () => {
  it('an opponent build\'s ranks size HP, mana and stamina as addMage does, with no scratch arena', () => {
    const ranks = { vigor: 5, focus: 5, nerve: 5, agility: 3 };
    const lab = createLab({ ...defaultLabConfig, opponent: 'mage', opponentBuild: { ranks } });
    const opponent = lab.training.dummy, sized = addMage(createArena(), 1, { x: 0, y: 0 }, 'sized', ranks);
    expect([opponent.maxHp, opponent.maxMana, opponent.maxStamina]).toEqual([sized.maxHp, sized.maxMana, sized.maxStamina]);
    expect([opponent.hp, opponent.mana, opponent.stamina]).toEqual([sized.maxHp, sized.maxMana, sized.maxStamina]);
    expect(opponent.ranks).toEqual(ranks);
    expect(readFileSync(new URL('./lab.ts', import.meta.url), 'utf8')).not.toMatch(/addMage\(createArena\(\)/);
  });

  it('labBuildProblems keeps its messages and is the seam\'s validator', () => {
    const bad = { ranks: { vigor: 9, focus: 1, nerve: 1, luck: 1 }, extra: 1, plan: 'nope' };
    expect(labBuildProblems(bad, 'fire', 'Opponent build')).toEqual([
      'Opponent build: unknown key extra.',
      'Opponent build: unknown stat luck.',
      'Opponent build: vigor 9 is not an integer 1..5.',
      'Opponent build: plan nope is not a rival build.',
    ]);
    expect(mageBuildProblems(bad, 'fire', 'Opponent build')).toEqual(labBuildProblems(bad, 'fire', 'Opponent build'));
    expect(labBuildProblems({ level: 3 }, 'water')).toEqual(['Build: unknown key level.']);
    expect(mageBuildProblems({ level: 3 }, 'water', 'Build', { level: true })).toEqual([]);
    expect(mageBuildProblems({ level: 9 }, 'water', 'Build', { level: true })).toEqual(['Build: level 9 is not an integer 1..6.']);
  });
});
