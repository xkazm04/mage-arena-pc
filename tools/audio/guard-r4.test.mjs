import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {epochFunds,measuredDelta,validateTrack} from './run-r4.mjs';
import {checkFunds} from './elevenlabs.mjs';
const b={wave:'AU3',status:'production',capCredits:10000,reserveCredits:1000,stopBelowCredits:1000,minRequestGapMs:8000,musicSettlementMs:30000,bounds:{musicPerSecond:30}};
const plan=JSON.parse(fs.readFileSync(new URL('./composition-plan-r4.json',import.meta.url)));
test('exact six-section v1 plans, no lyrics or prompt-mode fields',()=>{
 for(const t of plan.tracks)validateTrack(t);
 for(const change of [t=>t.request.composition_plan.sections.pop(),t=>t.request.composition_plan.sections[0].lines.push('voice'),t=>t.request.force_instrumental=true,t=>t.id='camp-A']) {
  const t=structuredClone(plan.tracks[0]);change(t);assert.throws(()=>validateTrack(t));
 }
});
test('floor and job cap persist across reset; stale counters cannot spend twice',()=>{
 assert.doesNotThrow(()=>checkFunds(b,4500,0,5500,4500));
 assert.throws(()=>checkFunds(b,4500,0,5499,4500));
 assert.throws(()=>checkFunds(b,9000,0,90000,2700));
 const epoch={remaining:10689,resetsAt:'old',spentAtStart:0};
 assert.equal(epochFunds({epoch},{remaining:10689,resetsAt:'old'},4500).remaining,6189);
 assert.equal(epochFunds({epoch},{remaining:90000,resetsAt:'new'},9000).remaining,90000);
 assert.equal(measuredDelta({remaining:1600,resetsAt:'old'},{remaining:89000,used:1000,resetsAt:'new'}),1000);
});
function fixture(t,scenario){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mage-au3-'));
 t.after(()=>{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('mage-au3-'));fs.rmSync(dir,{recursive:true,force:true});});
 const base=path.join(dir,'tools/audio');fs.mkdirSync(base,{recursive:true});
 for(const name of ['elevenlabs.mjs','run-r4.mjs','composition-plan-r4.json'])fs.copyFileSync(new URL(name,import.meta.url),path.join(base,name));
 fs.writeFileSync(path.join(base,'budget.json'),JSON.stringify(b));
 const mock=`import fs from 'node:fs';
 const timer=globalThis.setTimeout;globalThis.setTimeout=(f,ms,...a)=>timer(f,ms>=2000?0:ms,...a);
 let gets=0;globalThis.fetch=async(url,init)=>{
 fs.appendFileSync(${JSON.stringify(path.join(dir,'calls'))},init.method+'\\n');
 if('${scenario}'==='get429')return Response.json({detail:{status:'rate_limit_exceeded'}},{status:429});
 if(init.method==='GET')return Response.json({tier:'starter',character_count:${scenario==='floor'?'84501':"(gets++===0?79311:83811)"},character_limit:90000,next_character_count_reset_unix:1791142301});
 ${scenario==='post429' ? "return Response.json({detail:{status:'rate_limit_exceeded'}},{status:429});" : scenario==='quota' ? "return Response.json({detail:{status:'quota_exceeded'}},{status:401});" : "return new Response(new Uint8Array([73,68,51,0]),{headers:{'content-type':'audio/mpeg'}});"}
 };`;
 fs.writeFileSync(path.join(dir,'mock.mjs'),mock);
 const run=(id='arena-C-reed-oath')=>spawnSync(process.execPath,['--import',pathToFileURL(path.join(dir,'mock.mjs')).href,path.join(base,'run-r4.mjs'),id],{cwd:dir,encoding:'utf8',env:{...process.env,ELEVENLABS_API_KEY:'fake-intercepted'}});
 return {dir,base,run,calls:()=>fs.existsSync(path.join(dir,'calls'))?fs.readFileSync(path.join(dir,'calls'),'utf8'):''};
}
for(const scenario of ['get429','post429','quota'])test(`AU3 stops on first ${scenario} and retains ambiguous reservation`,t=>{
 const f=fixture(t,scenario);assert.equal(f.run().status,1);assert.ok(fs.existsSync(path.join(f.base,'STOP.json')));
 assert.equal((f.calls().match(/POST/g)||[]).length,scenario==='get429'?0:1);
 const before=f.calls();assert.equal(f.run().status,1);assert.equal(f.calls(),before);
 if(scenario!=='get429')assert.ok(JSON.parse(fs.readFileSync(path.join(f.base,'state.json'))).pending);
});
test('fresh account floor check prevents paid request',t=>{const f=fixture(t,'floor');assert.equal(f.run().status,1);assert.equal(f.calls(),'GET\n');});
test('order, pending reservation, closed budget and existing output prevent HTTP',t=>{
 const f=fixture(t,'ok');assert.equal(f.run('arena-D-lyre-under-iron').status,1);assert.equal(f.calls(),'');
 fs.writeFileSync(path.join(f.base,'state.json'),JSON.stringify({pending:{reservedCredits:4500}}));assert.equal(f.run().status,1);assert.equal(f.calls(),'');
 fs.writeFileSync(path.join(f.base,'state.json'),'{}');fs.writeFileSync(path.join(f.base,'budget.json'),JSON.stringify({...b,status:'closed'}));assert.equal(f.run().status,1);assert.equal(f.calls(),'');
});
test('success saves equal ledger and sidecar, settles conservative debit, refuses overwrite',t=>{
 const f=fixture(t,'ok'),r=f.run();assert.equal(r.status,0,r.stderr);
 const ledger=JSON.parse(fs.readFileSync(path.join(f.base,'ledger.jsonl'),'utf8'));
 assert.deepEqual(ledger,JSON.parse(fs.readFileSync(path.join(f.dir,ledger.out+'.json'))));assert.equal(ledger.chargedCredits,4500);
 assert.equal(JSON.parse(fs.readFileSync(path.join(f.base,'state.json'))).pending,null);
 const calls=f.calls();assert.equal(f.run().status,1);assert.equal(f.calls(),calls);
});
