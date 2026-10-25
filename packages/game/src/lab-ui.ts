import {
  coupleTuningField,
  exportTuning,
  importTuning,
  labReplay,
  makeTuning,
  presets,
  rivalPlanPresets,
  replenishLab,
  difficulties,
  defaultDifficulty,
  paceOf,
  seconds,
  spellFor,
  tiro,
  toggleLabDamage,
  tuningFields,
  tuningPresets,
  validateLabConfig,
  type ArenaState,
  type TuningKey,
  type SpellOverride,
} from "@mage/core/arena";
import type { BitmapText } from "pixi.js";
import type { ArenaGame } from "./arena-entry.ts";
import { colours } from "./ui/kit.ts";
import { labAnswerLine } from "./answers.ts";
import type { CanvasUI } from "./ui/ui.ts";
import { sigil } from "./ui/artwork.ts";
import {
  changeLabSetupTuning as changeLabTuning,
  creatureTargets,
  creatureName,
  type LabSetup,
} from "./lab-setup.ts";
import { ForecastClient } from "./forecast-client.ts";
import { forecastLabel } from "./forecast-job.ts";
import { buildsForecastLine, forecastHeading, forecastLines, type ForecastCell } from "./lab-forecast-view.ts";
import { changedKnobs, duelDeltaText, LabCompare } from "./lab-compare.ts";
import { labKey, labModeOf, stopReplay, type LabHost, type LabKeyResult, type LabMode, type LabModeState } from "./lab-mode.ts";
import { ReplayTransport } from "./replay-transport.ts";
import {
  labSides,
  loadPicks,
  nextSlotSpell,
  pickSchools,
  presetOptions,
  rankChoices,
  rankRows,
  savePicks,
  sideBuild,
  sideComposition,
  sideProblems,
  sideRanks,
  sideSchool,
  statKeys,
  withPreset,
  withRivalPreset,
  withSchool,
  withSlot,
  withSpellRank,
  withStat,
  type LabSide,
  type PickSchool,
} from "./lab-picks.ts";

