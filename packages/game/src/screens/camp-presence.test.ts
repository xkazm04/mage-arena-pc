import { describe, expect, it, vi } from "vitest";
import type { GameShell } from "../game-shell.ts";

vi.mock("../season-api.ts", () => ({ request: async () => ({}), seasonCommand: async () => ({}) }));
vi.mock("../audio.ts", () => ({ gameAudio: { play: async () => {} } }));
const drawn: { id: string; mood: string; x: number; y: number }[] = [];
vi.mock("../ui/artwork.ts", () => ({
  picture: () => undefined,
  portrait: (_ui: unknown, id: string, mood: string, x: number, y: number) => void drawn.push({ id, mood, x, y }),
}));

const { camp } = await import("./camp.ts");

const places = ["yard", "cistern", "commons"].map((id) => ({ id, name: id.toUpperCase(), description: `The ${id}.`, isOpen: true }));
const who = (id: string, trust: number) => ({ id, name: id, school: "Water", trust });

/** A camp screen on a recording canvas: portraits and texts are collected. */
function render(presenceByPlace: Record<string, ReturnType<typeof who>[]>) {
  drawn.length = 0;
  const texts: string[] = [];
  const ui = new Proxy({} as Record<string, unknown>, {
    get: (_t, name: string) => {
      if (name === "content") return { addChild: () => {} };
      if (name === "text") return (t: string) => void texts.push(t);
      return () => undefined;
    },
  });
  const s = {
    ui,
    selected: "yard",
    view: { season: { complete: false }, places, location: "yard", listening: false, nightFinished: false, player: { stocks: 0 }, presenceByPlace },
    campHeader: () => {},
    timeFooter: () => {},
    camp: () => {},
    nav: {},
  } as unknown as GameShell;
  camp(s);
  return texts;
}

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
    const texts = render({ yard: ["a", "b", "c", "d", "e"].map((id) => who(id, 0)), cistern: [], commons: [] });
    expect(drawn.map((d) => d.id)).toEqual(["a", "b", "c"]);
    expect(texts).toContain("+2");
  });
});
