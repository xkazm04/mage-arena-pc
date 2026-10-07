import type { Tables } from "@mage/core";
export function itemSchema(t: Tables) {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "character",
      "intent",
      "args",
      "goal",
      "mood",
      "reasonValue",
      "citedFacts",
      "line",
    ],
    properties: {
      character: { type: "string" },
      intent: { enum: Object.keys(t.intents) },
      args: {
        type: "object",
        additionalProperties: false,
        properties: {
          target: { type: "string" },
          stat: { enum: t.rules.stats.names },
          kind: { enum: Object.keys(t.rules.schemes) },
          topic: { enum: Object.keys(t.rules.schemes.rumour.reactions) },
          factId: { type: "string" },
          toTent: { enum: t.schools.map((s) => s.tent) },
          terms: { enum: ["favour_for_training", "back_entrant"] },
        },
      },
      goal: { enum: Object.keys(t.goals) },
      mood: { enum: t.characters.moods },
      reasonValue: { enum: t.characters.valueVocabulary },
      citedFacts: {
        type: "array",
        items: { type: "string" },
        maxItems: t.rules.line.maxCitedFacts,
        uniqueItems: true,
      },
      // Text safety is a separate repair boundary, so an otherwise legal act survives a bad line.
      line: { type: "string" },
    },
  };
}
export function groupSchema(t: Tables, group: string, members: string[]) {
  const item = itemSchema(t);
  return {
    type: "object",
    additionalProperties: false,
    required: ["group", "decisions"],
    properties: {
      group: { const: group },
      decisions: {
        type: "array",
        minItems: members.length,
        maxItems: members.length,
        items: {
          ...item,
          properties: {
            ...item.properties,
            character: { enum: members },
            line: { type: "string", maxLength: t.rules.line.maxLength },
          },
        },
      },
    },
  };
}
