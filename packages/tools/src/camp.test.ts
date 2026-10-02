import { describe, expect, it } from "vitest";
import {
  actCamp,
  beginListening,
  campActions,
  campPlay,
  campView,
  createCampSession,
  createState,
  decision,
  listeningScene,
  moveCamp,
  passSlot,
  remainingCaps,
  safeFallback,
  settleCamp,
  stepListening,
  travelCost,
} from "@mage/core";
import { loadTables, plan } from "@mage/director";
const t = loadTables();
const start = () => createCampSession(t, 73);
const night = () => passSlot(passSlot(start()));
const settle = (s: ReturnType<typeof start>) =>
  settleCamp(t, s, [], (id) => safeFallback(t, s.camp, id));

describe("playable camp slots", () => {
  it("has exactly the eight authored places, six Games and six eves", () => {
    const v = campView(t, start());
    expect(v.places.map((p) => p.id)).toEqual([
      "yard",
      "cistern",
      "pit",
      "exchange",
      "commons",
      "door",
      "tent",
      "edge",
    ]);
    expect(v.calendar.filter((d) => d.games).map((d) => d.day)).toEqual([
      7, 14, 21, 28, 35, 42,
    ]);
    expect(v.calendar.filter((d) => d.eve).map((d) => d.day)).toEqual([
      6, 13, 20, 27, 34, 41,
    ]);
    expect(
      v.places.every(
        (p) => p.position.length === 2 && p.description.length > 20,
      ),
    ).toBe(true);
  });
  it("charges routes, refuses closed places and cannot mint travel time", () => {
    const original = start(),
      s = moveCamp(t, original, "yard");
    expect(travelCost("tent", "yard")).toBe(2);
    expect(s.budget).toBe(1);
    expect(original.budget).toBe(3);
    expect(() => moveCamp(t, original, "pit")).toThrow(/closed/);
    expect(() => moveCamp(t, s, "door")).toThrow(/time/);
    expect(travelCost("fake", "tent")).toBe(Infinity);
    expect(moveCamp(t, s, "yard").budget).toBe(1);
    expect(() => moveCamp(t, original, "__proto__")).toThrow();
  });
  it("trains in the right place, ends a slot and settles routines only at dawn", () => {
    const before = moveCamp(t, start(), "yard");
    const points = before.camp.characters.cassia.points.vigor;
    const s = actCamp(
      t,
      before,
      decision(t, before.camp, "cassia", "TRAIN", { stat: "vigor" }),
    );
    expect(s.slot).toBe("dusk");
    expect(s.camp.day).toBe(1);
    expect(s.camp.characters.cassia.points.vigor).toBe(points + 3);
    expect(s.camp.characters.nysa.points).toEqual(
      before.camp.characters.nysa.points,
    );
    expect(() =>
      actCamp(
        t,
        before,
        decision(t, before.camp, "cassia", "TRAIN", { stat: "focus" }),
      ),
    ).toThrow(/elsewhere/);
    expect(() =>
      actCamp(t, before, decision(t, before.camp, "nysa", "REST")),
    ).toThrow(/own/);
    const dawn = settle(passSlot(passSlot(s)));
    expect(dawn.camp.day).toBe(2);
    expect(dawn.slot).toBe("day");
    expect(dawn.camp.characters.nysa.points.focus).toBe(
      before.camp.characters.nysa.points.focus + 1,
    );
    expect(() => settle(dawn)).toThrow(/not ended/);
  });
  it("work and protection carry to dawn, including hunger and warnings", () => {
    let s = moveCamp(t, start(), "commons");
    const hunger = s.camp.characters.fenna.hunger;
    s = actCamp(
      t,
      s,
      decision(t, s.camp, "cassia", "PROTECT", { target: "fenna" }),
    );
    expect(s.camp.characters.cassia.gold).toBe(8);
    expect(s.camp.characters.fenna.hunger).toBe(hunger - 30);
    expect(s.camp.characters.fenna.warned).toBe(true);
    const dawn = settle(passSlot(passSlot(s)));
    expect(dawn.camp.characters.fenna.hunger).toBe(hunger - 30);
    expect(dawn.camp.characters.fenna.warned).toBe(true);
    let work = moveCamp(t, start(), "exchange");
    work = actCamp(t, work, decision(t, work.camp, "cassia", "WORK"));
    expect(work.camp.characters.cassia.gold).toBe(14);
    expect(work.camp.characters.cassia.fatigue).toBe(1);
    expect(work.carry.working).toContain("cassia");
  });
  it("presence gates conversation and retains a wait escape from exhausted travel", () => {
    let s = moveCamp(t, start(), "commons");
    expect(() =>
      actCamp(
        t,
        s,
        decision(t, s.camp, "cassia", "BEFRIEND", { target: "brennic" }),
      ),
    ).toThrow(/not here/);
    s = moveCamp(t, moveCamp(t, s, "yard"), "commons");
    expect(s.budget).toBe(0);
    expect(campActions(t, s)).toHaveLength(0);
    expect(passSlot(s).slot).toBe("dusk");
  });
  it("consumes the day's scarce cap before Director night choices", () => {
    const s = start();
    s.dayActs.push(
      decision(t, s.camp, "cassia", "REPORT", { target: "brennic" }),
    );
    expect(remainingCaps(t, s).rules.caps.REPORT).toBe(0);
    expect(t.rules.caps.REPORT).toBe(1);
  });
  it("keeps daytime fact IDs distinct and morning cards derived from visible facts", () => {
    let s = moveCamp(t, start(), "commons");
    s = actCamp(
      t,
      s,
      decision(t, s.camp, "cassia", "BEFRIEND", { target: "fenna" }),
    );
    s = actCamp(
      t,
      s,
      decision(t, s.camp, "cassia", "BEFRIEND", { target: "fenna" }),
    );
    expect(new Set(s.dayEvents.map((f) => f.id)).size).toBe(2);
    const dawn = settle(passSlot(s));
    expect(
      campView(t, dawn).board.filter(
        (b) => b.text.includes("Cassia") && b.text.includes("Fenna"),
      ),
    ).toHaveLength(2);
    expect(
      campView(t, dawn).board.every((b) =>
        dawn.camp.facts.some(
          (f) => f.id === b.factId && f.visibility !== "secret",
        ),
      ),
    ).toBe(true);
  });
  it("does not leak hidden NPC knowledge, relationships or rolls in the HTTP projection", () => {
    const s = start();
    s.camp.facts.push({
      id: "canary-secret",
      text: "HIDDEN CANARY",
      visibility: "secret",
    });
    s.camp.characters.nysa.knowledge.push("canary-secret");
    s.camp.board.push({ factId: "canary-secret", text: "HIDDEN CANARY" });
    s.lastResolution = {
      state: s.camp,
      rolls: [],
      events: [],
      trace: [
        { path: "trust/nysa>brennic", before: 0, after: 9, rule: "private" },
      ],
    };
    const projection = JSON.stringify(campView(t, s));
    expect(projection).not.toContain("HIDDEN CANARY");
    expect(projection).not.toContain("nysa>brennic");
    expect(projection).not.toContain('"knowledge"');
    expect(projection).not.toContain('"rolls"');
  });
  it("stocks block travel and listening, release at dawn, and the season ends once", () => {
    const s = night();
    s.camp.characters.cassia.stocks = true;
    expect(() => beginListening(s)).toThrow(/stocks/);
    expect(() => moveCamp(t, s, "edge")).toThrow(/stocks/);
    expect(settle(passSlot(s)).camp.characters.cassia.stocks).toBe(false);
    const final = createCampSession(t, 1, createState(t, 1, 42));
    const ended = settle(passSlot(passSlot(passSlot(final))));
    expect(ended.camp.ended).toBe(true);
    expect(ended.camp.day).toBe(42);
    expect(() => passSlot(ended)).toThrow(/ended/);
  });
});
describe("deterministic listening act", () => {
  it("requires night at the tent and protects the active act from other actions", () => {
    expect(() => beginListening(start())).toThrow();
    const s = beginListening(night());
    expect(() => passSlot(s)).toThrow(/underway/);
    expect(() => moveCamp(t, s, "edge")).toThrow(/underway/);
    expect(() => stepListening(s, { lane: 99, listening: true })).toThrow();
  });
  it("rewards a successful listening route with a real, held Knowing only once", () => {
    const run = () => {
      let s = beginListening(night());
      for (let i = 0; i < campPlay.listening.durationTicks; i++) {
        const scene = listeningScene(s.listening!);
        s = stepListening(s, {
          lane: scene.beacon,
          listening: scene.beacon !== scene.patrol || scene.warning,
        });
      }
      return s;
    };
    const a = run(),
      b = run();
    expect(a).toEqual(b);
    expect(a.listening?.clues).toBeGreaterThanOrEqual(3);
    expect(a.listening?.learned).toBe("K-nysa-bread");
    expect(
      a.camp.characters.cassia.knowledge.filter((id) => id === "K-nysa-bread"),
    ).toHaveLength(1);
    expect(stepListening(a, { lane: 0, listening: true })).toBe(a);
    expect(
      campView(t, a).board.some((b) => b.text.includes("southern tent")),
    ).toBe(false);
    expect(campView(t, a).journal.some((f) => f.id === "K-nysa-bread")).toBe(
      true,
    );
  });
  it("an idle or exposed player finishes without an invented Knowing", () => {
    let idle = beginListening(night()),
      exposed = beginListening(night());
    for (let i = 0; i < campPlay.listening.durationTicks; i++) {
      idle = stepListening(idle, { lane: 0, listening: false });
      exposed = stepListening(exposed, {
        lane: listeningScene(exposed.listening!).patrol,
        listening: true,
      });
    }
    expect(idle.listening?.learned).toBeNull();
    expect(idle.nightFinished).toBe(true);
    expect(exposed.listening!.alerts).toBeGreaterThan(0);
    expect(exposed.listening!.clues).toBeLessThan(3);
  });
  it("runs all six weeks offline without invalid state or duplicated facts", () => {
    let s = start();
    for (let day = 1; day <= 42; day++) {
      for (let slot = 0; slot < 3; slot++) s = passSlot(s);
      s = settleCamp(t, s, [], (id) => plan(t, s.camp, id, true));
      expect(s.camp.day).toBe(Math.min(day + 1, 42));
      expect(new Set(s.camp.facts.map((f) => f.id)).size).toBe(
        s.camp.facts.length,
      );
      expect(
        Object.values(s.camp.characters).every(
          (c) => c.gold >= 0 && c.hunger <= 100,
        ),
      ).toBe(true);
    }
    expect(s.history).toHaveLength(42);
    expect(s.camp.ended).toBe(true);
  });
});
