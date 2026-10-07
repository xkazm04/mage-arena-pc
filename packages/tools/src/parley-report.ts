import { mkdirSync, writeFileSync } from "node:fs";
import {
  applyParley,
  authoredParley,
  parleyRules,
  type ParleyRecord,
} from "@mage/core";
import { hash, loadTables } from "@mage/director";
import { injectionSuite } from "./parley-injections.ts";
import { knowingFixture, parleyBounds } from "./parley-fixtures.ts";
const out = "docs/waves/W6-evidence";
mkdirSync(out, { recursive: true });
const injections = injectionSuite();
if (injections.violations || injections.cases !== 100)
  throw new Error("Injection gate failed");
writeFileSync(
  `${out}/injection-suite.json`,
  JSON.stringify(injections, null, 2) + "\n",
);
const t = loadTables(),
  rows: {
    seed: number;
    card: string;
    result: ParleyRecord;
    afterHash: string;
    errors: string[];
  }[] = [];
for (let seed = 0; seed < 100; seed++)
  for (const card of parleyRules.cards) {
    const s = knowingFixture(t, seed),
      after = applyParley(t, s, "nysa", authoredParley(s, "nysa", card.id));
    rows.push({
      seed,
      card: card.id,
      result: after.parleys.at(-1)!,
      afterHash: hash(after.camp),
      errors: parleyBounds(s, after),
    });
  }
const effects = Object.fromEntries(
  parleyRules.effects.map((effect) => [
    effect,
    rows.filter((r) => r.result.effect === effect).length,
  ]),
);
const report = {
  label: "simulated authored cards",
  cases: rows.length,
  effects,
  violations: rows.flatMap((r) => r.errors).length,
  rows,
};
if (report.violations) throw new Error("Authored gate failed");
writeFileSync(
  `${out}/authored-census.json`,
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    hostileCases: injections.cases,
    uniqueTexts: injections.uniqueTexts,
    hostileViolations: injections.violations,
    authoredCases: rows.length,
    effects,
    authoredViolations: report.violations,
  }),
);
