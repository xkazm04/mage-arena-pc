import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const out='docs/waves/W7-evidence', url='http://127.0.0.1:4180';
if(existsSync(`${out}/director-browser.json`)) throw Error('Live browser sample exists; do not repeat paid work.');
const ledger='.director-runtime/w7-ledger.json';
const count=()=>JSON.parse(readFileSync(ledger,'utf8')).reservations.length as number;
const before=count(); assert(before<=15,'Keep room inside the shared twenty-call cap.');
const server=spawn(process.execPath,['--import','tsx','node_modules/vite/bin/vite.js','preview','--config','packages/game/vite.config.ts','--host','127.0.0.1','--port','4180','--strictPort'],{windowsHide:true,env:{...process.env,CAMP_DIRECTOR:'claude'},stdio:'ignore'});
const browser=await chromium.launch({headless:true});
try {
  for(let i=0;i<100;i++){try{if((await fetch(url)).ok)break;}catch{/* readiness */}await new Promise(r=>setTimeout(r,100));}
  const page=await browser.newPage({viewport:{width:1920,height:1080}}), errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${url}/camp`); await page.waitForSelector('body[data-ready=true]');
  for(const slot of ['Dusk','Night']) {
    await page.locator('[data-command="wait"]').click();
    await page.waitForFunction(slot=>document.querySelector('.slots .current')?.textContent===slot,slot);
  }
  await page.locator('[data-place="tent"]').click(); await page.locator('[data-visit]').click();
  await page.locator('[data-command="listen"]').click();
  const deadline=Date.now()+60000;
  while(!(await page.evaluate(async()=> (await(await fetch('/api/session')).json()).nightFinished)) && Date.now()<deadline) await page.waitForTimeout(200);
  assert(await page.evaluate(async()=> (await(await fetch('/api/session')).json()).nightFinished));
  await page.locator('[data-command="dawn"]').click();
  await page.waitForFunction(()=>document.querySelector('.eyebrow')?.textContent?.includes('DAY 2'),{},{timeout:30000});
  await page.locator('[data-scene="board"]').click();
  await page.screenshot({path:`${out}/screens/1080-sonnet-morning-board.png`});
  const view=await page.evaluate(async()=> (await fetch('/api/session')).json());
  const saved=await page.evaluate(async()=> (await fetch('/api/save',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).json());
  assert(!saved.error,saved.error);
  const envelope=JSON.parse(readFileSync('.director-runtime/saves/season.json','utf8'));
  const audit=envelope.payload.camp.night.audit;
  assert.equal(audit.length,5); assert(audit.every((a:{source:string;error:string|null})=>['live','cache'].includes(a.source) && !a.error));
  assert.deepEqual(errors,[]); assert(view.board.length>0); assert(count()<=20); assert(count()-before<=5);
  writeFileSync(`${out}/director-browser.json`,JSON.stringify({label:'measured browser night with validated Sonnet 5.5 medium cache; simulated consequences; two original live browser calls preserved in ledger; feel unmeasured',command:'npx tsx packages/tools/src/w7-director-browser.ts',callsBefore:before,callsAfter:count(),audit,requests:envelope.payload.camp.night.requests,completed:envelope.payload.camp.night.completed,view,errors},null,2)+'\n');
  writeFileSync(`${out}/director-ledger.json`,readFileSync(ledger));
  console.log(JSON.stringify({passed:true,callsBefore:before,callsAfter:count(),board:view.board.length,errors}));
} finally {await browser.close();server.kill();}
