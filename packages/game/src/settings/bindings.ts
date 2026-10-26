/**
 * The keyboard binding table: one record of action -> key code drives ArenaInput, the listen minigame, the Controls
 * screen and every control hint, so a rebind changes the input and the copy that explains it together. The defaults
 * are exactly the codes the game read before the table existed, so replays and frames are unchanged. Mouse buttons
 * and the pad layout stay fixed; their hint text lives here too. Pure: no DOM, no storage.
 */

import { padNames, type PadFamily } from "./pad-glyphs.ts";

export const actions = [
  "moveUp",
  "moveDown",
  "moveLeft",
  "moveRight",
  "roll",
  "sprint",
  "slot1",
  "slot2",
  "slot3",
  "slot4",
  "slot5",
  "listenHold",
] as const;
export type Action = (typeof actions)[number];
export type Bindings = Readonly<Record<Action, string>>;

export const defaultBindings: Bindings = Object.freeze({
  moveUp: "KeyW",
  moveDown: "KeyS",
  moveLeft: "KeyA",
  moveRight: "KeyD",
  roll: "Space",
  sprint: "ShiftLeft",
  slot1: "Digit1",
  slot2: "Digit2",
  slot3: "Digit3",
  slot4: "Digit4",
  slot5: "Digit5",
  listenHold: "Space",
});

export const actionNames: Readonly<Record<Action, string>> = {
  moveUp: "Move up",
  moveDown: "Move down",
  moveLeft: "Move left",
  moveRight: "Move right",
  roll: "Roll",
  sprint: "Sprint",
  slot1: "Spell 1",
  slot2: "Spell 2",
  slot3: "Spell 3",
  slot4: "Spell 4",
  slot5: "Spell 5",
  listenHold: "Listen (night)",
};

/** The spell-slot actions in slot order. */
export const slotActions = [
  "slot1",
  "slot2",
  "slot3",
  "slot4",
  "slot5",
] as const;

/**
 * Where each action is read. Two actions may share a key only when no screen reads both: roll (arena) and
 * listenHold (listen) both default to Space. The listen screen moves cover with the move-left/right and
 * first three spell keys.
 */
const screensOf: Readonly<Record<Action, readonly ("arena" | "listen")[]>> = {
  moveUp: ["arena"],
  moveDown: ["arena"],
  moveLeft: ["arena", "listen"],
  moveRight: ["arena", "listen"],
  roll: ["arena"],
  sprint: ["arena"],
  slot1: ["arena", "listen"],
  slot2: ["arena", "listen"],
  slot3: ["arena", "listen"],
  slot4: ["arena"],
  slot5: ["arena"],
  listenHold: ["listen"],
};
const shareScreen = (a: Action, b: Action) =>
  screensOf[a].some((s) => screensOf[b].includes(s));

const lab = "is a Combat Feel Lab hotkey";
/** Keys the shell, the art debug overlay, the bout reader and the Combat Feel Lab already own (lab-mode.ts labKey). */
export const reservedCodes: Readonly<Record<string, string>> = {
  Escape: "Escape pauses and goes back",
  Tab: "Tab moves through menus",
  Enter: "Enter chooses in menus",
  NumpadEnter: "Enter chooses in menus",
  F8: "F8 toggles the art debug overlay",
  BracketLeft: "[ pages the art debug overlay",
  BracketRight: "] pages the art debug overlay",
  Comma: ", steps the bout reader",
  KeyR: `R ${lab}`,
  KeyP: `P ${lab}`,
  Period: `. ${lab}`,
  KeyG: `G ${lab}`,
  KeyH: `H ${lab}`,
  KeyT: `T ${lab}`,
  KeyL: `L ${lab}`,
  KeyB: `B ${lab}`,
  KeyV: `V ${lab}`,
};

/** Left and right modifiers count as one key: a table bound to ShiftLeft also answers ShiftRight. */
const keyOf = (code: string) =>
  code.replace(/^(Shift|Control|Alt|Meta)(Left|Right)$/, "$1");
