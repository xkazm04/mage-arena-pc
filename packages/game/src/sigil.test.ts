import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
import { spells, runtime } from "@mage/core/arena";
import {
  coneUV,
  proceduralBox,
  proceduralDistance,
  proceduralFillCoord,
  proceduralShapeIds,
  type ProceduralShape,
  rankFill,
  threatFrame,
  type SigilManifest,
  type ThreatExtent,
} from "./sigil-contract.ts";
import { proceduralFragment } from "./sigil-shader.ts";
import { frameIndex, validateClips } from "./animation-contract.ts";
import policy from "../data/sigils.json" with { type: "json" };
const manifest = JSON.parse(
  readFileSync("assets/accepted/covenant/a13/sigils.json", "utf8"),
) as SigilManifest;
const footprints = JSON.parse(
  readFileSync("assets/accepted/covenant/a13/footprints.json", "utf8"),
) as {
  clips: Record<string, { sha256: string; frames: [number, number][][] }>;
};
function outside(poly: [number, number][], x: number, y: number) {
  return Math.max(
    ...poly.map((a, i) => {
      const b = poly[(i + 1) % poly.length]!;
      return (
        -((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0])) /
        Math.hypot(b[0] - a[0], b[1] - a[1])
      );
    }),
  );
}
describe("A13 painted geometry", () => {
  it("validates the complete delivery and finite one-shots", () => {
    validateClips(manifest.pages, Object.values(manifest.clips));
    expect(Object.keys(manifest.clips)).toHaveLength(44);
    for (const school of ["water", "fire", "earth", "air"])
      for (const phase of ["start", "hold", "release"])
        expect(manifest.clips[`cast.${school}.${phase}`]).toBeDefined();
    const release = manifest.clips["cast.water.release"]!;
    expect(
      frameIndex(
        release,
        release.frames.reduce((n, f) => n + f.durationMs, 0),
      ),
    ).toBe(-1);
  });
  it("keeps exact rank endpoints and monotonic charge independent of clip time", () => {
    for (let rank = 0; rank <= 255; rank++) {
      expect(rankFill(0, rank / 255)).toBe(0);
      expect(rankFill(1, rank / 255)).toBe(1);
      let previous = 0;
      for (let step = 0; step <= 100; step++) {
        const next = rankFill(step / 100, rank / 255);
        expect(next).toBeGreaterThanOrEqual(previous);
        previous = next;
      }
    }
  });
  it("covers authored spell radii, cones and enemy lane capsules with the measured pigment envelope", () => {
    const extents = (
      [
        ...spells
          .filter((s) => s.kind === "ring" || s.kind === "zone")
          .map((s) => ({
            shape: "ring" as const,
            range: s.kind === "ring" ? s.rangeM : s.radiusM,
          })),
        ...spells
          .filter((s) => s.kind === "cone")
          .map((s) => ({
            shape: "cone" as const,
            range: s.rangeM,
            degrees: s.arcDeg,
          })),
        {
          shape: "cone",
          range: runtime.games.defaultMeleeRangeM,
          degrees: runtime.games.meleeArcDeg,
        },
        {
          shape: "line",
          range: runtime.games.tongueRangeM,
          width: runtime.games.tongueWidthM,
        },
        { shape: "line", range: 10, width: 2 },
        ...[30, 90, 145].map((degrees) => ({
          shape: "cone" as const,
          range: 10,
          degrees,
        })),
      ] satisfies ThreatExtent[]
    ).filter((e) => e.range > 0);
    for (const [id, witness] of Object.entries(footprints.clips)) {
      const clip = manifest.clips[id]!,
        page = manifest.pages.find((p) => p.id === clip.page)!;
      expect(
        createHash("sha256")
          .update(
            readFileSync(
              "assets/accepted/covenant/" +
                page.file.replace("art/delivery/", ""),
            ),
          )
          .digest("hex"),
      ).toBe(witness.sha256);
      for (const extent of extents.filter((e) => e.shape === clip.shape)) {
        const [w, h] = threatFrame(clip, extent),
          points: [number, number][] = [];
        if (extent.shape === "line") {
          // Sweep both circular endcaps of the exact segmentHit capsule.
          for (let i = 0; i < 72; i++) {
            const a = (i * Math.PI) / 36;
            for (const end of [-extent.range / 2, extent.range / 2])
              points.push([
                end + (Math.cos(a) * extent.width!) / 2,
                (Math.sin(a) * extent.width!) / 2,
              ]);
          }
        } else {
          const degrees = extent.shape === "ring" ? 360 : extent.degrees!;
          for (let i = 0; i <= 72; i++) {
            const a = ((-degrees / 2 + (degrees * i) / 72) * Math.PI) / 180;
            points.push([
              Math.cos(a) * extent.range,
              Math.sin(a) * extent.range,
            ]);
          }
          if (extent.shape === "cone") points.push([0, 0]);
        }
        for (const [x, y] of points) {
          let u = x / w + (extent.shape === "line" ? 0.5 : clip.anchor[0]),
            v = y / h + clip.anchor[1];
          if (extent.shape === "cone") [u, v] = coneUV(u, v, extent.degrees!);
          const tolerance =
            policy.coverageToleranceTexels +
            ((policy.coverageToleranceFraction * Math.min(w, h)) /
              Math.max(w, h)) *
              384;
          for (const polygon of witness.frames)
            expect(
              outside(polygon, u * 384, v * 384),
              `${id} ${JSON.stringify(extent)} at ${x},${y}`,
            ).toBeLessThanOrEqual(tolerance);
        }
      }
    }
  });
});

