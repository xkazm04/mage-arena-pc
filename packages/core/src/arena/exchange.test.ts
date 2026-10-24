// Exchange windows (D1 4.1 option A, exchange.ts): a clean close hit opens the defender's window, whose ward takes the
// attacker's next close blows; Water-only states and canonical (parity) states never carry it.
// kernel.ts is imported first: fire.ts and air.ts must load through schools.ts (see the fire.ts header).
import { describe, expect, it } from 'vitest';
import { addMage, createArena, resolveHit, resetWave, stateHash, ticks } from './kernel.ts';
import { newSchoolState, schoolPresets } from './schools.ts';
import { exchangeOff, exchangeProblems, exchangeRule, type ExchangeRule } from './exchange.ts';
import balance from './data/school-balance.pc.json' with { type: 'json' };
import type { Actor, ArenaState, Hit } from './types.ts';

const rule = exchangeRule as ExchangeRule;
function duel(options: { fire?: boolean; balance?: 'canonical'; distanceM?: number } = {}): { state: ArenaState; attacker: Actor; defender: Actor } {
  const state = createArena(5);
  if (options.balance) state.balance = options.balance;
  const attacker = addMage(state, 0, { x: 20, y: 20 }, 'Attacker'), defender = addMage(state, 1, { x: 20 + (options.distanceM ?? 3), y: 20 }, 'Defender');
  for (const a of [attacker, defender]) a.maxHp = a.hp = 1000;
  if (options.fire ?? true) attacker.schoolState = newSchoolState(schoolPresets.fire[0]!);
  return { state, attacker, defender };
}
const blow = (state: ArenaState, from: Actor, to: Actor, damage = 10, family: Hit['family'] = 'magic') => {
  resolveHit(state, to, { ownerId: from.id, activationId: state.nextId++, damage, family, tier: 1, source: { ...from.pos } });
  return state.events.findLast(e => e.kind === 'hit')!;
};

describe('exchange windows (D1 4.1 A)', () => {
  it('reads its numbers from the PC overlay and refuses a malformed block', () => {
    expect(exchangeRule).toEqual(balance.exchange);
    expect(exchangeProblems(undefined)).toEqual([]);
    expect(exchangeProblems(balance.exchange)).toEqual([]);
    expect(exchangeProblems({ ...balance.exchange, extra: 1 })).toEqual(['school-balance.pc.json exchange: unknown key extra']);
    expect(exchangeProblems({ closeRangeM: 5 })).toEqual(expect.arrayContaining(['school-balance.pc.json exchange: missing guardS', 'school-balance.pc.json exchange: missing guardHits', 'school-balance.pc.json exchange: missing guardReduction']));
    expect(exchangeProblems({ ...balance.exchange, guardHits: 1.5 })).toHaveLength(1);
    expect(exchangeProblems({ ...balance.exchange, guardReduction: 2 })).toHaveLength(1);
    expect(exchangeProblems({ ...balance.exchange, closeRangeM: 0 })).toHaveLength(1);
  });

  it('a clean close hit opens the window: the attacker\'s next close blows land guarded, guardReduction of each stopped', () => {
    const { state, attacker, defender } = duel();
    const first = blow(state, attacker, defender);
    expect(first.guarded).toBe(false); expect(first.contactDamage).toBe(10);
    expect(defender.exchange).toEqual({ fromId: attacker.id, guardUntil: state.tick + ticks(rule.guardS), guardsLeft: rule.guardHits });
    const second = blow(state, attacker, defender);
    expect(second.guarded).toBe(true); expect(second.contactDamage).toBeCloseTo(10 * (1 - rule.guardReduction), 9);
    expect(defender.exchange!.guardsLeft).toBe(rule.guardHits - 1);
    // The window's guard is not a fresh ward: no perfect, and no event kind beyond the hit itself.
    expect(state.events.filter(e => e.kind !== 'hit' && e.kind !== 'stagger')).toEqual([]);
  });

  it('the window spends its blows, ends after guardS, guards only against its attacker, only close blows, never unblockable', () => {
    const spent = duel();
    blow(spent.state, spent.attacker, spent.defender);
    for (let i = 0; i < rule.guardHits; i++) expect(blow(spent.state, spent.attacker, spent.defender).guarded).toBe(true);
    expect(blow(spent.state, spent.attacker, spent.defender).guarded, 'spent: the next blow is clean and opens a new window').toBe(false);
    expect(spent.defender.exchange!.guardsLeft).toBe(rule.guardHits);

    const late = duel();
    blow(late.state, late.attacker, late.defender); late.state.tick += ticks(rule.guardS);
    expect(blow(late.state, late.attacker, late.defender).guarded).toBe(false);

    const far = duel();
    blow(far.state, far.attacker, far.defender); far.attacker.pos.x -= rule.closeRangeM;
    expect(blow(far.state, far.attacker, far.defender).guarded, 'a blow from beyond close range').toBe(false);

    const unblockable = duel();
    blow(unblockable.state, unblockable.attacker, unblockable.defender);
    expect(blow(unblockable.state, unblockable.attacker, unblockable.defender, 10, 'unblockable').contactDamage).toBe(10);

    const other = duel(), third = addMage(other.state, 0, { x: 21, y: 20 }, 'Third');
    blow(other.state, other.attacker, other.defender);
    expect(blow(other.state, third, other.defender).guarded, 'another attacker').toBe(false);
  });

  it('no window from a hit beyond close range, and a wave reset clears the window', () => {
    const { state, attacker, defender } = duel({ distanceM: rule.closeRangeM + 0.5 });
    blow(state, attacker, defender);
    expect(defender.exchange).toBeUndefined();
    const near = duel();
    blow(near.state, near.attacker, near.defender); expect(near.defender.exchange).toBeDefined();
    resetWave(near.state, near.defender); expect(near.defender.exchange).toBeUndefined();
  });

  it('neutral where it must be: Water-only, canonical (parity) and rule-off states never carry a window and hash alike', () => {
    const run = (options: Parameters<typeof duel>[0], off = false) => {
      const body = () => { const d = duel(options); for (let i = 0; i < 4; i++) blow(d.state, d.attacker, d.defender); return d; };
      const d = off ? exchangeOff(body) : body();
      expect(d.defender.exchange).toBeUndefined();
      return { hash: stateHash(d.state), contacts: d.state.events.filter(e => e.kind === 'hit').map(e => e.contactDamage) };
    };
    const water = run({ fire: false });
    expect(water.contacts).toEqual([10, 10, 10, 10]);
    const canonical = run({ balance: 'canonical' }), off = run({}, true);
    expect(canonical.contacts).toEqual([10, 10, 10, 10]);
    expect(off.contacts).toEqual([10, 10, 10, 10]);
    expect(exchangeRule).toEqual(balance.exchange);
  });
});
