// Archetype plans and authored rival builds (spark combat-system-depth WP2): the builds spawn as authored, the named bracket
// plays Brennic's and Lio's builds, every other mage keeps its brain, and each shape-class answer fires on its own class only.
import { describe, expect, it } from 'vitest';
import { presets } from './catalog.ts';
import { createGames } from './games.ts';
import { createArena, addMage, combat, runtime, spawnProjectile, statRules, stepArena, ticks } from './kernel.ts';
import { competence, mageInput, threats } from './mage-ai.ts';
import { chooseSchoolSpell } from './mage-ai-schools.ts';
import { createLedger } from './ledger.ts';
import { answersShape, archetypeBand, rivalBuildIds, rivalBuildOf, rivalBuilds, roleOf } from './archetypes.ts';
import { schoolSpellById, slotSpell } from './schools.ts';
import { agilityPerfectWindowAddS } from './progression.ts';
import { distance } from './math.ts';
import type { Actor } from './types.ts';

const reference = presets.find(p => p.name === runtime.games.referencePreset)!;
const buildGames = (id: string, composition = reference) => {
  const g = createGames(41000, composition, rivalBuilds[id]!.wave, true, undefined, undefined, undefined, { rivalBuild: id });
  return { g, rival: g.state.actors.find(a => a.team !== g.player.team)! };
};
const place = (a: Actor, x: number, y: number) => { a.pos = { x, y }; a.previousPos = { x, y }; };

describe('authored rival builds', () => {
  it('six builds, one per school x archetype, Brennic fire close on the semifinal and Lio air light on the final', () => {
    expect(rivalBuildIds.map(id => [id, rivalBuilds[id]!.school, rivalBuilds[id]!.archetype]).sort()).toEqual([
      ['air_close', 'air', 'close'], ['air_heavy', 'air', 'heavy'], ['air_light', 'air', 'light'],
      ['fire_close', 'fire', 'close'], ['fire_heavy', 'fire', 'heavy'], ['fire_light', 'fire', 'light']]);
    expect([rivalBuilds.fire_close!.wave, rivalBuilds.air_light!.wave]).toEqual([2, 3]);
    // Stats follow the archetype: heavy keeps agility 1, light leads with agility, close leads with vigor and nerve.
    for (const b of Object.values(rivalBuilds)) {
      const r = b.ranks;
      if (b.archetype === 'heavy') expect(r.agility, b.id).toBe(1);
      if (b.archetype === 'light') expect(r.agility, b.id).toBeGreaterThanOrEqual(Math.max(r.vigor, r.focus, r.nerve));
      if (b.archetype === 'close') expect(Math.min(r.vigor, r.nerve), b.id).toBeGreaterThanOrEqual(Math.max(r.focus, r.agility));
    }
  });

  it('createGames rivalBuild spawns the build on its wave: ranks, HP, loadout, spell ranks, plan; the label names the archetype', () => {
    for (const id of rivalBuildIds) {
      const { g, rival } = buildGames(id), b = rivalBuilds[id]!;
      expect(g.rivalBuild).toBe(id);
      expect(rival.ranks).toEqual(b.ranks);
      expect(rival.maxHp).toBe(statRules.hp.base + statRules.hp.perRank * b.ranks.vigor);
      expect(rival.schoolState!.catalogue).toBeUndefined();
      expect([rival.schoolState!.loadout.bolt, ...rival.schoolState!.loadout.slots]).toEqual([b.loadout.bolt, ...b.loadout.slots]);
      expect(rival.spellRanks ?? {}).toEqual(b.spellRanks);
      expect(rivalBuildOf(rival)).toBe(b);
      expect(rival.label).toBe(`${b.school === 'fire' ? 'Ember' : 'Gale'} mage · ${b.archetype}`);
      expect(g.spawnLog[0]!.kind).toBe(`${rival.label} ${b.wave === 2 ? 1 : 1.5}`);
    }
    expect(() => createGames(1, reference, 2, true, undefined, undefined, undefined, { rivalBuild: 'fire_mystery' })).toThrow('Invalid rival build');
  });

  it('a build replaces only its own wave; the other mage wave keeps its mode', () => {
    const g = createGames(41000, reference, 2, true, undefined, undefined, undefined, { rivalBuild: 'air_light' });
    const semifinal = g.state.actors.find(a => a.team !== g.player.team)!;
    expect(semifinal.schoolState).toBeUndefined();
    expect(g.rivalBuild).toBe('air_light');
    const fire = createGames(41000, reference, 3, true, undefined, undefined, undefined, { schoolRivals: 'fire', rivalBuild: 'fire_close' });
    expect(fire.state.actors.find(a => a.team !== fire.player.team)!.schoolState!.catalogue).toBe(true);
  });

  it("schoolRivals 'named' plays Brennic's and Lio's builds with their names; the parity modes keep the catalogue rivals", () => {
    for (const [wave, id, name] of [[2, 'fire_close', 'Brennic'], [3, 'air_light', 'Lio']] as const) {
      const g = createGames(41000, reference, wave, true, undefined, undefined, undefined, { schoolRivals: 'named' });
      const rival = g.state.actors.find(a => a.team !== g.player.team)!;
      expect(rival.label).toBe(name); expect(rivalBuildOf(rival)?.id).toBe(id); expect(rival.ranks).toEqual(rivalBuilds[id]!.ranks);
      expect(g.rivalBuild).toBeUndefined();
    }
    for (const mode of ['fire', 'air'] as const) {
      const g = createGames(41000, reference, 2, true, undefined, undefined, undefined, { schoolRivals: mode, balance: 'canonical' });
      const rival = g.state.actors.find(a => a.team !== g.player.team)!;
      expect(rivalBuildOf(rival)).toBeUndefined(); expect(rival.schoolState!.catalogue).toBe(true);
      expect(archetypeBand(g.state, rival, 5)).toBeUndefined();
    }
  });
});

