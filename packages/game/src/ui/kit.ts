import { NineSliceSprite, Rectangle, Sprite, Texture } from "pixi.js";
import { metrics } from "./layout.ts";

export const colours = {
  ink: 0x080f16,
  panel: 0x101e26,
  edge: 0x608078,
  text: 0xe4e7d5,
  muted: 0xa8bcb9,
  water: 0x77ddd1,
  fire: 0xe89365,
  earth: 0xa9c57c,
  air: 0xb8b0ef,
  gold: 0xdac08a,
  danger: 0xf49c8c,
};
export const requiredRegions = [
  ...["body", "header", "tooltip", "modal", "story"].map((s) => `panel.${s}`),
  ...["normal", "hover", "focus", "pressed", "disabled"].map(
    (s) => `button.${s}`,
  ),
  ...["normal", "hover", "focus", "selected", "disabled"].map(
    (s) => `tab.${s}`,
  ),
  ...[
    "normal",
    "hover",
    "focus",
    "selected",
    "locked",
    "cooldown",
    "borrowed",
  ].map((s) => `slot.${s}`),
  ...["track", "hp", "mana", "stamina", "cast", "cooldown"].map(
    (s) => `bar.${s}`,
  ),
  ...["rim", "face", "hand", "pip.off", "pip.on"].map((s) => `clock.${s}`),
  ...["pointer", "aim", "interact", "blocked"].map((s) => `cursor.${s}`),
  ...["normal", "unread", "selected", "warning"].map((s) => `card.${s}`),
];
export interface AtlasFrame {
  page: string;
  rect: [number, number, number, number];
  anchor: [number, number];
  nineSlice?: [number, number, number, number];
  minSize?: [number, number];
  contentInsets?: [number, number, number, number];
}
export interface UiAtlas {
  schemaVersion: 1;
  id: string;
  designSize: [number, number];
  pages: { id: string; file: string; size: [number, number]; sha256: string }[];
  regions: Record<string, AtlasFrame>;
  motion?: {
    hoverMs: number;
    pressMs: number;
    focusPulseMs: number;
    tooltipDelayMs: number;
    panelRevealMs: number;
  };
}
export function validateAtlas(value: unknown): UiAtlas {
  if (!value || typeof value !== "object") throw Error("Invalid UI atlas");
  const m = value as UiAtlas;
  if (
    m.schemaVersion !== 1 ||
    !Array.isArray(m.pages) ||
    !m.regions ||
    typeof m.regions !== "object" ||
    Array.isArray(m.regions) ||
    m.designSize?.join() !== "1920,1080"
  )
    throw Error("Unsupported UI atlas");
  for (const id of requiredRegions)
    if (!m.regions[id]) throw Error(`Missing required UI region: ${id}`);
  if (new Set(m.pages.map((p) => p.id)).size !== m.pages.length)
    throw Error("Duplicate UI page");
  for (const p of m.pages)
    if (
      !p.id ||
      !/^[a-zA-Z0-9/_-]+\.png$/.test(p.file) ||
      !Array.isArray(p.size) ||
      p.size.length !== 2 ||
      !p.size.every((n) => Number.isInteger(n) && n > 0) ||
      !/^[a-f0-9]{64}$/.test(p.sha256)
    )
      throw Error("Invalid UI page");
  for (const [id, f] of Object.entries(m.regions)) {
    const page = m.pages.find((p) => p.id === f.page),
      r = f.rect;
    if (
      !id ||
      !Array.isArray(r) ||
      r.length !== 4 ||
      !r.every(Number.isInteger) ||
      r[0] < 0 ||
      r[1] < 0 ||
      r[2] <= 0 ||
      r[3] <= 0 ||
      !page ||
      r[0] + r[2] > page.size[0] ||
      r[1] + r[3] > page.size[1] ||
      !Array.isArray(f.anchor) ||
      f.anchor.length !== 2 ||
      !f.anchor.every((n) => Number.isFinite(n) && n >= 0 && n <= 1)
    )
      throw Error(`Invalid UI frame: ${id}`);
    const b = f.nineSlice;
    if (
      b &&
      (!Array.isArray(b) ||
        b.length !== 4 ||
        !b.every((n) => Number.isFinite(n) && n >= 0) ||
        b[0] + b[2] > r[2] ||
        b[1] + b[3] > r[3])
    )
      throw Error(`Invalid nine-slice: ${id}`);
    if (
      f.minSize &&
      (!Array.isArray(f.minSize) ||
        f.minSize.length !== 2 ||
        !f.minSize.every((n) => Number.isFinite(n) && n > 0))
    )
      throw Error(`Invalid minimum size: ${id}`);
    if (
      f.contentInsets &&
      (!Array.isArray(f.contentInsets) ||
        f.contentInsets.length !== 4 ||
        !f.contentInsets.every((n) => Number.isFinite(n) && n >= 0) ||
        f.contentInsets[0] + f.contentInsets[2] > r[2] ||
        f.contentInsets[1] + f.contentInsets[3] > r[3])
    )
      throw Error(`Invalid content insets: ${id}`);
  }
  return m;
}

