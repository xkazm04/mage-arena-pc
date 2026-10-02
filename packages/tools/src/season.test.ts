import { describe, it, expect } from 'vitest';
import { applyBoutInput, beginTrial, boutHash, campPlayerSnapshot, createCampSession, createSeason, linkBout, prepareBout, startBout, trialTell, type BoutInput } from '@mage/core';
import { createGames, idleInput, presets } from '@mage/core/arena';
import { hash, loadTables } from '@mage/director';
import { fourteenDays, fixtureService, trialPolicy } from './season-fixtures.ts';
const t = loadTables();
describe('W7 season authority', () => {
  it('maps actual camp ranks and carries sickness/fatigue before expiry', () => {
    const s = createCampSession(t); const c = s.camp.characters.cassia; c.sick = true; c.fatigue = 3;
    const snapshot = campPlayerSnapshot(t, s), g = createGames(1, presets[0], 0, false, snapshot);
    expect(g.player.ranks).toEqual({ vigor: 1, focus: 3, nerve: 1 });
    expect(g.player.hp).toBe(g.player.maxHp + t.rules.schemes.poison.nextGamesHp);
    expect(g.player.maxMana).toBe(125); expect(g.player.maxStamina).toBe(44);
    expect(c.sick).toBe(true); expect(() => createGames(1, presets[0], 0, false, { ...snapshot, school: 'fire' as 'water' })).toThrow();
  });
  it('requires the actual Trial location/date and locks rerolls and receipt duplication', () => {
    const service = fixtureService(); expect(() => beginTrial(t, service.session, service.progress)).toThrow();
    service.session.camp.day = 6; service.session.slot = 'dusk'; service.session.location = 'pit';
    service.seasonCommand({ type: 'trial' }, service.session.revision);
    expect(() => service.seasonCommand({ type: 'trial' }, service.session.revision)).toThrow();
    expect(trialTell(service.session, service.progress.trial!)).toBe(trialTell(structuredClone(service.session), structuredClone(service.progress.trial!)));
    service.close();
  });
  it('rejects fabricated checkpoints, duplicate/dropped ticks and wrong bout IDs atomically', () => {
    const service = fixtureService(); service.session.camp.day = 6; service.session.slot = 'dusk'; service.session.location = 'pit'; trialPolicy(service);
    service.session.camp.day = 7; service.session.slot = 'day'; service.session.nightFinished = false;
    service.progress.bout = prepareBout(t, service.session, service.progress, presets[2]!); startBout(service.progress.bout);
    const wire = linkBout(JSON.parse(JSON.stringify(service.progress.bout)));
    expect(wire.games!.player).toBe(wire.games!.state.actors[0]);
    expect(boutHash(wire)).toBe(boutHash(service.progress.bout));
    const b = structuredClone(service.progress.bout), before = hash(service.progress);
    const entry: BoutInput = { type: 'tick', tick: 0, input: idleInput() }; applyBoutInput(b, entry);
    expect(() => service.boutInputs(b.id, [entry], 'fabricated')).toThrow(); expect(hash(service.progress)).toBe(before);
    expect(() => service.boutInputs('wrong', [entry], boutHash(b))).toThrow();
    service.boutInputs(b.id, [entry], boutHash(b));
    expect(() => service.boutInputs(b.id, [entry], boutHash(b))).toThrow();
    expect(() => service.boutInputs(b.id, [{ ...entry, tick: 3 }], boutHash(b))).toThrow();
    expect(() => service.seasonCommand({ type: 'receive' }, service.session.revision)).toThrow(); service.close();
  });
  it('plays fourteen deterministic days with authentic rewards, rumours, social changes and missio', async () => {
    const a = await fourteenDays(), b = await fourteenDays();
    expect(hash({ session: a.session, progress: a.progress })).toBe(hash({ session: b.session, progress: b.progress }));
    expect(a.session.camp.day).toBe(15); expect(a.progress.receipts).toHaveLength(4);
    const bouts = a.progress.receipts.filter(r => r.kind === 'games');
    expect(bouts.map(r => r.result!.kind)).toContain('missio');
    expect(bouts.map(r => r.result!.kind)).toContain('champion');
    expect(bouts.some(r => r.result!.wavesCleared > 0)).toBe(true);
    expect(a.session.camp.characters.cassia.life).toBe('Alive');
    expect(a.session.camp.facts.some(f => f.type === 'rumour' && f.id.startsWith('games:'))).toBe(true);
    expect(bouts.flatMap(r => r.trace).some(v => v.path.includes('/gold'))).toBe(true);
    a.close(); b.close();
  }, 120000);
  it('season creation keeps all schools as real camp characters', () => {
    expect(createSeason().receipts).toEqual([]);
    expect(new Set(t.characters.characters.filter(c => c.role === 'main').map(c => c.school))).toEqual(new Set(['water', 'fire', 'earth', 'air']));
  });
});
