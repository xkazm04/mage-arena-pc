#!/usr/bin/env node
// Owner listening verdicts as data. Offline only: no network, no generator.
// ingest <file|->  merge a report.js "Copy Markdown" export (or CHOICES.md) into docs/audio/choices.json
// status           per round: audition-page cards, pending, picked, kept
// kept             sample ids whose latest pick is keep, tagged with their round
// render <round>   that round's verdicts as the CHOICES.md table
// Only rows the owner exported get in; nothing is inferred.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const DEFAULT_CHOICES = path.join(repo, 'docs/audio/choices.json');
const AUDITION = path.join(repo, 'docs/audio/audition');
const HEADER = '| Theme / direction | Pick | Samples | Owner note |';
const PICKS = new Set(['keep', 'maybe', 'reject']);
const PLACEHOLDER = 'No directions reviewed';
const read = file => fs.readFileSync(file, 'utf8');

// Inverse pair of report.js escapeCell.
const escapeCell = value => String(value || '').replaceAll('|', '\\|').replace(/\r?\n/g, '<br>').replaceAll('<script', '&lt;script');
const unescapeCell = value => value.replaceAll('&lt;script', '<script').replaceAll('<br>', '\n').replaceAll('\\|', '|');
const cellsOf = line => line.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '').split(/(?<!\\)\|/).map(c => unescapeCell(c.trim()));
const samplesOf = cell => cell ? cell.split(', ').map(s => s.trim()).filter(Boolean) : [];

// Every owner table under a heading naming "round N" becomes verdicts for rN.
export function parse(text) {
  const verdicts = [];
  let round = null, inTable = false;
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (line.startsWith('#')) { const m = /round\s*(\d+)/i.exec(line); round = m ? `r${m[1]}` : null; inTable = false; continue; }
    if (line.trim() === HEADER) { inTable = round !== null; continue; }
    if (!inTable) continue;
    if (!line.startsWith('|')) { inTable = false; continue; }
    if (/^\|[-| ]+\|$/.test(line.trim())) continue;
    const [label = '', pick = '', samples = '', note = ''] = cellsOf(line);
    if (label === PLACEHOLDER || !PICKS.has(pick)) continue;
    verdicts.push({ round, label, pick, samples: samplesOf(samples), note });
  }
  return verdicts;
}

// Sample ids a round actually rendered (ledger) or referenced (its plan).
// A page path such as audition/r4/<id>/master-48k.wav resolves to <id>.
const sampleId = (round, sample) => sample.replace(new RegExp(`^(docs/audio/)?audition/${round}/`), '').split('/')[0].replace(/\.(mp3|wav)$/, '');
function knownSamples(round) {
  const ids = new Set();
  for (const line of read(path.join(here, 'ledger.jsonl')).split('\n')) {
    if (!line.trim()) continue;
    const out = JSON.parse(line).out || '';
    const m = /^docs\/audio\/audition\/(r\d+)\/([^/]+)\.(mp3|wav)$/.exec(out);
    if (m && m[1] === round) ids.add(m[2]);
  }
  const plan = path.join(here, round === 'r1' ? 'audition-plan.json' : `audition-plan-${round}.json`);
  if (fs.existsSync(plan)) for (const ref of JSON.parse(read(plan)).references || []) ids.add(ref);
  return ids;
}

// Audition-page cards: data-direction / data-label / data-samples.
const decode = s => s.replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
function cardsOf(round) {
  const page = path.join(AUDITION, round, 'index.html');
  if (!fs.existsSync(page)) return [];
  return [...read(page).matchAll(/<[a-z]+\s[^>]*data-direction="([^"]*)"[^>]*>/g)].map(([tag, direction]) => {
    const attr = name => decode((new RegExp(`data-${name}="([^"]*)"`).exec(tag) || [, ''])[1]);
    return { direction: decode(direction), label: attr('label'), samples: samplesOf(attr('samples')) };
  });
}
const rounds = () => fs.readdirSync(AUDITION).filter(d => /^r\d+$/.test(d)).sort((a, b) => a.slice(1) - b.slice(1));
const waveOf = round => {
  const { rounds: rows } = JSON.parse(read(path.join(here, 'rounds.json')));
  return Object.entries(rows).find(([, row]) => row.dir === round)?.[0] ?? null;
};