describe("procedural sigil shapes (D2 4.4)", () => {
  const disc: ProceduralShape = { shape: "disc", radius: 3 },
    beam: ProceduralShape = { shape: "beam", length: 8, width: 1 },
    arc: ProceduralShape = {
      shape: "arc",
      radius: 4,
      thickness: 0.6,
      degrees: 60,
    };
  it("draws a filled circle of exactly the authored radius", () => {
    expect(proceduralDistance(disc, 0, 0)).toBeCloseTo(-3);
    expect(proceduralDistance(disc, 3, 0)).toBeCloseTo(0);
    expect(proceduralDistance(disc, 0, -3)).toBeCloseTo(0);
    expect(proceduralDistance(disc, 2.9, 0)).toBeLessThan(0);
    expect(proceduralDistance(disc, 2, 2.5)).toBeGreaterThan(0);
  });
  it("covers a beam from the caster out to its length and no further", () => {
    expect(proceduralDistance(beam, 4, 0)).toBeLessThan(0);
    expect(proceduralDistance(beam, 4, 0.49)).toBeLessThan(0);
    expect(proceduralDistance(beam, 4, 0.51)).toBeGreaterThan(0);
    expect(proceduralDistance(beam, -0.1, 0)).toBeGreaterThan(0);
    expect(proceduralDistance(beam, 8.1, 0)).toBeGreaterThan(0);
  });
  it("covers an arc band only inside its sweep", () => {
    const at = (deg: number, r: number) =>
      proceduralDistance(
        arc,
        r * Math.cos((deg * Math.PI) / 180),
        r * Math.sin((deg * Math.PI) / 180),
      );
    expect(at(0, 4)).toBeLessThan(0);
    expect(at(29, 4)).toBeLessThan(0);
    expect(at(-29, 4)).toBeLessThan(0);
    expect(at(31, 4)).toBeGreaterThan(0);
    expect(at(0, 3.6)).toBeGreaterThan(0);
    expect(at(0, 4.4)).toBeGreaterThan(0);
    expect(at(180, 4)).toBeGreaterThan(0);
  });
  it("keeps every covered point inside the quad the player draws", () => {
    const margin = policy.procedural.edgeFeatherM;
    for (const s of [disc, beam, arc]) {
      const [x0, y0, w, h] = proceduralBox(s, margin);
      for (let i = 0; i <= 120; i++)
        for (let j = 0; j <= 120; j++) {
          const x = x0 - 1 + ((w + 2) * i) / 120,
            y = y0 - 1 + ((h + 2) * j) / 120;
          if (proceduralDistance(s, x, y) <= 0) {
            expect(x).toBeGreaterThanOrEqual(x0);
            expect(x).toBeLessThanOrEqual(x0 + w);
            expect(y).toBeGreaterThanOrEqual(y0);
            expect(y).toBeLessThanOrEqual(y0 + h);
          }
        }
    }
  });
  it("fills monotonically from 0 to 1 along each shape", () => {
    expect(proceduralFillCoord(disc, 0, 0)).toBe(0);
    expect(proceduralFillCoord(disc, 3, 0)).toBeCloseTo(1);
    expect(proceduralFillCoord(beam, 0, 0)).toBe(0);
    expect(proceduralFillCoord(beam, 8, 0)).toBeCloseTo(1);
    expect(
      proceduralFillCoord(arc, 4 * Math.cos(-Math.PI / 6), -2),
    ).toBeCloseTo(0);
    expect(proceduralFillCoord(arc, 4, 0)).toBeCloseTo(0.5);
    expect(proceduralFillCoord(arc, 4 * Math.cos(Math.PI / 6), 2)).toBeCloseTo(
      1,
    );
  });
  it("has a colour for every element and distinct shader shape ids", () => {
    for (const e of ["water", "fire", "earth", "air"] as const)
      expect(policy.procedural.colors[e]).toHaveLength(3);
    expect(new Set(Object.values(proceduralShapeIds)).size).toBe(3);
  });
  it("keeps the arc shader on the contract's half-angle and off GLSL reserved words (GL proof, D2 6.2)", () => {
    // The GPU run found `half` (reserved in GLSL ES 3.00, no compile) and degrees*pi/180 (a doubled arc).
    const k = /halfArc=uShape\.z\*([\d.]+);/.exec(proceduralFragment)![1]!;
    expect(Number(k)).toBeCloseTo(Math.PI / 360, 8);
    expect(proceduralFragment).not.toMatch(
      /\b(half|fixed|input|output|sampler3D|common|partition|active|filter)\b/,
    );
  });
});
