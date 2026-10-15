import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Tables } from '@mage/core';
import { decodeSave, sourceFiles, sourceHash } from './save.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const real = (p: string) => readFileSync(resolve(root, p), 'utf8');
const editing = (file: string, from: string, to: string) => (p: string) => {
  if (p !== file) return real(p);
  expect(real(p)).toContain(from);
  return real(p).replace(from, to);
};

describe('save source version', () => {
  it('covers the roster data, its compiler and the arena kernel that replays a bout', () => {
    expect(sourceFiles()).toEqual(expect.arrayContaining([
      'docs/design/reconciled/data/arena/enemies.json', 'packages/core/scripts/compile-arena-data.mjs',
      'packages/core/src/arena/kernel.ts', 'packages/core/src/arena/enemies.ts', 'packages/core/src/arena/mage-ai.ts',
    ]));
  });
  it('a changed lunge or charge refuses a save stamped before it as incompatible, before any replay', () => {
    const now = sourceHash();
    for (const old of [
      sourceHash(editing('docs/design/reconciled/data/arena/enemies.json', '"travelS": 0.6', '"travelS": 0.5')),
      sourceHash(editing('docs/design/reconciled/data/arena/enemies.json', '"travelM": 1.2', '"travelM": 1.1')),
      sourceHash(editing('packages/core/src/arena/kernel.ts', 'function travel(', 'function travel (')),
    ]) {
      expect(old).not.toBe(now);
      const envelope = JSON.stringify({ version: 2, sources: old, checkpoint: '', checksum: '', payload: {} });
      expect(() => decodeSave({} as Tables, envelope, now)).toThrow('Save version or source data is incompatible.');
    }
  });
});
