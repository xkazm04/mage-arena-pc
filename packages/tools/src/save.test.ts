import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { applyBoutInput, authoredParley, boutHash, bridgeRules, type BoutInput } from '@mage/core';
import { idleInput, presets } from '@mage/core/arena';
import { CostGuard, decodeSave, encodeSave, hash, restoreSave, SaveStore, SeasonService, type ProviderResult } from '@mage/director';
import { campDay, fixtureService, fourteenDays, trialPolicy } from './season-fixtures.ts';
import { knowingFixture } from './parley-fixtures.ts';
import { SeasonPolicy } from './season-policy.ts';

const digest=(service:SeasonService)=>hash(encodeSave(service).payload);
function clone(original:SeasonService) {
  const loaded=new SeasonService(original.tables, original.options);
  restoreSave(loaded,decodeSave(original.tables,JSON.stringify(encodeSave(original)))); loaded.paused=false;
  expect(digest(loaded)).toBe(digest(original)); return loaded;
}
async function gamesMorning() {
  const s=fixtureService();
  while(s.session.camp.day<6) await campDay(s);
  await s.command({type:'wait'},s.session.revision);
  await s.command({type:'travel',place:'pit'},s.session.revision);
  trialPolicy(s); await s.command({type:'wait'},s.session.revision); await s.command({type:'dawn'},s.session.revision);
  return s;
}
const result=(raw:unknown):ProviderResult=>({raw,error:null,elapsedMs:0,inputTokens:0,outputTokens:0,costUsd:null,metadata:{}});

