import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { bridgeRules, type SeasonBout } from '@mage/core';
import { presets } from '@mage/core/arena';
import type { SeasonView } from '../../game/src/season-api.ts';
const base=process.env.CAMP_URL??'http://127.0.0.1:4181';
const preparedSave=process.argv.includes('--prepared-save');
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
try {
  const page=await browser.newPage({viewport:{width:1920,height:1080}}), errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/camp?harness=1`); await page.waitForSelector('body[data-ready=true]');
  const api=<T>(path:string,body?:unknown)=>page.evaluate(async({path,body})=>{
    const r=await fetch(`/api/${path}`,body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{});
    const value=await r.json();if(!r.ok)throw Error(value.error);return value;
  },{path,body}) as Promise<T>;
  const view=()=>api<SeasonView>('session');
  const command=async(type:string,place?:string)=>api('command',{revision:(await view()).revision,command:{type,...(place?{place}:{})}});
  const season=async(command:unknown)=>api('season',{revision:(await view()).revision,command});
  while((await view()).day.day<6){for(const type of ['wait','wait','wait','dawn'])await command(type);}
  await command('wait');await command('travel','pit');await season({type:'trial'});
  while((await view()).season.trial!.phase==='active') {
    const tell=(await view()).season.trial!.tell!;
    await season({type:'exchange',stance:Object.entries(bridgeRules.trial.beats).find(([,v])=>v===tell)![0]});
  }
  await season({type:'receive-trial'});await command('wait');await command('dawn');
  await page.locator('#prepare-games').waitFor();
  for(let i=0;i<6;i++) {
    await page.locator('#prepare-games').click();await page.locator('#composition[open]').waitFor();
    assert.equal(await page.locator('#composition').count(),1);
    if(i%2) await page.keyboard.press('Escape'); else await page.locator('#composition-cancel').click();
    await page.waitForFunction(()=>document.querySelector('#composition')===null);
  }
  if(preparedSave) {
    await season({type:'prepare',composition:presets[2]});await api('pause',{paused:true});await api('save',{});
    assert.equal((await api<SeasonBout>('bout')).phase,'prepared');
    await page.locator('#settings').click();await page.locator('#settings-dialog[open]').waitFor();
    await page.locator('#load-season').click();await page.waitForFunction(()=>document.querySelector('#save-status')?.textContent==='Save loaded. Resume when ready.');
    assert.equal((await api<SeasonBout>('bout')).phase,'active');assert.equal((await api<SeasonBout>('bout')).games!.state.tick,0);
    assert.equal((await view()).season.paused,true);
    await page.locator('#resume-season').click();await page.locator('#settings-dialog[open]').waitFor({state:'hidden'});
  } else {await page.locator('#prepare-games').click();await page.locator('[data-preset="2"]').click();await page.locator('#composition-start').click();}
  await page.waitForFunction(()=>!!(window as Window&{__seasonArena?:unknown}).__seasonArena);
  const id=(await api<SeasonBout>('bout')).id;
  for(let i=0;i<8;i++) {
    await page.locator('#main-menu').click();await page.locator('#continue-season').waitFor();assert.equal(await page.locator('canvas').count(),0);
    await page.locator('#continue-season').click();await page.waitForFunction(()=>!!(window as Window&{__seasonArena?:unknown}).__seasonArena);
    assert.equal(await page.locator('canvas').count(),1);assert.equal(await page.locator('.parley-dialog').count(),0);
    assert.equal((await api<SeasonBout>('bout')).id,id);
  }
  await page.locator('#settings').click();await page.locator('#settings-dialog[open]').waitFor();
  const stopped=(await api<SeasonBout>('bout')).games!.state.tick;await page.waitForTimeout(500);
  assert.equal((await api<SeasonBout>('bout')).games!.state.tick,stopped);
  assert.equal(await page.locator('#pause').textContent(),'Resume');
  await page.locator('#resume-season').click(); await page.locator('#settings-dialog[open]').waitFor({state:'hidden'});
  assert.equal(await page.locator('#pause').textContent(),'Pause');
  assert.equal((await view()).season.receipts.length,1,'Navigation does not add a reward.');
  assert.deepEqual(errors,[]);
  const report={label:'measured production browser lifecycle; ordinary API commands prepare day 7, real DOM controls exercise cancellation/navigation',command:'npx tsx packages/tools/src/w7-scenes-browser.ts',composerCancellations:6,arenaRemounts:8,boutId:id,acceptedTick:stopped,receipts:1,errors,passed:true};
  writeFileSync(`docs/waves/W7-evidence/scenes-${preparedSave?'prepared-save':'browser'}.json`,JSON.stringify({...report,preparedSave,command:`npx tsx packages/tools/src/w7-scenes-browser.ts${preparedSave?' --prepared-save':''}`},null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();}
