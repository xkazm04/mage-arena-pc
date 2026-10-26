import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bridgeRules, buySeasonRank, createSeason, maxSeasonPoints, prepareBout, trialTell, type SkillBook, type TrialStance } from '@mage/core';
import { maxSpellRank, presets } from '@mage/core/arena';
import { CostGuard } from './budget.ts';
import { hash, RequestCache } from './cache.ts';
import { loadTables } from './data.ts';
import { PlannerProvider } from './providers.ts';
import { decodeSave, encodeSave, restoreSave, validatePayload } from './save.ts';
import { SeasonService } from './season-service.ts';

// The skill book on the season save (D1 4.3): an optional key, bounded tightly, that leaves a save without it as it was.
const flagOffPayloadHash = '7e14d753ad00f69bfd8c4e652ed60c50d44d29104f4bb5df189e80f3c99dc635';
const t = loadTables(), dirs: string[] = [];
afterAll(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });
function service() {
  const dir = mkdtempSync(join(tmpdir(), 'mage-skills-')); dirs.push(dir);
  const s: SeasonService = new SeasonService(t, {
    provider: new PlannerProvider(t, () => s.session.camp),
    cache: new RequestCache(join(dir, 'cache')), guard: new CostGuard(join(dir, 'ledger'), 'test', 'planner', 0, 0),
  });
  return s;
}
/** A flag-on season with points earned and two ranks bought, the way the player's door buys them. */
function booked() {
  const s = service();
  s.progress = { ...createSeason(true), skills: { points: 60, earned: 60, ranks: {}, taught: [] } };
  s.progress = buySeasonRank(s.session, buySeasonRank(s.session, s.progress, 'bolt:0'), 'lash:1');
  return s;
}
/** The same season on its first Games morning, the bout prepared (the season.test.ts enemyLevel setup). */
function preparedBout(flagOff = false) {
  const s = flagOff ? service() : booked(); s.session.camp.day = 6; s.session.slot = 'dusk'; s.session.hour = t.season.trialHour; s.session.location = 'pit';
  s.seasonCommand({ type: 'trial' }, s.session.revision);
  while (s.progress.trial!.phase === 'active') {
    const tell = trialTell(s.session, s.progress.trial!);
    s.seasonCommand({ type: 'exchange', stance: Object.entries(bridgeRules.trial.beats).find(([, v]) => v === tell)![0] as TrialStance }, s.session.revision);
  }
  s.seasonCommand({ type: 'receive-trial' }, s.session.revision);
  s.session.camp.day = 7; s.session.slot = 'day'; s.session.hour = t.season.gamesHour; s.session.nightFinished = false;
  s.seasonCommand({ type: 'prepare', composition: presets[2]! }, s.session.revision);
  return s;
}
const logical = (s: SeasonService) => JSON.parse(JSON.stringify({ camp: s.checkpointCamp(), progress: s.progress })) as { progress: { skills: SkillBook; bout: Record<string, unknown> } };

