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
function preparedBout() {
  const s = booked(); s.session.camp.day = 6; s.session.slot = 'dusk'; s.session.hour = t.season.trialHour; s.session.location = 'pit';
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
