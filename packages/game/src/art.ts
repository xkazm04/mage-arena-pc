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
    Array.isArray(m.entries) ||
    !Array.isArray(m.places) ||
    !Array.isArray(m.portraits) ||
    !Array.isArray(m.characters)
  )
    throw Error("Unsupported Covenant delivery");
  for (const e of Object.values(m.entries)) {
    if (
      !/^(a7|a4c|a2c|a3c|a8|a10|a11|a12|a13|a14|ui)\/[\w/.-]+$/.test(e.file) ||
      e.file.includes("..") ||
      !/^[a-f0-9]{64}$/.test(e.sha256)
    )
      throw Error("Invalid Covenant entry");
    if (
      e.size &&
      (e.size.length !== 2 ||
        !e.size.every((n) => Number.isInteger(n) && n > 0 && n <= 8192))
    )
      throw Error("Invalid Covenant dimensions");
  }
  for (const p of m.places)
    if (
      typeof p.id !== "string" ||
      !Array.isArray(p.anchor) ||
      p.anchor.length !== 2 ||
      !p.anchor.every((n) => Number.isFinite(n) && n >= 0 && n <= 1)
    )
      throw Error("Invalid camp landmark");
  const identities = new Set(m.characters.map((c) => c.id));
  if (
    identities.size !== m.characters.length ||
    m.characters.some(
      (c) =>
        typeof c.id !== "string" ||
        typeof c.name !== "string" ||
        typeof c.school !== "string",
    )
  )
    throw Error("Invalid cast");
  for (const p of m.portraits) {
    const size = m.entries[`portrait-page.${p.atlas}`]?.size;
    if (
      !identities.has(p.character) ||
      p.id !== `${p.character}.${p.mood}` ||
      !size ||
      !Array.isArray(p.rect) ||
      p.rect.length !== 4 ||
      !p.rect.every(Number.isInteger) ||
      p.rect[0] < 0 ||
      p.rect[1] < 0 ||
      p.rect[2] <= 0 ||
      p.rect[3] <= 0 ||
      p.rect[0] + p.rect[2] > size[0]! ||
      p.rect[1] + p.rect[3] > size[1]!
    )
      throw Error("Invalid portrait crop");
  }
  return m;
}
/** Shared, bounded texture ownership; scenes destroy sprites, never shared sources. */
export class CovenantArt {
  manifest?: ArtManifest;
  readonly diagnostics: string[] = [];
  private textures = new Map<string, Texture>();
  private portraitFrames = new Map<string, Texture>();
  private pending = new Map<string, Promise<Texture | undefined>>();
  private failed = new Set<string>();
  private leases = new Map<string, number>();
  private bytes = 0;
  readonly base = "/assets/accepted/covenant/";
  async init() {
    try {
      const r = await fetch(this.base + "manifest.json", {
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) throw Error(`Covenant manifest ${r.status}`);
      this.manifest = validateArt(await r.json());
    } catch (e) {
      this.diagnostics.push(String(e));
    }
  }
  get(key: string) {
    return this.textures.get(key);
  }
  retain(key: string) {
    this.leases.set(key, (this.leases.get(key) ?? 0) + 1);
  }
  release(key: string) {
    const count = Math.max(0, (this.leases.get(key) ?? 0) - 1);
    this.leases.set(key, count);
    const unload = () => {
      if (this.leases.get(key)) return;
      const texture = this.textures.get(key);
      if (!texture) return;
      this.bytes -= texture.source.pixelWidth * texture.source.pixelHeight * 4;
      const bitmap = texture.source.resource as ImageBitmap;
      texture.destroy(true);
      bitmap.close?.();
      this.textures.delete(key);
    };
    if (!count) {
      unload();
      void this.pending.get(key)?.then(unload);
    }
  }
  async json(key: string): Promise<unknown> {
    const entry = this.manifest?.entries[key];
    if (!entry?.file.endsWith(".json")) throw Error(`Missing metadata: ${key}`);
    const response = await fetch(this.base + entry.file, {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw Error(`Metadata ${key}: ${response.status}`);
    const bytes = await response.arrayBuffer();
    const digest = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    if (digest !== entry.sha256) throw Error(`Metadata hash: ${key}`);
    return JSON.parse(new TextDecoder().decode(bytes));
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
        const r = await fetch(this.base + entry.file, {
          signal: AbortSignal.timeout(8000),
        });
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
    if (!page || !p) return;
    let frame = this.portraitFrames.get(p.id);
    if (!frame) {
      frame = new Texture({
        source: page.source,
        frame: new Rectangle(...p.rect),
      });
      this.portraitFrames.set(p.id, frame);
    }
    return new Sprite(frame);
  }
  snapshot() {
    return {
      textures: this.textures.size,
      rgbaBytes: this.bytes,
      rgbaMiB: this.bytes / 1048576,
      failed: [...this.failed],
      pending: this.pending.size,
      diagnostics: [...this.diagnostics],
      residentKeys: [...this.textures.keys()],
    };
  }
}
export const art = new CovenantArt();
