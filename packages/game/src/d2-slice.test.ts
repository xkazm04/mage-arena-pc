import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
import { arenaGeometry } from "@mage/core/arena";
import {
  cameraMetrics,
  contract,
  groundToScreen,
  makeCamera,
} from "./camera.ts";
import { normalMaps, pickLightingTier } from "./lighting/tier.ts";
import { pickQuality } from "./quality.ts";
import {
  SliceFixture,
  sliceBodyPx,
  sliceCamera,
  slicePresentation,
  sliceScene,
} from "./slice/slice-fixture.ts";
import {
  candidateSlot,
  pickSliceOptions,
  sliceFiles,
  slicePick,
  sliceRequested,
  sliceStatus,
  sliceUrl,
} from "./slice/slice-pick.ts";

interface Candidate {
  slot: string;
  scene?: string;
  palette?: string;
  rank: number;
}
const candidates = JSON.parse(
  readFileSync("art/delivery/d2s/candidates.json", "utf8"),
) as { bodies: Candidate[]; plates: Candidate[] };
const manifest = JSON.parse(
  readFileSync("packages/game/public/slice/d2s/manifest.json", "utf8"),
) as {
  pick: Record<string, string>;
  files: { source: string; target: string; sha256: string; bytes: number }[];
  totalBytes: number;
};
const sha = (path: string) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

describe("D2 slice pick (provisional, owner pick pending)", () => {
  it("defaults to the builder's rank-1 bodies and verdigris, marked provisional", () => {
    expect(sliceStatus).toBe(
      "provisional, Director default 2026-10-25, owner pick pending",
    );
    expect(slicePick).toEqual({
      water: "body-water-target",
      fire: "body-fire-covenant",
      plates: "verdigris",
    });
    for (const slot of ["water", "fire"] as const) {
      const pool = candidates.bodies.filter(
        (b) => b.slot === candidateSlot[slot],
      );
      expect(pool.find((b) => b.rank === 1)?.scene).toBe(slicePick[slot]);
    }
    expect(
      candidates.plates.find((p) => p.palette === slicePick.plates)?.slot,
    ).toBe(candidateSlot.plates);
  });
  it("serves exactly the picked files, byte for byte, inside the slice budget", () => {
    const files = sliceFiles();
    expect(manifest.pick).toEqual(slicePick);
    expect(manifest.files.map((f) => f.target)).toEqual(
      files.map((f) => f.target),
    );
    for (const f of manifest.files) {
      const served = `packages/game/public/${f.target}`;
      expect(sha(served)).toBe(sha(f.source));
      expect(sha(served)).toBe(f.sha256);
    }
    expect(readdirSync("packages/game/public/slice/d2s").toSorted()).toEqual(
      [
        "manifest.json",
        ...new Set(files.map((f) => f.target.split("/").at(-2)!)),
      ].toSorted(),
    );
    // Two bodies (colour, painted and derived normal) and one plate set: about 6.1 MB, nothing else.
    expect(manifest.totalBytes).toBeLessThan(6.5 * 1024 * 1024);
    expect(sliceUrl("water", "normalPainted")).toBe(
      "/slice/d2s/body-water-target/normal-painted.png",
    );
    expect(() => sliceFiles({ ...slicePick, fire: "../x" })).toThrow();
  });
});

