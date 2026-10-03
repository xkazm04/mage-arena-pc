import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

// Selective delivery merge. No traversal of upstream directories or raw sources.
const sourceRoot = resolve(process.argv[2] ?? "../mage-arena-art");
const root = resolve("assets/accepted/covenant");
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const manifest = read(resolve(root, "manifest.json"));
const commit = execFileSync("git", ["-C", sourceRoot, "rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const imported: { source: string; file: string; sha256: string }[] = [];
function copy(
  source: string,
  key: string,
  metadata: { sha256?: string; size?: number[] } = {},
) {
  if (
    !/^art\/(delivery\/(a8|a10|a11)\/|ui\/)[\w/.-]+$/.test(source) ||
    source.includes("..")
  )
    throw Error(`Disallowed delivery: ${source}`);
  const bytes = readFileSync(resolve(sourceRoot, source));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (metadata.sha256 && metadata.sha256 !== sha256)
    throw Error(`Hash mismatch: ${source}`);
  const file = source.replace(/^art\/(delivery\/)?/, "");
  const destination = resolve(root, file);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(resolve(sourceRoot, source), destination);
  writeFileSync(
    destination + ".json",
    JSON.stringify(
      {
        ...metadata,
        sourceDelivery: source,
        sourceCommit: commit,
        sha256,
        integration:
          "U4 authorized by owner; upstream review/provenance labels retained",
      },
      null,
      2,
    ) + "\n",
  );
  manifest.entries[key] = {
    file,
    sha256,
    ...(metadata.size ? { size: metadata.size } : {}),
  };
  imported.push({ source, file, sha256 });
}
for (const [wave, name] of [
  ["a8", "effects"],
  ["a10", "characters"],
]) {
  const source = `art/delivery/${wave}/${name}.json`;
  const data = read(resolve(sourceRoot, source));
  copy(source, `${wave}.manifest`);
  for (const page of data.pages)
    copy(page.file, `${wave}.page.${page.id}`, page);
  copy(`art/delivery/${wave}/README.md`, `${wave}.notes`);
}
for (const [wave, file] of [
  ["a8", "source-measurements.json"],
  ["a10", "source-gates.json"],
  ["a10", "proofs.json"],
  ["a11", "provenance.json"],
  ["a11", "proofs.json"],
  ["a11", "README.md"],
])
  copy(`art/delivery/${wave}/${file}`, `${wave}.${file}`);
const kit = read(resolve(sourceRoot, "art/ui/kit.json"));
for (const page of kit.pages)
  copy(`art/ui/${page.file}`, `ui.${page.id}`, page);
for (const file of ["kit.json", "provenance.json"])
  copy(`art/ui/${file}`, `ui.${file}`);
manifest.integration = "U2 + U4";
writeFileSync(
  resolve(root, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
mkdirSync("docs/waves/U4-evidence", { recursive: true });
writeFileSync(
  "docs/waves/U4-evidence/import.json",
  JSON.stringify({ sourceCommit: commit, imported }, null, 2) + "\n",
);
console.log(`U4: verified ${imported.length} delivery files; source ${commit}`);
