import { Container, Graphics, Sprite, Texture, Rectangle } from "pixi.js";
import type { SigilManifest } from "../sigil-contract.ts";
import { art } from "../art.ts";
import type { CanvasUI } from "./ui.ts";
import { colours } from "./kit.ts";

let sigilManifest: Promise<SigilManifest> | undefined;
const sigilFrames = new Map<string, Texture>();
/** Static painted inscription for menus; no gameplay or animation state implied. */
export function sigil(
  ui: CanvasUI,
  id: string,
  x: number,
  y: number,
  size: number,
  opacity = 1,
) {
  const root = new Container();
  root.position.set(x, y);
  root.alpha = opacity;
  ui.content.addChild(root);
  sigilManifest ??= art.json("a13.manifest") as Promise<SigilManifest>;
  void sigilManifest
    .then(async (m) => {
      const clip = m.clips[id];
      if (!clip) return;
      const page = await art.load(`a13.page.${clip.page}`);
      if (!page || root.destroyed) return;
      let texture = sigilFrames.get(id);
      if (!texture) {
        texture = new Texture({
          source: page.source,
          frame: new Rectangle(...clip.frames[0]!.rect),
        });
        sigilFrames.set(id, texture);
      }
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.width = size;
      sprite.height = size;
      root.addChild(sprite);
    })
    .catch(() => {
      /* The existing kit remains the missing-delivery fallback. */
    });
  return root;
}

/** A fixed layout box survives missing/corrupt art. Async loads never revive disposed scenes. */
export function picture(
  ui: CanvasUI,
  key: string,
  x: number,
  y: number,
  w: number,
  h: number,
  parent: Container = ui.content,
  contain = false,
) {
  const root = new Container();
  root.position.set(x, y);
  parent.addChild(root);
  const under = new Graphics().rect(0, 0, w, h).fill(colours.ink);
  under
    .poly([w / 2, h * 0.22, w * 0.65, h / 2, w / 2, h * 0.78, w * 0.35, h / 2])
    .stroke({ color: colours.edge, width: 2 });
  under
    .circle(w / 2, h / 2, Math.min(w, h) * 0.1)
    .stroke({ color: colours.water, width: 1 });
  root.addChild(under);
  const s = new Sprite(Texture.EMPTY);
  root.addChild(s);
  const mask = new Graphics().rect(0, 0, w, h).fill(0xffffff);
  root.addChild(mask);
  s.mask = mask;
  const apply = (t?: Texture) => {
    if (!t || root.destroyed) return;
    s.texture = t;
    const scale = contain
      ? Math.min(w / t.width, h / t.height)
      : Math.max(w / t.width, h / t.height);
    s.scale.set(scale);
    s.position.set((w - s.width) / 2, (h - s.height) / 2);
  };
  const t = art.get(key);
  if (t) apply(t);
  else void art.load(key).then(apply);
  return root;
}
export function portrait(
  ui: CanvasUI,
  id: string,
  mood: string,
  x: number,
  y: number,
  w: number,
  h: number,
  parent: Container = ui.content,
) {
  const root = new Container();
  root.position.set(x, y);
  parent.addChild(root);
  const fallback = new Graphics().rect(0, 0, w, h).fill(colours.ink);
  fallback.ellipse(w / 2, h * 0.31, w * 0.16, h * 0.17).fill(0x304c53);
  fallback
    .poly([w * 0.35, h * 0.49, w * 0.65, h * 0.49, w * 0.88, h, w * 0.12, h])
    .fill(0x536b69);
  root.addChild(fallback);
  const apply = () => {
    if (root.destroyed) return;
    const original = h > 360 ? art.get(`portrait.${id}.${mood}`) : undefined;
    const s = original ? new Sprite(original) : art.portrait(id, mood);
    if (!s) return;
    const scale = Math.min(w / s.width, h / s.height);
    s.scale.set(scale);
    s.position.set((w - s.width) / 2, (h - s.height) / 2);
    root.addChild(s);
    fallback.visible = false;
  };
  if (art.get(`portrait-page.${id}`)) apply();
  else void art.load(`portrait-page.${id}`).then(apply);
  if (h > 360)
    void art.load(`portrait.${id}.${mood}`).then(() => {
      if (root.destroyed) return;
      for (const child of root.children.slice(1)) child.destroy();
      apply();
    });
  return root;
}
export function storyFor(text: string): string {
  if (/bread|loaf|ration|fed|food/i.test(text)) return "shared-loaf";
  if (/hungr|hunger|empty|sick/i.test(text)) return "empty-bowl";
  if (/guard|vigil|patrol|watch|stocks/i.test(text)) return "watch-rota";
  if (/trade|gold|brib|exchange|bargain/i.test(text)) return "quiet-bargain";
  if (/arena|games|trial|bout|fight|grille/i.test(text)) return "before-grille";
  return "ward-seam";
}
