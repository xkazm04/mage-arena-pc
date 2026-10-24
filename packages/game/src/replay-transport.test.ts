import { describe, expect, it } from "vitest";
import { combat } from "@mage/core/arena";
import { ReplayTransport } from "./replay-transport.ts";

describe("Replay transport (shared by the Lab ring and Read the bout)", () => {
  it("plays at the simulation rate and stops at the last frame", () => {
    const seen: number[] = [], t = new ReplayTransport(0, 119, 0, (to) => seen.push(to));
    t.playing = true;
    t.advance(0.5);
    expect(t.position).toBe(0.5 * combat.simStepHz);
    expect(seen).toHaveLength(30);
    t.advance(10);
    expect(t.position).toBe(119);
    expect(t.playing).toBe(false);
    t.advance(1);
    expect(t.position).toBe(119);
  });
  it("carries fractional frames between calls and holds still while paused", () => {
    const t = new ReplayTransport(0, 119, 0);
    t.playing = true;
    t.advance(0.5 / combat.simStepHz);
    expect(t.position).toBe(0);
    t.advance(0.5 / combat.simStepHz + 1e-9);
    expect(t.position).toBe(1);
    t.playing = false;
    t.advance(1);
    expect(t.position).toBe(1);
  });
  it("steps both ways, pausing, and clamps to the ring", () => {
    const moves: [number, number][] = [], t = new ReplayTransport(0, 119, 10, (to, from) => moves.push([from, to]));
    t.playing = true;
    t.step(-1);
    expect([t.position, t.playing]).toEqual([9, false]);
    t.step(-50);
    expect(t.position).toBe(0);
    t.step(500);
    expect(t.position).toBe(119);
    t.step(1);
    expect(moves).toEqual([[10, 9], [9, 0], [0, 119]]);
  });
  it("seeks to rounded positions and reports whether it moved", () => {
    const t = new ReplayTransport(5, 20, 5);
    expect(t.seek(7.6)).toBe(true);
    expect(t.position).toBe(8);
    expect(t.seek(8)).toBe(false);
  });
  it("toggle restarts from the first frame once played out", () => {
    const t = new ReplayTransport(0, 3, 3);
    t.toggle();
    expect([t.position, t.playing]).toEqual([0, true]);
    t.toggle();
    expect(t.playing).toBe(false);
  });
});
