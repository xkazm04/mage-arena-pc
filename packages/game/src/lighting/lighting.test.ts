import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
import {
  decodeNormal,
  lightAmount,
  lightingDefaults,
  litFactor,
} from "./lighting-math.ts";
import { litBodyFragment, maxLights } from "./lit-body.ts";

const dir = "packages/game/public/normal-maps/";
const meta = JSON.parse(readFileSync(dir + "cassia.json", "utf8")) as {
  size: [number, number];
  sha256: string;
};
const png = readFileSync(dir + "cassia.png");
const pngSize = (b: Buffer) => [b.readUInt32BE(16), b.readUInt32BE(20)];

describe("normal-mapped body lighting test (cassia)", () => {
  it("ships a derived map the size of the colour page it lights", () => {
    expect(createHash("sha256").update(png).digest("hex")).toBe(meta.sha256);
    expect(pngSize(png)).toEqual(meta.size);
    const colour = readFileSync(
      "assets/accepted/covenant/a10/packed/cassia.png",
    );
    expect(pngSize(colour)).toEqual(meta.size);
  });
  it("lights the side of a slope that faces the light, and only that side", () => {
    const right = decodeNormal(255, 128, 200),
      left = decodeNormal(0, 128, 200);
    expect(lightAmount(right, 0, 0, { x: 60, y: 0 })).toBeGreaterThan(
      lightAmount(left, 0, 0, { x: 60, y: 0 }),
    );
    expect(lightAmount(left, 0, 0, { x: -60, y: 0 })).toBeGreaterThan(
      lightAmount(right, 0, 0, { x: -60, y: 0 }),
    );
  });
  it("moves the brightest point of a flat body with a moving light", () => {
    const flat = decodeNormal(128, 128, 255);
    const xs = Array.from({ length: 41 }, (_, i) => i * 10);
    for (const lx of [50, 150, 300]) {
      const at = (x: number) => lightAmount(flat, x, 0, { x: lx, y: 0 });
      const best = xs.reduce((a, b) => (at(b) > at(a) ? b : a));
      expect(Math.abs(best - lx)).toBeLessThanOrEqual(10);
    }
  });
  it("falls to zero at the light radius and is ambient-only there", () => {
    const flat = decodeNormal(128, 128, 255);
    expect(
      lightAmount(flat, lightingDefaults.lightRadius * 2, 0, { x: 0, y: 0 }),
    ).toBe(0);
    expect(litFactor(0)).toBe(lightingDefaults.ambient);
  });
  it("keeps the shader, the tool's proof strip and the TS model on the same constants", () => {
    const py = readFileSync("packages/tools/art/derive-normal-map.py", "utf8");
    const num = (name: string) =>
      Number(new RegExp(`^${name} = ([\\d.]+)`, "m").exec(py)![1]);
    expect(num("AMBIENT")).toBe(lightingDefaults.ambient);
    expect(num("LIGHT_Z")).toBe(lightingDefaults.lightZ);
    expect(num("LIGHT_RADIUS")).toBe(lightingDefaults.lightRadius);
    expect(litBodyFragment).toContain("fall*fall");
    expect(litBodyFragment).toContain(`uLights[${maxLights}]`);
  });
  it("applies the light colour only to the tint, never to the lambert term (GL proof, D2 6.2)", () => {
    // The GPU run found the shader tinting the diffuse term by the light colour; the CPU model and the strip do not.
    expect(litBodyFragment).toContain("lit+=amount;");
    expect(litBodyFragment).toContain(
      "tint+=uLightColors[i].rgb*amount*uAmbient.y;",
    );
    expect(litBodyFragment).toContain("paint.rgb*lit+tint*paint.a");
  });
});
