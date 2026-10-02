import {
  Application,
  BitmapText,
  Container,
  Graphics,
  type NineSliceSprite,
} from "pixi.js";
import { colours, UiKit } from "./kit.ts";
import { installFonts } from "./fonts.ts";
import {
  contains,
  metrics,
  nextFocus,
  viewportLayout,
  type Rect,
} from "./layout.ts";

export interface ButtonOptions {
  subtitle?: string;
  disabled?: boolean;
  selected?: boolean;
  tooltip?: string;
  fontSize?: number;
  icon?: string;
  kind?: string;
  hold?: (held: boolean) => void;
}
export interface Button extends Rect {
  id: string;
  label: string;
  disabled: boolean;
  tooltip: string;
  root: Container;
  ring: Graphics;
  background: NineSliceSprite;
  activate: () => void;
  hold?: (held: boolean) => void;
}
export class CanvasUI {
  readonly app = new Application();
  readonly world = new Container();
  readonly root = new Container();
  readonly content = new Container();
  readonly feedback = new Container();
  readonly cursor = new Graphics();
  readonly kit = new UiKit();
  readonly lifetime = new AbortController();
  buttons: Button[] = [];
  screen = "boot";
  focus = "";
  modality = "keyboard";
  busy = false;
  onBack: () => void = () => {};
  onKey: ((event: KeyboardEvent) => boolean) | undefined;
  onFrame: ((seconds: number, now: number) => void) | undefined;
  onGamepad: ((pad: Gamepad) => void) | undefined;
  private pointer = { x: 960, y: 540 };
  private hover = "";
  private hoverSince = 0;
  private tooltip?: Container;
  private pressed?: Button;
  private toast?: Container;
  private toastUntil = 0;
  private raf = 0;
  private previous = 0;
  private ready = false;
  private focusedBefore = "";
  layout = viewportLayout(1920, 1080);
  async init(host: HTMLElement) {
    await Promise.all([
      installFonts(),
      this.app.init({
        width: innerWidth,
        height: innerHeight,
        background: colours.ink,
        antialias: true,
        autoStart: false,
        preference: "webgl",
        resolution: Math.min(devicePixelRatio, 2),
        autoDensity: true,
      }),
    ]);
    await this.kit.load();
    host.replaceChildren(this.app.canvas);
    this.app.canvas.tabIndex = 0;
    this.app.canvas.setAttribute(
      "aria-label",
      "Mage Arena. Arrow keys or Tab to move focus, Enter to choose, Escape to return.",
    );
    this.app.stage.addChild(this.world, this.root);
    this.root.addChild(this.content, this.feedback, this.cursor);
    const signal = this.lifetime.signal;
    window.addEventListener("resize", () => this.resize(), { signal });
    this.resize();
    window.addEventListener("keydown", (e) => this.key(e), { signal });
    this.app.canvas.addEventListener(
      "pointermove",
      (e) => {
        this.modality = "mouse";
        this.point(e);
        const id = this.hit()?.id ?? "";
        if (id !== this.hover) {
          this.hover = id;
          this.hoverSince = performance.now();
        }
        if (id) this.focus = id;
      },
      { signal },
    );
    this.app.canvas.addEventListener(
      "pointerdown",
      (e) => {
        this.modality = "mouse";
        this.point(e);
        this.app.canvas.focus();
        if (e.button !== 0) return;
        const b = this.hit();
        this.pressed = b;
        if (b) {
          this.focus = b.id;
          b.hold?.(true);
          e.preventDefault();
        }
      },
      { signal },
    );
    window.addEventListener(
      "pointerup",
      (e) => {
        this.point(e);
        const b = this.pressed;
        this.pressed = undefined;
        b?.hold?.(false);
        if (b && this.hit()?.id === b.id && !b.hold) this.activate(b.id);
      },
      { signal },
    );
    window.addEventListener("blur", () => this.release(), { signal });
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) this.release();
      },
      { signal },
    );
    this.app.canvas.addEventListener("contextmenu", (e) => e.preventDefault(), {
      signal,
    });
    this.ready = true;
    this.previous = performance.now();
    this.raf = requestAnimationFrame((now) => this.frame(now));
    Object.assign(window, { __ui: { snapshot: () => this.snapshot() } });
  }
  private point(e: PointerEvent) {
    const r = this.app.canvas.getBoundingClientRect();
    this.pointer = {
      x: (e.clientX - r.left - this.layout.x) / this.layout.scale,
      y: (e.clientY - r.top - this.layout.y) / this.layout.scale,
    };
  }
  private hit() {
    return [...this.buttons]
      .reverse()
      .find((b) => !b.disabled && contains(b, this.pointer.x, this.pointer.y));
  }
  blocksPointer() {
    return this.screen !== "arena" || !!this.hit();
  }
  private key(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (this.onKey?.(e)) {
      e.preventDefault();
      return;
    }
    if (e.code === "Escape") {
      e.preventDefault();
      this.onBack();
      return;
    }
    const directions: Record<string, "left" | "right" | "up" | "down"> = {
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up",
      ArrowDown: "down",
    };
    if (e.code === "Tab" || directions[e.code]) {
      e.preventDefault();
      this.modality = "keyboard";
      this.focus = nextFocus(
        this.buttons,
        this.focus,
        e.code === "Tab"
          ? e.shiftKey
            ? "previous"
            : "next"
          : directions[e.code]!,
      );
    }
    if (
      (e.code === "Enter" || (e.code === "Space" && this.screen !== "arena")) &&
      !e.repeat
    ) {
      e.preventDefault();
      this.modality = "keyboard";
      this.activate(this.focus);
    }
  }
  activate(id: string) {
    if (this.busy) return;
    const b = this.buttons.find((b) => b.id === id && !b.disabled);
    if (!b) return;
    this.focus = id;
    b.root.alpha = 0.75;
    b.activate();
  }
  release() {
    this.pressed?.hold?.(false);
    this.pressed = undefined;
  }
  begin(screen: string) {
    this.focusedBefore = this.focus;
    this.screen = screen;
    this.buttons = [];
    this.onKey = undefined;
    for (const child of this.content.removeChildren())
      child.destroy({ children: true });
    this.tooltip?.destroy({ children: true });
    this.tooltip = undefined;
  }
  end(preferred?: string) {
    this.focus =
      this.buttons.find(
        (b) => b.id === (preferred ?? this.focusedBefore) && !b.disabled,
      )?.id ??
      this.buttons.find((b) => !b.disabled)?.id ??
      "";
    this.app.canvas.dataset.screen = this.screen;
  }
  panel(
    x: number,
    y: number,
    w: number,
    h: number,
    kind = "panel",
    parent: Container = this.content,
  ) {
    const p = this.kit.panel(kind, x, y, w, h);
    parent.addChild(p);
    return p;
  }
  text(
    value: string,
    x: number,
    y: number,
    size = metrics.bodySize,
    colour = colours.text,
    width = 0,
    title = false,
    parent: Container = this.content,
  ) {
    const t = new BitmapText({
      text: value,
      style: {
        fontFamily: title ? "CovenantTitle" : "CovenantBody",
        fontSize: size,
        fill: colour,
        wordWrap: width > 0,
        wordWrapWidth: width,
        lineHeight: size * 1.22,
        breakWords: true,
      },
    });
    t.position.set(x, y);
    parent.addChild(t);
    return t;
  }
  line(
    x: number,
    y: number,
    w: number,
    colour = colours.edge,
    parent: Container = this.content,
  ) {
    const g = new Graphics()
      .moveTo(x, y)
      .lineTo(x + w, y)
      .stroke({ color: colour, width: 1 });
    parent.addChild(g);
    return g;
  }
  button(
    id: string,
    label: string,
    x: number,
    y: number,
    w: number,
    h: number,
    activate: () => void,
    options: ButtonOptions = {},
  ) {
    const root = new Container();
    this.content.addChild(root);
    const background = this.panel(
      x,
      y,
      w,
      h,
      options.selected ? "button-focus" : (options.kind ?? "button"),
      root,
    );
    const inset = options.icon ? 84 : 26;
    const title = this.text(
      label,
      x + inset,
      y,
      options.fontSize ?? 32,
      options.selected ? colours.water : colours.text,
      w - inset - 20,
      false,
      root,
    );
    const subtitle = options.subtitle
      ? this.text(
          options.subtitle,
          x + inset,
          y,
          24,
          colours.muted,
          w - inset - 20,
          false,
          root,
        )
      : undefined;
    const total = title.height + (subtitle ? subtitle.height + 2 : 0);
    title.y = y + Math.max(8, (h - total) / 2);
    if (subtitle) subtitle.y = title.y + title.height + 2;
    if (options.icon) this.icon(options.icon, x + 42, y + h / 2, 26, root);
    const ring = new Graphics();
    root.addChild(ring);
    const b: Button = {
      id,
      label,
      x,
      y,
      w,
      h,
      disabled: !!options.disabled,
      tooltip: options.tooltip ?? "",
      root,
      background,
      ring,
      activate,
      hold: options.hold,
    };
    root.alpha = b.disabled ? 0.45 : 1;
    this.buttons.push(b);
    return b;
  }
  icon(
    kind: string,
    x: number,
    y: number,
    r: number,
    parent: Container = this.content,
    colour = colours.water,
  ) {
    const delivered = this.kit.sprite(`icon.${kind}`);
    if (delivered) {
      delivered.anchor.set(0.5);
      delivered.position.set(x, y);
      delivered.width = r * 2;
      delivered.height = r * 2;
      parent.addChild(delivered);
      return delivered;
    }
    const g = new Graphics();
    parent.addChild(g);
    g.circle(x, y, r * 1.12).stroke({ color: colour, width: 1, alpha: 0.25 });
    if (kind === "water" || kind === "tide_orb" || kind === "mend") {
      g.moveTo(x, y - r)
        .bezierCurveTo(x - r * 1.3, y + r * 0.5, x - r * 0.4, y + r, x, y + r)
        .bezierCurveTo(x + r * 0.7, y + r, x + r, y + r * 0.1, x, y - r)
        .stroke({ color: colour, width: 3 });
      g.moveTo(x - r * 0.7, y + r * 0.45)
        .quadraticCurveTo(x, y, x + r * 0.7, y + r * 0.45)
        .stroke({ color: colour, width: 2 });
    } else if (kind === "fire" || kind === "lash") {
      g.poly([
        x - r * 0.7,
        y + r * 0.8,
        x - r * 0.85,
        y,
        x - r * 0.25,
        y + r * 0.2,
        x,
        y - r,
        x + r * 0.6,
        y - r * 0.25,
        x + r * 0.3,
        y,
        x + r * 0.85,
        y + r * 0.45,
        x,
        y + r,
      ]).stroke({ color: kind === "fire" ? colours.fire : colour, width: 3 });
    } else if (kind === "earth" || kind === "mire") {
      g.poly([
        x,
        y - r,
        x + r * 0.9,
        y + r * 0.65,
        x - r * 0.9,
        y + r * 0.65,
        x,
        y - r,
      ]).stroke({ color: kind === "earth" ? colours.earth : colour, width: 3 });
      g.moveTo(x - r * 0.6, y + r * 0.1)
        .lineTo(x + r * 0.6, y + r * 0.1)
        .stroke({ color: colour, width: 2 });
    } else if (kind === "air") {
      for (let i = 0; i < 3; i++)
        g.moveTo(x - r, y - r * 0.5 + i * r * 0.5)
          .bezierCurveTo(
            x + r * 0.5,
            y - r + i * r * 0.5,
            x + r * 1.1,
            y - r * 0.8 + i * r * 0.5,
            x + r * 0.7,
            y - r * 0.4 + i * r * 0.5,
          )
          .stroke({ color: colours.air, width: 2.5 });
    } else {
      g.poly([x, y - r, x + r, y, x, y + r, x - r, y, x, y - r]).stroke({
        color: colour,
        width: 3,
      });
      g.moveTo(x, y - r * 0.55)
        .lineTo(x, y + r * 0.55)
        .moveTo(x - r * 0.55, y)
        .lineTo(x + r * 0.55, y)
        .stroke({ color: colour, width: 2 });
    }
    return g;
  }
  bar(
    label: string,
    x: number,
    y: number,
    w: number,
    value: number,
    max: number,
    colour: number,
    parent: Container = this.content,
  ) {
    const text = this.text(
      `${label}  ${Math.ceil(value)} / ${max}`,
      x,
      y,
      24,
      colours.text,
      w,
      false,
      parent,
    );
    this.panel(x, y + 34, w, 22, "bar-track", parent);
    const fill = new Graphics();
    parent.addChild(fill);
    const update = (v: number, m = max) => {
      text.text = `${label}  ${Math.ceil(v)} / ${m}`;
      fill
        .clear()
        .rect(x + 4, y + 38, Math.max(0, (w - 8) * Math.min(1, v / m)), 14)
        .fill(colour)
        .rect(x + 4, y + 38, Math.max(0, (w - 8) * Math.min(1, v / m)), 3)
        .fill({ color: 0xffffff, alpha: 0.35 });
    };
    update(value);
    return update;
  }
  notice(message: string) {
    this.toast?.destroy({ children: true });
    const c = new Container();
    this.feedback.addChild(c);
    this.panel(450, 870, 1020, 120, "tooltip", c);
    this.text(message, 480, 895, 30, colours.text, 960, false, c);
    this.toast = c;
    this.toastUntil = performance.now() + 6500;
  }
  async fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      this.notice(
        "Fullscreen is unavailable in this window. The game still fills the viewport.",
      );
    }
  }
  private resize() {
    this.app.renderer.resize(innerWidth, innerHeight);
    this.layout = viewportLayout(innerWidth, innerHeight);
    this.root.scale.set(this.layout.scale);
    this.root.position.set(this.layout.x, this.layout.y);
  }
  private frame(now: number) {
    if (!this.ready) return;
    const dt = Math.min(0.05, (now - this.previous) / 1000);
    this.previous = now;
    this.onFrame?.(dt, now);
    for (const b of this.buttons) {
      b.ring.clear();
      if (b.id === this.focus && !b.disabled) {
        const a =
          0.65 +
          0.3 *
            Math.sin(((now / 1000) * Math.PI * 2) / metrics.focusPulseSeconds);
        b.ring
          .roundRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8, 5)
          .stroke({ color: colours.water, width: 3, alpha: a });
        b.ring
          .poly([
            b.x + 12,
            b.y + b.h / 2,
            b.x + 19,
            b.y + b.h / 2 - 5,
            b.x + 19,
            b.y + b.h / 2 + 5,
          ])
          .fill(colours.water);
      }
      b.root.alpha = b.disabled ? 0.4 : Math.min(1, b.root.alpha + dt * 3);
    }
    const target = this.buttons.find(
      (b) => b.id === (this.modality === "mouse" ? this.hover : this.focus),
    );
    if (
      target?.tooltip &&
      now - this.hoverSince > metrics.tooltipDelayMs &&
      !this.tooltip
    ) {
      const t = new Container();
      this.feedback.addChild(t);
      const x = Math.min(1250, Math.max(100, target.x)),
        y = Math.max(70, Math.min(820, target.y - 125));
      this.panel(x, y, 560, 112, "tooltip", t);
      this.text(
        target.tooltip,
        x + 22,
        y + 19,
        26,
        colours.text,
        516,
        false,
        t,
      );
      this.tooltip = t;
    }
    if (
      this.tooltip &&
      (!target?.tooltip || now - this.hoverSince < metrics.tooltipDelayMs)
    ) {
      this.tooltip.destroy({ children: true });
      this.tooltip = undefined;
    }
    if (this.toast && now > this.toastUntil) {
      this.toast.destroy({ children: true });
      this.toast = undefined;
    }
    this.cursor.clear();
    if (this.modality === "mouse") {
      const { x, y } = this.pointer;
      this.cursor
        .poly([x, y, x + 4, y + 25, x + 11, y + 17, x + 23, y + 15])
        .fill(0x07191e)
        .stroke({ color: colours.text, width: 2 });
      this.cursor.circle(x + 10, y + 11, 2).fill(colours.water);
    }
    this.app.renderer.render(this.app.stage);
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }
  snapshot() {
    const texts: {
      text: string;
      x: number;
      y: number;
      w: number;
      h: number;
      size: number;
    }[] = [];
    const walk = (parent: Container) => {
      for (const c of parent.children) {
        if (c instanceof BitmapText)
          texts.push({
            text: c.text,
            x: c.x,
            y: c.y,
            w: c.width,
            h: c.height,
            size: Number(c.style.fontSize),
          });
        else if (c instanceof Container) walk(c);
      }
    };
    walk(this.content);
    const overflow = this.buttons.flatMap((b) =>
      b.root.children
        .filter((c): c is BitmapText => c instanceof BitmapText)
        .filter(
          (t) =>
            t.x < b.x ||
            t.y < b.y ||
            t.x + t.width > b.x + b.w + 1 ||
            t.y + t.height > b.y + b.h + 1,
        )
        .map((t) => ({
          id: b.id,
          text: t.text,
          y: t.y,
          h: t.height,
          bottom: b.y + b.h,
        })),
    );
    return {
      screen: this.screen,
      busy: this.busy,
      focus: this.focus,
      modality: this.modality,
      kit: this.kit.source,
      diagnostics: this.kit.diagnostics,
      layout: this.layout,
      texts,
      overflow,
      buttons: this.buttons.map(({ id, label, x, y, w, h, disabled }) => ({
        id,
        label,
        x: this.layout.x + x * this.layout.scale,
        y: this.layout.y + y * this.layout.scale,
        w: w * this.layout.scale,
        h: h * this.layout.scale,
        disabled,
      })),
    };
  }
  dispose() {
    this.ready = false;
    cancelAnimationFrame(this.raf);
    this.release();
    this.lifetime.abort();
    this.app.destroy(true, { children: true });
  }
}
