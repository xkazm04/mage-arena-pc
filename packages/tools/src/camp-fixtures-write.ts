import { mkdirSync, writeFileSync } from "node:fs";
import { campMornings } from "./camp-fixtures.ts";
mkdirSync("docs/waves/W5-evidence", { recursive: true });
writeFileSync(
  "docs/waves/W5-evidence/golden-mornings.json",
  JSON.stringify(campMornings(), null, 2) + "\n",
);
console.log("Generated three deterministic camp mornings.");
