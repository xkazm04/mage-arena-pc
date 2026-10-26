import { describe, expect, it } from "vitest";
import { ScreenRouter, screenSpecs, type ScreenHost } from "./router.ts";

/** A host that records which screen functions the router calls, in order. */
function fakeHost(arena?: ScreenHost["arena"]) {
  const calls: string[] = [];
  const record =
    (name: string) =>
    (...args: unknown[]) =>
      void calls.push(args.length ? `${name}(${args.join(",")})` : name);
  const host: ScreenHost = {
    arena,
    menu: record("menu"),
    camp: record("camp"),
    visit: record("visit"),
    calendar: record("calendar"),
    cards: record("cards"),
    castJournal: record("castJournal"),
    trial: record("trial"),
    listen: record("listen"),
    updateListening: record("updateListening"),
    training: record("training"),
    results: record("results"),
    readBout: record("readBout"),
    chapter: record("chapter"),
    pauseScreen: record("pauseScreen"),
    settings: record("settings"),
    audioSettings: record("audioSettings"),
    controls: record("controls"),
    saves: record("saves"),
    skills: record("skills"),
  };
  return { host, calls, nav: new ScreenRouter(screenSpecs, host) };
}

describe("screen router", () => {
  it("restores the results of a finished practice bout after a pause, not its HUD", () => {
    // Practice bouts carry no games state (arena-entry restart() clears it).
    const arena = {
      games: undefined,
      paused: [] as boolean[],
      huds: 0,
      pause(value: boolean) {
        this.paused.push(value);
      },
      hud() {
        this.huds++;
      },
    };
    const { nav, calls } = fakeHost(arena);
    nav.open("results");
    nav.go("pause");
    expect(nav.top).toBe("pause");
    expect(nav.resume()).toBe("results");
    expect(calls).toEqual(["pauseScreen", "results"]);
    expect(arena.huds).toBe(0);
    expect(arena.paused).toEqual([]);
  });

  it("walks back through nested overlays to the screen the player paused from", () => {
    const { nav, calls } = fakeHost();
    nav.open("camp");
    nav.push("pause");
    nav.push("settings");
    nav.push("audio-settings");
    expect(nav.back()).toBe("settings");
    expect(nav.back()).toBe("pause");
    expect(nav.back()).toBe("camp");
    expect(calls).toEqual(["settings", "pauseScreen", "camp"]);
  });

  it("sends the saves screen back to wherever it was opened from", () => {
    const fromMenu = fakeHost();
    fromMenu.nav.open("menu");
    fromMenu.nav.push("saves");
    fromMenu.nav.back();
    expect(fromMenu.calls).toEqual(["menu"]);
    const fromCamp = fakeHost();
    fromCamp.nav.open("camp");
    fromCamp.nav.push("pause");
    fromCamp.nav.push("saves");
    fromCamp.nav.back();
    expect(fromCamp.calls).toEqual(["pauseScreen"]);
  });

  it("derives the live and overlay screen sets from the registry", () => {
    const { nav } = fakeHost();
    expect(new Set(nav.liveScreens())).toEqual(
      new Set(["camp", "visit", "calendar", "board", "journal", "trial", "listen"]),
    );
    expect(new Set(nav.overlayScreens())).toEqual(
      new Set(["pause", "settings", "audio-settings", "saves", "controls"]),
    );
    expect(nav.isLive("cast")).toBe(false);
    expect(nav.isOverlay("results")).toBe(false);
  });

  it("registers the skill book as a plain screen on its own page, neither live nor an overlay", () => {
    const { nav, calls } = fakeHost();
    expect(nav.has("skills")).toBe(true);
    expect(nav.isLive("skills") || nav.isOverlay("skills")).toBe(false);
    nav.state("skills").page = 1;
    nav.open("camp");
    nav.go("skills");
    expect(calls).toEqual(["skills"]);
    expect(nav.state("skills").page).toBe(1);
  });

  it("restores training on the page the player left", () => {
    const { nav, calls } = fakeHost();
    nav.state("training").page = 1;
    nav.restore("training");
    expect(calls).toEqual(["training(1)"]);
  });

  it("keeps per-screen state across a pause and resets it on a tab switch", () => {
    const { nav, calls } = fakeHost();
    nav.state("board").page = 2;
    nav.state("journal").page = 3;
    nav.open("board");
    nav.push("pause");
    nav.back();
    expect(calls).toEqual(["cards(board)"]);
    expect(nav.state("board").page).toBe(2);
    nav.switchTab("board");
    expect(nav.state("board")).toEqual({ page: 0, selected: 0 });
    expect(nav.state("journal").page).toBe(3);
    expect(calls).toEqual(["cards(board)", "cards(board)"]);
  });

  it("refreshes live screens on a season revision, listen through its updater", () => {
    const { nav, calls } = fakeHost();
    nav.refresh("listen");
    nav.refresh("journal");
    expect(calls).toEqual(["updateListening", "cards(journal)"]);
  });

  it("rejects duplicate ids and unregistered screens instead of falling back to camp", () => {
    const { host } = fakeHost();
    const camp = screenSpecs.find((s) => s.id === "camp")!;
    expect(() => new ScreenRouter([camp, camp], host)).toThrow(/camp/);
    const { nav, calls } = fakeHost();
    expect(() => nav.restore("nowhere")).toThrow(/nowhere/);
    expect(() => nav.open("nowhere")).toThrow(/nowhere/);
    expect(calls).toEqual([]);
  });
});
