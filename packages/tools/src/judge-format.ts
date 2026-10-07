export const judgeQuestions = [
  "goal",
  "values",
  "voice",
  "knowledge",
  "continuity",
] as const;
export interface CharacterJudgment {
  character: string;
  goal: boolean;
  values: boolean;
  voice: boolean;
  knowledge: boolean;
  continuity: boolean;
  reason: string;
}
export function decodeJudgments(
  raw: unknown,
  version?: string,
): CharacterJudgment[] {
  if (version !== "compact-v2")
    return (raw as { judgments: CharacterJudgment[] }).judgments;
  return Object.entries(
    (raw as { judgments: Record<string, { checks: string; reason: string }> })
      .judgments,
  ).map(([character, j]) => ({
    character,
    ...Object.fromEntries(
      judgeQuestions.map((q, i) => [q, j.checks[i] === "Y"]),
    ),
    reason: j.reason,
  })) as CharacterJudgment[];
}
