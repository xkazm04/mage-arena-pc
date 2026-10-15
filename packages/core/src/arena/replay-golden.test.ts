import { describe, expect, it } from 'vitest';
import { createGames, presets, runtime, stateHash, stepGames, ticks } from './index.ts';
import { createLab, defaultLabConfig, stepLab } from './lab.ts';
import { idleInput } from './types.ts';

// Replay tests elsewhere compare replay(seed) with replay(seed) inside one process, which
// cannot see a dependence on the host: an environment branch, an engine's math, data read
// differently. These sequences are pinned in the repository, so the same seed must produce
// the same hashes on every machine and Node version. Each scenario must draw from the seeded
// RNG, or it says nothing about randomness.
//
// An intended combat, tuning or data change rehashes these. Re-run, check the change is the
// one you meant, and paste the printed values into GOLDEN with the change that caused them.

// games40000 is the semifinal (mages only); soldiers40000 is the conscript and slinger wave, so it pins
// committed-body lunges as well as the seeded spawn jitter and reference-player draws.
function games(seed: number, wave = 2) {
  const g = createGames(seed, presets.find(p => p.name === runtime.games.referencePreset)!, wave, true);
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
  games40000: { draws: 218, hashes: [
    '11b47c3a','a3d93533','8f66dbce','831bb253','906e6e3a','5844b2c7','b5caf3ac','02f61022','cb57787d','429731e9',
    'b0390189','36f44cbc','95151f55','0688e97c','29c5c2b7','e7e6e97d','96e8c2fd','bcb93b82','335651a3','e08cd578',
  ] },
  soldiers40000: { draws: 105, hashes: [
    'bcecb066','92220c18','44f11cf8','750b72d1','6ce92851','d9ef52ee','16d4195c','e92551e7','5fb39e16','2c84c613',
    'f95cbb53','325c21c9','b1ee40bb','e3420cac','81a4494a','b0b2d3af','470e7afd','b0de9fa2','44767412','13e1a3a2',
  ] },
  lab7331: { draws: 50, hashes: ['9bb9ebaf','4b79f57b','611e272c','823401be','ba0de3cd','f91276a3'] },
};

describe('golden replay', () => {
  it.each([
    ['games40000', () => games(40000)],
    ['soldiers40000', () => games(40000, 0)],
    ['lab7331', () => lab(7331)],
  ] as const)('%s replays the pinned hashes', (name, run) => {
    const actual = run();
    expect(actual.draws, `${name} must exercise the seeded RNG`).toBeGreaterThan(0);
    expect(actual, `${name} replay changed; if intended, pin:\n${JSON.stringify(actual)}`).toEqual(GOLDEN[name]);
  });
});
