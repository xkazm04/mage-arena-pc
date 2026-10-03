import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { selectBodyClip } from "./body-policy.ts";
import {
  facingFromVector,
  type BodyState,
  type Body,
  type Direction,
} from "./animation-contract.ts";
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
  it("resolves all 90 missing requests inside the original entity, or explicitly returns no body", () => {
    let absent = 0,
      procedural = 0;
    const entities: Record<string, Body | undefined> = {
      ...bodies.entities,
      cinder_hound: undefined,
    };
    for (const [entity, body] of Object.entries(entities))
      for (const state of [
        "idle",
        "run",
        "cast",
        "absorb",
        "hit",
        "death",
      ] as BodyState[])
        for (const direction of ["ne", "se", "sw", "nw"] as Direction[]) {
          const selected = selectBodyClip(body, state, direction);
          if (!body?.clips[state]?.[direction]) absent++;
          if (!selected) {
            procedural++;
            expect(entity).toBe("cinder_hound");
          } else
            expect(body!.clips[selected.state]?.[selected.direction]).toBe(
              selected.clip,
            );
        }
    expect(absent).toBe(90);
    expect(procedural).toBe(24);
    expect(selectBodyClip(bodies.entities.iskar, "run", "se")?.state).toBe(
      "run",
    );
    const previous = selectBodyClip(bodies.entities.hush_moth, "run", "ne")!;
    const noDeath = structuredClone(bodies.entities.hush_moth!);
    noDeath.clips.death = {};
    const death = selectBodyClip(noDeath, "death", "se", previous)!;
    expect(death.held).toBe(true);
    expect(death.clip).toBe(previous.clip);
    expect(selectBodyClip(undefined, "idle", "se")).toBeUndefined();
  });
  it("preserves cardinal-axis facing and mirrors handedness exactly as delivered", () => {
    expect(facingFromVector(0, 0, "nw")).toBe("nw");
    expect(facingFromVector(1, 0, "nw")).toBe("ne");
    expect(facingFromVector(0, 1, "nw")).toBe("sw");
    const body = bodies.entities.cassia!;
    expect(body.designSize1080).toEqual([97.2, 97.2]);
    expect(body.designBodyHeight1080).toBe(40.5);
    expect(selectBodyClip(body, "run", "sw")?.clip.mirrorX).toBe(true);
    expect(selectBodyClip(body, "run", "se")?.clip.mirrorX).toBe(false);
    expect(selectBodyClip(body, "run", "sw")?.clip.frames).toEqual(
      selectBodyClip(body, "run", "se")?.clip.frames,
    );
  });
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
