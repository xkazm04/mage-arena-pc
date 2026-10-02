import { Assets, Graphics, Rectangle, Sprite, type Application, type Texture } from 'pixi.js';
import type { Actor } from '@mage/core/arena';
import { facingKey, spritePlacement, validateManifest, type SpriteFrame } from './sprite-contract.ts';
interface Entry { texture: Texture; frame: SpriteFrame }
/** Owns asset loading, never combat geometry. Failed/absent frames always use the same procedural body. */
export class FigureLibrary {
  private entries = new Map<string, Entry>();
  private fallback = new Map<string, Entry>();
  readonly diagnostics: string[] = [];
  constructor(private app: Application) {}
  async load(url: string): Promise<void> {
    try {
      const response = await fetch(url); if (!response.ok) throw Error(`HTTP ${response.status}`);
      const manifest = validateManifest(await response.json());
      await Promise.all(Object.entries(manifest.frames).map(async ([key, frame]) => {
        try {
          const texture = await Assets.load<Texture>(new URL(frame.url, new URL(url, location.href)).href);
          if (texture.width !== frame.width || texture.height !== frame.height) throw Error('Texture dimensions differ from manifest');
          this.entries.set(key, { texture, frame });
        } catch (e) { this.diagnostics.push(`${key}: ${String(e)}`); }
      }));
    } catch (e) { this.diagnostics.push(`Manifest fallback: ${String(e)}`); }
  }
  dispose(): void { for (const entry of this.fallback.values()) entry.texture.destroy(true); this.fallback.clear(); this.entries.clear(); }
  get loadedFrames(): number { return this.entries.size; }
  key(a: Actor, playerTeam: number): string { return a.enemy?.id ?? (a.dummy ? 'dummy' : a.team === playerTeam ? 'mage.player' : 'mage.enemy'); }
  apply(sprite: Sprite, a: Actor, playerTeam: number, height: number): void {
    const key = this.key(a, playerTeam), entry = this.entries.get(`${key}.${facingKey(a.facing)}`) ?? this.entries.get(key) ?? this.procedural(key);
    const placement = spritePlacement(entry.frame, height);
    sprite.texture = entry.texture; sprite.anchor.set(placement.anchorX, placement.anchorY); sprite.scale.set(placement.scale);
    sprite.alpha = a.down ? 0.4 : 1;
  }
  private procedural(key: string): Entry {
    const existing = this.fallback.get(key); if (existing) return existing;
    const g = new Graphics(), outline = 0x433c30;
    const colour = key === 'mage.player' ? 0x246d91 : key === 'mage.enemy' ? 0xad503c : key === 'cinder_hound' ? 0x9b5141 : key === 'mire_maw' ? 0x717f56 : key === 'hush_moth' ? 0x9b81a5 : 0xa77747;
    if (['cinder_hound', 'mire_maw', 'thornback', 'hush_moth'].includes(key)) {
      if (key === 'hush_moth') {
        g.poly([48, 28, 2, 0, 12, 65, 44, 80, 50, 100, 56, 80, 88, 65, 98, 0, 52, 28]).fill(colour).stroke({ color: outline, width: 3 });
        g.ellipse(50, 53, 9, 38).fill(0xd9c9ab);
      } else {
        g.poly([8, 76, 16, 23, 33, 12, 75, 20, 94, 3, 98, 41, 83, 60, 89, 100, 76, 100, 61, 74, 35, 75, 28, 100, 14, 100]).fill(colour).stroke({ color: outline, width: 3 });
        if (key === 'thornback') for (let i = 0; i < 4; i++) g.poly([20 + i * 15, 26, 26 + i * 15, 0, 37 + i * 15, 29]).fill(0xd5bc82).stroke({ color: outline, width: 2 });
        g.circle(84, 31, 3).fill(0xf4d8ad);
      }
    } else {
      // Head (0) to soles (100) is explicit: no hat, weapon or shadow in height measurement.
      g.poly([33, 84, 46, 84, 44, 100, 30, 100, 30, 97]).fill(outline);
      g.poly([52, 84, 65, 84, 69, 100, 54, 100]).fill(outline);
      g.poly([34, 30, 60, 30, 67, 54, 75, 88, 52, 95, 26, 86, 31, 53]).fill(colour).stroke({ color: outline, width: 3 });
      g.poly([34, 38, 46, 42, 40, 78, 29, 82]).fill({ color: 0xe1d2a3, alpha: 0.55 });
      g.poly([60, 36, 73, 49, 87, 43, 89, 51, 73, 59, 57, 50]).fill(colour).stroke({ color: outline, width: 3 });
      g.ellipse(48, 14, 11, 14).fill(0xd5ac7e).stroke({ color: outline, width: 2 });
      g.poly([37, 9, 40, 1, 51, 0, 58, 6, 59, 12, 48, 7]).fill(outline);
      g.moveTo(42, 17).lineTo(52, 17).stroke({ color: outline, width: 2 });
      g.moveTo(39, 30).lineTo(59, 30).stroke({ color: 0xe5c981, width: 3 });
      if (key === 'shieldman') g.roundRect(64, 40, 26, 42, 8).fill(0xd2b97e).stroke({ color: outline, width: 4 });
      else if (key === 'netter') { g.poly([77, 32, 97, 49, 78, 77, 67, 58]).stroke({ color: 0xf0dcc0, width: 2 }); g.moveTo(77, 32).lineTo(78, 77).moveTo(67, 58).lineTo(97, 49).stroke({ color: outline, width: 2 }); }
      else if (key !== 'dummy') g.moveTo(86, 26).lineTo(82, 95).stroke({ color: outline, width: 4 });
    }
    const texture = this.app.renderer.generateTexture({ target: g, frame: new Rectangle(-4, -4, 108, 108), resolution: 2 });
    g.destroy();
    const entry = { texture, frame: { url: '', width: 108, height: 108, footX: 54, headY: 4, soleY: 104 } };
    this.fallback.set(key, entry); return entry;
  }
}
