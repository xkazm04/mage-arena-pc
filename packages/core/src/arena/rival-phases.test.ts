// Named-rival phases (VR CR-005; Kernel/VrRivals.cpp and Tests/RivalTests.cpp): breaks, the surge, the `phase` event and
// the granted signature, for Brennic (semifinal, Sunfall) and Lio (final, Tempest Lance), plus neutrality for every
// Games that is not 'named'. Rival HP is set directly where the rule, not a hit, is under test (no stagger involved).
import { describe, expect, it } from 'vitest';
import { presets } from './catalog.ts';
import { advanceGames, createGames, stepGames, type Games } from './games.ts';
import { combat, interrupt, runtime, spawnProjectile, stateHash, statRules, stepArena, ticks } from './kernel.ts';
import { rivalBuilds } from './archetypes.ts';
import { applyRivalHp, rivalRuntime, rivals } from './rival-phases.ts';
import { balancedSpell, schoolSpellById } from './schools.ts';
import { paced } from './tuning.ts';
import type { ArenaEvent } from './types.ts';

const reference = presets.find(p => p.name === runtime.games.referencePreset)!;
/** 'water' is the default Games (no schoolRivals option). */
type Mode = 'named' | 'fire' | 'air' | 'water';
function games(wave: 2 | 3, mode: Mode = 'named', referencePlayer = false, seed = 51000, rivalPhases?: false): Games {
  return createGames(seed, reference, wave, referencePlayer, undefined, undefined, undefined, { ...(mode !== 'water' ? { schoolRivals: mode } : {}), ...(rivalPhases === false ? { rivalPhases } : {}) });
}
function duel(wave: 2 | 3) {
  const g = games(wave), rival = g.state.actors.find(a => a.team === 1)!;
  return { g, rival, player: g.player };
}
const since = (g: Games, from: number, kind: ArenaEvent['kind']) => g.state.events.slice(from).filter(e => e.kind === kind);
/** One kernel tick with every actor idle: no brain, so only the rule acts. */
function tick(g: Games): number { const from = g.state.events.length; stepArena(g.state); return from; }
const spellOf = (id: string, g: Games) => balancedSpell(schoolSpellById(id)!, g.state);

const cases = [
  { name: 'Brennic', wave: 2 as const, school: 'fire', rivalId: 'brennic', signature: 'fire_sunfall' },
  { name: 'Lio', wave: 3 as const, school: 'air', rivalId: 'lio', signature: 'air_tempest' },
];

describe('rival data', () => {
  it('starts at VR values: 0.66 and 0.33, the last phase opens with the signature, surge 1', () => {
    expect(rivals.map(r => [r.id, r.school, r.wave, r.phases.map(p => p.atHpFraction), r.phases.map(p => p.opensWith ?? null), r.surgeTiers])).toEqual([
      ['brennic', 'fire', 2, [0.66, 0.33], [null, 'fire_sunfall'], 1],
      ['lio', 'air', 3, [0.66, 0.33], [null, 'air_tempest'], 1],
    ]);
  });
});

