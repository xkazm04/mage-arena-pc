/**
 * D2 section 6.2 GL proof: runs the lit-body fragment shader (packages/game/src/lighting/) and the procedural
 * sigil fragment shader (packages/game/src/sigil-shader.ts) in a real WebGL2 context and compares each capture
 * with its CPU reference. Standalone: no Pixi context, no arena-entry.ts, no game-shell.ts, no preview server, no
 * assets beyond the repo's. Captures go to a tmp folder and are not committed.
 *
 * Run: node --import tsx packages/tools/art/gl-proof/gl-proof.mts [outDir]   (from the repo root; npm run proof:gl)
 * Prints one JSON object; exit 0 = all pass, 1 = a comparison failed, 2 = WebGL could not start ({"evaluated": false, ...}).
 * Default outDir: <os tmp>/mage-gl-proof
 */
import { chromium } from "playwright";
import { deflateSync } from "node:zlib";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  decodeNormal,
  lightAmount,
  lightingDefaults,
} from "../../../game/src/lighting/lighting-math.ts";
import { litBodyFragment } from "../../../game/src/lighting/lit-body.ts";
import { proceduralFragment } from "../../../game/src/sigil-shader.ts";
import {
  proceduralBox,
  proceduralDistance,
  proceduralFillCoord,
  proceduralShapeIds,
  type ProceduralShape,
} from "../../../game/src/sigil-contract.ts";
import policy from "../../../game/data/sigils.json" with { type: "json" };

/** Tolerances in 8-bit levels: the GPU samples an 8-bit normal and rounds on store; the sigil SDF is float32 vs float64. */
const tolerance = { litMax: 1, litMean: 0.5, sigilMax: 1, sigilMean: 0.5 };
const out = process.argv[2] ?? join(tmpdir(), "mage-gl-proof");
mkdirSync(out, { recursive: true });

