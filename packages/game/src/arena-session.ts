import {
  applyBoutInput,
  boutCheckpoint,
  takeOverBout,
  type BoutCheckpoint,
  type BoutInput,
  type SeasonBout,
} from "@mage/core";
import {
  addEnemy,
  advanceGames,
  createGames,
  createLedger,
  createTraining,
  detachLedger,
  enemyInputs,
  enemyRoster,
  newWaterState,
  observeLedger,
  openingPosition,
  queueDeathEffects,
  resetLedger,
  runtime,
  stepArena,
  stepGames,
  stepLab,
  stepTraining,
  timingBot,
  type Actor,
  type ArenaState,
  type BotKind,
  type Composition,
  type Difficulty,
  type Games,
  type InputFrame,
  type ThreatLedger,
  type Training,
  type TrainingKind,
} from "@mage/core/arena";
import type { LabSession } from "./lab-setup.ts";

// The arena's mode machine without the canvas. One driver per mode wraps the exact core calls ArenaGame made in its
// step ladder; every transition returns the one presentation reset ArenaGame applies. Pure of Pixi, so the season
// loop (the path whose log is sent to the server) runs under a unit test.

/** The HUD's mode: practice and the season bout read as Tiro. */
export type ArenaMode = "training" | "roster" | "tiro" | "lab";
export type SessionKind =
  "training" | "roster" | "tiro" | "season" | "practice" | "lab";
/** A frame, or a reader called only on a tick that consumes input (the live input latches its queued presses). */
export type InputSource = InputFrame | (() => InputFrame);

/** What a transition resets on the presentation side: the event cursor, the perfect flash, the impact clock, the phase. */
export interface PresentationReset {
  eventsFrom: number;
  lastPerfect: number;
  impactReset: true;
  lastPhase: string;
}
export interface Entered<S extends ArenaSession = ArenaSession> {
  session: S;
  reset: PresentationReset;
}

/** The per-tick step gate: one predicate over every term that stops the simulation. */
export interface StepGate {
  /** The first frame after the art gate shows the opening tick. */
  holdFirstFrame: boolean;
  paused: boolean;
  /** The Lab is showing a replayed tick. */
  labReplay: boolean;
  /** The bout reader's screen is up. */
  readerUp: boolean;
  /** A season flush is in flight. */
  flushPending: boolean;
  syncError: string;
  /** The live player is DEFEATED. */
  defeated: boolean;
  /** The document is hidden. */
  hidden: boolean;
}
export const canStep = (g: StepGate): boolean =>
  !g.holdFirstFrame &&
  !g.paused &&
  !g.labReplay &&
  !g.readerUp &&
  !g.flushPending &&
  !g.syncError &&
  !g.defeated &&
  !g.hidden;

const read = (input: InputSource): InputFrame =>
  typeof input === "function" ? input() : input;

export abstract class ArenaSession {
  abstract readonly kind: SessionKind;
  abstract readonly mode: ArenaMode;
  games?: Games;
  lab?: LabSession;
  /** The bout's own threat ledger (Tiro and the season); a practice clone has none. */
  ledger?: ThreatLedger;
  /** Training, roster and practice grade the ward words on a drill ledger attached to the state on screen. */
  protected readonly drills: boolean = false;
  protected drill?: { state: ArenaState; ledger: ThreatLedger };
  constructor(readonly training: Training) {}
  get state(): ArenaState {
    return this.training.state;
  }
  get player(): Actor {
    return this.training.player;
  }
  protected abstract tick(input: InputSource): void;
  step(input: InputSource): void {
    this.tick(input);
    if (this.drill?.state === this.training.state)
      observeLedger(this.drill.ledger, this.drill.state);
  }
  /** Attach the drill ledger to the state now on screen (drill modes only). */
  watch(): void {
    const { state, player } = this.training;
    if (!this.drills || this.drill?.state === state) return;
    if (this.drill) detachLedger(this.drill.ledger);
    this.drill = { state, ledger: createLedger(state, player.id) };
  }
  /** The ledger whose grades put words on the player's hits: the Lab's, the bout's, or the drill. */
  wardLedger(): ThreatLedger | undefined {
    return this.lab?.ledger ?? this.ledger ?? this.drill?.ledger;
  }
  phase(): string {
    return (
      this.games?.phase ??
      (this.training.player.tags.includes("DEFEATED") ? "failed" : "active")
    );
  }
  /** Detach every tap this session put on a state. */
  exit(): void {
    if (this.ledger) detachLedger(this.ledger);
    this.leave();
  }
  /** Detach the drill only: the session is left but what it stands in for lives on. */
  leave(): void {
    if (this.drill) detachLedger(this.drill.ledger);
    this.drill = undefined;
  }
}