describe.each(cases)('$name named duel', ({ name, wave, school, rivalId, signature }) => {
  it(`binds ${name} on its wave and starts empty`, () => {
    const { g, rival } = duel(wave);
    expect(rival).toMatchObject({ label: name, school });
    expect(rivalRuntime(g.state)).toMatchObject({ actorId: rival.id, rival: { id: rivalId }, phasesBroken: 0, grantPending: false, grantUsed: false });
  });

  it('breaks at 0.66 and 0.33 of the actor maxHp, one phase per threshold, with the phase event fields', () => {
    const { g, rival } = duel(wave), max = rival.maxHp;
    // The named rival plays its build (rivals.json build, WP2): HP follows the build's vigor on the shared stat rule.
    expect(max).toBe(statRules.hp.base + statRules.hp.perRank * rivalBuilds[rivals.find(r => r.id === rivalId)!.build!]!.ranks.vigor);
    // Just above the threshold does nothing, exactly on it breaks (Hp <= fraction x MaxHp).
    rival.hp = 0.66 * max + 1e-6; let from = tick(g);
    expect(since(g, from, 'phase')).toEqual([]);
    rival.hp = 0.66 * max; from = tick(g);
    expect(since(g, from, 'phase')).toEqual([{ tick: g.state.tick, kind: 'phase', actorId: rival.id, value: 2, targetId: 0 }]);
    rival.hp = 0.5 * max; from = tick(g);
    expect(since(g, from, 'phase')).toEqual([]);
    rival.hp = 0.33 * max; from = tick(g);
    expect(since(g, from, 'phase')).toEqual([{ tick: g.state.tick, kind: 'phase', actorId: rival.id, value: 3, targetId: 1 }]);
    rival.hp = 1; from = tick(g);
    expect(since(g, from, 'phase')).toEqual([]);
    expect(rivalRuntime(g.state)!.phasesBroken).toBe(2);
  });

  it('one hit below both thresholds breaks both phases on its tick, in order', () => {
    const { g, rival, player } = duel(wave);
    const damage = rival.hp - 0.2 * rival.maxHp;
    spawnProjectile(g.state, { ownerId: player.id, activationId: 9e6, damage, family: 'unblockable', tier: 0, source: { ...player.pos } },
      { x: rival.pos.x - 0.3, y: rival.pos.y }, { x: 1, y: 0 }, 20, 3);
    const from = tick(g);
    expect(since(g, from, 'hit').map(e => e.actorId)).toEqual([rival.id]);
    expect(rival.hp).toBeCloseTo(0.2 * rival.maxHp, 9);
    expect(since(g, from, 'phase').map(e => [e.value, e.targetId, e.tick])).toEqual([[2, 0, g.state.tick], [3, 1, g.state.tick]]);
  });

  it('a killing blow below the thresholds is the victory, not a break', () => {
    const { g, rival, player } = duel(wave);
    spawnProjectile(g.state, { ownerId: player.id, activationId: 9e6, damage: 500, family: 'unblockable', tier: 0, source: { ...player.pos } },
      { x: rival.pos.x - 0.3, y: rival.pos.y }, { x: 1, y: 0 }, 20, 3);
    const from = tick(g);
    expect(since(g, from, 'down').map(e => e.actorId)).toEqual([rival.id]);
    expect(since(g, from, 'phase')).toEqual([]);
    expect(rivalRuntime(g.state)!.phasesBroken).toBe(0);
  });

  it('surges the rival and the player one tier per break, ignoring the minimum gap, capped at IV', () => {
    const { g, rival, player } = duel(wave);
    tick(g);
    // The player unlocked this very tick: the normal clock could not unlock again, the surge does.
    player.tier = 2; player.lastUnlockTick = g.state.tick;
    rival.hp = 0.2 * rival.maxHp; const from = tick(g), at = g.state.tick;
    const unlocks = since(g, from, 'unlock').map(e => [e.actorId, e.value, e.tick]);
    expect(unlocks).toEqual([[rival.id, 2, at], [player.id, 3, at], [rival.id, 3, at], [player.id, 4, at]]);
    expect([rival.tier, player.tier]).toEqual([3, 4]);
    expect([rival.lastUnlockTick, player.lastUnlockTick]).toEqual([at, at]);
    expect(player.unlockTicks.slice(-2)).toEqual([at, at]);
    // Capped: a player already at IV gains nothing more and emits no unlock.
    const capped = duel(wave);
    capped.player.tier = 4; capped.rival.hp = 0.5 * capped.rival.maxHp;
    const f2 = tick(capped.g);
    expect(since(capped.g, f2, 'unlock').map(e => e.actorId)).toEqual([capped.rival.id]);
    expect(capped.player.tier).toBe(4);
  });

  it('the normal clock counts its minimum gap from the surge', () => {
    const { g, rival } = duel(wave);
    tick(g); rival.hp = 0.5 * rival.maxHp; tick(g);
    const surgeTick = g.state.tick;
    expect(rival.tier).toBe(2);
    // Owe tier III on the clock right away; it may only land minimumSecondsBetweenUnlocks after the surge.
    rival.clockAdvanceTicks = 1e6; let unlockTick = -1;
    for (let t = 0; t < 600 && unlockTick < 0; t++) { const from = tick(g); if (since(g, from, 'unlock').some(e => e.actorId === rival.id)) unlockTick = g.state.tick; }
    expect(unlockTick - surgeTick).toBe(ticks(combat.tierClock.minimumSecondsBetweenUnlocks));
  });

  it(`grants ${signature} at the last break: tier gate, cooldown and mana skipped, then the normal cooldown is set`, () => {
    const { g, rival } = duel(wave), spell = spellOf(signature, g);
    expect(rival.tier).toBeLessThan(spell.tier);
    rival.hp = 0.5 * rival.maxHp; tick(g);
    expect(rivalRuntime(g.state)!.grantPending).toBe(false);
    // Broke and starved: no mana, the signature on a long cooldown, tier II after the first surge.
    rival.mana = 0; rival.schoolState!.cooldowns[signature] = g.state.tick + 1e6;
    rival.hp = 0.3 * rival.maxHp; const from = tick(g), at = g.state.tick;
    expect(since(g, from, 'cast').map(e => [e.actorId, e.value])).toEqual([[rival.id, spell.tier]]);
    expect(rival.pending).toMatchObject({ kind: 'spell', spellId: signature, startTick: at });
    expect(rival.mana).toBeGreaterThanOrEqual(0);
    expect(rival.mana).toBeLessThan(1);
    expect(rival.schoolState!.cooldowns[signature]).toBe(at + ticks(paced(rival, spell.cooldownS)));
    expect(rivalRuntime(g.state)).toMatchObject({ grantPending: false, grantUsed: true, grantTick: at });
    // Its own windup and resolution: the release comes at the row's release tick with the row's id.
    const releaseTick = rival.pending!.releaseTick;
    let release: ArenaEvent | undefined;
    while (g.state.tick < releaseTick + 1 && !release) { const f = tick(g); release = since(g, f, 'release').find(e => e.actorId === rival.id); }
    expect(release).toMatchObject({ tick: releaseTick, spellId: signature });
  });

  it('the grant waits while the rival is busy and starts on the first free tick', () => {
    const { g, rival } = duel(wave);
    tick(g);
    rival.recoveryUntil = g.state.tick + 12;
    rival.hp = 0.2 * rival.maxHp; let from = tick(g);
    expect(since(g, from, 'phase')).toHaveLength(2);
    expect(since(g, from, 'cast')).toEqual([]);
    expect(rivalRuntime(g.state)!.grantPending).toBe(true);
    while (g.state.tick < rival.recoveryUntil - 1) { from = tick(g); expect(since(g, from, 'cast')).toEqual([]); }
    from = tick(g);
    expect(g.state.tick).toBe(rival.recoveryUntil);
    expect(since(g, from, 'cast').map(e => e.actorId)).toEqual([rival.id]);
    expect(rival.pending?.spellId).toBe(signature);
    expect(rivalRuntime(g.state)).toMatchObject({ grantPending: false, grantUsed: true, grantTick: g.state.tick });
  });

  it('a raised ward also holds the grant (the hands are not free)', () => {
    const { g, rival } = duel(wave);
    tick(g);
    rival.hp = 0.2 * rival.maxHp;
    stepArena(g.state, { [rival.id]: { ...rival.lastInput, absorb: true } });
    expect(rival.absorb).toBe(true);
    expect(rivalRuntime(g.state)!.grantPending).toBe(true);
    tick(g);
    expect(rival.pending?.spellId).toBe(signature);
  });

  it('an interrupt during the granted cast loses it: spent, never cast again', () => {
    const { g, rival } = duel(wave);
    rival.hp = 0.2 * rival.maxHp; tick(g);
    expect(rival.pending?.spellId).toBe(signature);
    const from = g.state.events.length;
    interrupt(g.state, rival);
    expect(rival.pending).toBeUndefined();
    for (let t = 0; t < 600; t++) tick(g);
    expect(since(g, from, 'cast').filter(e => e.actorId === rival.id)).toEqual([]);
    expect(since(g, from, 'release').filter(e => e.spellId === signature)).toEqual([]);
    expect(rivalRuntime(g.state)).toMatchObject({ grantPending: false, grantUsed: true });
  });
});