describe('the plan layer', () => {
  it('roles come from row shapes; the answer rows answer their shape class', () => {
    const role = (id: string) => roleOf(schoolSpellById(id)!);
    expect(['fire_bolt', 'fire_cinderstep', 'fire_kindle', 'fire_ring', 'fire_flick', 'fire_lance', 'fire_pyre', 'fire_sunfall', 'fire_wrath'].map(role))
      .toEqual(['bolt', 'dash', 'build', 'answer', 'hit', 'payoff', 'payoff', 'signature', 'payoff']);
    expect(['air_bolt', 'air_slipstream', 'air_eye', 'air_form', 'air_shear', 'air_veer', 'air_squall', 'air_tempest', 'air_cyclone'].map(role))
      .toEqual(['bolt', 'dash', 'build', 'answer', 'hit', 'payoff', 'payoff', 'signature', 'payoff']);
    expect([answersShape(schoolSpellById('fire_ring')!), answersShape(schoolSpellById('air_form')!), answersShape(schoolSpellById('fire_lance')!)]).toEqual(['close', 'projectile', undefined]);
  });

  it('bands: close inside its short rows, light at its bolt reach (Air 10-14 m), heavy at its shortest unlocked payoff reach', () => {
    const band = (id: string, tier = 1) => { const { g, rival } = buildGames(id); rival.tier = tier; return archetypeBand(g.state, rival, 6)!.band.map(v => +v.toFixed(2)); };
    expect(band('fire_close')).toEqual([2, 3.4]);
    expect(band('air_light')).toEqual([9.8, 14]);
    expect(band('fire_heavy', 1)).toEqual([9, 11.4]);
    expect(band('fire_heavy', 3)).toEqual([7.5, 9.5]);
  });

  it('Air Form answers an aimed projectile and nothing else', () => {
    // Air close slots Air Form (Lio's light build plays the Skirmisher rows); stand it in its band so the plan has no dash to make.
    const { g, rival } = buildGames('air_close'), s = g.state;
    place(g.player, 10, 10); place(rival, 13, 10); rival.tier = 2; rival.schoolState!.value = 90;
    const ctx = () => ({ target: g.player, distanceM: distance(rival.pos, g.player.pos), seen: threats(s, rival), profile: competence(1.5), readyTick: s.tick + 1 });
    const formSlot = 1 + rivalBuilds.air_close!.loadout.slots.indexOf('air_form');
    expect(chooseSchoolSpell(s, rival, ctx())?.slot).not.toBe(formSlot);
    spawnProjectile(s, { ownerId: g.player.id, activationId: s.nextId++, damage: 5, family: 'magic', tier: 0, source: { ...g.player.pos } }, { x: 10.5, y: 10 }, { x: 1, y: 0 }, 20, 12);
    expect(threats(s, rival).find(t => t.aimedAtUs)?.shape).toBe('projectile');
    expect(chooseSchoolSpell(s, rival, ctx())?.slot).toBe(formSlot);
  });

  it('Ring of Cinders answers close pressure (a body inside its reach), not a target at range', () => {
    const { g, rival } = buildGames('fire_close'), s = g.state;
    rival.tier = 2; const ringSlot = 1 + rivalBuilds.fire_close!.loadout.slots.indexOf('fire_ring');
    const pick = () => chooseSchoolSpell(s, rival, { target: g.player, distanceM: distance(rival.pos, g.player.pos), seen: threats(s, rival), profile: competence(1), readyTick: s.tick + 1 })?.slot;
    place(g.player, 10, 10); place(rival, 18, 10);
    expect(pick()).not.toBe(ringSlot);
    place(rival, 12.5, 10);
    expect(pick()).toBe(ringSlot);
  });

  it('facing a build, the Water AI casts Tide Ward against an aimed beam and not against a projectile', () => {
    const mirror = presets.find(p => p.name === 'Mirror tide')!;
    const run = (spellId: string) => {
      const { g, rival } = buildGames('fire_heavy', mirror), s = g.state;
      place(g.player, 10, 10); place(rival, 16, 10); g.player.tier = 2; rival.tier = 4;
      rival.pending = { kind: 'spell', startTick: s.tick, releaseTick: s.tick + 20, aim: { ...g.player.pos }, activationId: s.nextId++, spellId };
      return { input: mageInput(s, g.player), ward: 1 + mirror.lines.indexOf('mend') };
    };
    const beam = run('fire_wrath');
    expect(beam.input).toMatchObject({ slot: beam.ward, cast: true });
    expect(run('fire_bolt').input.slot).not.toBe(beam.ward);
  });
});

