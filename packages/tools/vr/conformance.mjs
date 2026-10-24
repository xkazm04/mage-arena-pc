// Replays VR's conformance vectors (mage-arena-vr/apps/vr/data/conformance/*.json) against this repo's TypeScript
// kernel. The vectors were recorded by VR's oracle from the pinned kernel (PINNED.json commit); VR's C++ replays them
// in Tests/KernelConformanceTests.cpp. This file is a JavaScript port of that replay, so PC can see which vectors its
// HEAD still satisfies. No VR code is imported at run time: the pieces below are copies, each naming its source.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL, URL } from 'node:url';
import { close, compare, createBout, makeDiff, POLICY, TOLERANCE } from './harness.mjs';

export { close, TOLERANCE };

export const repoRoot = new URL('../../../', import.meta.url);
export const kernelEntry = new URL('packages/core/src/arena/index.ts', repoRoot);
export const generatedData = new URL('packages/core/src/arena/data.generated.ts', repoRoot);

/** Loads the PC arena kernel through Node's type stripping (as packages/tools/replay/hour-days.mjs does). */
export async function loadKernel(entry = kernelEntry) {
  try {
    return await import(typeof entry === 'string' ? pathToFileURL(entry).href : entry.href);
  } catch (err) {
    if (String(err?.message ?? err).includes('data.generated.ts')) {
      throw new Error('packages/core/src/arena/data.generated.ts is missing: run `npm run build` (or `npm --prefix packages/core run data`) first', { cause: err });
    }
    throw err;
  }
}

/** The conformance comparison (harness.compare with POLICY.conformance): the first difference or null. */
export function firstDiff(expected, actual, path, tol = TOLERANCE, skip = POLICY.conformance.skip) {
  return compare(expected, actual, { ...POLICY.conformance, tol, skip }, path);
}
const show = (value) => (value === undefined ? 'undefined' : JSON.stringify(value));

// PC adapter: the pinned kernel kept a boolean `down`; PC replaced it with the DEFEATED tag (types.ts isDefeated).
// The vector field `down` reads either form, so a representation change is not reported as a rule change.
export const isDown = (actor) => ('down' in actor ? !!actor.down : Array.isArray(actor.tags) && actor.tags.includes('DEFEATED'));

// exportActor / snapshot / exportEvents / exportGames: copied from mage-arena-vr apps/vr/tools/conformance/oracle.mjs
// (same field names, so a vector checkpoint and a PC snapshot compare key for key). stateHash is left out.
function exportActor(actor) {
  const pending = actor.pending;
  const decoy = actor.water.decoy;
  return {
    id: actor.id, team: actor.team, label: actor.label,
    x: actor.pos.x, y: actor.pos.y, px: actor.previousPos.x, py: actor.previousPos.y, fx: actor.facing.x, fy: actor.facing.y,
    hp: actor.hp, mana: actor.mana, stamina: actor.stamina, down: isDown(actor), dummy: actor.dummy, absorb: actor.absorb,
    absorbFreshTick: actor.absorbFreshTick, releaseTick: actor.releaseTick, tier: actor.tier, lastUnlockTick: actor.lastUnlockTick,
    clockAdvanceTicks: actor.clockAdvanceTicks,
    flow: actor.water.flow, stored: actor.water.stored, crests: actor.water.crests, healing: actor.water.healing,
    controlTicks: actor.water.controlTicks, rootUntil: actor.water.rootUntil, encasedUntil: actor.water.encasedUntil,
    slowUntil: actor.water.slowUntil, slowMult: actor.water.slowMult, wardUntil: actor.water.wardUntil,
    sheenUntil: actor.water.sheenUntil, hotUntil: actor.water.hotUntil, hotPerTick: actor.water.hotPerTick,
    composition: {
      name: actor.water.composition.name,
      lines: [...actor.water.composition.lines],
      branches: {
        lash: actor.water.composition.branches.lash,
        mirror: actor.water.composition.branches.mirror,
        tide_orb: actor.water.composition.branches.tide_orb,
      },
    },
    cooldowns: { ...actor.water.cooldowns },
    unlocks: [...actor.unlockTicks],
    pendingKind: pending ? pending.kind : null,
    pendingSpell: pending?.spellId ?? null,
    pendingRelease: pending ? pending.releaseTick : null,
    pendingDamageMult: pending?.damageMult ?? null,
    metrics: { ...actor.metrics },
    enemy: actor.enemy
      ? {
          id: actor.enemy.id, readyTick: actor.enemy.readyTick, backoffUntil: actor.enemy.backoffUntil,
          stunnedUntil: actor.enemy.stunnedUntil, attackIndex: actor.enemy.attackIndex, deathQueued: actor.enemy.deathQueued,
        }
      : null,
    speedMps: actor.speedMps ?? null,
    decoy: decoy ? { x: decoy.pos.x, y: decoy.pos.y, until: decoy.until } : null,
  };
}

