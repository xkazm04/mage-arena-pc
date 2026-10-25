import { createHash } from "node:crypto";

// The pure half of the owner blind read: which source sits on which side, the page with
// its answer form, the label-free response file, and the unblinding of saved answers.
// The source labels below live only in blind-source-map.json and the scored result,
// never on the page or in the response file.
export const LIVE = "live accepted + fallback",
  PLANNER = "offline planner";
export type Choice = "A" | "B" | "tie";
export interface MorningPair {
  a: string;
  b: string;
}
export interface SourceMapRow {
  morning: number;
  A: string;
  B: string;
}
export interface FormState {
  pageHash: string;
  mornings: number;
  choices: Record<number, string | null | undefined>;
  notes: Record<number, string | undefined>;
}
export interface ResponseRow {
  morning: number;
  choice: Choice | null;
  notes: string;
}
export interface OwnerTally {
  live: number;
  planner: number;
  tie: number;
  unanswered: number;
}

/** Sample i puts the live morning on A when i is even (unchanged since W1). */
export function sideLabels(sample: number): { A: string; B: string } {
  const liveLeft = sample % 2 === 0;
  return { A: liveLeft ? LIVE : PLANNER, B: liveLeft ? PLANNER : LIVE };
}

/** Inner HTML of every <article>, in page order (the mornings as read). */
export function extractArticles(html: string): string[] {
  return [...html.matchAll(/<article>([\s\S]*?)<\/article>/g)].map((m) => m[1]);
}
/** Recover the morning pairs from a rendered page, so the form can be re-rendered over them. */
export function extractPairs(html: string): MorningPair[] {
  const articles = extractArticles(html);
  if (!articles.length || articles.length % 2)
    throw new Error("Owner page must hold article pairs");
  const body = (inner: string, side: string) => {
    const head = `<h3>${side}</h3>`;
    if (!inner.startsWith(head))
      throw new Error(`Article is not side ${side}`);
    return inner.slice(head.length);
  };
  const out: MorningPair[] = [];
  for (let i = 0; i < articles.length; i += 2)
    out.push({ a: body(articles[i], "A"), b: body(articles[i + 1], "B") });
  return out;
}
/** Answers are bound to the mornings that were read, not to the page chrome. */
export function pageHash(html: string): string {
  return createHash("sha256")
    .update(extractArticles(html).join("\n"))
    .digest("hex");
}

const CHOICES: readonly string[] = ["A", "B", "tie"];
export function exportResponses(s: FormState): {
  pageHash: string;
  responses: ResponseRow[];
} {
  const responses: ResponseRow[] = [];
  for (let m = 1; m <= s.mornings; m++) {
    const c = s.choices[m];
    responses.push({
      morning: m,
      choice: c === "A" || c === "B" || c === "tie" ? c : null,
      notes: String(s.notes[m] || "").trim(),
    });
  }
  return { pageHash: s.pageHash, responses };
}
// The page's own copy of exportResponses (blind-pair.test.ts checks they agree).
export const EXPORT_SOURCE =
  'function exportResponses(s){var r=[];for(var m=1;m<=s.mornings;m++){var c=s.choices[m];r.push({morning:m,choice:c==="A"||c==="B"||c==="tie"?c:null,notes:String(s.notes[m]||"").trim()});}return {pageHash:s.pageHash,responses:r};}';

const articleHTML = (pair: MorningPair) =>
  `<article><h3>A</h3>${pair.a}</article><article><h3>B</h3>${pair.b}</article>`;
const radio = (m: number, value: string, text: string) =>
  `<label><input type="radio" name="morning-${m}" value="${value}"> ${text}</label>`;
