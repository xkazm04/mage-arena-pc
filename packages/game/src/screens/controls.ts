import { colours } from "../ui/kit.ts";
import {
  actionNames,
  actions,
  defaultBindings,
  label,
  menuHint,
  rebind,
  type Action,
  type Bindings,
} from "../settings/bindings.ts";
import { settings as current, updateSettings } from "../settings/settings.ts";
import type { GameShell } from "../game-shell.ts";

/** The remap screen's state: the table being edited, the action waiting for its key, and the last message. */
export interface ControlsState {
  table: Bindings;
  awaiting?: Action;
  notice?: string;
}
export type ControlsEvent =
  | { type: "select"; action: Action }
  | { type: "key"; code: string }
  | { type: "reset" };

export const initialControls = (table: Bindings): ControlsState => ({ table });

/** Pure: choose an action, then the next key binds it (Escape cancels, a reserved key is refused and keeps waiting). */
export function controlsReducer(
  s: ControlsState,
  e: ControlsEvent,
): ControlsState {
  if (e.type === "select") return { table: s.table, awaiting: e.action };
  if (e.type === "reset")
    return { table: defaultBindings, notice: "Keys reset to the defaults." };
  const action = s.awaiting;
  if (!action) return s;
  if (e.code === "Escape")
    return { table: s.table, notice: "Rebind cancelled." };
  const r = rebind(s.table, action, e.code);
  if (!r.ok) return { table: s.table, awaiting: action, notice: r.reason };
  const bound = `${actionNames[action]}: ${label(e.code)}.`;
  return {
    table: r.table,
    notice: r.swaps.length
      ? `${bound} ${r.swaps.map((b) => actionNames[b]).join(" and ")} now ${r.swaps.length > 1 ? "use" : "uses"} ${label(r.table[r.swaps[0]!])}.`
      : bound,
  };
}

/** Settings > Controls: every rebindable key, two columns; choose one and press the new key. */
export function controls(
  s: GameShell,
  state = initialControls(current().bindings),
  focus?: string,
) {
  s.scene("controls", "Keys to your hands", "PAUSED  /  SETTINGS  /  CONTROLS");
  const u = s.ui;
  u.panel(96, 242, 1728, 638);
  const apply = (event: ControlsEvent, focus: string) => {
    const next = controlsReducer(state, event);
    if (next.table !== state.table) updateSettings({ bindings: next.table });
    s.controls(next, focus);
  };
  actions.forEach((action, i) => {
    const waiting = state.awaiting === action;
    u.button(
      `bind-${action}`,
      `${actionNames[action]}:  ${waiting ? "press a key" : label(state.table[action])}`,
      132 + (i % 2) * 852,
      270 + Math.floor(i / 2) * 96,
      808,
      80,
      () => apply({ type: "select", action }, `bind-${action}`),
      waiting ? { subtitle: "Escape cancels" } : {},
    );
  });
  u.button("bind-reset", "Reset keys", 1524, 946, 300, 68, () =>
    apply({ type: "reset" }, "bind-reset"),
  );
  u.text(
    "Mouse buttons and the gamepad layout are fixed. Escape, Tab, Enter and the Combat Feel Lab keys are reserved.",
    132,
    852,
    22,
    colours.muted,
    1650,
  );
  u.onKey = (e) => {
    if (!state.awaiting || e.repeat) return false;
    apply({ type: "key", code: e.code }, `bind-${state.awaiting}`);
    return true;
  };
  s.back(() => void s.nav.back());
  s.footer(
    state.awaiting
      ? "Press the new key     ESC  Cancel"
      : menuHint(u.modality),
  );
  if (state.notice) u.notice(state.notice);
  u.end(focus);
}
