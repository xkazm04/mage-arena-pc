import { describe, expect, it } from 'vitest';
import { censusForecast, createGames, defaultLabConfig, drain, duelForecast, forecastDeltas, isCurrentTuning, makeTuning, presets, runFight, tiro } from './index.ts';

describe('census forecast for a Lab tuning', () => {
  it('omitting the tuning leaves the state untouched; a passed tuning is validated and carried', () => {
    expect(createGames(40000, presets[2]!, 0, true).state.tuning).toBeUndefined();
    expect(createGames(40000, presets[2]!, 0, true, undefined, makeTuning('Heavier')).state.tuning).toEqual(makeTuning('Heavier'));
    expect(() => createGames(40000, presets[2]!, 0, true, undefined, { ...makeTuning(), walkMps: 99 })).toThrow(/walkMps/);
    const poised = createGames(40000, presets[2]!, 3, true, undefined, { ...makeTuning(), playerPoise: 2, opponentPoise: 3 });
    expect(poised.player.poise).toBe(2); expect(poised.state.actors.filter(a => a.team !== 0).every(a => a.poise === 3)).toBe(true);
  });
  it('an explicit Current tuning fights exactly like the census path (only the hash, which includes state.tuning, differs)', () => {
    for (let wave = 0; wave < tiro.waves.length; wave++) for (const seed of [40000, 40001]) {
      const { hash: a, ...base } = runFight(seed, wave), { hash: b, ...explicit } = runFight(seed, wave, undefined, makeTuning());
      expect(explicit).toEqual(base); expect(b).not.toBe(a);
    }
  });
  it('recognises Current and routes it to the untouched census path', () => {
    expect(isCurrentTuning(makeTuning())).toBe(true);
    expect(isCurrentTuning(makeTuning('Snappier'))).toBe(false);
    expect(isCurrentTuning({ ...makeTuning(), spells: { 'bolt:0:base': { castS: 0.3, cooldownS: 0, speedMps: 20 } } })).toBe(false);
    const [w] = drain(censusForecast(makeTuning(), 1));
    expect(w!.fights[0]!.hash).toBe(runFight(40000, 0).hash);
    expect(() => drain(censusForecast(undefined, 0))).toThrow();
  });
  it('summarises duels and deltas from the same loop the CF2 report uses', () => {
    const duel = drain(duelForecast(makeTuning(), { lab: defaultLabConfig, duels: 2, competence: 3, capS: 120 }));
    expect(duel.duels).toBe(2); expect(duel.winRate).toBeGreaterThanOrEqual(0);
    const waves = drain(censusForecast(undefined, 2));
    expect(forecastDeltas(waves, waves).every(d => d.winRateDelta === 0 && d.perfectRateDelta === 0 && d.medianDeltaS === 0)).toBe(true);
  }, 60000);
});