export class TrainingSession extends ArenaSession {
  readonly kind = "training";
  readonly mode = "training";
  protected override readonly drills = true;
  constructor(
    training: Training,
    readonly bot: () => BotKind | undefined = () => undefined,
  ) {
    super(training);
  }
  protected tick(input: InputSource) {
    const bot = this.bot();
    stepTraining(
      this.training,
      bot ? timingBot(this.training, bot) : read(input),
    );
  }
}

export class RosterSession extends ArenaSession {
  readonly kind = "roster";
  readonly mode = "roster";
  protected override readonly drills = true;
  protected tick(input: InputSource) {
    stepArena(this.training.state, {
      ...enemyInputs(this.training.state),
      [this.training.player.id]: read(input),
    });
    queueDeathEffects(this.training.state);
  }
}

export class LabDriver extends ArenaSession {
  readonly kind = "lab";
  readonly mode = "lab";
  constructor(lab: LabSession) {
    super(lab.training);
    this.lab = lab;
  }
  protected tick(input: InputSource) {
    stepLab(this.lab!, read(input));
  }
}

abstract class GamesSession extends ArenaSession {
  declare games: Games;
  constructor(training: Training, games: Games) {
    super(training);
    this.games = games;
    this.sync();
  }
  /** Point the shared training view at this session's Games. */
  sync() {
    this.training.state = this.games.state;
    this.training.player = this.games.player;
    this.training.dummy = this.games.state.actors[1]!;
  }
  abstract advance(): void;
}

/** A local Tiro run (the Proving Ground's Games): never sent. */
export class TiroSession extends GamesSession {
  readonly kind = "tiro";
  readonly mode = "tiro";
  /** The harness's reference player: the Games' own Mage AI plays instead of the input. */
  reference = false;
  constructor(training: Training, games: Games) {
    super(training, games);
    this.ledger = createLedger(games.state, games.player.id);
  }
  protected tick(input: InputSource) {
    stepGames(this.games, this.reference ? undefined : read(input));
    if (this.ledger) observeLedger(this.ledger, this.games.state);
  }
  advance() {
    advanceGames(this.games);
    this.sync();
    if (this.ledger) resetLedger(this.ledger);
  }
}

/** The season bout: every input is applied to the bout, observed, taped on advance and queued for the server. */
export class SeasonSession extends GamesSession {
  readonly kind = "season";
  readonly mode = "tiro";
  /** Checkpoints at the bout's opening and every wave start, so a reading skips earlier waves. */
  readonly tape: BoutCheckpoint[] = [];
  queued: BoutInput[] = [];
  constructor(
    readonly bout: SeasonBout,
    training: Training,
  ) {
    if (!bout.games) throw Error("Bout not started");
    super(training, bout.games);
    this.ledger = createLedger(this.games.state, this.games.player.id);
    if (bout.phase !== "prepared") this.tape.push(boutCheckpoint(bout));
  }
  private apply(entry: BoutInput) {
    applyBoutInput(this.bout, entry);
    if (this.ledger) observeLedger(this.ledger, this.games.state);
    if (entry.type === "advance") this.tape.push(boutCheckpoint(this.bout));
    this.queued.push(entry);
  }
  protected tick(input: InputSource) {
    if (this.games.phase === "active")
      this.apply({
        type: "tick",
        tick: this.games.state.tick,
        input: read(input),
      });
  }
  advance() {
    this.apply({ type: "advance", tick: this.games.state.tick });
    this.sync();
    if (this.ledger) resetLedger(this.ledger);
  }
  /** Hand over the queued log entries for sending. */
  drain(): BoutInput[] {
    const entries = this.queued;
    this.queued = [];
    return entries;
  }
}

