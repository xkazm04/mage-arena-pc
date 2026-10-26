import { afterAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSeason, present, skillBookRules, teacherOf } from '@mage/core';
import { CostGuard } from './budget.ts';
import { RequestCache } from './cache.ts';
import { loadTables } from './data.ts';
import { PlannerProvider } from './providers.ts';
import campPlay from '../../../docs/design/reconciled/data/camp-play.json' with { type: 'json' };
import { SeasonService, type SeasonCommand } from './season-service.ts';

// The skill-book door on the season service (D3 4.3, Athena's ruling 2026-10-26): the view carries the book and two commands
// buy a rank and take a lesson. A season without a book is byte-for-byte what it was.
const presence: Record<string, string[]> = campPlay.presence;
const t = loadTables(), dirs: string[] = [];
/** The flag-off view JSON: its length and sha256. Re-pinned 2026-10-26 (D3 4.3): campView gained presenceByPlace; the skills key is still absent. */
const flagOffView = { length: 8663, sha256: '28c1ba8bd79175262f5d3c365a369a435b29ff7abd0b7c48e0962c8857e07808' };
afterAll(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });
function service(flag: boolean) {
  const dir = mkdtempSync(join(tmpdir(), 'mage-season-')); dirs.push(dir);
  const s: SeasonService = new SeasonService(t, {
    provider: new PlannerProvider(t, () => s.session.camp),
    cache: new RequestCache(join(dir, 'cache')), guard: new CostGuard(join(dir, 'ledger'), 'test', 'planner', 0, 0),
  });
  s.progress = createSeason(flag);
  return s;
}
const send = (s: SeasonService, command: unknown) => s.seasonCommand(command as SeasonCommand, s.session.revision);

describe('season view without a book', () => {
  it('is byte-identical to the view before the door, with no skills key', () => {
    const s = service(false), json = JSON.stringify(s.view());
    expect('skills' in s.view().season).toBe(false);
    expect({ length: json.length, sha256: createHash('sha256').update(json).digest('hex') }).toEqual(flagOffView);
    s.close();
  });
  it('refuses both new commands with the core text and leaves the revision alone', () => {
    const s = service(false), revision = s.session.revision;
    expect(() => send(s, { type: 'buy-rank', key: 'bolt:0' })).toThrow('No one teaches spells yet.');
    expect(() => send(s, { type: 'take-lesson', teacher: 'x' })).toThrow('No one teaches spells yet.');
    expect(s.session.revision).toBe(revision); expect('skills' in s.progress).toBe(false);
    s.close();
  });
});

describe('season view with a book', () => {
  it('carries the book, the player school, spell rows with their next cost and the teachers with trust', () => {
    const s = service(true), k = s.view().season.skills!;
    expect(k.points).toBe(0); expect(k.earned).toBe(0); expect(k.taught).toEqual([]);
    expect(k.school).toBe(s.session.camp.characters[s.session.camp.player]!.school);
    expect(k.trustNeeded).toBe(skillBookRules.teaching.trustAtLeast);
    const bolt = k.spells.find(r => r.key === 'bolt:0')!;
    expect(bolt).toMatchObject({ rank: 1, cost: skillBookRules.rankCost[0]![0], known: true });
    expect(k.teachers.length).toBeGreaterThan(0);
    for (const row of k.teachers) expect(row).toMatchObject({ id: expect.any(String), name: expect.any(String), trust: expect.any(Number), signature: teacherOf(t, row.school)!.signature });
    s.close();
  });
  it('buy-rank buys the next rank, spends the points and bumps the revision', () => {
    const s = service(true); s.progress.skills = { points: 60, earned: 60, ranks: {}, taught: [] };
    const revision = s.session.revision, view = send(s, { type: 'buy-rank', key: 'bolt:0' });
    expect(s.session.revision).toBe(revision + 1);
    expect(s.progress.skills!.ranks).toEqual({ 'bolt:0': 2 });
    expect(view.season.skills!.points).toBe(60 - skillBookRules.rankCost[0]![0]!);
    expect(view.season.skills!.spells.find(r => r.key === 'bolt:0')!.rank).toBe(2);
    s.close();
  });
  it('buy-rank surfaces the core refusal unchanged and moves nothing', () => {
    const s = service(true), revision = s.session.revision;
    expect(() => send(s, { type: 'buy-rank', key: 'bolt:0' })).toThrow('Not enough skill points.');
    expect(() => send(s, { type: 'buy-rank', key: 'nonsense' })).toThrow('You do not know that spell.');
    expect(s.session.revision).toBe(revision);
    s.close();
  });
  it('take-lesson refuses a stranger with the core text, and teaches a trusted elder here', () => {
    const s = service(true), camp = s.session.camp, revision = s.session.revision;
    expect(() => send(s, { type: 'take-lesson', teacher: 'nobody' })).toThrow('They have no signature to teach.');
    expect(s.session.revision).toBe(revision);
    const k = s.view().season.skills!, places = [...new Set(Object.values(presence).flat())];
    const row = k.teachers.find(r => r.school !== k.school && places.some(place => present(s.session, place).includes(r.id)))!;
    s.session.location = places.find(place => present(s.session, place).includes(row.id))!;
    camp.trust[`${row.id}>${camp.player}`] = skillBookRules.teaching.trustAtLeast;
    const view = send(s, { type: 'take-lesson', teacher: row.id });
    expect(s.progress.skills!.taught).toEqual([row.signature]); expect(s.session.revision).toBe(revision + 1);
    expect(view.season.skills!.teachers.find(r => r.id === row.id)!.taught).toBe(true);
    s.close();
  });
  it('refuses a lesson while trust is short, with the core text', () => {
    const s = service(true), row = s.view().season.skills!.teachers[0]!;
    expect(row.problem).not.toBeNull();
    expect(() => send(s, { type: 'take-lesson', teacher: row.id })).toThrow(row.problem!);
    s.close();
  });
  it('refuses both commands while a trial or bout is open', () => {
    const s = service(true); s.progress.skills = { points: 60, earned: 60, ranks: {}, taught: [] };
    s.progress.trial = { phase: 'active' } as never;
    expect(() => send(s, { type: 'buy-rank', key: 'bolt:0' })).toThrow('Ranks are fixed while the Trial or a bout is open.');
    s.close();
  });
});

describe('season command envelope for the book', () => {
  it.each([
    [{ type: 'buy-rank' }], [{ type: 'buy-rank', key: 7 }], [{ type: 'buy-rank', key: 'bolt:0', extra: 1 }],
    [{ type: 'take-lesson' }], [{ type: 'take-lesson', teacher: null }], [{ type: 'take-lesson', teacher: 'a', key: 'b' }],
    [{ type: 'buy-rank', teacher: 'a' }], [{ type: 'take-lesson', key: 'a' }],
  ])('refuses %j as an invalid envelope', command => {
    const s = service(true); s.progress.skills = { points: 60, earned: 60, ranks: {}, taught: [] };
    const revision = s.session.revision;
    expect(() => send(s, command)).toThrow('Invalid season command envelope.');
    expect(s.session.revision).toBe(revision); expect(s.progress.skills!.ranks).toEqual({});
    s.close();
  });
});
