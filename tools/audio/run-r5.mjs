#!/usr/bin/env node
// AU5: the deferred Hide and iron score on music_v2_5, conditioned on the kept
// r1 audition. One upload, then one compose; never a paid automatic retry.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { guarded as g, checkFunds } from './elevenlabs.mjs';
import { epochFunds, measuredDelta } from './run-r4.mjs';
const statePath = path.join(g.here, 'state.json');
const evidence = path.join(g.root, 'docs/audio/evidence/r5');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
export function buildRequest(plan, songId) {
  const track = plan.tracks[0], chunks = structuredClone(track.composition_plan.chunks);
  if (plan.model_id !== 'music_v2_5' || track.id !== 'arena-A-hide-and-iron' || track.seconds !== 150 || chunks.length !== 6 || chunks.reduce((n, c) => n + c.duration_ms, 0) !== 150000 || chunks.some(c => !/^\[[A-Za-z ]+\]$/.test(c.text) || !c.negative_styles.includes('Vocals'))) throw Error('Invalid AU5 plan');
  for (const c of plan.conditioning) {
    if (c.range.end_ms - c.range.start_ms > 30000 || c.range.end_ms > plan.reference.seconds * 1000) throw Error('Conditioning range outside the reference');
    Object.assign(chunks[c.chunk], { conditioning_ref: { song_id: songId, range: c.range }, condition_strength: c.condition_strength });
  }
  return { model_id: plan.model_id, store_for_inpainting: true, composition_plan: { chunks } };
}
// Same accounting as run-r4: durable reservation before, settled shared delta after.
async function paid(step, endpoint, body, seconds, save) {
  const b = g.budget(), previous = fs.existsSync(statePath) ? g.json(statePath) : {};
  if (previous.pending) throw Error('Unresolved billable reservation');
  const ledger = g.rows('ledger.jsonl').filter(e => e.wave === 'AU5');
  if (ledger.some(e => e.step === step)) throw Error(`${step} already done; no paid repeat`);
  const spent = ledger.reduce((n, e) => n + e.chargedCredits, 0), estimate = Math.ceil(seconds * b.bounds.musicPerSecond);
  const before = await g.credits();
  if (fs.existsSync(g.stopPath)) throw Error('Preflight latched STOP');
  const funds = epochFunds(previous.wave === 'AU5' ? previous : {}, before, spent);
  checkFunds(b, spent, 0, funds.remaining, estimate);
  const pending = { id: crypto.randomUUID(), wave: 'AU5', step, endpoint, reservedCredits: estimate, before, startedAt: new Date().toISOString() };
  g.write(statePath, { wave: 'AU5', epoch: funds.epoch, pending, spentCredits: spent });
  g.append('requests.jsonl', { event: 'reserved', ...pending, body: body instanceof FormData ? '[multipart reference upload]' : body });
  const response = await g.request(endpoint, body);
  const entry = { id: pending.id, wave: 'AU5', step, ts: pending.startedAt, seconds, estimatedCredits: estimate, accountBefore: before, billingHeaders: g.safeHeaders(response), flags: [], ...(await save(response)) };
  let after = null;
  try { after = await g.credits(); } catch { g.latch('postflight_balance_unavailable'); }
  entry.accountAfter = after; entry.accountDelta = measuredDelta(before, after); entry.settlementReads = [];
  if (after && !fs.existsSync(g.stopPath)) for (let attempt = 0; attempt < 3; attempt++) {
    await g.sleep(b.musicSettlementMs);
    try { entry.settlementReads.push(await g.credits()); } catch { g.latch('settlement_balance_unavailable'); break; }
    if (measuredDelta(before, entry.settlementReads.at(-1)) >= estimate || fs.existsSync(g.stopPath)) break;
  }
  entry.settledDelta = entry.settlementReads.length ? Math.max(...entry.settlementReads.map(s => measuredDelta(before, s))) : null;
  const header = entry.billingHeaders['character-cost'] ?? entry.billingHeaders['x-character-cost'];
  entry.measuredCredits = header !== undefined && /^\d+(\.\d+)?$/.test(header) ? Number(header) : null;
  entry.chargedCredits = Math.max(estimate, entry.accountDelta ?? 0, entry.settledDelta ?? 0, entry.measuredCredits ?? 0);
  if (!after) entry.flags.push('balance_unavailable');
  entry.deltaBasis = 'Shared-account upper-bound proxy; may include other projects or delayed usage, not exclusive invoice attribution.';
  g.append('ledger.jsonl', entry);
  g.append('requests.jsonl', { event: 'completed', id: entry.id, wave: 'AU5', chargedCredits: entry.chargedCredits });
  g.write(statePath, { wave: 'AU5', epoch: funds.epoch, pending: null, spentCredits: spent + entry.chargedCredits });
  if (spent + entry.chargedCredits >= b.capCredits) g.latch('project_cap_reached', { spentCredits: spent + entry.chargedCredits });
  return entry;
}
async function run(cmd) {
  const b = g.budget();
  if (b.wave !== 'AU5') throw Error('AU5 budget required');
  if (cmd === 'credits') { console.log(JSON.stringify(await g.credits())); return; }
  if (fs.existsSync(g.stopPath)) throw Error('Persistent STOP: no further generation');
  if (b.status !== 'production') throw Error('AU5 production is closed');
  const plan = g.json(path.join(g.here, 'composition-plan-r5.json'));
  fs.mkdirSync(evidence, { recursive: true });
  const uploadPath = path.join(evidence, 'reference-upload.json');
  if (cmd === 'upload') {
    const bytes = fs.readFileSync(path.join(g.root, plan.reference.file));
    if (sha(bytes) !== plan.reference.sha256) throw Error('Reference bytes differ from the kept audition');
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: 'audio/mpeg' }), 'arena-A-hide-and-iron.mp3');
    const entry = await paid('upload', '/v1/music/upload', form, plan.reference.seconds, async r => {
      const d = await r.json();
      if (typeof d.song_id !== 'string' || !d.song_id) throw Error('Upload returned no song_id; reservation retained');
      return { reference: plan.reference, songId: d.song_id };
    });
    g.write(uploadPath, entry);
    console.log(JSON.stringify({ ok: true, step: 'upload', songId: entry.songId, chargedCredits: entry.chargedCredits }));
    return;
  }
  if (cmd !== 'compose') throw Error('usage: run-r5.mjs credits | upload | compose');
  const upload = g.json(uploadPath), track = plan.tracks[0];
  const request = buildRequest(plan, upload.songId);
  const relative = `docs/audio/audition/r5/${track.id}.mp3`, out = path.join(g.root, relative);
  if (fs.existsSync(out) || fs.existsSync(out + '.json')) throw Error('No paid overwrite');
  const entry = await paid('compose', `/v1/music?output_format=${plan.output_format}`, request, track.seconds, async r => {
    const bytes = Buffer.from(await r.arrayBuffer());
    if (!bytes.length || !/audio|octet-stream/.test(r.headers.get('content-type') || '')) throw Error('Invalid audio response; reservation retained');
    fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, bytes, { flag: 'wx' });
    const side = { trackId: track.id, kind: 'music', model: plan.model_id, out: relative, outputFormat: plan.output_format, request, bytes: bytes.length, sha256: sha(bytes), songId: r.headers.get('song-id') };
    g.write(out + '.json', side); // Provenance before any billing failure.
    return side;
  });
  g.write(out + '.json', entry);
  console.log(JSON.stringify({ ok: true, step: 'compose', out: relative, sha256: entry.sha256, chargedCredits: entry.chargedCredits, accountRemaining: entry.settlementReads.at(-1)?.remaining ?? entry.accountAfter?.remaining }));
}
async function main() {
  const lock = path.join(g.here, '.generation.lock'); let fd;
  try { fd = fs.openSync(lock, 'wx'); } catch { throw Error('Existing shared API lock; no call'); }
  try { await run(process.argv[2]); } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error(JSON.stringify({ ok: false, error: e.message })); process.exitCode = 1; });
