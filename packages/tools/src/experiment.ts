import { readFileSync } from "node:fs";
import type { Tables } from "@mage/core";
import { hash, loadTables } from "@mage/director";

// Historical measurement inputs, deliberately separate from active balance data.
function originalTables(): Tables {
  return JSON.parse(
    readFileSync(
      new URL(
        "../../../docs/waves/W1-evidence/experiment-tables.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as Tables;
}
export function experimentTables(): Tables {
  const old = originalTables(), current = loadTables();
  return { ...old, season: { ...old.season, ...current.season }, locations: old.locations.map(p => ({ ...p, openHour: current.locations.find(x=>x.id===p.id)!.openHour, closeHour: current.locations.find(x=>x.id===p.id)!.closeHour })) };
}
export function experimentHash(): string {
  return hash(originalTables());
}
