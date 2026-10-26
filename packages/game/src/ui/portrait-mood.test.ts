import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { GameShell } from "../game-shell.ts";
import { moodForTrust } from "./portrait-mood.ts";

const shown: { id: string; mood: string }[] = [];
vi.mock("./artwork.ts", () => ({
  portrait: (_ui: unknown, id: string, mood: string) => void shown.push({ id, mood }),
  picture: () => undefined,
  sigil: () => ({ destroyed: false }),
}));
vi.mock("../season-api.ts", () => ({ request: async () => ({}), seasonCommand: async () => ({}) }));
vi.mock("../audio.ts", () => ({ gameAudio: { play: async () => {}, setScene: () => undefined } }));

const portraits = join(import.meta.dirname, "../../../../assets/accepted/covenant/a2c/portraits");

describe("moodForTrust bands (D3 4.3)", () => {
  it("undefined and the neutral band are neutral", () => {
    expect(moodForTrust(undefined)).toBe("neutral");
    for (const t of [0, 14, -14, 14.9, -14.9]) expect(moodForTrust(t)).toBe("neutral");
  });
  it("calm from 15 up to 39", () => {
    expect(moodForTrust(15)).toBe("calm");
    expect(moodForTrust(20)).toBe("calm");
    expect(moodForTrust(39)).toBe("calm");
  });
  it("proud from 40, to the 100 clamp and past it", () => {
    for (const t of [40, 99, 100, 250]) expect(moodForTrust(t)).toBe("proud");
  });
  it("scheming from -15 down to -39", () => {
    for (const t of [-15, -20, -39]) expect(moodForTrust(t)).toBe("scheming");
  });
  it("angry from -40, to the -100 clamp and past it", () => {
    for (const t of [-40, -99, -100, -250]) expect(moodForTrust(t)).toBe("angry");
  });
  it("every mood it can return is a painting for every character", () => {
    const moods = new Set([undefined, 0, 15, 40, -15, -40, 100, -100].map(moodForTrust));
    expect(moods.size).toBe(5);
    const ids = readdirSync(portraits, { withFileTypes: true }).filter((d) => d.isDirectory());
    expect(ids.length).toBeGreaterThan(0);
    for (const d of ids) for (const m of moods) expect(existsSync(join(portraits, d.name, `${m}.png`)), `${d.name}.${m}`).toBe(true);
  });
});

const ui = new Proxy({}, { get: () => () => undefined });
describe("sites pass the mapped mood", () => {
  it("visit() shows each person present with their trust's mood", async () => {
    shown.length = 0;
    const { visit } = await import("../screens/camp.ts");
    const presence = [
      { id: "garran", trust: 60 },
      { id: "senna", trust: -60 },
      { id: "lio", trust: undefined },
    ];
    const s = {
      ui,
      view: { places: [{ id: "yard", name: "Yard", description: "", isOpen: true }], location: "yard", presence, season: {}, hoursRemaining: 5, hour: 8 },
      campHeader: () => undefined,
      timeFooter: () => undefined,
      footer: () => undefined,
    } as unknown as GameShell;
    try { visit(s); } catch { /* the portraits are drawn before the action list */ }
    expect(shown).toEqual([
      { id: "garran", mood: "proud" },
      { id: "senna", mood: "angry" },
      { id: "lio", mood: "neutral" },
    ]);
  });
  it("the menu allies row shows each ally with their trust's mood", async () => {
    shown.length = 0;
    const { pick } = await import("../screens/menu.ts");
    const allies = [
      { id: "garran", name: "G", school: "earth", trust: 25 },
      { id: "senna", name: "S", school: "water", trust: -20 },
    ];
    const s = { ui, view: { season: { allies } }, scene: () => undefined, back: () => undefined, footer: () => undefined } as unknown as GameShell;
    try { pick(s); } catch { /* only the portrait calls matter */ }
    expect(shown).toEqual([
      { id: "garran", mood: "calm" },
      { id: "senna", mood: "scheming" },
    ]);
  });
  it("the parley approach looks the target up in the presence, else neutral", async () => {
    shown.length = 0;
    const { parley } = await import("../screens/parley.ts");
    const moment = (target: string) => ({ target, name: target, cards: [{ title: "t", knowing: "k" }] });
    const s = (presence: unknown[]) => ({ ui, view: { presence, hour: 8, hoursRemaining: 4, location: "yard" }, scene: () => undefined, back: () => undefined, footer: () => undefined }) as unknown as GameShell;
    try { parley(s([{ id: "garran", trust: 50 }]), moment("garran") as never); } catch { /* */ }
    try { parley(s([]), moment("senna") as never); } catch { /* */ }
    expect(shown.slice(0, 2)).toEqual([
      { id: "garran", mood: "proud" },
      { id: "senna", mood: "neutral" },
    ]);
  });
});
