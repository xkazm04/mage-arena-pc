import { sigil } from "./ui/artwork.ts";
import { ImpactClock } from "./combat-feedback.ts";
import { LabUI } from "./lab-ui.ts";
import { ArtFixture } from "./art-fixture.ts";
import type { BodyState, Direction, Element } from "./animation-contract.ts";
import { gameAudio } from "./audio.ts";
import { audioData } from "./audio-policy.ts";
import { BitmapText, Graphics } from "pixi.js";
import {
  applyBoutInput,
  boutHash,
  type BoutInput,
  type SeasonBout,
} from "@mage/core";
import {
  combat,
  idleInput,
  resolveHit,
  createLab,
  defaultLabConfig,
  stepLab,
  tuningFor,
  type CombatLab,
  type LabConfig,
  arenaGeometry,
  createTraining,
  FixedStepper,
  runtime,
  seconds,
  stepTraining,
  timingBot,
  newWaterState,
  presets,
  spellFor,
  createGames,
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
  type InputFrame,
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
import { paletteForGames, type Palette } from "./arena-art.ts";
import { colours } from "./ui/kit.ts";
import type { CanvasUI } from "./ui/ui.ts";

export interface SeasonArenaOptions {
  bout: SeasonBout;
  send: (entries: BoutInput[], hash: string) => Promise<unknown>;
  finish: () => Promise<void>;
}
export class ArenaGame {
  readonly scene: ArenaScene;
  readonly input: ArenaInput;
  camera: Camera;
  training = createTraining();
  games?: Games;
  lab?: CombatLab;
  labUI?: LabUI;
  composition: Composition = structuredClone(presets[0]!);
  mode: "training" | "roster" | "tiro" | "lab" = "training";
  paused = false;
  syncError = "";
  private clock = new FixedStepper();
  private queued: BoutInput[] = [];
  private pending: Promise<void> | null = null;
  private bot?: BotKind;
  private lastPerfect = -1e9;
  private lastRefund = 0;
  private impactClock = new ImpactClock();
  private lastEvents = 0;
  private reference = false;
  private hudUpdate: () => void = () => {};
  private lastPhase = "";
  private previousSlot = 0;
  private disposed = false;
  private frames: number[] = [];
  private artFixture?: ArtFixture;
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
    }
    this.lastEvents = this.training.state.events.length;
    gameAudio.pauseWorld(false);
    this.camera = makeCamera(this.camera, arenaGeometry.centre);
    this.scene.palette(
      paletteForGames(season ? season.bout.day / 7 : undefined),
    );
    const params = new URLSearchParams(location.search);
    const base = {
      snapshot: () => this.snapshot(),
      project: (p: { x: number; y: number }) => groundToScreen(p, this.camera),
      performance: () => ({ frames: [...this.frames] }),
    };
    Object.assign(window, {
      __arena: {
        ...base,
        ...(params.has("harness") && !season
          ? {
              artFixture: (kind?: Element | "stress" | "fallbacks") => {
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
                resolveHit(state, target, {
                  ownerId: source.id,
                  activationId: state.nextId++,
                  family: kind.startsWith("defeat")
                    ? "unblockable"
                    : "physical",
                  tier: 1,
                  damage: kind.startsWith("defeat") ? 10000 : 18,
                  source: source.pos,
                });
              },
              feedbackFixture: (
                kind: "hit" | "perfect" | "cast" | "warning",
              ) => {
                this.composition = structuredClone(presets[2]!);
                this.composition.branches.tide_orb = "A";
                this.restart();
                this.hud();
                this.pause(true);
                const { state, player, dummy } = this.training;
                state.tick = 60;
                player.mana = 20;
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
                  player.absorb = kind === "perfect";
                  player.absorbFreshTick = state.tick;
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
  restart(kind: TrainingKind = "magic") {
    this.mode = "training";
    this.lab = undefined;
    this.games = undefined;
    this.reference = false;
    this.training = createTraining(kind);
    this.training.player.water = newWaterState(this.composition);
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
  }
  startLab(compose: () => void) {
    this.resetLab(defaultLabConfig);
    this.labUI = new LabUI(this.ui, this, compose);
    this.hud();
    this.labUI.openSetup();
  }
  resetLab(config: LabConfig) {
    const previous = this.lab;
    this.restart();
    this.lab = createLab(
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
    this.games = createGames(seed, this.composition);
    this.sync();
    this.camera = makeCamera(
      this.camera,
      arenaGeometry.centre,
      this.camera.zoom,
    );
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
    this.queued.push(entry);
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
    this.hud();
  }
  hud() {
    const u = this.ui,
      p = this.training.player;
    u.begin("arena");
    u.onBack = this.settings;
    u.text(
      this.mode === "tiro"
        ? `TIRO GAMES  /  BOUT ${(this.games?.wave ?? 0) + 1} OF 4`
        : this.lab
          ? "COMBAT FEEL LAB"
          : "THE PROVING GROUND",
      96,
      58,
      24,
      colours.gold,
    );
    const heading = u.text(
      this.mode === "tiro" ? "The collar opens" : "Cassia of the Tide",
      96,
      94,
      36,
      colours.text,
      700,
      true,
    );
    u.button("pause", "Pause", 1644, 54, 180, 68, this.settings, {
      tooltip: "Escape / Start opens pause and settings.",
    });
    u.panel(96, 806, 400, 220);
    const hp = u.bar("VITALITY", 132, 834, 328, p.hp, p.maxHp, colours.danger),
      mana = u.bar("MANA", 132, 892, 328, p.mana, p.maxMana, colours.water),
      stamina = u.bar(
        "STAMINA",
        132,
        950,
        328,
        p.stamina,
        p.maxStamina,
        colours.gold,
      );
    const labels: BitmapText[] = [],
      detail: BitmapText[] = [],
      masks: Graphics[] = [],
      slotFrames: Graphics[] = [],
      cooldownBars: ((value: number | null) => void)[] = [];
    for (let i = 0; i < 4; i++) {
      const x = 524 + i * 260,
        y = 854;
      u.button(
        `slot-${i}`,
        "",
        x,
        y,
        244,
        172,
        () => {
          this.input.slot = i;
        },
        { kind: "slot", fontSize: 24 },
      );
      u.icon(
        i === 0 ? "water" : this.composition.lines[i - 1]!,
        x + 42,
        y + 41,
        24,
      );
      labels.push(u.text("", x + 70, y + 24, 26, colours.text, 150));
      u.text(String(i + 1), x + 31, y + 92, 24, colours.gold, 34);
      cooldownBars.push(u.progress("cooldown", x + 76, y + 96, 146, 20));
      detail.push(u.text("", x + 28, y + 122, 23, colours.muted, 188));
      const mask = new Graphics();
      u.content.addChild(mask);
      masks.push(mask);
      const frame = new Graphics();
      u.content.addChild(frame);
      slotFrames.push(frame);
    }
    u.panel(1584, 866, 240, 160);
    const flow = u.text("", 1618, 897, 27, colours.water, 180),
      tip = u.text("Alternate spells", 1618, 943, 24, colours.muted, 180);
    const clock = new Graphics();
    u.content.addChild(clock);
    const artClock = u.kit.source !== "procedural";
    const clockFace = artClock ? u.kit.sprite("clock.face") : undefined,
      clockRim = artClock ? u.kit.sprite("clock.rim") : undefined,
      clockHand = artClock ? u.kit.sprite("clock.hand") : undefined;
    for (const part of [clockFace, clockRim, clockHand])
      if (part) {
        part.anchor.set(0.5);
        part.position.set(993, 109);
        part.width = 96;
        part.height = 96;
        u.content.addChild(part);
      }
    const pips = Array.from({ length: 4 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 2;
      const pair = [
        artClock ? u.kit.sprite("clock.pip.off") : undefined,
        artClock ? u.kit.sprite("clock.pip.on") : undefined,
      ];
      for (const part of pair)
        if (part) {
          part.anchor.set(0.5);
          part.position.set(993 + Math.cos(a) * 43, 109 + Math.sin(a) * 43);
          part.width = 16;
          part.height = 16;
          u.content.addChild(part);
        }
      return pair;
    });
    clock.visible = !artClock;
    sigil(u, "inscription.collar", 993, 109, 122, 0.8);
    const rune = u.text("", 1064, 64, 34, colours.gold, 400, true),
      next = u.text("", 1064, 109, 26, colours.muted, 420);
    const feedback = u.text(
      "",
      650,
      this.lab ? 390 : 220,
      32,
      colours.water,
      1000,
      true,
    );
    const hint = u.text(
      "WASD move  /  Shift sprint  /  Space roll      LMB cast  /  RMB absorb  /  1-4 spells",
      524,
      824,
      24,
      colours.text,
      1000,
    );
    const castBar = u.progress("cast", 524, 785, 1020, 22);
    const castLabel = u.text("", 524, 750, 24, colours.water, 1020);
    this.hudUpdate = () => {
      if (u.screen !== "arena") return;
      const { state, player } = this.training;
      hp(player.hp);
      mana(player.mana);
      stamina(player.stamina);
      const pending = player.pending;
      castBar(
        pending
          ? (state.tick - pending.startTick) /
              Math.max(1, pending.releaseTick - pending.startTick)
          : null,
      );
      castLabel.text = pending
        ? pending.kind === "staff"
          ? "Staff strike"
          : state.tick <
              pending.startTick +
                Math.ceil(
                  (pending.releaseTick - pending.startTick) *
                    tuningFor(state).castCommitFraction,
                )
            ? "Shaping / roll cancels"
            : "Committed / releasing"
        : "";
      heading.text =
        this.mode === "tiro"
          ? `${state.actors.filter((a) => a.team !== player.team && !a.tags.includes("DEFEATED")).length} opponents remain`
          : this.lab
            ? `${this.lab.config.playerSchool.toUpperCase()} / practice mage`
            : "Cassia of the Tide";
      for (let i = 0; i < 4; i++) {
        const s = spellFor(player, i, state)!;
        const slot = u.buttons.find((b) => b.id === `slot-${i}`)!;
        slot.selected = this.input.slot === i;
        slot.tooltip =
          player.tier < 4
            ? `${s.name}. Next tier awakens with collar rune ${["", "I", "II", "III", "IV"][player.tier + 1]}.`
            : `${s.name}. All tiers unlocked.`;
        labels[i]!.text = s.name;
        const remaining = Math.max(
          0,
          seconds((player.water.cooldowns[s.line] ?? 0) - state.tick),
        );
        slot.state = remaining > 0 ? "cooldown" : undefined;
        cooldownBars[i]!(
          remaining > 0 ? 1 - Math.min(1, remaining / s.cooldownS) : null,
        );
        detail[i]!.text =
          remaining > 0
            ? `${remaining.toFixed(1)}s recovering`
            : s.kind === "passive"
              ? "Perfect counter"
              : `${s.mana} mana  /  Tier ${player.tier}`;
        const x = 524 + i * 260;
        slotFrames[i]!.clear();
        if (this.input.slot === i && u.kit.source === "procedural")
          slotFrames[i]!.rect(x + 5, 879, 234, 142).stroke({
            color: colours.water,
            width: 3,
          });
        masks[i]!.clear();
        if (remaining > 0)
          masks[i]!.moveTo(x + 42, 915)
            .arc(
              x + 42,
              915,
              29,
              -Math.PI / 2,
              -Math.PI / 2 + Math.PI * 2 * Math.min(1, remaining / s.cooldownS),
            )
            .lineTo(x + 42, 915)
            .fill({ color: 0x030a13, alpha: 0.7 });
      }
      flow.text = `FLOW  ${player.water.flow} / ${combat.flow.max}`;
      tip.text =
        player.water.flow >= combat.flow.max
          ? "FREE CREST"
          : "Alternate spells";
      const tier = player.tier,
        elapsed = seconds(
          state.tick - player.waveStartTick + player.clockAdvanceTicks,
        ),
        nextTier = (tier + 1) as 2 | 3 | 4;
      const until =
        nextTier <= 4
          ? Math.max(
              0,
              (nextTier - 1) * tuningFor(state).collarIntervalS - elapsed,
              combat.tierClock.minimumSecondsBetweenUnlocks -
                seconds(state.tick - player.lastUnlockTick),
            )
          : 0;
      rune.text = `COLLAR  ${["", "I", "II", "III", "IV"][tier]}`;
      next.text =
        tier < 4 ? `Next rune in ${until.toFixed(1)}s` : "All four runes awake";
      clock
        .clear()
        .circle(993, 109, 43)
        .stroke({ color: colours.edge, width: 3 })
        .circle(993, 109, 36)
        .stroke({ color: colours.gold, width: 1 });
      for (let i = 0; i < 4; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 2;
        clock
          .poly([
            993 + Math.cos(a) * 43,
            109 + Math.sin(a) * 43 - 5,
            998 + Math.cos(a) * 43,
            109 + Math.sin(a) * 43,
            993 + Math.cos(a) * 43,
            114 + Math.sin(a) * 43,
            988 + Math.cos(a) * 43,
            109 + Math.sin(a) * 43,
          ])
          .fill(i < tier ? colours.water : colours.edge);
      }
      const interval = tier < 4 ? tuningFor(state).collarIntervalS : 1;
      const a =
        -Math.PI / 2 + Math.PI * 2 * (tier < 4 ? 1 - until / interval : 1);
      if (clockHand) clockHand.rotation = a + Math.PI / 2;
      pips.forEach(([off, on], i) => {
        if (off) off.visible = i >= tier;
        if (on) on.visible = i < tier;
      });
      clock
        .moveTo(993, 109)
        .lineTo(993 + Math.cos(a) * 27, 109 + Math.sin(a) * 27)
        .stroke({ color: colours.water, width: 3 });
      feedback.text =
        seconds(state.tick - this.lastPerfect) <
        runtime.presentation.perfectFlashS
          ? `PERFECT ABSORB  +${this.lastRefund.toFixed(1)} MANA`
          : player.absorb
            ? "WARD RAISED"
            : "";
      hint.text =
        u.modality === "gamepad"
          ? "Left stick move  /  Right stick aim  /  RT cast  /  LT absorb  /  A roll  /  LB RB spells"
          : "WASD move  /  Shift sprint  /  Space roll      LMB cast  /  RMB absorb  /  1-4 spells";
    };
    if (this.lab) this.labUI?.installHUD();
    u.end();
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
    gameAudio.setScene(`arena:${this.training.player.tier}`);
    if (this.input.slot !== this.previousSlot) {
      this.previousSlot = this.input.slot;
      void gameAudio.play("ui.slot");
    }
    const reduced = localStorage.getItem("mage-motion") === "reduced";
    const simulationDt = this.paused
      ? 0
      : this.impactClock.advance(dt, reduced);
    let alpha = 1;
    if (
      !this.paused &&
      !this.labUI?.replayState &&
      !this.pending &&
      !this.syncError &&
      !this.training.player.tags.includes("DEFEATED") &&
      !document.hidden
    )
      alpha = this.clock.advance(simulationDt, () => {
        if (this.lab) stepLab(this.lab, this.input.frame());
        else if (this.games) {
          if (this.season && this.games.phase === "active")
            this.seasonStep({
              type: "tick",
              tick: this.games.state.tick,
              input: this.input.frame(),
            });
          else if (!this.season)
            stepGames(
              this.games,
              this.reference ? undefined : this.input.frame(),
            );
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
      });
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
    this.consumeEvents(reduced);
    const replay = this.lab ? this.labUI?.frame(dt) : undefined;
    const shown = replay ?? this.training.state;
    const shownPlayer =
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
    this.scene.render(
      this.artFixture?.state ?? shown,
      this.artFixture?.player ?? shownPlayer,
      this.camera,
      alpha,
      this.input.aim,
      this.lastPerfect,
      false,
      dt,
    );
    this.hudUpdate();
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
      this.results();
    }
  }
  private consumeEvents(reduced: boolean) {
    for (const e of this.training.state.events.slice(this.lastEvents)) {
      const p = this.training.player,
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
        this.lastRefund = e.value;
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
        "A10 partial directional clips with explicit same-entity fallback",
      animation: this.scene.bodies.snapshot(),
      effects: this.scene.clips.snapshot(),
      sigils: this.scene.sigils.snapshot(),
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
    window.removeEventListener("keydown", this.artDebugKey);
    this.ui.world.position.set(0, 0);
    this.labUI?.dispose();
    this.input.dispose();
    this.scene.dispose();
    gameAudio.setScene("silent");
    delete (window as Window & { __arena?: unknown }).__arena;
    delete (window as Window & { __seasonArena?: unknown }).__seasonArena;
  }
}
