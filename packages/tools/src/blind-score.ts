import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ownerReadLine,
  pageHash,
  parseResponses,
  unblind,
  type OwnerTally,
  type SourceMapRow,
} from "./blind-pair.ts";

// npm run blind:score -- <owner-read-responses.json>
// Unblinds the owner's saved answers through blind-source-map.json and records the verdict
// in owner-read-result.json, which report.ts states in the W1 report.
export const RESULT = "owner-read-result.json";
export interface OwnerResult extends OwnerTally {
  label: string;
  pageHash: string;
  responses: { morning: number; choice: string | null; source: string | null; notes: string }[];
}

export function scoreOwnerRead(
  responsesText: string,
  page: string,
  mapping: SourceMapRow[],
): OwnerResult {
  const rows = parseResponses(responsesText, page);
  const tally = unblind(mapping, rows);
  return {
    label: `owner, felt, n=${mapping.length}`,
    pageHash: pageHash(page),
    ...tally,
    responses: mapping.map(({ morning, A, B }) => {
      const r = rows.find((x) => x.morning === morning);
      const choice = r?.choice ?? null;
      return {
        morning,
        choice,
        source: choice === "A" ? A : choice === "B" ? B : null,
        notes: r?.notes ?? "",
      };
    }),
  };
}

/** The recorded tally, or null while the owner read is pending. */
export function readOwnerResult(root: string): OwnerTally | null {
  const path = join(root, RESULT);
  if (!existsSync(path)) return null;
  const r = JSON.parse(readFileSync(path, "utf8")) as OwnerResult;
  return { live: r.live, planner: r.planner, tie: r.tie, unanswered: r.unanswered };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const input = process.argv[2];
  if (!input) throw new Error("Usage: npm run blind:score -- <owner-read-responses.json>");
  const root = resolve("docs/waves/W1-evidence");
  const result = scoreOwnerRead(
    readFileSync(input, "utf8"),
    readFileSync(join(root, "OWNER-READ.html"), "utf8"),
    JSON.parse(readFileSync(join(root, "blind-source-map.json"), "utf8")) as SourceMapRow[],
  );
  writeFileSync(join(root, RESULT), JSON.stringify(result, null, 2) + "\n");
  console.log(ownerReadLine(result));
}
