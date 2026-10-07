import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  bodyDrawSpec,
  validateClips,
  type BodyManifest,
  type BodyState,
  type Direction,
} from "./animation-contract.ts";
import { selectBodyClip, corpseForDeath } from "./body-policy.ts";
const read = (p: string) =>
  JSON.parse(readFileSync(`assets/accepted/covenant/${p}`, "utf8"));
const merged = read("a14/packed/characters.json") as BodyManifest;
const original = read("a10/packed/characters.json") as BodyManifest;
const delivery = read("a14/characters.json") as BodyManifest;
const dirs: Direction[] = ["ne", "se", "sw", "nw"];
describe("U6c additive A14.3 loader", () => {
  it("keeps inherited locomotion and adds every delivered reaction slot through the same boundary", () => {
    let count = 0;
    for (const [id, b] of Object.entries(delivery.entities))
      for (const [state, directions] of Object.entries(b.clips))
        for (const direction of Object.keys(directions)) {
          const c =
            merged.entities[id]!.clips[state as BodyState]![
              direction as Direction
            ]!;
          expect(c.delivery).toBe("A14");
          validateClips(merged.pages, [c]);
          count++;
        }
    expect(count).toBe(226);
    for (const [id, b] of Object.entries(original.entities))
      for (const state of ["idle", "run", "cast", "absorb"] as BodyState[])
        for (const d of dirs)
          if (!delivery.entities[id]?.clips[state]?.[d])
            expect(merged.entities[id]!.clips[state]?.[d]).toEqual(
              b.clips[state]?.[d],
            );
  });
  it("matches body size across legacy and new v3 clips without applying the owner scale twice", () => {
    const b = merged.entities.cassia!;
    for (const state of [
      "idle",
      "hit-light",
      "hit-heavy",
      "death",
      "corpse",
    ] as BodyState[])
      for (const d of dirs) {
        const c = selectBodyClip(b, state, d)!.clip;
        for (const height of [60.75, 81]) {
          const spec = bodyDrawSpec(b, c, c.frames[0]!, height);
          expect(spec.height).toBeCloseTo(height * 2.4, 5);
          expect(spec.anchor).toEqual(
            c.frames[0]!.anchor ?? c.anchor ?? b.anchor,
          );
        }
      }
    const c = b.clips["hit-light"]!.se!;
    expect(
      bodyDrawSpec(b, c, { ...c.frames[0]!, anchor: [0.4, 0.8] }, 60.75).anchor,
    ).toEqual([0.4, 0.8]);
  });
  it("holds the delivered last death key as the persistent corpse, including left-facing mirror and anchor", () => {
    let corpses = 0;
    for (const b of Object.values(merged.entities))
      for (const d of dirs) {
        const c = b.clips.corpse?.[d];
        if (!c) continue;
        const death = b.clips.death![d]!;
        expect(c.page).toBe(death.page);
        expect(c.frames[0]!.rect).toEqual(death.frames.at(-1)!.rect);
        expect(c.frames[0]!.anchor ?? c.anchor).toEqual(
          death.frames.at(-1)!.anchor ?? death.anchor,
        );
        expect(c.mirrorX).toBe(death.mirrorX);
        expect(c.frameCount).toBe(1);
        expect(c.loop).toBe(false);
        expect(corpseForDeath(b, selectBodyClip(b, "death", d)!).clip).toBe(c);
        corpses++;
      }
    expect(corpses).toBe(44);
  });
  it("selects delivered reactions for every identity and holds only the twelve missing priority directions", () => {
    const missing: string[] = [];
    for (const [id, body] of Object.entries(delivery.entities))
      for (const state of [
        "hit-light",
        "hit-heavy",
        "death",
        "corpse",
      ] as BodyState[])
        for (const d of dirs) {
          const selected = selectBodyClip(merged.entities[id], state, d)!;
          expect(selected.clip.delivery).toBe("A14");
          expect(selected.clip.page).toContain(id);
          if (!body.clips[state]?.[d]) missing.push(`${id}:${state}:${d}`);
          else {
            expect(selected.clip.delivery).toBe("A14");
            expect(selected.direction).toBe(d);
          }
        }
    const queue = read("a14/session10/backlog.json");
    expect(missing.sort()).toEqual(queue.priority.sort());
    expect(missing).toHaveLength(12);
    for (const id of ["mire_maw", "thornback"])
      for (const d of ["ne", "nw"] as Direction[]) {
        const death = selectBodyClip(merged.entities[id], "death", d)!;
        const corpse = corpseForDeath(merged.entities[id], death);
        expect(death.direction).toBe(d === "ne" ? "se" : "sw");
        expect(corpse.state).toBe("corpse");
        expect(corpse.direction).toBe(death.direction);
        expect(corpse.clip.frames[0]!.rect).toEqual(
          death.clip.frames.at(-1)!.rect,
        );
      }
  });
  it("rejects malformed placement metadata at the loader boundary", () => {
    const c = merged.entities.cassia!.clips["hit-light"]!.se!;
    for (const patch of [
      { anchor: [2, 0] },
      { designBodyHeight1080: 0 },
      { designSize1080: [1, NaN] },
    ])
      expect(() =>
        validateClips(merged.pages, [Object.assign(structuredClone(c), patch)]),
      ).toThrow("Invalid clip placement");
    const broken = structuredClone(c);
    broken.frames[0]!.anchor = [NaN, 0];
    expect(() => validateClips(merged.pages, [broken])).toThrow(
      "Invalid frame anchor",
    );
  });
});
