import {
  changeLabTuning,
  exportTuning,
  importTuning,
  labReplay,
  makeTuning,
  replenishLab,
  schools,
  seconds,
  spellFor,
  toggleLabDamage,
  tuningFields,
  tuningPresets,
  type ArenaState,
  type LabConfig,
  type TuningKey,
  type SpellOverride,
} from "@mage/core/arena";
import type { BitmapText } from "pixi.js";
import type { ArenaGame } from "./arena-entry.ts";
import { colours } from "./ui/kit.ts";
import type { CanvasUI } from "./ui/ui.ts";
import { sigil } from "./ui/artwork.ts";

const title = (s: string) => s[0]!.toUpperCase() + s.slice(1);
/** All interaction is drawn by the canvas kit. Clipboard/drop is data transport only. */
export class LabUI {
  private page = "Movement";
  private tuningSubpage = 0;
  private draft!: LabConfig;
  private numeric?: {
    text: string;
    label: string;
    min: number;
    max: number;
    apply: (n: number) => void;
    back: () => void;
  };
  private importing = false;
  private importText = "";
  private text?: BitmapText;
  private metricsText?: BitmapText;
  private statusText?: BitmapText;
  private readonly lifetime = new AbortController();
  private frames: ArenaState[] = [];
  replayState?: ArenaState;
  private replayPosition = 0;
  private replayWasPaused = false;
  private replayPaused = false;
  private spellSlot = 0;
  private spellTier = 1;
  constructor(
    private u: CanvasUI,
    private game: ArenaGame,
    private compose: () => void,
  ) {
    const signal = this.lifetime.signal;
    window.addEventListener(
      "paste",
      (e) => {
        if (!this.importing) return;
        e.preventDefault();
        this.importText = e.clipboardData?.getData("text/plain") ?? "";
        this.showImportText();
      },
      { signal },
    );
    u.app.canvas.addEventListener(
      "dragover",
      (e) => {
        if (this.importing) e.preventDefault();
      },
      { signal },
    );
    u.app.canvas.addEventListener(
      "drop",
      (e) => {
        if (!this.importing) return;
        e.preventDefault();
        const file = e.dataTransfer?.files[0];
        if (!file || file.size > 64000) {
          u.notice("Drop a tuning JSON file smaller than 64 KB.");
          return;
        }
        void file.text().then((text) => {
          if (!this.importing) return;
          this.importText = text;
          this.showImportText();
        });
      },
      { signal },
    );
  }
  private get lab() {
    return this.game.lab!;
  }
  private get tune() {
    return this.lab.training.state.tuning!;
  }
  private clear() {
    this.metricsText = undefined;
    this.statusText = undefined;
    this.text = undefined;
  }
  private heading(screen: string, name: string, subtitle: string) {
    this.clear();
    this.u.begin(screen);
    this.u.panel(72, 40, 1776, 996, "panel.modal");
    this.u.text("COMBAT FEEL LAB", 120, 76, 24, colours.gold);
    this.u.text(name, 106, 106, 46, colours.text, 1650, true);
    this.u.text(subtitle, 106, 165, 24, colours.muted, 1650);
    sigil(this.u, "inscription.wardstone", 1735, 120, 125, 0.7);
  }
  private keys = (e: KeyboardEvent) => {
    if (this.numeric || this.importing || e.repeat) return false;
    switch (e.code) {
      case "KeyR":
        this.reset();
        return true;
      case "KeyP":
        this.freeze();
        this.refreshPanel();
        return true;
      case "Period":
        this.step();
        this.refreshPanel();
        return true;
      case "KeyG":
        this.refill();
        return true;
      case "KeyH":
        this.damage();
        return true;
      case "KeyT":
        this.openTuning();
        return true;
      case "KeyL":
        this.openSetup();
        return true;
      case "KeyV":
        this.toggleReplay();
        return true;
      default:
        return false;
    }
  };
  private freeze() {
    if (this.replayState) this.replayPaused = !this.replayPaused;
    else this.game.pause(!this.game.paused);
  }
  private step() {
    if (this.replayState) {
      this.replayPaused = true;
      this.replayPosition = Math.min(
        this.frames.length - 1,
        this.replayPosition + 1,
      );
    } else {
      this.game.pause(true);
      this.game.stepLabOnce();
    }
  }
  private refill() {
    if (!this.replayState) replenishLab(this.lab);
  }
  private damage() {
    if (!this.replayState) toggleLabDamage(this.lab);
  }
  private refreshPanel() {
    if (this.u.screen === "lab-tuning") this.drawTuning();
  }
  installHUD() {
    this.clear();
    const u = this.u;
    u.panel(96, 168, 1728, 128);
    this.metricsText = u.text("", 132, 198, 24, colours.text, 1650);
    this.statusText = u.text("", 132, 240, 24, colours.gold, 1650);
    const actions: [string, string, () => void][] = [
      ["setup", "L  Setup", () => this.openSetup()],
      ["tuning", "T  Tune", () => this.openTuning()],
      ["reset", "R  Reset", () => this.reset()],
      ["freeze", "P  Freeze", () => this.freeze()],
      ["step", ".  Step", () => this.step()],
      ["refill", "G  Refill", () => this.refill()],
      ["damage", "H  Damage", () => this.damage()],
      ["replay", "V  Replay", () => this.toggleReplay()],
    ];
    actions.forEach(([id, label, action], i) =>
      u.button(`lab-${id}`, label, 96 + i * 218, 310, 202, 64, action, {
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
    this.game.hud();
  }
  openSetup() {
    this.stopReplay();
    this.game.pause(true);
    this.draft = structuredClone(this.lab.config);
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
    ) =>
      u.button(
        `lab-config-${id}`,
        label,
        x,
        y,
        780,
        70,
        () => {
          act();
          this.drawSetup();
        },
        { fontSize: 26 },
      );
    choose(
      "opponent",
      `Target: ${c.opponent === "dummy" ? "Dummy" : "Mage AI"}`,
      106,
      228,
      () => {
        c.opponent = this.cycle(["dummy", "mage"], c.opponent);
      },
    );
    choose(
      "player-school",
      `Your school: ${title(c.playerSchool)}`,
      980,
      228,
      () => {
        c.playerSchool = this.cycle(schools, c.playerSchool);
      },
    );
    choose(
      "school",
      `Opponent school: ${title(c.opponentSchool)}`,
      106,
      320,
      () => {
        c.opponentSchool = this.cycle(schools, c.opponentSchool);
      },
    );
    choose("competence", `Competence: ${c.competence} / 4`, 980, 320, () => {
      c.competence = (c.competence % 4) + 1;
    });
    choose("dummy", `Dummy action: ${title(c.dummyAttack)}`, 106, 412, () => {
      c.dummyAttack = this.cycle(
        ["still", "magic", "physical", "charge"],
        c.dummyAttack,
      );
    });
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
      "Choose the four spell slots",
      980,
      720,
      780,
      70,
      () => {
        this.lab.config = structuredClone(c);
        this.compose();
      },
      { fontSize: 26 },
    );
    u.text(
      "Fire / Earth / Air are distinct practice profiles over shared spell archetypes. Their unique season catalogues are pending.\nCompetence changes reactions and decisions, never health or damage. Dummy action applies only to the dummy.",
      106,
      817,
      24,
      colours.muted,
      1650,
    );
    u.button("lab-config-back", "Back", 106, 940, 240, 64, () => this.close());
    u.button("lab-config-start", "Start / reset bout", 1340, 940, 420, 64, () =>
      this.reset(c),
    );
    u.onBack = () => this.close();
    u.onKey = this.keys;
    u.end("lab-config-start");
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
    const next = structuredClone(this.tune);
    next[key] = value;
    if (key === "hitStunS")
      next.hitStunMaxS = Math.max(next.hitStunMaxS, value);
    if (key === "hitStunMaxS") next.hitStunS = Math.min(next.hitStunS, value);
    if (key === "rollDurationS")
      next.rollIFramesS = Math.min(next.rollIFramesS, value);
    if (key === "rollIFramesS")
      next.rollIFramesS = Math.min(value, next.rollDurationS);
    try {
      changeLabTuning(this.lab, next, "Custom");
    } catch (e) {
      this.u.notice(String(e));
    }
  }
  private drawTuning() {
    const u = this.u;
    this.heading(
      "lab-tuning",
      `Live tuning / ${this.lab.tuningName}`,
      "Applies to future actions. Current casts and projectiles retain their launch settings. R resets the comparison.",
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
        344 + i * 72,
        440,
        64,
        () => {
          changeLabTuning(this.lab, makeTuning(p), p);
          this.drawTuning();
        },
        { selected: this.lab.tuningName === p },
      ),
    );
    u.button(
      "lab-tuning-live",
      this.game.paused ? "P  Run while tuning" : "P  Freeze simulation",
      1320,
      576,
      440,
      64,
      () => {
        this.game.pause(!this.game.paused);
        this.drawTuning();
      },
      { fontSize: 24 },
    );
    u.button(
      "lab-export",
      "Export tuning JSON",
      1320,
      648,
      440,
      64,
      () => this.export(),
      { fontSize: 24 },
    );
    u.button(
      "lab-import",
      "Import tuning JSON",
      1320,
      720,
      440,
      64,
      () => this.openImport(),
      { fontSize: 24 },
    );
    u.text(
      "Sliders: drag or Left / Right.\nClick a value to type it.\nWarnings keep their safe minimum.",
      1340,
      786,
      24,
      colours.muted,
      400,
    );
    u.button("lab-tuning-close", "Return to combat", 106, 940, 390, 64, () =>
      this.close(),
    );
    u.text(
      "R reset   P freeze   . step   G refill   H damage   L setup   V replay",
      540,
      959,
      24,
      colours.muted,
      1220,
    );
    u.onBack = () => this.close();
    u.onKey = this.keys;
    u.end();
  }
  private spellRows() {
    const u = this.u,
      actor = { ...this.lab.training.player, tier: this.spellTier },
      s = spellFor(actor, this.spellSlot, this.lab.training.state)!;
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
          } catch (e) {
            u.notice(String(e));
          }
        },
        () => this.drawTuning(),
      ),
    );
    u.text(
      `Spell id: ${s.id}\nEffective warning: ${Math.max(s.castS, s.telegraphS).toFixed(2)} s. Overrides apply to this archetype on both sides.\nProjectile speed affects projectile spells; the other shapes have no travel speed.`,
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
    this.importing = true;
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
        this.importing = false;
        this.drawTuning();
      } catch (e) {
        this.u.notice(String(e));
      }
    };
    const back = () => {
      this.importing = false;
      this.drawTuning();
    };
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
    this.importing = false;
    this.game.hud();
    this.game.pause(false);
  }
  toggleReplay() {
    if (this.replayState) {
      this.stopReplay();
      return;
    }
    this.frames = labReplay(this.lab);
    if (this.frames.length < 2) {
      this.u.notice("Play a few moments before replaying.");
      return;
    }
    this.replayWasPaused = this.game.paused;
    this.game.pause(true);
    this.replayPosition = 0;
    this.replayPaused = false;
    this.replayState = structuredClone(this.frames[0]!);
    this.game.hud();
  }
  stopReplay() {
    if (!this.replayState) return;
    this.replayState = undefined;
    this.frames = [];
    this.game.pause(this.replayWasPaused);
  }
  frame(dt: number) {
    if (this.replayState) {
      this.replayPosition = Math.min(
        this.frames.length - 1,
        this.replayPosition + (this.replayPaused ? 0 : dt * 60),
      );
      const s = this.frames[Math.floor(this.replayPosition)]!;
      Object.assign(this.replayState, structuredClone(s));
      const start = this.frames[0]!.tick;
      this.replayState.events = this.lab.training.state.events.filter(
        (e) => e.tick >= start && e.tick <= s.tick,
      );
    }
    if (this.u.screen === "arena" && this.metricsText && this.statusText) {
      const m = this.lab.metrics,
        n = m.incomingMagic;
      this.metricsText.text = `Hits ${m.landed}/${m.taken}   Absorb ${m.absorbs}/${n}   Perfect ${m.perfects}/${n}   Staggers dealt/taken ${m.staggersDealt}/${m.staggersReceived}   Cancels ${m.castInterrupts}   Damage/mana ${m.manaSpent ? (m.practiceDamage / m.manaSpent).toFixed(2) : "--"}   TTK ${m.timeToKillS === null ? "--" : m.timeToKillS.toFixed(2) + "s"}`;
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
    this.lifetime.abort();
    this.frames = [];
  }
}
