import { beforeAll, describe, expect, it } from "vitest";
import { applyBoutInput, boutCheckpoint, boutHash, positionOfTick, replayBoutTo, startBout, takeOverBout, type BoutCheckpoint, type BoutInput, type SeasonBout } from "@mage/core";
import { attachMageAI, createLedger, mageInput, observeLedger, presets, resetLedger, stateHash, stepGames, type Games, type InputFrame, type LedgerEntry, type MageBrain } from "@mage/core/arena";
import { BoutReader } from "./bout-reader-ui.ts";
import { answerMark } from "./answers.ts";

/** ArenaGame's season loop without the canvas: step the client's bout, observe its ledger, reset on advance, tape wave starts. */
function fight(seed: number) {
  const bout: SeasonBout = { id: `games:${seed}`, day: 7, seed, phase: "prepared", spectator: false, composition: structuredClone(presets[2]!), games: null, log: [],
    entrant: { id: "p", name: "Cassia", school: "water", ranks: { vigor: 3, focus: 3, nerve: 3 }, mastery: 2, hpPenalty: 0, staminaPenalty: 0 } };
  startBout(bout);
  let brain: MageBrain | undefined, rng = 71, wave = -1;
  const frame = (g: Games): InputFrame => {
    const actor = { ...g.player, mageAI: brain };
    if (!brain || wave !== g.wave) { attachMageAI(actor, 3, g.state.tick); wave = g.wave; }
    const observation = { ...g.state, actors: g.state.actors.map((a) => (a.id === actor.id ? actor : a)), rng, randomLog: [] };
    const input = mageInput(observation, actor); brain = actor.mageAI; rng = observation.rng;
    return input;
  };
  const ledger = createLedger(bout.games!.state, bout.games!.player.id), tape: BoutCheckpoint[] = [boutCheckpoint(bout)], flushed: BoutInput[] = [];
  let live: LedgerEntry[] = [];
  while (bout.phase !== "terminal") {
    const g = bout.games!, entry: BoutInput = g.phase === "intermission" ? { type: "advance", tick: g.state.tick } : { type: "tick", tick: g.state.tick, input: frame(g) };
    applyBoutInput(bout, entry); observeLedger(ledger, g.state); flushed.push(entry);
    if (entry.type === "advance") { resetLedger(ledger); tape.push(boutCheckpoint(bout)); }
    live = structuredClone(ledger.entries);
  }
  return { bout, tape, live, flushed };
}

describe("Read the bout", () => {
  let f: ReturnType<typeof fight>;
  beforeAll(() => { f = fight(12); });

  it("reads from the client's own log, which is exactly what it flushed", () => {
    expect(f.bout.log).toEqual(f.flushed);
  });

  it("shows each timeline entry with the grade the live ledger captured", () => {
    const r = new BoutReader(f.bout, f.tape);
    expect(r.wave.entries.length).toBe(f.live.length);
    expect(f.live.some((e) => answerMark(e).miss)).toBe(true);
    for (const live of f.live) {
      r.seek(positionOfTick(r.wave, live.tick));
      expect(r.tick).toBe(live.tick);
      const shown = r.here.find((e) => e.activationId === live.activationId && e.answer === live.answer)!;
      expect(shown).toEqual(live);
      expect(answerMark(shown)).toEqual(answerMark(live));
      if (live.answer === "held") expect(answerMark(shown).label).toBe(`HELD +${live.lateTicks}f`);
    }
  });

  it("steps, plays and scrubs to the hash a fresh replay has, and takes over without touching the bout", () => {
    const before = { hash: boutHash(f.bout), log: JSON.stringify(f.bout.log) };
    const r = new BoutReader(f.bout, f.tape), start = r.position;
    r.step(1); r.step(1); r.step(-1);
    expect(stateHash(r.at.games!.state)).toBe(stateHash(replayBoutTo(f.bout, start + 1).games!.state));
    r.playing = true; r.frame(30 / 60 + 1e-6);
    expect(r.position).toBe(start + 31);
    expect(stateHash(r.frame(0).state)).toBe(stateHash(replayBoutTo(f.bout, start + 31).games!.state));
    r.seek(r.wave.last);
    expect(r.canTakeOver).toBe(false);
    r.seek(Math.floor((r.wave.first + r.wave.last) / 2));
    const practice = takeOverBout(r.at);
    expect(stateHash(practice.state)).toBe(stateHash(r.at.games!.state));
    stepGames(practice, { move: { x: 1, y: 0 }, aim: { x: 0, y: 0 }, cast: true, absorb: false, roll: false, sprint: false, slot: 1 });
    expect(boutHash(f.bout)).toBe(before.hash);
    expect(JSON.stringify(f.bout.log)).toBe(before.log);
  });
});
