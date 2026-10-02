import { Rectangle, Sprite, Texture } from "pixi.js";

export interface ArtEntry {
  file: string;
  sha256: string;
  size?: number[];
}
export interface ArtManifest {
  schema: 1;
  entries: Record<string, ArtEntry>;
  places: { id: string; anchor: [number, number] }[];
  portraits: {
    id: string;
    character: string;
    mood: string;
    atlas: string;
    rect: [number, number, number, number];
  }[];
  characters: { id: string; name: string; school: string }[];
}
export function validateArt(value: unknown): ArtManifest {
  const m = value as ArtManifest;
  if (
    m?.schema !== 1 ||
    !m.entries ||
    !Array.isArray(m.places) ||
    !Array.isArray(m.portraits)
  )
    throw Error("Unsupported Covenant delivery");
  for (const e of Object.values(m.entries)) {
    if (
      !/^(a7|a4c|a2c|a3c|ui)\/[\w/.-]+$/.test(e.file) ||
      e.file.includes("..") ||
      !/^[a-f0-9]{64}$/.test(e.sha256)
    )
      throw Error("Invalid Covenant entry");
  }
  return m;
}
/** Shared, bounded texture ownership; scenes destroy sprites, never shared sources. */
export class CovenantArt {
  manifest?: ArtManifest;
  readonly diagnostics: string[] = [];
  private textures = new Map<string, Texture>();
  private pending = new Map<string, Promise<Texture | undefined>>();
  private failed = new Set<string>();
  private bytes = 0;
  readonly base = "/assets/accepted/covenant/";
  async init() {
    try {
      const r = await fetch(this.base + "manifest.json");
      if (!r.ok) throw Error(`Covenant manifest ${r.status}`);
      this.manifest = validateArt(await r.json());
    } catch (e) {
      this.diagnostics.push(String(e));
    }
  }
  get(key: string) {
    return this.textures.get(key);
  }
  async load(key: string): Promise<Texture | undefined> {
    const existing = this.textures.get(key);
    if (existing) return existing;
    if (this.failed.has(key)) return;
    const entry = this.manifest?.entries[key];
    if (!entry || !entry.file.endsWith(".png")) return;
    const pending = this.pending.get(key);
    if (pending) return pending;
    const task = (async () => {
      try {
        const r = await fetch(this.base + entry.file);
        if (!r.ok) throw Error(`Asset ${key}: ${r.status}`);
        const bytes = await r.arrayBuffer();
        const digest = Array.from(
          new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
          (b) => b.toString(16).padStart(2, "0"),
        ).join("");
        if (digest !== entry.sha256) throw Error(`Asset hash: ${key}`);
        const bitmap = await createImageBitmap(new Blob([bytes]), {
          premultiplyAlpha: "premultiply",
        });
        if (
          entry.size &&
          (bitmap.width !== entry.size[0] || bitmap.height !== entry.size[1])
        ) {
          bitmap.close();
          throw Error(`Asset dimensions: ${key}`);
        }
        const texture = Texture.from(bitmap);
        texture.source.alphaMode = "premultiplied-alpha";
        texture.source.autoGenerateMipmaps = false;
        this.textures.set(key, texture);
        this.bytes += bitmap.width * bitmap.height * 4;
        return texture;
      } catch (e) {
        this.failed.add(key);
        this.diagnostics.push(String(e));
        return undefined;
      } finally {
        this.pending.delete(key);
      }
    })();
    this.pending.set(key, task);
    return task;
  }
  async preload(keys: string[]) {
    await Promise.all(keys.map((k) => this.load(k)));
  }
  portrait(id: string, mood = "neutral") {
    const p =
      this.manifest?.portraits.find((p) => p.id === `${id}.${mood}`) ??
      this.manifest?.portraits.find((p) => p.id === `${id}.neutral`);
    const page = p && this.get(`portrait-page.${p.atlas}`);
    return page && p
      ? new Sprite(
          new Texture({ source: page.source, frame: new Rectangle(...p.rect) }),
        )
      : undefined;
  }
  snapshot() {
    return {
      textures: this.textures.size,
      rgbaBytes: this.bytes,
      rgbaMiB: this.bytes / 1048576,
      failed: [...this.failed],
      pending: this.pending.size,
      diagnostics: [...this.diagnostics],
    };
  }
}
export const art = new CovenantArt();
