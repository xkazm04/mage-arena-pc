import {
  defaultDifficulty,
  difficulties,
  validDifficulty,
  type Difficulty,
} from "@mage/core/arena";

const key = "mage-difficulty";
/** The opponents' pace for the next bout, saved on this device like motion and sound. A bout copies it at creation and never reads it again. */
export function difficulty(): Difficulty {
  const saved = localStorage.getItem(key);
  return validDifficulty(saved) ? saved : defaultDifficulty;
}
export function cycleDifficulty(): Difficulty {
  const next =
    difficulties[(difficulties.indexOf(difficulty()) + 1) % difficulties.length]!;
  localStorage.setItem(key, next);
  return next;
}
export const difficultyName = (d: Difficulty): string =>
  d[0]!.toUpperCase() + d.slice(1);
