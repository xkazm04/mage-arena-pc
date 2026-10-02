export interface SpriteFrame { url: string; width: number; height: number; headY: number; soleY: number; footX: number }
export interface SpriteManifest { version: 1; frames: Record<string, SpriteFrame> }
export function validateManifest(value: unknown): SpriteManifest {
  if (!value || typeof value !== 'object') throw Error('Sprite manifest must be an object');
  const m = value as SpriteManifest;
  if (m.version !== 1 || !m.frames || typeof m.frames !== 'object' || Array.isArray(m.frames)) throw Error('Unsupported sprite manifest');
  for (const [key, f] of Object.entries(m.frames)) {
    if (!key || !f || typeof f.url !== 'string' || !f.url || ![f.width, f.height, f.headY, f.soleY, f.footX].every(Number.isFinite) || f.width <= 0 || f.height <= 0 || f.headY < 0 || f.headY >= f.soleY || f.soleY > f.height || f.footX < 0 || f.footX > f.width) throw Error(`Invalid sprite frame: ${key}`);
  }
  return m;
}
export function spritePlacement(f: SpriteFrame, heightPx: number) {
  return { anchorX: f.footX / f.width, anchorY: f.soleY / f.height, scale: heightPx / (f.soleY - f.headY) };
}
export function facingKey(facing: { x: number; y: number }): string {
  return ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'][(Math.round(Math.atan2(facing.y, facing.x) / (Math.PI / 4)) + 8) % 8]!;
}
