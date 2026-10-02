import data from "../../../docs/design/reconciled/data/camp-play.json" with { type: "json" };
import parleyData from "../../../docs/design/reconciled/data/parley.json" with { type: "json" };
import type { ParleyRecord } from "./parley.ts";
import {
  calendar,
  createState,
  decision,
  legalProblem,
  reconcile,
  resolve,
} from "./camp.ts";
import type {
  CampState,
  DayCarry,
  Decision,
  Fact,
  Intent,
  Resolution,
  Tables,
} from "./types.ts";

export const campPlay = data;
export type Slot = "day" | "dusk" | "night";
export interface Listening {
  tick: number;
  lane: number;
  listening: boolean;
  progress: number;
  clues: number;
  alerts: number;
  exposed: boolean;
  done: boolean;
  learned: string | null;
}
export interface CampSession {
  parleys: ParleyRecord[];
  intentPromises: { target: string; day: number }[];
  camp: CampState;
  slot: Slot;
  location: string;
  budget: number;
  revision: number;
  carry: DayCarry;
  dayActs: Decision[];
  dayEvents: Fact[];
  listening: Listening | null;
  nightFinished: boolean;
  history: { day: number; board: CampState["board"] }[];
  lastResolution: Resolution | null;
}
const emptyCarry = (): DayCarry => ({
  helped: [],
  working: [],
  stopped: [],
  freshStocks: [],
});
export function createCampSession(
  t: Tables,
  seed = 73,
  initial?: CampState,
): CampSession {
  const camp = structuredClone(initial ?? createState(t, seed));
  for (const { holders, ...fact } of data.discoveries) {
    if (!camp.facts.some((f) => f.id === fact.id)) camp.facts.push(fact);
    for (const id of holders)
      if (!camp.characters[id].knowledge.includes(fact.id))
        camp.characters[id].knowledge.push(fact.id);
  }
  return {
    parleys: [],
    intentPromises: [],
    camp,
    slot: "day",
    location: data.startLocation,
    budget: data.travelBudget.day,
    revision: 0,
    carry: emptyCarry(),
    dayActs: [],
    dayEvents: [],
    listening: null,
    nightFinished: false,
    history: [],
    lastResolution: null,
  };
}
export function present(s: CampSession, place = s.location): string[] {
  const slot = ["day", "dusk", "night"].indexOf(s.slot);
  const schedules: Record<string, string[]> = data.presence;
  return Object.values(s.camp.characters)
    .filter(
      (c) =>
        c.id !== s.camp.player &&
        c.life === "Alive" &&
        !c.stocks &&
        schedules[c.id]?.[slot] === place,
    )
    .map((c) => c.id);
}
export function travelCost(from: string, to: string): number {
  const distances: Record<string, number> = Object.fromEntries(
    Object.keys(data.map.nodes).map((id) => [id, Infinity]),
  );
  if (!Object.hasOwn(distances, from) || !Object.hasOwn(distances, to))
    return Infinity;
  distances[from] = 0;
  for (let i = 0; i < Object.keys(distances).length; i++)
    for (const route of data.map.routes) {
      const [a, b, cost] = route as [string, string, number];
      distances[b] = Math.min(distances[b], distances[a] + cost);
      distances[a] = Math.min(distances[a], distances[b] + cost);
    }
  return distances[to];
}
function available(s: CampSession) {
  if (s.camp.ended || s.camp.characters[s.camp.player].life !== "Alive")
    throw new Error("The season has ended.");
  if (s.listening || s.nightFinished)
    throw new Error("The night is already underway.");
}
export function moveCamp(
  t: Tables,
  before: CampSession,
  place: string,
): CampSession {
  available(before);
  const location = t.locations.find((p) => p.id === place);
  if (!location?.open.includes(before.slot))
    throw new Error("That place is closed in this slot.");
  if (before.camp.characters[before.camp.player].stocks)
    throw new Error("The Vigil keeps you in the stocks.");
  const cost = travelCost(before.location, place);
  if (!Number.isFinite(cost) || cost > before.budget)
    throw new Error("Not enough time to travel there.");
  return {
    ...before,
    location: place,
    budget: before.budget - cost,
    revision: before.revision + 1,
  };
}
export function remainingCaps(t: Tables, s: CampSession): Tables {
  const copy = structuredClone(t);
  for (const intent of Object.keys(copy.rules.caps)) {
    const base = intent.replace(/_eve$/, "");
    copy.rules.caps[intent] = Math.max(
      0,
      t.rules.caps[intent] - s.dayActs.filter((d) => d.intent === base).length,
    );
  }
  return copy;
}
export function playerProblem(
  t: Tables,
  s: CampSession,
  d: Decision,
): string | null {
  if (d.character !== s.camp.player)
    return "Only your own activity can be chosen.";
  const basic = legalProblem(t, s.camp, d, true);
  if (basic) return basic;
  const place = t.locations.find((p) => p.id === s.location);
  if (!place?.open.includes(s.slot)) return "This place is closed.";
  if (
    !place.activities.includes(
      d.intent === "TRAIN" ? `TRAIN:${d.args.stat}` : d.intent,
    )
  )
    return "That activity belongs elsewhere.";
  if (s.budget < data.actionCost) return "Not enough time for an activity.";
  if (
    ["BEFRIEND", "PROTECT", "CONFIDE", "WATCH", "RECRUIT"].includes(d.intent) &&
    !present(s).includes(d.args.target)
  )
    return "They are not here in this slot.";
  const cap =
    d.intent === "SCHEME" && calendar(t, s.camp.day).eve
      ? t.rules.caps.SCHEME_eve
      : t.rules.caps[d.intent];
  if (
    cap !== undefined &&
    s.dayActs.filter((a) => a.intent === d.intent).length >= cap
  )
    return "The camp's limit for this activity is spent.";
  return null;
}
export function passSlot(before: CampSession): CampSession {
  available(before);
  const s = structuredClone(before);
  s.revision++;
  if (s.slot === "night") s.nightFinished = true;
  else {
    s.slot = s.slot === "day" ? "dusk" : "night";
    s.budget = data.travelBudget[s.slot];
  }
  return s;
}
export function actCamp(
  t: Tables,
  before: CampSession,
  d: Decision,
): CampSession {
  available(before);
  const problem = playerProblem(t, before, d);
  if (problem) throw new Error(problem);
  const result = resolve(t, before.camp, [d], {
    settleNight: false,
    namespace: before.slot,
    carry: before.carry,
  });
  const s = passSlot(before);
  s.camp = result.state;
  s.carry = result.carry!;
  s.dayActs.push(structuredClone(d));
  s.dayEvents.push(...result.events);
  s.lastResolution = structuredClone(result);
  return s;
}
export function beginListening(before: CampSession): CampSession {
  available(before);
  if (
    before.slot !== "night" ||
    before.location !== "tent" ||
    before.budget < data.actionCost
  )
    throw new Error("Listen at your tent during the night slot.");
  if (before.camp.characters[before.camp.player].stocks)
    throw new Error("The Vigil keeps you in the stocks.");
  return {
    ...before,
    revision: before.revision + 1,
    budget: before.budget - data.actionCost,
    listening: {
      tick: 0,
      lane: 0,
      listening: false,
      progress: 0,
      clues: 0,
      alerts: 0,
      exposed: false,
      done: false,
      learned: null,
    },
  };
}
export function listeningScene(n: Listening) {
  const d = data.listening;
  return {
    patrol: Math.floor(n.tick / d.patrolPeriod) % d.lanes,
    beacon: (Math.floor(n.tick / d.beaconPeriod) + 1) % d.lanes,
    warning: n.tick % d.patrolPeriod < d.warningTicks,
    secondsLeft: Math.ceil(((d.durationTicks - n.tick) * d.tickMs) / 1000),
  };
}
export function stepListening(
  before: CampSession,
  input: { lane: number; listening: boolean },
): CampSession {
  if (
    !Number.isInteger(input.lane) ||
    input.lane < 0 ||
    input.lane >= data.listening.lanes ||
    typeof input.listening !== "boolean"
  )
    throw new Error("Invalid listening input.");
  if (!before.listening || before.listening.done) return before;
  const s = structuredClone(before),
    n = s.listening!,
    scene = listeningScene(n),
    d = data.listening;
  n.lane = input.lane;
  n.listening = input.listening;
  const exposed = n.listening && n.lane === scene.patrol && !scene.warning;
  if (exposed) {
    if (!n.exposed) {
      n.alerts++;
      n.clues = Math.max(0, n.clues - d.alertClueLoss);
    }
    n.progress = 0;
  } else if (n.listening && n.lane === scene.beacon) {
    n.progress++;
    if (n.progress >= d.captureTicks) {
      n.clues++;
      n.progress = 0;
    }
  } else n.progress = 0;
  n.exposed = exposed;
  n.tick++;
  if (n.tick >= d.durationTicks) {
    n.done = true;
    s.nightFinished = true;
    if (n.clues >= d.requiredClues) {
      const player = s.camp.characters[s.camp.player];
      const eligible = s.camp.facts.filter(
        (f) =>
          !player.knowledge.includes(f.id) &&
          f.truth !== false &&
          (f.visibility !== "secret" ||
            data.discoveries.some((d) => d.id === f.id)) &&
          present(s).some((id) =>
            s.camp.characters[id].knowledge.includes(f.id),
          ),
      );
      const fact = eligible.sort(
        (a, b) =>
          Number(b.type === "knowing") - Number(a.type === "knowing") ||
          a.id.localeCompare(b.id),
      )[0];
      if (fact) {
        player.knowledge.push(fact.id);
        n.learned = fact.id;
      }
    }
  }
  s.revision++;
  return s;
}
export function settleCamp(
  t: Tables,
  before: CampSession,
  proposals: Decision[],
  fallback: (id: string) => Decision,
  friendly?: (id: string) => Decision,
): CampSession {
  if (before.slot !== "night" || !before.nightFinished)
    throw new Error("The night act has not ended.");
  const limited = remainingCaps(t, before);
  const replaced = [...proposals];
  for (const promise of before.intentPromises.filter(
    (p) => p.day === before.camp.day,
  )) {
    const candidate =
      friendly?.(promise.target) ??
      decision(t, before.camp, promise.target, "BEFRIEND", {
        target: before.camp.player,
      });
    if (
      candidate.character === promise.target &&
      candidate.args.target === before.camp.player &&
      parleyData.friendlyIntents.includes(candidate.intent) &&
      !legalProblem(t, before.camp, candidate)
    ) {
      for (let i = replaced.length - 1; i >= 0; i--)
        if (replaced[i].character === promise.target) replaced.splice(i, 1);
      replaced.push(candidate);
    }
  }
  const accepted = reconcile(limited, before.camp, replaced, fallback);
  const result = resolve(t, before.camp, accepted.items, {
    carry: before.carry,
  });
  const visible = [...before.dayEvents, ...result.events].filter(
    (f) =>
      f.visibility === "public" ||
      result.state.characters[result.state.player].knowledge.includes(f.id),
  );
  result.state.board = visible.map((f) => ({
    factId: f.id,
    text:
      f.visibility === "secret"
        ? `Journal: ${f.text}`
        : f.visibility === "witnessed"
          ? `Someone saw: ${f.text}`
          : f.text,
  }));
  return {
    ...before,
    camp: result.state,
    slot: "day",
    location: data.startLocation,
    budget: data.travelBudget.day,
    revision: before.revision + 1,
    carry: emptyCarry(),
    dayActs: [],
    dayEvents: [],
    listening: null,
    nightFinished: false,
    history: [
      ...before.history,
      { day: before.camp.day, board: structuredClone(result.state.board) },
    ],
    lastResolution: structuredClone(result),
    intentPromises: [],
  };
}
export function campActions(t: Tables, s: CampSession) {
  const candidates: Decision[] = [];
  const put = (intent: Intent, args: Record<string, string> = {}) =>
    candidates.push(decision(t, s.camp, s.camp.player, intent, args));
  for (const token of t.locations.find((p) => p.id === s.location)
    ?.activities ?? []) {
    const [verb, stat] = token.split(":");
    const intent = verb as Intent;
    if (intent === "TRAIN") put(intent, { stat });
    else if (["REST", "WORK", "PLOT"].includes(intent)) put(intent);
    else if (intent === "DEFECT")
      for (const school of t.schools) put(intent, { toTent: school.tent });
    else
      for (const c of Object.values(s.camp.characters).filter(
        (c) => c.id !== s.camp.player && c.life === "Alive",
      )) {
        const target = c.id;
        if (intent === "CONFIDE")
          for (const factId of s.camp.characters[s.camp.player].knowledge)
            put(intent, { target, factId });
        else if (intent === "SCHEME")
          for (const kind of Object.keys(t.rules.schemes)) {
            if (kind === "rumour")
              for (const topic of Object.keys(t.rules.schemes.rumour.reactions))
                put(intent, { target, kind, topic });
            else put(intent, { target, kind });
          }
        else if (intent === "OFFER")
          put(intent, { target, terms: "back_entrant" });
        else put(intent, { target });
      }
  }
  return candidates
    .filter((d) => !playerProblem(t, s, d))
    .map((d) => ({
      id: JSON.stringify([d.intent, d.args]),
      decision: d,
      label: [
        d.intent === "PLOT"
          ? "Plan the bond"
          : d.intent.toLowerCase().replaceAll("_", " "),
        d.args.stat,
        s.camp.characters[d.args.target]?.name,
        d.args.kind,
        d.args.topic,
        d.args.toTent,
        d.args.factId
          ? s.camp.facts.find((f) => f.id === d.args.factId)?.text
          : undefined,
      ]
        .filter(Boolean)
        .join(" · "),
    }));
}
export function campView(t: Tables, s: CampSession) {
  const player = s.camp.characters[s.camp.player],
    day = calendar(t, s.camp.day);
  return {
    revision: s.revision,
    day,
    slot: s.slot,
    location: s.location,
    budget: s.budget,
    ended: s.camp.ended,
    player: {
      name: player.name,
      school: player.school,
      gold: player.gold,
      hunger: player.hunger,
      fatigue: player.fatigue,
      stats: player.stats,
      points: player.points,
      stocks: player.stocks,
    },
    places: t.locations.map((p) => ({
      ...p,
      description: (data.descriptions as Record<string, string>)[p.id],
      position: (data.map.nodes as Record<string, number[]>)[p.id],
      cost: travelCost(s.location, p.id),
      isOpen: p.open.includes(s.slot),
    })),
    presence: present(s).map((id) => ({
      id,
      name: s.camp.characters[id].name,
      school: s.camp.characters[id].school,
      trust: s.camp.trust[`${id}>${s.camp.player}`],
    })),
    actions:
      s.listening || s.nightFinished || s.camp.ended
        ? []
        : campActions(t, s).map(({ id, label, decision: d }) => ({
            id,
            label,
            intent: d.intent,
            gains: actionPreview(t, s, d),
          })),
    actionCost: data.actionCost,
    listeningRules: {
      requiredClues: data.listening.requiredClues,
      captureTicks: data.listening.captureTicks,
      lanes: data.listening.lanes,
    },
    calendar: Array.from(
      { length: t.season.weeks * t.season.daysPerWeek },
      (_, i) => calendar(t, i + 1),
    ),
    board: s.camp.board
      .filter((b) => {
        const f = s.camp.facts.find((f) => f.id === b.factId);
        return (
          f &&
          f.visibility !== "secret" &&
          (f.visibility === "public" || player.knowledge.includes(f.id))
        );
      })
      .map((b) => ({
        ...b,
        rumour: s.camp.facts.find((f) => f.id === b.factId)?.truth === false,
      })),
    journal: s.camp.facts
      .filter((f) => player.knowledge.includes(f.id))
      .map((f) => ({
        id: f.id,
        text: f.text,
        visibility: f.visibility,
        rumour: f.truth === false,
      })),
    listening: s.listening
      ? { ...s.listening, ...listeningScene(s.listening) }
      : null,
    nightFinished: s.nightFinished,
    changes:
      s.lastResolution?.trace
        .filter(
          (x) =>
            (x.path.startsWith(`characters/${s.camp.player}/`) &&
              !x.path.endsWith("/knowledge")) ||
            x.path.startsWith(`trust/${s.camp.player}>`) ||
            x.path.endsWith(`>${s.camp.player}`),
        )
        .slice(0, 8) ?? [],
  };
}
export type CampView = ReturnType<typeof campView>;

