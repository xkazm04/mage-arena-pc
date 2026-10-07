import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  addEnemy,
  addMage,
  createArena,
  defeatActor,
  enemyInputs,
  stateHash,
} from "@mage/core/arena";
import {
  bodyDrawSpec,
  frameIndex,
  type BodyManifest,
  type BodyState,
  type Direction,
} from "./animation-contract.ts";
import { mothContact, selectBodyClip } from "./body-policy.ts";
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const merged = read(
  "assets/accepted/covenant/a14/packed/characters.json",
) as BodyManifest;
const original = read(
  "assets/accepted/covenant/a10/packed/characters.json",
) as BodyManifest;
const delivered = read(
  "assets/accepted/covenant/a14/characters.json",
) as BodyManifest;
const extra = read("docs/waves/U6c-evidence/review-extra-manifest.json") as {
  rows: {
    entity: string;
    state: BodyState;
    direction: Direction;
    keys: number;
  }[];
};

describe("A14.3 extra motion", () => {
  it("fills exactly 46 real gaps, keeping authored key duration, loop, pivot and mirror", () => {
    let count = 0;
    for (const row of extra.rows)
      for (const d of [
        row.direction,
        row.direction === "ne" ? "nw" : "sw",
      ] as Direction[]) {
        const body = merged.entities[row.entity]!;
        const clip = selectBodyClip(body, row.state, d)!.clip;
        const source = delivered.entities[row.entity]!.clips[row.state]![d]!;
        expect(
          original.entities[row.entity]?.clips[row.state]?.[d],
        ).toBeUndefined();
        expect(clip.delivery).toBe("A14");
        expect(clip.frames.map((f) => f.durationMs)).toEqual(
          source.frames.map((f) => f.durationMs),
        );
        expect(clip.loop).toBe(row.state !== "cast");
        expect(clip.mirrorX).toBe(d.endsWith("w"));
        let elapsed = 0;
        for (const [i, frame] of clip.frames.entries()) {
          expect(frameIndex(clip, elapsed, true)).toBe(i);
          expect(
            frameIndex(clip, elapsed + frame.durationMs - 0.001, true),
          ).toBe(i);
          for (const height of [60.75, 81]) {
            const draw = bodyDrawSpec(body, clip, frame, height);
            expect(draw.height).toBeCloseTo(height * 2.4);
            expect(draw.anchor).toEqual(
              source.frames[i]!.anchor ??
                source.anchor ??
                delivered.entities[row.entity]!.anchor,
            );
          }
          elapsed += frame.durationMs;
        }
        expect(frameIndex(clip, elapsed * 3, true)).toBe(
          clip.loop ? 0 : clip.frameCount - 1,
        );
        count++;
      }
    expect(count).toBe(46);
  });
  it("presents the moth's existing mana contact, without changing simulation or showing an attack while interrupted", () => {
    const state = createArena(42),
      player = addMage(state, 0, { x: 15, y: 10 });
    const moth = addEnemy(state, "hush_moth", { x: 15.5, y: 10 });
    state.tick = 20;
    const before = player.mana;
    enemyInputs(state);
    expect(player.mana).toBeLessThan(before);
    expect(state.telegraphs).toHaveLength(0);
    const hash = stateHash(state);
    expect(mothContact(moth, state)).toBe(true);
    expect(stateHash(state)).toBe(hash);
    state.lab = { damageEnabled: true };
    expect(mothContact(moth, state)).toBe(false);
    delete state.lab;
    moth.staggerUntil = 21;
    expect(mothContact(moth, state)).toBe(false);
    moth.staggerUntil = 0;
    player.immuneUntil = 21;
    expect(mothContact(moth, state)).toBe(false);
    player.immuneUntil = 0;
    player.pos.x = 30;
    expect(mothContact(moth, state)).toBe(false);
    player.pos.x = 15;
    defeatActor(state, moth);
    expect(mothContact(moth, state)).toBe(false);
  });
});
