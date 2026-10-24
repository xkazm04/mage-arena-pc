// One contact verdict (arena-kernel challenge 2026-10-25): resolveHit decides shield, ward, exchange window and perfect once in
// contact.ts, a verdict channel hands that decision to observers, and the ledger grades from it instead of re-deriving it.
// kernel.ts is imported first: air.ts sits in the kernel -> schools -> air import cycle.
import { describe, expect, it } from 'vitest';
import { addMage, createArena, resolveHit, runtime, stateHash, stepArena, tapVerdicts, ticks } from './kernel.ts';
import { contactVerdict, type ContactOutcome, type ContactVerdict } from './contact.ts';
import { exchangeRule } from './exchange.ts';
import { addEnemy } from './enemies.ts';
import { createGames, stepGames } from './games.ts';
import { createLedger, observeLedger } from './ledger.ts';
import { newSchoolState, schoolPresets } from './schools.ts';
import { presets } from './catalog.ts';
import { createTraining, stepTraining, timingBot } from './training.ts';
import { rivalBuilds } from './archetypes.ts';
import type { AirSchoolState } from './air.ts';
import type { Actor, ArenaState, Hit } from './types.ts';

const reference = presets.find(p => p.name === runtime.games.referencePreset)!;
const blow = (state: ArenaState, owner: Actor, extra: Partial<Hit> = {}): Hit =>
  ({ ownerId: owner.id, activationId: state.nextId++, damage: 10, family: 'magic', tier: 1, source: { ...owner.pos }, delivery: 'projectile', ...extra });
/** Two mages 3 m apart, the target facing the owner. */
function duel(seed = 1) {
  const state = createArena(seed), owner = addMage(state, 0, { x: 13, y: 10 }, 'Owner'), target = addMage(state, 1, { x: 16, y: 10 }, 'Target');
  target.facing = { x: -1, y: 0 }; target.maxHp = target.hp = 1000;
  return { state, owner, target };
}
const hear = (state: ArenaState) => {
  const heard: { targetId: number; outcome: ContactOutcome; verdict?: ContactVerdict }[] = [];
  tapVerdicts(state, (_s, target, _hit, outcome, verdict) => heard.push({ targetId: target.id, outcome, ...(verdict ? { verdict } : {}) }));
  return heard;
};

