import { defaultTuning } from './tuning.ts';
import { describe, expect, it } from 'vitest';
import { addEnemy, addMage, advanceGames, attachMageAI, arenaGeometry, constrainToArena, competence, createArena, createGames, enemyInputs, enemyRoster, gamesResult, idleInput, mageInput, presets, queueDeathEffects, resolveHit, runFight, spawnProjectile, stateHash, stepArena, stepGames, ticks, tiro } from './index.ts';
import { rivalBuilds } from './archetypes.ts';
import { exchangeReachM, exchangeRule, type ExchangeRule } from './exchange.ts';
import { rankDefenceHpMult, rankDefenceProblems } from './games.ts';
const simulateEnemies = (state: ReturnType<typeof createArena>, count: number) => { for (let i = 0; i < count; i++) { stepArena(state, enemyInputs(state)); queueDeathEffects(state); } };
describe('the full roster on common damage and movement rules', () => {
  it('spawns all eight distinct data-defined enemies and attacks', () => {
    expect(enemyRoster.map(s => s.id)).toEqual(['conscript','shieldman','slinger','netter','cinder_hound','mire_maw','thornback','hush_moth']);
    const state = createArena();
    for (const spec of enemyRoster) { const enemy = addEnemy(state, spec.id, { x: 20, y: 10 }); expect(enemy.maxHp).toBe(spec.hp); expect(enemy.speedMps).toBe(spec.speedMps); }
    expect(() => addEnemy(state, 'invented', { x: 1, y: 1 })).toThrow();
  });
  it('spear windup is honest and a moving player can leave it', () => {
    const state = createArena(), player = addMage(state, 0, { x: 10, y: 10 }); addEnemy(state, 'conscript', { x: 12, y: 10 });
    // Windup, then the lunge carries the spear 1.2 m: at 2 m the 0.8 m reach meets the player on the ninth travel tick, not before.
    simulateEnemies(state, ticks(0.6) + 8); expect(player.hp).toBe(player.maxHp); simulateEnemies(state, 1); expect(player.hp).toBe(player.maxHp - 10);
    expect(state.actors[1]!.enemy!.backoffUntil).toBeGreaterThan(state.tick);
  });
  it('conscript recovers before its separate backoff interval and keeps the committed aim', () => {
    const state = createArena(), player = addMage(state, 0, { x: 10, y: 10 }), enemy = addEnemy(state, 'conscript', { x: 12, y: 10 });
    simulateEnemies(state, 1); const aim = { ...state.telegraphs[0]!.target }; player.pos.y += 3;
    expect(enemyInputs(state)[enemy.id]!.aim).toEqual(aim);
    simulateEnemies(state, ticks(0.6) + ticks(0.2)); const pos = { ...enemy.pos }; expect(pos.x).toBeCloseTo(12 - 1.2);
    simulateEnemies(state, ticks(0.4)); expect(enemy.pos).toEqual(pos);
    expect(enemy.enemy!.backoffUntil - ticks(1)).toBe(1 + ticks(0.6 + 0.2 + 0.5));
  });
  it('shield blocks direct frontal hits, with flank and area counterplay', () => {
    const state = createArena(), a = addEnemy(state, 'shieldman', { x: 10, y: 10 });
    const hit = { ownerId: 100, activationId: 100, damage: 10, family: 'magic' as const, tier: 1, source: { x: 12, y: 10 }, delivery: 'projectile' as const };
    expect(resolveHit(state, a, hit).damage).toBe(0); expect(resolveHit(state, a, { ...hit, source: { x: 8, y: 10 } }).damage).toBe(10);
    expect(resolveHit(state, a, { ...hit, delivery: 'area' }).damage).toBe(10);
    const b = addEnemy(state, 'thornback', { x: 20, y: 10 }); expect(resolveHit(state, b, { ...hit, bolt: true }).damage).toBe(5);
  });
  it('nets root after a ground warning, never during roll immunity', () => {
    const state = createArena(), player = addMage(state, 0, { x: 10, y: 10 }); addEnemy(state, 'netter', { x: 18, y: 10 });
    simulateEnemies(state, 1); expect(state.telegraphs[0]!.kind).toBe('area'); expect(player.water.rootUntil).toBe(0);
    player.immuneUntil = ticks(2); simulateEnemies(state, ticks(1)); expect(player.water.rootUntil).toBe(0);
    player.immuneUntil = 0; simulateEnemies(state, ticks(6)); expect(player.water.rootUntil).toBeGreaterThan(0); expect(player.hp).toBe(player.maxHp);
  });
  it('packs use two bite slots and leave absorbable death bursts', () => {
    const state = createArena(), player = addMage(state, 0, { x: 10, y: 10 });
    const pack = [addEnemy(state, 'cinder_hound', { x: 11, y: 10 }), addEnemy(state, 'cinder_hound', { x: 10, y: 11 }), addEnemy(state, 'cinder_hound', { x: 9, y: 10 })];
    enemyInputs(state); expect(state.telegraphs.filter(t => t.kind === 'melee')).toHaveLength(2);
    pack[0]!.tags = ["DEFEATED"]; pack[0]!.hp = 0; state.telegraphs = []; queueDeathEffects(state);
    expect(state.telegraphs).toHaveLength(1); expect(state.telegraphs[0]!.survivesOwner).toBe(true);
    for (const a of pack.slice(1)) { a.tags = ["DEFEATED"]; a.enemy!.deathQueued = true; }
    for (let i = 0; i < ticks(0.6); i++) stepArena(state, { [player.id]: { ...idleInput(pack[0]!.pos), absorb: i >= ticks(0.5) } });
    expect(player.metrics.perfects).toBe(1); expect(player.hp).toBe(player.maxHp);
  });
  it('maw alternates glob and pull; thornback charges and stuns at a wall', () => {
    const state = createArena(), player = addMage(state, 0, { x: 4, y: 10 }), maw = addEnemy(state, 'mire_maw', { x: 10, y: 10 });
    enemyInputs(state); expect(state.telegraphs[0]!.family).toBe('magic'); state.telegraphs = []; maw.enemy!.readyTick = 0;
    enemyInputs(state); expect(state.telegraphs[0]!.pullM).toBe(4);
    for (let i = 0; i < ticks(1) + 1; i++) stepArena(state); expect(player.pos.x).toBeCloseTo(8 - defaultTuning.knockbackM * .4);
    const s = createArena(), edge = arenaGeometry.centre.x + arenaGeometry.widthM / 2, y = arenaGeometry.centre.y, p = addMage(s, 0, { x: edge - 1, y }), thorn = addEnemy(s, 'thornback', { x: edge - 7, y });
    simulateEnemies(s, ticks(1) + ticks(0.6) + 1); expect(p.hp).toBe(p.maxHp - 22); expect(thorn.enemy!.stunnedUntil).toBeGreaterThan(s.tick);
    const wall = constrainToArena({ x: edge + 10, y }, thorn.radius); expect(thorn.pos.x).toBeCloseTo(wall.x, 9); expect(thorn.pos.y).toBeCloseTo(wall.y, 9);
  });
  it('moths drain mana in contact without HP damage; Fog prevents ranged acquisition', () => {
    const state = createArena(), player = addMage(state, 0, { x: 10, y: 10 });
    for (let i = 0; i < 6; i++) addEnemy(state, 'hush_moth', { x: 10.5, y: 10 });
    simulateEnemies(state, ticks(1)); expect(player.mana).toBeCloseTo(player.maxMana - 36 + 7.5); expect(player.hp).toBe(player.maxHp);
    const fog = createArena(), p = addMage(fog, 0, { x: 10, y: 10 }); const slinger = addEnemy(fog, 'slinger', { x: 20, y: 10 });
    fog.zones.push({ id: 100, ownerId: p.id, kind: 'fog', pos: p.pos, radiusM: 3, until: 300, slowMult: 1 }); enemyInputs(fog); expect(fog.telegraphs).toHaveLength(0); expect(slinger.enemy!.attackIndex).toBe(0);
  });
});
describe('mage competence is inputs, never stats', () => {
  it('encasement silences actions but preserves passive regeneration; hit metrics exclude overkill', () => {
    const state = createArena(), a = addMage(state, 0, { x: 10, y: 10 }), b = addMage(state, 1, { x: 12, y: 10 });
    a.water.encasedUntil = ticks(2); a.mana = 10; a.stamina = 10;
    for (let i = 0; i < ticks(1); i++) stepArena(state, { [a.id]: { ...idleInput(b.pos), cast: true, move: { x: 1, y: 0 } } });
    expect(a.mana).toBeCloseTo(17.5); expect(a.stamina).toBeCloseTo(30); expect(a.metrics.casts).toBe(0);
    b.hp = 1; resolveHit(state, b, { ownerId: a.id, activationId: 100, family: 'magic', tier: 4, damage: 100, source: a.pos });
    expect(b.metrics.damageTaken).toBe(1); expect(a.metrics.damageDealt).toBe(1); expect(state.events.find(e => e.kind === 'hit')!.value).toBe(1);
  });
  it('interpolates fractional competence and enforces the caps', () => {
    expect(competence(1.5)).toMatchObject({ reactionDelayS: 0.5, absorbChance: 0.5, perfectChance: 0.1, aimErrorDeg: 10, decisionCadenceS: 0.45 });
    expect(competence(100).reactionDelayS).toBeGreaterThanOrEqual(0.25); expect(competence(100).perfectChance).toBeLessThanOrEqual(0.45);
  });
  it('preserves rank-derived resources and cannot react before the delay', () => {
    for (const level of [1, 1.5, 2, 3, 4]) {
      const state = createArena(100), a = addMage(state, 0, { x: 10, y: 10 }), b = addMage(state, 1, { x: 20, y: 10 });
      const before = [a.maxHp, a.maxMana, a.maxStamina, a.ranks]; attachMageAI(a, level); expect([a.maxHp,a.maxMana,a.maxStamina,a.ranks]).toEqual(before);
      spawnProjectile(state, { ownerId: b.id, activationId: 99, damage: 14, family: 'magic', tier: 1, source: b.pos }, b.pos, { x: -1, y: 0 }, 1, 20);
      for (let i = 0; i < ticks(competence(level).reactionDelayS); i++) { mageInput(state, a); state.tick++; }
      expect(a.mageAI!.reactionAges).toHaveLength(0); mageInput(state, a);
      expect(a.mageAI!.reactionAges[0]).toBeGreaterThanOrEqual(ticks(competence(level).reactionDelayS));
      expect(a.mageAI!.decisionTicks.slice(1).every((v, i) => v - a.mageAI!.decisionTicks[i]! >= ticks(competence(level).decisionCadenceS))).toBe(true);
    }
  });
  it('uses the common kernel for casts and redirects aim to a decoy', () => {
    const state = createArena(1), a = addMage(state, 0, { x: 10, y: 10 }), target = addMage(state, 1, { x: 17, y: 10 });
    attachMageAI(a, 4); target.water.decoy = { pos: { x: 17, y: 16 }, until: 300 };
    const input = mageInput(state, a); expect(input.aim.y).toBeGreaterThan(14);
    const mana = a.mana; stepArena(state, { [a.id]: input }); expect(a.metrics.casts).toBe(1); expect(a.mana).toBeLessThan(mana);
  });
});
describe('Tiro lifecycle and replay', () => {
  it('uses the exact spawn composition and final competence', () => {
    const g = createGames(3); expect(g.state.actors.filter(a => a.enemy?.id === 'conscript')).toHaveLength(4); expect(g.state.actors.filter(a => a.enemy?.id === 'slinger')).toHaveLength(2);
    const final = createGames(3, presets[0], 3); expect(final.state.actors[1]!.mageAI!.competence).toBe(1.5);
  });
  it('advances only on clear, heals missing HP once, resets resources and collar', () => {
    const g = createGames(3); expect(() => advanceGames(g)).toThrow(); g.player.hp = 45; g.player.mana = 2;
    for (const a of g.state.actors.slice(1)) { a.tags = ["DEFEATED"]; a.hp = 0; }
    stepGames(g, idleInput()); expect(g.phase).toBe('intermission'); const hp = g.player.hp;
    advanceGames(g); expect(g.player.hp).toBe(hp + (g.player.maxHp - hp) * 0.3); expect(g.player.mana).toBe(g.player.maxMana); expect(g.player.tier).toBe(1);
    expect(g.state.actors.filter(a => a.enemy?.id === 'cinder_hound')).toHaveLength(3); expect(g.state.actors.filter(a => a.enemy?.id === 'mire_maw')).toHaveLength(1); expect(() => advanceGames(g)).toThrow();
  });
  it('simultaneous Down loses, cannot advance, and payout is idempotent', () => {
    const g = createGames(3); g.wavesCleared = 2; for (const a of g.state.actors) { a.tags = ["DEFEATED"]; a.hp = 0; } stepGames(g);
    expect(g.phase).toBe('lost'); expect(() => advanceGames(g)).toThrow(); const result = gamesResult(g); expect(gamesResult(g)).toBe(result);
    expect(result.gold).toBe(tiro.payoutGold[1]); expect(result.renown).toBe(tiro.renown[1]);
  });
  it('all four clears yield one final reward, not a sum of payouts', () => {
    const g = createGames(3);
    for (let wave = 0; wave < 4; wave++) {
      for (const a of g.state.actors.slice(1)) { a.tags = ["DEFEATED"]; a.hp = 0; if (a.enemy) a.enemy.deathQueued = true; }
      g.state.projectiles = []; g.state.telegraphs = []; stepGames(g, idleInput());
      if (wave < 3) advanceGames(g);
    }
    expect(g.phase).toBe('complete'); expect(gamesResult(g)).toEqual({ kind: 'champion', wavesCleared: 4, gold: 100, renown: 25, finalReached: true, finalWon: true });
  });
  it('seeded input policies replay exactly and stay finite', () => {
    const a = runFight(40000, 2), b = runFight(40000, 2); expect(a).toEqual(b); expect(a.finite).toBe(true);
    expect(runFight(40001, 2).hash).not.toBe(a.hash);
  });
});

