import { readFileSync } from "node:fs";
import type { Tables } from "@mage/core";
import { hash } from "@mage/director";

// Historical measurement inputs, deliberately separate from active balance data.
export function experimentTables(): Tables {
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
export function experimentHash(): string {
  return hash(experimentTables());
}
