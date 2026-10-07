// The owner's AU2 batch, strictly serial through the guard. Safe to resume:
// completed files are skipped, ambiguous files/reservations are never retried.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { estimate } from './elevenlabs.mjs';
const samples=JSON.parse(fs.readFileSync('tools/audio/audition-plan-r2.json')).samples;
for (const sample of samples) {
  if (fs.existsSync('tools/audio/STOP.json')) { console.log('STOP present; batch ends.'); break; }
  const ledger=fs.readFileSync('tools/audio/ledger.jsonl','utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const out=`docs/audio/audition/r2/${sample.id}.mp3`;
  if (ledger.some(e=>e.out===out)) continue;
  const b=JSON.parse(fs.readFileSync('tools/audio/budget.json'));
  const spent=ledger.filter(e=>e.wave==='AU2').reduce((sum,e)=>sum+e.chargedCredits,0);
  const upper=estimate(sample.kind,sample.seconds,sample.prompt.length,b);
  if (spent+upper>b.capCredits) {
    fs.appendFileSync('tools/audio/requests.jsonl',JSON.stringify({ts:new Date().toISOString(),event:'brief_deferred',wave:'AU2',id:sample.id,reason:'insufficient round cap for estimate',spent,upper})+'\n');
    console.log(JSON.stringify({deferred:sample.id,spent,upper})); continue;
  }
  console.log(`Rendering ${sample.id}`);
  const result=spawnSync(process.execPath,['tools/audio/run-sample.mjs',sample.id],{stdio:'inherit',shell:false});
  if (result.status!==0) { process.exitCode=1; break; }
}
