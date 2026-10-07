import { writeFileSync, mkdirSync } from "node:fs";
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

const t = experimentTables(),
  root = pathResolve("docs/waves/W1-evidence"),
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
const sections = samples
  .map((index, sample) => {
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
    const liveLeft = sample % 2 === 0;
    mapping.push({
      morning: sample + 1,
      evidence: source,
      index,
      day: row.day,
      seed: row.seed,
      A: liveLeft ? "live accepted + fallback" : "offline planner",
      B: liveLeft ? "offline planner" : "live accepted + fallback",
    });
    return `<section><h2>Morning ${sample + 1}</h2><div class="pair"><article><h3>A</h3>${liveLeft ? liveHTML : plannerHTML}</article><article><h3>B</h3>${liveLeft ? plannerHTML : liveHTML}</article></div><p class="response">Preference: A / B / no preference &nbsp; Notes: __________________________________</p></section>`;
  })
  .join("\n");
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Hollow Board — morning read</title><style>body{font:18px/1.6 Georgia,serif;color:#25221d;background:#f3eee2;max-width:1100px;margin:40px auto;padding:0 24px}h1,h2,h3{font-family:system-ui,sans-serif}section{margin:45px 0;border-top:1px solid #bbb;padding-top:12px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:32px}article{background:#fffaf0;padding:24px;border:1px solid #c9c0aa}li{margin-bottom:12px}.response{font-size:16px;color:#555}@media(max-width:700px){.pair{grid-template-columns:1fr}}@media print{section{break-inside:avoid}}</style><h1>The Hollow Board</h1><p>Read each pair as mornings in the same camp. Mark the camp you would rather wake up in, and note what makes a person convincing or unconvincing. A tie is useful.</p>${sections}</html>`;
mkdirSync(root, { recursive: true });
writeFileSync(join(root, "OWNER-READ.html"), html);
writeFileSync(
  join(root, "blind-source-map.json"),
  JSON.stringify(mapping, null, 2) + "\n",
);
console.log(
  "Generated three blind morning comparisons; mapping kept separately.",
);