/** Whether a pressed code is the bound one. */
export const matches = (bound: string, code: string) =>
  keyOf(bound) === keyOf(code);
/** The action of `wanted` a pressed code triggers, if any. */
export const actionFor = <A extends Action>(
  table: Bindings,
  code: string,
  wanted: readonly A[],
): A | undefined => wanted.find((a) => matches(table[a], code));

/** Keys whose browser default (scroll, quick find) must not run while the arena reads them. */
const browserKeys = new Set([
  "Space",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  "Slash",
  "Quote",
  "Backspace",
]);
/** Today's always-blocked keys, kept whatever the table says. */
const alwaysBlocked = new Set(["Space", "ArrowUp", "ArrowDown"]);
/** Whether the arena keydown must preventDefault this code. */
export function blocksDefault(table: Bindings, code: string): boolean {
  if (alwaysBlocked.has(code)) return true;
  return (
    browserKeys.has(code) &&
    actions.some((a) => a !== "listenHold" && table[a] === code)
  );
}

/** Pairs of actions a screen reads together that hold the same key. */
export function conflicts(table: Bindings): [Action, Action][] {
  const out: [Action, Action][] = [];
  actions.forEach((a, i) => {
    for (const b of actions.slice(i + 1))
      if (shareScreen(a, b) && matches(table[a], table[b])) out.push([a, b]);
  });
  return out;
}

export type RebindResult =
  | { ok: true; table: Bindings; swapped?: Action; swaps: Action[] }
  | { ok: false; reason: string };

/**
 * Binds `code` to `action`. An action on the same screen that held the code takes `action`'s old key (a swap);
 * a reserved key, or a swap that would leave two actions on one key, is refused and the table is unchanged.
 */
