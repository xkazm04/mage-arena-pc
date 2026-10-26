import { gameAudio } from "./audio.ts";
import type { DailyClock } from "./ui/daily-clock.ts";
import type { BitmapText } from "pixi.js";
import { linkBout, type SeasonBout } from "@mage/core";
import type { CampCommand, SeasonCommand } from "@mage/director";
import type { Composition } from "@mage/core/arena";
import { ArenaGame } from "./arena-entry.ts";
import { request, seasonCommand, type SeasonView } from "./season-api.ts";
import { CanvasUI } from "./ui/ui.ts";
import { preloadSigils } from "./ui/artwork.ts";
import { preloadPolicy, settleWithin } from "./arena-preload.ts";
import { art } from "./art.ts";
import { installArtReview } from "./screens/art-review.ts";
import {
  back,
  campHeader,
  footer,
  scene,
  timeFooter,
} from "./screens/chrome.ts";
import { menu, pick } from "./screens/menu.ts";
import { camp, command, visit } from "./screens/camp.ts";
import { calendar } from "./screens/calendar.ts";
import { cards, castDetails, castJournal } from "./screens/journal.ts";
import { control, listen } from "./screens/listen.ts";
import { isNightChanged } from "./night-status.ts";
import { letterBoard, parley, speak, type Moment } from "./screens/parley.ts";
import { seasonAction, trial } from "./screens/trial.ts";
import { compose } from "./screens/compose.ts";
import { openLab, training } from "./screens/training.ts";
import { readBout, results } from "./screens/results.ts";
import { audioSettings, pauseScreen, settings } from "./screens/pause.ts";
import { load, openSaves, saves } from "./screens/saves.ts";
import { chapter } from "./screens/chapter.ts";
import { installSkillsKey, skills } from "./screens/skills.ts";
import { ScreenRouter, screenSpecs } from "./screens/router.ts";
import { controls, type ControlsState } from "./screens/controls.ts";
import { matches } from "./settings/bindings.ts";
import { settings as currentSettings } from "./settings/settings.ts";

/**
 * The shell owns the season session, the arena and the state shared between screens. Each screen
 * lives in its own module under `screens/`; the members below are the router the screens use to
 * reach one another, so a screen can be redesigned without touching the others.
 */
export class GameShell {
  readonly ui = new CanvasUI();
  view!: SeasonView;
  arena?: ArenaGame;
  busy = false;
  private pollBusy = false;
  private poll?: number;
  private readonly lifetime = new AbortController();
  /** The screen registry and navigation stack: live and overlay screens, back, resume. */
  readonly nav: ScreenRouter = new ScreenRouter(screenSpecs, this);
  selected = "tent";
  held = false;
  lane = 0;
  updateListening?: () => void;
  parleyText = "";
  parleyApproach = 0;
  audioPreview = 0;
  typing = false;
  textDisplay?: BitmapText;
  currentMoment?: Moment;
  private disposed = false;
  dailyDial?: DailyClock;
  shownHours?: number;
  clockDay = 0;

  // Shared chrome.
  scene = (id: string, title: string, kicker: string, kind?: string) =>
    scene(this, id, title, kicker, kind);
  back = (action: () => void, label?: string) => back(this, action, label);
  footer = (text?: string) => footer(this, text);
  campHeader = (id: string, title: string) => campHeader(this, id, title);
  timeFooter = () => timeFooter(this);
  // Screens.
  menu = () => menu(this);
  pick = () => pick(this);
  camp = () => camp(this);
  visit = () => visit(this);
  calendar = () => calendar(this);
  cards = (kind: "board" | "journal") => cards(this, kind);
  castJournal = () => castJournal(this);
  castDetails = (id: string) => castDetails(this, id);
  listen = () => listen(this);
  parley = (moment: Moment) => parley(this, moment);
  letterBoard = () => letterBoard(this);
  trial = () => trial(this);
  compose = (destination: string, initial?: Composition) =>
    compose(this, destination, initial);
  training = (page?: number) => training(this, page);
  results = () => results(this);
  readBout = () => readBout(this);
  pauseScreen = () => pauseScreen(this);
  settings = () => settings(this);
  audioSettings = () => audioSettings(this);
  controls = (state?: ControlsState, focus?: string) =>
    controls(this, state, focus);
  saves = (message?: string) => saves(this, message);
  chapter = () => chapter(this);
  skills = (message?: string) => skills(this, message);
  // Actions that talk to the season server.
  control = () => control(this);
  speak = (input: Parameters<typeof speak>[1]) => speak(this, input);
  command = (c: CampCommand) => command(this, c);
  seasonAction = (c: SeasonCommand, after: () => void) =>
    seasonAction(this, c, after);
  openLab = () => openLab(this);
  openSaves = (from: string) => openSaves(this, from);
  load = (previous: boolean) => load(this, previous);

