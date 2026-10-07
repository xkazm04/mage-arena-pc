import { createCampSession, moveCamp, actCamp, passSlot, settleCamp } from '../../core/src/camp-session.ts';
import { decision, safeFallback } from './reference.mjs';

/** Generated from opening/activity tables. No hand-authored state deltas. */
export function hourDays(t) {
  let s = createCampSession(t, t.scenarios.seed);
  const rows = [];
  for (let day = 0; day < 3; day++) {
    const timeline = [];
    const record = action => timeline.push({ action, day: s.camp.day, hour: s.hour, phase: s.slot, location: s.location, nightFinished: s.nightFinished });
    record('wake');
    const place = t.locations.find(p => p.activities.includes(day === 1 ? 'WORK' : 'TRAIN:vigor'));
    s = moveCamp(t,s,place.id); record('travel');
    s = actCamp(t,s,decision(t,s.camp,s.camp.player,day === 1 ? 'WORK' : 'TRAIN',day === 1 ? {} : {stat:'vigor'})); record('activity');
    while (!s.nightFinished) { s=passSlot(s); record('wait'); }
    const before = s.camp;
    s=settleCamp(t,s,[],id=>safeFallback(t,before,id)); record('settle');
    rows.push({ label:'simulated from tables', timeline, player:s.camp.characters[s.camp.player], trace:s.lastResolution.trace });
  }
  return rows;
}