export function snapshot(state) {
  return {
    tick: state.tick, rng: state.rng, nextId: state.nextId, eventCount: state.events.length, randomDraws: state.randomLog.length,
    actors: state.actors.map(exportActor),
    projectiles: state.projectiles.map((p) => ({
      id: p.id, ownerId: p.ownerId, activationId: p.activationId, x: p.pos.x, y: p.pos.y, px: p.previousPos.x, py: p.previousPos.y,
      vx: p.velocity.x, vy: p.velocity.y, damage: p.damage, remainingM: p.remainingM, radius: p.radius, family: p.family,
      tier: p.tier, bolt: !!p.bolt, reflected: !!p.reflected, piercing: !!p.piercing, burst: p.burstRadiusM ?? 0,
      delivery: p.delivery ?? null, hitIds: [...p.hitIds],
    })),
    telegraphs: state.telegraphs.map((t) => ({
      id: t.id, ownerId: t.ownerId, kind: t.kind, family: t.family, tier: t.tier, damage: t.damage, resolveTick: t.resolveTick,
      startTick: t.startTick, ox: t.origin.x, oy: t.origin.y, tx: t.target.x, ty: t.target.y, speedMps: t.speedMps,
      rangeM: t.rangeM, widthM: t.widthM, survives: !!t.survivesOwner,
    })),
    zones: state.zones.map((z) => ({
      id: z.id, ownerId: z.ownerId, kind: z.kind, x: z.pos.x, y: z.pos.y, radiusM: z.radiusM, until: z.until, slowMult: z.slowMult,
    })),
  };
}

export function exportEvents(events) {
  return events.map((e) => ({ tick: e.tick, kind: e.kind, actorId: e.actorId, targetId: e.targetId ?? null, value: e.value }));
}

function exportGames(games) {
  const result = games.result ?? null;
  return {
    wave: games.wave, phase: games.phase, wavesCleared: games.wavesCleared, playerId: games.player.id,
    resultKind: result ? result.kind : null, gold: result ? result.gold : null, renown: result ? result.renown : null,
    finalReached: result ? result.finalReached : null, finalWon: result ? result.finalWon : null,
  };
}

// The replay below follows KernelConformanceTests.cpp: ApplySetup, Drive, ApplyOp and Replay (checkpoint cursor,
// pre-ops / post-ops rows, event prefix at each checkpoint, full event list at the end).
// A Mismatch carries the harness Diff; `diff` keeps the report's { tick, when, field, detail } view of it.
class Mismatch extends Error {
  constructor(tick, when, field, detail, values = {}) {
    super(`tick ${tick} ${when} ${field}: ${detail}`);
    this.record = makeDiff({ tick, when, path: field, expected: values.expected, actual: values.actual, detail });
    this.diff = { tick, when, field, detail };
  }
}

function applySetup(k, state, setup) {
  for (const spec of setup.actors) {
    const ranks = { vigor: spec.ranks.vigor, focus: spec.ranks.focus, nerve: spec.ranks.nerve };
    const actor = spec.enemy != null ? k.addEnemy(state, spec.enemy, { x: spec.x, y: spec.y }) : k.addMage(state, spec.team, { x: spec.x, y: spec.y }, spec.label, ranks);
    if (actor.id !== spec.id) throw new Mismatch(0, 'setup', 'setup.id', `expected ${spec.id} got ${actor.id}`);
    // The C++ recomputes max mana and stamina from the ranks; a scratch mage gives this kernel's own reading of them.
    const probe = k.addMage(k.createArena(0), 0, { x: 0, y: 0 }, '', ranks);
    actor.team = spec.team;
    actor.label = spec.label;
    actor.ranks = ranks;
    actor.maxHp = spec.maxHp;
    actor.hp = spec.hp;
    actor.maxMana = probe.maxMana;
    actor.mana = spec.mana;
    actor.maxStamina = probe.maxStamina;
    actor.stamina = actor.maxStamina;
    actor.water = k.newWaterState({
      name: spec.composition.name,
      lines: [...spec.composition.lines],
      branches: { ...spec.composition.branches },
    });
    actor.water.flow = spec.flow;
    actor.tier = spec.tier;
    actor.lastUnlockTick = spec.lastUnlockTick;
    actor.clockAdvanceTicks = spec.clockAdvanceTicks;
    actor.absorbFreshTick = spec.absorbFreshTick;
    actor.releaseTick = spec.releaseTick;
    actor.dummy = spec.dummy;
    actor.absorb = spec.absorb;
    actor.absorbExhausted = spec.absorbExhausted;
    actor.facing = { x: spec.facing.x, y: spec.facing.y };
  }
}

