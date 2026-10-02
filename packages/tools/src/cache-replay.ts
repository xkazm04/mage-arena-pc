import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createState } from "@mage/core";
import {
  CostGuard,
  loadTables,
  night,
  RequestCache,
  type Provider,
} from "@mage/director";
import { readNights } from "./evidence.ts";

const t = loadTables(),
  results = [];
for (const source of ["sonnet", "local-soak"]) {
  const rows = readNights(`docs/waves/W1-evidence/${source}/nights.jsonl`),
    dir = mkdtempSync(join(tmpdir(), "mage-cache-replay-")),
    guard = new CostGuard(
      join(dir, "budget.json"),
      "replay",
      "forbidden",
      0,
      0,
    );
  let state = createState(t, rows[0].seed, rows[0].day),
    hits = 0,
    blockedCalls = 0;
  for (const row of rows) {
    // The soak deliberately asks afresh, even for identical requests. Each row
    // therefore restores its own recorded cache snapshot, not a shared mutable one.
    const cache = new RequestCache(join(dir, "cache", String(row.index)));
    if (state.ended) state = createState(t, state.seed + 1);
    for (const g of row.groups) cache.put(g.request, g.raw);
    const provider: Provider = {
      id: row.provider,
      model: row.model,
      options: row.groups[0].request.options,
      decide: async () => {
        blockedCalls++;
        throw new Error("A replay must not call a model");
      },
    };
    const result = await night(t, state, { provider, cache, guard });
    hits += result.groups.filter((g) => g.source === "cache").length;
    if (result.afterHash !== row.afterHash)
      throw new Error(`Cache replay diverged: ${source} night ${row.index}`);
    state = result.state;
  }
  results.push({
    source,
    label: "measured offline replay of per-night pinned live evidence",
    nights: rows.length,
    cacheHits: hits,
    providerCalls: blockedCalls,
  });
}
writeFileSync(
  "docs/waves/W1-evidence/cache-replay.json",
  JSON.stringify(results, null, 2) + "\n",
);
console.log(JSON.stringify(results, null, 2));
