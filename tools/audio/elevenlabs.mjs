#!/usr/bin/env node
// Adapted from garden-vr/tools/audio/elevenlabs.mjs, read-only source 2026-10-02.
// AU1: shared balance upper bounds, durable reservations, quota latch; no POST retries.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const API = 'https://api.elevenlabs.io';
const json = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const write = (f, v) => { const tmp = f + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(v, null, 2) + '\n'); fs.renameSync(tmp, f); };
const append = (name, v) => fs.appendFileSync(path.join(here, name), JSON.stringify({ ts: new Date().toISOString(), ...v }) + '\n');
const rows = name => fs.existsSync(path.join(here, name)) ? fs.readFileSync(path.join(here, name), 'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse) : [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const stopPath = path.join(here, 'STOP.json');
const statePath = path.join(here, 'state.json');
const budget = () => {
  const b = json(path.join(here, 'budget.json'));
  if (!Number.isFinite(b.capCredits) || b.capCredits > 4000 || b.capCredits <= 0 || !Number.isFinite(b.reserveCredits) || b.reserveCredits < 8000) throw Error('Invalid AU1 cap/reserve');
  return b;
};
function latch(reason, extra = {}) {
  if (!fs.existsSync(stopPath)) write(stopPath, { ts: new Date().toISOString(), reason, ...extra });
}
function apiKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  for (const f of ['C:/Users/kazda/kiro/garden-vr/.env', 'C:/Users/kazda/kiro/pof/.env']) {
    if (!fs.existsSync(f)) continue;
    const match = fs.readFileSync(f, 'utf8').match(/^\s*(?:export\s+)?ELEVENLABS_API_KEY\s*=\s*(.+)\s*$/m);
    if (match) return match[1].trim().replace(/^(["'])(.*)\1$/, '$2');
  }
  throw Error('ELEVENLABS_API_KEY unavailable');
}
// Never log init, authorization headers, raw provider bodies, or environment values.
async function request(endpoint, body) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(API + endpoint, { method: body ? 'POST' : 'GET', headers: { 'xi-api-key': apiKey(), ...(body ? { 'content-type': 'application/json', accept: 'audio/mpeg' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(240000) });
    if (r.ok) return r;
    let code = 'http_error';
    try { const d = await r.json(); if (typeof d.detail?.status === 'string' && /^[a-z_]+$/i.test(d.detail.status)) code = d.detail.status; } catch {}
    if (r.status === 429 || r.status === 402 || /quota|rate_limit|credit|payment/.test(code)) latch('provider_quota_or_rate_limit', { status: r.status, code, endpoint: endpoint.split('?')[0], method: body ? 'POST' : 'GET' });
    if (!body && r.status === 429 && attempt < 3) { await sleep(4000 * 2 ** attempt); continue; }
    throw Error(`Provider request failed: HTTP ${r.status}, ${code}; no generation retry`);
  }
}
async function credits() {
  const d = await (await request('/v1/user/subscription')).json();
  if (![d.character_count, d.character_limit].every(Number.isFinite)) throw Error('Invalid subscription counters');
  return { observedAt: new Date().toISOString(), tier: d.tier, used: d.character_count, limit: d.character_limit, remaining: d.character_limit - d.character_count, resetsAt: new Date(d.next_character_count_reset_unix * 1000).toISOString() };
}
export function estimate(kind, seconds, chars, b) {
  const n = kind === 'sfx' ? Math.max(b.bounds.sfxMinimum, Math.ceil(seconds * b.bounds.sfxPerSecond)) : kind === 'music' ? Math.ceil(seconds * b.bounds.musicPerSecond) : Math.ceil(chars * b.bounds.ttsPerCharacter);
  if (!Number.isFinite(n) || n <= 0) throw Error('Invalid cost bound');
  return n;
}
export function accountCost(delta, estimated, header = null) {
  const flags = [];
  if (delta === null) flags.push('balance_unavailable');
  else if (delta < 0) flags.push('negative_balance_delta');
  else if (delta > estimated * 2) flags.push('shared_delta_implausibly_large');
  if (delta === 0) flags.push('balance_may_lag');
  return { chargedCredits: Math.max(delta ?? 0, estimated, header ?? 0), flags };
}
export function checkFunds(b, spent, reserved, remaining, upper) {
  if (![spent, reserved, remaining, upper].every(Number.isFinite) || spent < 0 || reserved < 0 || upper <= 0) throw Error('Invalid guard inputs');
  if (spent + reserved + upper > b.capCredits) throw Error(`Project cap refusal: ${spent}+${reserved}+${upper} > ${b.capCredits}`);
  if (remaining - reserved - upper < b.reserveCredits) throw Error(`Shared reserve refusal: ${remaining}-${reserved}-${upper} < ${b.reserveCredits}`);
}
function args(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) { const k = argv[i].slice(2); a[k] = argv[i+1] && !argv[i+1].startsWith('--') ? argv[++i] : true; }
    else a._.push(argv[i]);
  }
  return a;
}
async function generate(kind, a) {
  if (fs.existsSync(stopPath)) throw Error('Generation stopped: persistent STOP.json exists');
  const b = budget();
  if (!['proofs', 'audition'].includes(b.status)) throw Error('Generation closed in budget.json');
  const previous = fs.existsSync(statePath) ? json(statePath) : { pending: null };
  if (previous.pending) throw Error('Unresolved billable reservation: reconcile before more generation');
  const need = k => { if (typeof a[k] !== 'string' || !a[k]) throw Error(`--${k} required`); return a[k]; };
  const text = a['text-file'] ? fs.readFileSync(path.resolve(root, a['text-file']), 'utf8') : need(kind === 'music' ? 'prompt' : 'text');
  const seconds = kind === 'tts' ? null : Number(need('seconds'));
  if (kind === 'sfx' && (!Number.isFinite(seconds) || seconds < 0.5 || seconds > 30)) throw Error('SFX duration must be 0.5–30 s');
  if (kind === 'music' && (!Number.isFinite(seconds) || seconds < 20 || seconds > 30)) throw Error('AU1 music duration must be 20–30 s');
  const out = path.resolve(root, need('out'));
  const relative = path.relative(path.join(root, 'docs/audio/audition/r1'), out);
  if (relative.startsWith('..') || path.isAbsolute(relative) || !out.endsWith('.mp3')) throw Error('AU1 outputs must be MP3s inside audition/r1');
  if (fs.existsSync(out) || fs.existsSync(out + '.json')) throw Error('Output already exists; no paid overwrite');
  const model = kind === 'sfx' ? 'eleven_text_to_sound_v2' : kind === 'music' ? 'music_v1' : 'eleven_multilingual_v2';
  const voice = kind === 'tts' ? need('voice') : null;
  if (voice && !/^[a-zA-Z0-9]+$/.test(voice)) throw Error('Invalid voice id');
  const body = kind === 'sfx' ? { text, duration_seconds: seconds, prompt_influence: 0.5, model_id: model, loop: !!a.loop }
    : kind === 'music' ? { prompt: text, music_length_ms: Math.round(seconds * 1000), force_instrumental: !a.vocals, model_id: model }
    : { text, model_id: model, voice_settings: { stability: 0.65, similarity_boost: 0.75, style: 0.1, use_speaker_boost: true } };
  const spent = rows('ledger.jsonl').reduce((sum, e) => sum + e.chargedCredits, 0);
  const upper = estimate(kind, seconds, text.length, b);
  const before = await credits();
  if (fs.existsSync(stopPath)) throw Error('Read-only lookup tripped stop latch; no POST');
  const initial = previous.initial || before;
  if (initial.resetsAt !== before.resetsAt) throw Error('Account reset changed; AU1 requires reconciliation');
  // Account counters may lag. Never spend the same unreflected balance twice.
  // Retain the entire local debit as lag allowance against the latest shared read.
  // This can double-count settled local charges, deliberately favouring the reserve.
  const conservativeRemaining = Math.min(before.remaining, initial.remaining) - spent;
  try { checkFunds(b, spent, 0, conservativeRemaining, upper); }
  catch (e) { latch('cap_or_reserve_refusal', { spentCredits: spent, estimatedCredits: upper }); throw e; }
  const pending = { id: crypto.randomUUID(), kind, out: path.relative(root, out).replaceAll('\\', '/'), reservedCredits: upper, before, body, startedAt: new Date().toISOString() };
  write(statePath, { initial, pending });
  append('requests.jsonl', { event: 'reserved', ...pending });
  const endpoint = kind === 'sfx' ? '/v1/sound-generation' : kind === 'music' ? '/v1/music' : `/v1/text-to-speech/${voice}`;
  let r;
  try { r = await request(endpoint + '?output_format=mp3_44100_128', body); }
  catch (e) { throw e; } // Durable pending reservation protects an unknown outcome; no billing-fault latch.
  const billingHeaders = {};
  for (const name of ['character-cost', 'x-character-cost', 'request-id', 'x-request-id', 'history-item-id']) if (r.headers.has(name)) billingHeaders[name] = r.headers.get(name);
  const buf = Buffer.from(await r.arrayBuffer());
  if (!buf.length) throw Error('Empty response; reservation retained');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buf, { flag: 'wx' });
  // Save provenance immediately, even if later billing lookup fails.
  const entry = { id: pending.id, ts: pending.startedAt, kind, model, voice, text, seconds, chars: kind === 'tts' ? text.length : null, out: pending.out, request: body, billingHeaders, bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex'), accountBefore: before, reservedCredits: upper, estimatedCredits: upper, documentedEstimateCredits: estimate(kind, seconds, text.length, { bounds: b.documentedBounds }), chargedCredits: upper, measuredCredits: null, costBasis: 'max-shared-delta-estimate-header' };
  write(out + '.json', entry);
  const costHeader = billingHeaders['character-cost'] ?? billingHeaders['x-character-cost'];
  const measured = costHeader !== undefined && /^\d+(\.\d+)?$/.test(costHeader) ? Number(costHeader) : null;
  let after = null;
  try {
    after = await credits();
  } catch { /* Fall back to reserved estimate, flag missing snapshot, never zero cost. */ }
  entry.accountAfter = after;
  entry.accountDelta = after ? before.remaining - after.remaining : null;
  entry.measuredCredits = measured;
  Object.assign(entry, accountCost(entry.accountDelta, upper, measured));
  entry.deltaBasis = 'shared-account upper-bound proxy, not attributed billing; may include concurrent or delayed charges';
  write(out + '.json', entry);
  append('ledger.jsonl', entry);
  append('requests.jsonl', { event: 'completed', id: pending.id, chargedCredits: entry.chargedCredits, costBasis: entry.costBasis });
  write(statePath, { initial, pending: null, spentCredits: spent + entry.chargedCredits });
  if (spent + entry.chargedCredits >= b.capCredits) latch('project_cap_reached', { spentCredits: spent + entry.chargedCredits });
  if (after && after.remaining < b.reserveCredits) latch('shared_reserve_reached', { remaining: after.remaining });
  console.log(JSON.stringify({ ok: true, out: pending.out, measuredCredits: measured, chargedCredits: entry.chargedCredits, accountRemaining: after?.remaining, billingHeaders, totalSpent: spent + entry.chargedCredits, latched: fs.existsSync(stopPath) }));
}
async function main() {
  const a = args(process.argv.slice(2)), cmd = a._[0];
  if (cmd === 'credits') { console.log(JSON.stringify(await credits(), null, 2)); return; }
  if (cmd === 'usage') {
    // Read-only analytics query, never a generation, permitted while latched.
    const start = Date.parse(a.from), end = Date.parse(a.to);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 3600000) throw Error('usage requires --from/--to ISO times within one hour');
    const d = await (await request('/v1/workspace/analytics/requests', { start_time: start, end_time: end, limit: 1000 })).json();
    const allowed = new Set(['timestamp', 'request_id', 'model_id', 'endpoint', 'path', 'status', 'status_code', 'character_cost', 'credit_cost', 'credits', 'cost', 'character_count', 'duration_ms']);
    const indices = (d.columns || []).map((c, i) => allowed.has(c) ? i : -1).filter(i => i >= 0);
    console.log(JSON.stringify({ columns: (d.columns || []).filter(c => allowed.has(c)), rows: (d.rows || []).map(row => indices.map(i => row[i])), availableColumnNames: (d.columns || []).filter(c => !/key|token|secret|authorization/i.test(c)) }, null, 2)); return;
  }
  if (cmd === 'voices') {
    const d = await (await request('/v1/voices')).json();
    console.log(JSON.stringify((d.voices || []).filter(v => !a.filter || (v.name + ' ' + JSON.stringify(v.labels)).toLowerCase().includes(String(a.filter).toLowerCase())).map(v => ({ id: v.voice_id, name: v.name, category: v.category, labels: v.labels })), null, 2)); return;
  }
  if (!['sfx', 'tts', 'music'].includes(cmd)) throw Error('usage: credits | voices [--filter] | sfx --text --seconds --out [--loop] | music --prompt --seconds --out | tts --text --voice --out');
  const lock = path.join(here, '.generation.lock');
  let fd;
  try { fd = fs.openSync(lock, 'wx'); } catch { throw Error('Another generation or stale lock exists; no call made'); }
  try { await generate(cmd, a); } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error(JSON.stringify({ ok: false, error: e.message })); process.exitCode = 1; });