function drive(k, driver, ctx, held, autoAdvance) {
  if (driver === 'training') {
    const input = held.get(ctx.training.player.id) ?? k.idleInput(ctx.training.dummy.pos);
    k.stepTraining(ctx.training, input);
    return;
  }
  if (driver === 'games') {
    k.stepGames(ctx.games, held.get(ctx.games.player.id));
    if (autoAdvance && ctx.games.phase === 'intermission') k.advanceGames(ctx.games);
    return;
  }
  const merged = {};
  if (driver === 'mage') {
    for (const actor of ctx.state.actors) if (actor.mageAI && !isDown(actor)) merged[actor.id] = k.mageInput(ctx.state, actor);
  } else if (driver === 'enemies') {
    Object.assign(merged, k.enemyInputs(ctx.state));
  }
  for (const [id, input] of held) merged[id] = input;
  k.stepArena(ctx.state, merged);
  if (driver === 'enemies') k.queueDeathEffects(ctx.state);
}

function applyOp(k, ctx, op, tick) {
  if (op.op === 'advanceGames') {
    if (!ctx.games || ctx.games.phase !== 'intermission') throw new Mismatch(tick, 'post-ops', 'op.advanceGames', 'not an intermission');
    k.advanceGames(ctx.games);
    return;
  }
  if (op.op === 'clearWave') {
    if (!ctx.games) throw new Mismatch(tick, 'post-ops', 'op.clearWave', 'no games state');
    for (const actor of ctx.games.state.actors) {
      if (actor.id === ctx.games.player.id) continue;
      // PC adapter (see isDown): mark defeat in this kernel's own form, without events, as the C++ op does.
      if (Array.isArray(actor.tags) && !('down' in actor)) actor.tags = ['DEFEATED'];
      else actor.down = true;
      actor.hp = 0;
      if (actor.enemy) actor.enemy.deathQueued = true;
    }
    ctx.games.state.projectiles = [];
    ctx.games.state.telegraphs = [];
    return;
  }
  const actor = ctx.state.actors.find((a) => a.id === op.actorId);
  if (!actor) throw new Mismatch(tick, 'post-ops', 'op', `missing actor ${op.actorId}`);
  if (op.op === 'resetWave') k.resetWave(ctx.state, actor);
  else if (op.op === 'setHp') actor.hp = op.hp;
  else if (op.op === 'setMana') actor.mana = op.mana;
  else if (op.op === 'setClockAdvanceTicks') actor.clockAdvanceTicks = op.ticks;
  else throw new Mismatch(tick, 'post-ops', 'op', `${op.op} is unknown`);
}

/** The replay context of one vector. A games vector is a harness bout, unpaced: the pinned kernel had no pace. */
export function createContext(k, v) {
  if (v.driver === 'training') {
    const training = k.createTraining(v.trainingKind, v.seed);
    return { training, get state() { return training.state; } };
  }
  if (v.driver === 'games') {
    const g = v.games;
    if (g.preset != null && !k.presets.some((p) => p.name === g.preset)) throw new Mismatch(0, 'setup', 'games.preset', `unknown preset ${g.preset}`);
    const games = createBout(k, { seed: v.seed, preset: g.preset, startWave: g.startWave, referencePlayer: g.referencePlayer, difficulty: null });
    if (g.playerHp !== undefined) games.player.hp = g.playerHp;
    if (g.playerMana !== undefined) games.player.mana = g.playerMana;
    return { games, get state() { return games.state; } };
  }
  const state = k.createArena(v.seed);
  if (v.replaySetup) applySetup(k, state, v.setup);
  if (v.driver === 'mage') {
    if (!Array.isArray(v.mageAttachments)) throw new Mismatch(0, 'setup', 'mageAttachments', 'missing');
    for (const at of v.mageAttachments) {
      const actor = state.actors.find((a) => a.id === at.actorId);
      if (!actor) throw new Mismatch(0, 'setup', 'mageAttachments', `missing actor ${at.actorId}`);
      k.attachMageAI(actor, at.competence, state.tick);
    }
  }
  return { state };
}

