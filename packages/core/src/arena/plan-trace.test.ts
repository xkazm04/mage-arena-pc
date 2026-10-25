// Plan-branch ledger (challenge 2026-10-25, arena-schools-ai B): archetypeChoose names the branch behind each pick or withhold,
// an opt-in per-state trace counts them, and the trace never reaches the hashed state.
import { describe, expect, it } from 'vitest';
import { presets } from './catalog.ts';
import { createGames } from './games.ts';
import { runtime, spawnProjectile, stateHash } from './kernel.ts';
import { competence, threats, type Threat } from './mage-ai.ts';
import { chooseSchoolSpell } from './mage-ai-schools.ts';
import { archetypeChoose, rivalBuilds, roleOf } from './archetypes.ts';
import { schoolSlots } from './school-kit.ts';
import { enablePlanTrace, planTrace, withheldBranches } from './plan-trace.ts';
import { distance } from './math.ts';
import type { Actor } from './types.ts';

const reference = presets.find(p => p.name === runtime.games.referencePreset)!;
const buildGames = (id: string) => {
  const g = createGames(41000, reference, rivalBuilds[id]!.wave, true, undefined, undefined, undefined, { rivalBuild: id });
  return { g, rival: g.state.actors.find(a => a.team !== g.player.team)! };
};
const place = (a: Actor, x: number, y: number) => { a.pos = { x, y }; a.previousPos = { x, y }; };

describe('plan-branch ledger', () => {
  it('a pressed Ring counts answer:pressed', () => {
    const { g, rival } = buildGames('fire_close'), s = g.state;
    enablePlanTrace(s);
    rival.tier = 2; const ringSlot = 1 + rivalBuilds.fire_close!.loadout.slots.indexOf('fire_ring');
    place(g.player, 10, 10); place(rival, 12.5, 10);
    const pick = chooseSchoolSpell(s, rival, { target: g.player, distanceM: distance(rival.pos, g.player.pos), seen: threats(s, rival), profile: competence(1), readyTick: s.tick + 1 });
    expect(pick?.slot).toBe(ringSlot);
    expect(planTrace(s)!.get(rival.id)).toEqual({ 'answer:pressed': 1 });
  });

  it('Air Form against an aimed projectile counts answer:incoming', () => {
    const { g, rival } = buildGames('air_close'), s = g.state;
    place(g.player, 10, 10); place(rival, 13, 10); rival.tier = 2; rival.schoolState!.value = 90;
    spawnProjectile(s, { ownerId: g.player.id, activationId: s.nextId++, damage: 5, family: 'magic', tier: 0, source: { ...g.player.pos } }, { x: 10.5, y: 10 }, { x: 1, y: 0 }, 20, 12);
    enablePlanTrace(s);
    const formSlot = 1 + rivalBuilds.air_close!.loadout.slots.indexOf('air_form');
    const pick = chooseSchoolSpell(s, rival, { target: g.player, distanceM: distance(rival.pos, g.player.pos), seen: threats(s, rival), profile: competence(1.5), readyTick: s.tick + 1 });
    expect(pick?.slot).toBe(formSlot);
    expect(planTrace(s)!.get(rival.id)).toEqual({ 'answer:incoming': 1 });
  });

  it('the heavy withhold says why: waiting (tier I, something seen) or reserve (tier III, mana short)', () => {
    const { g, rival } = buildGames('fire_heavy'), s = g.state;
    enablePlanTrace(s);
    place(g.player, 10, 10); place(rival, 20, 10); rival.schoolState!.value = 100;
    // Payoffs and the signature not legal; the bolt and the rest are.
    const slots = () => schoolSlots(s, rival).map(c => ({ ...c, can: roleOf(c.spell) !== 'payoff' && roleOf(c.spell) !== 'signature' }));
    const threat: Threat = { id: 1, family: 'magic', origin: { ...g.player.pos }, impactTick: s.tick + 600, aimedAtUs: false, damage: 1 };
    rival.tier = 1;
    expect(archetypeChoose(s, rival, g.player, 10, [threat], slots())).toBeUndefined();
    expect(planTrace(s)!.get(rival.id)).toEqual({ 'heavy:waiting': 1 });
    rival.tier = 3; rival.mana = 0;
    expect(archetypeChoose(s, rival, g.player, 10, [], slots())).toBeUndefined();
    expect(planTrace(s)!.get(rival.id)).toEqual({ 'heavy:waiting': 1, 'heavy:reserve': 1 });
    expect(withheldBranches.has('heavy:waiting') && withheldBranches.has('heavy:reserve')).toBe(true);
    expect(withheldBranches.has('heavy:bolt')).toBe(false);
  });

  it('off by default, and outside the hashed state: a traced decision hashes like an untraced twin', () => {
    const run = (trace: boolean) => {
      const { g, rival } = buildGames('fire_close'), s = g.state;
      if (trace) enablePlanTrace(s);
      place(g.player, 10, 10); place(rival, 12.5, 10); rival.tier = 2;
      archetypeChoose(s, rival, g.player, 2.5, [], schoolSlots(s, rival).map(c => ({ ...c, can: true })));
      return { s, rival };
    };
    const off = run(false), on = run(true);
    expect(planTrace(off.s)).toBeUndefined();
    expect(planTrace(on.s)!.get(on.rival.id)).toEqual({ 'answer:pressed': 1 });
    expect(stateHash(on.s)).toBe(stateHash(off.s));
  });
});
