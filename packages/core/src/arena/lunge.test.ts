import { describe, expect, it } from 'vitest';
import { addEnemy, addMage, arenaGeometry, combat, constrainToArena, createArena, createGames, enemyInputs, enemyRoster, idleInput, inArc, presets, queueDeathEffects, resolveHit, runtime, stateHash, stepArena, stepGames, ticks, type Actor, type ArenaState, type InputFrame } from './index.ts';
import { createLedger, observeLedger } from './ledger.ts';
import { sectorSweep, segmentHit, type Vec } from './math.ts';

const attack = (enemy: string) => enemyRoster.find(s => s.id === enemy)!.attacks[0]!;
const lunge = attack('conscript'), charge = attack('thornback');
const c = arenaGeometry.centre;
function step(s: ArenaState, player?: Actor, input?: (s: ArenaState) => InputFrame): void {
  stepArena(s, { ...enemyInputs(s), ...(player && input ? { [player.id]: input(s) } : {}) }); queueDeathEffects(s);
}
function duel(enemy: 'conscript' | 'thornback', gapM: number, playerAt: Vec = { x: c.x + gapM / 2, y: c.y }) {
  const s = createArena(7), player = addMage(s, 0, playerAt), foe = addEnemy(s, enemy, { x: c.x - gapM / 2, y: c.y });
  return { s, player, foe };
}
const hits = (s: ArenaState, id: number, activationId?: number) => s.events.filter(e => e.kind === 'hit' && e.actorId === id && (activationId === undefined || e.activationId === activationId));
const body = (s: ArenaState, ownerId: number) => s.telegraphs.find(t => t.ownerId === ownerId && !t.survivesOwner);

describe('authored travel stays inside the existing reach and warning', () => {
  it('splits the lunge range into travel and reach, runs the whole charge lane, and keeps both warning floors', () => {
    expect(lunge.travelM! + lunge.reachM!).toBeCloseTo(lunge.rangeM!, 12);
    expect(charge.travelM).toBe(Number(charge.telegraph!.match(/x ([\d.]+) m/)![1]));
    expect(lunge.windupS).toBeGreaterThanOrEqual(combat.reactionBands.minimumTelegraphPositionalS);
    expect(charge.windupS).toBeGreaterThanOrEqual(combat.reactionBands.minimumTelegraphUnblockableS);
    for (const [enemy, a] of [['conscript', lunge], ['thornback', charge]] as const) {
      const { s, foe } = duel(enemy, 2);
      enemyInputs(s);
      const t = body(s, foe.id)!;
      expect(t.resolveTick - t.startTick).toBe(ticks(a.windupS));
      expect(t.travelTicks).toBe(ticks(a.travelS!));
      expect(t.travelM).toBe(a.travelM);
    }
  });
  it('sweeps a sector exactly as sampling the moving weapon would', () => {
    const dir = { x: 0.6, y: 0.8 }, from = { x: 1, y: 2 }, to = { x: 1 + 0.6 * 1.2, y: 2 + 0.8 * 1.2 };
    for (let i = 0; i < 400; i++) {
      const centre = { x: from.x + ((i * 37) % 41) / 10 - 1.5, y: from.y + ((i * 53) % 43) / 10 - 1.5 };
      let sampled: number | undefined;
      for (let k = 0; k <= 2000 && sampled === undefined; k++) {
        const at = { x: from.x + (to.x - from.x) * k / 2000, y: from.y + (to.y - from.y) * k / 2000 };
        if (Math.hypot(centre.x - at.x, centre.y - at.y) <= 1.18 && inArc(dir, { x: centre.x - at.x, y: centre.y - at.y }, 80)) sampled = k / 2000;
      }
      const swept = sectorSweep(from, to, dir, centre, 1.18, 80);
      if (sampled === undefined) expect(swept === undefined || swept > 0.999, `centre ${JSON.stringify(centre)}`).toBe(true);
      else expect(swept, `centre ${JSON.stringify(centre)}`).toBeCloseTo(sampled, 2);
    }
    expect(sectorSweep(from, from, dir, { x: 1.6, y: 2.8 }, 1.18, 80)).toBe(0);
    expect(segmentHit(from, to, { x: 9, y: 9 }, 1)).toBeUndefined();
  });
});