function actionPreview(t: Tables, s: CampSession, d: Decision): string {
  const r = t.rules.effects,
    p = s.camp.characters[s.camp.player];
  switch (d.intent) {
    case "TRAIN": {
      let points =
        p.hunger >= r.daily.hungryAt ? r.TRAIN.hungryPoints : r.TRAIN.points;
      if (p.fatigue >= r.daily.fatiguedAt)
        points = Math.floor(points * r.daily.fatigueTrainMultiplier);
      return `+${points} ${d.args.stat} practice`;
    }
    case "WORK":
      return `+${r.WORK.gold} gold · +${r.WORK.stores} tent stores · +${r.WORK.fatigue} fatigue`;
    case "REST":
      return `${r.REST.fatigue} fatigue`;
    case "CONFIDE":
      return `Share a known fact · +${r.CONFIDE.trust} mutual trust`;
    case "BEFRIEND": {
      const b = s.camp.characters[d.args.target],
        e = r.BEFRIEND;
      const gain = Math.floor(
        e.trust *
          (p.tent !== b.tent && p.rank === b.rank ? e.peerMultiplier : 1) *
          (Math.abs(p.traits.aggression - b.traits.aggression) >=
          e.aggressionGap
            ? e.gapMultiplier
            : 1),
      );
      return `+${gain} mutual trust`;
    }
    case "PROTECT":
      return `Costs ${r.PROTECT.costGold} gold · feed and warn them; hungry friends gain trust`;
    case "WATCH":
      return "Guile contest · discover a fact; being noticed costs trust";
    case "SCHEME":
      return "Guile contest · failure risks the stocks";
    case "REPORT":
      return "Ask the Vigil to investigate · a contested outcome";
    case "RECRUIT":
      return "Guile contest · invite them to your cause";
    case "DEFECT":
      return "Change tents and loyalties";
    case "PLOT":
      return `+${r.PLOT.progress} bond progress`;
    case "OFFER":
      return "Offer a private favour";
  }
}
