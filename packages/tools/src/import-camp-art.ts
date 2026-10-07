import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";

// Read-only source. Run explicitly when accepting a new delivery, never at game startup.
const source = resolve(process.argv[2] ?? "C:/Users/kazda/kiro/mage-arena-art");
const destination = resolve("assets/accepted/camp");
const provenance = resolve("docs/waves/W5-evidence/art-provenance");
mkdirSync(destination, { recursive: true });
mkdirSync(provenance, { recursive: true });
const digest = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
type Export = {
  path: string;
  sha256: string;
  id?: string;
  kind?: string;
  job?: string;
  icon?: string;
  size?: number;
};
const a4 = JSON.parse(
  readFileSync(resolve(source, "art/delivery/a4/manifest.json"), "utf8"),
) as { map_source: string; map_source_sha256: string; exports: Export[] };
const a5 = JSON.parse(
  readFileSync(resolve(source, "art/delivery/a5/manifest.json"), "utf8"),
) as { exports: Export[] };
const entries: Record<
  string,
  { path: string; sha256: string; sidecar: string }
> = {};
function accept(key: string, entry: Export) {
  const bytes = readFileSync(resolve(source, entry.path));
  if (digest(bytes) !== entry.sha256)
    throw new Error(`Delivery hash mismatch: ${entry.path}`);
  const extension = entry.path.split(".").at(-1)!;
  const filename = `${key}.${extension}`;
  copyFileSync(resolve(source, entry.path), resolve(destination, filename));
  let originalSidecar: string | null = null;
  if (entry.job) {
    originalSidecar = `${entry.job}.json`;
    copyFileSync(
      resolve(source, `art/attempts/${entry.job}.json`),
      resolve(provenance, originalSidecar),
    );
  }
  // Runtime sidecars retain brief/prompt/attempt but keep provider bookkeeping in docs.
  const attempt = originalSidecar
    ? (JSON.parse(
        readFileSync(resolve(provenance, originalSidecar), "utf8"),
      ) as Record<string, unknown>)
    : null;
  writeFileSync(
    resolve(destination, `${filename}.json`),
    JSON.stringify(
      {
        source: entry.path,
        sha256: entry.sha256,
        style: "Tessera & Lime",
        delivery: entry,
        authorization: "CORE third-session user instruction, 2026-10-02",
        historicalDeliveryStatus: "owner-review",
        scope: "accepted for camp integration",
        brief:
          attempt?.input ??
          "Authored interface geometry from the delivery manifest",
        prompt: attempt?.prompt ?? null,
        attempt: attempt?.attempt ?? null,
        originalSidecar: originalSidecar
          ? `docs/waves/W5-evidence/art-provenance/${originalSidecar}`
          : null,
      },
      null,
      2,
    ) + "\n",
  );
  entries[key] = {
    path: `/assets/accepted/camp/${filename}`,
    sha256: entry.sha256,
    sidecar: `/assets/accepted/camp/${filename}.json`,
  };
}
accept("map", {
  path: a4.map_source,
  sha256: a4.map_source_sha256,
  job: "01-tessera-camp-a01",
});
for (const entry of a4.exports.filter((e) =>
  ["backdrops", "frame"].includes(e.kind ?? ""),
))
  accept(`${entry.kind === "frame" ? "frame" : "place"}-${entry.id}`, entry);
for (const key of [
  "day",
  "dusk",
  "night",
  "knowing",
  "ration",
  "trust",
  "warning",
  "lock",
  "renown",
]) {
  const entry = a5.exports.find((e) => e.icon === key && e.size === 64);
  if (!entry) throw new Error(`Missing icon: ${key}`);
  accept(`icon-${key}`, entry);
}
for (const wave of ["a4", "a5"])
  copyFileSync(
    resolve(source, `art/delivery/${wave}/manifest.json`),
    resolve(provenance, `${wave}-manifest.json`),
  );
const manifest = resolve(destination, "manifest.json");
mkdirSync(dirname(manifest), { recursive: true });
writeFileSync(
  manifest,
  JSON.stringify({ version: 1, style: "Tessera & Lime", entries }, null, 2) +
    "\n",
);
console.log(
  `Accepted ${Object.keys(entries).length} hash-verified textures and sidecars.`,
);