export function rebind(
  table: Bindings,
  action: Action,
  code: string,
): RebindResult {
  const reserved = reservedCodes[code];
  if (reserved)
    return { ok: false, reason: `${reserved}, so it cannot be rebound.` };
  if (!code) return { ok: false, reason: "No key was pressed." };
  const old = table[action];
  const swaps = actions.filter(
    (b) => b !== action && shareScreen(action, b) && matches(table[b], code),
  );
  const next: Record<Action, string> = { ...table, [action]: code };
  for (const b of swaps) next[b] = old;
  const clash = conflicts(next)[0];
  if (clash)
    return {
      ok: false,
      reason: `That would leave ${actionNames[clash[0]]} and ${actionNames[clash[1]]} on the same key.`,
    };
  return { ok: true, table: Object.freeze(next), swapped: swaps[0], swaps };
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
/**
 * A stored table merged over the defaults. An unknown action, a non-string, a reserved key or a repeated key
 * makes the whole record fall back to the defaults (a half-applied table could strand an action).
 */
export function validBindings(raw: unknown): Bindings {
  if (!isObject(raw)) return defaultBindings;
  const next: Record<Action, string> = { ...defaultBindings };
  for (const [k, v] of Object.entries(raw)) {
    if (!(actions as readonly string[]).includes(k)) return defaultBindings;
    if (typeof v !== "string" || !v || reservedCodes[v]) return defaultBindings;
    next[k as Action] = v;
  }
  return conflicts(next).length ? defaultBindings : Object.freeze(next);
}

const symbols: Record<string, string> = {
  Space: "Space",
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  Semicolon: ";",
  Quote: "'",
  Backslash: "\\",
  Slash: "/",
  Comma: ",",
  Period: ".",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  CapsLock: "Caps",
  Shift: "Shift",
  Control: "Ctrl",
  Alt: "Alt",
  Meta: "Meta",
};
/** The short label a hint shows for a key code. */
export function label(code: string): string {
  const k = keyOf(code);
  return (
    symbols[k] ??
    /^Key([A-Z])$/.exec(k)?.[1] ??
    /^Digit(\d)$/.exec(k)?.[1] ??
    k.replace(/^Numpad(.+)$/, "Num $1")
  );
}

/** The move keys up-left-down-right: "WASD", or spaced when any label is longer than one character. */
const moveKeys = (table: Bindings, gap: string) => {
  const parts = (["moveUp", "moveLeft", "moveDown", "moveRight"] as const).map(
    (a) => label(table[a]),
  );
  return parts.every((p) => p.length === 1) ? parts.join(gap) : parts.join(" ");
};
/** The first `count` spell keys: "1-5" when they are the digits in order, else each label. */
export function spellKeys(table: Bindings, count: number, dash = "-"): string {
  const parts = slotActions.slice(0, count).map((a) => label(table[a]));
  return parts.every((p, i) => p === String(i + 1))
    ? `1${dash}${count}`
    : parts.join(" ");
}

/** The ui modality ("keyboard", "mouse" or "gamepad"); only the pad changes the copy. */
export type HintModality = string;
/** The in-bout control line. `count` is the slots the player's school offers (Water 4, Fire/Air 5). */
export function hudHint(
  table: Bindings,
  modality: HintModality,
  count: number,
  family: PadFamily = "xbox",
): string {
  if (modality === "gamepad") {
    const n = padNames(family);
    return `Left stick move  /  Right stick aim  /  ${n.rt} cast  /  ${n.lt} absorb  /  ${n.confirm} roll  /  ${n.lb} ${n.rb} spells`;
  }
  return `${moveKeys(table, "")} move  /  ${label(table.sprint)} sprint  /  ${label(table.roll)} roll      LMB cast  /  RMB absorb  /  ${spellKeys(table, count)} spells`;
}

/** The settings screen's control list: label, then keyboard  /  pad. */
export function settingsLines(
  table: Bindings,
  family: PadFamily = "xbox",
): [string, string][] {
  const n = padNames(family);
  return [
    ["MOVE", `${moveKeys(table, " ")}  /  Left stick`],
    ["AIM & CAST", `Mouse + left button  /  Right stick + ${n.rt}`],
    ["ABSORB", `Right button held  /  ${n.lt} held`],
    [
      "ROLL & SPRINT",
      `${label(table.roll)} + ${label(table.sprint)}  /  ${n.confirm} + left stick press`,
    ],
    [
      "SPELL SLOTS",
      `${spellKeys(table, 5, "–")} or wheel  /  ${n.lb} and ${n.rb}`,
    ],
    ["MENUS", `Arrows + Enter  /  D-pad + ${n.confirm}, ${n.back} back`],
  ];
}

/** The listen minigame's footer and its cover buttons' subtitle. */
export function listenHint(table: Bindings) {
  const hold = label(table.listenHold).toUpperCase(),
    move = `${label(table.moveLeft)} / ${label(table.moveRight)}`;
  return {
    footer: `${hold} held  Listen     ${move}  Move     Release ${hold}  Hide`,
    cover: `${move} or ${spellKeys(table, 3, "–")} changes cover`,
  };
}

/** What a keydown does on the listen screen: start holding, or move to a cover lane (0..2). */
export function listenKey(
  table: Bindings,
  code: string,
  lane: number,
): { hold: true } | { lane: number } | undefined {
  if (matches(table.listenHold, code)) return { hold: true };
  const a = actionFor(table, code, [
    "moveLeft",
    "moveRight",
    "slot1",
    "slot2",
    "slot3",
  ] as const);
  if (!a) return undefined;
  const next =
    a === "moveLeft"
      ? lane - 1
      : a === "moveRight"
        ? lane + 1
        : slotActions.indexOf(a);
  return { lane: Math.max(0, Math.min(2, next)) };
}

/** Menu and pause keys are fixed (reserved above); their copy lives beside the table. */
export const menuHint = (modality: HintModality, family: PadFamily = "xbox") =>
  modality === "gamepad"
    ? `D-PAD  Navigate     ${padNames(family).confirm.toUpperCase()}  Choose     ${padNames(family).back.toUpperCase()}  Back`
    : "ARROWS / TAB  Navigate     ENTER  Choose     ESC  Back";
export const pauseHint = (
  modality: HintModality,
  family: PadFamily = "xbox",
) =>
  modality === "gamepad"
    ? `${padNames(family).menu.toUpperCase()}  Pause`
    : "ESC / START  Pause";
