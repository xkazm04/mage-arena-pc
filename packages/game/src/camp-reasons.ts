import type { SeasonView } from "./season-api.ts";

type Place = SeasonView["places"][number];
type Reasons = Pick<SeasonView, "hour" | "listening" | "nightFinished"> & {
  player: Pick<SeasonView["player"], "stocks">;
};
const at = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

/** A closed place's hours, short enough for a map label. */
export function hoursNote(place: Place, hour: number) {
  if (place.isOpen) return "";
  return hour < place.openHour
    ? `Opens ${at(place.openHour)}`
    : `Closed at ${at(place.closeHour)}`;
}

/** Why the player cannot go to a place right now, or "" when they can. */
export function enterBlock(v: Reasons, place: Place) {
  if (v.player.stocks) return "The Vigil keeps you in the stocks until dawn.";
  if (v.listening && !v.nightFinished)
    return "You are listening at the tent flap. Return to the voices first.";
  if (v.nightFinished) return "The night is spent. Meet the morning.";
  if (place.isOpen) return "";
  return v.hour < place.openHour
    ? `${friendlyName(place)} opens at ${at(place.openHour)}, in ${place.openHour - v.hour} ${place.openHour - v.hour === 1 ? "hour" : "hours"}.`
    : `${friendlyName(place)} closed at ${at(place.closeHour)}. It opens again at ${at(place.openHour)} tomorrow.`;
}

const friendlyName = (place: Place) =>
  place.name.replace(/^./, (c) => c.toUpperCase());
