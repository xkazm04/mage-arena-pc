import { describe, expect, it } from 'vitest';
import { addMage, combat, createArena, idleInput, interrupt, lintSpells, newWaterState, presets, resetWave, resolveHit, spellFor, spells, stepArena, ticks, trySpellCast, validateComposition, hasLineOfSight, type Actor, type ArenaState, type WaterLine } from './index';
function setup(line: WaterLine = 'tide_orb', tier = 1, branch: 'A' | 'B' = 'A', range = 2.6) {
  const state = createArena(11), actor = addMage(state, 0, { x: 10, y: 10 }), target = addMage(state, 1, { x: 10 + range, y: 10 });
  const composition = structuredClone(presets[0]!);
  composition.lines = [line, ...(['tide_orb', 'lash', 'mire', 'mend', 'mirror'] as WaterLine[]).filter(l => l !== line).slice(0, 2)];
  composition.branches = { lash: branch, mirror: branch, tide_orb: branch };
  actor.water = newWaterState(composition); actor.tier = tier; actor.lastUnlockTick = 1e9;
  return { state, actor, target };
}
function advance(state: ArenaState, count: number) { for (let i = 0; i < count; i++) stepArena(state); }
function cast(state: ArenaState, actor: Actor, target: Actor, slot = 1) { stepArena(state, { [actor.id]: { ...idleInput(target.pos), slot, cast: true } }); }
describe('catalog and composition', () => {
  it('covers every CSV tier and branch, rejects mutations and duplicate slots', () => {
    expect(spells).toHaveLength(24); expect(lintSpells()).toEqual([]);
    expect(spells.filter(s => s.branch).map(s => `${s.line}:${s.tier}:${s.branch}`)).toEqual(['tide_orb:4:A','tide_orb:4:B','lash:2:A','lash:2:B','mirror:2:A','mirror:2:B']);
    for (const c of presets) expect(validateComposition(c)).toEqual([]);
    const mutation = structuredClone(spells); mutation.find(s => s.family === 'unblockable')!.telegraphS = 0; mutation.find(s => s.line === 'mire')!.telegraphS = 0; mutation.find(s => s.line === 'mend')!.branch = 'A'; mutation.pop();
    expect(lintSpells(mutation)).toHaveLength(4);
    expect(validateComposition({ ...presets[0]!, lines: ['mire','mire','mend'] })).not.toEqual([]);
    const { actor } = setup('lash', 2, 'B'); expect(spellFor(actor, 1)!.name).toBe('Riptide'); actor.tier = 3; expect(spellFor(actor, 1)!.name).toBe('Maelstrom Lash');
  });
});
describe('commitments and Flow', () => {
  it('snapshots a tier before unlock and retains cooldown across upgrade', () => {
    const { state, actor, target } = setup(); cast(state, actor, target); actor.tier = 2;
    expect(actor.pending!.spellId).toBe('tide_orb:1:base'); advance(state, ticks(0.5)); expect(target.maxHp - target.hp).toBeCloseTo(7);
    const before = actor.mana; expect(trySpellCast(state, actor, { ...idleInput(target.pos), slot: 1, cast: true })).toBe(false); expect(actor.mana).toBe(before);
  });
  it('waits the entire unblockable warning and allows interruption', () => {
    const { state, actor, target } = setup('tide_orb', 4); cast(state, actor, target); advance(state, ticks(0.7));
    expect(state.projectiles).toHaveLength(0); expect(actor.pending).toBeDefined(); interrupt(state, actor); advance(state, ticks(1));
    expect(target.hp).toBe(target.maxHp); expect(actor.water.cooldowns.tide_orb).toBeGreaterThan(state.tick);
  });
  it('reaches five stacks on cast six and Crests on seven, with no mana needed', () => {
    const { state, actor, target } = setup(); actor.water.composition.lines = ['tide_orb','lash','mirror']; target.hp = target.maxHp = 10000;
    for (const slot of [0, 1, 2, 0, 1, 2]) { cast(state, actor, target, slot); advance(state, ticks(1.5) - 1); }
    expect(actor.water.flow).toBe(5); expect(actor.water.crests).toBe(0); actor.mana = 0;
    expect(trySpellCast(state, actor, { ...idleInput(target.pos), cast: true, slot: 0 })).toBe(true);
    expect(actor.mana).toBe(0); expect(actor.pending!.damageMult).toBe(1.5); expect(actor.water.flow).toBe(0); expect(actor.water.crests).toBe(1);
  });
  it('repetition and idle reset Flow; passive and unaffordable casts leave it unchanged', () => {
    const { state, actor, target } = setup('mirror', 2); actor.water.flow = 3; actor.water.lastActivityTick = state.tick;
    cast(state, actor, target); expect(actor.water.flow).toBe(3); expect(actor.metrics.casts).toBe(0);
    actor.tier = 1; actor.mana = 0; expect(trySpellCast(state, actor, { ...idleInput(target.pos), slot: 1, cast: true })).toBe(false);
    advance(state, ticks(combat.flow.resetAfterIdleS) - 1); expect(actor.water.flow).toBe(0);
    actor.mana = actor.maxMana; cast(state, actor, target, 0); advance(state, ticks(0.3)); actor.water.flow = 2;
    cast(state, actor, target, 0); expect(actor.water.flow).toBe(0);
  });
});
describe('damage geometry and control', () => {
  it('Crash Orb deduplicates direct and burst targets', () => {
    const { state, actor, target } = setup('tide_orb', 2), neighbour = addMage(state, 1, { x: target.pos.x, y: target.pos.y + 1 });
    cast(state, actor, target); advance(state, ticks(1)); expect(target.maxHp - target.hp).toBe(12); expect(neighbour.maxHp - neighbour.hp).toBe(12);
  });
  it('Twin Tides and the fan emit exact counts with symmetric angles', () => {
    for (const [tier, branch, count] of [[3,'A',2],[4,'B',5]] as const) {
      const { state, actor, target } = setup('tide_orb', tier, branch, 10); cast(state, actor, target); advance(state, ticks(spellFor(actor, 1)!.castS));
      expect(state.projectiles).toHaveLength(count); expect(state.projectiles[0]!.velocity.y).toBeCloseTo(-state.projectiles.at(-1)!.velocity.y);
    }
  });
  it('pulls/pushes within the cone and Maelstrom reaches behind', () => {
    for (const branch of ['A','B'] as const) {
      const { state, actor, target } = setup('lash', 2, branch), behind = addMage(state, 1, { x: 8, y: 10 });
      const initial = target.pos.x; cast(state, actor, target); advance(state, ticks(0.3));
      expect(branch === 'A' ? target.pos.x < initial : target.pos.x > initial).toBe(true); expect(behind.hp).toBe(behind.maxHp);
    }
    const { state, actor, target } = setup('lash', 3), behind = addMage(state, 1, { x: 8, y: 10 });
    cast(state, actor, target); advance(state, ticks(0.5)); expect(behind.maxHp - behind.hp).toBe(15);
  });
  it('Coil roots only after the warning', () => {
    const { state, actor, target } = setup('lash', 4, 'A', 2); cast(state, actor, target); advance(state, ticks(0.7)); expect(target.water.rootUntil).toBe(0);
    advance(state, ticks(0.2)); expect(target.water.rootUntil).toBeGreaterThan(state.tick);
    const x = target.pos.x; stepArena(state, { [target.id]: { ...idleInput(), move: { x: 1, y: 0 }, roll: true } }); expect(target.pos.x).toBe(x);
  });
  it('Puddle slows, Fog blocks sight then expires, Freeze roots at its centre', () => {
    const p = setup('mire', 1); cast(p.state, p.actor, p.target); advance(p.state, ticks(0.5)); const x = p.target.pos.x;
    stepArena(p.state, { [p.target.id]: { ...idleInput(), move: { x: 1, y: 0 } } }); expect(p.target.pos.x - x).toBeCloseTo(combat.movement.walkMps * 0.7 / combat.simStepHz);
    const f = setup('mire', 2); cast(f.state, f.actor, f.target); advance(f.state, ticks(0.5)); expect(hasLineOfSight(f.state, f.actor.pos, f.target.pos)).toBe(false);
    advance(f.state, ticks(5)); expect(hasLineOfSight(f.state, f.actor.pos, f.target.pos)).toBe(true);
    const r = setup('mire', 3); cast(r.state, r.actor, r.target); advance(r.state, ticks(0.8)); expect(r.target.water.rootUntil).toBeGreaterThan(r.state.tick); expect(r.target.hp).toBe(90);
  });
  it('Tomb makes a target immune, silent and immobile and clears its resource', () => {
    const { state, actor, target } = setup('mire', 4); target.water.flow = 4; cast(state, actor, target); advance(state, ticks(0.8)); expect(target.water.flow).toBe(0);
    const hp = target.hp, position = { ...target.pos };
    stepArena(state, { [target.id]: { ...idleInput(actor.pos), cast: true, move: { x: 1, y: 0 }, roll: true } }); expect(target.metrics.casts).toBe(0); expect(target.pos).toEqual(position);
    resolveHit(state, target, { ownerId: actor.id, activationId: 100, damage: 80, family: 'unblockable', tier: 4, source: actor.pos }); expect(target.hp).toBe(hp);
    advance(state, ticks(2)); expect(state.tick).toBeGreaterThan(target.water.encasedUntil);
  });
});
describe('sustain and mirror', () => {
  it('heal, Ward, Spring and Font preserve their different resource effects', () => {
    const h = setup('mend', 1); h.actor.hp = 50; cast(h.state, h.actor, h.target); advance(h.state, ticks(0.4)); expect(h.actor.hp).toBe(62);
    const w = setup('mend', 2); cast(w.state, w.actor, w.target); advance(w.state, ticks(0.2)); stepArena(w.state, { [w.actor.id]: { ...idleInput(w.target.pos), absorb: true } }); expect(w.actor.metrics.manaDrained).toBeCloseTo(27 * 0.5 / 60);
    const s = setup('mend', 3); s.actor.hp = 50; cast(s.state, s.actor, s.target); advance(s.state, ticks(5.4)); expect(s.actor.hp).toBeCloseTo(80);
    const f = setup('mend', 4); f.actor.mana = 10; cast(f.state, f.actor, f.target); const x = f.actor.pos.x; stepArena(f.state, { [f.actor.id]: { ...idleInput(), move: { x: 1, y: 0 }, roll: true } }); expect(f.actor.pos.x).toBe(x); advance(f.state, ticks(0.6)); expect(f.actor.mana).toBeGreaterThan(70);
  });
  it('Sheen increases refund and Return Tide stores, caps and empties', () => {
    const { state, actor, target } = setup('mirror', 1); cast(state, actor, target); advance(state, ticks(0.1)); actor.mana = 20; actor.absorb = true; actor.absorbFreshTick = state.tick; actor.facing = { x: 1, y: 0 };
    const hit = { ownerId: target.id, activationId: 100, damage: 40, family: 'magic' as const, tier: 1, source: target.pos };
    resolveHit(state, actor, hit); expect(actor.mana).toBeCloseTo(36.5); expect(actor.water.stored).toBe(20);
    for (let i = 0; i < 5; i++) resolveHit(state, actor, hit); expect(actor.water.stored).toBe(40);
    actor.absorb = false; actor.water.flow = 0; actor.tier = 4; actor.water.cooldowns = {}; cast(state, actor, target); advance(state, ticks(0.4)); expect(actor.water.stored).toBe(0); expect(state.projectiles[0]!.damage).toBe(40);
  });
  it('Reflection returns only eligible magic even above tier II', () => {
    for (const [tier, family, reflected] of [[1,'magic',true],[4,'magic',false],[1,'physical',false]] as const) {
      const { state, actor, target } = setup('mirror', 3); actor.facing = { x: 1, y: 0 };
      state.projectiles.push({ id: 90, activationId: 90, ownerId: target.id, damage: 6, family, tier, source: target.pos, pos: { x: 10.6, y: 10 }, previousPos: { x: 10.6, y: 10 }, velocity: { x: -20, y: 0 }, radius: 0.12, remainingM: 12, hitIds: [] });
      stepArena(state, { [actor.id]: { ...idleInput(target.pos), absorb: true } }); expect(state.projectiles.some(p => p.ownerId === actor.id && p.reflected)).toBe(reflected);
    }
  });
  it('Ripple hits once; Mirage expires; wave reset clears combat effects', () => {
    const { state, actor, target } = setup('mirror', 2, 'B'); actor.absorb = true; actor.absorbFreshTick = 0;
    resolveHit(state, actor, { ownerId: target.id, activationId: 40, damage: 10, family: 'magic', tier: 1, source: target.pos }); expect(target.maxHp - target.hp).toBe(7.5);
    actor.tier = 3; actor.absorb = false; cast(state, actor, target); advance(state, ticks(0.2)); expect(actor.water.decoy).toBeDefined(); advance(state, ticks(3)); expect(actor.water.decoy).toBeUndefined();
    actor.water.flow = 5; actor.water.stored = 80; actor.water.encasedUntil = 500; actor.water.cooldowns.mirror = 500; resetWave(state, actor);
    expect(actor.water.flow).toBe(0); expect(actor.water.stored).toBe(0); expect(actor.water.encasedUntil).toBe(0); expect(actor.water.cooldowns).toEqual({}); expect(actor.water.composition.branches.mirror).toBe('B');
  });
});
