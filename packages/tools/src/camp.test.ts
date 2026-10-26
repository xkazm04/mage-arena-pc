import { describe, expect, it } from "vitest";
import {
  actCamp,
  beginListening,
  campActions,
  campPlay,
  present,
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

describe("playable camp hours", () => {
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
  it("travel is free, refuses closed places and cannot mint hours", () => {
    const original = start(),
      s = moveCamp(t, original, "yard");
    expect(travelCost("tent", "yard")).toBe(0);
    expect(s.hour).toBe(8);
    expect(original.hour).toBe(8);
    expect(() => moveCamp(t, original, "pit")).toThrow(/closed/);
    expect(moveCamp(t, s, "door").hour).toBe(8);
    expect(travelCost("fake", "tent")).toBe(Infinity);
    expect(moveCamp(t, s, "yard").hour).toBe(8);
    expect(() => moveCamp(t, original, "__proto__")).toThrow();
  });
  it("trains in the right place, spends two hours and settles routines only at dawn", () => {
    const before = moveCamp(t, start(), "yard");
    const points = before.camp.characters.cassia.points.vigor;
    const s = actCamp(
      t,
      before,
      decision(t, before.camp, "cassia", "TRAIN", { stat: "vigor" }),
    );
    expect(s.slot).toBe("day");
    expect(s.hour).toBe(10);
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
    const dawn = settle(passSlot(passSlot(passSlot(s))));
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
    const dawn = settle(passSlot(passSlot(passSlot(s))));
    expect(dawn.camp.characters.fenna.hunger).toBe(hunger - 30);
    expect(dawn.camp.characters.fenna.warned).toBe(true);
    let work = moveCamp(t, start(), "exchange");
    work = actCamp(t, work, decision(t, work.camp, "cassia", "WORK"));
    expect(work.camp.characters.cassia.gold).toBe(14);
    expect(work.camp.characters.cassia.fatigue).toBe(1);
    expect(work.carry.working).toContain("cassia");
  });
  it("presence gates conversation and free travel preserves activity time", () => {
    let s = moveCamp(t, start(), "commons");
    expect(() =>
      actCamp(
        t,
        s,
        decision(t, s.camp, "cassia", "BEFRIEND", { target: "brennic" }),
      ),
    ).toThrow(/not here/);
    s = moveCamp(t, moveCamp(t, s, "yard"), "commons");
    expect(s.hour).toBe(8);
    expect(campActions(t, s).length).toBeGreaterThan(0);
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
    const dawn = settle(passSlot(passSlot(passSlot(s))));
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

describe("camp view presence by place (D3 4.3)", () => {
  const slotIndex = (s: ReturnType<typeof start>) => ["day", "dusk", "night"].indexOf(s.slot);
  const schedules = campPlay.presence as Record<string, string[]>;
  it("the player's own place equals presence, and every place comes from present()", () => {
    for (const s of [start(), passSlot(start()), night()]) {
      const v = campView(t, s);
      expect(Object.keys(v.presenceByPlace)).toEqual(t.locations.map((p) => p.id));
      expect(v.presenceByPlace[s.location]).toEqual(v.presence);
      for (const p of t.locations)
        expect(v.presenceByPlace[p.id].map((c) => c.id)).toEqual(present(s, p.id));
    }
  });
  it("a character scheduled elsewhere this slot appears under that place", () => {
    const s = start();
    const elsewhere = Object.entries(schedules).find(
      ([id, plan]) => id !== s.camp.player && plan[slotIndex(s)] !== s.location && s.camp.characters[id]?.life === "Alive",
    )!;
    const [id, plan] = elsewhere;
    const here = campView(t, s).presenceByPlace[plan[slotIndex(s)]!];
    expect(here.map((c) => c.id)).toContain(id);
    const entry = here.find((c) => c.id === id)!;
    expect(entry).toEqual({
      id,
      name: s.camp.characters[id].name,
      school: s.camp.characters[id].school,
      trust: s.camp.trust[`${id}>${s.camp.player}`],
    });
    expect(campView(t, s).presence.map((c) => c.id)).not.toContain(id);
  });
  it("dead, stocked and player characters never appear", () => {
    const s = start();
    const all = (v: ReturnType<typeof campView>) => Object.values(v.presenceByPlace).flat().map((c) => c.id);
    const before = all(campView(t, s));
    expect(before).not.toContain(s.camp.player);
    const [a, b] = before.filter((id) => id !== s.camp.player);
    expect(a && b).toBeTruthy();
    s.camp.characters[a!].life = "Dead";
    s.camp.characters[b!].stocks = true;
    const after = all(campView(t, s));
    expect(after).not.toContain(a);
    expect(after).not.toContain(b);
    expect(after).not.toContain(s.camp.player);
  });
});
