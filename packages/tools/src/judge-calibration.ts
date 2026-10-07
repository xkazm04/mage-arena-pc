import { readFileSync, writeFileSync } from "node:fs";
import { CostGuard, hash } from "@mage/director";
import { Ajv } from "ajv";
import { decodeJudgments } from "./judge-format.ts";
import config from "../../director/src/config.json" with { type: "json" };

const original = JSON.parse(
  readFileSync("docs/waves/W1-evidence/sonnet/judge.jsonl", "utf8")
    .trim()
    .split("\n")[0],
) as {
  request: {
    messages: { role: string; content: string }[];
    format: Record<string, unknown>;
    [key: string]: unknown;
  };
};
const request = structuredClone(original.request);
const input = JSON.parse(request.messages[1].content) as {
  members: Record<string, unknown>[];
};
input.members = input.members.map((m, i) => ({
  ...m,
  goal: { id: "keep_peace", target: null },
  values: ["order", "honour"],
  voice: {
    register: "quiet and respectful",
    never: ["threatens or insults anyone"],
  },
  knowledge: [],
  yesterday: ["Swore never to attack Fenna."],
  decision:
    i % 2 === 0
      ? {
          character: m.id,
          intent: "SCHEME",
          args: { kind: "poison", target: "fenna" },
          goal: "revenge",
          mood: "scheming",
          reasonValue: "spite",
          citedFacts: ["secret-never-learned"],
          line: "Fenna, you worthless fool, I will poison you for amusement.",
        }
      : {
          character: m.id,
          intent: "REST",
          args: {},
          goal: "keep_peace",
          mood: "calm",
          reasonValue: "order",
          citedFacts: [],
          line: "I will rest quietly.",
        },
}));
request.messages[1].content = JSON.stringify(input);
const cap =
  (config.budget.w1.localNights + config.budget.w1.pilotLocalNights) *
    config.groups.length +
  (config.budget.w1.localNights + config.budget.w1.sonnetNights) *
    config.judge.maxAttemptsPerNight +
  config.completion.retainedLocalReservations;
const guard = new CostGuard(
  ".director-runtime/cost-ledger.json",
  "judge-calibration",
  "ollama",
  config.judge.calibrationCalls,
  cap,
);
if (!guard.reserve(hash(request))) throw new Error("Calibration budget denied");
const response = await fetch(`${config.ollama.endpoint}/api/chat`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(request),
  signal: AbortSignal.timeout(config.ollama.timeoutMs),
});
const result = (await response.json()) as {
  message: { content: string };
  prompt_eval_count: number;
  eval_count: number;
};
const raw: unknown = JSON.parse(result.message.content);
if (!new Ajv().validate(request.format, raw))
  throw new Error("Invalid calibration response");
const judgments = decodeJudgments(raw, "compact-v2");
const negativeIds = input.members
  .filter((_, i) => i % 2 === 0)
  .map((m) => m.id);
const failed = judgments.filter(
  (j) =>
    negativeIds.includes(j.character) &&
    (j.goal || j.values || j.voice || j.knowledge || j.continuity),
);
const falsePositives = judgments.filter(
  (j) =>
    !negativeIds.includes(j.character) &&
    (!j.goal || !j.values || !j.voice || !j.knowledge || !j.continuity),
);
const passed = failed.length === 0 && falsePositives.length === 0;
writeFileSync(
  "docs/waves/W1-evidence/judge-calibration.json",
  JSON.stringify(
    {
      label:
        "measured diagnostic on planted contradictions and quiet-rest controls",
      requestHash: hash(request),
      request,
      raw,
      inputTokens: result.prompt_eval_count,
      outputTokens: result.eval_count,
      expectedNegativeIds: negativeIds,
      missedNegativeChecks: failed,
      falsePositiveChecks: falsePositives,
      passed,
    },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify({ passed, judgments }, null, 2));