// D1 6.10 levers (a reading: only the week census sets them). Both read the rank steps a mage gained above its authored build.
describe('createGames rankDefence and exchangeReach (D1 6.10, off by default)', () => {
  const heavyGames = (options: Parameters<typeof createGames>[7] = {}) => createGames(40000, presets[0], rivalBuilds.fire_heavy!.wave, true, undefined, undefined, undefined, { rivalBuild: 'fire_heavy', ...options });
  const rivalOf = (g: ReturnType<typeof createGames>) => g.state.actors.find(a => a.team !== g.player.team)!;
  const spellRanks = { 'bolt:0': 3, [`${presets[0]!.lines[0]}:1`]: 5 };

  it('rankDefence scales each mage\'s HP by its gained steps: the player by its own ranks, the rival by the opponentMage gain only', () => {
    const plain = heavyGames({ spellRanks, opponentMage: { averageRank: 2.5 } }), defended = heavyGames({ spellRanks, opponentMage: { averageRank: 2.5 }, rankDefence: { hpPerRankStep: 0.1 } });
    const rows = 1 + presets[0]!.lines.length * 4, playerSteps = (2 + 3) / rows;
    expect(defended.player.maxHp).toBeCloseTo(plain.player.maxHp * (1 + 0.1 * playerSteps), 9);
    expect(defended.player.hp).toBe(defended.player.maxHp);
    // fire_heavy's authored ranks (Pyre 2, Sunfall 2, Brand Wrath 5 counted as 4) are not a gain; rank 2.5 lifts Pyre and the bolt to 3, Ring to 2.
    const authored = (1 + 1 + 3) / 5, gained = (2 + 1 + 3 + 2 + 1) / 5 - authored;
    expect(rivalOf(defended).maxHp).toBeCloseTo(rivalOf(plain).maxHp * (1 + 0.1 * gained), 9);
    expect(rankDefenceHpMult(gained, { hpPerRankStep: 0.1 })).toBeCloseTo(1 + 0.1 * gained, 12);
    // No gain, no change: the authored build alone, and an unranked player, spawn as today.
    expect(stateHash(heavyGames({ rankDefence: { hpPerRankStep: 0.1 } }).state)).toBe(stateHash(heavyGames().state));
  });

  it('exchangeReach widens a gained defender\'s window and leaves a Games without gains as today; bad levers are refused', () => {
    const g = heavyGames({ spellRanks, opponentMage: { averageRank: 2.5 }, exchangeReach: { perRankStepM: 1 } }), rule = exchangeRule as ExchangeRule;
    expect(exchangeReachM(g.state, rule, g.player)).toBeCloseTo(rule.closeRangeM + (2 + 3) / (1 + presets[0]!.lines.length * 4), 12);
    expect(exchangeReachM(g.state, rule, rivalOf(g))).toBeCloseTo(rule.closeRangeM + (2 + 1 + 3 + 2 + 1) / 5 - (1 + 1 + 3) / 5, 12);
    expect(exchangeReachM(heavyGames({ spellRanks }).state, rule, g.player), 'no reach option: closeRangeM').toBe(rule.closeRangeM);
    const run = (options: Parameters<typeof createGames>[7]) => { const r = heavyGames(options); for (let i = 0; i < 600; i++) stepGames(r); return stateHash(r.state); };
    expect(run({ exchangeReach: { perRankStepM: 1 }, rankDefence: { hpPerRankStep: 0.1 } })).toBe(run({}));
    expect(() => heavyGames({ exchangeReach: { perRankStepM: 0 } })).toThrow('Invalid exchange reach');
    expect(() => heavyGames({ rankDefence: { hpPerRankStep: 2 } })).toThrow('Invalid rank defence');
    expect(rankDefenceProblems({ hpPerRankStep: 0.05, extra: 1 })).toEqual(['Rank defence: unknown key extra.']);
  });
});
