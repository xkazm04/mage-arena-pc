import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { Container, Graphics, Sprite, Texture, TextureSource } from "pixi.js";
import { art } from "./art.ts";
import { makeCamera } from "./camera.ts";
import { RivalCollarView } from "./rival-collar-view.ts";
import type { SigilManifest } from "./sigil-contract.ts";
import { sigil } from "./ui/artwork.ts";
import type { CanvasUI } from "./ui/ui.ts";

const key = "a13.page.inscription.collar";
const tick = () => new Promise((r) => setTimeout(r, 0));
const sprites = (root: Container): Sprite[] =>
  root.children.flatMap((c) =>
    c instanceof Sprite ? [c] : sprites(c as Container),
  );
const settle = async (done: () => boolean) => {
  for (let i = 0; i < 50 && !done(); i++) await tick();
};

describe("a shared art page outlives every holder but the last", () => {
  beforeAll(async () => {
    // The covenant delivery from disk; a decoded page is a bare TextureSource of the declared size.
    vi.stubGlobal("fetch", async (url: string) => {
      const file = url.replace(/^\/assets\/accepted\/covenant\//, "");
      return new Response(readFileSync(`assets/accepted/covenant/${file}`));
    });
    vi.stubGlobal("createImageBitmap", async () => ({
      width: 390,
      height: 390,
      close() {},
    }));
    vi.spyOn(Texture, "from").mockImplementation((bitmap) => {
      const resource = bitmap as { width: number; height: number };
      return new Texture({
        source: new TextureSource({
          resource,
          width: resource.width,
          height: resource.height,
        }),
      });
    });
    await art.init();
  });
  afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  it("keeps the collar inscription page live under the HUD and rival collar after the arena drops its pin", async () => {
    // The arena's preload pin, as ArenaScene.ready takes it.
    art.retain(key);
    await art.preload([key]);
    const page = art.get(key)!,
      source = page.source;
    expect(page).toBeDefined();
    // The HUD clock inscription and the rival's collar runes, as the real code attaches them.
    const ui = { content: new Container() } as unknown as CanvasUI;
    const hud = sigil(ui, "inscription.collar", 993, 109, 122, 0.8);
    await settle(() => sprites(hud).length > 0);
    const collar = new RivalCollarView(),
      manifest = (await art.json("a13.manifest")) as SigilManifest;
    collar.begin();
    collar.draw(
      {
        tier: 2,
        untilS: 5,
        progress: 0.4,
        actorId: 1,
        lit: [true, true, false, false],
      },
      { x: 0, y: 0 },
      makeCamera({ width: 1920, height: 1080 }, { x: 0, y: 0 }),
      new Graphics(),
      manifest,
      true,
    );
    collar.end();
    const live = [...sprites(hud), ...sprites(collar.layer)];
    expect(live.length).toBe(5);
    expect(live.every((s) => s.texture.source === source)).toBe(true);
    // The arena's dispose releases its pin; the holders are still on screen.
    art.release(key);
    await tick();
    expect(art.get(key)).toBe(page);
    for (const s of live) expect(s.texture.source.destroyed).toBe(false);
    // Once the last holder goes, the page unloads: no lease leaks.
    hud.destroy({ children: true });
    collar.dispose();
    await tick();
    expect(art.get(key)).toBeUndefined();
    expect(source.destroyed).toBe(true);
  });
});
