import { metrics } from "./layout.ts";
export interface Pad {
  axes: readonly number[];
  buttons: readonly { pressed: boolean; value: number }[];
  connected: boolean;
  index: number;
}
export const pressed = (pad: Pad, index: number) =>
  !!pad.buttons[index]?.pressed || (pad.buttons[index]?.value ?? 0) > 0.5;
export function stick(pad: Pad, index: number) {
  const x = pad.axes[index] ?? 0,
    y = pad.axes[index + 1] ?? 0,
    n = Math.hypot(x, y);
  if (n <= metrics.gamepadDeadZone) return { x: 0, y: 0 };
  const length = Math.min(
    1,
    (n - metrics.gamepadDeadZone) / (1 - metrics.gamepadDeadZone),
  );
  return { x: (x / n) * length, y: (y / n) * length };
}
export interface PadEvents {
  direction?: "left" | "right" | "up" | "down";
  accept: boolean;
  release: boolean;
  back: boolean;
  pause: boolean;
  active: boolean;
}
/** One edge stream across screens: held A cannot confirm two successive menus. */
export class PadNavigation {
  private previous: boolean[] = [];
  private direction = "";
  private repeatAt = 0;
  poll(pad: Pad | undefined, now: number): PadEvents {
    const e: PadEvents = {
      accept: false,
      release: false,
      back: false,
      pause: false,
      active: false,
    };
    if (!pad?.connected) {
      e.release = !!this.previous[0];
      this.previous = [];
      this.direction = "";
      return e;
    }
    const s = stick(pad, 0),
      buttons = pad.buttons.map((_, i) => pressed(pad, i));
    const direction = buttons[14]
      ? "left"
      : buttons[15]
        ? "right"
        : buttons[12]
          ? "up"
          : buttons[13]
            ? "down"
            : Math.abs(s.x) > Math.abs(s.y) && Math.abs(s.x) > 0.5
              ? s.x < 0
                ? "left"
                : "right"
              : Math.abs(s.y) > 0.5
                ? s.y < 0
                  ? "up"
                  : "down"
                : undefined;
    e.active =
      buttons.some(Boolean) ||
      pad.axes.some((n) => Math.abs(n) > metrics.gamepadDeadZone);
    e.accept = !!buttons[0] && !this.previous[0];
    e.release = !buttons[0] && !!this.previous[0];
    e.back = !!buttons[1] && !this.previous[1];
    e.pause = !!buttons[9] && !this.previous[9];
    if (direction !== this.direction) {
      this.direction = direction ?? "";
      this.repeatAt = now + metrics.navigationInitialMs;
      e.direction = direction;
    } else if (direction && now >= this.repeatAt) {
      e.direction = direction;
      this.repeatAt = now + metrics.navigationRepeatMs;
    }
    this.previous = buttons;
    return e;
  }
}
