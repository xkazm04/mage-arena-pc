import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  frameIndex,
  validateClips,
  type EffectManifest,
  type BodyManifest,
} from "./animation-contract.ts";
const effects = JSON.parse(
  readFileSync("assets/accepted/covenant/a8/effects.json", "utf8"),
) as EffectManifest;
const bodies = JSON.parse(
  readFileSync("assets/accepted/covenant/a10/characters.json", "utf8"),
) as BodyManifest;
describe("delivered animation contract", () => {
  it("covers all four event families and keeps the exact delivered partial coverage", () => {
    validateClips(effects.pages, Object.values(effects.clips));
    for (const element of ["fire", "water", "earth", "air"])
      for (const event of ["cast", "travel", "impact", "hit", "aura"])
        expect(effects.clips[`${element}.${event}`]?.blend).toBe("lighter");
    expect(Object.keys(effects.clips)).toHaveLength(35);
    const clips = Object.values(bodies.entities).flatMap((b) =>
      Object.values(b.clips).flatMap((c) => Object.values(c)),
    );
    validateClips(bodies.pages, clips);
    expect(clips).toHaveLength(198);
    expect(bodies.backlog).toHaveLength(90);
    expect(bodies.entities.cinder_hound?.clips ?? {}).toEqual({});
  });
  it("ends effect one-shots, loops auras, holds action poses and rejects invalid time", () => {
    const shot = effects.clips["water.cast"]!;
    expect(frameIndex(shot, 0)).toBe(0);
    expect(frameIndex(shot, 65)).toBe(1);
    expect(frameIndex(shot, 390)).toBe(-1);
    expect(frameIndex(shot, 900, true)).toBe(5);
    expect(frameIndex(effects.clips["water.aura"]!, 1000)).toBe(0);
    expect(frameIndex(shot, NaN)).toBe(-1);
    expect(frameIndex(shot, -1)).toBe(-1);
  });
  it("rejects unsafe frame crops and timings", () => {
    for (const mutation of [
      { rect: [-1, 0, 256, 256] },
      { rect: [0, 0, 9999, 256] },
      { durationMs: 0 },
    ]) {
      const clip = structuredClone(effects.clips["fire.cast"]!);
      Object.assign(clip.frames[0]!, mutation);
      expect(() => validateClips(effects.pages, [clip])).toThrow(
        "Invalid animation frame",
      );
    }
  });
});
