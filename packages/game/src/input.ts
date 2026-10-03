import { idleInput, type InputFrame, type Vec } from "@mage/core/arena";
import { cameraMetrics, clientToGround, type Camera } from "./camera.ts";
import { pressed, stick, type Pad } from "./ui/gamepad.ts";
export class ArenaInput {
  private readonly lifetime = new AbortController();
  private readonly captures = new Set<number>();
  readonly keys = new Set<string>();
  aim: Vec = { x: 23, y: 10 };
  cast = false;
  absorb = false;
  slot = 0;
  private pointer?: Vec;
  private rollQueued = false;
  private castQueued = false;
  private padMove: Vec = { x: 0, y: 0 };
  private padCast = false;
  private padAbsorb = false;
  private padSprint = false;
  private padPrevious: boolean[] = [];
  private padAim: Vec = { x: 1, y: 0 };
  private usingPad = false;
  constructor(
    private canvas: HTMLCanvasElement,
    private camera: () => Camera,
    private enabled: () => boolean = () => true,
    private blocked: () => boolean = () => false,
    private origin: () => Vec = () => this.camera().centre,
  ) {
    const signal = this.lifetime.signal;
    const initialPad = Array.from(navigator.getGamepads?.() ?? []).find(
      (p) => p?.connected && p.mapping === "standard",
    );
    if (initialPad)
      this.padPrevious = initialPad.buttons.map((_, i) =>
        pressed(initialPad, i),
      );
    const listen = <K extends keyof WindowEventMap>(
      type: K,
      handler: (e: WindowEventMap[K]) => void,
    ) => window.addEventListener(type, handler, { signal });
    listen("keydown", (e) => {
      if (e.defaultPrevented || !this.enabled()) return;
      if (["Space", "ArrowUp", "ArrowDown"].includes(e.code))
        e.preventDefault();
      this.keys.add(e.code);
      if (e.code === "Space" && !e.repeat) this.rollQueued = true;
      if (/^Digit[1-4]$/.test(e.code)) this.slot = Number(e.code.slice(-1)) - 1;
    });
    listen("keyup", (e) => this.keys.delete(e.code));
    canvas.addEventListener("pointermove", (e) => this.point(e), { signal });
    canvas.addEventListener(
      "pointerdown",
      (e) => {
        if (!this.enabled() || this.blocked()) return;
        this.point(e);
        if (e.button === 0) {
          this.cast = true;
          this.castQueued = true;
        }
        if (e.button === 2) this.absorb = true;
        this.captures.add(e.pointerId);
        canvas.setPointerCapture(e.pointerId);
        canvas.focus();
        e.preventDefault();
      },
      { signal },
    );
    listen("pointerup", (e) => {
      if (e.button === 0) this.cast = false;
      if (e.button === 2) this.absorb = false;
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault(), {
      signal,
    });
    canvas.addEventListener(
      "wheel",
      (e) => {
        if (!this.enabled()) return;
        e.preventDefault();
        this.slot = (this.slot + Math.sign(e.deltaY) + 4) % 4;
      },
      { passive: false, signal },
    );
    listen("blur", () => this.clear());
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) this.clear();
      },
      { signal },
    );
  }
  dispose(): void {
    this.clear();
    this.lifetime.abort();
    for (const id of this.captures)
      if (this.canvas.hasPointerCapture(id))
        this.canvas.releasePointerCapture(id);
    this.captures.clear();
  }
  private point(e: PointerEvent): void {
    this.usingPad = false;
    this.pointer = { x: e.clientX, y: e.clientY };
    this.refreshAim();
  }
  refreshAim(): void {
    if (this.usingPad) {
      const p = this.origin();
      this.aim = { x: p.x + this.padAim.x * 20, y: p.y + this.padAim.y * 20 };
    } else if (this.pointer)
      this.aim = clientToGround(
        this.pointer,
        this.canvas.getBoundingClientRect(),
        this.camera(),
      );
  }
  clear(): void {
    this.keys.clear();
    this.cast = false;
    this.absorb = false;
    this.rollQueued = false;
    this.castQueued = false;
    this.padMove = { x: 0, y: 0 };
    this.padCast = false;
    this.padAbsorb = false;
    this.padSprint = false;
  }
  updateGamepad(pad: Pad | undefined): void {
    if (!pad?.connected) {
      this.padMove = { x: 0, y: 0 };
      this.padCast = false;
      this.padAbsorb = false;
      this.padSprint = false;
      this.padPrevious = [];
      return;
    }
    const buttons = pad.buttons.map((_, i) => pressed(pad, i));
    if (this.enabled()) {
      this.padMove = stick(pad, 0);
      this.padCast = !!buttons[7];
      this.padAbsorb = !!buttons[6];
      this.padSprint = !!buttons[10];
      if (buttons[0] && !this.padPrevious[0]) this.rollQueued = true;
      if (buttons[4] && !this.padPrevious[4]) this.slot = (this.slot + 3) % 4;
      if (buttons[5] && !this.padPrevious[5]) this.slot = (this.slot + 1) % 4;
      const aim = stick(pad, 2);
      if (aim.x || aim.y) {
        const m = cameraMetrics(this.camera()),
          x = aim.x / m.pxPerMetreX,
          y = aim.y / m.pxPerMetreY,
          n = Math.hypot(x, y);
        this.padAim = { x: x / n, y: y / n };
        this.usingPad = true;
      }
    }
    this.padPrevious = buttons;
  }
  frame(): InputFrame {
    if (!this.enabled()) {
      this.clear();
      return idleInput(this.aim);
    }
    this.refreshAim();
    const frame = {
      ...idleInput(this.aim),
      slot: this.slot,
      cast: this.cast || this.castQueued || this.padCast,
      absorb: this.absorb || this.padAbsorb,
      move: {
        x: Math.max(
          -1,
          Math.min(
            1,
            Number(this.keys.has("KeyD")) -
              Number(this.keys.has("KeyA")) +
              this.padMove.x,
          ),
        ),
        y: Math.max(
          -1,
          Math.min(
            1,
            Number(this.keys.has("KeyS")) -
              Number(this.keys.has("KeyW")) +
              this.padMove.y,
          ),
        ),
      },
      roll: this.keys.has("Space") || this.rollQueued,
      sprint:
        this.keys.has("ShiftLeft") ||
        this.keys.has("ShiftRight") ||
        this.padSprint,
    };
    this.rollQueued = false;
    this.castQueued = false;
    return frame;
  }
}
