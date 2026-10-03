import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import {
  decodeSave,
  encodeSave,
  hash,
  restoreSave,
  SeasonService,
  sourceHash,
} from "@mage/director";
import { fourteenDays } from "./season-fixtures.ts";
const first = await fourteenDays(),
  second = await fourteenDays();
const a = encodeSave(first),
  b = encodeSave(second);
assert.equal(
  JSON.stringify(a),
  JSON.stringify(b),
  "Same seed and policy produce byte-identical envelope.",
);
const loaded = new SeasonService(first.tables, first.options);
restoreSave(loaded, decodeSave(first.tables, JSON.stringify(a)));
assert.equal(
  JSON.stringify(encodeSave(loaded)),
  JSON.stringify(a),
  "Full envelope round trip is byte identical.",
);
const record = {
  label:
    "simulated seed 73 and ordinary input policy; exact deterministic bytes measured",
  command: "npx tsx packages/tools/src/u3-replay.ts",
  sourceHash: sourceHash(),
  policyHash: hash(
    ["season-policy.ts", "season-fixtures.ts"].map((p) =>
      readFileSync(`packages/tools/src/${p}`, "utf8").replaceAll("\r\n", "\n"),
    ),
  ),
  firstHash: hash(a),
  secondHash: hash(b),
  loadedHash: hash(encodeSave(loaded)),
  bytes: Buffer.byteLength(JSON.stringify(a)),
  day: first.session.camp.day,
  receipts: first.progress.receipts,
  exactBytes: true,
  passed: true,
};
writeFileSync(
  process.env.MAGE_EVIDENCE === "U4"
    ? "docs/waves/U4-evidence/replay-save.json"
    : "docs/waves/U3-evidence/replay-save.json",
  JSON.stringify(record, null, 2) + "\n",
);
first.close();
second.close();
loaded.close();
console.log(
  JSON.stringify({ passed: true, hash: record.firstHash, bytes: record.bytes }),
);
