import { afterAll, describe, it, expect } from 'vitest';
import { applyBoutInput, beginTrial, boutHash, boutSpellRanks, bridgeRules, buySeasonRank, campPlayerSnapshot, createCampSession, createSeason, linkBout, nextRankCost, prepareBout, replayBout, schoolRankKeys, startBout, trialTell, type BoutInput } from '@mage/core';
import { createGames, idleInput, presets } from '@mage/core/arena';
import { hash, loadTables } from '@mage/director';
import { campDay, fourteenDays, fixtureService, removeFixtureDirs, trialPolicy } from './season-fixtures.ts';
import { SeasonPolicy } from './season-policy.ts';
afterAll(removeFixtureDirs);
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
    service.session.camp.day = 6; service.session.slot = 'dusk'; service.session.hour = t.season.trialHour; service.session.location = 'pit';
    service.seasonCommand({ type: 'trial' }, service.session.revision);
    expect(() => service.seasonCommand({ type: 'trial' }, service.session.revision)).toThrow();
    expect(trialTell(service.session, service.progress.trial!)).toBe(trialTell(structuredClone(service.session), structuredClone(service.progress.trial!)));
    service.close();
  });
  it('rejects fabricated checkpoints, duplicate/dropped ticks and wrong bout IDs atomically', () => {
    const service = fixtureService(); service.session.camp.day = 6; service.session.slot = 'dusk'; service.session.hour = t.season.trialHour; service.session.location = 'pit'; trialPolicy(service);
    service.session.camp.day = 7; service.session.slot = 'day'; service.session.hour = t.season.gamesHour; service.session.nightFinished = false;
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
  it('sets regular enemies to the campaign week and replays it (owner 2026-10-23)', () => {
    const service = fixtureService(); service.session.camp.day = 6; service.session.slot = 'dusk'; service.session.hour = t.season.trialHour; service.session.location = 'pit'; trialPolicy(service);
    service.session.camp.day = 7; service.session.slot = 'day'; service.session.hour = t.season.gamesHour; service.session.nightFinished = false;
    const week1 = prepareBout(t, service.session, service.progress, presets[2]!);
    expect('enemyLevel' in week1).toBe(false);
    const week2 = { ...structuredClone(week1), enemyLevel: 2 }, base = structuredClone(week1);
    startBout(week2); startBout(base);
    const foes = (b: typeof base) => b.games!.state.actors.filter(a => a.team !== 0).map(a => a.maxHp);
    expect(foes(week2)).not.toEqual(foes(base));
    for (const b of [week2, base]) applyBoutInput(b, { type: 'tick', tick: 0, input: idleInput() });
    const replay = replayBout(week2); expect(replay.enemyLevel).toBe(2); expect(boutHash(replay)).toBe(boutHash(week2));
    service.close();
  });
  it('records the bought spell ranks on the bout and replays them exactly (skill book, D1 4.3)', () => {
    const service = fixtureService(); service.session.camp.day = 6; service.session.slot = 'dusk'; service.session.hour = t.season.trialHour; service.session.location = 'pit'; trialPolicy(service);
    service.session.camp.day = 7; service.session.slot = 'day'; service.session.hour = t.season.gamesHour; service.session.nightFinished = false;
    // Flag off (the file's default): no book on the season, no key on the bout.
    expect('skills' in service.progress).toBe(false);
    expect('spellRanks' in prepareBout(t, service.session, service.progress, presets[2]!)).toBe(false);
    // A book with nothing bought adds no key either.
    expect('spellRanks' in prepareBout(t, service.session, { ...service.progress, skills: createSeason(true).skills }, presets[2]!)).toBe(false);
    const skills = { points: 0, earned: 44, ranks: { 'bolt:0': 2, 'lash:1': 2 }, taught: [] };
    const ranked = prepareBout(t, service.session, { ...service.progress, skills }, presets[2]!);
    expect(ranked.spellRanks).toEqual(skills.ranks);
    const base = prepareBout(t, service.session, service.progress, presets[2]!);
    startBout(ranked); startBout(base);
    expect(ranked.games!.player.spellRanks).toEqual(skills.ranks);
    expect(base.games!.player.spellRanks).toBeUndefined();
    // The reference policy casts, so the bought ranks change what the bout plays.
    for (const b of [ranked, base]) {
      const policy = new SeasonPolicy();
      for (let i = 0; i < 900 && b.phase !== 'terminal'; i++) {
        const g = b.games!;
        applyBoutInput(b, g.phase === 'intermission' ? { type: 'advance', tick: g.state.tick } : { type: 'tick', tick: g.state.tick, input: policy.frame(g) });
      }
    }
    expect(boutHash(ranked)).not.toBe(boutHash(base));
    const replay = replayBout(JSON.parse(JSON.stringify(ranked)));
    expect(replay.spellRanks).toEqual(skills.ranks); expect(boutHash(replay)).toBe(boutHash(ranked));
    expect(boutHash(replayBout(base))).toBe(boutHash(base));
    service.close();
  });
  it('a flag-on season banks camp days into the book and each Games morning bout gets boutSpellRanks of that morning', async () => {
    const service = fixtureService(); service.progress = createSeason(true);
    const keys = schoolRankKeys('water'), mornings: { day: number; ranks: Record<string, number> }[] = [];
    const spend = () => {
      for (;;) {
        const book = service.progress.skills!, costs = keys.map(key => ({ key, cost: nextRankCost(book, key) })).filter(o => o.cost !== null && o.cost <= book.points);
        if (!costs.length) return;
        service.progress = buySeasonRank(service.session, service.progress, costs.reduce((a, b) => (b.cost! < a.cost! ? b : a)).key);
      }
    };
    while (service.session.camp.day <= 14) {
      const view = service.view(), earned = service.progress.skills!.earned;
      if (view.day.eve) {
        if (service.session.location !== 'yard') await service.command({ type: 'travel', place: 'yard' }, service.session.revision);
        const train = service.view().actions.find(a => a.intent === 'TRAIN');
        await service.command(train ? { type: 'act', action: train.id } : { type: 'wait' }, service.session.revision);
        if (service.session.slot === 'day') await service.command({ type: 'wait' }, service.session.revision);
        await service.command({ type: 'travel', place: 'pit' }, service.session.revision);
        trialPolicy(service);
      } else if (view.day.games) {
        service.seasonCommand({ type: 'prepare', composition: presets[2]! }, service.session.revision);
        const bout = service.progress.bout!, expected = boutSpellRanks(service.progress.skills!, true);
        expect(expected).toBeDefined();
        expect(bout.spellRanks).toEqual(expected);
        expect(() => buySeasonRank(service.session, service.progress, 'bolt:0')).toThrow('Ranks are fixed');
        service.seasonCommand({ type: 'start' }, service.session.revision);
        expect(service.progress.bout!.games!.player.spellRanks).toEqual(expected);
        mornings.push({ day: view.day.day, ranks: expected! });
        const policy = new SeasonPolicy();
        while (service.progress.bout!.phase !== 'terminal') {
          const local = structuredClone(service.progress.bout!), entries: BoutInput[] = [];
          for (let i = 0; i < bridgeRules.limits.batchTicks && local.phase !== 'terminal'; i++) {
            const g = local.games!;
            const entry: BoutInput = g.phase === 'intermission' ? { type: 'advance', tick: g.state.tick } : { type: 'tick', tick: g.state.tick, input: view.day.day === 14 ? idleInput() : policy.frame(g) };
            applyBoutInput(local, entry); entries.push(entry);
          }
          service.boutInputs(local.id, entries, boutHash(local));
        }
        service.seasonCommand({ type: 'receive' }, service.session.revision);
      }
      await campDay(service);
      expect(service.progress.skills!.earned).toBeGreaterThan(earned);
      spend();
    }
    expect(mornings.map(m => m.day)).toEqual([7, 14]);
    const [first, second] = mornings.map(m => Object.values(m.ranks).reduce((a, b) => a + b, 0));
    expect(second).toBeGreaterThan(first!);
    service.close();
  }, 120000);
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
