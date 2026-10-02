import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { encodeSave, hash, SaveStore, sourceHash } from '@mage/director';
import { campDay, fixtureService, playBout, trialPolicy } from './season-fixtures.ts';

const minutes=Number(process.argv[2]??30);
if(!Number.isFinite(minutes)||minutes<1||minutes>180) throw Error('Use 1–180 minutes; acceptance requires at least 30.');
const out=`docs/waves/W7-evidence/${minutes>=30?'soak':'soak-probe'}.json`;
const base=process.env.CAMP_URL??'http://127.0.0.1:4181';
const source=sourceHash(), started=Date.now(), ledgerPath='.director-runtime/w7-ledger.json';
const ledgerBefore=readFileSync(ledgerPath,'utf8'), store=new SaveStore();
let service=fixtureService(), seasons=0, simulationDays=0, cycles=0;
const errors:string[]=[], samples:unknown[]=[];
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
const page=await browser.newPage({viewport:{width:1920,height:1080}});
const cdp=await page.context().newCDPSession(page);
page.on('pageerror',e=>errors.push(e.message));
let polls=0; page.on('request',r=>{if(r.url().endsWith('/api/session'))polls++;});
type ArenaProbe={snapshot():{slot:number;state:{tick:number}};performance():{frameCount:number}};
type ProbeWindow=Window&{__arena?:ArenaProbe;__retired?:ArenaProbe};
const report=(passed:boolean)=>({label:'measured wall-clock browser lifecycle soak plus simulated ordinary season policy; no human feel claim',command:`npx tsx packages/tools/src/w7-soak.ts ${minutes}`,passed,requiredMinutes:30,requestedMinutes:minutes,elapsedMs:Date.now()-started,source,cycles,seasons,simulationDays,paidCallsAdded:JSON.parse(readFileSync(ledgerPath,'utf8')).reservations.length-JSON.parse(ledgerBefore).reservations.length,errors,samples});
try {
  await page.goto(`${base}/?harness=1`); await page.locator('#continue-season').waitFor();
  while(Date.now()-started<minutes*60000) {
    const cycleStarted=Date.now();
    if(service.session.camp.day>14){service.close();service=fixtureService(74+seasons++);}
    const view=service.view();
    if(view.day.eve){await service.command({type:'wait'},service.session.revision);await service.command({type:'travel',place:'pit'},service.session.revision);trialPolicy(service);}
    else if(view.day.games) playBout(service,view.day.day===14);
    await campDay(service); simulationDays++;
    store.write(service);
    assert.equal(hash(store.read(service.tables)),hash(JSON.parse(JSON.stringify({camp:service.checkpointCamp(),progress:service.progress}))));
    assert.equal(sourceHash(),source,'No source changes during soak.');
    await page.locator('#main-menu').click(); await page.locator('#menu-load').waitFor();
    const menuPolls=polls; await page.waitForTimeout(400); assert.equal(polls,menuPolls,'Camp polling disposed in menu.');
    await page.locator('#menu-load').click(); await page.waitForFunction(()=>document.querySelector('#save-status')?.textContent==='Save loaded. Resume when ready.');
    await page.locator('#resume-season').click(); await page.waitForSelector('body[data-ready=true]');
    assert.equal(await page.locator('canvas').count(),1);
    const remote=await page.evaluate(async()=> (await fetch('/api/session')).json());
    assert.equal(remote.day.day,service.session.camp.day); assert.deepEqual(remote.season.receipts,service.progress.receipts);
    const pollStart=polls; await page.waitForTimeout(1100); const campPolls=polls-pollStart;
    assert(campPolls>=8 && campPolls<=14,'One camp poll loop remains.');
    await page.locator('#main-menu').click(); await page.locator('#training-arena').click();
    await page.waitForFunction(()=>!!(window as ProbeWindow).__arena);
    assert.equal(await page.locator('canvas').count(),1);
    await page.locator('canvas').focus(); await page.mouse.move(1100,650);
    await page.keyboard.press('Digit1'); await page.mouse.wheel(0,100); await page.waitForTimeout(100);
    assert.equal(await page.evaluate(()=>(window as ProbeWindow).__arena!.snapshot().slot),1,'One wheel event changes one slot after remounts.');
    const tickBefore=await page.evaluate(()=>(window as ProbeWindow).__arena!.snapshot().state.tick);
    await page.keyboard.down('KeyD'); await page.waitForTimeout(250); await page.keyboard.up('KeyD');
    const advanced=await page.evaluate(()=>(window as ProbeWindow).__arena!.snapshot().state.tick)-tickBefore;
    assert(advanced>0 && advanced<60,'One fixed-step clock advances.');
    if(cycles===0){
      const beforeFreeze=await page.evaluate(()=>(window as ProbeWindow).__arena!.snapshot().state.tick);
      await page.evaluate(()=>{const start=performance.now();while(performance.now()-start<2000){ /* Deliberate renderer stall, no simulation calls. */ }});
      await page.waitForTimeout(100);
      const afterFreeze=await page.evaluate(()=>(window as ProbeWindow).__arena!.snapshot().state.tick);
      assert(afterFreeze-beforeFreeze<60,'A two-second renderer stall does not replay two seconds of combat at once.');
    }
    await page.waitForTimeout(1000);
    await page.evaluate(()=>{(window as ProbeWindow).__retired=(window as ProbeWindow).__arena;});
    await page.locator('#main-menu').click(); await page.locator('#continue-season').waitFor();
    const retiredFrames=await page.evaluate(()=>(window as ProbeWindow).__retired!.performance().frameCount);
    await page.waitForTimeout(200); assert.equal(await page.evaluate(()=>(window as ProbeWindow).__retired!.performance().frameCount),retiredFrames,'Disposed arena RAF stays stopped.');
    await page.evaluate(()=>{delete(window as ProbeWindow).__retired;});
    await cdp.send('HeapProfiler.collectGarbage');
    const usage=await cdp.send('Runtime.getHeapUsage');
    samples.push({cycle:++cycles,elapsedMs:Date.now()-started,day:service.session.camp.day,seed:service.session.camp.seed,hash:hash(encodeSave(service).payload),campPolls,advanced,usedHeapSize:usage.usedSize,totalHeapSize:usage.totalSize,nodeHeap:process.memoryUsage().heapUsed});
    assert(usage.usedSize<256*1024*1024,'Retained browser heap stays bounded.');
    assert.deepEqual(errors,[]); assert.equal(readFileSync(ledgerPath,'utf8'),ledgerBefore);
    writeFileSync(out,JSON.stringify(report(false),null,2)+'\n');
    console.log(JSON.stringify({cycle:cycles,minutes:((Date.now()-started)/60000).toFixed(2),day:service.session.camp.day,heapMb:(usage.usedSize/1048576).toFixed(1)}));
    const until=Math.min(started+minutes*60000,cycleStarted+30000);
    if(Date.now()<until) await new Promise(r=>setTimeout(r,until-Date.now()));
  }
  await page.screenshot({path:'docs/waves/W7-evidence/screens/soak-end.png'});
  writeFileSync(out,JSON.stringify(report(minutes>=30),null,2)+'\n');
} catch(e){errors.push(String(e));writeFileSync(out,JSON.stringify(report(false),null,2)+'\n');throw e;}
finally{service.close();await browser.close();}