/** A clone taken over from the bout reader. Never sent, saved or paid; `live` is what it stands in for. */
export class PracticeSession extends ArenaSession {
  readonly kind = "practice";
  readonly mode = "tiro";
  protected override readonly drills = true;
  declare games: Games;
  constructor(
    readonly live: SeasonSession | TiroSession,
    at: SeasonBout,
    readonly livePhase: string,
  ) {
    super(live.training);
    this.games = takeOverBout(at);
    this.sync(this.games);
  }
  private sync(g: Games) {
    this.training.state = g.state;
    this.training.player = g.player;
    this.training.dummy = g.state.actors[1]!;
  }
  protected tick(input: InputSource) {
    stepGames(this.games, read(input));
  }
  override exit() {
    this.leave();
    this.live.exit();
  }
}

/** The one presentation reset every transition hands ArenaGame. */
export const presentationReset = (
  s: ArenaSession,
  lastPhase = "",
): PresentationReset => ({
  eventsFrom: s.training.state.events.length,
  lastPerfect: -1e9,
  impactReset: true,
  lastPhase,
});
const entered = <S extends ArenaSession>(
  session: S,
  lastPhase = "",
): Entered<S> => ({ session, reset: presentationReset(session, lastPhase) });

/** restart: a fresh Proving Ground drill. */
export function enterTraining(
  kind: TrainingKind,
  composition: Composition,
  difficulty: Difficulty,
  bot?: () => BotKind | undefined,
): Entered<TrainingSession> {
  const training = createTraining(kind, undefined, difficulty);
  training.player.water = newWaterState(composition);
  return entered(new TrainingSession(training, bot));
}
/** startRoster: the player alone against a pack of one roster enemy. */
export function enterRoster(
  training: Training,
  id: string,
): Entered<RosterSession> {
  training.state.actors = [training.player];
  const spec = enemyRoster.find((s) => s.id === id)!;
  const count = spec.packSize ?? runtime.games.rosterPracticeCount;
  for (let i = 0; i < count; i++)
    addEnemy(training.state, id, openingPosition(i, count));
  training.dummy = training.state.actors[1]!;
  return entered(new RosterSession(training));
}
/** startGames: a local Tiro run. */
export function enterTiro(
  training: Training,
  seed: number,
  composition: Composition,
  difficulty: Difficulty,
): Entered<TiroSession> {
  const games = createGames(
    seed,
    composition,
    0,
    false,
    undefined,
    undefined,
    difficulty,
  );
  return entered(new TiroSession(training, games));
}
/** resetLab: the Lab's own session. */
export const enterLab = (lab: LabSession): Entered<LabDriver> =>
  entered(new LabDriver(lab));
/** next: the cleared bout advances to its next wave. Undefined where there is no bout to advance. */
export function advance(s: ArenaSession): Entered | undefined {
  if (!(s instanceof TiroSession || s instanceof SeasonSession)) return;
  s.advance();
  return entered(s);
}
/** takeOver: practice from a reading's tick; the live session is kept, untouched, for endPractice. */
export function takeOver(
  live: ArenaSession,
  at: SeasonBout,
  livePhase: string,
): Entered<PracticeSession> | undefined {
  if (!(live instanceof SeasonSession || live instanceof TiroSession)) return;
  return entered(new PracticeSession(live, at, livePhase));
}
/** endPractice: back to the very live session, its view re-pointed and its phase restored. */
export function endPractice(p: PracticeSession): Entered {
  p.leave();
  p.live.sync();
  return entered(p.live, p.livePhase);
}

/** Which state is on screen: the bout reader's frame, else the Lab replay's, else the live one. */
export function shownFrame(
  live: { state: ArenaState; player: Actor },
  reading?: { state: ArenaState; player: Actor },
  replay?: ArenaState,
): { state: ArenaState; player: Actor } {
  const state = replay ?? reading?.state ?? live.state;
  return {
    state,
    player:
      reading?.player ??
      state.actors.find((a) => a.id === live.player.id) ??
      live.player,
  };
}
