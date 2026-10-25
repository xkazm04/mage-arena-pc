import type { NightProgress } from "@mage/director";

/** What the dawn button says about the Director's night: pure, from the season view. */
export interface NightStatus {
  label: string;
  subtitle: string;
  /** Dawn stays the player's choice even while tents are still deciding. */
  enabled: boolean;
  /** A line beside the button: tents still deciding, or tents that fell back to habit. */
  hint: string | null;
}
const board = "Read the Hollow Board";
const tents = (n: number) => `${n} ${n === 1 ? "tent" : "tents"}`;

export function nightStatus(view: { nightFinished: boolean; night: NightProgress | null }): NightStatus {
  const status: NightStatus = { label: "Meet the morning", subtitle: board, enabled: true, hint: null };
  const n = view.night;
  if (!n || n.plannerMode) return status;
  const habit = n.groups.filter((g) => g.state === "budget" || g.state === "error" || g.state === "planner").length;
  if (n.pending) {
    const undecided = n.total - n.decided;
    status.hint = `The camp is still deciding: ${n.decided} of ${tents(n.total)}`;
    if (view.nightFinished) status.subtitle = `Dawn now: ${tents(undecided + habit)} will follow habit`;
  } else if (habit) status.hint = `${habit} of ${tents(n.total)} follow habit tonight`;
  return status;
}

/** A poll repaints the camp and listen screens when the night ledger moved. */
export function isNightChanged(prev: NightProgress | null, next: NightProgress | null) {
  if (!prev || !next) return prev !== next;
  return (
    prev.total !== next.total ||
    prev.decided !== next.decided ||
    prev.pending !== next.pending ||
    prev.groups.some((g, i) => g.state !== next.groups[i]?.state)
  );
}
