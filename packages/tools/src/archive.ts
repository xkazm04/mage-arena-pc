import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { platform, release, arch, cpus, totalmem } from "node:os";
import config from "../../director/src/config.json" with { type: "json" };

const root = resolve("docs/waves/W1-evidence");
const partial = process.argv.includes("--partial");
const files = [
  "local-pilot-a/nights.jsonl",
  "local-soak/nights.jsonl",
  "local-soak/judge.jsonl",
  "sonnet/nights.jsonl",
  "sonnet/judge.jsonl",
  "local-soak/judge-attempts.jsonl",
  "sonnet/judge-attempts.jsonl",
  "seeded-draws.jsonl",
  "w1b-process.jsonl",
];
const manifest = [];
for (const file of files) {
  const path = join(root, file);
  if (!existsSync(path)) {
    if (partial) continue;
    throw new Error(`Missing evidence: ${file}`);
  }
  const raw = readFileSync(path);
  const rows = raw.toString("utf8").trim().split("\n").filter(Boolean);
  const expected =
    file === "w1b-process.jsonl" || file.endsWith("judge-attempts.jsonl")
      ? rows.length
      : file.startsWith("local-pilot-a/")
        ? config.budget.w1.pilotLocalNights
        : file.startsWith("local-soak/")
          ? config.budget.w1.localNights
          : file.startsWith("sonnet/")
            ? config.budget.w1.sonnetNights
            : config.budget.w1.localNights + config.budget.w1.sonnetNights;
  if (!partial && rows.length !== expected)
    throw new Error(
      `Incomplete evidence: ${file} has ${rows.length} rows, expected ${expected}`,
    );
  const compressed = gzipSync(raw, { level: 9 });
  if (!gunzipSync(compressed).equals(raw))
    throw new Error("Compression round trip failed");
  writeFileSync(`${path}.gz`, compressed);
  manifest.push({
    file: `${file}.gz`,
    rows: rows.length,
    expectedRows: expected,
    rawBytes: raw.length,
    compressedBytes: compressed.length,
    sha256Raw: createHash("sha256").update(raw).digest("hex"),
    sha256Gzip: createHash("sha256").update(compressed).digest("hex"),
  });
}
writeFileSync(
  join(root, "archive-manifest.json"),
  JSON.stringify({ label: "measured", partial, files: manifest }, null, 2) +
    "\n",
);
const ledger = JSON.parse(
  readFileSync(".director-runtime/cost-ledger.json", "utf8"),
) as {
  runs: Record<string, number>;
  days: Record<string, number>;
  reservations: unknown[];
};
if (
  (ledger.runs["claude:W1-sonnet-total"] ?? 0) >
  config.budget.w1.sonnetNights * config.groups.length
)
  throw new Error("Subscription cap exceeded");
writeFileSync(
  join(root, "cost-ledger.json"),
  JSON.stringify(ledger, null, 2) + "\n",
);
writeFileSync(
  join(root, "machine.json"),
  JSON.stringify(
    {
      label: "measured",
      platform: platform(),
      release: release(),
      arch: arch(),
      cpu: cpus()[0]?.model,
      logicalCpus: cpus().length,
      ramBytes: totalmem(),
      node: process.version,
    },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify(manifest, null, 2));
