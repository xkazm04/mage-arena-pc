// Skill-point week curve (D1 4.3, owner ruling 2026-10-24): a whole six-week camp season played through the real camp session
// (createCampSession, actCamp, settleCamp) by a fixed player policy, with the skill book on (arena/data/skill-book.pc.json).
// Each finished activity earns its award; at each day's end the player spends every point it can on the cheapest next rank
// among the week sweep's ranked rows (the bolt and the reference preset's line rows, week-census.ts). The reading is the
// average rank over those rows on each Games morning, against the 4.3 target "about N - 0.5 by week N" (the week sweep's
// steady profile). Pure: no I/O, so report-skills.ts and skill-census.test.ts share one runner.
import season from '../../../docs/design/reconciled/data/season.json' with { type: 'json' };
import deathReservation from '../../../docs/design/reconciled/data/death-reservation.json' with { type: 'json' };
import characters from '../../../docs/design/reconciled/data/characters.json' with { type: 'json' };
import relationships from '../../../docs/design/reconciled/data/relationships.json' with { type: 'json' };
import facts from '../../../docs/design/reconciled/data/facts.json' with { type: 'json' };
import schools from '../../../docs/design/reconciled/data/schools.json' with { type: 'json' };
import rules from '../../../docs/design/reconciled/data/rules.json' with { type: 'json' };
import intents from '../../../docs/design/reconciled/data/intents.json' with { type: 'json' };
import goals from '../../../docs/design/reconciled/data/goals.json' with { type: 'json' };
import phrases from '../../../docs/design/reconciled/data/phrases.json' with { type: 'json' };
import locations from '../../../docs/design/reconciled/data/locations.json' with { type: 'json' };
import scenarios from '../../../docs/design/reconciled/data/scenarios.json' with { type: 'json' };
import { presets, runtime } from '../src/arena/index.ts';
import { compositionRows } from '../src/arena/mage-build.ts';
import { actCamp, calendar, createCampSession, decision, endHour, moveCamp, passSlot, playerProblem, safeFallback, settleCamp, spendHours, type CampSession, type Tables } from '../src/index.ts';
import { buyRank, createSkillBook, earnSkillPoints, nextRankCost, rankOf, skillBookRules, type SkillBook, type SkillBookRules } from '../src/skill-book.ts';
import { weekProfiles } from './week-census.ts';

/** The camp tables, the same list as director/src/data.ts loadTables (core may not import the director). */
export const tables = { season, 'death-reservation': deathReservation, characters, relationships, facts, schools, rules, intents, goals, phrases, locations, scenarios } as unknown as Tables;
/** The ranked rows: the bolt and each of the reference preset's lines at tiers I-IV (mage-build.ts compositionRows, as the week sweep). */
export const rankedKeys: readonly string[] = compositionRows(presets.find(p => p.name === runtime.games.referencePreset)!);
/** The 4.3 target per week: the week sweep's `steady` profile (N - 0.5, floored at rank 1, capped at the top rank). */
export const targetRanks: readonly number[] = weekProfiles.steady!;
/** Census arms: `committed` is the file's numbers; `flat` holds every week's award at 3x (the committed costs), the closest
 * flat-award curve, read to show what the week scale buys. */
export type SkillArm = 'committed' | 'flat';
export const armRules = (arm: SkillArm): SkillBookRules => arm === 'committed' ? skillBookRules : { ...skillBookRules, weekScale: skillBookRules.weekScale.map(() => 3) };

/** Player policies. `steady` trains whenever a training ground is open (vigor, focus, nerve in turn: the arena stats);
 * `worker` works at the Exchange whenever it can (a non-combat activity that is not training). Neither does anything else. */
export type SkillPolicy = 'steady' | 'worker';
const trainingStats = ['vigor', 'focus', 'nerve'] as const;
function nextAct(t: Tables, s: CampSession, policy: SkillPolicy, done: number): CampSession | null {
  const tries = policy === 'worker' ? [{ intent: 'WORK' as const, args: {} }] : trainingStats.map((_, i) => ({ intent: 'TRAIN' as const, args: { stat: trainingStats[(done + i) % trainingStats.length]! } }));
  for (const { intent, args } of tries) {
    const token = intent === 'TRAIN' ? `TRAIN:${args.stat}` : intent;
    const place = t.locations.find(p => p.activities.includes(token));
    if (!place || s.hour < place.openHour || s.hour >= place.closeHour) continue;
    const at = s.location === place.id ? s : moveCamp(t, s, place.id);
    const d = decision(t, at.camp, at.camp.player, intent, args);
    if (!playerProblem(t, at, d)) return actCamp(t, at, d);
  }
  return null;
}
/** Spend every point on the cheapest next rank among the ranked rows (ties: the earlier row). */
function spend(book: SkillBook): SkillBook {
  for (;;) {
    const options = rankedKeys.map(key => ({ key, cost: nextRankCost(book, key) })).filter((o): o is { key: string; cost: number } => o.cost !== null && o.cost <= book.points);
    if (!options.length) return book;
    book = buyRank(book, options.reduce((a, b) => (b.cost < a.cost ? b : a)).key, 'water');
  }
}
export const averageRank = (book: SkillBook): number => rankedKeys.reduce((sum, key) => sum + rankOf(book, key), 0) / rankedKeys.length;

export interface WeekReading { week: number; day: number; activities: number; earned: number; unspent: number; averageRank: number; target: number }
/** Play the season under `policy`; one reading per Games morning (before the bout). Games and Trial take their hours. */
export function runSkillSeason(policy: SkillPolicy, arm: SkillArm = 'committed', seed = 73, t: Tables = tables): WeekReading[] {
  const rules = armRules(arm);
  let s = createCampSession(t, seed), book = createSkillBook(), activities = 0;
  const readings: WeekReading[] = [], days = t.season.weeks * t.season.daysPerWeek;
  for (let day = 1; day <= days; day++) {
    if (s.camp.day !== day) throw Error(`Camp day ${s.camp.day} is not census day ${day}.`);
    const cal = calendar(t, day);
    if (cal.games) {
      readings.push({ week: cal.week, day, activities, earned: book.earned, unspent: book.points, averageRank: averageRank(book), target: targetRanks[cal.week - 1]! });
      if (day === days) break;
      s = spendHours(s, t.season.gamesHours);
    }
    for (;;) {
      if (cal.eve && s.hour === t.season.trialHour) { s = spendHours(s, t.season.trialHours); continue; }
      const next = nextAct(t, s, policy, activities);
      if (!next) break;
      book = earnSkillPoints(book, next.dayActs.at(-1)!.intent, cal.week, true, rules); activities++; s = next;
    }
    while (s.hour < endHour(t.season)) s = passSlot(s);
    { const camp = s.camp; s = settleCamp(t, s, [], id => safeFallback(t, camp, id)); }
    book = spend(book);
  }
  return readings;
}