const EMPTY = { version: 1, proseOnly: { r2: 'CHOICES.md "Round 2 (AU2)" records these verdicts as prose; not transcribed' }, rounds: {} };
export const load = (file = DEFAULT_CHOICES) => fs.existsSync(file) ? JSON.parse(read(file)) : structuredClone(EMPTY);
const same = (a, b) => a.pick === b.pick && a.note === b.note && JSON.stringify(a.samples) === JSON.stringify(b.samples);

// Validate every row first, then write once: a refused export leaves the file byte-identical.
export function ingest(text, { choicesPath = DEFAULT_CHOICES } = {}) {
  const incoming = parse(text);
  for (const v of incoming) {
    const known = knownSamples(v.round);
    for (const s of v.samples) if (!known.has(sampleId(v.round, s))) throw new Error(`Unknown sample id for ${v.round}: ${s}`);
  }
  const data = load(choicesPath);
  let added = 0, revised = 0;
  for (const v of incoming) {
    const entry = data.rounds[v.round] ??= { wave: waveOf(v.round), verdicts: [] };
    const current = entry.verdicts.find(x => x.label === v.label);
    const record = { pick: v.pick, samples: v.samples, note: v.note };
    if (!current) {
      const direction = cardsOf(v.round).find(c => c.label === v.label)?.direction ?? null;
      entry.verdicts.push({ label: v.label, direction, ...record, history: [] }); added++;
    } else if (!same(current, record)) {
      current.history.push({ pick: current.pick, samples: current.samples, note: current.note });
      Object.assign(current, record); revised++;
    }
  }
  if (added || revised) {
    const tmp = `${choicesPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
    fs.renameSync(tmp, choicesPath);
  }
  return { rows: incoming.length, added, revised };
}

export function status({ choicesPath = DEFAULT_CHOICES } = {}) {
  const data = load(choicesPath), out = {};
  for (const round of rounds()) {
    const cards = cardsOf(round), verdicts = data.rounds[round]?.verdicts ?? [];
    const byLabel = new Map(verdicts.map(v => [v.label, v]));
    const pending = cards.filter(c => !byLabel.has(c.label)).map(c => c.direction);
    out[round] = {
      wave: waveOf(round), cards: cards.length, pending: pending.length,
      picked: cards.length - pending.length, kept: verdicts.filter(v => v.pick === 'keep').length,
      proseOnly: Boolean(data.proseOnly?.[round]) && !verdicts.length, pendingDirections: pending,
    };
  }
  return out;
}

export const kept = ({ choicesPath = DEFAULT_CHOICES } = {}) => Object.entries(load(choicesPath).rounds)
  .flatMap(([round, { verdicts }]) => verdicts.filter(v => v.pick === 'keep').flatMap(v => v.samples.map(sample => ({ round, sample }))));

// Same cell spacing as the hand-kept CHOICES.md tables: an empty cell is "| |".
export function render(round, { choicesPath = DEFAULT_CHOICES } = {}) {
  const row = cells => '|' + cells.map(c => { const e = escapeCell(c); return e ? ` ${e} ` : ' '; }).join('|') + '|';
  const verdicts = load(choicesPath).rounds[round]?.verdicts ?? [];
  return [HEADER, '|---|---|---|---|', ...verdicts.map(v => row([v.label, v.pick, v.samples.join(', '), v.note]))].join('\n') + '\n';
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === 'ingest' && arg) {
    const r = ingest(arg === '-' ? fs.readFileSync(0, 'utf8') : read(arg));
    console.log(`${r.rows} verdict rows: ${r.added} added, ${r.revised} revised, ${r.rows - r.added - r.revised} unchanged`);
  } else if (cmd === 'status') {
    for (const [round, s] of Object.entries(status())) {
      const tail = s.proseOnly ? ' (verdicts recorded as prose only)' : '';
      console.log(`${round}${s.wave ? ` (${s.wave})` : ''}: ${s.pending}/${s.cards} pending, ${s.picked} picked, ${s.kept} kept${tail}`);
    }
  } else if (cmd === 'kept') {
    for (const k of kept()) console.log(`${k.round}\t${k.sample}`);
  } else if (cmd === 'render' && arg) {
    process.stdout.write(render(arg));
  } else {
    console.error('usage: node tools/audio/choices.mjs ingest <file|-> | status | kept | render <round>');
    process.exit(2);
  }
}
