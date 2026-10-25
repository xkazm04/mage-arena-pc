import { describe, expect, it } from 'vitest';
import { REGISTRY, type SuiteEntry } from './registry.ts';
import { plan } from './plan.ts';

describe('smoke plan', () => {
  it('builds the game once, then runs the requested suites in order', () => {
    const p = plan(['u3', 'd3']);
    expect(p.steps).toEqual(['build:game', 'u3', 'd3']);
    expect(p.steps.filter((s) => s === 'build:game')).toHaveLength(1);
    expect(plan(['u3', 'u3', 'd3']).steps).toEqual(['build:game', 'u3', 'd3']);
    expect(plan(['u4-audit']).steps).toEqual(['u4-audit']);
  });

  it('never puts two suites on the same port in one parallel batch', () => {
    const all = plan(['all'], { parallel: 4 });
    expect(all.batches.flat().toSorted()).toEqual(all.suites.map((s) => s.id).toSorted());
    for (const batch of all.batches) {
      expect(batch.length).toBeLessThanOrEqual(4);
      const ports = batch.map((id) => REGISTRY.find((e) => e.id === id)!.port).filter((x) => x !== null);
      expect(new Set(ports).size).toBe(ports.length);
    }
    expect(plan(['u6', 'forecast'], { parallel: 2 }).batches).toEqual([['u6'], ['forecast']]);
    expect(plan(['u3', 'd3'], { parallel: 2 }).batches).toEqual([['u3', 'd3']]);
    expect(plan(['u3', 'd3']).batches).toEqual([['u3'], ['d3']]);
  });

  it('refuses the paid Director suite unless allowPaid', () => {
    expect(() => plan(['w7-director'])).toThrow(/paid/);
    expect(() => plan(['w7-director'])).toThrow(/CAMP_DIRECTOR=claude/);
    const allowed = plan(['w7-director'], { allowPaid: true });
    expect([...allowed.steps, ...allowed.refused.map((r) => r.id)]).toContain('w7-director');
    for (const s of plan(['all']).suites) expect(s.paid).toBe(false);
    const live: SuiteEntry = { ...REGISTRY.find((e) => e.id === 'w7-director')!, id: 'paid-live', status: 'live', reason: undefined };
    const reg = [...REGISTRY, live];
    expect(() => plan(['paid-live'], {}, reg)).toThrow(/paid/);
    expect(plan(['paid-live'], { allowPaid: true }, reg).steps).toContain('paid-live');
    expect(plan(['all'], { allowPaid: true }, reg).steps).not.toContain('paid-live');
  });

  it('refuses retired suites with the missing DOM selector as the reason', () => {
    const p = plan(['camp']);
    expect(p.steps).toEqual([]);
    expect(p.refused).toEqual([expect.objectContaining({ id: 'camp', status: 'retired', reason: expect.stringContaining('[data-place]') })]);
    const all = plan(['all']);
    expect(all.refused.map((r) => r.id).sort()).toEqual(['camp', 'parley', 'season', 'w7-scenes']);
    expect(all.steps).not.toContain('camp');
  });

  it('rejects an unknown suite id and names the known ones', () => {
    expect(() => plan(['u99'])).toThrow(/unknown suite 'u99'.*u3/);
  });
});
