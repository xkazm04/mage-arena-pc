import { describe, expect, it, vi } from "vitest";
import type { GameShell } from "../game-shell.ts";

vi.mock("../season-api.ts", () => ({ request: async () => ({}), seasonCommand: async () => ({}) }));
vi.mock("../audio.ts", () => ({ gameAudio: { play: async () => {} } }));

const { cards, pageWindow, perPage } = await import("./journal.ts");

/** A journal screen on a recording canvas: counts every display object the screen asks the canvas for. */
function shell(entries: number) {
  const made = { buttons: [] as { id: string; label: string; run: () => void; disabled: boolean }[], nodes: 0 };
  const count = () => () => void made.nodes++;
  const ui = new Proxy({} as Record<string, unknown>, {
    get: (_t, name: string) =>
      name === "button"
        ? (id: string, label: string, _x: number, _y: number, _w: number, _h: number, run: () => void, o?: { disabled?: boolean }) => {
            made.nodes++;
            made.buttons.push({ id, label, run, disabled: !!o?.disabled });
          }
        : name === "content" ? { addChild: count() } : count(),
  });
  const journal = Array.from({ length: entries }, (_, i) => ({ text: `Fact ${i}`, rumour: false, visibility: "private" }));
  const states: Record<string, { page: number; selected: number }> = { journal: { page: 0, selected: 0 } };
  const s = {
    ui, view: { journal, board: [] }, campHeader: count(), back: count(), footer: count(),
    nav: { state: (k: string) => states[k] },
    cards: () => {},
    castJournal: () => {},
  } as unknown as GameShell;
  const draw = () => {
    made.buttons.length = 0; made.nodes = 0;
    cards(s, "journal");
  };
  return { s, made, draw, st: states.journal! };
}

describe("journal virtualization (D3 4.4)", () => {
  it("builds the visible rows only: a 500-entry journal costs what a 3-entry one does", () => {
    const small = shell(3), big = shell(500);
    small.draw(); big.draw();
    const rows = (m: typeof big.made) => m.buttons.filter((b) => b.id.startsWith("card-"));
    expect(rows(big.made).length).toBeLessThanOrEqual(perPage);
    expect(rows(small.made).length).toBe(3);
    expect(big.made.nodes).toBeLessThanOrEqual(small.made.nodes + perPage);
    expect(big.made.nodes).toBeLessThan(60);
  });
  it("paging with Next reaches the last of 500 entries, one page at a time", () => {
    const { made, draw } = shell(500);
    draw();
    let turns = 0;
    for (let next = made.buttons.find((b) => b.id === "cards-next")!; !next.disabled; next = made.buttons.find((b) => b.id === "cards-next")!) {
      next.run();
      turns++;
      draw();
    }
    expect(turns).toBe(Math.ceil(500 / perPage) - 1);
    expect(made.buttons.map((b) => b.label)).toContain("Fact 499");
    expect(made.buttons.filter((b) => b.id.startsWith("card-")).length).toBe(500 % perPage || perPage);
  });
  it("a page past the end (the journal shrank) is drawn as the last page, not empty", () => {
    const { made, draw, st } = shell(10);
    st.page = 40;
    draw();
    expect(made.buttons.filter((b) => b.id.startsWith("card-")).length).toBeGreaterThan(0);
    expect(st.page).toBe(Math.ceil(10 / perPage) - 1);
  });
  it("pageWindow slices a page and clamps the page into range", () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    expect(pageWindow(items, 1, 4)).toEqual({ page: 1, from: 4, rows: [4, 5, 6, 7], pages: 3 });
    expect(pageWindow(items, 99, 4)).toMatchObject({ page: 2, rows: [8, 9] });
    expect(pageWindow([], 3, 4)).toEqual({ page: 0, from: 0, rows: [], pages: 1 });
  });
});
