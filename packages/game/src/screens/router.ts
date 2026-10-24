/**
 * The screen registry and navigation stack. Every screen the shell can return to is one row of
 * `screenSpecs`: whether it redraws on a season revision (`live`), whether it sits above the world
 * as a pause overlay (`overlay`), and how it is drawn again (`restore`). The stack records where the
 * player was when an overlay opened, so resume and back return there for any screen. Pure: no Pixi,
 * no server; the shell is reached through `ScreenHost`.
 */

/** The shell members the registry needs. GameShell satisfies it; tests pass a recording fake. */
export interface ScreenHost {
  arena?: {
    games?: { phase: string };
    pause(value: boolean): void;
    hud(): void;
  };
  updateListening?: () => void;
  menu(): void;
  camp(): void;
  visit(): void;
  calendar(): void;
  cards(kind: "board" | "journal"): void;
  castJournal(): void;
  trial(): void;
  listen(): void;
  training(page?: number): void;
  results(): void;
  readBout(): void;
  chapter(): void;
  pauseScreen(): void;
  settings(): void;
  audioSettings(): void;
  saves(message?: string): void;
}

/** Paging a screen keeps while the player steps away from it. */
export interface Paged {
  page: number;
}
export interface CardState extends Paged {
  selected: number;
}
/** The typed state slices; a screen without a row here keeps no state. */
export interface ScreenStates {
  board: CardState;
  journal: CardState;
  cast: Paged;
  visit: Paged;
  training: Paged;
}
const initialState: { [K in keyof ScreenStates]: () => ScreenStates[K] } = {
  board: () => ({ page: 0, selected: 0 }),
  journal: () => ({ page: 0, selected: 0 }),
  cast: () => ({ page: 0 }),
  visit: () => ({ page: 0 }),
  training: () => ({ page: 0 }),
};

export interface ScreenSpec {
  /** The id the screen passes to `ui.begin` (canvas.dataset.screen); smoke tours read it. */
  id: string;
  /** Redraws when the season revision changes under it. */
  live?: boolean;
  /** A pause overlay: opening it again does not re-pause, and resume closes it. */
  overlay?: boolean;
  /** Draws the screen again from its remembered state. */
  restore(host: ScreenHost, router: ScreenRouter): void;
  /** What a live screen does on a revision change, when it is not a full redraw. */
  refresh?(host: ScreenHost): void;
}

export const screenSpecs: readonly ScreenSpec[] = [
  { id: "menu", restore: (h) => h.menu() },
  { id: "camp", live: true, restore: (h) => h.camp() },
  { id: "visit", live: true, restore: (h) => h.visit() },
  { id: "calendar", live: true, restore: (h) => h.calendar() },
  { id: "board", live: true, restore: (h) => h.cards("board") },
  { id: "journal", live: true, restore: (h) => h.cards("journal") },
  { id: "cast", restore: (h) => h.castJournal() },
  { id: "trial", live: true, restore: (h) => h.trial() },
  {
    id: "listen",
    live: true,
    restore: (h) => h.listen(),
    refresh: (h) => h.updateListening?.(),
  },
  { id: "chapter", restore: (h) => h.chapter() },
  {
    id: "training",
    restore: (h, r) => h.training(r.state("training").page),
  },
  {
    id: "arena",
    restore: (h) => {
      const a = h.arena;
      if (!a) throw new Error("No arena to return to");
      // A season bout that finished under the pause shows its results instead of a dead HUD.
      if (a.games && a.games.phase !== "active") h.results();
      else {
        a.pause(false);
        a.hud();
      }
    },
  },
  { id: "results", restore: (h) => h.results() },
  { id: "bout-reader", restore: (h) => h.readBout() },
  { id: "pause", overlay: true, restore: (h) => h.pauseScreen() },
  { id: "settings", overlay: true, restore: (h) => h.settings() },
  { id: "audio-settings", overlay: true, restore: (h) => h.audioSettings() },
  { id: "saves", overlay: true, restore: (h) => h.saves() },
];

export class ScreenRouter {
  private readonly specs = new Map<string, ScreenSpec>();
  private readonly states = new Map<string, unknown>();
  private stack: string[] = [];

  constructor(
    specs: readonly ScreenSpec[],
    private readonly host: ScreenHost,
  ) {
    for (const spec of specs) {
      if (this.specs.has(spec.id))
        throw new Error(`Screen "${spec.id}" is registered twice`);
      this.specs.set(spec.id, spec);
    }
  }
  private spec(id: string) {
    const spec = this.specs.get(id);
    if (!spec) throw new Error(`Screen "${id}" is not registered`);
    return spec;
  }
  has(id: string) {
    return this.specs.has(id);
  }
  isLive(id: string) {
    return !!this.specs.get(id)?.live;
  }
  isOverlay(id: string) {
    return !!this.specs.get(id)?.overlay;
  }
  liveScreens() {
    return [...this.specs.values()].filter((s) => s.live).map((s) => s.id);
  }
  overlayScreens() {
    return [...this.specs.values()].filter((s) => s.overlay).map((s) => s.id);
  }
  /** The screen on top of the stack. */
  get top() {
    return this.stack.at(-1);
  }
  /** The screen's remembered state slice, created on first use. */
  state<K extends keyof ScreenStates>(id: K): ScreenStates[K] {
    let slice = this.states.get(id) as ScreenStates[K] | undefined;
    if (!slice) {
      slice = initialState[id]() as ScreenStates[K];
      this.states.set(id, slice);
    }
    return slice;
  }
  /** Forgets a screen's state, so it opens on its first page. */
  reset(id: keyof ScreenStates) {
    this.states.delete(id);
  }
  /** Marks `id`, already on screen, as the place the player is; the history starts over. */
  open(id: string) {
    this.spec(id);
    this.stack = [id];
  }
  /** Records `id` above the current screen without drawing it. */
  push(id: string) {
    this.spec(id);
    this.stack.push(id);
  }
  /** Pushes `id` and draws it. */
  go(id: string) {
    this.push(id);
    this.restore(id);
  }
  /** Closes the top screen and draws the one beneath it. */
  back() {
    if (this.stack.length > 1) this.stack.pop();
    const id = this.top;
    if (!id) throw new Error("No screen to go back to");
    this.restore(id);
    return id;
  }
  /** Closes every overlay and draws the screen the player paused from. */
  resume() {
    const id = this.stack[0];
    if (!id) throw new Error("No screen to resume");
    this.stack = [id];
    this.restore(id);
    return id;
  }
  /** A camp tab: the target opens fresh, on its first page. */
  switchTab(id: "camp" | "calendar" | "board" | "journal") {
    if (id === "board" || id === "journal") this.reset(id);
    this.open(id);
    this.restore(id);
  }
  restore(id: string) {
    this.spec(id).restore(this.host, this);
  }
  /** A season revision landed while `id` is on screen. */
  refresh(id: string) {
    const spec = this.spec(id);
    if (spec.refresh) spec.refresh(this.host);
    else spec.restore(this.host, this);
  }
}