describe('WP1 hand-off: the AI and the ledger read agility', () => {
  it('the ledger window is the kernel window: agility 5 widens it by four ranks of the per-rank add', () => {
    const s = createArena(3), target = addMage(s, 0, { x: 10, y: 10 }, 'agile', { vigor: 1, focus: 1, nerve: 1, agility: 5 }), owner = addMage(s, 1, { x: 16, y: 10 });
    const ledger = createLedger(s, target.id);
    spawnProjectile(s, { ownerId: owner.id, activationId: s.nextId++, damage: 5, family: 'magic', tier: 0, source: { ...owner.pos } }, { x: 15, y: 10 }, { x: -1, y: 0 }, 20, 12);
    for (let i = 0; i < 60 && !ledger.raw.length; i++) stepArena(s);
    expect(agilityPerfectWindowAddS(target, s)).toBeGreaterThan(0);
    expect(ledger.raw[0]!.windowTicks).toBe(ticks(combat.absorb.perfect.windowS + agilityPerfectWindowAddS(target, s)));
    expect(ledger.raw[0]!.windowTicks).toBeGreaterThan(ticks(combat.absorb.perfect.windowS));
  });

  it('slotSpell still reads the balanced row for a build rival (the plan presses rows the kernel will cast)', () => {
    const { g, rival } = buildGames('fire_close');
    expect(slotSpell(rival, 1, g.state)!.id).toBe(rivalBuilds.fire_close!.loadout.slots[0]);
  });
});
