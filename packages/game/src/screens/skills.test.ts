import { describe, expect, it, vi } from "vitest";
import type { GameShell } from "../game-shell.ts";
import type { SeasonView } from "../season-api.ts";

const sent: unknown[] = [];
let refuse = "";
vi.mock("../season-api.ts", () => ({
  seasonCommand: async (command: unknown) => {
    sent.push(command);
    if (refuse) throw new Error(refuse);
    return { season: { skills: { spells: [], teachers: [] } } };
  },
}));
vi.mock("../audio.ts", () => ({ gameAudio: { play: async () => {} } }));

const { act, hasBook, refusal, spellName, spellRow, teacherRow } = await import("./skills.ts");
type Row = Parameters<typeof spellRow>[0];
type Teacher = Parameters<typeof teacherRow>[0];
const spell = (over: Partial<Row>): Row => ({ key: "lash:1", tier: 1, rank: 1, cost: 22, known: true, own: true, ...over });
const teacher = (over: Partial<Teacher>): Teacher => ({ id: "brennic", name: "Brennic", school: "fire", signature: "fire-2", trust: 1, taught: false, problem: null, ...over });

describe("skill book screen model", () => {
  it("is reachable only while the season view carries a book", () => {
    const off = { season: {} } as SeasonView, on = { season: { skills: {} } } as SeasonView;
    expect(hasBook(off)).toBe(false);
    expect(hasBook(on)).toBe(true);
  });
  it("names spells by line and tier, the water bolt plainly", () => {
    expect(spellName("bolt:0")).toBe("Bolt");
    expect(spellName("lash:1")).toBe("Lash 1");
  });
  it("shows the next rank and its cost, and says when the points are short", () => {
    expect(spellRow(spell({}), 60)).toEqual({ label: "Lash 1  /  rank 1", subtitle: "Rank 2 for 22 points", disabled: false });
    expect(spellRow(spell({}), 5).subtitle).toBe("Rank 2 for 22 points  /  not enough yet");
  });
  it("shows a top rank as a disabled row with no cost", () => {
    expect(spellRow(spell({ rank: 5, cost: null }), 60)).toMatchObject({ subtitle: "Top rank", disabled: true });
  });
  it("shows an elder's trust, the director's refusal as the subtitle, and a learned lesson as done", () => {
    expect(teacherRow(teacher({ problem: "They do not trust you enough to teach you." }), 3)).toMatchObject({ trust: "Trust 1 of 3", subtitle: "They do not trust you enough to teach you.", disabled: false });
    expect(teacherRow(teacher({}), 3).subtitle).toBe("Take the lesson");
    expect(teacherRow(teacher({ taught: true }), 3)).toMatchObject({ subtitle: "Learned", disabled: true });
  });
  it("takes a refusal as its own text, never a stack", () => {
    expect(refusal(new Error("Not enough skill points."))).toBe("Not enough skill points.");
    expect(refusal("plain")).toBe("plain");
  });
});

describe("skill book actions", () => {
  function shell() {
    const shown: string[] = [];
    const s = { view: {}, run: async (f: () => Promise<void>) => f(), skills: (m = "") => void shown.push(m) } as unknown as GameShell;
    return { s, shown };
  }
  it("sends buy-rank and take-lesson through the season command path and redraws", async () => {
    sent.length = 0; refuse = "";
    const { s, shown } = shell();
    await act(s, { type: "buy-rank", key: "lash:1" });
    await act(s, { type: "take-lesson", teacher: "brennic" });
    expect(sent).toEqual([{ type: "buy-rank", key: "lash:1" }, { type: "take-lesson", teacher: "brennic" }]);
    expect(shown).toEqual(["", ""]);
  });
  it("shows a refusal on the screen instead of throwing", async () => {
    sent.length = 0; refuse = "Not enough skill points.";
    const { s, shown } = shell();
    await expect(act(s, { type: "buy-rank", key: "lash:1" })).resolves.toBeUndefined();
    expect(shown).toEqual(["Not enough skill points."]);
  });
});
