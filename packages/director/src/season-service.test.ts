import { afterAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSeason, skillBookRules, teacherOf } from '@mage/core';
import { CostGuard } from './budget.ts';
import { RequestCache } from './cache.ts';
import { loadTables } from './data.ts';
import { PlannerProvider } from './providers.ts';
import { SeasonService, type SeasonCommand } from './season-service.ts';

// The skill-book door on the season service (D3 4.3, Athena's ruling 2026-10-26): the view carries the book and two commands
// buy a rank and take a lesson. A season without a book is byte-for-byte what it was.
const t = loadTables(), dirs: string[] = [];
/** The flag-off view JSON as main produced it before the door: its length and sha256. */
const flagOffView = { length: 7629, sha256: '936ceedcfd1be290ebe4f3f16a58717df8496508e57af5479570645179f6ca8b' };
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
    const row = s.view().season.skills!.teachers.find(r => r.school !== s.view().season.skills!.school)!;
    camp.trust[`${row.id}>${camp.player}`] = skillBookRules.teaching.trustAtLeast;
    s.session.location = camp.characters[row.id]!.home ?? s.session.location;
    const outcome = (() => { try { return send(s, { type: 'take-lesson', teacher: row.id }); } catch (e) { return (e as Error).message; } })();
    if (typeof outcome === 'string') expect(['They are not here.']).toContain(outcome);
    else { expect(s.progress.skills!.taught).toEqual([row.signature]); expect(s.session.revision).toBe(revision + 1); }
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
