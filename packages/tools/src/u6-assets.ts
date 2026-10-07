import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const sourceRoot = resolve(process.argv[2] ?? "../mage-arena-art");
const root = resolve("assets/accepted/covenant");
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const manifest = read(resolve(root, "manifest.json"));
const sourceCommit = execFileSync(
  "git",
  ["-C", sourceRoot, "rev-parse", "HEAD"],
  { encoding: "utf8" },
).trim();
const imported: { source: string; file: string; sha256: string }[] = [];
function copy(
  source: string,
  key: string,
  metadata: { sha256?: string; size?: number[] } = {},
) {
  if (!/^art\/delivery\/a13\/[\w/.-]+$/.test(source) || source.includes(".."))
    throw Error(source);
  const bytes = readFileSync(resolve(sourceRoot, source));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (metadata.sha256 && metadata.sha256 !== sha256)
    throw Error(`Hash mismatch: ${source}`);
  const file = source.replace("art/delivery/", "");
  const destination = resolve(root, file);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(resolve(sourceRoot, source), destination);
  manifest.entries[key] = {
    file,
    sha256,
    ...(metadata.size ? { size: metadata.size } : {}),
  };
  imported.push({ source, file, sha256 });
}
const m = read(resolve(sourceRoot, "art/delivery/a13/sigils.json"));
copy("art/delivery/a13/sigils.json", "a13.manifest");
for (const p of m.pages) copy(p.file, `a13.page.${p.id}`, p);
for (const path of new Set<string>(
  Object.values(m.clips)
    .map((c) => (c as { progress?: { mask: string } }).progress?.mask)
    .filter((s): s is string => !!s),
))
  copy(path, `a13.mask.${path.split("/").at(-1)}`, { size: [384, 384] });
copy(m.glyphs, "a13.glyphs");
for (const [id, g] of Object.entries(
  read(resolve(sourceRoot, m.glyphs)).glyphs,
)) {
  const glyph = g as { file: string; sha256: string };
  copy(glyph.file, `a13.glyph.${id}`, glyph);
}
copy("art/delivery/a13/floor-placement.json", "a13.floor");
for (const [palette, p] of Object.entries(
  read(resolve(sourceRoot, "art/delivery/a13/floor-placement.json")).palettes,
)) {
  const overlay = (
    p as { overlay: { file: string; sha256: string; size: number[] } }
  ).overlay;
  copy(overlay.file, `a13.cleanup.${palette}`, overlay);
}
for (const file of [
  "README.md",
  "RUNIC-LANGUAGE.md",
  "integrity.json",
  "browser-report.json",
]) {
  // Only the two contracts are mandatory; reports are recorded by their actual delivery names below.
  if (file.endsWith(".md")) copy(`art/delivery/a13/${file}`, `a13.${file}`);
}
manifest.integration = "U2 + U4 + U5 + U6";
writeFileSync(
  resolve(root, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
mkdirSync("docs/waves/U6-evidence", { recursive: true });
writeFileSync(
  "docs/waves/U6-evidence/import.json",
  JSON.stringify({ sourceCommit, ownerAccepted: false, imported }, null, 2) +
    "\n",
);
console.log(
  `U6: ${imported.length} verified delivery files from ${sourceCommit}`,
);