function png(w: number, h: number, rgba: Uint8Array) {
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = table[(c ^ x) & 255]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (t: string, d: Buffer) => {
    const b = Buffer.concat([Buffer.from(t), d]),
      l = Buffer.alloc(4),
      c = Buffer.alloc(4);
    l.writeUInt32BE(d.length);
    c.writeUInt32BE(crc(b));
    return Buffer.concat([l, b, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++)
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(
      raw,
      y * (w * 4 + 1) + 1,
    );
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
const unb64 = (s: string) => new Uint8Array(Buffer.from(s, "base64"));
class Err {
  max = 0;
  sum = 0;
  signed = 0;
  n = 0;
  add(d: number) {
    this.signed += d;
    d = Math.abs(d);
    if (d > this.max) this.max = d;
    this.sum += d;
    this.n++;
  }
  report(maxTol: number, meanTol: number) {
    const mean = this.sum / (this.n || 1);
    return {
      samples: this.n,
      maxErr: this.max,
      meanErr: +mean.toFixed(4),
      bias: +(this.signed / (this.n || 1)).toFixed(4),
      tolerance: { max: maxTol, mean: meanTol },
      pass: this.n > 0 && this.max <= maxTol && mean <= meanTol,
    };
  }
}
const q = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
type W = Window & Record<string, (job: unknown) => unknown>;

const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=d3d11"],
});
try {
  const page = await browser.newPage();
  await page.setContent(
    readFileSync("packages/tools/art/gl-proof/gl-proof.html", "utf8"),
  );
  const gl = await page.evaluate(() =>
    (window as unknown as W).glInfo!(undefined),
  );
  if (!gl) {
    console.log(
      JSON.stringify({
        evaluated: false,
        reason: "webgl2 context unavailable",
      }),
    );
    process.exit(2);
  }
  const result: Record<string, unknown> = { evaluated: true, gl, out };

  // --- lit body: Cassia A10 page + derived normal map, the four lights of derive-normal-map.py's proof strip ---
  const meta = JSON.parse(
    readFileSync("packages/game/public/normal-maps/cassia.json", "utf8"),
  ) as { size: [number, number] };
  const [pw] = meta.size,
    ph = meta.size[1],
    cw = 868,
    ch = 344;
  const colorPng = readFileSync(
    "assets/accepted/covenant/a10/packed/cassia.png",
  ).toString("base64");
  const normalPng = readFileSync(
    "packages/game/public/normal-maps/cassia.png",
  ).toString("base64");
  const stripPng = readFileSync(
    "packages/game/public/normal-maps/cassia-lit-proof.png",
  ).toString("base64");
  const decode = async (b: string) =>
    unb64(
      (await page.evaluate(
        (b) => (window as unknown as W).decodePng!(b),
        b,
      )) as string,
    );
  const colorPx = await decode(colorPng),
    normalPx = await decode(normalPng),
    stripPx = await decode(stripPng);
  const lightX = [0, 1, 2, 3].map((i) => cw * (0.15 + 0.23 * i)),
    lightY = 120;
  const vsStrip = new Err(),
    vsModel = new Err();
  let compared = 0;
  for (let t = 0; t < 4; t++) {
    const gpu = unb64(
      (await page.evaluate((job) => (window as unknown as W).runLit!(job), {
        fragment: litBodyFragment,
        colorPng,
        normalPng,
        page: [pw, ph],
        crop: [cw, ch],
        // GL fragments sit at pixel centres (x + 0.5); the CPU references use integer texel indices: shift the light the same half pixel.
        lights: [
          [
            lightX[t]! + 0.5,
            lightY + 0.5,
            lightingDefaults.lightZ,
            lightingDefaults.lightRadius,
            ...lightingDefaults.color,
          ],
        ],
        ambient: lightingDefaults.ambient,
        tint: lightingDefaults.tintStrength,
      })) as string,
    );
    for (let y = 0; y < ch; y++)
      for (let x = 0; x < cw; x++) {
        const gi = (y * cw + x) * 4,
          pi = (y * pw + x) * 4;
        // Partial alpha is skipped: the tool's strip is straight-alpha, the shader scales the tint by alpha.
        if (gpu[gi + 3] !== 255 || colorPx[pi + 3] !== 255) continue;
        compared++;
        const si = ((t * ch + y) * cw + x) * 4;
        const n = decodeNormal(
          normalPx[pi]!,
          normalPx[pi + 1]!,
          normalPx[pi + 2]!,
        );
        const a = lightAmount(n, x, y, { x: lightX[t]!, y: lightY });
        for (let k = 0; k < 3; k++) {
          vsStrip.add(gpu[gi + k]! - stripPx[si + k]!);
          vsModel.add(
            gpu[gi + k]! -
              q(
                (colorPx[pi + k]! / 255) * (lightingDefaults.ambient + a) +
                  lightingDefaults.color[k]! *
                    a *
                    lightingDefaults.tintStrength,
              ),
          );
        }
      }
    writeFileSync(join(out, `lit-gpu-${t}.png`), png(cw, ch, gpu));
  }
  const lit = {
    comparedTexels: compared,
    note: "opaque texels of the 868x344 crop at 4 light positions; max/mean are over R,G,B in 8-bit levels",
    vsProofStrip: vsStrip.report(tolerance.litMax, tolerance.litMean),
    vsTsModel: vsModel.report(tolerance.litMax, tolerance.litMean),
  };
  result.lit = lit;

  // --- procedural sigils: filled disc, beam and arc against the signed-distance witnesses of sigil-contract.ts ---
  const ppm = 100,
    p = policy.procedural;
  const shapes: {
    name: string;
    shape: ProceduralShape;
    element: keyof typeof p.colors;
    progress: number;
  }[] = [
    {
      name: "disc",
      shape: { shape: "disc", radius: 2 },
      element: "water",
      progress: 0.5,
    },
    {
      name: "beam",
      shape: { shape: "beam", length: 6, width: 1 },
      element: "fire",
      progress: 0.4,
    },
    {
      name: "arc",
      shape: { shape: "arc", radius: 3, thickness: 0.6, degrees: 90 },
      element: "earth",
      progress: 0.7,
    },
    {
      name: "disc-idle",
      shape: { shape: "disc", radius: 2 },
      element: "air",
      progress: -1,
    },
  ];
  const sig: Record<string, unknown> = {};
  for (const s of shapes) {
    const box = proceduralBox(s.shape, p.edgeFeatherM),
      w = Math.round(box[2] * ppm),
      h = Math.round(box[3] * ppm),
      sh = s.shape,
      id = proceduralShapeIds[sh.shape];
    const shape =
      sh.shape === "disc"
        ? [id, sh.radius, 0, 0]
        : sh.shape === "beam"
          ? [id, sh.length, sh.width, 0]
          : [id, sh.radius, sh.degrees, sh.thickness];
    const tint = p.colors[s.element];
    const gpu = unb64(
      (await page.evaluate((job) => (window as unknown as W).runSigil!(job), {
        fragment: proceduralFragment,
        size: [w, h],
        box,
        shape,
        style: [p.edgeFeatherM, p.baseOpacity, p.rimOpacity, p.rimWidthM],
        progress: s.progress,
        tint,
      })) as string,
    );
    const err = new Err();
    let notDiscarded = 0,
      skipped = 0;
    const span =
      sh.shape === "disc"
        ? sh.radius
        : sh.shape === "beam"
          ? sh.length
          : ((sh.degrees * Math.PI) / 180) * sh.radius;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const lx = box[0] + ((x + 0.5) / w) * box[2],
          ly = box[1] + ((y + 0.5) / h) * box[3],
          d = proceduralDistance(s.shape, lx, ly),
          t = proceduralFillCoord(s.shape, lx, ly),
          i = (y * w + x) * 4,
          inside = clamp01(-d / p.edgeFeatherM);
        if (inside <= 0) {
          if (gpu[i + 3] !== 0) notDiscarded++;
          continue;
        }
        // step(t, progress) is a hard edge: texels within a texel of it can flip on float rounding.
        if (s.progress >= 0 && Math.abs(t - s.progress) * span < 1.5 / ppm) {
          skipped++;
          continue;
        }
        const filled = s.progress >= 0 && t <= s.progress ? 1 : 0,
          rim = 1 - clamp01(-d / p.rimWidthM),
          a =
            Math.max(
              p.baseOpacity + (0.85 - p.baseOpacity) * filled,
              rim * p.rimOpacity,
            ) * inside;
        err.add(gpu[i + 3]! - q(a));
        for (let k = 0; k < 3; k++) err.add(gpu[i + k]! - q(tint[k]! * a));
      }
    writeFileSync(join(out, `sigil-gpu-${s.name}.png`), png(w, h, gpu));
    sig[s.name] = {
      size: [w, h],
      ...err.report(tolerance.sigilMax, tolerance.sigilMean),
      outsideTexelsNotDiscarded: notDiscarded,
      fillEdgeTexelsSkipped: skipped,
    };
  }
  result.sigils = sig;
  result.pass =
    lit.vsProofStrip.pass &&
    lit.vsTsModel.pass &&
    Object.values(sig).every(
      (v) =>
        (v as { pass: boolean; outsideTexelsNotDiscarded: number }).pass &&
        (v as { outsideTexelsNotDiscarded: number })
          .outsideTexelsNotDiscarded === 0,
    );
  console.log(JSON.stringify(result, null, 1));
  process.exitCode = result.pass ? 0 : 1;
} catch (e) {
  console.log(JSON.stringify({ evaluated: false, reason: String(e) }));
  process.exitCode = 2;
} finally {
  await browser.close();
}