describe('contactVerdict', () => {
  it('an exchange window guards a blow the ward did not: guard window, the rule reduction, never perfect; the ledger says window', () => {
    const { state, owner, target } = duel();
    target.exchange = { fromId: owner.id, guardUntil: state.tick + ticks(2), guardsLeft: 2 };
    const hit = blow(state, owner), verdict = contactVerdict(state, target, owner, hit);
    expect(verdict).toMatchObject({ guard: 'window', reduction: exchangeRule.guardReduction, perfect: false, warded: false });
    const ledger = createLedger(state, target.id);
    resolveHit(state, target, hit); observeLedger(ledger, state);
    expect(ledger.entries.map(e => e.answer)).toEqual(['window']);
    expect(ledger.entries[0]!.guarded).toBe(true);
  });

  it('an Air Form evade reports evaded with no hit event, the ledger says evaded, and the channel draws nothing', () => {
    const run = (attach: boolean) => {
      const { state, owner, target } = duel(23);
      target.schoolState = newSchoolState(schoolPresets.air[0]!); (target.schoolState as AirSchoolState).formUntil = 1e6;
      const heard = attach ? hear(state) : [], ledger = attach ? createLedger(state, target.id) : undefined;
      for (let i = 0; i < 40; i++) { resolveHit(state, target, blow(state, owner)); if (ledger) observeLedger(ledger, state); stepArena(state, {}); }
      return { state, heard, ledger };
    };
    const { state, heard, ledger } = run(true), bare = run(false);
    const evaded = heard.filter(h => h.outcome === 'evaded');
    expect(evaded.length).toBeGreaterThan(0); expect(evaded.every(h => h.verdict === undefined)).toBe(true);
    expect(state.events.filter(e => e.kind === 'hit')).toHaveLength(heard.filter(h => h.outcome === 'resolved').length);
    expect(ledger!.counts.magic.evaded).toBe(evaded.length); expect(ledger!.counts.magic.unclassified).toBe(0);
    expect(state.randomLog.length).toBe(bare.state.randomLog.length); expect(stateHash(state)).toBe(stateHash(bare.state));
  });

  it('a fresh ward against a Brand Wrath tick after its first (suppressPerfect) is not perfect; the ledger says held, not late', () => {
    const { state, owner, target } = duel();
    target.absorb = true; target.absorbFreshTick = state.tick;
    const hit = blow(state, owner, { suppressPerfect: true }), verdict = contactVerdict(state, target, owner, hit);
    expect(verdict).toMatchObject({ guard: 'ward', warded: true, perfect: false, ageTicks: 0 });
    const ledger = createLedger(state, target.id);
    resolveHit(state, target, hit); observeLedger(ledger, state);
    expect(ledger.entries).toHaveLength(1);
    expect(ledger.entries[0]).toMatchObject({ answer: 'held', ageTicks: 0, guarded: true });
    expect(ledger.entries[0]!.mistake).toBeUndefined(); expect(ledger.entries[0]!.lateTicks).toBeUndefined();
  });

  it("a front shield: shielded, and the verdict damage is the hit event's contactDamage", () => {
    const state = createArena(), shield = addEnemy(state, 'shieldman', { x: 10, y: 10 }), owner = addMage(state, 0, { x: 12, y: 10 });
    shield.facing = { x: 1, y: 0 };
    const heard = hear(state), hit = blow(state, owner, { bolt: true });
    expect(contactVerdict(state, shield, owner, hit).shielded).toBe(true);
    resolveHit(state, shield, hit);
    expect(heard).toHaveLength(1); expect(heard[0]!.verdict!.shielded).toBe(true);
    expect(heard[0]!.verdict!.damage).toBe(state.events.at(-1)!.contactDamage);
  });

  it('agrees with every hit the kernel resolves: games40000, soldiers40000, a fire_close fight and a timed magic lesson', () => {
    const games = [createGames(40000, reference, 2, true), createGames(40000, reference, 0, true),
      createGames(1, reference, rivalBuilds.fire_close!.wave, true, undefined, undefined, undefined, { rivalBuild: 'fire_close' })];
    const lesson = createTraining('magic');
    const runs: { state: ArenaState; step: () => boolean }[] = [...games.map(g => ({ state: g.state, step: () => { stepGames(g); return g.phase === 'active'; } })),
      { state: lesson.state, step: () => { stepTraining(lesson, timingBot(lesson, 'perfect')); return true; } }];
    let checked = 0, windows = 0, perfects = 0;
    for (const { state, step } of runs) {
      const pending: { target: Actor; hit: Hit; at: number; verdict: ContactVerdict }[] = [];
      tapVerdicts(state, (s, target, hit, outcome, verdict) => { if (outcome === 'resolved') pending.push({ target, hit, at: s.events.length, verdict: verdict! }); });
      for (let i = 0, live = true; i < ticks(runtime.games.fightTimeoutS) && live; i++) {
        pending.length = 0; live = step();
        for (const { target, hit, at, verdict } of pending) {
          const events = state.events, h = events.findIndex((e, j) => j >= at && e.kind === 'hit' && e.actorId === target.id && e.activationId === hit.activationId);
          expect(h).toBeGreaterThanOrEqual(0);
          const perfect = events.slice(at, h).some(e => e.kind === 'perfect' && e.actorId === target.id);
          expect(verdict.damage).toBe(events[h]!.contactDamage);
          expect(verdict.perfect).toBe(perfect);
          expect(verdict.guard !== undefined && verdict.reduction > 0).toBe(events[h]!.guarded);
          checked++; if (verdict.guard === 'window') windows++; if (perfect) perfects++;
        }
      }
    }
    expect(checked).toBeGreaterThan(100); expect(windows).toBeGreaterThan(0); expect(perfects).toBeGreaterThan(0);
  });
});
