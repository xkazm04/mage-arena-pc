import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const root = "docs/waves/U6c-evidence";
const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const sha = (path: string) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");
const imported = read(`${root}/import.json`) as {
  artCommit: string;
  artImported: { source: string; file: string; sha256: string }[];
};
for (const item of imported.artImported) {
  assert(
    item.source
      .replaceAll("\\", "/")
      .startsWith("../mage-arena-art/art/delivery/a14/"),
  );
  assert.equal(sha(item.source), item.sha256);
  assert.equal(sha(item.file), item.sha256);
}
const upstream = ["art", "audio"].map((branch) => {
  const path = `../mage-arena-${branch}`;
  const commit = execFileSync("git", ["-C", path, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  const status = execFileSync("git", ["-C", path, "status", "--porcelain"], {
    encoding: "utf8",
  }).trim();
  assert.equal(status, "");
  return { branch, commit, clean: true };
});
assert.equal(upstream[0]!.commit, imported.artCommit);
assert.equal(
  execFileSync(
    "git",
    [
      "diff",
      "47c1856",
      "--",
      "packages/core/src",
      "packages/director/src",
      "docs/design/reconciled/data",
      "art/scale-contract-v3.json",
    ],
    { encoding: "utf8" },
  ),
  "",
);
const oldCensus = read("docs/waves/H1-evidence/census.json"),
  census = read(`${root}/census.json`);
assert.equal(census.fullCensus, true);
assert.equal(census.allPassed, true);
assert.deepEqual(census.waves, oldCensus.waves);
const fights = [];
for (let wave = 1; wave <= 4; wave++) {
  const file = `${root}/census-wave-${wave}.json`;
  assert.deepEqual(
    read(file),
    read(`docs/waves/H1-evidence/census-wave-${wave}.json`),
  );
  fights.push({
    wave,
    exactJsonEqual: true,
    sha256: sha(file),
    bytes: readFileSync(file).length,
  });
}
writeFileSync(
  `${root}/census-comparison.json`,
  JSON.stringify(
    { baseline: "H1", waveSummariesEqual: true, fightRecords: fights },
    null,
    2,
  ) + "\n",
);
const replay = read(`${root}/replay-save.json`);
assert.equal(
  replay.firstHash,
  "2451fa7085c6a8534036a26e347b48d6281d42f22dcf51616570ea82b7452bc2",
);
assert.equal(replay.bytes, 1300369);
assert.equal(replay.exactBytes, true);
const browser = read(`${root}/browser.json`),
  performance = read(`${root}/performance/browser.json`);
assert.equal(browser.passed, true);
assert.equal(performance.passed, true);
assert.deepEqual(browser.errors, []);
assert.deepEqual(performance.errors, []);
assert.equal(
  browser.runs.filter(
    (r: { kind?: string }) => r.kind === "live-creature-fight",
  ).length,
  8,
);
const collapse = read(`${root}/collapse.json`);
assert.equal(collapse.passed, true);
assert.deepEqual(collapse.errors, []);
assert.equal(
  collapse.runs.filter(
    (r: { kind?: string }) => r.kind === "active-moth-contact",
  ).length,
  2,
);
const entities = [
  "cassia",
  "brennic",
  "garran",
  "iskar",
  "conscript",
  "shieldman",
  "slinger",
  "netter",
  "cinder_hound",
  "mire_maw",
  "thornback",
  "hush_moth",
];
const screenshots = [];
for (const height of [1080, 1440])
  for (const entity of entities)
    for (const direction of ["ne", "se", "sw", "nw"]) {
      const observations = browser.runs.filter(
        (r: { height: number; entity: string; direction: string }) =>
          r.height === height &&
          r.entity === entity &&
          r.direction === direction,
      );
      assert.equal(observations.length, 3);
      for (const state of ["collapse", "corpse"]) {
        const file = `screens/${height}-${entity}-${state}-${direction}.png`,
          png = readFileSync(`${root}/${file}`);
        assert.equal(png.readUInt32BE(16), (height * 16) / 9);
        assert.equal(png.readUInt32BE(20), height);
        screenshots.push({
          file,
          sha256: sha(`${root}/${file}`),
          width: (height * 16) / 9,
          height,
        });
      }
    }
writeFileSync(
  `${root}/verification.json`,
  JSON.stringify(
    {
      passed: true,
      command: "npx tsx packages/tools/src/u6c-verify.ts",
      upstream,
      coreAndCombatDataUnchangedSince: "47c1856",
      copiedFilesVerified: imported.artImported.length,
      censusFightsUnchanged: 8000,
      nativeCollapseCorpseScreenshots: screenshots,
      replayHash: replay.firstHash,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    passed: true,
    files: imported.artImported.length,
    nativeCollapseCorpseScreenshots: screenshots.length,
    unchangedFights: 8000,
  }),
);
