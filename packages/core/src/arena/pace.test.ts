import { describe, expect, it } from 'vitest';
import {
  addEnemy, addMage, adjustedSpell, combat, createArena, createGames, createLab, createTraining, defaultLabConfig, difficulties, enemyInputs, enemyRoster, idleInput,
  makeTuning, pacePolicy, paceOf, pacedWindupS, presets, runFight, scheduleTraining, spellFor, spells, stepArena, ticks, type Actor, type ArenaState, type Difficulty, type InputFrame,
} from './index.ts';
import { applyBoutInput, boutHash, replayBout, startBout, type BoutInput, type SeasonBout } from '../season.ts';

const enemyPace = pacePolicy.enemy as Record<Difficulty, number>;
const move = (x: number, patch: Partial<InputFrame> = {}): InputFrame => ({ ...idleInput({ x: 30, y: 10 }), move: { x, y: 0 }, ...patch });
/** Walk an actor along +x until its velocity settles; returns that velocity. */
function topSpeed(state: ArenaState, a: Actor): number {
  for (let i = 0; i < 60; i++) stepArena(state, { [a.id]: move(1) });
  return a.velocity!.x;
}
const floors = { unblockable: combat.reactionBands.minimumTelegraphUnblockableS, positional: combat.reactionBands.minimumTelegraphPositionalS };

