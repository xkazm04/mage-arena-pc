import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve as pathResolve } from "node:path";
import {
  createState,
  reconcile,
  resolve,
  type CampState,
  type Decision,
} from "@mage/core";
import { plan } from "@mage/director";
import { readNights } from "./evidence.ts";
import { experimentTables } from "./experiment.ts";
import { extractPairs, renderBlindPage, sideLabels } from "./blind-pair.ts";

// npx tsx packages/tools/src/blind.ts [source]        re-plan three mornings and their map
// npx tsx packages/tools/src/blind.ts --keep-mornings  re-render the page over the committed
//                                                      mornings; the map is left untouched
const root = pathResolve("docs/waves/W1-evidence"),
  page = join(root, "OWNER-READ.html");
if (process.argv[2] === "--keep-mornings") {
  writeFileSync(page, renderBlindPage(extractPairs(readFileSync(page, "utf8"))));
  console.log("Re-rendered the committed mornings; mapping untouched.");
  process.exit(0);
}
const t = experimentTables(),
  source = process.argv[2] ?? "local-soak",
  rows = readNights(join(root, source, "nights.jsonl"));
if (rows.length < 3) throw new Error("Need at least three measured nights");
const samples = [0, Math.floor(rows.length / 2), rows.length - 1],
  mapping: unknown[] = [];
const esc = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
function morning(state: CampState, items: Decision[]) {
  const board = state.board
    .filter((b) => !b.text.startsWith("Journal:"))
    .slice(0, 4)
    .map((b) => `<li>${esc(b.text)}</li>`)
    .join("");
  const voices = items
    .filter((d) => ["brennic", "garran", "iskar", "nysa"].includes(d.character))
    .map(
      (d) =>
        `<p><b>${esc(state.characters[d.character].name)}</b><br>“${esc(d.line)}”</p>`,
    )
    .join("");
  return `<ul>${board || "<li>The camp wakes beneath the guarded walls.</li>"}</ul>${voices}`;
}
const pairs = samples.map((index, sample) => {
  const row = rows[index];
  let before: CampState;
  if (!index || rows[index - 1].state.ended)
    before = createState(t, row.seed, row.day);
  else before = rows[index - 1].state;
  const fallback = reconcile(
    t,
    before,
    Object.keys(before.characters)
      .filter((id) => id !== before.player)
      .map((id) => plan(t, before, id)),
    (id) => plan(t, before, id, true),
  );
  const simulated = resolve(t, before, fallback.items).state;
  const liveHTML = morning(row.state, row.items),
    plannerHTML = morning(simulated, fallback.items);
  mapping.push({
    morning: sample + 1,
    evidence: source,
    index,
    day: row.day,
    seed: row.seed,
    ...sideLabels(sample),
  });
  return sample % 2 === 0
    ? { a: liveHTML, b: plannerHTML }
    : { a: plannerHTML, b: liveHTML };
});
mkdirSync(root, { recursive: true });
writeFileSync(page, renderBlindPage(pairs));
writeFileSync(
  join(root, "blind-source-map.json"),
  JSON.stringify(mapping, null, 2) + "\n",
);
console.log(
  "Generated three blind morning comparisons; mapping kept separately.",
);
