import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, ingest, status, kept, render, load } from './choices.mjs';
// Owner verdicts as data. Pure parsing over the repo's CHOICES.md, pages and ledger; no network.
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const choicesMd = fs.readFileSync(path.join(repo, 'docs/audio/CHOICES.md'), 'utf8');
const round1Table = () => {
  const lines = choicesMd.replace(/\r\n/g, '\n').split('\n');
  const start = lines.indexOf('| Theme / direction | Pick | Samples | Owner note |');
  let end = start;
  while (lines[end]?.startsWith('|')) end++;
  return lines.slice(start, end).join('\n') + '\n';
};
const temp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'choices-')), 'choices.json');
// Mirrors report.js exportText(): title, blank, description, blank, header, separator, rows.
const exportOf = (title, rows) => [title, '', 'Description.', '', '| Theme / direction | Pick | Samples | Owner note |', '|---|---|---|---|', ...rows].join('\n') + '\n';
const R3 = '## AU2b round 3 — owner triage', R4 = '## AU3 round 4 — owner full-track triage';
const r3Row = (pick, note = '') => `| Title / C · Reed standard | ${pick} | title-C-reed-standard | ${note} |`;

test('case 1: the round-1 table in CHOICES.md parses to 13 verdicts', () => {
  const v = parse(choicesMd);
  assert.equal(v.length, 13);
  assert.ok(v.every(x => x.round === 'r1'));
  const keeps = v.filter(x => x.pick === 'keep').flatMap(x => x.samples);
  assert.deepEqual(keeps, ['arena-A-hide-and-iron', 'fire-A-wounded-matter', 'water-B-bound-radiance', 'earth-B-bound-radiance', 'voice-A-george']);
  assert.equal(v.filter(x => x.pick === 'maybe').length, 1);
  assert.equal(v.filter(x => x.pick === 'reject').length, 7);
  assert.deepEqual(v.find(x => x.pick === 'maybe').samples, ['absorb-A-normal', 'absorb-A-perfect']);
});

test('case 2: the report.js export round-trips, escapeCell reversed', () => {
  const text = exportOf(R3, ['| Title / C · Reed standard | keep | title-C-reed-standard | Test note \\| literal<br>second line |']);
  const [v] = parse(text);
  assert.equal(v.round, 'r3');
  assert.equal(v.note, 'Test note | literal\nsecond line');
  assert.equal(v.pick, 'keep');
  assert.deepEqual(v.samples, ['title-C-reed-standard']);
});

test('case 3: ingest is idempotent; a changed pick wins and the earlier one goes to history', () => {
  const file = temp();
  ingest(exportOf(R3, [r3Row('maybe', 'first')]), { choicesPath: file });
  const once = fs.readFileSync(file, 'utf8');
  ingest(exportOf(R3, [r3Row('maybe', 'first')]), { choicesPath: file });
  assert.equal(fs.readFileSync(file, 'utf8'), once);
  ingest(exportOf(R3, [r3Row('keep', 'second')]), { choicesPath: file });
  const [v] = load(file).rounds.r3.verdicts;
  assert.equal(v.pick, 'keep');
  assert.equal(v.note, 'second');
  assert.deepEqual(v.history, [{ pick: 'maybe', samples: ['title-C-reed-standard'], note: 'first' }]);
});

test('case 4: an unknown sample id is refused and the file is untouched', () => {
  const file = temp();
  ingest(exportOf(R3, [r3Row('maybe')]), { choicesPath: file });
  const before = fs.readFileSync(file);
  assert.throws(() => ingest(exportOf(R3, ['| Ghost | keep | ghost-Z-never-rendered | |']), { choicesPath: file }), /ghost-Z-never-rendered/);
  assert.deepEqual(fs.readFileSync(file), before);
  // The check is per round: a rejected r1 id that r3 never referenced is unknown there.
  assert.throws(() => ingest(exportOf(R3, ['| X | keep | arena-B-ashen-vault | |']), { choicesPath: file }), /arena-B-ashen-vault/);
});

test('case 5: not-picked rows and the placeholder row record nothing', () => {
  assert.deepEqual(parse(exportOf(R3, ['| No directions reviewed | not picked | | |'])), []);
  assert.deepEqual(parse(exportOf(R3, [r3Row('not picked', 'only a note')])), []);
  const file = temp();
  const { added } = ingest(exportOf(R3, ['| No directions reviewed | not picked | | |']), { choicesPath: file });
  assert.equal(added, 0);
  assert.equal(load(file).rounds.r3, undefined);
});

test('case 6: status counts pending cards from each audition page', () => {
  const file = temp();
  ingest(exportOf(R4, ['| Reed oath · full score | maybe | audition/r4/arena-C-reed-oath/master-48k.wav | |']), { choicesPath: file });
  const s = status({ choicesPath: file });
  assert.deepEqual({ cards: s.r3.cards, pending: s.r3.pending }, { cards: 10, pending: 10 });
  assert.deepEqual({ cards: s.r4.cards, pending: s.r4.pending }, { cards: 18, pending: 17 });
  assert.equal(s.r4.picked, 1);
});

test('case 7: kept() after round 1, and render(r1) reproduces the CHOICES.md table byte for byte', () => {
  const file = temp();
  ingest(choicesMd, { choicesPath: file });
  assert.deepEqual(kept({ choicesPath: file }), ['arena-A-hide-and-iron', 'fire-A-wounded-matter', 'water-B-bound-radiance', 'earth-B-bound-radiance', 'voice-A-george'].map(sample => ({ round: 'r1', sample })));
  assert.equal(render('r1', { choicesPath: file }), round1Table());
});

test('guard: the committed choices.json is exactly the round-1 owner table, nothing inferred', () => {
  const data = load(path.join(repo, 'docs/audio/choices.json'));
  assert.deepEqual(Object.keys(data.rounds), ['r1']);
  assert.equal(render('r1'), round1Table());
  const s = status();
  assert.equal(s.r1.pending, 0);
  assert.equal(s.r2.proseOnly, true);
  assert.equal(s.r3.pending, 10);
  assert.equal(s.r4.pending, 18);
});
