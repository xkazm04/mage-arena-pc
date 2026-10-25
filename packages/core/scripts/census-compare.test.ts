import { describe, expect, it } from 'vitest';
import exchangeBefore from '../../../docs/change-requests/evidence/d1-exchange-before.json' with { type: 'json' };
import exchangeAfter from '../../../docs/change-requests/evidence/d1-exchange-after.json' with { type: 'json' };
import weeks from '../../../docs/change-requests/evidence/d1-weeks.json' with { type: 'json' };
import weeksLag from '../../../docs/change-requests/evidence/d1-weeks-arm-lag.json' with { type: 'json' };
import counters from '../../../docs/change-requests/evidence/d1-counters.json' with { type: 'json' };
import namedBefore from '../../../docs/waves/W8-evidence/named.json' with { type: 'json' };
import namedAfter from '../../../docs/change-requests/evidence/d1-named-after.json' with { type: 'json' };
import { compareEvidence, fixed1, loadCells, renderTable, twoProportionZ, wilson95, type CompareRow } from './census-compare.ts';

// census:compare is a reader over committed evidence: these cases reproduce D1's hand-typed before/after tables (6.1, 6.5, 6.8)
// from the files themselves and pin the computed verdicts that replaced 'same', 'within noise' and 'on the floor' prose.
const row = (rows: CompareRow[], key: string): CompareRow => { const r = rows.find(x => x.key === key); if (!r) throw Error(`no row ${key}`); return r; };

describe('census:compare (two evidence files in, the D1 before/after table out)', () => {
  it('case 1: exchange before -> after gives 6 build rows; fire_close median 15.8 -> 67.0 crosses into its band', () => {
    const c = compareEvidence(exchangeBefore, exchangeAfter);
    expect(c.kind).toBe('builds');
    expect(c.rows.map(r => r.key)).toEqual(['fire_close', 'fire_light', 'fire_heavy', 'air_light', 'air_close', 'air_heavy']);
    const fire = row(c.rows, 'fire_close');
    expect(fire.band).toBe('out -> in');
    const line = renderTable(c).split('\n').find(l => l.startsWith('| fire_close '))!;
    expect(line).toContain('15.8 -> 67.0');
    expect(line).toContain('47.0% -> 49.5%');
  });

  it('case 2: weeks vs the lag arm - all 20 week-1 rows (both profiles) are digest-equal, no delta reported', () => {
    const c = compareEvidence(weeks, weeksLag);
    expect(c.kind).toBe('weeks');
    const week1 = c.rows.filter(r => r.key.includes('/week 1/'));
    expect(week1).toHaveLength(20);
    expect(week1.every(r => r.verdict === 'same')).toBe(true);
    expect(week1.every(r => r.z === 0 && r.before.winRate === r.after.winRate && r.before.medianS === r.after.medianS)).toBe(true);
    const md = renderTable(c).split('\n').filter(l => l.includes('/week 1/'));
    expect(md).toHaveLength(20);
    expect(md.some(l => l.includes(' -> '))).toBe(false);
  });

  it('case 3: air_close 0.525 -> 0.400 at n=200 moved (|z| ~2.5); fire_light 0.455 -> 0.505 is noise (|z| ~1.0)', () => {
    const c = compareEvidence(exchangeBefore, exchangeAfter);
    const air = row(c.rows, 'air_close'), fire = row(c.rows, 'fire_light');
    expect(air.verdict).toBe('moved');
    expect(Math.abs(air.z!)).toBeCloseTo(2.51, 2);
    expect(fire.verdict).toBe('noise');
    expect(Math.abs(fire.z!)).toBeCloseTo(1.0, 1);
    expect(twoProportionZ(0.5, 200, 0.5, 200)).toBe(0);
  });

  it('case 4: air_close after 0.400 is in [0.4, 0.65] but on edge - its Wilson 95% interval straddles the floor', () => {
    const [lo, hi] = wilson95(0.4, 200);
    expect(lo).toBeCloseTo(0.335, 3);
    expect(hi).toBeCloseTo(0.469, 3);
    const air = row(compareEvidence(exchangeBefore, exchangeAfter).rows, 'air_close');
    expect(air.after.range).toBe('in, on edge');
    expect(air.range).toBe('in -> in, on edge');
  });

  it('case 5: mixed census kinds are refused', () => {
    expect(() => compareEvidence(exchangeBefore, weeks)).toThrow('different census kinds: builds vs weeks');
    expect(loadCells(counters).kind).toBe('counters');
    expect(() => loadCells({ label: 'simulated', fights: [] })).toThrow('unknown census evidence shape');
  });

  it('case 6: different seed ranges warn and never report same; the renderer rounds half up', () => {
    const shifted = { ...exchangeAfter, countPerBuild: 100, seedRange: [40000, 40099] };
    const c = compareEvidence(exchangeAfter, shifted);
    expect(c.warnings).toContain('seed ranges differ: digest equality not meaningful');
    expect(c.rows.some(r => r.verdict === 'same')).toBe(false);
    expect(renderTable(c)).toContain('seed ranges differ: digest equality not meaningful');
    // Round half up on the decimal value, not on its binary neighbour: 16.45.toFixed(1) is '16.4', the rule gives '16.5'.
    expect([16.45, 62.95, 66.95, 15.816666666666666, 55.15, 44.55, 0.05].map(fixed1)).toEqual(['16.5', '63.0', '67.0', '15.8', '55.2', '44.6', '0.1']);
  });

  it('case 7: W8 named -> D1 named-after: Brennic median 16.5 -> 63.0 s, win 55.2% -> 44.6%, moved; four shapes, one adapter', () => {
    const c = compareEvidence(namedBefore, namedAfter);
    expect(c.kind).toBe('named');
    const brennic = row(c.rows, 'wave 3');
    expect(brennic.verdict).toBe('moved');
    expect(brennic.before.medianS).toBe(16.45);
    expect(brennic.after.medianS).toBe(62.95);
    const line = renderTable(c).split('\n').find(l => l.startsWith('| wave 3 '))!;
    expect(line).toContain('Brennic');
    expect(line).toContain('16.5 -> 63.0');
    expect(line).toContain('55.2% -> 44.6%');
    expect(loadCells(exchangeAfter).kind).toBe('builds');
    expect(loadCells(weeks).kind).toBe('weeks');
    expect(loadCells(counters).cells.map(x => x.key)).toContain('builds (Mirror tide)/fire_close');
    expect(loadCells(namedAfter).cells.map(x => x.key)).toEqual(['wave 3', 'wave 4']);
  });
});
