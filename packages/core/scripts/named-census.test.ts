import { describe, expect, it } from 'vitest';
// index.ts first: it loads kernel.ts before fire.ts/air.ts (the schools.ts import-order trap).
import { createGames, presets, runtime, stepGames } from '../src/arena/index.ts';
import balance from '../src/arena/data/school-balance.pc.json' with { type: 'json' };
import { balancedSpell, canonicalSpells, identityNumber, schoolSpellById, slotSpell } from '../src/arena/schools.ts';
import { namedWaves, runNamedFight, summariseNamedWave, winRateTarget } from './named-census.ts';

const reference = () => presets.find(p => p.name === runtime.games.referencePreset)!;
const named = (wave: number, balanceMode?: 'canonical') => {
  const g = createGames(runtime.games.censusSeedStart, reference(), wave, true, undefined, undefined, undefined, { schoolRivals: 'named', ...(balanceMode ? { balance: balanceMode } : {}) });
  return { g, rival: g.state.actors.find(a => a.schoolState !== undefined)! };
};
const overrides: Record<string, number> = balance.overrides;
/** Plant overlay keys for one body, then restore the file's own (schools.ts reads this same object at every call). */
function planted<T>(keys: Record<string, number>, body: () => T): T {
  const saved = { ...overrides };
  Object.assign(overrides, keys);
  try { return body(); } finally { for (const k of Object.keys(overrides)) delete overrides[k]; Object.assign(overrides, saved); }
}

describe('W8 lane B: the named duels play the PC overlay', () => {
  it('the named rivals read every overlay key; a canonical (parity) state reads VR numbers', () => {
    const fire = named(2), air = named(3), parity = named(2, 'canonical');
    expect(fire.rival.label).toBe('Brennic'); expect(air.rival.label).toBe('Lio');
    for (const [key, value] of Object.entries(overrides)) {
      const [id, column] = key.split('.') as [string, 'damage'];
      const state = schoolSpellById(id)!.school === 'fire' ? fire.g.state : air.g.state;
      expect(balancedSpell(schoolSpellById(id)!, state)[column], key).toBe(value);
      expect(balancedSpell(schoolSpellById(id)!, parity.g.state)[column], `${key} canonical`).toBe(canonicalSpells[schoolSpellById(id)!.school].find(s => s.id === id)![column]);
    }
    // The bolt slot the rival AI presses (slotSpell) carries the overlay; the parity state does not.
    expect(slotSpell(fire.rival, 0, fire.g.state)!.damage).toBe(overrides['fire_bolt.damage']);
    expect(slotSpell(parity.rival, 0, parity.g.state)!.damage).toBe(canonicalSpells.fire[0]!.damage);
  });

  it('a planted override reaches play: the darts Brennic and Lio release carry the planted damage', () => {
    // Every Heat band at x1 so the planted dart damage reaches the projectile unchanged.
    const keys = { 'fire_bolt.damage': 0.75, 'air_bolt.damage': 0.5, 'fire.identity.thresholds.0.spellDamageMult': 1, 'fire.identity.thresholds.1.spellDamageMult': 1 };
    planted(keys, () => {
      for (const [wave, damage] of [[2, 0.75], [3, 0.5]] as const) {
        const { g, rival } = named(wave);
        expect(identityNumber('fire', 'thresholds.1.spellDamageMult', g.state)).toBe(1);
        const seen = new Set<number>();
        for (let t = 0; t < 900 && g.phase === 'active'; t++) {
          stepGames(g);
          for (const p of g.state.projectiles) if (p.ownerId === rival.id && p.bolt && !p.reflected) { seen.add(p.id); expect(p.damage).toBe(damage); }
        }
        expect(seen.size, `wave ${wave} darts`).toBeGreaterThan(5);
      }
    });
  });

  // The claim the full census (docs/waves/W8-evidence/named*.json) makes, pinned on the first 100 census seeds per duel.
  // Since WP2 (spark combat-system-depth) Brennic and Lio play their authored builds (rival-builds.json: fire close, air light).
  // Lio's final sits in its band with the win rate in range. Brennic's semifinal used to end in a median of ~16 s (the brawler
  // fights at ~4.5 m where both sides landed nearly every blow); since D1's exchange windows (exchange.ts, 2026-10-24) a run of
  // close blows stops paying in full after the first and the 2000-seed semifinal sits in band too (median 63.0 s, 44.6 % wins;
  // D1 section 6).
  it('100 seeds per named duel: win rate in range, both duels in band, census rules hold', () => {
    const results = namedWaves.map(wave => summariseNamedWave(Array.from({ length: 100 }, (_, i) => runNamedFight(runtime.games.censusSeedStart + i, wave)), wave));
    for (const r of results) {
      expect(r.winRate, `wave ${r.wave} win rate`).toBeGreaterThanOrEqual(winRateTarget[0]);
      expect(r.winRate, `wave ${r.wave} win rate`).toBeLessThanOrEqual(winRateTarget[1]);
      expect(r.failures.timeoutRate).toBe(false); expect(r.failures.earlyDowns).toEqual([]); expect(r.failures.invalidStates).toEqual([]);
      expect(r.phases.reachedPhase2).toBeGreaterThan(0.9);
    }
    const [semifinal, final] = results as [typeof results[0], typeof results[0]];
    expect(final.rival).toBe('Lio'); expect(final.failures.medianOutOfBand).toBe(false); expect(final.passed).toBe(true);
    expect(semifinal.rival).toBe('Brennic'); expect(semifinal.failures.medianOutOfBand).toBe(false);
  }, 120000);
});