  async init(host: HTMLElement) {
    await this.ui.init(host);
    // The menu's first paint carries its backdrop, portrait and inscription; bounded like the arena gate.
    await settleWithin(
      Promise.all([
        art.preload(["place.door", "portrait.cassia.neutral"]),
        preloadSigils(["inscription.collar"]),
      ]),
      preloadPolicy.timeoutS * 1000,
      "Main menu art",
    );
    if (new URLSearchParams(location.search).has("harness"))
      installArtReview(this);
    this.view = await request<SeasonView>("session");
    this.ui.onFrame = (dt, now) => {
      this.arena?.frame(dt);
      if (this.dailyDial) {
        const target = this.view.hoursRemaining;
        this.shownHours =
          localStorage.getItem("mage-motion") === "reduced"
            ? target
            : (this.shownHours ?? target) +
              (target - (this.shownHours ?? target)) * Math.min(1, dt * 5);
        if (Math.abs(this.shownHours - target) < 0.005)
          this.shownHours = target;
        this.dailyDial.draw(
          this.shownHours,
          now,
          this.view.hour,
          this.view.slot,
        );
      }
    };
    this.ui.onGamepad = (pad) => this.arena?.input.updateGamepad(pad);
    this.ui.onGamepadLost = () => {
      if (this.arena && !this.arena.paused) void this.pause();
    };
    const signal = this.lifetime.signal;
    installSkillsKey(this, signal);
    window.addEventListener(
      "keyup",
      (e) => {
        if (matches(currentSettings().bindings.listenHold, e.code) && this.held) {
          this.held = false;
          void this.control();
        }
      },
      { signal },
    );
    window.addEventListener(
      "blur",
      () => {
        if (this.held) {
          this.held = false;
          void this.control();
        }
        if (this.arena && !this.arena.paused) void this.pause();
      },
      { signal },
    );
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden && this.arena && !this.arena.paused)
          void this.pause();
      },
      { signal },
    );
    this.poll = window.setInterval(() => void this.refresh(), 150);
    if (location.pathname === "/camp") await this.continue();
    else if (location.pathname === "/lab") this.openLab();
    else if (location.pathname === "/training") this.training();
    else {
      await request("pause", { paused: true });
      this.menu();
    }
    document.body.dataset.ready = "true";
  }
  private async refresh() {
    if (this.pollBusy || this.busy || this.disposed || this.arena) return;
    this.pollBusy = true;
    try {
      const next = await request<SeasonView>("session");
      if (this.disposed) return;
      if (this.busy || next.revision < this.view.revision) return;
      const changed =
        next.revision !== this.view.revision ||
        next.settling !== this.view.settling ||
        next.nightFinished !== this.view.nightFinished ||
        isNightChanged(this.view.night, next.night);
      this.view = next;
      if (changed && this.nav.isLive(this.ui.screen))
        this.nav.refresh(this.ui.screen);
    } catch {
      /* Keep the last scene during a transient disconnection. */
    } finally {
      this.pollBusy = false;
    }
  }
  async run(action: () => Promise<void>) {
    if (this.busy) return;
    this.busy = true;
    this.ui.busy = true;
    try {
      await action();
    } catch (e) {
      void gameAudio.play("ui.deny");
      this.ui.notice(e instanceof Error ? e.message : String(e));
    } finally {
      this.busy = false;
      this.ui.busy = false;
    }
  }
  async continue(restored = false) {
    this.view = await request<SeasonView>("session");
    await request("pause", { paused: restored });
    this.view = await request<SeasonView>("session");
    if (this.view.season.bout) {
      if (this.view.season.bout.phase === "prepared") {
        await request("pause", { paused: false });
        await seasonCommand({ type: "start" });
        await request("pause", { paused: restored });
      }
      const bout = linkBout(await request<SeasonBout>("bout"));
      this.arena?.dispose();
      this.arena = new ArenaGame(
        this.ui,
        () => void this.pause(),
        () => this.results(),
        {
          bout,
          send: (entries, hash) =>
            request("bout-input", { id: bout.id, entries, hash }),
          finish: async () => {
            await seasonCommand({ type: "receive" });
            this.arena?.dispose();
            this.arena = undefined;
            this.view = await request<SeasonView>("session");
            this.camp();
          },
        },
      );
      this.arena.pause(restored);
      this.arena.hud();
    } else {
      this.selected = this.view.location;
      if (this.view.listening && !this.view.nightFinished) this.listen();
      else this.camp();
    }
    history.replaceState(null, "", `/camp${location.search}`);
  }
  async pause() {
    if (this.nav.isOverlay(this.ui.screen)) return;
    // A screen the registry cannot redraw (a lab panel, a parley mid-sentence) resumes where it
    // always has: the arena HUD when an arena is open, otherwise the camp map.
    this.nav.open(
      this.nav.has(this.ui.screen)
        ? this.ui.screen
        : this.arena
          ? "arena"
          : "camp",
    );
    gameAudio.pauseWorld(true);
    this.arena?.pause(true);
    this.held = false;
    await this.control();
    await this.run(async () => {
      await this.arena?.flush();
      this.view = await request<SeasonView>("pause", { paused: true });
      this.nav.go("pause");
    });
  }
  async resume() {
    gameAudio.pauseWorld(false);
    await request("pause", { paused: false });
    this.view = await request<SeasonView>("session");
    // Back to the screen the player paused from: a finished practice bout's results stay results.
    this.nav.resume();
  }
  dispose() {
    this.disposed = true;
    clearInterval(this.poll);
    this.lifetime.abort();
    this.arena?.dispose();
    this.ui.dispose();
  }
}