describe('wave binding and clearing', () => {
  it('a wave spawn clears the runtime and binds again: Brennic in the semifinal, Lio in the final', () => {
    const g = games(2, 'named', true, 51007);
    const brennic = g.state.actors.find(a => a.team === 1)!;
    expect(rivalRuntime(g.state)).toMatchObject({ actorId: brennic.id, rival: { id: 'brennic' } });
    brennic.hp = 0.2 * brennic.maxHp; stepGames(g);
    expect(rivalRuntime(g.state)!.phasesBroken).toBe(2);
    // Finish the semifinal outright, then the final binds Lio with a fresh runtime.
    brennic.hp = 0; brennic.tags = ['DEFEATED'];
    for (let t = 0; t < 600 && g.phase === 'active'; t++) stepGames(g);
    expect(g.phase).toBe('intermission');
    advanceGames(g);
    const lio = g.state.actors.find(a => a.team === 1)!;
    expect(lio.label).toBe('Lio');
    expect(rivalRuntime(g.state)).toMatchObject({ actorId: lio.id, rival: { id: 'lio' }, phasesBroken: 0, breakTicks: [], grantPending: false, grantUsed: false });
  });
  it('the creature waves of a named Games bind nobody', () => {
    const g = games(1 as 2);
    expect(rivalRuntime(g.state)).toMatchObject({ phasesBroken: 0 });
    expect(rivalRuntime(g.state)!.actorId).toBeUndefined();
  });
});

