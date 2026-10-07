import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { validateArt } from "../../game/src/art.ts";
const root = "assets/accepted/covenant/";
const hash = (file: string) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");
const read = (file: string) => JSON.parse(readFileSync(file, "utf8"));
const manifest = validateArt(read(root + "manifest.json"));
for (const e of Object.values(manifest.entries)) {
  assert.equal(hash(root + e.file), e.sha256, e.file);
  assert.equal(
    hash("dist/game/" + root + e.file),
    e.sha256,
    `production ${e.file}`,
  );
  assert.equal(
    read(root + e.file + ".json").sha256,
    e.sha256,
    `sidecar ${e.file}`,
  );
}
const unchanged = execFileSync(
  "git",
  [
    "diff",
    "61d63d8",
    "--",
    "packages/core/src",
    "packages/director/src",
    "docs/design/reconciled",
    "packages/game/src/arena-art.ts",
    "packages/game/data/camera.json",
  ],
  { encoding: "utf8" },
);
assert.equal(unchanged, "", "Gameplay, Director, camera and ground unchanged");
const oldPresentation = JSON.parse(
  execFileSync("git", ["show", "61d63d8:packages/game/data/covenant.json"], {
    encoding: "utf8",
  }),
);
const presentation = read("packages/game/data/covenant.json");
for (const key of ["palettes", "plate", "props"])
  assert.deepEqual(
    presentation[key],
    oldPresentation[key],
    `unchanged ground ${key}`,
  );
const oldKit = JSON.parse(
  execFileSync(
    "git",
    ["show", "61d63d8:assets/accepted/covenant/ui/kit.json"],
    { encoding: "utf8" },
  ),
);
const kit = read(root + "ui/kit.json");
for (const [id, region] of Object.entries(oldKit.regions))
  assert.deepEqual(kit.regions[id], region, `unchanged UI ${id}`);
const census = read("docs/waves/U4-evidence/census.json");
const baseline = read("docs/waves/U2-evidence/census.json");
assert(census.allPassed);
assert.deepEqual(
  census.waves.map((w: { digest: string }) => w.digest),
  baseline.waves.map((w: { digest: string }) => w.digest),
);
const replay = read("docs/waves/U4-evidence/replay-save.json");
const oldReplay = read("docs/waves/U3-evidence/replay-save.json");
assert.equal(replay.firstHash, oldReplay.firstHash);
assert.equal(replay.bytes, oldReplay.bytes);
const record = {
  passed: true,
  files: Object.keys(manifest.entries).length,
  sourceAndProductionHashes: true,
  sidecars: true,
  baseline: "61d63d8",
  gameplayDirectorCameraAndGroundUnchanged: true,
  censusDigests: census.waves.map((w: { digest: string }) => w.digest),
  exactSaveHash: replay.firstHash,
  exactSaveBytes: replay.bytes,
};
writeFileSync(
  "docs/waves/U4-evidence/audit.json",
  JSON.stringify(record, null, 2) + "\n",
);
console.log(JSON.stringify(record));
