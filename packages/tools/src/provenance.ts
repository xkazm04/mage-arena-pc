import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { experimentHash } from "./experiment.ts";

const sha = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const commit = "4c7256c";
const result = [];
for (const name of ["local-soak", "sonnet"]) {
  const path = `docs/waves/W1-evidence/${name}/nights.jsonl`;
  const original = gunzipSync(
    execFileSync("git", ["show", `${commit}:${path}.gz`], {
      maxBuffer: 64 * 1024 * 1024,
    }),
  );
  const current = readFileSync(path);
  if (!current.subarray(0, original.length).equals(original))
    throw new Error(`Original ${name} bytes changed`);
  result.push({
    run: name,
    originalCommit: commit,
    originalRows: original.toString("utf8").trim().split("\n").length,
    preservedBytes: original.length,
    sha256: sha(original),
    prefixUnchanged: true,
  });
}
writeFileSync(
  "docs/waves/W1-evidence/provenance.json",
  JSON.stringify(
    {
      label: "measured byte identity against prior session commit",
      experimentHash: experimentHash(),
      runs: result,
    },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify(result, null, 2));