describe('neutrality', () => {
  const play = (g: Games, seconds: number) => { while (g.phase === 'active' && g.state.tick < ticks(seconds)) stepGames(g); return g; };
  it.each(['water', 'fire', 'air'] as const)('Games with schoolRivals %s never enable, bind or emit phase', mode => {
    for (const wave of [2, 3] as const) {
      const g = play(games(wave, mode, true, 51001), 90);
      expect(rivalRuntime(g.state)).toBeUndefined();
      expect(g.state.events.some(e => e.kind === 'phase')).toBe(false);
    }
  });
  it('named with phases off never emits phase, and matches the phased run tick for tick until the first break', () => {
    for (const wave of [2, 3] as const) {
      const off = games(wave, 'named', true, 51002, false), on = games(wave, 'named', true, 51002);
      expect(rivalRuntime(off.state)).toBeUndefined();
      let broke = false;
      while (on.phase === 'active' && on.state.tick < ticks(120) && !broke) {
        stepGames(on); stepGames(off);
        broke = on.state.events.some(e => e.kind === 'phase');
        if (!broke) expect(stateHash(off.state)).toBe(stateHash(on.state));
      }
      play(off, 120);
      expect(off.state.events.some(e => e.kind === 'phase')).toBe(false);
    }
  });
  it('a named duel with phases replays to the same hash', () => {
    const run = () => play(games(2, 'named', true, 51003), 90);
    const first = run(), second = run();
    expect(stateHash(first.state)).toBe(stateHash(second.state));
    expect(first.state.events.filter(e => e.kind === 'phase')).toEqual(second.state.events.filter(e => e.kind === 'phase'));
  });
});

describe('named rival HP (rivals.json maxHp)', () => {
  it('sets the bound rival to its authored HP in the named bracket only', () => {
    const named = createGames(40000, undefined, 2, true, undefined, undefined, undefined, { schoolRivals: 'named' }), rival = named.state.actors[1]!;
    applyRivalHp(rival, 2, [{ id: 'brennic', school: 'fire', wave: 2, phases: [{ atHpFraction: 0.5 }], surgeTiers: 1, maxHp: 125 }]);
    expect([rival.maxHp, rival.hp]).toEqual([125, 125]);
    const before = rival.maxHp;
    applyRivalHp(rival, 3, [{ id: 'brennic', school: 'fire', wave: 2, phases: [{ atHpFraction: 0.5 }], surgeTiers: 1, maxHp: 140 }]);
    expect(rival.maxHp).toBe(before);
  });
});
