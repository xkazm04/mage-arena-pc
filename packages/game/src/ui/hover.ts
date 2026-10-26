/** What a button shows this frame: the kit region to skin it with, and whether it needs a hover outline of its own. */
export interface ButtonLook {
  region: string;
  /** Cards have no hover region in the kit, so a hovered card is outlined instead of re-skinned. */
  outline: boolean;
}
type Looked = { id: string; kind: string; disabled: boolean };

/** The kit family of a button kind: a slot, a tab, a card, or the plain button. */
export const baseOf = (kind: string): "slot" | "tab" | "card" | "button" =>
  kind === "slot" ? "slot" : kind === "tab" ? "tab" : kind.startsWith("card.") ? "card" : "button";

/** Every interactive kind answers the pointer: disabled beats pressed beats hover, and a card gets the outline. */
export function buttonLook(b: Looked, pressedId: string | undefined, hoverId: string): ButtonLook {
  const base = baseOf(b.kind);
  const state = b.disabled
    ? base === "slot" ? "locked" : "disabled"
    : pressedId === b.id ? "pressed" : b.id === hoverId ? "hover" : "normal";
  return {
    region: base === "card" ? b.kind : `${base}.${state === "pressed" && base !== "button" ? "hover" : state}`,
    outline: base === "card" && state === "hover",
  };
}

/** The paged lists: journal cards, the cast, skill spells, camp actions, training. `load-previous` is not a pager. */
const pagers = /^(cards|cast|skills|actions|training)-(next|previous)$/;
/** The wheel pages a list through the screen's own Previous/Next buttons, so every pager keeps one rule. */
export function wheelPager(buttons: { id: string; disabled: boolean }[], deltaY: number): string | undefined {
  if (!deltaY) return undefined;
  const way = deltaY > 0 ? "next" : "previous";
  return buttons.find((b) => !b.disabled && pagers.test(b.id) && b.id.endsWith(`-${way}`))?.id;
}
