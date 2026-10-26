import { describe, expect, it, vi } from "vitest";
import type { GameShell } from "../game-shell.ts";

vi.mock("../season-api.ts", () => ({ request: async () => ({}), seasonCommand: async () => ({}) }));
vi.mock("../audio.ts", () => ({ gameAudio: { play: async () => {} } }));
type Box = { x: number; y: number; w: number; h: number };
const drawn: { id: string; mood: string; x: number; y: number; w: number; h: number }[] = [];
vi.mock("../ui/artwork.ts", () => ({
  picture: () => undefined,
  portrait: (_ui: unknown, id: string, mood: string, x: number, y: number, w: number, h: number) =>
    void drawn.push({ id, mood, x, y, w, h }),
}));

const { camp } = await import("./camp.ts");

const ALL = ["yard", "cistern", "pit", "exchange", "commons", "door", "tent", "edge"];
const places = ["yard", "cistern", "commons"].map((id) => ({ id, name: id.toUpperCase(), description: `The ${id}.`, isOpen: true }));
const who = (id: string, trust: number) => ({ id, name: id, school: "Water", trust });

/** The nav row as campHeader lays it out (screens/chrome.ts): the camp screen reads its bottom edge from the buttons. */
const navButtons = [0, 1, 2, 3].map((i) => ({ id: `nav-${i}`, x: 96 + i * 300, y: 205, w: 280, h: 68 }));
/** A camp screen on a recording canvas: portraits, texts, buttons and panels are collected. */
function render(presenceByPlace: Record<string, ReturnType<typeof who>[]>, shown = places) {
  drawn.length = 0;
  const texts: { value: string; x: number; y: number; size: number }[] = [];
  const buttons: (Box & { id: string })[] = [...navButtons];
  const panels: (Box & { kind: string })[] = [];
  const ui = new Proxy({ buttons } as Record<string, unknown>, {
    get: (t, name: string) => {
      if (name === "content") return { addChild: () => {} };
      if (name === "buttons") return t.buttons;
      if (name === "text") return (value: string, x: number, y: number, size: number) => void texts.push({ value, x, y, size });
      if (name === "panel") return (x: number, y: number, w: number, h: number, kind = "panel") => void panels.push({ x, y, w, h, kind });
      if (name === "button") return (id: string, _l: string, x: number, y: number, w: number, h: number) => void buttons.push({ id, x, y, w, h });
      return () => undefined;
    },
  });
  const s = {
    ui,
    selected: "yard",
    view: { season: { complete: false }, places: shown, location: "yard", listening: false, nightFinished: false, player: { stocks: 0 }, presenceByPlace },
    campHeader: () => {},
    timeFooter: () => {},
    camp: () => {},
    nav: {},
  } as unknown as GameShell;
  camp(s);
  return { texts, buttons, panels };
}
const hit = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const crowd = (n: number) => Array.from({ length: n }, (_, i) => who(`p${i}`, 0));

describe("camp map presence chips (D3 4.3)", () => {
  it("draws one portrait chip per present character at its place, none for an empty place", () => {
    render({ yard: [who("nysa", 40), who("brennic", -40)], cistern: [who("fenna", 0)], commons: [] });
    expect(drawn.map((d) => d.id).sort()).toEqual(["brennic", "fenna", "nysa"]);
    const yard = drawn.filter((d) => d.id !== "fenna");
    expect(new Set(yard.map((d) => d.y)).size).toBe(1);
    expect(yard[0]!.x).not.toBe(yard[1]!.x);
    expect(drawn.find((d) => d.id === "nysa")!.mood).not.toBe(drawn.find((d) => d.id === "brennic")!.mood);
  });
  it("shows at most 3 chips and a +n marker for the rest", () => {
    const { texts } = render({ yard: ["a", "b", "c", "d", "e"].map((id) => who(id, 0)), cistern: [], commons: [] });
    expect(drawn.map((d) => d.id)).toEqual(["a", "b", "c"]);
    expect(texts.map((t) => t.value)).toContain("+2");
  });
});

describe("camp map presence chips polish (D3 4.3)", () => {
  const everyone = Object.fromEntries(ALL.map((id) => [id, crowd(5)]));
  const allPlaces = ALL.map((id) => ({ id, name: id.toUpperCase(), description: `The ${id}.`, isOpen: true }));
  const scene = () => {
    const r = render(everyone, allPlaces);
    const navBottom = Math.max(...navButtons.map((b) => b.y + b.h));
    const placeBtns = r.buttons.filter((b) => b.id.startsWith("place-"));
    const plates = r.panels.filter((p) => p.w < 200);
    const chips = drawn.map((d) => ({ x: d.x, y: d.y, w: d.w, h: d.h }));
    const markers = r.texts.filter((t) => t.value.startsWith("+"));
    return { r, navBottom, placeBtns, plates, chips, markers };
  };
  it("keeps every chip and +n marker at least 8px below the nav row", () => {
    const { navBottom, chips, markers, plates } = scene();
    expect(chips).toHaveLength(ALL.length * 3);
    for (const c of chips) expect(c.y).toBeGreaterThanOrEqual(navBottom + 8);
    expect(markers).toHaveLength(ALL.length);
    for (const m of markers) expect(m.y).toBeGreaterThanOrEqual(navBottom + 8);
    for (const p of plates) expect(p.y).toBeGreaterThanOrEqual(navBottom + 8);
  });
  it("overlaps no place button, no other chip or marker, and not the selected-place panel", () => {
    const { r, placeBtns, chips, plates } = scene();
    const panel = r.panels.find((p) => p.x === 96 && p.y === 806)!;
    const boxes = [...chips, ...plates];
    boxes.forEach((b, i) => {
      for (const btn of placeBtns) expect(hit(b, btn), `box ${i} vs ${btn.id}`).toBe(false);
      expect(hit(b, panel)).toBe(false);
      boxes.forEach((o, j) => {
        if (i !== j) expect(hit(b, o), `box ${i} vs box ${j}`).toBe(false);
      });
    });
  });
  it("draws the +n marker at 28px or more on a plate that holds it", () => {
    const { markers, plates } = scene();
    expect(plates).toHaveLength(markers.length);
    for (const m of markers) {
      expect(m.size).toBeGreaterThanOrEqual(28);
      expect(plates.some((p) => m.x >= p.x && m.x < p.x + p.w && m.y >= p.y && m.y < p.y + p.h)).toBe(true);
    }
  });
  it("moves the Cistern and Yard chips below or beside their buttons", () => {
    const { placeBtns } = scene();
    for (const id of ["yard", "cistern"]) {
      const btn = placeBtns.find((b) => b.id === `place-${id}`)!;
      const mine = drawn.filter((d) => d.id.startsWith("p")).filter((d) => d.x >= btn.x - 260 && d.x < btn.x + btn.w + 260 && Math.abs(d.y - btn.y) < 130);
      expect(mine.length).toBeGreaterThan(0);
      for (const c of mine) expect(c.y + c.h <= btn.y || c.y >= btn.y + btn.h || c.x + c.w <= btn.x || c.x >= btn.x + btn.w).toBe(true);
    }
    const yard = placeBtns.find((b) => b.id === "place-yard")!;
    const above = drawn.filter((d) => d.y + d.h <= yard.y && d.x >= yard.x && d.x < yard.x + yard.w);
    expect(above).toHaveLength(0);
  });
});