describe('pace (feel.json pace): the player at a fixed pace, opponents by difficulty', () => {
  it('reads one pace per side from data and spawns every actor with it', () => {
    expect(pacePolicy.player).toBe(1.5);
    expect(enemyPace).toEqual({ easy: 1.2, normal: 1.5, hard: 1.8 });
    for (const d of difficulties) {
      const g = createGames(40000, undefined, 2, true, undefined, undefined, d);
      expect(g.state.difficulty).toBe(d);
      expect(paceOf(g.player)).toBe(1.5);
      for (const a of g.state.actors.filter(a => a.team !== g.player.team)) expect(paceOf(a)).toBe(enemyPace[d]);
    }
    expect(createGames(40000).state.difficulty).toBe('normal');
    expect(() => createArena(1, 'brutal' as Difficulty)).toThrow();
    // Without a difficulty the raw kernel keeps the authored 1x (and serializes no pace).
    const raw = createArena(1), mage = addMage(raw, 0, { x: 10, y: 10 });
    expect(paceOf(mage)).toBe(1); expect(JSON.stringify(raw)).not.toContain('pace');
  });

  it('walks the player at 1.5x the authored speed at every difficulty, reaching it in fewer ticks over the same distance', () => {
    const authored = createArena(1), base = addMage(authored, 0, { x: 4, y: 10 });
    expect(topSpeed(authored, base)).toBe(combat.movement.walkMps);
    for (const d of difficulties) {
      const s = createArena(1, d), p = addMage(s, 0, { x: 4, y: 10 });
      expect(topSpeed(s, p)).toBeCloseTo(combat.movement.walkMps * 1.5, 12);
    }
    // Acceleration scales by pace squared: time to top speed falls by the pace, the distance it takes is kept.
    const ramp = (s: ArenaState, a: Actor) => { const x = a.pos.x; let n = 0; while (a.velocity?.x !== combat.movement.walkMps * paceOf(a)) { stepArena(s, { [a.id]: move(1) }); n++; } return { n, m: a.pos.x - x }; };
    const s1 = createArena(1), a1 = addMage(s1, 0, { x: 4, y: 10 }), s2 = createArena(1, 'normal'), a2 = addMage(s2, 0, { x: 4, y: 10 });
    const r1 = ramp(s1, a1), r2 = ramp(s2, a2);
    expect(r2.n).toBeLessThan(r1.n);
    expect(r2.m).toBeCloseTo(r1.m, 1);
  });

  it('moves an enemy conscript at 1.2x / 1.5x / 1.8x by difficulty', () => {
    const spec = enemyRoster.find(e => e.id === 'conscript')!;
    for (const d of difficulties) {
      const s = createArena(1, d); addMage(s, 0, { x: 30, y: 10 });
      const c = addEnemy(s, 'conscript', { x: 4, y: 10 });
      expect(topSpeed(s, c)).toBeCloseTo(spec.speedMps * enemyPace[d], 12);
    }
  });

  it('divides Rain Needle cast time and cooldown by the player pace and multiplies its projectile speed', () => {
    const needle = spells.find(s => s.id === 'bolt:0:base')!, s = createArena(1, 'hard'), p = addMage(s, 0, { x: 10, y: 10 });
    const paced = spellFor(p, 0, s)!;
    expect(paced.castS).toBe(needle.castS / 1.5);
    expect(paced.cooldownS).toBeCloseTo(needle.cooldownS / 1.5, 12);
    expect(paced.speedMps).toBe(needle.speedMps * 1.5);
    stepArena(s, { [p.id]: { ...idleInput({ x: 20, y: 10 }), cast: true, slot: 0 } });
    expect(Math.hypot(s.projectiles[0]!.velocity.x, s.projectiles[0]!.velocity.y)).toBeCloseTo(30, 9);
    expect(p.water.cooldowns.bolt! - s.tick).toBe(ticks(0.25 / 1.5));
    expect(ticks(0.25 / 1.5)).toBeLessThan(ticks(0.25));
  });

  it('never shortens an unblockable warning below 0.8 s or a positional one below 0.4 s at Hard, even under the Lab fastest cast', () => {
    const fast = { ...makeTuning(), castTimeScale: 0.25 };
    for (const tuning of [undefined, fast]) {
      const s = createArena(1, 'hard'); if (tuning) s.tuning = tuning;
      const rival = addMage(s, 1, { x: 10, y: 10 });
      expect(paceOf(rival)).toBe(1.8);
      for (const spell of spells) {
        const w = adjustedSpell(spell, rival, s);
        if (spell.family === 'unblockable') expect(Math.max(w.castS, w.telegraphS)).toBeGreaterThanOrEqual(floors.unblockable);
        if (spell.kind === 'zone') expect(Math.max(w.castS, w.telegraphS)).toBeGreaterThanOrEqual(floors.positional);
      }
    }
    // Enemy windups are warnings: each sits on or above its floor at Hard (or keeps an authored value already under it).
    for (const spec of enemyRoster) for (const attack of spec.attacks) {
      const s = createArena(1, 'hard'), a = addEnemy(s, spec.id, { x: 10, y: 10 }), w = pacedWindupS(a, attack);
      const floor = attack.family === 'unblockable' ? floors.unblockable : floors.positional;
      expect(w).toBeGreaterThanOrEqual(Math.min(attack.windupS, floor));
      expect(w).toBeLessThanOrEqual(attack.windupS);
    }
    // Live: the thornback's unblockable charge and the conscript's lunge resolve exactly on their floors at Hard.
    for (const [id, floor] of [['thornback', floors.unblockable], ['conscript', floors.positional]] as const) {
      const s = createArena(1, 'hard'); addMage(s, 0, { x: 12, y: 10 }); const foe = addEnemy(s, id, { x: 10.5, y: 10 });
      enemyInputs(s);
      const t = s.telegraphs.find(t => t.ownerId === foe.id)!;
      expect(t.resolveTick - t.startTick).toBe(ticks(floor));
    }
    // The Lab dummy's charge drill keeps the unblockable floor too.
    const t = createTraining('charge', 1, 'hard'); t.nextAttack = 0; scheduleTraining(t);
    expect(t.state.telegraphs[0]!.resolveTick - t.state.telegraphs[0]!.startTick).toBe(ticks(floors.unblockable));
  });

  it('keeps the roll distance and shortens its duration, i-frames and recovery by the pace', () => {
    const roll = (difficulty?: Difficulty) => {
      const s = createArena(1, difficulty), p = addMage(s, 0, { x: 10, y: 10 }), x = p.pos.x;
      stepArena(s, { [p.id]: move(1, { roll: true }) });
      const ticksRolling = p.rollUntil - s.tick, iframes = p.immuneUntil - s.tick, recovery = p.recoveryUntil - p.rollUntil;
      while (s.tick < p.rollUntil) stepArena(s, { [p.id]: idleInput({ x: 30, y: 10 }) });
      return { distance: p.pos.x - x, ticksRolling, iframes, recovery };
    };
    const authored = roll(), paced = roll('easy');
    expect(authored.distance).toBeCloseTo(combat.roll.distanceM, 9);
    expect(paced.distance).toBeCloseTo(combat.roll.distanceM, 9);
    expect(authored.ticksRolling).toBe(ticks(combat.roll.durationS));
    expect(paced.ticksRolling).toBe(ticks(combat.roll.durationS / 1.5));
    expect(paced.iframes).toBe(ticks(combat.roll.iFramesS / 1.5));
    expect(paced.recovery).toBe(ticks(combat.roll.recoveryS / 1.5));
    expect(paced.ticksRolling).toBeLessThan(authored.ticksRolling);
  });

  it('leaves mana costs and regeneration per second unchanged', () => {
    const spend = (difficulty?: Difficulty) => {
      const s = createArena(1, difficulty), p = addMage(s, 0, { x: 10, y: 10 });
      p.mana = 10;
      stepArena(s, { [p.id]: { ...idleInput({ x: 20, y: 10 }), cast: true, slot: 0 } });
      const afterCast = p.mana;
      for (let i = 0; i < ticks(2); i++) stepArena(s, { [p.id]: idleInput({ x: 20, y: 10 }) });
      return { afterCast, afterRegen: p.mana, cost: spellFor(p, 0, s)!.mana };
    };
    const authored = spend(), paced = spend('hard');
    expect(paced.cost).toBe(authored.cost);
    expect(paced).toEqual(authored);
  });
});

