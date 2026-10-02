import { Assets, type Texture } from "pixi.js";

interface Manifest {
  version: number;
  entries: Record<string, { path: string; sha256: string; sidecar: string }>;
}
/** The only texture IO boundary. A missing delivery never blocks play. */
export class CampAssets {
  private textures = new Map<string, Texture>();
  readonly missing: string[] = [];
  async load() {
    try {
      const response = await fetch("/assets/accepted/camp/manifest.json");
      if (!response.ok) return;
      const manifest = (await response.json()) as Manifest;
      if (manifest.version !== 1 || !manifest.entries) return;
      await Promise.all(
        Object.entries(manifest.entries).map(async ([key, entry]) => {
          try {
            if (
              !/^\/assets\/accepted\/camp\/[a-z0-9-]+\.(jpg|png|svg)$/.test(
                entry.path,
              )
            )
              throw new Error("Asset outside delivery");
            this.textures.set(key, await Assets.load<Texture>(entry.path));
          } catch {
            this.missing.push(key);
          }
        }),
      );
    } catch {
      this.missing.push("manifest");
    }
  }
  get(key: string) {
    return this.textures.get(key);
  }
}
