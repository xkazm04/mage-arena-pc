import { arenaHud } from "./hud/arena-hud.ts";
import { edgeKey } from "./hud/hud-anchors.ts";
import { ImpactClock } from "./combat-feedback.ts";
import { LabUI } from "./lab-ui.ts";
import { createLabSetup, type LabSetup, type LabSession } from "./lab-setup.ts";
import { ArtFixture } from "./art-fixture.ts";
import type { BodyState, Direction, Element } from "./animation-contract.ts";
import { gameAudio } from "./audio.ts";
import { audioData } from "./audio-policy.ts";
import { BitmapText, Container, Graphics } from "pixi.js";
import {
  applyBoutInput,
  boutCheckpoint,
  boutHash,
  takeOverBout,
  type BoutCheckpoint,
  type BoutInput,
  type SeasonBout,
} from "@mage/core";
import { BoutReader } from "./bout-reader-ui.ts";
import {
  combat,
  idleInput,
  resolveHit,
  defaultLabConfig,
  stepLab,
  tuningFor,
  arenaGeometry,
  createTraining,
  FixedStepper,
  runtime,
  ticks,
  stepTraining,
  timingBot,
  newWaterState,
  presets,
  spellFor,
  createGames,
  createLedger,
  detachLedger,
  observeLedger,
  resetLedger,
  stepGames,
  advanceGames,
  addEnemy,
  enemyRoster,
  openingPosition,
  enemyInputs,
  stepArena,
  queueDeathEffects,
  attachMageAI,
  addMage,
  type TrainingKind,
  type BotKind,
  type Composition,
  type Games,
  type ThreatLedger,
  type InputFrame,
  type ArenaState,
  type FlowMark,
} from "@mage/core/arena";
import { ArenaInput } from "./input.ts";
import {
  cameraMetrics,
  followCamera,
  clampPlateCamera,
  groundToScreen,
  interpolate,
  makeCamera,
  type Camera,
} from "./camera.ts";
import { ArenaScene } from "./arena-scene.ts";
import {
  FlowBeforeContact,
  idleTip,
  perfectGain,
  type PerfectGain,
} from "./combat-readout.ts";
import { paletteForGames, type Palette } from "./arena-art.ts";
import { colours } from "./ui/kit.ts";
import { preloadPolicy, ReadyGate } from "./arena-preload.ts";
import { difficulty } from "./difficulty.ts";
import type { CanvasUI } from "./ui/ui.ts";
import { phase as markPhase } from "./frame-probe.ts";

