import data from "../data/audio.json" with { type: "json" };
import { schools, type ArenaEvent, type School } from "@mage/core/arena";

/** Who an event's actor must be, relative to the listening player, for a route to play. */
export type RouteWho = "player" | "others" | "enemy" | "allies" | "any";
/**
 * One row of `audio.json` routes: an event kind plays `cue` when the actor matches `who`.
 * `cue` may name a template field (`cast.{school}`) read from the actor, with `fallback` when it is absent.
 * `value` requires that event value; `damage` requires a positive hit and scales gain by
 * `min(1, base + damage / per)`; `spatial` pans and attenuates by the actor's offset from the listener.
 */
export interface Route {
  who: string;
  cue: string;
  spatial?: boolean;
  value?: number;
  fallback?: Record<string, string>;
  damage?: { base: number; per: number };
}
export type Routes = Record<string, Route[]>;
export interface RouteActor {
  id: number;
  pos: { x: number; y: number };
  /** Truthy for enemies (the sim stores the enemy brain here). */
  enemy?: unknown;
  school?: School;
}
export interface RouteView {
  listener: { id: number; pos: { x: number; y: number } };
  actor: RouteActor | undefined;
}
/** Absent pan/gain play at the cue's defaults (centred, full gain), as a bare `play(cue)` does. */
export interface CueRequest {
  cue: string;
  pan?: number;
  gain?: number;
}
type RoutedEvent = Pick<ArenaEvent, "kind" | "actorId" | "value"> & {
  contactDamage?: number;
};

/** The values each cue template field can take, for validation and the event coverage test. */
export const templateValues: Record<string, readonly string[]> = {
  school: schools,
};
const field = /\{(\w+)\}/g;

/** Pan is the raw offset over range (unclamped: audio.ts applies `maxPan` to spatial cues). */
export function spatialMix(
  dx: number,
  dy: number,
  spatial: { rangeM: number; minGain: number } = data.spatial,
) {
  return {
    pan: dx / spatial.rangeM,
    gain: Math.max(spatial.minGain, 1 - Math.hypot(dx, dy) / spatial.rangeM),
  };
}

function matches(who: string, e: RoutedEvent, view: RouteView) {
  const player = e.actorId === view.listener.id;
  if (who === "player") return player;
  if (who === "others") return !player;
  if (who === "enemy") return !!view.actor!.enemy;
  if (who === "allies") return !view.actor!.enemy;
  return who === "any";
}

/** The cues one sim event plays for the listening player, every matching row in table order. */
export function routeEvent(
  e: RoutedEvent,
  view: RouteView,
  routes: Routes = data.routes,
  spatial: { rangeM: number; minGain: number } = data.spatial,
): CueRequest[] {
  const actor = view.actor;
  if (!actor) return [];
  const out: CueRequest[] = [];
  for (const r of routes[e.kind] ?? []) {
    if (!matches(r.who, e, view)) continue;
    if (r.value !== undefined && e.value !== r.value) continue;
    const damage = e.contactDamage ?? e.value;
    if (r.damage && !(damage > 0)) continue;
    const cue = r.cue.replace(
      field,
      (_, name: string) =>
        (actor as unknown as Record<string, string | undefined>)[name] ??
        r.fallback?.[name] ??
        "",
    );
    if (!r.spatial) {
      out.push({ cue });
      continue;
    }
    const mix = spatialMix(
      actor.pos.x - view.listener.pos.x,
      actor.pos.y - view.listener.pos.y,
      spatial,
    );
    if (r.damage)
      mix.gain = mix.gain * Math.min(1, r.damage.base + damage / r.damage.per);
    out.push({ cue, ...mix });
  }
  return out;
}

/** Every cue name a route can emit, its template fields expanded over `templateValues`. */
export function routeCues(route: Route): string[] {
  let names = [route.cue];
  for (const [, name] of route.cue.matchAll(field)) {
    const values = templateValues[name!] ?? [];
    names = names.flatMap((n) => values.map((v) => n.replace(`{${name}}`, v)));
  }
  return names;
}
/** Routes whose `who` is not a known selector, or whose expanded cues do not all exist. */
export function routeProblems(
  routes: Routes,
  cues: Record<string, unknown>,
): string[] {
  const who: string[] = ["player", "others", "enemy", "allies", "any"];
  return Object.entries(routes)
    .filter(
      ([, rs]) =>
        !rs.length ||
        rs.some((r) => {
          const names = routeCues(r);
          return (
            !who.includes(r.who) ||
            !names.length ||
            names.some((n) => !(n in cues))
          );
        }),
    )
    .map(([kind]) => `routes:${kind}`);
}
/** Sim event kinds no route plays yet (D2 4.5 fills them with a route each). */
export const uncuedKinds = (kinds: string[], routes: Routes = data.routes) =>
  kinds.filter((k) => !routes[k]?.length);
