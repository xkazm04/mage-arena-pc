import { describe, expect, it } from 'vitest';
// index.ts first: it loads kernel.ts before fire.ts/air.ts (the schools.ts import-order trap).
import '../src/arena/index.ts';
import { rankedKeys, runSkillSeason, targetRanks } from './skill-census.ts';

// The skill-point week curve (D1 4.3, section 6.7): the committed numbers keep a steady trainer near the 4.3 target
// "about N - 0.5 by week N" on every Games morning. A target miss is a tuning change with a written reason, not a re-pin.
describe('skill-point week curve (D1 4.3): the real camp season, skill book on', () => {
  const steady = runSkillSeason('steady'), worker = runSkillSeason('worker'), flat = runSkillSeason('steady', 'flat');
  const worst = (weeks: typeof steady): number => Math.max(...weeks.map(w => Math.abs(w.averageRank - w.target)));

  it('reads one Games morning per campaign week over the bolt and the reference lines', () => {
    expect(steady.map(w => w.day)).toEqual([7, 14, 21, 28, 35, 42]);
    expect(steady.map(w => w.target)).toEqual([...targetRanks]);
    expect(rankedKeys).toHaveLength(13);
    // 5 training slots on a plain day, 6 with the Pit at dusk; the Trial and the Games take theirs.
    expect(steady.map(w => w.activities)).toEqual([35, 74, 113, 152, 191, 230]);
  });

  it('a steady trainer tracks the target within a quarter rank every week', () => {
    expect(worst(steady)).toBeLessThanOrEqual(0.25);
  });

  it('a player who only works falls behind; the flat award runs ahead early and behind late', () => {
    expect(worker.every((w, i) => w.averageRank <= steady[i]!.averageRank)).toBe(true);
    expect(worker[3]!.averageRank).toBeLessThan(2);
    expect(flat[0]!.averageRank - flat[0]!.target).toBeGreaterThan(0.5);
    expect(flat[5]!.averageRank).toBeLessThan(5);
    expect(worst(flat)).toBeGreaterThan(worst(steady));
  });
});