/** Names both whole events when one event field differs (`events[i].tick` alone hides an inserted event). */
function eventDetail(diff, expected, actualEvents) {
  const at = /^events\[(\d+)\]/.exec(diff.path);
  if (!at) return diff.detail;
  const i = Number(at[1]);
  const pc = actualEvents[i] ? exportEvents([actualEvents[i]])[0] : undefined;
  return `${diff.detail}; vector ${show(expected[i])} PC ${show(pc)}`;
}

/**
 * Replays one VR conformance vector. Returns { name, pass, diff, record, checkpoints }: `record` is the first mismatch as
 * the harness Diff, `diff` its { tick, when, field, detail } view.
 */
export function replayConformance(k, v) {
  const result = { name: v.name, pass: false, diff: null, record: null, checkpoints: v.checkpoints?.length ?? 0 };
  let tick = 0, when = 'setup';
  try {
    const tol = v.tolerance ?? TOLERANCE;
    if (!(tol.relative <= 1e-6) || !(tol.absolute <= 1e-9)) throw new Mismatch(0, 'setup', 'tolerance', 'looser than 1e-6 / 1e-9');
    const ctx = createContext(k, v);
    const vectorEvents = v.events;
    let cursor = 0;
    const consume = (atTick, atWhen) => {
      if (cursor >= v.checkpoints.length) return;
      const row = v.checkpoints[cursor];
      if (row.tick > atTick) return;
      if (row.tick !== atTick || row.when !== atWhen) throw new Mismatch(atTick, atWhen, 'checkpoint', `next vector row is tick ${row.tick} ${row.when}`);
      const state = ctx.state;
      let actual;
      try {
        actual = snapshot(state);
      } catch (err) {
        throw new Mismatch(atTick, atWhen, 'export', `PC state has no field the vector reads: ${err.message}`);
      }
      if (ctx.games) actual.games = exportGames(ctx.games);
      // The event prefix is read before the row (the C++ reads eventCount first): the same verdict, but a diff names
      // the first event that differs instead of only the count.
      const prefix = firstDiff(vectorEvents.slice(0, row.eventCount), exportEvents(state.events.slice(0, row.eventCount)), 'events', tol);
      if (prefix) throw new Mismatch(atTick, atWhen, prefix.path, eventDetail(prefix, vectorEvents, state.events), prefix);
      const expectedRow = { ...row };
      delete expectedRow.when;
      const d = firstDiff(expectedRow, actual, '', tol);
      if (d && d.path === 'eventCount' && state.events.length > row.eventCount) {
        throw new Mismatch(atTick, atWhen, d.path, `${d.detail}; first extra PC event ${show(exportEvents([state.events[row.eventCount]])[0])}`, d);
      }
      if (d) throw new Mismatch(atTick, atWhen, d.path, d.detail, d);
      cursor++;
    };
    consume(0, 'pre-ops');
    const held = new Map();
    for (tick = 1; tick <= v.ticks; tick++) {
      for (const frame of v.frames) {
        if (frame.tick !== tick) continue;
        for (const [key, input] of Object.entries(frame.inputs)) held.set(Number(key), input);
      }
      when = 'step';
      drive(k, v.driver, ctx, held, !!v.games?.autoAdvance);
      consume(tick, 'pre-ops');
      const ops = v.ops.filter((op) => op.afterTick === tick);
      when = 'post-ops';
      for (const op of ops) applyOp(k, ctx, op, tick);
      if (ops.length) consume(tick, 'post-ops');
    }
    tick = v.ticks;
    if (cursor !== v.checkpoints.length) throw new Mismatch(tick, 'end', 'checkpoints', `unconsumed: ${cursor} of ${v.checkpoints.length}`);
    const events = firstDiff(vectorEvents, exportEvents(ctx.state.events), 'events', tol);
    if (events) throw new Mismatch(tick, 'events', events.path, eventDetail(events, vectorEvents, ctx.state.events), events);
    result.pass = true;
  } catch (err) {
    const m = err instanceof Mismatch ? err : new Mismatch(tick, when, 'kernel', err?.message ?? String(err));
    result.diff = m.diff;
    result.record = m.record;
  }
  return result;
}

/** All vectors in a VR checkout, sorted by file name (as the C++ GetTests lists them). */
export function readConformanceVectors(vrRoot) {
  const dir = join(vrRoot, 'apps', 'vr', 'data', 'conformance');
  return readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
}
