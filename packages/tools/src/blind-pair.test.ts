import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  EXPORT_SOURCE, exportResponses, type Choice, extractArticles, extractPairs, ownerReadLine, pageHash,
  parseResponses, renderBlindPage, sideLabels, unblind, type FormState, type SourceMapRow,
} from './blind-pair.ts';
import { readOwnerResult, scoreOwnerRead } from './blind-score.ts';

const root = 'docs/waves/W1-evidence';
// blind-check.ts:21 - nothing on the page may name a source.
const SOURCE_LABEL = /sonnet|claude|ollama|qwen|planner|live accepted|blind-source-map/i;
const pairs = [1, 2, 3].map(m => ({ a: `<ul><li>Camp ${m} wakes left.</li></ul>`, b: `<ul><li>Camp ${m} wakes right.</li></ul>` }));
const page = renderBlindPage(pairs);
const state = (choices: Record<number, string | null>): FormState =>
  ({ pageHash: pageHash(page), mornings: 3, choices, notes: { 1: ' warm ', 2: '', 3: 'stiff' } });
const file = (rows: unknown[], hash = pageHash(page)) => JSON.stringify({ pageHash: hash, responses: rows });
const row = (morning: number, choice: unknown) => ({ morning, choice, notes: '' });
const answer = (morning: number, choice: Choice | null) => ({ morning, choice, notes: '' });
const LIVE = 'live accepted + fallback', PLANNER = 'offline planner';
const mapping: SourceMapRow[] = [
  { morning: 1, A: LIVE, B: PLANNER },
  { morning: 2, A: PLANNER, B: LIVE },
  { morning: 3, A: LIVE, B: PLANNER },
];

describe('owner blind read capture', () => {
  it('case 1: renders three answerable mornings with no source label', () => {
    expect(page.match(/<section>/g)).toHaveLength(3);
    expect(page.match(/<article>/g)).toHaveLength(6);
    for (const m of [1, 2, 3]) {
      for (const v of ['A', 'B', 'tie'])
        expect(page).toContain(`<input type="radio" name="morning-${m}" value="${v}">`);
      expect(page).toMatch(new RegExp(`<textarea name="notes-${m}"`));
    }
    expect(page.replace(/<[^>]*>/g, ' ')).not.toMatch(SOURCE_LABEL);
    expect(page).not.toMatch(SOURCE_LABEL);
  });
  it('case 2: exports a label-free response file bound to the page', () => {
    const out = exportResponses(state({ 1: 'A', 2: 'tie', 3: null }));
    expect(out).toEqual({
      pageHash: pageHash(page),
      responses: [{ morning: 1, choice: 'A', notes: 'warm' }, { morning: 2, choice: 'tie', notes: '' }, { morning: 3, choice: null, notes: 'stiff' }],
    });
    expect(JSON.stringify(out)).not.toMatch(/sonnet|claude|ollama|planner|live/i);
    // The page's inline exporter is the same function.
    const inline = new Function(`${EXPORT_SOURCE}; return exportResponses;`)() as typeof exportResponses;
    for (const choices of [{ 1: 'A', 2: 'B', 3: 'tie' }, { 1: null, 2: 'C', 3: 'B' }])
      expect(inline(state(choices))).toEqual(exportResponses(state(choices)));
    expect(page).toContain(EXPORT_SOURCE);
  });
  it('case 3: refuses an out-of-vocabulary, unknown or duplicate morning', () => {
    expect(() => parseResponses(file([row(1, 'C')]), page)).toThrow(/choice/);
    expect(() => parseResponses(file([row(4, 'A')]), page)).toThrow(/morning/);
    expect(() => parseResponses(file([row(1, 'A'), row(1, 'B')]), page)).toThrow(/duplicate/);
    expect(parseResponses(file([row(1, 'A'), row(2, 'B'), row(3, 'tie')]), page))
      .toEqual([row(1, 'A'), row(2, 'B'), row(3, 'tie')]);
  });
  it('case 4: refuses answers to a page other than the one read', () => {
    expect(() => parseResponses(file([row(1, 'A')], 'f'.repeat(64)), page)).toThrow(/stale page/);
    const other = renderBlindPage([{ a: '<p>x</p>', b: '<p>y</p>' }, ...pairs.slice(1)]);
    expect(() => parseResponses(file([row(1, 'A')]), other)).toThrow(/stale page/);
  });
  it('case 5: unblinds answers through the kept mapping', () => {
    expect(unblind(mapping, [answer(1, 'A'), answer(2, 'A'), answer(3, 'tie')])).toEqual({ live: 1, planner: 1, tie: 1, unanswered: 0 });
    expect(unblind(mapping, [answer(2, 'B'), answer(3, null)])).toEqual({ live: 1, planner: 0, tie: 0, unanswered: 2 });
  });
  it('case 6: states the owner verdict, or pending', () => {
    expect(ownerReadLine(null)).toBe('Owner blind read: pending.');
    expect(ownerReadLine({ live: 1, planner: 1, tie: 1, unanswered: 0 }))
      .toBe('Owner blind read: recorded 3/3 - live 1, planner 1, tie 1 (owner, felt, n=3).');
  });
  it('case 7: side assignment alternates as committed in blind-source-map.json', () => {
    const committed = JSON.parse(readFileSync(`${root}/blind-source-map.json`, 'utf8')) as SourceMapRow[];
    expect(committed.map((_, i) => sideLabels(i))).toEqual(committed.map(({ A, B }) => ({ A, B })));
    expect(sideLabels(0)).toEqual({ A: LIVE, B: PLANNER });
    expect(sideLabels(1)).toEqual({ A: PLANNER, B: LIVE });
  });
  it('case 8: the committed page gains the form but keeps its six mornings byte for byte', () => {
    const html = readFileSync(`${root}/OWNER-READ.html`, 'utf8');
    const articles = extractArticles(html);
    expect(articles).toHaveLength(6);
    // sha256 of the six <article> inner HTMLs of the page as committed before the form (d3dd8c7).
    expect(createHash('sha256').update(articles.join('\n')).digest('hex'))
      .toBe('ce2eacb3b26d24f2f444c60f4ba41895029abfdb1a5b1178daeb36f69066803d');
    expect(html).toContain('<input type="radio" name="morning-3" value="tie">');
    expect(extractArticles(renderBlindPage(extractPairs(html)))).toEqual(articles);
    expect(html).not.toMatch(SOURCE_LABEL);
  });
  it('the committed W1 report states the recorded owner read', () => {
    expect(readFileSync('docs/waves/W1-report.md', 'utf8')).toContain(ownerReadLine(readOwnerResult(root)));
  });
  it('scores a saved answer file for the committed page through the committed map', () => {
    const html = readFileSync(`${root}/OWNER-READ.html`, 'utf8');
    const map = JSON.parse(readFileSync(`${root}/blind-source-map.json`, 'utf8')) as SourceMapRow[];
    const saved = JSON.stringify(exportResponses({ pageHash: pageHash(html), mornings: 3, choices: { 1: 'A', 2: 'A', 3: 'tie' }, notes: { 1: 'Nysa sounds like herself' } }));
    const result = scoreOwnerRead(saved, html, map);
    expect(result).toMatchObject({ label: 'owner, felt, n=3', live: 1, planner: 1, tie: 1, unanswered: 0 });
    expect(result.responses.map(r => r.source)).toEqual([LIVE, PLANNER, null]);
    expect(ownerReadLine(result)).toBe('Owner blind read: recorded 3/3 - live 1, planner 1, tie 1 (owner, felt, n=3).');
  });
});
