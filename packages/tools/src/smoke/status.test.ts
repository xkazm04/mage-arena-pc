import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REGISTRY, type SuiteEntry } from './registry.ts';
import { LAST_RUN, status, summarize } from './status.ts';

const made: string[] = [];
afterAll(() => { for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true }); });
const fixture = (): { dir: string; entry: SuiteEntry } => {
  const dir = mkdtempSync(join(tmpdir(), 'mage-smoke-status-'));
  made.push(dir);
  return { dir, entry: { ...REGISTRY.find((e) => e.id === 'u3')!, evidence: dir } };
};

describe('smoke status', () => {
  it('reads a passing record with its mtime', () => {
    const { dir, entry } = fixture();
    writeFileSync(join(dir, 'browser.json'), JSON.stringify({ passed: true }));
    const at = new Date('2026-10-20T10:00:00Z');
    utimesSync(join(dir, 'browser.json'), at, at);
    expect(status(entry)).toEqual({ state: 'pass', at });
  });

  it('reports a newer failure record with its first error line', () => {
    const { dir, entry } = fixture();
    writeFileSync(join(dir, 'browser.json'), JSON.stringify({ passed: true }));
    writeFileSync(join(dir, 'browser-failure.json'), JSON.stringify({ error: 'AssertionError: x\n    at tour' }));
    const old = new Date('2026-10-20T10:00:00Z'), newer = new Date('2026-10-21T10:00:00Z');
    utimesSync(join(dir, 'browser.json'), old, old);
    utimesSync(join(dir, 'browser-failure.json'), newer, newer);
    expect(status(entry)).toEqual({ state: 'fail', at: newer, error: 'AssertionError: x' });
    const newest = new Date('2026-10-22T10:00:00Z');
    utimesSync(join(dir, 'browser.json'), newest, newest);
    expect(status(entry).state).toBe('pass');
  });

  it('treats passed:false as a failure, no files as never-run, no evidence as untracked', () => {
    const { dir, entry } = fixture();
    expect(status(entry)).toEqual({ state: 'never-run' });
    writeFileSync(join(dir, 'browser.json'), JSON.stringify({ passed: false, error: 'budget' }));
    expect(status(entry)).toMatchObject({ state: 'fail', error: 'budget' });
    expect(status({ ...entry, evidence: null })).toEqual({ state: 'untracked' });
  });

  it('summarizes a run into one row per suite with its evidence path and an exit code', () => {
    const s = summarize([{ suite: 'u3', ok: true, ms: 61000 }, { suite: 'd3', ok: false, ms: 9000, error: 'left edge' }]);
    expect(s.exitCode).toBe(1);
    expect(s.rows).toEqual([
      { suite: 'u3', result: 'pass', seconds: 61, evidence: 'docs/waves/U3-evidence', error: '' },
      { suite: 'd3', result: 'fail', seconds: 9, evidence: 'docs/waves/D3-evidence', error: 'left edge' },
    ]);
    expect(s.text.split('\n')).toHaveLength(4);
    expect(summarize([{ suite: 'u3', ok: true, ms: 1 }]).exitCode).toBe(0);
    expect(summarize([]).exitCode).toBe(0);
  });

  it('keeps the last-run record in the OS temp dir, never inside the repo', () => {
    expect(LAST_RUN.startsWith(join(tmpdir(), 'mage-arena-smoke'))).toBe(true);
    expect(LAST_RUN.startsWith(process.cwd())).toBe(false);
  });
});
