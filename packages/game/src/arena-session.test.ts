import { describe, expect, it } from "vitest";
import { boutHash, startBout, type SeasonBout } from "@mage/core";
import {
  attachMageAI,
  createGames,
  createLedger,
  createTraining,
  defaultDifficulty,
  defaultLabConfig,
  enemyInputs,
  enemyRoster,
  observeLedger,
  presets,
  queueDeathEffects,
  resolveHit,
  runtime,
  stateHash,
  stepArena,
  stepGames,
  type InputFrame,
} from "@mage/core/arena";
import {
  advance,
  canStep,
  endPractice,
  enterLab,
  enterRoster,
  enterTiro,
  enterTraining,
  SeasonSession,
  takeOver,
  type ArenaSession,
  type PresentationReset,
  type StepGate,
} from "./arena-session.ts";
import { BoutReader } from "./bout-reader-ui.ts";
import { createLabSetup } from "./lab-setup.ts";

const input: InputFrame = {
  move: { x: 1, y: 0.5 },
  aim: { x: 30, y: 20 },
  cast: true,
  absorb: false,
  roll: false,
  sprint: false,
  slot: 1,
};
const training = () => createTraining("magic", undefined, defaultDifficulty);
function seasonBout(seed: number): SeasonBout {
  const bout: SeasonBout = {
    id: `games:${seed}`,
    day: 7,
    seed,
    phase: "prepared",
    spectator: false,
    composition: structuredClone(presets[2]!),
    games: null,
    log: [],
    difficulty: "normal",
    entrant: {
      id: "p",
      name: "Cassia",
      school: "water",
      ranks: { vigor: 3, focus: 3, nerve: 3 },
      mastery: 2,
      hpPenalty: 0,
      staminaPenalty: 0,
    },
  };
  startBout(bout);
  return bout;
}
/** A season bout stepped 300 ticks of a fixed input: the live wave a reader takes over from. */
function liveSeason() {
  const live = new SeasonSession(seasonBout(5), training());
  for (let i = 0; i < 300 && live.games.phase === "active"; i++)
    live.step(input);
  const reader = new BoutReader(live.bout, live.tape);
  reader.seek(Math.floor((reader.wave.first + reader.wave.last) / 2));
  return { live, reader };
}
/** A local Tiro run whose reference player clears the first wave. */
function clearedTiro() {
  const e = enterTiro(training(), 4, presets[0]!, defaultDifficulty);
  e.session.reference = true;
  attachMageAI(
    e.session.games.player,
    runtime.games.referenceCompetence,
    e.session.games.state.tick,
  );
  for (let i = 0; i < 60 * 180 && e.session.games.phase === "active"; i++)
    e.session.step(input);
  return e.session;
}