describe('pace determinism', () => {
  it('replays each difficulty to an identical hash, and the difficulties differ', () => {
    const hashes = difficulties.map(d => {
      const a = runFight(40007, 2, 30, undefined, d), b = runFight(40007, 2, 30, undefined, d);
      expect(b.hash).toBe(a.hash);
      return a.hash;
    });
    expect(new Set(hashes).size).toBe(3);
    const lab = (d: Difficulty) => { const l = createLab({ ...defaultLabConfig, opponent: 'mage', difficulty: d }); expect(paceOf(l.training.dummy)).toBe(enemyPace[d]); return l; };
    expect(() => createLab({ ...defaultLabConfig, difficulty: 'brutal' as Difficulty })).toThrow();
    expect(lab('hard').training.state.difficulty).toBe('hard');
  });

  it('settles a season bout fought at Hard by replayBout with the same hash, and the bout carries its difficulty', () => {
    const bout: SeasonBout = { id: 'games:hard', day: 7, seed: 12, phase: 'prepared', spectator: false, composition: structuredClone(presets[2]!), games: null, log: [], difficulty: 'hard',
      entrant: { id: 'p', name: 'Cassia', school: 'water', ranks: { vigor: 3, focus: 3, nerve: 3 }, mastery: 2, hpPenalty: 0, staminaPenalty: 0 } };
    startBout(bout);
    expect(bout.games!.state.difficulty).toBe('hard');
    let i = 0;
    while (bout.phase !== 'terminal' && bout.games!.wave < 2) {
      const g = bout.games!, frame = { ...idleInput(g.state.actors.find(a => a.team !== g.player.team && !a.tags.includes('DEFEATED'))?.pos ?? { x: 30, y: 10 }), cast: i % 7 === 0, slot: i % 4, move: { x: Math.sin(i / 40), y: Math.cos(i / 55) }, absorb: i % 90 < 12 };
      const entry: BoutInput = g.phase === 'intermission' ? { type: 'advance', tick: g.state.tick } : { type: 'tick', tick: g.state.tick, input: frame };
      applyBoutInput(bout, entry); i++;
    }
    expect(bout.log.length).toBeGreaterThan(ticks(10));
    const replay = replayBout(bout);
    expect(boutHash(replay)).toBe(boutHash(bout));
    // The difficulty is part of what settlement replays: the same log at Normal diverges (or is refused at its first advance).
    let normal = 'refused';
    try { normal = boutHash(replayBout({ ...bout, difficulty: 'normal' })); } catch { /* the log no longer fits the bout */ }
    expect(normal).not.toBe(boutHash(bout));
  });
});
