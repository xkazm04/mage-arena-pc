// AU2b only. Serial requests through the guard; never auto-retry a paid POST.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { estimate } from './elevenlabs.mjs';
const plan=JSON.parse(fs.readFileSync('tools/audio/audition-plan-r3.json'));
const selected=process.argv[2];
if(selected && !plan.samples.some(s=>s.id===selected)) throw Error('Unknown AU2b brief');
for(const s of plan.samples.filter(s=>!selected || s.id===selected)) {
  if(fs.existsSync('tools/audio/STOP.json')) { console.log('STOP present; batch ends.'); process.exitCode=1; break; }
  const b=JSON.parse(fs.readFileSync('tools/audio/budget.json'));
  if(b.wave!=='AU2b'||b.status!=='audition') throw Error('AU2b is not open');
  const ledger=fs.readFileSync('tools/audio/ledger.jsonl','utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const out=`docs/audio/audition/r3/${s.id}.mp3`;
  if(ledger.some(e=>e.out===out)) continue;
  const spent=ledger.filter(e=>e.wave===b.wave).reduce((n,e)=>n+e.chargedCredits,0);
  const upper=estimate(s.kind,s.seconds,s.prompt.length,b);
  if(spent+upper>b.capCredits) {
    fs.appendFileSync('tools/audio/requests.jsonl',JSON.stringify({ts:new Date().toISOString(),event:'brief_deferred',wave:b.wave,id:s.id,reason:'insufficient cap',spent,upper})+'\n');
    console.log(JSON.stringify({deferred:s.id,spent,upper})); break;
  }
  console.log(`Rendering ${s.id}`);
  const args=['tools/audio/elevenlabs.mjs',s.kind,s.kind==='music'?'--prompt':'--text',s.prompt,'--seconds',String(s.seconds),'--out',out];
  const r=spawnSync(process.execPath,args,{stdio:'inherit',shell:false});
  if(r.status!==0) { process.exitCode=1; break; }
}
