import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createGames, presets, tiro } from "@mage/core/arena";
import {
  bodyPages,
  effectPages,
  preloadPolicy,
  ReadyGate,
  settleWithin,
  sigilClips,
  sigilPages,
} from "./arena-preload.ts";
import { bodyIdentity } from "./body-policy.ts";
import type { BodyManifest, Element } from "./animation-contract.ts";
import type { SigilManifest } from "./sigil-contract.ts";
import animation from "../data/animation.json" with { type: "json" };

const read = (p: string) =>
  JSON.parse(readFileSync(`assets/accepted/covenant/${p}`, "utf8"));
const entries = (read("manifest.json") as { entries: Record<string, unknown> })
  .entries;
const bodies = read("a14/packed/characters.json") as BodyManifest;
const sigils = read("a13/sigils.json") as SigilManifest;
const elements: Element[] = ["water", "fire", "earth", "air"];
const element = (id?: string) =>
  ((id &&
    animation.enemyElements[id as keyof typeof animation.enemyElements]) ??
    "water") as Element;

/** A fake loader: each key resolves after its own delay, or never. */
function fakeLoad(delays: Record<string, number | "never" | "fail">) {
  const resident = new Set<string>();
  const load = (key: string) =>
    new Promise<string | undefined>((resolve) => {
      const d = delays[key] ?? 0;
      if (d === "never") return;
      if (d === "fail") return resolve(key);
      setTimeout(() => {
        resident.add(key);
        resolve(undefined);
      }, d);
    });
  const ready = async (keys: string[]) =>
    (await Promise.all(keys.map(load))).filter((k): k is string => !!k);
  return { resident, ready };
}

afterEach(() => vi.useRealTimers());
describe("arena art plan", () => {
  it("names only delivered pages for every element and entity", () => {
    const keys = [
      ...sigilPages(sigils, sigilClips(elements)),
      ...bodyPages(bodies, Object.keys(bodies.entities)),
      ...effectPages(elements),
    ];
    expect(keys.length).toBeGreaterThan(60);
    for (const k of keys) expect(entries[k], k).toBeDefined();
  });
  it("covers each Tiro wave's bodies, death and corpse pages included", () => {
    for (let wave = 0; wave < tiro.waves.length; wave++) {
      const actors = createGames(1, presets[0]!, wave).state.actors;
      const pages = bodyPages(
        bodies,
        actors.map((a) => bodyIdentity(a)),
      );
      for (const a of actors) {
        const body = bodies.entities[bodyIdentity(a)]!;
        for (const state of ["death", "corpse", "idle", "hit"] as const)
          for (const clip of Object.values(body.clips[state] ?? {}))
            expect(pages).toContain(`a10.packed.${clip.page}`);
      }
      const els = actors.map((a) => element(a.enemy?.id));
      const sigilKeys = sigilPages(sigils, sigilClips(els));
      for (const e of new Set(els))
        for (const shape of ["ring", "cone", "line"])
          expect(sigilKeys).toContain(`a13.page.threat.${e}.${shape}`);
      expect(sigilKeys).toContain("a13.page.inscription.collar");
    }
  });
});
describe("ready gate", () => {
  it("stays closed through a delayed load and opens without a log", async () => {
    vi.useFakeTimers();
    const log = vi.fn(),
      gate = new ReadyGate(log, () => Date.now()),
      art = fakeLoad({ "a12.plate.moonlit": 2500, "a10.packed.cassia": 1500 });
    const opened = gate.open(
      art.ready(["a12.plate.moonlit", "a10.packed.cassia"]),
      9000,
    );
    expect(gate.loading).toBe(true);
    await vi.advanceTimersByTimeAsync(2000);
    expect(gate.loading).toBe(true);
    expect(art.resident.has("a12.plate.moonlit")).toBe(false);
    await vi.advanceTimersByTimeAsync(600);
    const report = await opened;
    expect(gate.loading).toBe(false);
    expect(art.resident.size).toBe(2);
    expect(report).toMatchObject({ timedOut: false, missing: [] });
    expect(report!.ms).toBe(2500);
    expect(log).not.toHaveBeenCalled();
  });
  it("opens at the data timeout with one line naming what never arrived", async () => {
    vi.useFakeTimers();
    const log = vi.fn(),
      gate = new ReadyGate(log, () => Date.now()),
      art = fakeLoad({ "a12.plate.moonlit": "never" });
    const opened = gate.open(
      art.ready(["a12.plate.moonlit", "a10.packed.cassia"]),
      preloadPolicy.timeoutS * 1000,
      () => ["a12.plate.moonlit"],
    );
    await vi.advanceTimersByTimeAsync(preloadPolicy.timeoutS * 1000 - 1);
    expect(gate.loading).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(await opened).toMatchObject({
      timedOut: true,
      missing: ["a12.plate.moonlit"],
    });
    expect(gate.loading).toBe(false);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]![0]).toMatch(
      /not ready after 9\.0 s.*a12\.plate\.moonlit/,
    );
    await vi.advanceTimersByTimeAsync(60_000);
    expect(log).toHaveBeenCalledTimes(1);
  });
  it("opens at once on a failed file, with one line", async () => {
    vi.useFakeTimers();
    const log = vi.fn(),
      gate = new ReadyGate(log, () => Date.now());
    const report = await gate.open(
      fakeLoad({ "a13.page.target": "fail" }).ready(["a13.page.target"]),
      9000,
    );
    expect(report).toMatchObject({
      timedOut: false,
      missing: ["a13.page.target"],
    });
    expect(log).toHaveBeenCalledTimes(1);
  });
  it("lets a newer bout supersede an older load", async () => {
    vi.useFakeTimers();
    const log = vi.fn(),
      gate = new ReadyGate(log, () => Date.now()),
      art = fakeLoad({ old: 5000, fresh: 100 });
    const first = gate.open(art.ready(["old"]), 9000);
    const second = gate.open(art.ready(["fresh"]), 9000);
    await vi.advanceTimersByTimeAsync(100);
    expect(await second).toMatchObject({ missing: [] });
    expect(gate.loading).toBe(false);
    await vi.advanceTimersByTimeAsync(9000);
    expect(await first).toBeUndefined();
    expect(gate.opened).toBe(1);
    expect(log).not.toHaveBeenCalled();
  });
  it("bounds the menu's first paint", async () => {
    vi.useFakeTimers();
    const log = vi.fn();
    const settled = settleWithin(
      new Promise(() => {}),
      3000,
      "Main menu art",
      log,
    );
    await vi.advanceTimersByTimeAsync(3000);
    await settled;
    expect(log).toHaveBeenCalledTimes(1);
  });
});
