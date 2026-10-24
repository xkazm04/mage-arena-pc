import { describe, expect, it } from 'vitest';
import { addEnemy, addMage, arenaGeometry, createArena, enemyInputs, enemyRoster, idleInput, queueDeathEffects, stateHash, stepArena, type Actor, type ArenaState } from './index.ts';

const c = arenaGeometry.centre;
/** A mage that holds absorb and walks a fixed zig-zag, so nets, pulls, lanes and backoff all get exercised. */
const holder = (s: ArenaState, mage: Actor, foe?: Actor) => ({ ...idleInput(foe ? { ...foe.pos } : { ...c }), absorb: true,
  move: { x: Math.floor(s.tick / 90) % 2 ? 1 : -1, y: Math.floor(s.tick / 130) % 2 ? 0.5 : -0.5 } });
function series(s: ArenaState, drive: (s: ArenaState) => Record<number, ReturnType<typeof idleInput>>): string[] {
  const out: string[] = [];
  for (let i = 1; i <= 1200; i++) { stepArena(s, { ...enemyInputs(s), ...drive(s) }); queueDeathEffects(s); if (i % 60 === 0) out.push(stateHash(s)); }
  return out;
}
function duel(id: string): string[] {
  const s = createArena(11), mage = addMage(s, 0, { x: c.x + 5, y: c.y });
  const pack = id === 'cinder_hound' ? 3 : 1;
  const foes = Array.from({ length: pack }, (_, k) => addEnemy(s, id, { x: c.x - 5, y: c.y + (k - 1) * 1.5 }));
  const out = series(s, st => ({ [mage.id]: holder(st, mage, foes[0]) }));
  // The series must cover behaviour, not idling: every duel attacks, or (the moth) drains the held absorb.
  expect(foes.some(f => f.enemy!.attackIndex > 0) || mage.absorbExhausted, id).toBe(true);
  return out;
}
function wave(): string[] {
  const s = createArena(23), a = addMage(s, 0, { x: c.x + 4, y: c.y }), b = addMage(s, 0, { x: c.x + 4, y: c.y + 3 });
  for (const [k, id] of ['cinder_hound', 'cinder_hound', 'cinder_hound', 'mire_maw', 'thornback', 'hush_moth', 'hush_moth', 'netter', 'conscript', 'slinger'].entries())
    addEnemy(s, id, { x: c.x - 6 + (k % 3), y: c.y - 4 + k });
  return series(s, st => ({ [a.id]: holder(st, a), [b.id]: { ...idleInput({ ...c }), move: { x: Math.floor(st.tick / 70) % 2 ? -1 : 1, y: 0 } } }));
}

// Recorded at 2d83a1e/d633490, before enemy behaviour moved to a compiled table. Never re-pin.
const pinned: Record<string, string[]> = {
  conscript: ['e476cdc6', '73527658', '31dc7571', '030ea92d', '59406666', '994e5c12', 'c6ad98f0', 'ad9d9d26', '75f19ec0', '1e15dc34', '50308ce1', 'ab8aa93b', 'bdb047e7', '2ca2c5b8', '65c73b05', '0d51c9b4', 'b443a2bd', '005e76a7', 'd109abb5', '6faa959f'],
  shieldman: ['18043220', 'fe8a6546', 'fbc9ad96', 'db8a8964', '26819c12', '50dd89b4', 'ddca8772', '75a0022e', '908f5670', 'd60b27de', '07007472', '680a9f5e', 'd42c4766', 'bc334825', '3099bc84', '2b173247', '107483ff', 'b6d1d84e', 'b3328445', '41916b92'],
  slinger: ['2a27f477', '23fab185', 'd196ea29', 'b91cea32', 'f9260b60', '750359f0', '9797b70f', '7dea673f', 'd23e8252', 'ae322d9b', '4865e338', '9b20e678', '09e8f77c', 'dfd073da', 'e9a45480', 'f7ed9326', '536d3ddf', '6b469ee0', '10006a7f', '1f6c3cb5'],
  netter: ['c3977146', 'd57f612b', '12f57685', '65e6babb', '532fe8d1', '79f51c07', '9a4709d1', 'cbae261b', '2af2fd6a', '5bf8ffa5', 'e5a07295', 'e826bf4d', '46e69ca7', 'e7fe1f0d', 'c1d7545b', '298bc442', 'bdb6abbd', '265648b6', '94782f05', '33c0666c'],
  cinder_hound: ['84b0b374', '71460688', '8243e341', '671b80c5', 'a73805d4', '007be388', 'cf732dff', '33fa30bc', '71419f33', 'a0dd2005', '1546886e', '28b36d31', 'f2e2c85f', '40471c63', 'e0a7357b', 'e745a538', '41d8938a', 'e6efebea', 'b9ea0420', '67a44180'],
  mire_maw: ['434d33f3', '6e385d5b', 'ce9de69e', '7def5742', '7f0aad1d', 'f25327b3', 'c7e88871', '8929d047', '30b47ef2', 'e99a82a1', 'fb3e9869', 'b2bc7261', 'e6931bad', '584bf937', '9fa82ad8', '9f345d8a', '1dd2dcad', '1b5d06b0', '27f6f770', 'bc80f489'],
  thornback: ['a25eeeb1', '032417f3', 'ed03b622', '85e1f4cb', '2c03974d', 'ea168d4a', '5fe18a46', '2e540f44', '0f188901', '42ff2959', 'a9491db6', 'de230cf7', 'bc89229f', '66828d66', '045fc3c6', '4deff846', 'e89c1b94', '3c86a903', '24760ad0', '60767029'],
  hush_moth: ['e572f8f0', 'fcfd46e6', 'a71109d6', 'bfe23809', 'e7d7461f', '26e95785', '65398cc6', 'bdaae4fd', 'cfc16c3b', 'f4643d5c', '8438f22e', '1b42a693', '5eb41153', 'e809807a', '9f61d9dd', '9ec23b40', '0eec66ff', 'a6058ab2', 'c93e8663', '29a5c0b1'],
  wave: ['298b0be0', 'bbe73b48', '64a25d17', '719f0a79', 'bfc9f810', 'f99ac61f', 'c4d90bdb', '7b609551', 'd40720b5', '226817b3', '92b2fc5d', 'e9ec078f', '01e9e0b2', '9ab54199', '82590d2c', '36c48f9d', 'c153171c', 'dbc16353', '6f3312b9', 'cffdb764'],
};

describe('enemy behaviour characterization (case 1, guard)', () => {
  it('every roster enemy duels an absorbing mage with the pinned state series', () => {
    const got = Object.fromEntries([...enemyRoster.map(e => [e.id, duel(e.id)] as const), ['wave', wave()] as const]);
    expect(got).toEqual(pinned);
  });
});
