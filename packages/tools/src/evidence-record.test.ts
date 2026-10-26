import { afterAll, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveWave, stampCommand, writePin } from './evidence-record.ts';
import { replaySaveRecord, runReplaySave } from './replay-save.ts';
import { schoolCensus } from './school-census.ts';
import { fixtureService, removeFixtureDirs } from './season-fixtures.ts';

const made: string[] = [];
afterAll(() => { removeFixtureDirs(); for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });
const keysOf = (path: string) => Object.keys(JSON.parse(readFileSync(path, 'utf8')) as object);

describe('evidence-record kernel', () => {
  it('derives the wave registry from docs/waves/<id>-evidence (W8 accepted)', () => {
    expect(resolveWave('W8')).toBe('docs/waves/W8-evidence/replay-save.json');
  });
  it('refuses a wave with no evidence directory, or a path-shaped id', () => {
    expect(() => resolveWave('X9')).toThrow(/Invalid evidence destination/);
    expect(() => resolveWave('../W8')).toThrow(/Invalid evidence destination/);
  });
  it('rewrites a pin only when a value moved, never for line endings alone', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mage-pin-'));
    made.push(dir);
    const path = join(dir, 'pin.json'),
      lf = (a: number) => JSON.stringify({ a }, null, 2) + '\n',
      crlf = lf(1).replace(/\n/g, '\r\n');
    expect(writePin(path, lf(1))).toBe(true);
    writeFileSync(path, crlf);
    const before = statSync(path).mtimeMs;
    expect(writePin(path, lf(1))).toBe(false);
    expect(readFileSync(path, 'utf8')).toBe(crlf);
    expect(statSync(path).mtimeMs).toBe(before);
    expect(writePin(path, lf(2))).toBe(true);
    expect(readFileSync(path, 'utf8')).toBe(lf(2));
  });
  it('stamps the command that reproduces the record', async () => {
    expect(stampCommand('replay-save.ts', ['--wave', 'CF2'])).toBe('npx tsx packages/tools/src/replay-save.ts --wave CF2');
    const { record } = await replaySaveRecord({ wave: 'CF2', make: () => fixtureService() });
    expect(record.command).toBe('npx tsx packages/tools/src/replay-save.ts --wave CF2');
    expect(record.passed).toBe(true);
  });
  it('records a diverging double replay as passed:false with a non-zero exit', async () => {
    let seed = 73;
    const { record } = await replaySaveRecord({ wave: 'CF2', make: () => fixtureService(seed++) });
    expect(record.passed).toBe(false);
    expect(record.firstHash).not.toBe(record.secondHash);
    const root = mkdtempSync(join(tmpdir(), 'mage-evidence-')); made.push(root);
    mkdirSync(join(root, 'Z1-evidence'));
    const run = await runReplaySave({ wave: 'Z1', make: () => fixtureService(seed++), root });
    expect(run.exitCode).not.toBe(0);
    expect((JSON.parse(readFileSync(run.path, 'utf8')) as { passed: boolean }).passed).toBe(false);
  });
  it('keeps the committed replay-save record shape key for key', async () => {
    const { record } = await replaySaveRecord({ wave: 'U6c', make: () => fixtureService() });
    expect(Object.keys(record)).toEqual(keysOf('docs/waves/U6c-evidence/replay-save.json'));
    expect(Object.keys(record)).toEqual(['label', 'command', 'sourceHash', 'policyHash', 'firstHash', 'secondHash', 'loadedHash', 'bytes', 'day', 'receipts', 'exactBytes', 'passed']);
  });
  it('runs one school census loop with the CF columns and the H1 extras', () => {
    const cfKeys = ['school', 'n', 'wins', 'timeouts', 'durationMedianS', 'winningTTKMedianS', 'hitsTakenMedian', 'absorbOpportunitiesMedian', 'absorbSuccessTotal', 'perfectTotal'];
    const h1Keys = ['school', 'n', 'wins', 'timeouts', 'durationMedianS', 'hitsToDefeatMedian', 'staggersTotal', 'cancelledCastsTotal', 'winningTTKMedianS', 'hitsTakenMedian', 'absorbOpportunitiesMedian', 'absorbSuccessTotal', 'perfectTotal'];
    const cf = schoolCensus({ seeds: [7331, 7332], extras: [] });
    const h1 = schoolCensus({ seeds: [7331, 7332], extras: ['staggers', 'cancelledCasts', 'hitsToDefeat'] });
    for (const row of cf.summary) expect(Object.keys(row)).toEqual(cfKeys);
    for (const row of h1.summary) expect(Object.keys(row)).toEqual(h1Keys);
    const shared = (s: Record<string, unknown>) => Object.fromEntries(cfKeys.map(k => [k, s[k]]));
    expect(h1.summary.map(shared)).toEqual(cf.summary.map(shared));
    expect(h1.rows.map(r => r.hash)).toEqual(cf.rows.map(r => r.hash));
  });
  it('keeps the legacy u1-replay entry on the U1 record', () => {
    expect(resolveWave('U1')).toBe('docs/waves/U1-evidence/replay-save.json');
    expect(readFileSync('packages/tools/src/u1-replay.ts', 'utf8')).toMatch(/replaySaveCli\(\s*["']U1["']\s*\)/);
    expect(readFileSync('packages/tools/src/w7-replay.ts', 'utf8')).toMatch(/replaySaveCli\(\s*["']W7["']\s*\)/);
  });
});
