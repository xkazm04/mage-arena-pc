import { describe, expect, it } from 'vitest';
import { createGames, presets, runtime, stateHash, stepGames, ticks } from './index.ts';
import { createLab, defaultLabConfig, stepLab } from './lab.ts';
import { idleInput, type Difficulty } from './types.ts';

// Replay tests elsewhere compare replay(seed) with replay(seed) inside one process, which
// cannot see a dependence on the host: an environment branch, an engine's math, data read
// differently. These sequences are pinned in the repository, so the same seed must produce
// the same hashes on every machine and Node version. Each scenario must draw from the seeded
// RNG, or it says nothing about randomness.
//
// An intended combat, tuning or data change rehashes these. Re-run, check the change is the
// one you meant, and paste the printed values into GOLDEN with the change that caused them.

// games40000 is the semifinal (mages only); soldiers40000 is the conscript and slinger wave, so it pins
// committed-body lunges as well as the seeded spawn jitter and reference-player draws. Both run at the default
// difficulty; hardSoldiers40000 replays the soldiers at Hard, where both windups sit on their warning floor.
function games(seed: number, wave = 2, difficulty?: Difficulty) {
  const g = createGames(seed, presets.find(p => p.name === runtime.games.referencePreset)!, wave, true, undefined, undefined, difficulty);
  const hashes: string[] = [];
  for (let i = 1; i <= ticks(20) && g.phase === 'active'; i++) { stepGames(g); if (i % 60 === 0) hashes.push(stateHash(g.state)); }
  return { draws: g.state.randomLog.length, hashes };
}

function lab(seed: number) {
  const l = createLab({ ...defaultLabConfig, opponent: 'mage', seed });
  const hashes: string[] = [];
  for (let i = 1; i <= ticks(6); i++) { stepLab(l, idleInput(l.training.dummy.pos)); if (i % 60 === 0) hashes.push(stateHash(l.training.state)); }
  return { draws: l.training.state.randomLog.length, hashes };
}

const GOLDEN = {
  games40000: { draws: 195, hashes: [
    'b8e06d71','f42f9761','bbf44b67','a2cceef1','50eb6755','25973e47','ef88e8b0','80098a5f','51a44bc3','69dc5370',
    'd13f38f3','3f4c9acb','4432d709','774eec4f','3c4d6ba9','56893df7','6b9b3526','f5b8a67f','85513d3b','419d8e08',
  ] },
  soldiers40000: { draws: 104, hashes: [
    'dfee6260','ac2a9865','e2518e73','795923e8','b3ad1ee3','45d496d8','25a18120','c4168e50','df0fc231','7fd16ab0',
    '80e49a92','6f7d68ae','4484f2f8','11a875c3','a0eb0c2e','bcc8a490','104785bc','11f55a5d','25ed4e47','448cca72',
  ] },
  hardSoldiers40000: { draws: 94, hashes: [
    'efb470fb','4786a702','f8d5ae73','a7e1e578','db0ae87e','69f69461','1c7bb07e','c97f0a5a','4f1d3589','4670bde3',
    '9b8e5996','1807f814','0d5f0485','69aaca01','402b0b39','0b52f34f','fa5e5bb4','cf42fbf3','761728bf','91fb0463',
  ] },
  lab7331: { draws: 44, hashes: ['a4aa3649','8a63458e','f371651c','239c3da9','eb692769','c35c3394'] },
};

describe('golden replay', () => {
  it.each([
    ['games40000', () => games(40000)],
    ['soldiers40000', () => games(40000, 0)],
    ['hardSoldiers40000', () => games(40000, 0, 'hard')],
    ['lab7331', () => lab(7331)],
  ] as const)('%s replays the pinned hashes', (name, run) => {
    const actual = run();
    expect(actual.draws, `${name} must exercise the seeded RNG`).toBeGreaterThan(0);
    expect(actual, `${name} replay changed; if intended, pin:\n${JSON.stringify(actual)}`).toEqual(GOLDEN[name]);
  });
});
