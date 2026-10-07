import { it, expect } from "vitest";
import { createState } from "@mage/core";
import { experimentTables } from "./experiment.ts";
import { readNights } from "./evidence.ts";
import { auditNight } from "./audit.ts";
import { decodeJudgments } from "./judge-format.ts";

it("maps compact diagnostics in the fixed five-question order", () => {
  expect(
    decodeJudgments(
      {
        judgments: {
          nysa: { checks: "YYNYN", reason: "voice and continuity" },
        },
      },
      "compact-v2",
    ),
  ).toEqual([
    {
      character: "nysa",
      goal: true,
      values: true,
      voice: false,
      knowledge: true,
      continuity: false,
      reason: "voice and continuity",
    },
  ]);
});

it("pins the historical request and census, rejecting planted metric and input tampering", () => {
  const t = experimentTables(),
    row = readNights("docs/waves/W1-evidence/sonnet/nights.jsonl")[0];
  const state = createState(t, row.seed, row.day);
  expect(auditNight(t, state, row).result.state).toEqual(row.state);
  const census = structuredClone(row);
  census.verdicts[0].rejected = true;
  expect(() => auditNight(t, state, census)).toThrow(
    "Rejection census mismatch",
  );
  const group = structuredClone(row);
  group.groups[0].members.pop();
  expect(() => auditNight(t, state, group)).toThrow(
    "Group membership mismatch",
  );
  const request = structuredClone(row);
  request.groups[0].request.system = "tampered";
  expect(() => auditNight(t, state, request)).toThrow(
    "Provider request mismatch",
  );
});
