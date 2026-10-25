// The closed form of every contest the camp and parley roll: `bonus` plus one die of `sides` beats `dc`. Pure.

/** What the player is shown before committing hours: the chance the contest succeeds, and for a scheme the chance of the stocks. */
export interface Odds {
  success: number;
  caught: number | null;
}
/** P(bonus + die > dc) for a die uniform on 1..sides; a die at or below `failsAtOrBelow` fails whatever the score. */
export function contestOdds(c: { bonus: number; dc: number; sides: number; failsAtOrBelow?: number }): number {
  const needAbove = Math.max(c.dc - c.bonus, c.failsAtOrBelow ?? 0, 0);
  return Math.max(0, c.sides - needAbove) / c.sides;
}
