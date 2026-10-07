#!/usr/bin/env node
// D39: exactly one selected structured score, never a paid automatic retry.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { guarded as g, checkFunds } from './elevenlabs.mjs';
const statePath = path.join(g.here, 'state.json');
export function epochFunds(previous, before, spent) {
  const reset = previous.epoch && previous.epoch.resetsAt !== before.resetsAt;
  const epoch = !previous.epoch || reset ? { ...before, spentAtStart: spent } : previous.epoch;
  return { epoch, reset: !!reset, remaining: Math.min(before.remaining, epoch.remaining - (spent - epoch.spentAtStart)) };
}
export function measuredDelta(before, after) {
  if (!after) return null;
  // If the billing period changes, old-period final usage is unknowable. The
  // full reservation remains charged; new-period usage is a conservative proxy.
  return before.resetsAt === after.resetsAt ? Math.max(0, before.remaining - after.remaining) : Math.max(0, after.used);
}
export function validateTrack(track) {
  if (!['arena-C-reed-oath','arena-D-lyre-under-iron','arena-A-hide-and-iron'].includes(track?.id)) throw Error('Track outside D39');
  const r = track.request, sections = r?.composition_plan?.sections;
  if (track.seconds !== 150 || r.model_id !== 'music_v1' || r.respect_sections_durations !== true || r.store_for_inpainting !== true || 'prompt' in r || 'force_instrumental' in r || 'music_length_ms' in r || !sections || sections.length !== 6 || sections.some((s,i)=>s.duration_ms !== [15000,30000,30000,30000,30000,15000][i] || s.lines.length || !s.positive_local_styles.length) || sections.reduce((n,s)=>n+s.duration_ms,0)!==150000) throw Error('Invalid six-section AU3 composition');
}
async function run(id) {
  const b = g.budget();
  if (b.wave !== 'AU3') throw Error('AU3 budget required');
  if (id === 'credits') { console.log(JSON.stringify(await g.credits())); return; }
  if (fs.existsSync(g.stopPath)) throw Error('Persistent STOP: no further generation');
  if (b.status !== 'production') throw Error('AU3 production is closed');
  const previous = fs.existsSync(statePath) ? g.json(statePath) : {};
  if (previous.pending) throw Error('Unresolved billable reservation');
  const plan = g.json(path.join(g.here,'composition-plan-r4.json'));
  const track = plan.tracks.find(t=>t.id===id);
  validateTrack(track);
  const ledger = g.rows('ledger.jsonl').filter(e=>e.wave==='AU3');
  const index = plan.tracks.indexOf(track);
  if (plan.tracks.slice(0,index).some(t=>!ledger.some(e=>e.trackId===t.id))) throw Error('D39 order violation');
  if (index > 0 && !fs.existsSync(path.join(g.root,`docs/audio/evidence/r4/${plan.tracks[index-1].id}-decision.md`))) throw Error('Previous take needs a written evaluation and retry decision');
  const relative = `docs/audio/audition/r4/${id}.mp3`, out = path.join(g.root,relative);
  if (fs.existsSync(out) || fs.existsSync(out+'.json') || ledger.some(e=>e.trackId===id)) throw Error('No paid overwrite or implicit retry');
  const spent = ledger.reduce((n,e)=>n+e.chargedCredits,0), estimate = Math.ceil(track.seconds*b.bounds.musicPerSecond);
  const before = await g.credits(); // Last network operation before paced POST.
  if (fs.existsSync(g.stopPath)) throw Error('Preflight latched STOP');
  const funds = epochFunds(previous,before,spent);
  checkFunds(b,spent,0,funds.remaining,estimate); // Funds refusal is not a provider failure.
  if (funds.reset) g.append('requests.jsonl',{event:'account_reset',wave:'AU3',before,spentCredits:spent});
  const pending = {id:crypto.randomUUID(),wave:'AU3',trackId:id,kind:'music',out:relative,reservedCredits:estimate,before,body:track.request,startedAt:new Date().toISOString()};
  g.write(statePath,{epoch:funds.epoch,pending,spentCredits:spent});
  g.append('requests.jsonl',{event:'reserved',...pending});
  const response = await g.request('/v1/music?output_format=mp3_44100_128',track.request);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || !/audio|octet-stream/.test(response.headers.get('content-type')||'')) throw Error('Invalid audio response; reservation retained');
  fs.mkdirSync(path.dirname(out),{recursive:true}); fs.writeFileSync(out,bytes,{flag:'wx'});
  const headers = g.safeHeaders(response);
  const entry = {...pending,ts:pending.startedAt,seconds:track.seconds,model:'music_v1',request:track.request,text:track.request.composition_plan.positive_global_styles.join('\n'),bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),billingHeaders:headers,accountBefore:before,estimatedCredits:estimate,documentedEstimateCredits:estimate,chargedCredits:estimate,costBasis:'max-shared-delta-estimate-header',flags:[]};
  delete entry.body; delete entry.before;
  g.write(out+'.json',entry); // Preserve provenance before any billing failure.
  let after = null;
  try { after = await g.credits(); } catch { g.latch('postflight_balance_unavailable'); }
  entry.accountAfter=after; entry.accountDelta=measuredDelta(before,after); entry.settlementReads=[];
  if (after && !fs.existsSync(g.stopPath)) for(let attempt=0;attempt<3;attempt++) {
    await g.sleep(b.musicSettlementMs);
    try { const settled=await g.credits(); entry.settlementReads.push(settled); entry.accountSettled=settled; }
    catch { g.latch('settlement_balance_unavailable'); break; }
    if (measuredDelta(before,entry.accountSettled)>=estimate || fs.existsSync(g.stopPath)) break;
  }
  entry.settledDelta=entry.settlementReads.length ? Math.max(...entry.settlementReads.map(s=>measuredDelta(before,s))) : null;
  const header = headers['character-cost'] ?? headers['x-character-cost'];
  entry.measuredCredits=header!==undefined && /^\d+(\.\d+)?$/.test(header) ? Number(header) : null;
  entry.chargedCredits=Math.max(estimate,entry.accountDelta??0,entry.settledDelta??0,entry.measuredCredits??0);
  if ([after,...entry.settlementReads].some(s=>s && s.resetsAt!==before.resetsAt)) entry.flags.push('account_reset_during_call_estimate_retained');
  if (!after) entry.flags.push('balance_unavailable');
  if (entry.accountDelta===0 && entry.settledDelta>0) entry.flags.push('charge_visible_after_settlement');
  entry.deltaBasis='Shared-account upper-bound proxy; may include garden-vr or delayed usage, not exclusive invoice attribution.';
  g.write(out+'.json',entry); g.append('ledger.jsonl',entry);
  g.append('requests.jsonl',{event:'completed',id:entry.id,wave:'AU3',chargedCredits:entry.chargedCredits});
  g.write(statePath,{epoch:funds.epoch,pending:null,spentCredits:spent+entry.chargedCredits});
  if(spent+entry.chargedCredits>=b.capCredits) g.latch('project_cap_reached',{spentCredits:spent+entry.chargedCredits});
  console.log(JSON.stringify({ok:true,out:relative,chargedCredits:entry.chargedCredits,accountRemaining:entry.accountSettled?.remaining??after?.remaining,totalSpent:spent+entry.chargedCredits,latched:fs.existsSync(g.stopPath)}));
}
async function main() {
  const lock=path.join(g.here,'.generation.lock'); let fd;
  try {fd=fs.openSync(lock,'wx');} catch {throw Error('Existing shared API lock; no call');}
  try {await run(process.argv[2]);} finally {fs.closeSync(fd);fs.unlinkSync(lock);}
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) main().catch(e=>{console.error(JSON.stringify({ok:false,error:e.message}));process.exitCode=1;});
