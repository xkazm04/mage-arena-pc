/** The hours-left chip ("7h") follows the wall clock, so a screenshot lands on 7h or 6h by timing. */
const clockChip = /^\d+h$/;
/** The pin keeps the chip's place and size, not its number; the camp flow asserts the settled value. */
export function pinTexts<T extends { text: string }>(texts: readonly T[]): T[] {
  return texts.map((t) => (clockChip.test(t.text) ? { ...t, text: "Nh" } : t));
}
