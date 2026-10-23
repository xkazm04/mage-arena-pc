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
// Re-pinned W8 lane X (2026-10-23): AI mage reaction delays now run at the mage's pace (mage-ai.ts); lab7331 is unpaced and kept.
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
  games40000: { draws: 198, hashes: [
    '7af6e5ee','74f4bcf1','fbc508e1','1ecdc2ea','02983e10','363562a3','4a5161ed','782d4f37','fb250617','49111973',
    '0f602cac','0b31069b','9cd28f96','ac82fd31','5874ba5b','a8c62faa','947b21dc','afd22d32','cb62023f','8bb2bad4',
  ] },
  soldiers40000: { draws: 98, hashes: [
    'dfee6260','ac2a9865','e2518e73','795923e8','b3ad1ee3','45d496d8','ee4882b2','2bc0839a','b5e0132c','88774c7b',
    '54841063','8ed8cf59','8cc0080a','877f5f52','266a9ae6','db3147ff','1818b826','5dd922de','eb6ffe37','ca8e3eed',
  ] },
  hardSoldiers40000: { draws: 95, hashes: [
    'efb470fb','453e75af','8ec65898','63baa567','01ae1b1d','642c78c3','765eda3f','56d3c361','03d712e3','6d80b7f4',
    '8a52b726','db03e2e9','5653c56f','cb069c83','0f71b131','908921aa','31e6ad2b','1b04a5a9','8db878cf','9aebc595',
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
