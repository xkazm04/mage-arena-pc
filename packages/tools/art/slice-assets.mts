/**
 * Copies the D2 mastery slice's picked candidates (`packages/game/data/slice-d2s.json`) from `art/delivery/d2s/` into
 * `packages/game/public/slice/d2s/`, byte for byte, removes any candidate no longer picked and writes `manifest.json`
 * (sha256 and bytes per file, the total). No generation, no resizing: the served bytes are the delivered bytes.
 *
 * Swap a candidate: change its id in slice-d2s.json, then from the repo root
 *   node --import tsx packages/tools/art/slice-assets.mts
 * `--check` verifies the public copy against the pick without writing (exit 1 on drift).
 */
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import {
  sliceFiles,
  slicePick,
  slicePublicDir,
  sliceStatus,
} from "../../game/src/slice/slice-pick.ts";

const publicRoot = "packages/game/public",
  dir = join(publicRoot, slicePublicDir),
  check = process.argv.includes("--check"),
  files = sliceFiles(),
  sha = (path: string) =>
    createHash("sha256").update(readFileSync(path)).digest("hex");
const manifest = {
  status: sliceStatus,
  pick: slicePick,
  files: files.map((f) => ({
    ...f,
    sha256: sha(f.source),
    bytes: readFileSync(f.source).length,
  })),
  totalBytes: 0,
};
manifest.totalBytes = manifest.files.reduce((n, f) => n + f.bytes, 0);
const wanted = new Set(files.map((f) => f.target.split("/").at(-2)!)),
  present = existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    : [];
const drift = [
  ...files
    .filter((f) => {
      const served = join(publicRoot, f.target);
      return !existsSync(served) || sha(served) !== sha(f.source);
    })
    .map((f) => `stale ${f.target}`),
  ...present.filter((d) => !wanted.has(d)).map((d) => `unpicked ${d}`),
];
const manifestPath = join(dir, "manifest.json"),
  text = `${JSON.stringify(manifest, null, 2)}\n`;
if (!existsSync(manifestPath) || readFileSync(manifestPath, "utf8") !== text)
  drift.push("manifest");
if (check) {
  console.log(JSON.stringify({ drift, totalBytes: manifest.totalBytes }));
  process.exit(drift.length ? 1 : 0);
}
for (const d of present)
  if (!wanted.has(d)) rmSync(join(dir, d), { recursive: true });
for (const f of files) {
  mkdirSync(dirname(join(publicRoot, f.target)), { recursive: true });
  copyFileSync(f.source, join(publicRoot, f.target));
}
writeFileSync(manifestPath, text);
console.log(
  JSON.stringify({ wrote: files.length, totalBytes: manifest.totalBytes }),
);
