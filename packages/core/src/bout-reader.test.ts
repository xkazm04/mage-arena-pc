import { beforeAll, describe, expect, it } from 'vitest';
import { applyBoutInput, boutHash, replayBout, startBout, type BoutInput, type SeasonBout } from './season.ts';
import { boutCheckpoint, boutWaves, positionOfTick, readBout, replayBoutTo, seekBout, takeOverBout, tickOfPosition, type BoutCheckpoint } from './bout-reader.ts';
import { attachMageAI, createLedger, mageInput, observeLedger, presets, resetLedger, stateHash, stepGames, type Games, type InputFrame, type LedgerEntry, type MageBrain } from './arena/index.ts';

/** A scripted player outside the state, as the season fixtures use: its brain and RNG never enter the bout. */
function policy() {
  let brain: MageBrain | undefined, rng = 71, wave = -1;
  return (g: Games): InputFrame => {
    const actor = { ...g.player, mageAI: brain };
    if (!brain || wave !== g.wave) { attachMageAI(actor, 3, g.state.tick); wave = g.wave; }
    const observation = { ...g.state, actors: g.state.actors.map(a => a.id === actor.id ? actor : a), rng, randomLog: [] };
    const input = mageInput(observation, actor); brain = actor.mageAI; rng = observation.rng;
    return input;
  };
}
/** Fight a season bout the way ArenaGame does: apply each entry locally, observe the ledger, reset it on advance, tape each wave start. */
function fight(seed: number) {
  const bout: SeasonBout = { id: `games:${seed}`, day: 7, seed, phase: 'prepared', spectator: false, composition: structuredClone(presets[2]!), games: null, log: [], difficulty: 'normal',
    entrant: { id: 'p', name: 'Cassia', school: 'water', ranks: { vigor: 3, focus: 3, nerve: 3 }, mastery: 2, hpPenalty: 0, staminaPenalty: 0 } };
  startBout(bout);
  const frame = policy(), ledger = createLedger(bout.games!.state, bout.games!.player.id), tape: BoutCheckpoint[] = [boutCheckpoint(bout)], hashes = new Map<number, string>();
  let waveEntries: LedgerEntry[] = [];
  while (bout.phase !== 'terminal') {
    const g = bout.games!, entry: BoutInput = g.phase === 'intermission' ? { type: 'advance', tick: g.state.tick } : { type: 'tick', tick: g.state.tick, input: frame(g) };
    applyBoutInput(bout, entry); observeLedger(ledger, g.state);
    if (entry.type === 'advance') { resetLedger(ledger); tape.push(boutCheckpoint(bout)); }
    if (bout.log.length % 1499 === 0) hashes.set(bout.log.length, stateHash(g.state));
    waveEntries = ledger.entries;
  }
  return { bout, tape, hashes, live: structuredClone(waveEntries) };
}

describe('reading a fought season bout', () => {
  let fought: ReturnType<typeof fight>;
  // Seed 12: at pace seed 11's read wave runs 1640 positions, under the 1800 this reading needs.
  beforeAll(() => { fought = fight(12); });

  it('stops a replay at any tick of the read wave with the hash a fresh replay and the live bout had there', () => {
    const { bout, tape, hashes } = fought, r = readBout(bout, 180, tape), untaped = readBout(bout, 240), w = r.wave;
    expect(boutWaves(bout).length).toBe(bout.games!.wave + 1);
    expect(w.last - w.first).toBeGreaterThan(1800);
    const positions = [w.first, w.first + 1, w.first + 179, w.first + 180, w.first + 181, Math.floor((w.first + w.last) / 2), w.last - 1, w.last, ...w.entries.slice(0, 4).map(e => positionOfTick(w, e.tick))];
    for (const p of positions) {
      const seek = seekBout(r, p), fresh = replayBoutTo(bout, p), withoutTape = seekBout(untaped, p);
      expect(seek.games!.state.tick).toBe(tickOfPosition(w, p));
      expect(stateHash(seek.games!.state)).toBe(stateHash(fresh.games!.state));
      expect(stateHash(withoutTape.games!.state)).toBe(stateHash(fresh.games!.state));
      expect(boutHash(seek)).toBe(boutHash(fresh));
    }
    for (const [p, hash] of hashes) expect(stateHash(replayBoutTo(bout, p, tape.filter(c => c.position <= p).at(-1)).games!.state)).toBe(hash);
    expect(boutHash(seekBout(r, w.last))).toBe(boutHash(bout));
  });

  it('hands a practice clone the replayed state, and one new input diverges it', () => {
    const { bout, tape } = fought, r = readBout(bout, 180, tape), entry = r.wave.entries.find(e => e.family === 'magic') ?? r.wave.entries[0]!;
    const p = positionOfTick(r.wave, entry.tick), at = seekBout(r, p), practice = takeOverBout(at);
    expect(stateHash(practice.state)).toBe(stateHash(at.games!.state));
    expect(practice.player).toBe(practice.state.actors.find(a => a.id === at.games!.player.id));
    const logged = bout.log[p]!;
    if (logged.type !== 'tick') throw Error('expected a tick entry');
    const same = takeOverBout(at); stepGames(same, logged.input);
    applyBoutInput(at, logged);
    expect(stateHash(same.state)).toBe(stateHash(at.games!.state));
    stepGames(practice, { ...logged.input, move: { x: -logged.input.move.x || 1, y: -logged.input.move.y }, absorb: !logged.input.absorb });
    expect(stateHash(practice.state)).not.toBe(stateHash(at.games!.state));
  });

  it('leaves the source bout, its log and its settlement hash untouched', () => {
    const { bout, tape } = fought, before = { hash: boutHash(bout), log: JSON.stringify(bout.log), state: stateHash(bout.games!.state) };
    const r = readBout(bout, 180, tape);
    for (const e of r.wave.entries) stepGames(takeOverBout(seekBout(r, positionOfTick(r.wave, e.tick))), { move: { x: 1, y: 0 }, aim: { x: 0, y: 0 }, cast: true, absorb: false, roll: false, sprint: false, slot: 1 });
    expect(boutHash(bout)).toBe(before.hash);
    expect(JSON.stringify(bout.log)).toBe(before.log);
    expect(stateHash(bout.games!.state)).toBe(before.state);
    expect(boutHash(replayBout(bout))).toBe(before.hash);
  });

  it('grades every timeline entry exactly as the live ledger did, and a seek lands on its tick', () => {
    const { bout, tape, live } = fought, r = readBout(bout, 180, tape);
    expect(live.length).toBeGreaterThan(3);
    expect(r.wave.entries).toEqual(live);
    expect(readBout(bout, 180).wave.entries).toEqual(live);
    for (const e of r.wave.entries.filter(e => e.answer !== 'avoided')) {
      const at = seekBout(r, positionOfTick(r.wave, e.tick)).games!;
      expect(at.state.tick).toBe(e.tick);
      expect(at.state.events.some(x => x.kind === 'hit' && x.tick === e.tick && x.activationId === e.activationId) || e.answer === 'unclassified' || e.answer === 'rolled' || e.answer === 'encased').toBe(true);
    }
  });
});
