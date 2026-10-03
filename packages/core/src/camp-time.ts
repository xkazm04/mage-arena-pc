import season from "../../../docs/design/reconciled/data/season.json" with { type: "json" };
import type { Decision, Tables } from "./types.ts";

export type CampPhase = "day" | "dusk" | "night";
export const campTime = season;
export const endHour = (time = season) => time.wakeHour + time.wakingHours;
export function phaseAt(hour: number, time = season): CampPhase {
  return hour >= time.phases.night ? "night" : hour >= time.phases.dusk ? "dusk" : "day";
}
export function activityHours(d: Decision, time = season): number {
  return time.activityHours[d.intent];
}
export function placeOpen(place: Tables["locations"][number], hour: number): boolean {
  return hour >= place.openHour && hour < place.closeHour;
}
/** NPC main acts summarize the whole day, rather than taking place at resolution time. */
export function activityFitsDay(t: Tables, d: Decision): boolean {
  const token = d.intent === "TRAIN" ? `TRAIN:${d.args.stat}` : d.intent;
  const hours = activityHours(d, t.season);
  return Number.isInteger(hours) && hours > 0 && hours <= t.season.wakingHours &&
    t.locations.some(p => p.activities.includes(token) && p.closeHour - p.openHour >= hours);
}
