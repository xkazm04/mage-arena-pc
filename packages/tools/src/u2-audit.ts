import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { ArtManifest } from "../../game/src/art.ts";

const out = "docs/waves/U2-evidence";
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const hash = (p: string) =>
  createHash("sha256").update(readFileSync(p)).digest("hex");
const git = (...args: string[]) =>
  execFileSync("git", args, { encoding: "utf8", windowsHide: true }).trim();
const base = "b81de34acf0db930d7db3ee66c66a3f5c471dcb4";
const mergedArt = git("rev-parse", "9c34091^2");
const manifest = read("assets/accepted/covenant/manifest.json") as ArtManifest;
const verified: { key: string; file: string; sha256: string }[] = [];
for (const [key, entry] of Object.entries(manifest.entries)) {
  assert(/^(a7|a4c|a2c|a3c|ui)\/[\w/.-]+$/.test(entry.file));
  assert(!entry.file.includes(".."));
  const target = `assets/accepted/covenant/${entry.file}`;
  const sidecar = read(`${target}.json`);
  assert(
    /^art\/(delivery\/(a7|a4c|a2c|a3c)\/|ui\/)/.test(sidecar.sourceDelivery),
  );
  assert(!sidecar.sourceDelivery.includes(".."));
  assert.equal(hash(target), entry.sha256);
  assert.equal(hash(sidecar.sourceDelivery), entry.sha256);
  assert.equal(sidecar.sha256, entry.sha256);
  assert.equal(hash(`dist/game/${target}`), entry.sha256);
  verified.push({ key, ...entry });
}
assert.equal(verified.length, 246);
const legacyPaths = ["art/delivery/a2", "art/delivery/a3", "art/review/a3"];
assert.equal(git("ls-files", "--", ...legacyPaths), "");
for (const path of [
  "dist/game/art/delivery/a2",
  "dist/game/art/delivery/a3",
  "dist/game/assets/accepted/camp",
])
  assert(!existsSync(path), path);
const gameplayDiff = git(
  "diff",
  "--name-only",
  base,
  "--",
  "packages/core/src",
  "packages/director/src",
  "docs/design/reconciled",
);
assert.equal(gameplayDiff, "");
const census = read(`${out}/census.json`);
const previous = read("docs/waves/U1-evidence/census.json");
for (let i = 0; i < census.waves.length; i++) {
  assert.equal(census.waves[i].digest, previous.waves[i].digest);
  assert(census.waves[i].passed);
}
const replay = read(`${out}/replay-save.json`);
assert.equal(
  replay.firstHash,
  read("docs/waves/U1-evidence/replay-save.json").firstHash,
);
assert(replay.passed);
const browser = read(`${out}/browser.json`),
  art = read(`${out}/art-browser.json`);
assert(browser.passed && art.passed);
writeFileSync(
  `${out}/integration-audit.json`,
  JSON.stringify(
    {
      command: "npx tsx packages/tools/src/u2-audit.ts",
      passed: true,
      u1Base: base,
      mergedArt,
      sourceAndAcceptedAndProductionHashesEqual: true,
      noTrackedLegacyFiles: legacyPaths,
      gameplayDiff,
      censusDigestsMatchU1: true,
      replayMatchesU1: true,
      verified,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({ passed: true, assets: verified.length, mergedArt }),
);
