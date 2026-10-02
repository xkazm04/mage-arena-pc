import { expect, it } from 'vitest';
import { facingKey, spritePlacement, validateManifest } from './sprite-contract.ts';
it('keeps the foot and head-to-sole scale independent of sprite padding', () => {
  const frame = { url: './mage.png', width: 256, height: 256, headY: 30, soleY: 210, footX: 120 };
  expect(validateManifest({ version: 1, frames: { 'mage.player': frame } }).frames['mage.player']).toEqual(frame);
  const p = spritePlacement(frame, 64.8); expect(p.scale).toBeCloseTo(0.36); expect(p.anchorX).toBe(120 / 256); expect(p.anchorY).toBe(210 / 256);
  expect((frame.soleY - frame.headY) * p.scale).toBeCloseTo(64.8);
});
it('rejects ambiguous manifests and invalid anchors before loading', () => {
  expect(validateManifest({ version: 1, frames: {} }).frames).toEqual({});
  for (const value of [null, {}, { version: 2, frames: {} }, { version: 1, frames: [] }, { version: 1, frames: { bad: { url: 'x', width: 12, height: 12, headY: 11, soleY: 2, footX: 6 } } }]) expect(() => validateManifest(value)).toThrow();
});
it('selects directional art without rotating upright bodies', () => {
  expect(facingKey({ x: 1, y: 0 })).toBe('e'); expect(facingKey({ x: -1, y: 0 })).toBe('w'); expect(facingKey({ x: 0, y: -1 })).toBe('n'); expect(facingKey({ x: -1, y: 1 })).toBe('sw');
});