describe("ArenaSession drivers", () => {
  it("case 2: a local Tiro session steps exactly as stepGames + observeLedger on a twin", () => {
    const { session } = enterTiro(training(), 4, presets[0]!, defaultDifficulty);
    const twin = createGames(4, presets[0]!, 0, false, undefined, undefined, defaultDifficulty);
    expect(stateHash(session.state)).toBe(stateHash(twin.state));
    const direct = createLedger(twin.state, twin.player.id);
    for (let i = 0; i < 600; i++) {
      session.step(input);
      stepGames(twin, input);
      observeLedger(direct, twin.state);
    }
    expect(stateHash(session.state)).toBe(stateHash(twin.state));
    expect(session.ledger!.entries.length).toBeGreaterThan(0);
    expect(session.ledger!.entries).toEqual(direct.entries);
  });

  it("case 7: a roster session steps exactly as stepArena(enemyInputs + player) + queueDeathEffects on a twin", () => {
    const id = enemyRoster[0]!.id;
    const { session } = enterRoster(training(), id);
    const twin = enterRoster(training(), id).session.training;
    expect(session.state.actors.length).toBeGreaterThan(1);
    for (let i = 0; i < 600; i++) {
      session.step(input);
      stepArena(twin.state, { ...enemyInputs(twin.state), [twin.player.id]: input });
      queueDeathEffects(twin.state);
    }
    expect(stateHash(session.state)).toBe(stateHash(twin.state));
  });

  it("case 3: practice from a reading steps the clone only and hands back the very live session", () => {
    const { live, reader } = liveSeason();
    expect(reader.canTakeOver).toBe(true);
    const before = { hash: boutHash(live.bout), log: JSON.stringify(live.bout.log) };
    const liveGames = live.games,
      liveLedger = live.ledger;
    const p = takeOver(live, reader.at, "intermission")!.session;
    expect(p.games).not.toBe(liveGames);
    expect(p.training.state).toBe(p.games.state);
    for (let i = 0; i < 120; i++) p.step(input);
    expect(p.games.state.tick).toBe(reader.at.games!.state.tick + 120);
    expect(boutHash(live.bout)).toBe(before.hash);
    expect(JSON.stringify(live.bout.log)).toBe(before.log);
    expect(live.queued.length).toBe(300);
    const back = endPractice(p).session;
    expect(back).toBe(live);
    expect(back.games).toBe(liveGames);
    expect(back.ledger).toBe(liveLedger);
    expect(back.training.state).toBe(liveGames.state);
  });

  it("case 4: every transition returns the one presentation reset", () => {
    const shape = (s: ArenaSession, lastPhase = ""): PresentationReset => ({
      eventsFrom: s.training.state.events.length,
      lastPerfect: -1e9,
      impactReset: true,
      lastPhase,
    });
    const restart = enterTraining("magic", presets[0]!, defaultDifficulty);
    expect(restart.reset).toEqual(shape(restart.session));
    const games = enterTiro(training(), 4, presets[0]!, defaultDifficulty);
    expect(games.reset).toEqual(shape(games.session));
    const roster = enterRoster(training(), enemyRoster[0]!.id);
    expect(roster.reset).toEqual(shape(roster.session));
    const lab = enterLab(createLabSetup({ ...defaultLabConfig, difficulty: defaultDifficulty }));
    expect(lab.reset).toEqual(shape(lab.session));
    const cleared = clearedTiro();
    expect(cleared.games.phase).toBe("intermission");
    const next = advance(cleared)!;
    expect(next.session).toBe(cleared);
    expect(cleared.games.phase).toBe("active");
    expect(cleared.ledger!.entries).toEqual([]);
    expect(next.reset).toEqual(shape(cleared));
    expect(advance(restart.session)).toBeUndefined();
    const { live, reader } = liveSeason();
    const over = takeOver(live, reader.at, "intermission")!;
    expect(over.reset).toEqual(shape(over.session));
    over.session.step(input);
    // endPractice resets the perfect flash too, and restores the live phase.
    const ended = endPractice(over.session);
    expect(ended.reset).toEqual(shape(live, "intermission"));
    expect(ended.reset.lastPerfect).toBe(-1e9);
    expect(takeOver(restart.session, reader.at, "")).toBeUndefined();
  });

  it("case 5: the ledger precedence is lab, then the bout, then a drill on the state on screen", () => {
    const lab = enterLab(createLabSetup({ ...defaultLabConfig, difficulty: defaultDifficulty })).session;
    lab.watch();
    expect(lab.wardLedger()).toBe(lab.lab!.ledger);
    const tiro = enterTiro(training(), 4, presets[0]!, defaultDifficulty).session;
    tiro.watch();
    expect(tiro.wardLedger()).toBe(tiro.ledger);
    const { live, reader } = liveSeason();
    live.watch();
    expect(live.wardLedger()).toBe(live.ledger);
    const practice = takeOver(live, reader.at, "")!.session;
    expect(practice.ledger).toBeUndefined();
    expect(practice.wardLedger()).toBeUndefined();
    practice.watch();
    expect(practice.wardLedger()).not.toBe(live.ledger);
    for (const s of [
      enterTraining("magic", presets[0]!, defaultDifficulty).session,
      enterRoster(training(), enemyRoster[0]!.id).session,
    ]) {
      expect(s.wardLedger()).toBeUndefined();
      s.watch();
      const drill = s.wardLedger()!;
      expect(drill.actorId).toBe(s.player.id);
      s.watch();
      expect(s.wardLedger()).toBe(drill);
      const blow = () =>
        resolveHit(s.state, s.player, {
          ownerId: s.training.dummy.id,
          activationId: s.state.nextId++,
          family: "magic",
          tier: 1,
          damage: 5,
          source: s.training.dummy.pos,
        });
      blow();
      expect(drill.raw.length).toBe(1);
      s.exit();
      expect(s.wardLedger()).toBeUndefined();
      blow();
      expect(drill.raw.length).toBe(1);
    }
  });

  it("case 6: the step gate holds on each of its eight terms and steps only when all are clear", () => {
    const clear: StepGate = {
      holdFirstFrame: false,
      paused: false,
      labReplay: false,
      readerUp: false,
      flushPending: false,
      syncError: "",
      defeated: false,
      hidden: false,
    };
    expect(canStep(clear)).toBe(true);
    const terms: Partial<StepGate>[] = [
      { holdFirstFrame: true },
      { paused: true },
      { labReplay: true },
      { readerUp: true },
      { flushPending: true },
      { syncError: "Checkpoint rejected" },
      { defeated: true },
      { hidden: true },
    ];
    expect(terms.length).toBe(Object.keys(clear).length);
    for (const t of terms) expect(canStep({ ...clear, ...t }), JSON.stringify(t)).toBe(false);
  });
});