const title = (s: string) => s[0]!.toUpperCase() + s.slice(1);
const paint = (t: BitmapText, c: ForecastCell) => {
  t.text = c.text;
  t.tint = colours[c.tone];
};
interface ForecastTexts {
  rows: BitmapText[][];
  ttk: BitmapText;
  dpm: BitmapText;
  status: BitmapText;
  knobs: BitmapText;
}
/** All interaction is drawn by the canvas kit. Clipboard/drop is data transport only. */
export class LabUI {
  private page = "Movement";
  private tuningSubpage = 0;
  private draft!: LabSetup;
  /** Which mode the Lab is in (lab-mode.ts decides what each hotkey means there). */
  private state: LabModeState = { mode: "live", replayWasPaused: false };
  /** The typed number while the mode is "number". */
  private numeric?: {
    text: string;
    label: string;
    min: number;
    max: number;
    apply: (n: number) => void;
    back: () => void;
  };
  private importText = "";
  private text?: BitmapText;
  private metricsText?: BitmapText;
  private answersText?: BitmapText;
  private statusText?: BitmapText;
  private readonly lifetime = new AbortController();
  /** The ring read when a replay is asked for, and the replay playing it (its shown state is derived once per move). */
  private ring: ArenaState[] = [];
  private replay?: { frames: ArenaState[]; transport: ReplayTransport; shown: ArenaState };
  private spellSlot = 0;
  private spellTier = 1;
  private forecastTexts?: ForecastTexts;
  /** The builds page's forecast line (the draft's duel), and whether the stored last picks seeded a setup draft yet. */
  private buildsForecastText?: BitmapText;
  private picksSeeded = false;
  /** Census forecast runs in a worker; the panel only reads its summaries and never writes a band. */
  private readonly forecast = new ForecastClient(() => this.showForecast());
  /** The forecast's comparison point: Current, or a pinned tuning + builds (kept for the Lab session). */
  private readonly compare = new LabCompare();
  constructor(
    private u: CanvasUI,
    private game: ArenaGame,
    private compose: () => void,
  ) {
    const signal = this.lifetime.signal;
    window.addEventListener(
      "paste",
      (e) => {
        if (this.state.mode !== "import") return;
        e.preventDefault();
        this.importText = e.clipboardData?.getData("text/plain") ?? "";
        this.showImportText();
      },
      { signal },
    );
    u.app.canvas.addEventListener(
      "dragover",
      (e) => {
        if (this.state.mode === "import") e.preventDefault();
      },
      { signal },
    );
    u.app.canvas.addEventListener(
      "drop",
      (e) => {
        if (this.state.mode !== "import") return;
        e.preventDefault();
        const file = e.dataTransfer?.files[0];
        if (!file || file.size > 64000) {
          u.notice("Drop a tuning JSON file smaller than 64 KB.");
          return;
        }
        void file.text().then((text) => {
          if (this.state.mode !== "import") return;
          this.importText = text;
          this.showImportText();
        });
      },
      { signal },
    );
  }
  /** The replayed state the host renders instead of the live one, while a replay plays. */
  get replayState(): ArenaState | undefined {
    return this.replay?.shown;
  }
  private get lab() {
    return this.game.lab!;
  }
  private get tune() {
    return this.lab.training.state.tuning!;
  }
  private clear() {
    this.metricsText = undefined;
    this.answersText = undefined;
    this.statusText = undefined;
    this.text = undefined;
    this.forecastTexts = undefined;
    this.buildsForecastText = undefined;
  }
  /** Enter a mode; a running replay keeps its mode until it is stopped. */
  private enter(mode: LabMode) {
    if (!this.replay) this.state = { mode, replayWasPaused: false };
  }
  private heading(screen: string, name: string, subtitle: string) {
    this.enter(labModeOf(screen));
    this.clear();
    this.u.begin(screen);
    this.u.panel(72, 40, 1776, 996, "panel.modal");
    this.u.text("COMBAT FEEL LAB", 120, 76, 24, colours.gold);
    this.u.text(name, 106, 106, 46, colours.text, 1650, true);
    this.u.text(subtitle, 106, 165, 24, colours.muted, 1650);
    sigil(this.u, "inscription.wardstone", 1735, 120, 125, 0.7);
  }
  private get host(): LabHost {
    return {
      paused: this.game.paused,
      ringLength: () => (this.ring = labReplay(this.lab)).length,
    };
  }
  private keys = (e: KeyboardEvent) => this.press(e.code, e.repeat);
  /** A hotkey or its HUD button: lab-mode.ts reads it for the current mode, this carries it out. */
  private press(code: string, repeat = false) {
    const r = labKey(this.state, code, repeat, this.host);
    if (r.kind === "unhandled") return false;
    if (r.kind === "notice") this.u.notice(r.text);
    if (r.kind === "action") this.run(r);
    return true;
  }
  private run(r: Extract<LabKeyResult, { kind: "action" }>) {
    const replay = this.replay;
    switch (r.action) {
      case "reset":
        return this.reset();
      case "pause-toggle":
        this.game.pause(!this.game.paused);
        return this.refreshPanel();
      case "replay-pause-toggle":
        if (replay) replay.transport.playing = !replay.transport.playing;
        return this.refreshPanel();
      case "live-step":
        this.game.pause(true);
        this.game.stepLabOnce();
        return this.refreshPanel();
      case "replay-step":
        replay?.transport.step(1);
        return this.refreshPanel();
      case "refill":
        return replenishLab(this.lab);
      case "damage":
        return toggleLabDamage(this.lab);
      case "tuning":
        return this.openTuning();
      case "setup":
        return this.openSetup();
      case "builds":
        return this.drawBuilds();
      case "replay-start":
        return this.beginReplay(r.next, r.pause ?? true);
      case "replay-stop":
        return this.endReplay(r.next, r.pause ?? false);
    }
  }
  private refreshPanel() {
    if (this.state.mode === "tuning") this.drawTuning();
  }
  installHUD() {
    this.forecast.cancel();
    this.enter("live");
    this.clear();
    const u = this.u;
    u.panel(96, 168, 1728, 128);
    this.metricsText = u.text("", 132, 184, 22, colours.text, 1650);
    this.answersText = u.text("", 132, 218, 22, colours.muted, 1650);
    this.statusText = u.text("", 132, 252, 22, colours.gold, 1650);
    const actions: [string, string, string][] = [
      ["setup", "L  Setup", "KeyL"],
      ["tuning", "T  Tune", "KeyT"],
      ["reset", "R  Reset", "KeyR"],
      ["freeze", "P  Freeze", "KeyP"],
      ["step", ".  Step", "Period"],
      ["refill", "G  Refill", "KeyG"],
      ["damage", "H  Damage", "KeyH"],
      ["replay", "V  Replay", "KeyV"],
    ];
    actions.forEach(([id, label, code], i) =>
      u.button(`lab-${id}`, label, 96 + i * 218, 310, 202, 64, () => this.press(code), {
        fontSize: 22,
      }),
    );
    u.onKey = this.keys;
  }
  reset(config = this.lab.config) {
    this.stopReplay();
    const chosen = structuredClone(config);
    if (chosen.randomSeed)
      chosen.seed = crypto.getRandomValues(new Uint32Array(1))[0]!;
    this.game.resetLab(chosen);
    // The last pick per side seeds the next Lab's setup (storage failures are ignored inside).
    savePicks(chosen);
    this.game.hud();
  }
  openSetup() {
    this.stopReplay();
    this.game.pause(true);
    this.draft = structuredClone(this.lab.config);
    // The first setup of a Lab session defaults each side to its last stored pick; without storage it is the setup as given.
    if (!this.picksSeeded) {
      this.picksSeeded = true;
      this.draft = loadPicks(this.draft);
    }
    this.drawSetup();
  }
  private cycle<T>(items: readonly T[], value: T): T {
    return items[(items.indexOf(value) + 1) % items.length]!;
  }
  private drawSetup() {
    const u = this.u,
      c = this.draft;
    this.heading(
      "lab-setup",
      "Choose your experiment",
      "Exactly one target. Setup and loadout changes begin a fresh bout; tuning stays selected.",
    );
    const choose = (
      id: string,
      label: string,
      x: number,
      y: number,
      act: () => void,
      width = 780,
    ) =>
      u.button(
        `lab-config-${id}`,
        label,
        x,
        y,
        width,
        70,
        () => {
          act();
          this.drawSetup();
        },
        { fontSize: 26 },
      );
    choose(
      "opponent",
      `Target: ${c.creature ? `${creatureName(c.creature)} (${c.targetMotion ?? "still"})` : c.opponent === "dummy" ? "Dummy" : "Mage AI"}`,
      106,
      228,
      () => {
        const next = this.cycle(
          ["dummy", "mage", ...creatureTargets] as const,
          c.creature ?? c.opponent,
        );
        c.creature = next === "dummy" || next === "mage" ? undefined : next;
        c.opponent = next === "mage" ? "mage" : "dummy";
      },
    );
    choose(
      "player-school",
      `Your school: ${title(c.playerSchool)}`,
      980,
      228,
      () => {
        this.draft = withSchool(c, "player", this.cycle(pickSchools, c.playerSchool as PickSchool));
      },
    );
    choose(
      "school",
      c.creature
        ? `Creature facing: ${(c.creatureFacing ?? "se").toUpperCase()}`
        : `Opponent school: ${title(c.opponentSchool)}`,
      106,
      320,
      () => {
        if (c.creature)
          c.creatureFacing = this.cycle(
            ["se", "sw", "nw", "ne"] as const,
            c.creatureFacing ?? "se",
          );
        else this.draft = withSchool(c, "opponent", this.cycle(pickSchools, c.opponentSchool as PickSchool));
      },
    );
    choose("competence", `Competence: ${c.competence} / 4`, 980, 320, () => {
      c.competence = (c.competence % 4) + 1;
    });
    // A mage rival has no dummy action: that slot picks its Water preset and whether it plays the preset's plan.
    const rival = c.opponent === "mage" && !c.creature,
      rivalPreset = c.rivalPreset ?? presets[2]!.name;
    if (rival) {
      choose("rival-preset", `Rival: ${rivalPreset}`, 106, 412, () => {
        c.rivalPreset = this.cycle(presets.map((p) => p.name), rivalPreset);
      }, 380);
      choose(
        "rival-plan",
        rivalPlanPresets.includes(rivalPreset) ? `Rival plan: ${c.rivalPlan ? "on" : "off"}` : "Rival plan: none",
        506,
        412,
        () => {
          if (rivalPlanPresets.includes(rivalPreset)) c.rivalPlan = !c.rivalPlan;
        },
        380,
      );
    } else choose(
      "dummy",
      c.creature
        ? c.targetMotion === "live"
          ? "Creature motion: Live (roster brain attacks)"
          : "Creature motion: Still (hit / death practice)"
        : `Dummy action: ${title(c.dummyAttack)}`,
      106,
      412,
      () => {
        if (c.creature) {
          c.targetMotion = this.cycle(["still", "live"] as const, c.targetMotion ?? "still");
          return;
        }
        c.dummyAttack = this.cycle(
          ["still", "magic", "physical", "charge"],
          c.dummyAttack,
        );
      },
    );
    choose(
      "random",
      `Seed mode: ${c.randomSeed ? "New random seed on reset" : "Fixed / repeatable"}`,
      980,
      412,
      () => {
        c.randomSeed = !c.randomSeed;
      },
    );
    this.row(
      "aggression",
      "Aggression",
      c.aggression,
      0,
      1,
      0.05,
      "fraction",
      510,
      (n) => {
        c.aggression = n;
      },
      () => this.drawSetup(),
    );
    this.row(
      "distance",
      "Starting distance",
      c.distanceM,
      2,
      36,
      0.5,
      "m",
      610,
      (n) => {
        c.distanceM = n;
      },
      () => this.drawSetup(),
    );
    u.button(
      "lab-seed",
      `Seed: ${c.seed}`,
      106,
      720,
      780,
      70,
      () =>
        this.editNumber(
          "Fixed seed",
          c.seed,
          0,
          0xffffffff,
          (n) => {
            c.seed = Math.floor(n);
          },
          () => this.drawSetup(),
        ),
      { fontSize: 26 },
    );
    u.button(
      "lab-compose",
      c.playerSchool === "water" ? "Choose the four spell slots" : `Choose the ${c.playerSchool} bolt + 4`,
      980,
      720,
      780,
      70,
      () => {
        if (c.playerSchool !== "water") return this.drawBuilds();
        this.lab.config = structuredClone(c);
        this.compose();
      },
      { fontSize: 26 },
    );
    u.text(
      c.creature
        ? "Roster health and poise. Still targets hold position and facing for hits and defeat; live ones move, attack and drain as in a bout.\nCompetence, aggression and dummy action apply only to other target types. R resets; G revives."
        : rival
          ? "Rival plan: Undertow closes to Lash range after an opening, then backs off; Mirror tide holds range, budgets its ward and counter-casts.\nCompetence changes reactions and decisions, never health or damage. A plan changes tactics only."
          : "Fire and Air play their own spellbooks (B: builds, stats, spell ranks); Water composes three lines.\nCompetence changes reactions and decisions, never health or damage. Dummy action applies only to the dummy.",
      106,
      817,
      24,
      colours.muted,
      1650,
    );
    u.button("lab-config-back", "Back", 106, 940, 240, 64, () => this.close());
    choose(
      "difficulty",
      `Difficulty: ${title(c.difficulty ?? defaultDifficulty)}`,
      380,
      937,
      () => {
        c.difficulty = this.cycle(difficulties, c.difficulty ?? defaultDifficulty);
      },
      520,
    );
    u.button("lab-config-builds", "B  Builds", 920, 940, 400, 64, () => this.drawBuilds());
    u.button("lab-config-start", "Start / reset bout", 1340, 940, 420, 64, () =>
      this.start(c),
    );
    u.onBack = () => this.close();
    u.onKey = this.keys;
    u.end("lab-config-start");
  }
  /** Start a bout on the draft; an unplayable pick stays on screen with its reason instead of throwing. */
  private start(c: LabSetup) {
    try {
      validateLabConfig(c);
    } catch (e) {
      this.u.notice(String(e).replace(/^Error: /, ""));
      return;
    }
    this.reset(c);
  }
  /** Both sides' builds: school, archetype preset, stats incl. agility, and the bolt + 4 with a rank per row. The forecast duel
   * (you as the reference AI against this rival) runs on the draft whenever both sides are playable. */
  private drawBuilds() {
    const u = this.u;
    this.heading(
      "lab-builds",
      "Builds and spellbook",
      "Both sides: school, archetype preset, stats (rank 1-5) and the bolt + 4 with spell ranks 1-5. The forecast duel plays these picks.",
    );
    const set = (next: LabSetup) => {
      this.draft = next;
      this.drawBuilds();
    };
    const act = (id: string, label: string, x: number, y: number, w: number, f: () => void) =>
      u.button(
        id,
        label,
        x,
        y,
        w,
        64,
        () => {
          try {
            f();
          } catch (e) {
            u.notice(String(e).replace(/^Error: /, ""));
          }
        },
        { fontSize: 22 },
      );
    labSides.forEach((side, column) => this.buildColumn(side, column === 0 ? 106 : 980, act, set));
    const problems = labSides.flatMap((side) => sideProblems(this.draft, side));
    this.buildsForecastText = u.text("", 106, 868, 22, colours.text, 1650);
    if (problems.length) {
      this.buildsForecastText.text = "Forecast waits for playable picks on both sides.";
      this.buildsForecastText.tint = colours.muted;
    } else {
      this.forecast.want(this.tune, this.draft, this.compare.baseline);
      this.showForecast();
    }
    u.button("lab-builds-back", "Back to setup", 106, 940, 360, 64, () => this.drawSetup());
    this.pinButton("lab-builds-pin", 500, 940, 420, this.draft, sideBuild(this.draft, "player").plan ?? this.lab.tuningName, () => this.drawBuilds());
    u.button("lab-builds-start", "Start / reset bout", 1340, 940, 420, 64, () => this.start(this.draft));
    u.onBack = () => this.drawSetup();
    u.onKey = this.keys;
    u.end("lab-builds-start");
  }
  private buildColumn(
    side: LabSide,
    x: number,
    act: (id: string, label: string, x: number, y: number, w: number, f: () => void) => unknown,
    set: (next: LabSetup) => void,
  ) {
    const u = this.u,
      c = this.draft,
      school = sideSchool(c, side),
      build = sideBuild(c, side),
      id = (name: string) => `lab-build-${side}-${name}`,
      liveRival = c.opponent === "mage" && !c.creature,
      presetNames = presets.map((p) => p.name);
    u.text(
      side === "player" ? "You" : liveRival ? "Opponent (the Mage AI rival)" : "Opponent (forecast rival; the live target is not a mage)",
      x,
      226,
      24,
      colours.gold,
      780,
    );
    act(id("school"), `School: ${title(school)}`, x, 262, 380, () =>
      set(withSchool(c, side, this.cycle(pickSchools, school as PickSchool))),
    );
    // Fire/Air presets are the authored rival builds of the school; a Water side's preset is its composition.
    if (school === "water") {
      const comp = sideComposition(c, side);
      act(id("preset"), `Preset: ${comp.name}`, x + 400, 262, 380, () => {
        const next = this.cycle(presetNames, comp.name);
        if (side === "opponent") set(withRivalPreset(c, next));
        else set({ ...structuredClone(c), composition: structuredClone(presets.find((p) => p.name === next)!) });
      });
    } else {
      const options = presetOptions(c, side);
      act(id("preset"), `Preset: ${build.plan ?? "custom"}`, x + 400, 262, 380, () => {
        const at = options.findIndex((b) => b.id === build.plan);
        set(withPreset(c, side, options[(at + 1) % options.length]!.id));
      });
    }
    const ranks = sideRanks(c, side);
    statKeys.forEach((key, i) =>
      act(id(`stat-${key}`), `${title(key).slice(0, 3)} ${ranks[key]}`, x + i * 196, 342, 188, () =>
        set(withStat(c, side, key, (ranks[key] % rankChoices.length) + 1)),
      ),
    );
    rankRows(c, side).forEach((row) => {
      const y = 422 + row.slot * 72,
        label = row.slot === 0 ? `Bolt: ${row.label}` : `${row.slot}. ${row.label}`;
      act(id(`slot-${row.slot}`), label, x, y, 560, () => {
        if (row.slot === 0) return u.notice("The bolt slot is fixed: each school's own bolt.");
        if (school !== "water") return set(withSlot(c, side, row.slot, nextSlotSpell(c, side, row.slot)));
        if (side === "opponent") return set(withRivalPreset(c, this.cycle(presetNames, sideComposition(c, side).name)));
        this.lab.config = structuredClone(c);
        this.compose();
      });
      act(id(`rank-${row.slot}`), `Rank ${row.rank}`, x + 580, y, 200, () =>
        set(withSpellRank(c, side, row.slot, (row.rank % rankChoices.length) + 1)),
      );
    });
    const problems = sideProblems(c, side);
    u.text(
      problems.length
        ? problems.join(" ").slice(0, 220)
        : school === "water"
          ? "Water: one rank covers a line's four collar tiers. Lines compose on their own screen (you) or by preset (rival)."
          : build.plan
            ? `Plays the ${build.plan} archetype plan (its own bolt + 4).`
            : "Custom loadout: the school brain plays it (no archetype plan).",
      x,
      790,
      20,
      problems.length ? colours.danger : colours.muted,
      780,
    );
  }
  private row(
    id: string,
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    unit: string,
    y: number,
    apply: (v: number) => void,
    back: () => void,
  ) {
    const u = this.u;
    u.text(label, 120, y + 8, 25, colours.text, 450);

    u.slider(`lab-slider-${id}`, 606, y, 370, value, min, max, step, (n) => {
      apply(n);
      if (text) text.text = `${n} ${unit}`;
    });
    const b = u.button(`lab-number-${id}`, "", 1000, y, 260, 64, () =>
      this.editNumber(label, value, min, max, apply, back),
    );
    const text = u.text(
      `${value} ${unit}`,
      1042,
      y + 18,
      24,
      colours.gold,
      190,
      false,
      b.root,
    );
    // Read the current slider value when opening numeric entry after dragging.
    b.activate = () =>
      this.editNumber(
        label,
        u.buttons.find((b) => b.id === `lab-slider-${id}`)!.slider!.value,
        min,
        max,
        apply,
        back,
      );
  }
  private editNumber(
    label: string,
    value: number,
    min: number,
    max: number,
    apply: (v: number) => void,
    back: () => void,
  ) {
    this.game.pause(true);
    this.numeric = { label, text: String(value), min, max, apply, back };
    this.heading(
      "lab-number",
      label,
      `Type a number between ${min} and ${max}. Enter applies; Escape cancels.`,
    );
    this.text = this.u.text(
      this.numeric.text,
      160,
      330,
      64,
      colours.water,
      1500,
    );
    const commit = () => {
      const n = Number(this.numeric!.text);
      if (
        !this.numeric!.text.trim() ||
        !Number.isFinite(n) ||
        n < min ||
        n > max
      ) {
        this.u.notice(`Enter ${min}–${max}.`);
        return;
      }
      apply(n);
      this.numeric = undefined;
      back();
    };
    const cancel = () => {
      this.numeric = undefined;
      back();
    };
    this.u.button("lab-number-apply", "Apply", 106, 940, 330, 64, commit);
    this.u.button("lab-number-cancel", "Cancel", 470, 940, 330, 64, cancel);
    let replace = true;
    this.u.onKey = (e) => {
      if (e.code === "Enter") {
        commit();
        return true;
      }
      if (e.code === "Escape") {
        cancel();
        return true;
      }
      if (e.code === "Backspace") {
        this.numeric!.text = replace ? "" : this.numeric!.text.slice(0, -1);
        replace = false;
      } else if (/^[0-9.e+-]$/.test(e.key)) {
        this.numeric!.text = (replace ? "" : this.numeric!.text) + e.key;
        replace = false;
      } else return true;
      if (this.text) this.text.text = this.numeric!.text.slice(0, 32);
      return true;
    };
    this.u.onBack = cancel;
    this.u.end();
  }
  openTuning() {
    this.stopReplay();
    this.game.pause(true);
    this.drawTuning();
  }
  private setTuning(key: TuningKey, value: number) {
    // The stun and roll pairs move together under core's rule, the one validateTuning enforces.
    const next = coupleTuningField(this.tune, key, value);
    try {
      changeLabTuning(this.lab, next, "Custom");
      this.forecast.want(this.tune, this.lab.config, this.compare.baseline);
    } catch (e) {
      this.u.notice(String(e));
    }
  }
  private drawTuning() {
    const u = this.u;
    this.heading(
      "lab-tuning",
      `Live tuning / ${this.lab.tuningName}`,
      `Applies to future actions. Current casts and projectiles retain their launch settings. R resets the comparison. Values are authored 1x; pace multiplies them (you x${paceOf(this.lab.training.player)}, opponent x${paceOf(this.lab.training.dummy)}).`,
    );
    const pages = [...new Set(tuningFields.map((f) => f.group)), "Spells"];
    pages.forEach((page, i) =>
      u.button(
        `lab-tab-${page}`,
        page,
        106 + i * 210,
        224,
        198,
        64,
        () => {
          this.page = page;
          this.tuningSubpage = 0;
          this.drawTuning();
        },
        { kind: "tab", selected: this.page === page, fontSize: 23 },
      ),
    );
    const pageFields = tuningFields.filter((f) => f.group === this.page);
    if (this.page === "Spells") this.spellRows();
    else
      pageFields
        .slice(this.tuningSubpage * 6, (this.tuningSubpage + 1) * 6)
        .forEach((f, i) =>
          this.row(
            f.key,
            f.label,
            this.tune[f.key],
            f.min,
            f.max,
            f.step,
            f.unit,
            316 + i * 88,
            (n) => this.setTuning(f.key, n),
            () => this.drawTuning(),
          ),
        );
    if (pageFields.length > 6) {
      const count = Math.ceil(pageFields.length / 6);
      u.button("lab-hit-prev", "Previous", 120, 850, 300, 64, () => {
        this.tuningSubpage = (this.tuningSubpage + count - 1) % count;
        this.drawTuning();
      });
      u.text(
        `${this.page} ${this.tuningSubpage + 1} / ${count}`,
        464,
        868,
        26,
        colours.gold,
        320,
      );
      u.button("lab-hit-next", "Next", 900, 850, 360, 64, () => {
        this.tuningSubpage = (this.tuningSubpage + 1) % count;
        this.drawTuning();
      });
    }
    u.panel(1300, 310, 480, 606);
    tuningPresets.forEach((p, i) =>
      u.button(
        `lab-preset-${p}`,
        p,
        1320,
        326 + i * 70,
        440,
        64,
        () => {
          changeLabTuning(this.lab, makeTuning(p), p);
          this.drawTuning();
        },
        { selected: this.lab.tuningName === p, fontSize: 24 },
      ),
    );
    u.button("lab-export", "Export", 1320, 536, 140, 64, () => this.export(), {
      fontSize: 22,
    });
    u.button("lab-import", "Import", 1470, 536, 140, 64, () => this.openImport(), {
      fontSize: 22,
    });
    this.pinButton("lab-pin", 1620, 536, 140, this.lab.config, this.lab.tuningName, () => this.drawTuning());
    this.forecastPanel();
    u.button("lab-tuning-close", "Return to combat", 106, 940, 390, 64, () =>
      this.close(),
    );
    u.button(
      "lab-tuning-live",
      this.game.paused ? "P  Run while tuning" : "P  Freeze simulation",
      516,
      940,
      390,
      64,
      () => {
        this.game.pause(!this.game.paused);
        this.drawTuning();
      },
      { fontSize: 24 },
    );
    u.text(
      "Sliders: drag or Left / Right; click a value to type. Warnings keep their safe minimum.\nR reset   P freeze   . step   G refill   H damage   L setup   V replay",
      936,
      944,
      20,
      colours.muted,
      840,
    );
    u.onBack = () => this.close();
    u.onKey = this.keys;
    u.end();
  }
  /** Pins the tuning and this setup (both sides' builds) as the forecast's baseline, or unpins back to Current. */
  private pinButton(id: string, x: number, y: number, w: number, setup: LabSetup, name: string, redraw: () => void) {
    const pinned = this.compare.name !== undefined;
    this.u.button(
      id,
      pinned ? "Unpin" : w < 200 ? "Pin" : "Pin as baseline",
      x,
      y,
      w,
      64,
      () => {
        if (pinned) this.compare.unpin();
        else {
          const refused = this.compare.pin(this.tune, setup, name);
          if (refused) return this.u.notice(refused);
          this.u.notice(`Pinned ${name}: the forecast now compares against it.`);
        }
        redraw();
      },
      { fontSize: 22, selected: pinned },
    );
  }
  /** Compact census forecast: per-wave median vs band and changes vs the baseline (Current or the pin), plus Lab duel TTK
   * and damage per mana, and the knobs changed against that baseline. */
  private forecastPanel() {
    const u = this.u,
      cols = [1336, 1446, 1534, 1620, 1694];
    u.text(forecastHeading(this.compare.baselineName), 1336, 612, 22, colours.gold, 440);
    ["Wave", "Median", "Change", "Win", "Perfect"].forEach((h, i) =>
      u.text(h, cols[i]!, 642, 18, colours.muted, 110),
    );
    const cell = (x: number, y: number, size = 20) => u.text("", x, y, size, 0xffffff, 440);
    this.forecastTexts = {
      rows: tiro.waves.map((_, i) => cols.map((x) => cell(x, 668 + i * 27))),
      ttk: cell(1336, 780),
      dpm: cell(1336, 806),
      status: cell(1336, 840, 18),
      knobs: cell(1336, 890, 16),
    };
    u.text(forecastLabel, 1336, 866, 18, colours.muted, 440);
    this.forecast.want(this.tune, this.lab.config, this.compare.baseline);
    this.showForecast();
  }
  private showForecast() {
    const b = this.buildsForecastText;
    if (b && this.u.screen === "lab-builds") {
      const line = buildsForecastLine(this.forecast.view), r = this.forecast.view.result;
      return paint(b, this.compare.name !== undefined && r && this.forecast.view.status === "done" ? { ...line, text: `${line.text}   ${duelDeltaText(r, this.compare.baselineName)}` } : line);
    }
    const t = this.forecastTexts;
    if (!t || this.u.screen !== "lab-tuning") return;
    const v = forecastLines(this.forecast.view, this.compare.baselineName);
    t.rows.forEach((row, i) => row.forEach((cell, c) => paint(cell, v.rows[i]![c]!)));
    paint(t.ttk, v.ttk);
    paint(t.dpm, v.dpm);
    paint(t.status, v.status);
    paint(t.knobs, { text: changedKnobs(this.compare.tuning ?? makeTuning(), this.tune, 1), tone: "muted" });
  }
  private spellRows() {
    const u = this.u,
      actor = { ...this.lab.training.player, tier: this.spellTier },
      // Overrides are authored 1x values that pace then scales, so the editor reads the spell before the player's pace.
      s = spellFor({ ...actor, pace: undefined }, this.spellSlot, this.lab.training.state)!,
      paced = spellFor(actor, this.spellSlot, this.lab.training.state)!;
    u.button(
      "lab-spell-slot",
      `Spell slot ${this.spellSlot + 1}`,
      120,
      314,
      520,
      64,
      () => {
        this.spellSlot = (this.spellSlot + 1) % 4;
        this.drawTuning();
      },
    );
    u.button(
      "lab-spell-tier",
      `Tier ${this.spellTier}`,
      690,
      314,
      560,
      64,
      () => {
        this.spellTier = (this.spellTier % 4) + 1;
        this.drawTuning();
      },
    );
    u.text(s.name, 120, 400, 32, colours.water, 1120);
    const spec: SpellOverride = {
      castS: s.castS,
      cooldownS: s.cooldownS,
      speedMps: s.speedMps,
    };
    const fields: [
      keyof SpellOverride,
      string,
      number,
      number,
      number,
      string,
    ][] = [
      ["castS", "Cast time", 0, 3, 0.01, "s"],
      ["cooldownS", "Cooldown", 0, 60, 0.05, "s"],
      [
        "speedMps",
        "Projectile speed",
        s.kind === "projectile" ? 0.1 : 0,
        100,
        0.5,
        "m/s",
      ],
    ];
    fields.forEach(([key, label, min, max, step, unit], i) =>
      this.row(
        `spell-${key}`,
        label,
        spec[key],
        min,
        max,
        step,
        unit,
        460 + i * 96,
        (n) => {
          const next = structuredClone(this.tune);
          next.spells[s.id] = { ...spec, ...next.spells[s.id], [key]: n };
          try {
            changeLabTuning(this.lab, next, "Custom");
            this.forecast.want(this.tune, this.lab.config, this.compare.baseline);
          } catch (e) {
            u.notice(String(e));
          }
        },
        () => this.drawTuning(),
      ),
    );
    u.text(
      `Spell id: ${s.id}\nEffective warning at your pace: ${Math.max(paced.castS, paced.telegraphS).toFixed(2)} s. Overrides apply to this archetype on both sides.\nProjectile speed affects projectile spells; the other shapes have no travel speed.`,
      120,
      768,
      23,
      colours.muted,
      1110,
    );
  }
  private export() {
    const blob = new Blob([exportTuning(this.tune, this.lab.tuningName)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `mage-arena-${this.lab.tuningName.replace(/[^a-z0-9-]/gi, "-")}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.u.notice(
      "Tuning exported. Include the seed and setup in your feel report.",
    );
  }
  private openImport() {
    this.game.pause(true);
    this.importText = "";
    this.heading(
      "lab-import",
      "Import a tuning set",
      "Paste JSON with Ctrl+V or drop a .json file on the canvas. Enter validates and applies it.",
    );
    this.text = this.u.text(
      "Waiting for JSON…",
      120,
      280,
      24,
      colours.muted,
      1600,
    );
    const apply = () => {
      try {
        const set = importTuning(this.importText);
        changeLabTuning(this.lab, set.tuning, set.name);
        this.drawTuning();
      } catch (e) {
        this.u.notice(String(e));
      }
    };
    const back = () => this.drawTuning();
    this.u.button(
      "lab-import-apply",
      "Validate and apply",
      106,
      940,
      440,
      64,
      apply,
    );
    this.u.button("lab-import-cancel", "Cancel", 600, 940, 260, 64, back);
    this.u.onKey = (e) => {
      if (e.code === "Enter") apply();
      if (e.code === "Escape") back();
      return true;
    };
    this.u.onBack = back;
    this.u.end();
  }
  private showImportText() {
    if (this.text)
      this.text.text =
        this.importText.length > 64000
          ? "Too large: maximum 64 KB."
          : this.importText.slice(0, 1300);
  }
  close() {
    this.numeric = undefined;
    this.enter("live");
    this.game.hud();
    this.game.pause(false);
  }
  /** Replay the Lab's ring from its first frame; the live bout holds still underneath. */
  private beginReplay(next: LabModeState, pause: boolean) {
    const frames = this.ring;
    this.ring = [];
    this.state = next;
    this.game.pause(pause);
    this.replay = {
      frames,
      shown: structuredClone(frames[0]!),
      transport: new ReplayTransport(0, frames.length - 1, 0, (to) => this.show(to)),
    };
    this.replay.transport.playing = true;
    this.show(0);
    this.game.hud();
  }
  /** The shown state follows the ring frame at `position`, with the live events up to its tick. */
  private show(position: number) {
    const r = this.replay!,
      s = r.frames[position]!,
      start = r.frames[0]!.tick;
    Object.assign(r.shown, structuredClone(s));
    r.shown.events = this.lab.training.state.events.filter(
      (e) => e.tick >= start && e.tick <= s.tick,
    );
  }
  private endReplay(next: LabModeState, pause: boolean) {
    this.replay = undefined;
    this.state = next;
    this.game.pause(pause);
  }
  stopReplay() {
    if (!this.replay) return;
    const out = stopReplay(this.state);
    this.endReplay(out.next, out.pause);
  }
  frame(dt: number) {
    this.replay?.transport.advance(dt);
    if (this.u.screen === "arena" && this.metricsText && this.statusText) {
      const m = this.lab.metrics,
        n = m.incomingMagic;
      this.metricsText.text = `Hits ${m.landed}/${m.taken}   Absorb ${m.absorbs}/${n}   Perfect ${m.perfects}/${n}   Staggers dealt/taken ${m.staggersDealt}/${m.staggersReceived}   Cancels ${m.castInterrupts}   Flow breaks ${m.flowBreaks}   Damage/mana ${m.manaSpent ? (m.practiceDamage / m.manaSpent).toFixed(2) : "--"}   TTK ${m.timeToKillS === null ? "--" : m.timeToKillS.toFixed(2) + "s"}`;
      if (this.answersText) this.answersText.text = labAnswerLine(this.lab.ledger);
      const actors = this.lab.training,
        phase = actors.player.tags.includes("DEFEATED")
          ? "DEFEATED / G refill, R reset"
          : actors.dummy.tags.includes("DEFEATED")
            ? "TARGET DEFEATED / G refill, R reset"
            : this.game.paused
              ? "FROZEN / . one tick"
              : "LIVE";
      this.statusText.text = `${this.replayState ? `REPLAY ${seconds(this.replayState.tick).toFixed(1)}s / V returns live` : phase}  /  ${this.lab.tuningName}  /  seed ${this.lab.config.seed}  /  HP damage ${actors.state.lab!.damageEnabled ? "ON" : "OFF"}  /  ${seconds(actors.state.tick).toFixed(1)}s${m.mixed ? "  /  MIXED" : ""}`;
    }
    return this.replayState;
  }
  dispose() {
    this.forecast.dispose();
    this.lifetime.abort();
    this.ring = [];
  }
}