describe('a committed body carries the attack', () => {
  it('charge: an in-lane target takes nothing until the swept lane reaches it, tick by tick', () => {
    const { s, player, foe } = duel('thornback', 8), origin = { ...foe.pos };
    const log: { tick: number; hp: number; x: number }[] = [];
    step(s); log.push({ tick: s.tick, hp: player.hp, x: foe.pos.x });
    const t = body(s, foe.id)!, step1 = charge.travelM! / t.travelTicks!, contact = t.resolveTick + Math.ceil((8 - t.widthM / 2 - player.radius) / step1) - 1;
    while (s.tick < contact + 3) { step(s); log.push({ tick: s.tick, hp: player.hp, x: foe.pos.x }); }
    for (const row of log) {
      if (row.tick < contact) expect(row.hp, `tick ${row.tick}`).toBe(player.maxHp);
      else expect(row.hp, `tick ${row.tick}`).toBe(player.maxHp - charge.damage);
      if (row.tick < t.resolveTick) expect(row.x).toBe(origin.x);
      else expect(row.x).toBeCloseTo(origin.x + step1 * (row.tick - t.resolveTick + 1), 9);
    }
    expect(contact - t.resolveTick).toBe(19);
  });
  it('lunge: no damage through the windup and the first eight travel ticks; the spear lands on the ninth', () => {
    const { s, player, foe } = duel('conscript', 2);
    step(s); const t = body(s, foe.id)!, contact = t.resolveTick + 8;
    while (s.tick < contact + 3) {
      step(s);
      expect(player.hp, `tick ${s.tick}`).toBe(s.tick < contact ? player.maxHp : player.maxHp - lunge.damage);
    }
    // Reach does not grow: at full extension the spear tip is the old 2 m range from where the lunge began.
    expect(foe.pos.x - (c.x - 1)).toBeCloseTo(lunge.travelM!, 9);
  });
  it('one activation meets each target once, even while the lane overlaps it for many ticks', () => {
    const { s, player, foe } = duel('thornback', 8), ally = addMage(s, 0, { x: c.x + 6, y: c.y + 0.5 });
    let activation: number | undefined, overlapTicks = 0;
    while (s.tick < 200) {
      const before = { ...foe.pos }; step(s);
      activation ??= body(s, foe.id)?.activationId;
      if (segmentHit(before, foe.pos, player.pos, 1 + player.radius) !== undefined) overlapTicks++;
    }
    expect(overlapTicks).toBeGreaterThan(3);
    expect(hits(s, player.id, activation)).toHaveLength(1);
    expect(hits(s, ally.id, activation)).toHaveLength(1);
  });
  it('roll i-frames swallow the contact, and the spent contact never lands after the roll', () => {
    const results = [];
    for (let rollAt = 70; rollAt <= 84; rollAt++) {
      const { s, player, foe } = duel('thornback', 8), ledger = createLedger(s, player.id);
      while (s.tick < 160) {
        step(s, player, st => ({ ...idleInput(foe.pos), roll: st.tick + 1 === rollAt, move: { x: st.tick + 1 === rollAt ? 1 : 0, y: 0 } }));
        observeLedger(ledger, s);
      }
      results.push({ rollAt, rolled: ledger.counts.unblockable.rolled, took: ledger.counts.unblockable.took, hp: player.hp, max: player.maxHp, hits: hits(s, player.id).length });
    }
    const saved = results.filter(r => r.rolled === 1);
    expect(saved.length).toBeGreaterThan(0);
    expect(results.some(r => r.took === 1 && r.hp < r.max)).toBe(true);
    for (const r of saved) { expect(r.took).toBe(0); expect(r.hp).toBe(r.max); expect(r.hits).toBe(0); }
  });
  it('stagger or defeat stops the travel where the body stands', () => {
    for (const enemy of ['thornback', 'conscript'] as const)
      for (const damage of [5, 10000]) {
        const { s, player, foe } = duel(enemy, enemy === 'thornback' ? 10 : 2);
        let t = body(s, foe.id);
        while (!t?.contacted || s.tick < t.resolveTick + 2) { step(s); t ??= body(s, foe.id); }
        if (!t) throw Error('no attack');
        resolveHit(s, foe, { ownerId: player.id, activationId: 9999, damage, family: 'magic', tier: 1, source: { ...player.pos } });
        expect(s.telegraphs.some(x => x.activationId === t.activationId)).toBe(false);
        const stopped = { ...foe.pos };
        step(s); expect(foe.pos).toEqual(stopped);
        for (let i = 0; i < 60; i++) step(s);
        expect(hits(s, player.id, t.activationId)).toHaveLength(0);
        if (damage > 100) expect(foe.pos).toEqual(stopped);
      }
  });
  it('a wall ends the charge with the authored 1.5 s self-stun; open ground leaves no stun', () => {
    const edge = c.x + arenaGeometry.widthM / 2, s = createArena(), p = addMage(s, 0, { x: edge - 1, y: c.y }), thorn = addEnemy(s, 'thornback', { x: edge - 9, y: c.y });
    let wallTick = 0;
    while (!wallTick && s.tick < 200) { step(s); if (thorn.enemy!.stunnedUntil) wallTick = s.tick; }
    const wall = constrainToArena({ x: edge + 10, y: c.y }, thorn.radius);
    expect(thorn.enemy!.stunnedUntil - wallTick).toBe(ticks(1.5));
    expect(thorn.pos.x).toBeCloseTo(wall.x, 9);
    expect(s.telegraphs).toHaveLength(0);
    expect(p.hp).toBe(p.maxHp - charge.damage);
    const parked = { ...thorn.pos };
    while (s.tick < thorn.enemy!.stunnedUntil - 1) { step(s); expect(thorn.pos).toEqual(parked); expect(body(s, thorn.id)).toBeUndefined(); }
    const open = duel('thornback', 4);
    for (let i = 0; i < 120; i++) step(open.s);
    expect(open.foe.enemy!.stunnedUntil).toBe(0);
  });
});