export function renderBlindPage(pairs: MorningPair[]): string {
  const hash = createHash("sha256")
    .update(
      pairs
        .flatMap((p) => [`<h3>A</h3>${p.a}`, `<h3>B</h3>${p.b}`])
        .join("\n"),
    )
    .digest("hex");
  const sections = pairs
    .map(
      (pair, i) =>
        `<section><h2>Morning ${i + 1}</h2><div class="pair">${articleHTML(pair)}</div><fieldset class="response"><legend>Which camp would you rather wake up in?</legend>${radio(i + 1, "A", "A")}${radio(i + 1, "B", "B")}${radio(i + 1, "tie", "Tie")}<label class="notes">Notes<textarea name="notes-${i + 1}" rows="3"></textarea></label></fieldset></section>`,
    )
    .join("\n");
  const script = `${EXPORT_SOURCE}document.getElementById("save").addEventListener("click",function(){var f=document.getElementById("owner-read"),s={pageHash:f.dataset.page,mornings:${pairs.length},choices:{},notes:{}};for(var m=1;m<=s.mornings;m++){var c=f.querySelector('input[name="morning-'+m+'"]:checked');s.choices[m]=c?c.value:null;s.notes[m]=f.elements["notes-"+m].value;}var b=new Blob([JSON.stringify(exportResponses(s),null,2)+"\\n"],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="owner-read-responses.json";document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(a.href);},0);document.getElementById("saved").textContent="Saved owner-read-responses.json. Send that file back; nothing else is needed.";});`;
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Hollow Board — morning read</title><style>body{font:18px/1.6 Georgia,serif;color:#25221d;background:#f3eee2;max-width:1100px;margin:40px auto;padding:0 24px}h1,h2,h3{font-family:system-ui,sans-serif}section{margin:45px 0;border-top:1px solid #bbb;padding-top:12px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:32px}article{background:#fffaf0;padding:24px;border:1px solid #c9c0aa}li{margin-bottom:12px}.response{font-size:16px;color:#555;border:0;margin:16px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:8px 24px;align-items:center}.response legend{padding:0;margin-bottom:6px}.response label{cursor:pointer}.response .notes{flex:1 1 100%;display:grid;gap:4px}.response textarea{box-sizing:border-box;width:100%;font:16px/1.5 Georgia,serif;padding:8px;border:1px solid #c9c0aa;background:#fffaf0;color:#25221d}.save{margin:40px 0;font-family:system-ui,sans-serif}.save button{font:600 17px system-ui,sans-serif;padding:10px 22px;border:1px solid #25221d;background:#25221d;color:#f3eee2;border-radius:4px;cursor:pointer}.save span{display:block;margin-top:8px;color:#555}@media(max-width:700px){.pair{grid-template-columns:1fr}}@media print{section{break-inside:avoid}.save{display:none}}</style><h1>The Hollow Board</h1><p>Read each pair as mornings in the same camp. Choose the camp you would rather wake up in, and note what makes a person convincing or unconvincing. A tie is useful. When you are done, press Save my answers.</p><form id="owner-read" data-page="${hash}">${sections}<p class="save"><button type="button" id="save">Save my answers</button><span id="saved" role="status"></span></p></form><script>${script}</script></html>`;
}

/** Validate a saved response file against the page it claims to answer. */
export function parseResponses(text: string, page: string): ResponseRow[] {
  const data = JSON.parse(text) as { pageHash?: unknown; responses?: unknown };
  if (!data || typeof data !== "object" || !Array.isArray(data.responses))
    throw new Error("Response file must be {pageHash, responses:[...]}");
  if (data.pageHash !== pageHash(page))
    throw new Error(
      "Responses answer a stale page: its mornings differ from OWNER-READ.html",
    );
  const mornings = extractArticles(page).length / 2,
    seen = new Set<number>();
  return data.responses.map((raw: unknown) => {
    const r = raw as Partial<Record<keyof ResponseRow, unknown>>;
    const m = r?.morning;
    if (typeof m !== "number" || !Number.isInteger(m) || m < 1 || m > mornings)
      throw new Error(`Unknown morning ${String(m)}`);
    if (seen.has(m)) throw new Error(`Morning ${m} answered twice (duplicate)`);
    seen.add(m);
    if (r.choice !== null && !CHOICES.includes(r.choice as string))
      throw new Error(`Morning ${m}: choice must be A, B, tie or null`);
    if (typeof r.notes !== "string")
      throw new Error(`Morning ${m}: notes must be text`);
    return { morning: m, choice: r.choice as Choice | null, notes: r.notes };
  });
}

const sourceOf = (label: string): "live" | "planner" => {
  if (label === LIVE) return "live";
  if (label === PLANNER) return "planner";
  throw new Error(`Unknown source label ${label}`);
};
/** Map each answer through the kept A/B mapping; mornings left blank count as unanswered. */
export function unblind(
  mapping: SourceMapRow[],
  rows: ResponseRow[],
): OwnerTally {
  const tally: OwnerTally = { live: 0, planner: 0, tie: 0, unanswered: 0 };
  for (const { morning, A, B } of mapping) {
    const choice = rows.find((r) => r.morning === morning)?.choice ?? null;
    if (choice === null) tally.unanswered++;
    else if (choice === "tie") tally.tie++;
    else tally[sourceOf(choice === "A" ? A : B)]++;
  }
  return tally;
}

export function ownerReadLine(r: OwnerTally | null): string {
  if (!r) return "Owner blind read: pending.";
  const answered = r.live + r.planner + r.tie,
    n = answered + r.unanswered;
  return `Owner blind read: recorded ${answered}/${n} - live ${r.live}, planner ${r.planner}, tie ${r.tie} (owner, felt, n=${n}).`;
}
