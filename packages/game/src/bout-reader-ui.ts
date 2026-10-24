import { BitmapText, Graphics } from "pixi.js";
import {
  applyBoutInput,
  positionOfTick,
  readBout,
  seekBout,
  type BoutCheckpoint,
  type BoutReading,
  type SeasonBout,
} from "@mage/core";
import { seconds, ticks, type LedgerEntry } from "@mage/core/arena";
import policy from "../data/bout-reader.json" with { type: "json" };
import { answerMark } from "./answers.ts";
import { ReplayTransport } from "./replay-transport.ts";
import { colours } from "./ui/kit.ts";
import type { CanvasUI } from "./ui/ui.ts";

/**
 * The results card's "Read the bout": the wave just fought, replayed from the client's own copy of the log it
 * flushed (the season bout it stepped), seekable to any graded threat. Reads only; the season bout is never written.
 */
export class BoutReader {
  readonly reading: BoutReading;
  readonly transport: ReplayTransport;
  at: SeasonBout;
  page = 0;
  private refresh: () => void = () => {};
  constructor(bout: SeasonBout, tape: readonly BoutCheckpoint[]) {
    this.reading = readBout(bout, policy.checkpointTicks, tape);
    const first = this.wave.entries[0];
    this.transport = new ReplayTransport(
      this.wave.first,
      this.wave.last,
      first ? positionOfTick(this.wave, first.tick) : this.wave.first,
      (to, from) => {
        // One entry forward keeps the same state object, so the scene animates instead of re-deriving.
        if (to === from + 1)
          applyBoutInput(this.at, this.reading.source.log[from]!);
        else this.at = seekBout(this.reading, to);
        this.refresh();
      },
    );
    this.at = seekBout(this.reading, this.position);
  }
  get wave() {
    return this.reading.wave;
  }
  get position() {
    return this.transport.position;
  }
  get playing() {
    return this.transport.playing;
  }
  set playing(on: boolean) {
    this.transport.playing = on;
  }
  get tick() {
    return this.at.games!.state.tick;
  }
  /** Entries graded on the shown tick. */
  get here(): LedgerEntry[] {
    return this.wave.entries.filter((e) => e.tick === this.tick);
  }
  get canTakeOver() {
    return this.at.games!.phase === "active";
  }
  seek(position: number) {
    this.transport.seek(position);
  }
  step(count: number) {
    this.transport.step(count);
  }
  frame(dt: number) {
    this.transport.advance(dt);
    this.refresh();
    return this.at.games!;
  }
  draw(u: CanvasUI, actions: { back: () => void; takeOver: () => void }) {
    const w = this.wave,
      per = policy.entriesPerPage,
      jump = ticks(policy.jumpS),
      pages = Math.max(1, Math.ceil(w.entries.length / per));
    this.page = Math.max(0, Math.min(pages - 1, this.page));
    u.begin("bout-reader");
    u.onBack = actions.back;
    u.text(
      `READ THE BOUT  /  BOUT ${w.wave + 1} OF 4`,
      96,
      58,
      24,
      colours.gold,
    );
    u.text("Your own inputs, replayed", 96, 94, 36, colours.text, 900, true);
    u.button("reader-back", "Back to results", 1484, 54, 340, 68, actions.back);
    u.panel(1404, 150, 420, 196);
    const time = u.text("", 1436, 170, 28, colours.text, 360),
      grade = u.text("", 1436, 218, 28, colours.gold, 360),
      vitals = u.text("", 1436, 284, 24, colours.muted, 360);
    u.panel(96, 690, 1728, 362);
    const span = Math.max(1, w.last - w.first),
      setSlider = u.slider(
        "reader-scrub",
        120,
        706,
        1680,
        this.position,
        w.first,
        w.first + span,
        1,
        (v) => {
          this.playing = false;
          this.seek(v);
        },
      );
    const marks = new Graphics();
    for (const e of w.entries) {
      const x =
        138 + ((positionOfTick(w, e.tick) - w.first) / span) * (1680 - 36);
      const m = answerMark(e);
      marks
        .rect(x - 2, 754, 4, 18)
        .fill(
          m.miss
            ? colours.danger
            : m.label === "UNCLASSIFIED"
              ? colours.muted
              : colours.water,
        );
    }
    u.content.addChild(marks);
    u.button(
      "reader-page-back",
      "<",
      120,
      790,
      64,
      96,
      () => this.turn(-1, u, actions),
      { disabled: this.page === 0 },
    );
    const shown = w.entries.slice(this.page * per, this.page * per + per);
    const entryButtons = shown.map((e, i) => {
      const m = answerMark(e);
      return {
        e,
        b: u.button(
          `reader-entry-${i}`,
          `${seconds(e.tick - w.startTick).toFixed(2)}s  ${m.label}`,
          196 + i * 258,
          790,
          244,
          96,
          () => {
            this.playing = false;
            this.seek(positionOfTick(w, e.tick));
          },
          {
            subtitle: m.family,
            fontSize: 24,
            tooltip: m.miss
              ? "A miss: seek here, then step back to see why."
              : "",
          },
        ),
      };
    });
    if (!w.entries.length)
      u.text(
        "No threat reached you in this bout.",
        196,
        820,
        28,
        colours.muted,
        1400,
      );
    u.button(
      "reader-page-next",
      ">",
      1744,
      790,
      64,
      96,
      () => this.turn(1, u, actions),
      { disabled: this.page >= pages - 1 },
    );
    u.button("reader-back-second", `-${policy.jumpS}s`, 120, 910, 140, 76, () =>
      this.step(-jump),
    );
    u.button(
      "reader-back-tick",
      "-1 tick",
      272,
      910,
      170,
      76,
      () => this.step(-1),
      { tooltip: "Comma steps back one tick." },
    );
    const play = u.button("reader-play", "Play", 454, 910, 170, 76, () =>
      this.transport.toggle(),
    );
    u.button(
      "reader-next-tick",
      "+1 tick",
      636,
      910,
      170,
      76,
      () => this.step(1),
      { tooltip: "Period steps forward one tick." },
    );
    u.button("reader-next-second", `+${policy.jumpS}s`, 818, 910, 140, 76, () =>
      this.step(jump),
    );
    u.text(
      "Take over plays on from this tick as practice. Nothing is sent, saved or paid.",
      990,
      910,
      24,
      colours.muted,
      420,
    );
    const take = u.button(
      "reader-take-over",
      "Take over",
      1424,
      910,
      384,
      76,
      actions.takeOver,
      {
        tooltip:
          "PRACTICE from this moment. The settled bout and its receipt stay as they are.",
      },
    );
    u.onKey = (e) => {
      if (e.code !== "Comma" && e.code !== "Period") return false;
      this.step((e.code === "Comma" ? -1 : 1) * (e.shiftKey ? jump : 1));
      return true;
    };
    const playLabel = play.root.children.find(
      (c): c is BitmapText => c instanceof BitmapText,
    );
    this.refresh = () => {
      if (u.screen !== "bout-reader") return;
      const g = this.at.games!,
        p = g.player;
      time.text = `${seconds(this.tick - w.startTick).toFixed(2)}s  /  tick ${this.tick}`;
      grade.text =
        this.here
          .map((e) => `${answerMark(e).label}  ${answerMark(e).family}`)
          .join("\n") ||
        (g.phase === "active"
          ? ""
          : g.phase === "lost"
            ? "The bout ends: missio"
            : "The bout ends: cleared");
      vitals.text = `Vitality ${Math.ceil(p.hp)}  /  Mana ${Math.floor(p.mana)}  /  Stamina ${Math.floor(p.stamina)}`;
      setSlider(this.position);
      for (const { e, b } of entryButtons) b.selected = e.tick === this.tick;
      if (playLabel) playLabel.text = this.playing ? "Pause" : "Play";
      take.disabled = !this.canTakeOver;
    };
    u.end("reader-take-over");
    this.refresh();
  }
  private turn(
    delta: number,
    u: CanvasUI,
    actions: { back: () => void; takeOver: () => void },
  ) {
    this.page += delta;
    this.draw(u, actions);
  }
}