describe('travel state serializes', () => {
  it('a Tiro soldier bout resumed mid-lunge (structuredClone and JSON) continues to the same hash', () => {
    const g = createGames(40001, presets.find(p => p.name === runtime.games.referencePreset)!, 0, true);
    while (!g.state.telegraphs.some(t => t.contacted && g.state.tick > t.resolveTick) && g.state.tick < 3600) stepGames(g);
    const moving = g.state.telegraphs.find(t => t.contacted)!;
    expect(moving.travelM).toBe(lunge.travelM);
    const cloned = structuredClone(g), json = JSON.parse(JSON.stringify(g)) as typeof g;
    json.player = json.state.actors.find(a => a.id === g.player.id)!;
    const run = (x: typeof g) => { for (let i = 0; i < 900; i++) stepGames(x); return stateHash(x.state); };
    const straight = run(g);
    expect(run(cloned)).toBe(straight);
    expect(run(json)).toBe(straight);
  });
  it('a thornback charge resumed mid-travel continues to the same hash', () => {
    const a = duel('thornback', 10);
    while (!(body(a.s, a.foe.id)?.contacted && a.s.tick > body(a.s, a.foe.id)!.resolveTick + 4)) step(a.s);
    const b = structuredClone(a.s);
    for (let i = 0; i < 240; i++) { step(a.s); step(b); }
    expect(stateHash(b)).toBe(stateHash(a.s));
  });
});

describe('the ledger reads committed bodies honestly', () => {
  it('grades a sidestepped charge as avoided', () => {
    const { s, player, foe } = duel('thornback', 10), ledger = createLedger(s, player.id);
    let seen: number | undefined, passed = false;
    for (let i = 0; i < 240; i++) {
      step(s, player, () => ({ ...idleInput(foe.pos), move: { x: 0, y: seen === undefined ? 0 : 1 } }));
      observeLedger(ledger, s); seen ??= body(s, foe.id)?.activationId;
      passed ||= foe.pos.x > player.pos.x;
    }
    expect(passed).toBe(true);
    expect(hits(s, player.id)).toHaveLength(0);
    expect(ledger.entries.find(e => e.activationId === seen)?.answer).toBe('avoided');
    expect(ledger.counts.unblockable.avoided).toBe(1);
  });
  it('grades a lunge taken under a raised ward as guarded (steel)', () => {
    const { s, player, foe } = duel('conscript', 2), ledger = createLedger(s, player.id);
    for (let i = 0; i < ticks(1); i++) { step(s, player, () => ({ ...idleInput(foe.pos), absorb: true })); observeLedger(ledger, s); }
    const [entry] = ledger.entries;
    expect(entry).toMatchObject({ family: 'physical', answer: 'guarded', mistake: 'steel', guarded: true });
    expect(player.maxHp - player.hp).toBeCloseTo(lunge.damage * (1 - combat.absorb.reduction.physical), 9);
  });
});