describe("D2 slice reach: off by default", () => {
  it("opens only on ?slice=d2s (or artFixture('slice')); its options change nothing else", () => {
    expect(sliceRequested("")).toBe(false);
    expect(sliceRequested("?harness=1")).toBe(false);
    expect(sliceRequested("?slice=other")).toBe(false);
    expect(sliceRequested("?harness=1&slice=d2s")).toBe(true);
    expect(pickSliceOptions("")).toEqual({
      normals: "painted",
      grade: true,
      freezeS: undefined,
    });
    expect(
      pickSliceOptions("?sliceNormals=derived&sliceGrade=off&sliceAt=2.5"),
    ).toEqual({ normals: "derived", grade: false, freezeS: 2.5 });
  });
  it("leaves the arena camera, the lit-body tier, normal maps and quality as they were", () => {
    expect(contract.camera.elevation_above_ground_degrees).toBe(55);
    expect(contract.camera.zoom_range).toEqual([0.75, 0.75]);
    const arena = makeCamera(
      { width: 2560, height: 1440 },
      arenaGeometry.centre,
    );
    expect(arena.elevation).toBe(55);
    expect(arena.zoom).toBe(0.75);
    expect(cameraMetrics(arena).figureHeightPx).toBeCloseTo(81);
    expect(Object.keys(normalMaps)).toEqual(["cassia"]);
    expect(pickLightingTier("?slice=d2s")).toBe("lit");
    expect(pickQuality("?slice=d2s")).toEqual(pickQuality(""));
  });
});

describe("D2 slice scene composition", () => {
  const duel = arenaGeometry.centre,
    view = { width: 2560, height: 1440 };
  it("frames a close duel at 40 degrees with 190 px bodies at 1440p", () => {
    expect(slicePresentation.elevationDeg).toBe(40);
    expect(slicePresentation.elevationDeg).toBeGreaterThanOrEqual(35);
    expect(slicePresentation.elevationDeg).toBeLessThanOrEqual(45);
    // Inside 140-200 px whether the band is read at 1440p or at 1080p.
    expect(sliceBodyPx(1440)).toBe(190);
    expect(sliceBodyPx(1080)).toBe(142.5);
    const c = sliceCamera(view, duel, 0),
      m = cameraMetrics(c);
    expect(c.elevation).toBe(40);
    // True scale: the 1.8 m body is the 190 px.
    expect(m.pxPerMetreX * 1.8).toBeCloseTo(190);
    const at = groundToScreen(duel, c);
    expect(at.x).toBeCloseTo(1280);
    expect(at.y).toBeCloseTo(0.6 * 1440);
  });
  it("pins the bodies, plates, spells and lights", () => {
    expect(sliceScene).toEqual({
      bodies: ["water", "fire"],
      plates: ["floor", "wall", "rim"],
      telegraphs: ["threat.fire.cone"],
      procedural: { disc: 1, beam: 1 },
      lights: ["key", "flame", "meteor", "lightning"],
    });
    const f = new SliceFixture(duel, 0.6),
      c = sliceCamera(view, duel, f.timeS),
      inside = (p: { x: number; y: number }) => {
        const q = groundToScreen(p, c);
        return q.x > 0 && q.x < view.width && q.y > 0 && q.y < view.height;
      };
    expect(f.state.actors.map((a) => f.elements.get(a.id))).toEqual([
      "water",
      "fire",
      "air",
    ]);
    expect(inside(f.water.pos) && inside(f.fire.pos)).toBe(true);
    // The beam's caster has no body: it stands outside the frame.
    expect(inside(f.caster.pos)).toBe(false);
    expect(f.water.absorb).toBe(true);
    expect(f.state.telegraphs.map((t) => t.kind)).toEqual(["melee"]);
    expect(f.state.schoolEffects!.map((e) => e.kind).toSorted()).toEqual([
      "beam",
      "detonation",
    ]);
    expect(f.lights().map((l) => l.id)).toEqual([
      "flame",
      "meteor",
      "lightning",
    ]);
    // The flame lights only while it streams; the meteor's disc is gone once it lands and flashes.
    expect(f.lights()[0]!.intensity).toBe(0);
    const streaming = new SliceFixture(duel, 2.2);
    expect(streaming.state.telegraphs).toEqual([]);
    expect(streaming.lights()[0]!.intensity).toBeCloseTo(1);
    const landed = new SliceFixture(duel, 3.5);
    expect(landed.state.schoolEffects!.map((e) => e.kind)).toEqual(["beam"]);
    expect(landed.meteor().flash).toBeGreaterThan(0.8);
    // The slice's own state: no sim step, no RNG draw.
    expect(f.state.randomLog).toEqual([]);
  });
});
