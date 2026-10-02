import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";

// Explicit delivery allowlist. This importer never traverses or opens art/raw.
const root = resolve("assets/accepted/covenant");
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const hash = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const write = (p: string, v: unknown) => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(v, null, 2) + "\n");
};
const entries: Record<
  string,
  { file: string; sha256: string; size?: number[] }
> = {};
function copy(source: string, metadata: Record<string, unknown>, key: string) {
  if (
    !/^art\/(delivery\/(a7|a4c|a2c|a3c)\/|ui\/)/.test(source) ||
    source.includes("..")
  )
    throw Error(`Disallowed delivery ${source}`);
  const bytes = readFileSync(source),
    digest = hash(bytes);
  if (metadata.sha256 && metadata.sha256 !== digest)
    throw Error(`Source hash mismatch: ${source}`);
  const file = source.replace(/^art\/(delivery\/)?/, ""),
    destination = resolve(root, file);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
  write(destination + ".json", {
    ...metadata,
    sourceDelivery: source,
    sha256: digest,
    integration: "U2 authorized; owner visual review pending",
  });
  entries[key] = {
    file,
    sha256: digest,
    ...(Array.isArray(metadata.size)
      ? { size: metadata.size as number[] }
      : {}),
  };
}
const arena = read("art/delivery/a7/manifest.json");
const camp = read("art/delivery/a4c/manifest.json");
const portraits = read("art/delivery/a2c/manifest.json");
const figures = read("art/delivery/a3c/figures.json");
const kit = read("art/ui/kit.json");
for (const item of arena.exports) copy(item.file, item, item.id);
for (const item of camp.maps)
  copy(item.file, item, `camp.${item.slot}.${item.size[0]}`);
for (const item of camp.backdrops) copy(item.file, item, `place.${item.place}`);
for (const item of camp.stories) copy(item.file, item, `story.${item.id}`);
for (const item of portraits.portraits)
  copy(item.file, item, `portrait.${item.id}`);
for (const item of portraits.pages)
  copy(item.file, item, `portrait-page.${item.id}`);
for (const item of figures.frames)
  copy(item.file, item, `figure.${item.entity}.${item.state}`);
for (const item of figures.atlases)
  copy(item.file, item, `figure-page.${item.entity}`);
for (const name of ["effects", "painted-effects"])
  for (const item of read(`art/delivery/a3c/${name}.json`).effects)
    copy(item.file, item, `effect.${item.id}`);
for (const item of kit.pages)
  copy(`art/ui/${item.file}`, item, `ui.${item.id}`);
for (const item of [kit.typography.display, kit.typography.body]) {
  copy(`art/ui/${item.file}`, {}, `font.${item.family}`);
  copy(`art/ui/${item.license}`, {}, `license.${item.family}`);
}
for (const name of [
  "kit.json",
  "icons.json",
  "provenance.json",
  "source-crops.json",
])
  copy(`art/ui/${name}`, {}, `ui.${name}`);
for (const [name, m] of Object.entries({ arena, camp, portraits, figures }))
  write(resolve(root, `metadata/${name}.json`), m);
write(resolve(root, "manifest.json"), {
  schema: 1,
  integration: "U2",
  ownerAccepted: false,
  entries,
  places: camp.places,
  portraits: portraits.portraits.map((p: Record<string, unknown>) => ({
    id: p.id,
    character: p.character,
    mood: p.mood,
    atlas: p.atlas,
    rect: p.rect,
  })),
  characters: portraits.characters,
});
console.log(
  `Verified and copied ${Object.keys(entries).length} delivery assets with sidecars.`,
);