describe('season save', () => {
  it('round trips initial and completed weeks exactly', async () => {
    for (const original of [fixtureService(), await fourteenDays()]) {
      const e = encodeSave(original), loaded = fixtureService();
      restoreSave(loaded, decodeSave(loaded.tables, JSON.stringify(e)));
      expect(hash(encodeSave(loaded).payload)).toBe(hash(encodeSave(original).payload));
      original.close(); loaded.close();
    }
  });
  it('round trips an active stagger and a defeated corpse through the full validated season envelope', async () => {
    const original=await gamesMorning();
    original.seasonCommand({type:'prepare',composition:presets[2]!},original.session.revision);
    original.seasonCommand({type:'start'},original.session.revision);
    let checkedStagger=false;
    while(original.progress.bout!.phase!=='terminal') {
      const b=structuredClone(original.progress.bout!), entries:BoutInput[]=[];
      for(let i=0;i<bridgeRules.limits.batchTicks && b.phase!=='terminal';i++) {
        const g=b.games!, entry:BoutInput={type:'tick',tick:g.state.tick,input:idleInput()};
        applyBoutInput(b,entry);entries.push(entry);
        if(!checkedStagger && g.player.tags.includes('STAGGERED')) break;
      }
      original.boutInputs(b.id,entries,boutHash(b));
      if(!checkedStagger && b.games!.player.tags.includes('STAGGERED')) {
        const loaded=clone(original);expect(loaded.progress.bout!.games!.player.tags).toContain('STAGGERED');
        expect(loaded.progress.bout!.games!.player.staggerImmuneUntil).toBe(b.games!.player.staggerImmuneUntil);loaded.close();checkedStagger=true;
      }
      expect(b.games!.state.tick).toBeLessThan(18000);
    }
    expect(checkedStagger).toBe(true);const loaded=clone(original), corpse=loaded.progress.bout!.games!.player;
    expect(corpse.tags).toEqual(['DEFEATED']);expect(corpse.defeatedTick).toBeDefined();expect(corpse.hp).toBe(0);
    expect(loaded.progress.bout!.games!.state.actors).toContain(corpse);expect(encodeSave(loaded)).toEqual(encodeSave(original));
    original.close();loaded.close();
  },30000);
  it('resumes the same next day', async () => {
    const original=fixtureService(), loaded=fixtureService();
    restoreSave(loaded, decodeSave(loaded.tables, JSON.stringify(encodeSave(original)))); loaded.paused=false;
    await campDay(original); await campDay(loaded);
    expect(hash(encodeSave(loaded).payload)).toBe(hash(encodeSave(original).payload));
    original.close(); loaded.close();
  });
  it('resumes listening at the same tick and earns the same Knowing', async () => {
    const original=fixtureService();
    await original.command({type:'wait'},original.session.revision);
    await original.command({type:'wait'},original.session.revision);
    await original.command({type:'listen'},original.session.revision);
    for(let i=0;i<97;i++) original.tick();
    const loaded=clone(original);
    while(!original.session.nightFinished) {
      const lane=original.view().listening!.beacon;
      for(const s of [original,loaded]) {s.control(lane,true,s.session.camp.day); s.tick();}
    }
    expect(digest(loaded)).toBe(digest(original));
    for(const s of [original,loaded]) await s.command({type:'dawn'},s.session.revision);
    expect(digest(loaded)).toBe(digest(original)); original.close(); loaded.close();
  });
  it('replays prepared, active, intermission, terminal and received checkpoints without duplicate payout', async () => {
    const original=await gamesMorning();
    original.seasonCommand({type:'prepare',composition:presets[2]!},original.session.revision);
    const forged=decodeSave(original.tables,JSON.stringify(encodeSave(original))); forged.progress.bout!.entrant.ranks.vigor=5;
    const prepared=digest(original); expect(()=>restoreSave(original,forged)).toThrow(); expect(digest(original)).toBe(prepared);
    let loaded=clone(original);
    for(const s of [original,loaded]) s.seasonCommand({type:'start'},s.session.revision);
    const policy=new SeasonPolicy(); let checkedActive=false, checkedIntermission=false;
    while(original.progress.bout!.phase!=='terminal') {
      const b=structuredClone(original.progress.bout!), entries:BoutInput[]=[];
      for(let i=0;i<bridgeRules.limits.batchTicks && b.phase!=='terminal';i++) {
        const g=b.games!;
        const e:BoutInput=g.phase==='intermission'?{type:'advance',tick:g.state.tick}:{type:'tick',tick:g.state.tick,input:policy.frame(g)};
        applyBoutInput(b,e); entries.push(e); if(b.phase==='intermission') break;
      }
      for(const s of [original,loaded]) s.boutInputs(b.id,entries,boutHash(b));
      if(!checkedActive || (!checkedIntermission && b.phase==='intermission')) {
        expect(digest(loaded)).toBe(digest(original)); loaded.close(); loaded=clone(original);
        checkedActive=true; if(b.phase==='intermission') checkedIntermission=true;
        expect(loaded.progress.bout!.games!.player).toBe(loaded.progress.bout!.games!.state.actors[0]);
      }
    }
    expect(checkedIntermission).toBe(true); loaded.close(); loaded=clone(original);
    for(const s of [original,loaded]) s.seasonCommand({type:'receive'},s.session.revision);
    expect(encodeSave(loaded).payload).toEqual(encodeSave(original).payload); loaded.close(); loaded=clone(original);
    const before=digest(loaded);
    expect(()=>loaded.seasonCommand({type:'receive'},loaded.session.revision)).toThrow();
    expect(digest(loaded)).toBe(before);
    await campDay(original); await campDay(loaded); expect(digest(loaded)).toBe(digest(original));
    original.close(); loaded.close();
  },30000);
  it('freezes pending Parley to the selected card, preserves budget/key and ignores the late reply', async () => {
    const original=fixtureService(), dir=mkdtempSync(join(tmpdir(),'mage-save-parley-'));
    const guard=new CostGuard(join(dir,'ledger.json'),'save-test','fake',20,20);
    let late!:(r:ProviderResult)=>void, calls=0;
    original.parleyDirector.options.guard=guard;
    original.parleyDirector.options.transport={model:'fake',options:{},complete:()=>{calls++; return new Promise(resolve=>{late=resolve;});}};
    original.session=knowingFixture(original.tables);
    const pending=original.parley({target:'nysa',cardId:'ask',text:'Tell me about the bread.'},original.session.revision);
    const e=encodeSave(original), key=e.payload.camp.pendingParley!.key, ledger=readFileSync(guard.path,'utf8');
    const bad=decodeSave(original.tables,JSON.stringify(e)); bad.camp.pendingParley!.input.cardId='missing-card';
    const frozen=digest(original);
    expect(()=>restoreSave(original,bad)).toThrow(); expect(digest(original)).toBe(frozen);
    const loaded=new SeasonService(original.tables,original.options);
    restoreSave(loaded,decodeSave(original.tables,JSON.stringify(e))); loaded.paused=false;
    await pending; late(result(authoredParley(original.session,'nysa','reveal'))); await Promise.resolve();
    expect(original.parleyAudit.at(-1)!.key).toBe(key); expect(key).toBeTruthy();
    expect(digest(loaded)).toBe(digest(original)); expect(calls).toBe(1); expect(readFileSync(guard.path,'utf8')).toBe(ledger);
    expect(original.session.parleys).toHaveLength(1); original.close(); loaded.close();
  });
  it('restores pending dawn with completed groups, ignores late work and makes no repeated paid calls', async () => {
    const original=fixtureService(), dir=mkdtempSync(join(tmpdir(),'mage-save-dawn-'));
    let late!:(r:ProviderResult)=>void, calls=0;
    original.options.guard=new CostGuard(join(dir,'ledger.json'),'save-test','fake',20,20);
    const planner=original.options.provider;
    original.options.provider={id:'fake',model:'fake',options:{},decide:async(req)=>{calls++; if(calls===1) return planner.decide(req); return new Promise(resolve=>{late=resolve;});}};
    await original.command({type:'wait'},original.session.revision); await original.command({type:'wait'},original.session.revision);
    await Promise.resolve(); await Promise.resolve();
    await original.command({type:'wait'},original.session.revision);
    const pending=original.command({type:'dawn'},original.session.revision);
    await expect(original.command({type:'dawn'},original.session.revision)).rejects.toThrow();
    const e=encodeSave(original), ledger=readFileSync(original.options.guard.path,'utf8');
    expect(e.payload.camp.pendingDawn).toBe(true); expect(e.payload.camp.night!.completed).toHaveLength(1);
    const invalid=decodeSave(original.tables,JSON.stringify(e)); invalid.camp.session.slot='day';
    const frozen=digest(original); expect(()=>restoreSave(original,invalid)).toThrow(); expect(digest(original)).toBe(frozen);
    const loaded=new SeasonService(original.tables,original.options); restoreSave(loaded,decodeSave(original.tables,JSON.stringify(e))); loaded.paused=false;
    late(result(null)); await pending;
    expect(digest(loaded)).toBe(digest(original)); expect(calls).toBe(2); expect(readFileSync(original.options.guard.path,'utf8')).toBe(ledger);
    expect(original.session.camp.day).toBe(2); original.close(); loaded.close();
  });
  it('rejects corrupt, unknown and incompatible saves without mutation and recovers the previous good file', async () => {
    const original=fixtureService(), store=new SaveStore(mkdtempSync(join(tmpdir(),'mage-save-store-')));
    store.write(original); const first=readFileSync(store.filename,'utf8');
    await campDay(original); store.write(original);
    expect(readFileSync(`${store.filename}.previous`,'utf8')).toBe(first);
    const before=digest(original), valid=JSON.parse(readFileSync(store.filename,'utf8'));
    for(const value of [{...valid,version:9},{...valid,sources:'wrong'},{...valid,checksum:'wrong'},{...valid,payload:{...valid.payload,extra:true}}]) {
      writeFileSync(store.filename,JSON.stringify(value)); expect(()=>restoreSave(original,store.read(original.tables))).toThrow(); expect(digest(original)).toBe(before);
    }
    const malformed=structuredClone(valid); malformed.payload.camp.session.camp.characters.cassia.gold=NaN;
    expect(()=>restoreSave(original,malformed.payload)).toThrow(); expect(digest(original)).toBe(before);
    const duplicate=structuredClone(valid); duplicate.payload.camp.session.camp.characters.cassia=structuredClone(duplicate.payload.camp.session.camp.characters.nysa);
    expect(()=>restoreSave(original,duplicate.payload)).toThrow(); expect(digest(original)).toBe(before);
    store.write(original); expect(readFileSync(`${store.filename}.previous`,'utf8')).toBe(first);
    restoreSave(original,store.read(original.tables,true)); expect(original.session.camp.day).toBe(1); original.close();
  });
});
