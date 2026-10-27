import { describe, expect, it } from 'vitest';
import { activeBrandDrag, brandDragArm, brandDragArms, brandDragProblems, withBrandDrag } from './brand-drag.ts';

describe('Brand Drag arms (D1 6.13)', () => {
  it('is off by default and the overlay arms validate', () => {
    expect(activeBrandDrag()).toBeUndefined();
    expect(Object.keys(brandDragArms).sort()).toEqual(['early', 'quick', 'reserve']);
    expect(brandDragProblems({ arms: brandDragArms })).toEqual([]);
  });
  it('rejects unknown keys, empty arms and negative numbers', () => {
    expect(brandDragProblems({ arms: { a: { damage: 1 } } })).toHaveLength(1);
    expect(brandDragProblems({ arms: { a: {} } })).toHaveLength(1);
    expect(brandDragProblems({ arms: { a: { cooldownS: -1 } } })).toHaveLength(1);
    expect(brandDragProblems(undefined)).toEqual([]);
  });
  it('selects an arm for one body only and refuses an unknown name', () => {
    expect(withBrandDrag('quick', () => activeBrandDrag())).toEqual({ cooldownS: 10 });
    expect(brandDragArm.name).toBeUndefined();
    expect(() => withBrandDrag('nope', () => 0)).toThrow('Unknown Brand Drag arm');
  });
});
