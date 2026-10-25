import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { outsideViewport, shotViolations, unreachable } from './checks.ts';
import { BUDGET_FILE, frame, textureMiB } from './budgets.ts';
import type { HarnessWindow } from '../../../game/src/harness-contract.ts';

const button = (id: string, x: number, y: number, w = 80, h = 80) => ({ id, x, y, w, h });

describe('smoke checks', () => {
  it('flags a button outside the 5% safe area', () => {
    expect(shotViolations({ buttons: [button('x', 10, 100)] }, { width: 1920, height: 1080 })).toEqual(['x outside safe area']);
    expect(shotViolations({ buttons: [button('x', 120, 100)] }, { width: 1920, height: 1080 })).toEqual([]);
  });

  it('flags a target under 64 px at 1080p, scaled with the viewport height', () => {
    expect(shotViolations({ buttons: [button('x', 200, 200, 60, 60)] }, { width: 1920, height: 1080 })).toEqual(['x target too small']);
    expect(shotViolations({ buttons: [button('x', 200, 200, 64, 64)] }, { width: 1920, height: 1080 })).toEqual([]);
    expect(shotViolations({ buttons: [button('x', 200, 200, 80, 80)] }, { width: 2560, height: 1440 })).toEqual(['x target too small']);
  });

  it('lists enabled controls the D-pad cannot reach from the first one', () => {
    // c sits exactly on a: from b, left always lands on a first, and nothing is ever strictly beyond a.
    expect(unreachable([button('a', 200, 200), button('b', 500, 200), button('c', 200, 200)])).toEqual(['c']);
    expect(unreachable([button('a', 200, 200), button('b', 500, 200), button('c', 200, 500), button('d', 500, 500)])).toEqual([]);
    expect(unreachable([{ ...button('a', 200, 200), disabled: true }])).toEqual([]);
  });

  it('lists text and buttons outside the viewport', () => {
    const layout = { x: 0, y: 0, scale: 1 };
    const s = { layout, texts: [{ text: 'ok', x: 10, y: 10, w: 50, h: 20 }, { text: 'off', x: 1900, y: 10, w: 50, h: 20 }, { text: '', x: -50, y: 0, w: 5, h: 5 }], buttons: [button('b', 1900, 1000)] };
    expect(outsideViewport(s, 1920, 1080)).toEqual(['text "off"', 'button b']);
  });
});

describe('smoke budgets', () => {
  it('has one frame budget and one texture ceiling per profile, with the values the suites hand-typed', () => {
    expect(frame('stress')).toEqual({ fpsMin: 50, cpuP95Max: 8 });
    expect(frame('steady')).toEqual({ fpsMin: 58, cpuP95Max: 8 });
    expect(frame('strict')).toEqual({ fpsMin: 58.8, cpuP95Max: 8 });
    expect(textureMiB('arena')).toBe(300);
    expect(textureMiB('camp-to-arena')).toBe(400);
  });

  it('leaves no literal frame or texture budget in the suites migrated onto the kit', () => {
    for (const file of ['d3-widescreen-browser.ts', 'forecast-browser.ts']) {
      const src = readFileSync(join('packages/tools/src', file), 'utf8');
      expect(src.match(/fps\s*>=|\*\s*1048576\)/g) ?? [], file).toEqual([]);
    }
    expect(BUDGET_FILE).toBe('packages/tools/src/smoke/budgets.ts');
  });
});

describe('harness contract', () => {
  it('types the window hooks once, so a missing fixture is a compile error', () => {
    // Never called: the body only has to type-check under `npm run build`.
    const typed = (w: HarnessWindow) => {
      w.__arena.reset();
      w.__arena.reset('magic');
      w.__ui.resetPerformance();
      const fps: number[] = w.__ui.performance().frames;
      // @ts-expect-error - no such fixture on the contract
      w.__arena.fooFixture();
      // @ts-expect-error - reset takes a TrainingKind, not a number
      w.__arena.reset(3);
      return fps;
    };
    expect(typeof typed).toBe('function');
  });
});