export interface SeasonArenaOptions {
  bout: SeasonBout;
  send: (entries: BoutInput[], hash: string) => Promise<unknown>;
  finish: () => Promise<void>;
}
interface Prefetch {
  games: Games;
  wave: number;
  ms?: number;
  missing?: string[];
}
export class ArenaGame {
  readonly scene: ArenaScene;
  readonly input: ArenaInput;
  camera: Camera;
  training = createTraining(undefined, undefined, difficulty());
  games?: Games;
  /** The player's threat answers for the current Tiro bout; observed beside the state, read by the results card. */
  ledger?: ThreatLedger;
  lab?: LabSession;
  labUI?: LabUI;
  /** Season bout checkpoints at its opening and every wave start, kept beside the state so a reading skips earlier waves. */
  readonly tape: BoutCheckpoint[] = [];
  /** The results card's reading of the wave just fought; shown instead of the live state while its screen is up. */
  reader?: BoutReader;
  /** A practice clone taken over from the reading. Never sent, saved or paid; `live` is what it stands in for. */
  practice?: {
    live: { games: Games; ledger?: ThreatLedger; lastPhase: string };
  };
  composition: Composition = structuredClone(presets[0]!);
  mode: "training" | "roster" | "tiro" | "lab" = "training";
  paused = false;
  syncError = "";
  private clock = new FixedStepper();
  private queued: BoutInput[] = [];
  private pending: Promise<void> | null = null;
  private bot?: BotKind;
  lastPerfect = -1e9;
  lastGain?: PerfectGain;
  /** Training and roster ledger for the ward words (a drill); Tiro uses `ledger`, the Lab its own. */
  private drill?: { state: ArenaState; ledger: ThreatLedger };
  private flowBefore = new FlowBeforeContact();
  flowTip = idleTip();
  flowSeen?: { player: object; mark: FlowMark };
  private impactClock = new ImpactClock();
  private lastEvents = 0;
  private reference = false;
  private hudUpdate: () => void = () => {};
  private lastPhase = "";
  private hudEdges = "";
  private previousSlot = 0;
  private disposed = false;
  private frames: number[] = [];
  private artFixture?: ArtFixture;
  /** Closed while the bout's art loads: no stepping, no season input, no world frame. */
  private gate = new ReadyGate();
  private gateTimeoutMs = preloadPolicy.timeoutS * 1000;
  private loadingCard?: {
    root: Container;
    kicker: BitmapText;
    bar: Graphics;
  };
  /** The next Tiro wave's art, loaded while the intermission card is up. */
  private prefetch?: Prefetch;
  private loadingFrames = 0;
  /** Set once the art is resident; the next loading frame warms the GPU, then the gate opens. */
  private warmUp?: () => void;
  private warmMs?: number;
  private framesSinceGate = 0;
  /** The first frame after the gate shows the opening tick; stepping starts on the next. */
  private holdFirstFrame = false;
  private frameLog?: Record<string, unknown>[];
  private artDebugKey = (e: KeyboardEvent) => {
    if (e.code === "F8") {
      e.preventDefault();
      this.scene.debugEnabled = !this.scene.debugEnabled;
    }
    if (this.scene.debugEnabled && e.code === "BracketRight")
      this.scene.debugPage++;
    if (this.scene.debugEnabled && e.code === "BracketLeft")
      this.scene.debugPage--;
  };
  constructor(
    readonly ui: CanvasUI,
    readonly settings: () => void,
    readonly results: () => void,
    readonly season?: SeasonArenaOptions,
  ) {
    this.camera = makeCamera(
      { width: ui.app.screen.width, height: ui.app.screen.height },
      arenaGeometry.centre,
    );
    this.scene = new ArenaScene(ui.app, ui.world);
    window.addEventListener("keydown", this.artDebugKey);
    this.input = new ArenaInput(
      ui.app.canvas,
      () => this.camera,
      () => !this.paused && ui.screen === "arena",
      () => ui.blocksPointer(),
      () => this.training.player.pos,
    );
    if (season) {
      if (!season.bout.games) throw Error("Bout not started");
      this.games = season.bout.games;
      this.composition = season.bout.composition;
      this.mode = "tiro";
      this.sync();
      this.ledger = createLedger(this.games.state, this.games.player.id);
      if (season.bout.phase !== "prepared")
        this.tape.push(boutCheckpoint(season.bout));
    }
    this.lastEvents = this.training.state.events.length;
    gameAudio.pauseWorld(false);
    this.camera = makeCamera(this.camera, arenaGeometry.centre);
    this.scene.palette(
      paletteForGames(season ? season.bout.day / 7 : undefined),
    );
    const params = new URLSearchParams(location.search);
    if (params.has("harness")) {
      this.frameLog = [];
      const timeout = Number(params.get("preloadTimeoutS"));
      if (timeout > 0) this.gateTimeoutMs = timeout * 1000;
    }
    if (season) {
      this.scene.bodies.characters.set(
        this.games!.player.id,
        season.bout.entrant.id,
      );
      this.prepare();
    }
    const base = {
      snapshot: () => this.snapshot(),
      project: (p: { x: number; y: number }) => groundToScreen(p, this.camera),
      performance: () => ({ frames: [...this.frames] }),
      frameLog: () => structuredClone(this.frameLog ?? []),
    };
    Object.assign(window, {
      __arena: {
        ...base,
        ...(params.has("harness") && !season
          ? {
              artFixture: (kind?: ArtFixture["kind"]) => {
                this.artFixture = kind
                  ? new ArtFixture(kind, this.camera.centre)
                  : undefined;
                this.scene.clips.elementOverrides =
                  this.artFixture?.elements ?? new Map();
                this.pause(!!kind);
              },
              artPose: (state: BodyState, direction: Direction) => {
                if (this.artFixture)
                  this.artFixture.pose = { state, direction };
              },
              setPalette: (palette: Palette) => {
                if (["verdigris", "rust-sand", "moonlit"].includes(palette))
                  this.scene.palette(palette);
              },
              propFixture: (front: boolean) => {
                const prop = this.scene.scenery.props[1];
                if (!prop) throw Error("Prop art not loaded");
                this.pause(true);
                this.training.state.actors = [this.training.player];
                this.training.state.projectiles = [];
                this.training.state.telegraphs = [];
                this.training.player.pos = {
                  x: prop.foot.x,
                  y: prop.foot.y + (front ? 0.8 : -0.8),
                };
                this.training.player.previousPos = {
                  ...this.training.player.pos,
                };
                this.camera = makeCamera(this.camera, {
                  x: prop.foot.x,
                  y: prop.foot.y + 8,
                });
              },
              reset: (kind: TrainingKind = "magic") => this.restart(kind),
              setBot: (bot?: BotKind) => {
                this.bot = bot;
              },
              clearInput: () => this.input.clear(),
              sigilFixture: (
                kind: "ring" | "cone" | "line" | "ward" | "cast" | "status",
                element: Element = "water",
                progress = 0.5,
                angle = 0,
                unblockable = false,
              ) => {
                this.restart();
                this.hud();
                this.pause(true);
                this.input.clear();
                const { state, player, dummy } = this.training;
                state.tick = 120;
                state.telegraphs = [];
                state.projectiles = [];
                state.events = [];
                player.school = element;
                dummy.school = element;
                dummy.dummy = false;
                player.pos = {
                  x: arenaGeometry.centre.x - 5,
                  y: arenaGeometry.centre.y,
                };
                player.previousPos = { ...player.pos };
                dummy.pos = { x: player.pos.x + 10, y: player.pos.y };
                dummy.previousPos = { ...dummy.pos };
                player.facing = { x: Math.cos(angle), y: Math.sin(angle) };
                if (kind === "ward") {
                  player.absorb = true;
                  player.absorbFreshTick =
                    state.tick - Math.floor(progress * 60);
                } else if (kind === "cast") {
                  const spell = spellFor({ ...player, tier: 1 }, 1, state)!;
                  player.pending = {
                    kind: "spell",
                    spell,
                    spellId: spell.id,
                    startTick: 120 - Math.floor(progress * 60),
                    releaseTick: 180 - Math.floor(progress * 60),
                    activationId: state.nextId++,
                    aim: dummy.pos,
                  };
                } else if (kind === "status") {
                  player.water.rootUntil = 180;
                  player.water.slowUntil = 180;
                  player.water.wardUntil = 180;
                } else
                  state.telegraphs.push({
                    id: state.nextId++,
                    activationId: state.nextId++,
                    ownerId: player.id,
                    source: player.pos,
                    origin: player.pos,
                    target:
                      kind === "ring"
                        ? player.pos
                        : {
                            x: player.pos.x + Math.cos(angle) * 10,
                            y: player.pos.y + Math.sin(angle) * 10,
                          },
                    kind:
                      kind === "ring"
                        ? "area"
                        : kind === "cone"
                          ? "melee"
                          : "lane",
                    startTick: 120 - Math.floor(progress * 60),
                    resolveTick: 180 - Math.floor(progress * 60),
                    speedMps: 0,
                    rangeM: kind === "cone" ? 7 : 10,
                    widthM: kind === "ring" ? 5 : kind === "cone" ? 145 : 2,
                    family: unblockable ? "unblockable" : "magic",
                    tier: 1,
                    damage: 12,
                  });
              },
              startGames: (seed = 4) => this.startGames(seed),
              startRoster: (id: string) => this.startRoster(id),
              setReferencePlayer: (enabled: boolean) => {
                this.reference = enabled;
                if (this.games && enabled)
                  attachMageAI(
                    this.games.player,
                    runtime.games.referenceCompetence,
                    this.games.state.tick,
                  );
              },
              runGamesTicks: (count: number) => {
                for (
                  let i = 0;
                  i < count && this.games?.phase === "active";
                  i++
                )
                  stepGames(
                    this.games,
                    this.reference ? undefined : this.input.frame(),
                  );
                this.sync();
              },
              stepInput: (count: number) => {
                for (let i = 0; i < count; i++)
                  stepArena(this.training.state, {
                    [this.training.player.id]: this.input.frame(),
                  });
              },
              hitFixture: (
                kind:
                  "player" | "opponent" | "defeat-player" | "defeat-opponent",
                entity?: string,
                direction?: "ne" | "se" | "sw" | "nw",
                damage = 18,
              ) => {
                const config = this.lab?.config;
                if (config) this.resetLab(config);
                else this.restart();
                this.hud();
                this.pause(true);
                const { state, player, dummy } = this.training;
                state.tick = 30;
                const target = kind.endsWith("opponent") ? dummy : player;
                dummy.pos = { x: player.pos.x + 5, y: player.pos.y };
                dummy.previousPos = { ...dummy.pos };
                if (entity) {
                  target.dummy = false;
                  target.enemy = {
                    id: entity,
                    readyTick: 0,
                    backoffUntil: 0,
                    stunnedUntil: 0,
                    attackIndex: 0,
                    deathQueued: false,
                  };
                } else if (target === dummy) {
                  dummy.dummy = false;
                  dummy.school = "fire";
                }
                const source = target === player ? dummy : player;
                target.velocity = { x: 3, y: 0 };
                stepArena(state, {
                  [target.id]: {
                    ...idleInput(source.pos),
                    cast: true,
                    slot: 1,
                  },
                });
                if (direction)
                  target.facing = {
                    x: direction[1] === "e" ? 1 : -1,
                    y: direction[0] === "s" ? 1 : -1,
                  };
                resolveHit(state, target, {
                  ownerId: source.id,
                  activationId: state.nextId++,
                  family:
                    direction || kind.startsWith("defeat")
                      ? "unblockable"
                      : "physical",
                  tier: 1,
                  damage: kind.startsWith("defeat") ? 10000 : damage,
                  source: source.pos,
                });
              },
              feedbackFixture: (
                kind: "hit" | "perfect" | "held" | "cast" | "warning",
                flow = 0,
              ) => {
                this.composition = structuredClone(presets[2]!);
                this.composition.branches.tide_orb = "A";
                this.restart();
                this.hud();
                this.pause(true);
                const { state, player, dummy } = this.training;
                this.watchContacts();
                state.tick = 60;
                player.mana = 20;
                player.water.flow = flow;
                player.water.lastLine = flow ? "tide_orb" : "";
                player.water.lastActivityTick = state.tick;
                if (kind === "cast" || kind === "warning") {
                  player.tier = kind === "warning" ? 4 : 1;
                  player.mana = player.maxMana;
                  stepArena(state, {
                    [player.id]: {
                      ...this.input.frame(),
                      aim: dummy.pos,
                      slot: 1,
                      cast: true,
                    },
                  });
                } else {
                  player.absorb = kind !== "hit";
                  player.absorbFreshTick =
                    state.tick -
                    (kind === "held"
                      ? ticks(tuningFor(state).absorbWindowS) + 4
                      : 0);
                  player.facing = { x: 1, y: 0 };
                  dummy.pos = { x: player.pos.x + 8, y: player.pos.y };
                  resolveHit(state, player, {
                    ownerId: dummy.id,
                    activationId: state.nextId++,
                    family: "magic",
                    damage: 18,
                    tier: 1,
                    source: dummy.pos,
                  });
                  if (this.drill) observeLedger(this.drill.ledger, state);
                }
              },
              visualFixture: (kind: string, direction = 0) => {
                this.restart();
                this.bot = undefined;
                this.pause(kind !== "aim");
                const { state, player } = this.training;
                state.actors = [player];
                state.projectiles = [];
                state.telegraphs = [];
                const target = addMage(state, 1, {
                  x: player.pos.x + Math.cos(direction) * 9,
                  y: player.pos.y + Math.sin(direction) * 9,
                });
                target.dummy = true;
                this.training.dummy = target;
                this.training.nextAttack = Number.MAX_SAFE_INTEGER;
                if (kind === "scale") {
                  player.absorb = true;
                  for (const [id, x, y] of [
                    ["netter", -9, -6],
                    ["shieldman", 10, -8],
                    ["cinder_hound", -10, 7],
                  ] as const)
                    addEnemy(state, id, {
                      x: player.pos.x + x,
                      y: player.pos.y + y,
                    });
                }
              },
              panPlayer: (pos: { x: number; y: number }) => {
                this.training.player.pos = { ...pos };
                this.training.player.previousPos = { ...pos };
              },
            }
          : {}),
      },
    });
    if (season && params.has("harness"))
      Object.assign(window, {
        __seasonArena: {
          snapshot: () => structuredClone(season.bout),
          pause: (p: boolean) => this.pause(p),
          inputs: async (frames: InputFrame[]) => {
            this.pause(true);
            await this.flush();
            for (const input of frames) {
              if (season.bout.phase !== "active") break;
              this.seasonStep({
                type: "tick",
                tick: this.training.state.tick,
                input,
              });
            }
            await this.flush();
            this.sync();
          },
        },
      });
  }
  private sync() {
    if (this.games) {
      this.training.state = this.games.state;
      this.training.player = this.games.player;
      this.training.dummy = this.games.state.actors[1]!;
    }
  }
  /** The ledger whose grades put words on the player's hits: the Lab's, the Tiro bout's, or a practice one. */
  private wardLedger(): ThreatLedger | undefined {
    return this.lab?.ledger ?? this.ledger ?? this.drill?.ledger;
  }
  /** Attach the read-only contact taps to the state now on screen (practice ledger only where no other ledger exists). */
  private watchContacts() {
    const { state, player } = this.training;
    this.flowBefore.watch(state, player.id);
    if (this.lab || this.ledger || this.drill?.state === state) return;
    if (this.drill) detachLedger(this.drill.ledger);
    this.drill = { state, ledger: createLedger(state, player.id) };
  }
  restart(kind: TrainingKind = "magic") {
    this.mode = "training";
    this.lab = undefined;
    this.games = undefined;
    if (this.ledger) detachLedger(this.ledger);
    this.ledger = undefined;
    if (this.drill) detachLedger(this.drill.ledger);
    this.drill = undefined;
    this.flowTip = idleTip();
    this.flowSeen = undefined;
    this.lastGain = undefined;
    this.reference = false;
    this.training = createTraining(kind, undefined, difficulty());
    this.training.player.water = newWaterState(this.composition);
    if (gameAudio.snapshot().scene.startsWith("arena:"))
      gameAudio.setScene("arena:1", true);
    this.clock = new FixedStepper();
    this.input.clear();
    this.paused = false;
    this.lastEvents = 0;
    this.lastPerfect = -1e9;
    this.impactClock.reset();
    this.lastPhase = "";
    this.camera = makeCamera(
      this.camera,
      arenaGeometry.centre,
      this.camera.zoom,
    );
    this.prepare();
  }
  /** Hold the bout behind the loading card until the art its actors can draw is resident. */
  private prepare() {
    const renderer = this.ui.app.renderer;
    this.framesSinceGate = 0;
    this.warmUp = undefined;
    this.warmMs = undefined;
    void this.gate
      .open(
        this.scene
          .ready(this.training.state.actors, (source) =>
            renderer.texture.initSource(source),
          )
          .then(
            (missing) =>
              new Promise<string[]>((resolve) => {
                this.warmUp = () => resolve(missing);
              }),
          ),
        this.gateTimeoutMs,
        () => this.scene.progress().pending,
      )
      .then((report) => {
        if (!report || this.disposed) return;
        this.clock = new FixedStepper();
        this.holdFirstFrame = true;
      });
  }
  /** Draws the opening tick offscreen while the loading card is still up, then lets the gate open. */
  private warm() {
    const done = this.warmUp!,
      started = performance.now();
    this.warmUp = undefined;
    this.scene.render(
      this.training.state,
      this.training.player,
      this.camera,
      1,
      this.input.aim,
      this.lastPerfect,
      false,
      0,
    );
    this.scene.warm(this.ui.app.renderer, this.ui.world);
    this.warmMs = performance.now() - started;
    done();
  }
  /** While the intermission card is up, load the next wave's bodies, sigils and effects. */
  private prefetchNext() {
    const g = this.games;
    if (
      g?.phase !== "intermission" ||
      this.practice ||
      (this.prefetch?.games === g && this.prefetch.wave === g.wave)
    )
      return;
    const record: Prefetch = {
        games: g,
        wave: g.wave,
      },
      started = performance.now(),
      renderer = this.ui.app.renderer;
    this.prefetch = record;
    const upcoming = createGames(
      0,
      presets[0]!,
      g.wave + 1,
    ).state.actors.filter((a) => a.team !== g.player.team);
    void this.scene
      .ready(
        [g.player, ...upcoming],
        (source) => renderer.texture.initSource(source),
        true,
      )
      .then((missing) => {
        record.ms = performance.now() - started;
        record.missing = missing;
      });
  }
  private drawLoading(show: boolean) {
    if (!show) {
      if (this.loadingCard) this.loadingCard.root.visible = false;
      return;
    }
    const u = this.ui;
    if (!this.loadingCard) {
      const root = new Container();
      u.root.addChildAt(root, u.root.getChildIndex(u.content) + 1);
      // Opaque: the bout's raw layers never show behind the card.
      root.addChild(
        new Graphics().rect(-4000, -4000, 9920, 9080).fill(colours.ink),
      );
      u.panel(560, 372, 800, 336, "panel.modal", root);
      const kicker = u.text("", 620, 410, 24, colours.gold, 680, false, root);
      u.text(
        "Preparing the arena",
        620,
        450,
        48,
        colours.text,
        680,
        true,
        root,
      );
      u.text(
        "The sand is raked. The grille rises when every figure stands ready.",
        620,
        522,
        26,
        colours.muted,
        680,
        false,
        root,
      );
      const bar = new Graphics();
      root.addChild(bar);
      u.text(
        "ESC / START  Pause",
        620,
        652,
        22,
        colours.muted,
        680,
        false,
        root,
      );
      this.loadingCard = { root, kicker, bar };
    }
    const card = this.loadingCard,
      { fraction } = this.scene.progress();
    card.root.visible = true;
    card.kicker.text =
      this.mode === "tiro"
        ? `TIRO GAMES  /  BOUT ${(this.games?.wave ?? 0) + 1} OF 4`
        : this.lab
          ? "COMBAT FEEL LAB"
          : "THE PROVING GROUND";
    const pulse =
      localStorage.getItem("mage-motion") === "reduced"
        ? 1
        : 0.7 + 0.3 * Math.sin(performance.now() / 260);
    card.bar
      .clear()
      .rect(620, 614, 680, 14)
      .fill(colours.panel)
      .stroke({ color: colours.edge, width: 1 })
      .rect(620, 614, 680 * fraction, 14)
      .fill({ color: colours.water, alpha: pulse });
  }
  /** Send the season log once a second of ticks has queued or the wave has ended. */
  private autoFlush() {
    if (
      this.season &&
      !this.pending &&
      this.queued.length &&
      (this.queued.length >= combat.simStepHz || this.games?.phase !== "active")
    )
      void this.flush().catch(() =>
        this.ui.notice(
          "Checkpoint failed. Load the last accepted save to resume.",
        ),
      );
  }
  startLab(compose: () => void) {
    this.resetLab({ ...defaultLabConfig, difficulty: difficulty() });
    this.labUI = new LabUI(this.ui, this, compose);
    this.hud();
    this.labUI.openSetup();
  }
  resetLab(config: LabSetup) {
    const previous = this.lab;
    this.restart();
    this.lab = createLabSetup(
      config,
      previous?.training.state.tuning,
      previous?.tuningName,
    );
    if (previous)
      this.lab.training.state.lab!.damageEnabled =
        previous.training.state.lab!.damageEnabled;
    this.training = this.lab.training;
    this.composition = config.composition;
    this.mode = "lab";
    this.prepare();
  }
  stepLabOnce() {
    if (this.lab && !this.labUI?.replayState)
      stepLab(this.lab, {
        ...this.input.frame(),
        cast: false,
        absorb: false,
        roll: false,
      });
  }
  startGames(seed = 4) {
    this.restart();
    this.mode = "tiro";
    this.games = createGames(
      seed,
      this.composition,
      0,
      false,
      undefined,
      undefined,
      difficulty(),
    );
    this.sync();
    this.ledger = createLedger(this.games.state, this.games.player.id);
    this.camera = makeCamera(
      this.camera,
      arenaGeometry.centre,
      this.camera.zoom,
    );
    this.prepare();
    this.hud();
  }
  startRoster(id: string) {
    this.restart();
    this.mode = "roster";
    this.training.state.actors = [this.training.player];
    const spec = enemyRoster.find((s) => s.id === id)!;
    const count = spec.packSize ?? runtime.games.rosterPracticeCount;
    for (let i = 0; i < count; i++)
      addEnemy(this.training.state, id, openingPosition(i, count));
    this.training.dummy = this.training.state.actors[1]!;
    this.prepare();
    this.hud();
  }
  pause(value: boolean) {
    gameAudio.pauseWorld(value);
    this.paused = value;
    this.input.clear();
    this.clock = new FixedStepper();
  }
  private seasonStep(entry: BoutInput) {
    applyBoutInput(this.season!.bout, entry);
    if (this.ledger && this.games) observeLedger(this.ledger, this.games.state);
    if (entry.type === "advance")
      this.tape.push(boutCheckpoint(this.season!.bout));
    this.queued.push(entry);
  }
  /** Read the season wave just fought from the client's own log; rebuilt only when the log has grown. */
  openReader(): BoutReader {
    const bout = this.season?.bout;
    if (!bout?.games || this.practice)
      throw Error("Only a fought season bout can be read.");
    if (
      this.reader?.reading.source !== bout ||
      this.reader.wave.last !== bout.log.length
    )
      this.reader = new BoutReader(bout, this.tape);
    this.reader.playing = false;
    this.pause(true);
    return this.reader;
  }
  /** Practice from the reader's tick: a clone of the replayed Games, stepped locally and never queued or flushed. */
  takeOver() {
    if (!this.reader?.canTakeOver || !this.games || this.practice) return;
    this.practice = {
      live: {
        games: this.games,
        ledger: this.ledger,
        lastPhase: this.lastPhase,
      },
    };
    this.games = takeOverBout(this.reader.at);
    this.ledger = undefined;
    this.sync();
    this.lastEvents = this.training.state.events.length;
    this.lastPhase = "";
    this.lastPerfect = -1e9;
    this.impactClock.reset();
    this.pause(false);
    this.prepare();
    this.hud();
  }
  endPractice(note = "Practice ended. The settled bout is unchanged.") {
    const live = this.practice?.live;
    if (!live) return;
    this.practice = undefined;
    this.games = live.games;
    this.ledger = live.ledger;
    this.sync();
    this.lastEvents = this.training.state.events.length;
    this.lastPhase = live.lastPhase;
    this.impactClock.reset();
    this.pause(true);
    this.results();
    this.ui.notice(note);
  }
  async flush() {
    if (this.pending) await this.pending;
    if (this.syncError) throw Error(this.syncError);
    if (!this.season || !this.queued.length) return;
    const entries = this.queued;
    this.queued = [];
    this.pending = this.season
      .send(entries, boutHash(this.season.bout))
      .then(() => {})
      .catch((e: unknown) => {
        this.syncError = String(e);
        this.pause(true);
        throw e;
      });
    try {
      await this.pending;
    } finally {
      this.pending = null;
    }
  }
  async next() {
    await this.flush();
    if (!this.games) return;
    if (this.season)
      this.seasonStep({ type: "advance", tick: this.games.state.tick });
    else advanceGames(this.games);
    this.sync();
    if (this.ledger) resetLedger(this.ledger);
    this.lastEvents = this.training.state.events.length;
    this.lastPerfect = -1e9;
    this.impactClock.reset();
    this.lastPhase = "";
    this.camera = makeCamera(
      this.camera,
      arenaGeometry.centre,
      this.camera.zoom,
    );
    this.pause(false);
    this.prepare();
    this.hud();
  }
  hud() {
    this.hudEdges = edgeKey(this.ui.edges);
    this.hudUpdate = arenaHud(this.ui, this);
    if (this.lab) this.labUI?.installHUD();
    this.ui.end();
    this.hudUpdate();
  }
  frame(dt: number) {
    if (this.disposed) return;
    this.frames.push(dt * 1000);
    if (this.frames.length > 360) this.frames.shift();
    if (
      this.camera.width !== this.ui.app.screen.width ||
      this.camera.height !== this.ui.app.screen.height
    )
      this.camera = makeCamera(
        this.ui.app.screen,
        this.camera.centre,
        this.camera.zoom,
      );
    // The HUD is built against the viewport edges; a window resize or UI scale change re-anchors it.
    if (this.ui.screen === "arena" && this.hudEdges !== edgeKey(this.ui.edges))
      this.hud();
    this.prefetchNext();
    const loading = this.gate.loading;
    this.ui.world.visible = !loading;
    this.drawLoading(loading && this.ui.screen === "arena");
    if (loading) {
      this.loadingFrames++;
      if (this.warmUp) this.warm();
      this.autoFlush();
      return;
    }
    gameAudio.setScene(`arena:${this.training.player.tier}`);
    if (this.input.slot !== this.previousSlot) {
      this.previousSlot = this.input.slot;
      void gameAudio.play("ui.slot");
    }
    const reduced = localStorage.getItem("mage-motion") === "reduced";
    this.watchContacts();
    markPhase("arena.pre");
    const simulationDt = this.paused
      ? 0
      : this.impactClock.advance(dt, reduced);
    let alpha = 1;
    const hold = this.holdFirstFrame;
    this.holdFirstFrame = false;
    if (
      !hold &&
      !this.paused &&
      !this.labUI?.replayState &&
      (!this.reader || this.ui.screen !== "bout-reader") &&
      !this.pending &&
      !this.syncError &&
      !this.training.player.tags.includes("DEFEATED") &&
      !document.hidden
    )
      alpha = this.clock.advance(simulationDt, () => {
        if (this.lab) stepLab(this.lab, this.input.frame());
        else if (this.games) {
          if (this.practice) stepGames(this.games, this.input.frame());
          else if (this.season && this.games.phase === "active")
            this.seasonStep({
              type: "tick",
              tick: this.games.state.tick,
              input: this.input.frame(),
            });
          else if (!this.season) {
            stepGames(
              this.games,
              this.reference ? undefined : this.input.frame(),
            );
            if (this.ledger) observeLedger(this.ledger, this.games.state);
          }
        } else if (this.mode === "roster") {
          stepArena(this.training.state, {
            ...enemyInputs(this.training.state),
            [this.training.player.id]: this.input.frame(),
          });
          queueDeathEffects(this.training.state);
        } else
          stepTraining(
            this.training,
            this.bot ? timingBot(this.training, this.bot) : this.input.frame(),
          );
        if (this.drill?.state === this.training.state)
          observeLedger(this.drill.ledger, this.drill.state);
      });
    markPhase("step");
    this.autoFlush();
    this.consumeEvents(reduced);
    const read =
      this.reader && !this.practice && this.ui.screen === "bout-reader"
        ? this.reader.frame(dt)
        : undefined;
    const replay = this.lab ? this.labUI?.frame(dt) : read?.state;
    const shown = replay ?? this.training.state;
    const shownPlayer =
      read?.player ??
      replay?.actors.find((a) => a.id === this.training.player.id) ??
      this.training.player;
    this.camera = clampPlateCamera(
      followCamera(
        this.camera,
        interpolate(shownPlayer.previousPos, shownPlayer.pos, alpha),
        dt,
      ),
    );
    this.input.refreshAim();
    this.artFixture?.update(dt);
    const shake = this.impactClock.offset(
      cameraMetrics(this.camera).resolutionScale,
    );
    this.ui.world.position.set(
      reduced || this.paused ? 0 : shake.x,
      reduced || this.paused ? 0 : shake.y,
    );
    this.scene.feedback.ledger = this.wardLedger();
    markPhase("events");
    this.scene.render(
      this.artFixture?.state ?? shown,
      this.artFixture?.player ?? shownPlayer,
      this.camera,
      read ? 1 : alpha,
      read ? read.player.lastInput.aim : this.input.aim,
      read ? -1e9 : this.lastPerfect,
      false,
      dt,
    );
    markPhase("scene");
    if (
      this.frameLog &&
      this.framesSinceGate++ < preloadPolicy.frameLogFramesPerGate
    ) {
      this.frameLog.push({
        at: performance.now(),
        gate: this.gate.opened,
        screen: this.ui.screen,
        mode: this.mode,
        wave: this.games?.wave,
        tick: shown.tick,
        loadingFrames: this.loadingFrames,
        ground: this.scene.scenery.source,
        bodies: this.scene.bodies.snapshot().displayed.map((d) => ({
          entity: d.entity,
          source: d.source,
          page: d.page,
        })),
        sigilsReady: !!this.scene.sigils.manifest,
        sigilsDrawn: this.scene.sigils.snapshot().active,
        effectsReady: !!this.scene.clips.manifest,
        missingPages: this.scene.progress().pending,
      });
      if (this.frameLog.length > preloadPolicy.frameLogLimit)
        this.frameLog.shift();
    }
    this.hudUpdate();
    markPhase("hud");
    const phase =
      this.games?.phase ??
      (this.training.player.tags.includes("DEFEATED") ? "failed" : "active");
    if (
      !this.lab &&
      phase !== "active" &&
      phase !== this.lastPhase &&
      this.ui.screen === "arena"
    ) {
      this.lastPhase = phase;
      this.pause(true);
      if (this.practice)
        this.endPractice(
          phase === "lost"
            ? "Practice lost. The settled bout is unchanged."
            : "Practice bout cleared. The settled bout is unchanged.",
        );
      else this.results();
    }
  }
  private consumeEvents(reduced: boolean) {
    const events = this.training.state.events;
    for (let i = this.lastEvents; i < events.length; i++) {
      const e = events[i]!,
        p = this.training.player,
        actor = this.training.state.actors.find((a) => a.id === e.actorId);
      if (!actor) continue;
      const dx = actor.pos.x - p.pos.x,
        dy = actor.pos.y - p.pos.y;
      const spatial = {
        pan: dx / audioData.spatial.rangeM,
        gain: Math.max(
          audioData.spatial.minGain,
          1 - Math.hypot(dx, dy) / audioData.spatial.rangeM,
        ),
      };
      if (e.kind === "perfect" && e.actorId === p.id) {
        this.lastPerfect = e.tick;
        const before = this.flowBefore.before(this.training.state, i);
        this.lastGain = perfectGain(
          this.training.state,
          p,
          e.value,
          before ?? Math.max(0, p.water.flow - combat.flow.perfectAbsorbGives),
          e.tick,
        );
        if (!reduced) this.impactClock.hit(0, true);
        void gameAudio.play("perfect");
      } else if (e.kind === "unlock" && e.actorId === p.id) {
        void gameAudio.play("collar");
        if (e.value === 2) {
          void gameAudio.play("voice.collar");
          this.ui.notice("The collar loosens. Stand ready.");
        }
      } else if (e.kind === "release")
        void gameAudio.play(
          actor.enemy ? "impact" : `cast.${actor.school ?? "water"}`,
          spatial,
        );
      else if (e.kind === "hit" && (e.contactDamage ?? e.value) > 0) {
        const damage = e.contactDamage ?? e.value;
        if (!reduced && (e.actorId === p.id || e.targetId === p.id))
          this.impactClock.hit(damage);
        void gameAudio.play(e.actorId === p.id ? "hit" : "impact", {
          ...spatial,
          gain: spatial.gain * Math.min(1, 0.45 + damage / 25),
        });
      } else if (e.kind === "stagger") void gameAudio.play("stagger", spatial);
      else if (e.kind === "roll") void gameAudio.play("roll", spatial);
    }
    this.lastEvents = this.training.state.events.length;
  }
  snapshot() {
    return structuredClone({
      fixture: this.artFixture?.kind,
      state: this.artFixture?.state ?? this.training.state,
      player: this.training.player,
      slot: this.input.slot,
      aim: this.input.aim,
      paused: this.paused,
      mode: this.mode,
      loading: this.gate.loading,
      preload: {
        last: this.gate.last,
        opened: this.gate.opened,
        loadingFrames: this.loadingFrames,
        warmMs: this.warmMs,
        progress: this.scene.progress(),
        prefetch: this.prefetch && {
          wave: this.prefetch.wave + 1,
          ms: this.prefetch.ms,
          missing: this.prefetch.missing,
        },
      },
      lab: this.lab && {
        config: this.lab.config,
        metrics: this.lab.metrics,
        tuningName: this.lab.tuningName,
        historyCount: this.lab.historyCount,
        replayTick: this.labUI?.replayState?.tick,
      },
      games: this.games,
      camera: this.camera,
      cameraMetrics: cameraMetrics(this.camera),
      visibleProjectiles: this.scene.visibleProjectiles,
      palette: this.scene.scenery.palette,
      groundSource: this.scene.scenery.source,
      groundDiagnostics: this.scene.scenery.diagnostics,
      derivedTextureBytes: this.scene.scenery.derivedBytes,
      figureSource:
        "A10 + A14.3 directional clips with explicit same-entity fallback",
      animation: this.scene.bodies.snapshot(),
      effects: this.scene.clips.snapshot(),
      sigils: this.scene.sigils.snapshot(),
      rivalCollars: this.scene.collars.snapshot(),
      feedback: this.scene.feedback.snapshot(),
      impactClock: {
        stopS: this.impactClock.stopS,
        compressionS: this.impactClock.compressionS,
      },
      depthOrder: this.scene.depthSnapshot(),
    });
  }
  dispose() {
    this.disposed = true;
    this.gate.cancel();
    this.loadingCard?.root.destroy({ children: true });
    this.ui.world.visible = true;
    window.removeEventListener("keydown", this.artDebugKey);
    this.flowBefore.dispose();
    if (this.drill) detachLedger(this.drill.ledger);
    this.ui.world.position.set(0, 0);
    this.labUI?.dispose();
    this.input.dispose();
    this.scene.dispose();
    gameAudio.setScene("silent");
    delete (window as Window & { __arena?: unknown }).__arena;
    delete (window as Window & { __seasonArena?: unknown }).__seasonArena;
  }
}