/** Same named lookup for delivered art and original procedural placeholders. */
export class UiKit {
  private textures = new Map<
    string,
    {
      texture: Texture;
      borders: number[];
      minSize?: number[];
      anchor?: number[];
    }
  >();
  readonly diagnostics: string[] = [];
  source = "procedural";
  rgbaBytes = 0;
  motion = {
    hoverMs: 100,
    pressMs: 70,
    focusPulseMs: 1200,
    tooltipDelayMs: 450,
    panelRevealMs: 160,
  };
  private fallback(id: string) {
    let f = this.textures.get(id);
    if (!f) {
      f = { texture: this.generate(id), borders: [16, 16, 16, 16] };
      this.textures.set(id, f);
    }
    return f;
  }
  async load(url = metrics.atlasUrl) {
    const pages = new Map<string, Texture>();
    try {
      const response = await fetch(url);
      if (!response.ok) {
        this.diagnostics.push(
          `UI kit unavailable (${response.status}); procedural kit active`,
        );
        return;
      }
      if (!response.headers.get("content-type")?.includes("json")) {
        this.diagnostics.push("UI kit not supplied; procedural kit active");
        return;
      }
      const manifest = validateAtlas(await response.json());
      for (const page of manifest.pages) {
        const r = await fetch(new URL(page.file, new URL(url, location.href)));
        if (!r.ok) throw Error(`Missing UI page: ${page.id}`);
        const bytes = await r.arrayBuffer(),
          digest = Array.from(
            new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
            (b) => b.toString(16).padStart(2, "0"),
          ).join("");
        if (digest !== page.sha256) throw Error(`UI hash mismatch: ${page.id}`);
        const bitmap = await createImageBitmap(new Blob([bytes]), {
          premultiplyAlpha: "premultiply",
        });
        if (bitmap.width !== page.size[0] || bitmap.height !== page.size[1]) {
          bitmap.close();
          throw Error(`UI page dimensions: ${page.id}`);
        }
        const pageTexture = Texture.from(bitmap);
        pageTexture.source.alphaMode = "premultiplied-alpha";
        pageTexture.source.autoGenerateMipmaps = false;
        pages.set(page.id, pageTexture);
      }
      const staged = new Map<
        string,
        {
          texture: Texture;
          borders: number[];
          minSize?: number[];
          anchor?: number[];
        }
      >();
      for (const [id, f] of Object.entries(manifest.regions)) {
        const texture = pages.get(f.page)!;
        staged.set(id, {
          texture: new Texture({
            source: texture.source,
            frame: new Rectangle(...f.rect),
          }),
          borders: f.nineSlice ?? [0, 0, 0, 0],
          minSize: f.minSize,
          anchor: f.anchor,
        });
      }
      for (const [id, frame] of staged) this.textures.set(id, frame);
      if (staged.size) this.source = url;
      this.rgbaBytes = manifest.pages.reduce(
        (n, p) => n + p.size[0] * p.size[1] * 4,
        0,
      );
      if (manifest.motion) this.motion = manifest.motion;
    } catch (error) {
      for (const t of pages.values()) t.destroy(true);
      this.diagnostics.push(String(error));
    }
  }
  panel(kind: string, x: number, y: number, w: number, h: number) {
    const aliases: Record<string, string> = {
      panel: "panel.body",
      button: "button.normal",
      "button-focus": "button.focus",
      tab: "tab.normal",
      slot: "slot.normal",
      tooltip: "panel.tooltip",
      "bar-track": "bar.track",
      "bar-fill": "bar.mana",
    };
    const f =
      this.textures.get(aliases[kind] ?? kind) ??
      this.fallback(aliases[kind] ?? kind);
    if (f.minSize && (w < f.minSize[0]! || h < f.minSize[1]!))
      throw Error(`UI size below contract: ${kind}`);
    const s = new NineSliceSprite({
      texture: f.texture,
      leftWidth: f.borders[0],
      topHeight: f.borders[1],
      rightWidth: f.borders[2],
      bottomHeight: f.borders[3],
      width: w,
      height: h,
    });
    s.position.set(x, y);
    return s;
  }
  sprite(id: string): Sprite | undefined {
    const alternate = id.startsWith("icon.")
      ? [...this.textures.keys()].find(
          (key) =>
            key.startsWith("icon.") &&
            (key.endsWith("." + id.slice(5)) ||
              key.endsWith("." + id.slice(5).replaceAll("_", "-")) ||
              key.endsWith("-" + id.slice(5).replaceAll("_", "-"))),
        )
      : undefined;
    const f =
      this.textures.get(id) ??
      (alternate ? this.textures.get(alternate) : undefined);
    if (!f) return;
    const s = new Sprite(f.texture);
    s.anchor.set(f.anchor?.[0] ?? 0, f.anchor?.[1] ?? 0);
    return s;
  }
  skin(sprite: NineSliceSprite, id: string, w: number, h: number) {
    const f =
      this.textures.get(id) ??
      (this.source === "procedural" && requiredRegions.includes(id)
        ? this.fallback(id)
        : undefined);
    if (!f || sprite.texture === f.texture) return;
    if (f.minSize && (w < f.minSize[0]! || h < f.minSize[1]!))
      throw Error(`UI size below contract: ${id}`);
    sprite.texture = f.texture;
    sprite.leftWidth = f.borders[0]!;
    sprite.topHeight = f.borders[1]!;
    sprite.rightWidth = f.borders[2]!;
    sprite.bottomHeight = f.borders[3]!;
    sprite.width = w;
    sprite.height = h;
  }
  cursor(id: string) {
    return this.source === "procedural" ? undefined : this.sprite(id);
  }
  private generate(kind: string): Texture {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const c = canvas.getContext("2d")!,
      focus = kind.endsWith(".focus") || kind.endsWith(".selected"),
      slot = kind.startsWith("slot.");
    const g = c.createLinearGradient(0, 0, 110, 128);
    g.addColorStop(0, focus ? "#26443e" : "#1b2c31");
    g.addColorStop(0.5, focus ? "#183431" : "#0e1a22");
    g.addColorStop(1, "#080e16");
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(10, 1);
    c.lineTo(116, 1);
    c.lineTo(127, 12);
    c.lineTo(127, 116);
    c.lineTo(116, 127);
    c.lineTo(10, 127);
    c.lineTo(1, 116);
    c.lineTo(1, 12);
    c.closePath();
    c.fill();
    c.strokeStyle = focus ? "#9edac4" : "#526963";
    c.lineWidth = 2;
    c.stroke();
    c.strokeStyle = focus ? "#d8d5a4" : "#9b997a";
    c.lineWidth = 1;
    c.strokeRect(6.5, 6.5, 115, 115);
    c.strokeStyle = "#30454a";
    c.strokeRect(10.5, 10.5, 107, 107);
    // Chipped corners, hand-cut metal edges and quiet cracks; no paper grain.
    for (const [x, y, dx, dy] of [
      [8, 8, 1, 1],
      [120, 8, -1, 1],
      [8, 120, 1, -1],
      [120, 120, -1, -1],
    ]) {
      c.strokeStyle = focus ? "#d4e8c2" : "#819b89";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x! + dx! * 20, y!);
      c.lineTo(x!, y!);
      c.lineTo(x!, y! + dy! * 20);
      c.stroke();
      c.fillStyle = "#c0ab7b";
      c.fillRect(x! - 2, y! - 2, 4, 4);
    }
    if (kind.startsWith("panel.") || slot) {
      c.strokeStyle = "#395053";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(20, 12);
      c.lineTo(29, 22);
      c.lineTo(24, 31);
      c.moveTo(116, 87);
      c.lineTo(107, 96);
      c.lineTo(108, 105);
      c.stroke();
    }
    if (kind.startsWith("bar.") && kind !== "bar.track") {
      c.fillStyle = "#e8fff3";
      c.fillRect(0, 0, 128, 128);
      c.fillStyle = "#ffffff";
      c.fillRect(0, 0, 128, 10);
    }
    if (kind === "bar.track") {
      c.fillStyle = "#081118";
      c.fillRect(10, 10, 108, 108);
    }
    return Texture.from(canvas);
  }
}