describe('skill book on the season save', () => {
  it('a season started with the flag off writes no key, and its save loads as before', () => {
    const s = service();
    expect('skills' in s.progress).toBe(false);
    expect('skills' in encodeSave(s).payload.progress).toBe(false);
    expect(() => validatePayload(t, logical(s))).not.toThrow();
    s.close();
  });
  it('round trips the book and a bout carrying its ranks exactly', () => {
    for (const original of [booked(), preparedBout()]) {
      const loaded = service();
      restoreSave(loaded, decodeSave(t, JSON.stringify(encodeSave(original))));
      expect(loaded.progress.skills).toEqual(original.progress.skills);
      expect(loaded.progress.skills).toEqual({ points: 60 - 20 - 22, earned: 60, ranks: { 'bolt:0': 2, 'lash:1': 2 }, taught: [] });
      expect(loaded.progress.bout?.spellRanks).toEqual(original.progress.bout ? { 'bolt:0': 2, 'lash:1': 2 } : undefined);
      expect(hash(encodeSave(loaded).payload)).toBe(hash(encodeSave(original).payload));
      original.close(); loaded.close();
    }
  });
  it('a loaded season banks its settled day as the live one does', async () => {
    const s = service(); s.progress = createSeason(true);
    await s.command({ type: 'travel', place: 'yard' }, s.session.revision);
    await s.command({ type: 'act', action: s.view().actions.find(a => a.intent === 'TRAIN')!.id }, s.session.revision);
    while (s.session.slot !== 'night' || !s.session.nightFinished) await s.command({ type: 'wait' }, s.session.revision);
    const loaded = service(), copy = service();
    restoreSave(copy, decodeSave(t, JSON.stringify(encodeSave(s))));
    await s.command({ type: 'dawn' }, s.session.revision);
    expect(s.session.camp.day).toBe(2);
    expect(s.progress.skills!.earned).toBe(2);
    copy.paused = false;
    await copy.command({ type: 'dawn' }, copy.session.revision);
    restoreSave(loaded, decodeSave(t, JSON.stringify(encodeSave(copy))));
    expect(loaded.progress.skills).toEqual(s.progress.skills);
    s.close(); loaded.close(); copy.close();
  });
  it('a save taken mid-dawn banks the settled day once, live and on load', async () => {
    const s = service(); s.progress = createSeason(true);
    await s.command({ type: 'travel', place: 'yard' }, s.session.revision);
    await s.command({ type: 'act', action: s.view().actions.find(a => a.intent === 'TRAIN')!.id }, s.session.revision);
    while (s.session.slot !== 'night' || !s.session.nightFinished) await s.command({ type: 'wait' }, s.session.revision);
    const dawn = s.command({ type: 'dawn' }, s.session.revision);
    const envelope = encodeSave(s);
    expect(envelope.payload.camp.pendingDawn).toBe(true);
    expect(envelope.payload.progress.skills!.earned).toBe(0);
    await dawn;
    expect(s.session.camp.day).toBe(2); expect(s.progress.skills!.earned).toBe(2);
    const loaded = service();
    restoreSave(loaded, decodeSave(t, JSON.stringify(envelope)));
    expect(loaded.session.camp.day).toBe(2); expect(loaded.progress.skills).toEqual(s.progress.skills);
    s.close(); loaded.close();
  });
  const refuse = (s: SeasonService, patch: (p: ReturnType<typeof logical>['progress']) => void, message: string) => {
    const value = logical(s); patch(value.progress);
    expect(() => validatePayload(t, value)).toThrow(message);
  };
  it('refuses each out-of-bounds book', () => {
    const s = booked(), schema = 'Save schema rejected', book = 'Save skill book is inconsistent';
    refuse(s, p => { p.skills.points = -1; }, schema);
    refuse(s, p => { p.skills.points = 1.5; }, schema);
    refuse(s, p => { p.skills.points = maxSeasonPoints + 1; }, schema);
    refuse(s, p => { p.skills.earned = maxSeasonPoints + 1; }, schema);
    refuse(s, p => { p.skills.ranks['mud:9'] = 2; }, schema);
    refuse(s, p => { p.skills.ranks['bolt:0'] = 1; }, schema);
    refuse(s, p => { p.skills.ranks['bolt:0'] = maxSpellRank + 1; }, schema);
    refuse(s, p => { p.skills.taught = ['earth_quake']; }, schema);
    refuse(s, p => { p.skills.taught = ['air_tempest', 'air_tempest']; }, schema);
    refuse(s, p => { (p.skills as unknown as Record<string, unknown>).bonus = 1; }, schema);
    refuse(s, p => { delete (p.skills as Partial<SkillBook>).taught; }, schema);
    // Shape-valid but not a book the player could hold.
    refuse(s, p => { p.skills.points += 1; }, `${book}: points spent differ from the ranks bought`);
    refuse(s, p => { p.skills.points = p.skills.earned + 1; }, `${book}: more points unspent than earned`);
    refuse(s, p => { p.skills.ranks.fire_sunfall = 2; }, `${book}: rank in fire_sunfall, a spell the player does not know`);
    s.close();
  });
  // D1 6.12: a flag-on bout carries opponentMage { averageRank } and rankDefence { hpPerRankStep }, each optional and bounded.
  const lever = (s: SeasonService) => s.progress.bout as unknown as { opponentMage: { averageRank: number }; rankDefence: { hpPerRankStep: number } };
  it('round trips a bout carrying both levers exactly', () => {
    const original = preparedBout(), loaded = service();
    expect(lever(original).opponentMage).toEqual({ averageRank: 1 });
    expect(lever(original).rankDefence).toEqual({ hpPerRankStep: 0.05 });
    restoreSave(loaded, decodeSave(t, JSON.stringify(encodeSave(original))));
    expect(lever(loaded).opponentMage).toEqual(lever(original).opponentMage);
    expect(lever(loaded).rankDefence).toEqual(lever(original).rankDefence);
    expect(hash(encodeSave(loaded).payload)).toBe(hash(encodeSave(original).payload));
    original.close(); loaded.close();
  });
  it('a flag-off bout writes neither lever and saves byte for byte as before', () => {
    const original = preparedBout(true), text = JSON.stringify(encodeSave(original).payload);
    expect(text).not.toMatch(/opponentMage|rankDefence/);
    // Pinned from the unchanged schema (the commit before the schema fix).
    expect(hash(encodeSave(original).payload)).toBe(flagOffPayloadHash);
    const loaded = service();
    restoreSave(loaded, decodeSave(t, JSON.stringify(encodeSave(original))));
    expect(JSON.stringify(encodeSave(loaded).payload)).toBe(text);
    original.close(); loaded.close();
  });
  it('refuses each out-of-bounds lever, and levers that are not the season\'s', () => {
    const s = preparedBout(), at = (key: string, message: string) => `Save schema rejected: /progress/bout/${key} ${message}`;
    const set = (p: ReturnType<typeof logical>['progress'], key: 'opponentMage' | 'rankDefence', value: unknown) => { p.bout[key] = value; };
    refuse(s, p => set(p, 'opponentMage', { averageRank: 0.5 }), at('opponentMage/averageRank', 'must be >= 1'));
    refuse(s, p => set(p, 'opponentMage', { averageRank: maxSpellRank + 0.5 }), at('opponentMage/averageRank', `must be <= ${maxSpellRank}`));
    refuse(s, p => set(p, 'opponentMage', { averageRank: 1.25 }), at('opponentMage/averageRank', 'must be multiple of 0.5'));
    refuse(s, p => set(p, 'opponentMage', { averageRank: null }), at('opponentMage/averageRank', 'must be number'));
    refuse(s, p => set(p, 'opponentMage', {}), at('opponentMage', 'must have required property'));
    refuse(s, p => set(p, 'opponentMage', { averageRank: 1, level: 2 }), at('opponentMage', 'must NOT have additional properties'));
    refuse(s, p => set(p, 'rankDefence', { hpPerRankStep: 0 }), at('rankDefence/hpPerRankStep', 'must be > 0'));
    refuse(s, p => set(p, 'rankDefence', { hpPerRankStep: -0.05 }), at('rankDefence/hpPerRankStep', 'must be > 0'));
    refuse(s, p => set(p, 'rankDefence', { hpPerRankStep: 1.01 }), at('rankDefence/hpPerRankStep', 'must be <= 1'));
    refuse(s, p => set(p, 'rankDefence', { hpPerRankStep: '0.05' }), at('rankDefence/hpPerRankStep', 'must be number'));
    refuse(s, p => set(p, 'rankDefence', { hpPerRankStep: 0.05, bonus: 1 }), at('rankDefence', 'must NOT have additional properties'));
    // In bounds but not the levers the season makes: the prepared bout is the one the progress makes.
    refuse(s, p => set(p, 'rankDefence', { hpPerRankStep: 0.1 }), 'Save entrant or seed differs from the camp snapshot.');
    refuse(s, p => { delete p.bout.rankDefence; }, 'Save entrant or seed differs from the camp snapshot.');
    s.close();
  });
  it('refuses a non-finite lever', () => {
    const s = preparedBout();
    // JSON has no NaN or Infinity: they reach the validator from a live object.
    for (const bad of [NaN, Infinity, -Infinity]) {
      const a = logical(s), b = logical(s);
      a.progress.bout.opponentMage = { averageRank: bad }; b.progress.bout.rankDefence = { hpPerRankStep: bad };
      expect(() => validatePayload(t, a)).toThrow('Save schema rejected: /progress/bout/opponentMage/averageRank');
      expect(() => validatePayload(t, b)).toThrow('Save schema rejected: /progress/bout/rankDefence/hpPerRankStep');
    }
    s.close();
  });
  it('refuses each out-of-bounds bout rank, and ranks that are not the book\'s', () => {
    const s = preparedBout(), schema = 'Save schema rejected';
    refuse(s, p => { p.bout.spellRanks = {}; }, schema);
    refuse(s, p => { p.bout.spellRanks = { 'bolt:0': maxSpellRank + 1 }; }, schema);
    refuse(s, p => { p.bout.spellRanks = { 'bolt:0': 1 }; }, schema);
    refuse(s, p => { p.bout.spellRanks = { 'mud:9': 2 }; }, schema);
    refuse(s, p => { p.bout.spellRanks = { 'bolt:0': 3, 'lash:1': 2 }; }, 'Save entrant or seed differs from the camp snapshot.');
    refuse(s, p => { delete p.bout.spellRanks; }, 'Save entrant or seed differs from the camp snapshot.');
    // The prepared bout is the one the progress makes.
    expect(prepareBout(t, s.session, { ...s.progress, bout: null }, presets[2]!).spellRanks).toEqual(s.progress.bout!.spellRanks);
    s.close();
  });
});
