import { describe, expect, it } from "vitest";
import { actCamp, activityHours, campActions, createCampSession, decision, moveCamp, passSlot, phaseAt, playerProblem, spendHours, beginTrial, seasonDue } from "@mage/core";
import { buildInput, decodeSave, encodeSave, loadTables, plan, validateGroup } from "@mage/director";
import { fixtureService } from "./season-fixtures.ts";
const t = loadTables();
describe("D25 hour authority", () => {
  it("spends each activity's hours without advancing a whole phase or duplicating facts", () => {
    let s = moveCamp(t, createCampSession(t), "commons");
    const d = decision(t,s.camp,"cassia","BEFRIEND",{target:"fenna"});
    const original = structuredClone(s);
    for(let i=0;i<3;i++) s=actCamp(t,s,d);
    expect(s.hour).toBe(t.season.wakeHour+3*activityHours(d));
    expect(s.slot).toBe("day");
    expect(new Set(s.dayEvents.map(f=>f.id)).size).toBe(3);
    let replay=original; for(let i=0;i<3;i++) replay=actCamp(t,replay,d);
    expect(replay).toEqual(s);
  });
  it("rejects overrun at closing, the Trial and the night boundary", () => {
    let s = moveCamp(t,createCampSession(t),"exchange");
    s=spendHours(s,7); // 15:00: work ends after closing
    expect(campActions(t,s).some(a=>a.decision.intent==='WORK')).toBe(false);
    s=moveCamp(t,s,"tent"); s.camp.day=6; s=spendHours(s,2);
    expect(playerProblem(t,s,decision(t,s.camp,'cassia','REST'))).toMatch(/Trial/);
    s.camp.day=5; s=spendHours(s,2);
    expect(playerProblem(t,s,decision(t,s.camp,'cassia','REST'))).toMatch(/night/);
    expect(()=>spendHours(s,4)).toThrow(/hours/);
  });
  it("derives phase boundaries and closes the night exactly at the day end", () => {
    expect([8,17,18,19,20,22].map(h=>phaseAt(h))).toEqual(['day','day','dusk','dusk','night','night']);
    let s=createCampSession(t); for(let i=0;i<3;i++) s=passSlot(s);
    expect(s.hour).toBe(t.season.wakeHour+t.season.wakingHours);
    expect(s.nightFinished).toBe(true);
  });
  it("planner and validator reject activities too long for facility hours", () => {
    const copy=structuredClone(t); copy.season.activityHours.WORK=11;
    const s=createCampSession(copy).camp, d=decision(copy,s,'nysa','WORK');
    expect(plan(copy,s,'nysa').intent).not.toBe('WORK');
    const r=validateGroup(copy,s,'tide',['nysa'],{group:'tide',decisions:[d]});
    expect(r.verdicts[0].rejected).toBe(true);
    expect(r.items[0].intent).not.toBe('WORK');
    expect(buildInput(t,s,'tide',['nysa']).time.travelHours).toBe(0);
  });
  it("keeps Trial and Games at fixed hours and stops the service at the summons", async () => {
    const service=fixtureService(); service.session.camp.day=6;
    await service.command({type:'wait'},service.session.revision);
    expect(service.session.hour).toBe(t.season.trialHour);
    expect(seasonDue(t,service.session,service.progress)).toBe('trial');
    await expect(service.command({type:'wait'},service.session.revision)).rejects.toThrow(/Trial/);
    await service.command({type:'travel',place:'pit'},service.session.revision);
    expect(beginTrial(t,service.session,service.progress).phase).toBe('active');
    service.session.hour++; expect(()=>beginTrial(t,service.session,service.progress)).toThrow();
    service.close();
  });
  it("rejects old saves and inconsistent hour/phase state; round trips within a phase", async () => {
    const service=fixtureService();
    await service.command({type:'travel',place:'yard'},service.session.revision);
    await service.command({type:'act',action:service.view().actions[0].id},service.session.revision);
    const e=encodeSave(service);
    expect(e.version).toBe(2);
    expect(decodeSave(t,JSON.stringify(e)).camp.session).toEqual(service.session);
    expect(()=>decodeSave(t,JSON.stringify({...e,version:1}))).toThrow(/incompatible/);
    service.session.slot='night'; expect(()=>encodeSave(service)).toThrow(/inconsistent/);
    service.close();
  });
});
