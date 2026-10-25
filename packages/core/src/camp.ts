import { activityFitsDay } from "./camp-time.ts";
import { member } from "./arena/doors.ts";
import { boardLine, campRules, capFor, type Contest } from "./camp-rules.ts";
// Pure season reference extracted from W0. No IO, clock, model, or unseeded RNG.
import type {
  Tables,
  CampState,
  Decision,
  Intent,
  Fallback,
  Verdict,
  Trace,
  Roll,
  Fact,
  Resolution,
  DayCarry,
} from "./types.ts";
export function createState(
  t: Tables,
  seed: number,
  day = 1,
  player = "cassia",
): CampState {
  if (!Number.isSafeInteger(seed))
    throw new Error("Seed must be a safe integer");
  if (
    !Number.isSafeInteger(day) ||
    day < 1 ||
    day > t.season.weeks * t.season.daysPerWeek
  )
    throw new Error("Day is outside the season");
  if (
    !t.characters.characters.some((c) => c.id === player && c.role === "main")
  )
    throw new Error("Player must be a main character");
  const r = t.rules;
  const characters = Object.fromEntries(
    t.characters.characters.map((sheet) => {
      const c = structuredClone(sheet);
      return [
        c.id,
        {
          ...c,
          points: Object.fromEntries(
            r.stats.names.map((s) => [
              s,
              r.stats.rankThresholds[c.stats[s] - 1],
            ]),
          ),
          gold: r.initial.gold,
          renown: r.initial.renown,
          hunger:
            c.tent === "strays" ? r.initial.strayHunger : r.initial.hunger,
          loyalty:
            c.tent === "strays"
              ? r.initial.strayLoyalty
              : c.traits.loyalty * r.initial.loyaltyTraitMultiplier,
          fatigue: r.initial.fatigue,
          mastery: r.initial.mastery,
          mood: "calm",
          knowledge: [...c.knowledgeSeed],
          life: member(t["death-reservation"].defaults.lifeState, ["Alive"], "default life state"),
          sick: false,
          warned: false,
          stocks: false,
          lastScheme: null,
        },
      ];
    }),
  );
  const trust: Record<string, number> = {},
    debt: Record<string, number> = {};
  for (const a of Object.keys(characters))
    for (const b of Object.keys(characters))
      if (a !== b) {
        trust[`${a}>${b}`] = r.initial.trust;
        debt[`${a}>${b}`] = r.initial.debt;
      }
  for (const rel of t.relationships) {
    trust[`${rel.from}>${rel.to}`] = rel.trust;
    debt[`${rel.from}>${rel.to}`] = rel.debt;
  }
  return {
    seed,
    day,
    player,
    characters,
    trust,
    debt,
    stores: Object.fromEntries(
      t.schools.map((s) => [s.tent, r.initial.stores]),
    ),
    facts: structuredClone(t.facts),
    board: [],
    bond: "scattered_four",
    bondProgress: 0,
    strays: "scattered",
    fifth: [],
    plots: [],
    vigilAttention: t["death-reservation"].defaults.vigilAttention,
    investigations: [],
    ended: false,
  };
}

export function calendar(t: Tables, day: number) {
  const weekday = ((day - 1) % t.season.daysPerWeek) + 1;
  return {
    day,
    trialHour: t.season.trialHour,
    gamesHour: t.season.gamesHour,
    week: Math.floor((day - 1) / t.season.daysPerWeek) + 1,
    weekday,
    games: weekday === t.season.gamesWeekday,
    eve: weekday === t.season.gamesWeekday - t.season.trialOffsetBeforeGames,
    schemesOpen: weekday >= t.season.schemeOpensWeekday,
  };
}

export function decision(
  t: Tables,
  state: CampState,
  id: string,
  intent: Intent = "REST",
  args: Record<string, string> = {},
): Decision {
  const c = state.characters[id];
  return {
    character: id,
    intent,
    args,
    goal: c.goal.id,
    mood: c.mood,
    reasonValue: c.values[0],
    citedFacts: [],
    line: t.phrases[intent],
  };
}

export function lineProblem(t: Tables, line: unknown): string | null {
  if (
    typeof line !== "string" ||
    !line.trim() ||
    line.length > t.rules.line.maxLength
  )
    return "line-length";
  if (/\p{N}/u.test(line)) return "line-number";
  const lower = line.toLowerCase();
  if (
    t.rules.line.numberWords.some((w) =>
      new RegExp(`\\b${w}\\b`, "u").test(lower),
    )
  )
    return "line-number-word";
  if (
    t.rules.line.bannedConsequences.some((w) =>
      new RegExp(`\\b${w}\\b`, "u").test(lower),
    )
  )
    return "line-consequence";
  const lexicon = new Set([
    ...t.rules.line.safeCapitals,
    ...t.characters.characters.flatMap((c) => c.name.split(/\s+/)),
  ]);
  if ((line.match(/\b[A-Z][a-zA-Z]+\b/g) ?? []).some((w) => !lexicon.has(w)))
    return "line-name";
  if (/[{}<>]|https?:|ignore .*instructions|system prompt/i.test(line))
    return "line-instruction";
  return null;
}

export function legalProblem(
  t: Tables,
  state: CampState,
  item: Decision,
  allowPlayer = false,
): string | null {
  const c = state.characters[item.character];
  if (!c || c.life !== "Alive" || (!allowPlayer && item.character === state.player))
    return "actor";
  if (!Object.hasOwn(t.intents, item.intent)) return "intent";
  const def = t.intents[item.intent];
  if (!item.args || typeof item.args !== "object" || Array.isArray(item.args))
    return "args";
  if (
    def.args.some((k) => typeof item.args[k] !== "string") ||
    Object.keys(item.args).some(
      (k) => ![...def.args, ...def.optionalArgs].includes(k),
    )
  )
    return "args";
  if (
    c.forbiddenIntents.some(
      (f) =>
        f === item.intent ||
        f === `${item.intent}:*` ||
        f === `${item.intent}:${item.args.kind}`,
    )
  )
    return "forbidden";
  if (!Object.hasOwn(t.goals, item.goal)) return "goal";
  if (!t.characters.moods.includes(item.mood)) return "mood";
  if (!c.values.includes(item.reasonValue)) return "value";
  if (
    !Array.isArray(item.citedFacts) ||
    item.citedFacts.length > t.rules.line.maxCitedFacts ||
    item.citedFacts.some((f) => !c.knowledge.includes(f))
  )
    return "knowledge";
  const target = state.characters[item.args.target];
  if (
    def.args.includes("target") &&
    (!target || target.life !== "Alive" || target.id === c.id)
  )
    return "target";
  if (c.stocks && item.intent !== "REST" && c.id !== "venno") return "stocks";
  if (item.intent === "TRAIN" && !t.rules.stats.names.includes(item.args.stat))
    return "stat";
  if (item.intent === "PROTECT" && c.gold < t.rules.effects.PROTECT.costGold)
    return "resources";
  if (!activityFitsDay(t, item)) return "activity-hours";
  if (item.intent === "CONFIDE" && !c.knowledge.includes(item.args.factId))
    return "fact";
  if (item.intent === "SCHEME") {
    if (!Object.hasOwn(t.rules.schemes, item.args.kind)) return "scheme-kind";
    if (!calendar(t, state.day).schemesOpen) return "scheme-window";
    if (
      c.goal.id === "keep_peace" ||
      item.goal === "keep_peace" ||
      (c.goal.id === "protect" && c.goal.target === target.id)
    )
      return "goal-conflict";
    if (
      c.lastScheme?.day === state.day - 1 &&
      c.lastScheme.target === target.id
    )
      return "repeat-target";
    if (item.args.kind === "poison" && target.sick) return "already-sick";
    if (
      item.args.kind === "rumour" &&
      !Object.hasOwn(t.rules.schemes.rumour.reactions, item.args.topic ?? "")
    )
      return "rumour-topic";
    if (item.args.kind !== "rumour" && Object.hasOwn(item.args, "topic"))
      return "args";
    if (item.args.kind === "steal" && !Object.hasOwn(state.stores, target.tent))
      return "no-stores";
  }
  if (
    item.intent === "PLOT" &&
    (c.role !== "main" ||
      !["first_watch", "plotting", "sworn"].includes(state.bond))
  )
    return "bond-edge";
  if (
    item.intent === "OFFER" &&
    (c.id !== "venno" ||
      !["favour_for_training", "back_entrant"].includes(item.args.terms))
  )
    return "offer";
  if (item.intent === "DEFECT") {
    const tent = item.args.toTent,
      elder = Object.values(state.characters).find(
        (x) => x.role === "elder" && x.tent === tent,
      );
    if (
      !elder ||
      tent === c.tent ||
      c.loyalty >= t.rules.effects.DEFECT.loyaltyBelow ||
      !Object.values(state.characters).some(
        (x) =>
          x.tent === tent &&
          state.trust[`${c.id}>${x.id}`] >= t.rules.effects.DEFECT.trustAtLeast,
      ) ||
      !(
        elder.traits.warmth >= t.rules.arcs.elderWarmth ||
        state.stores[tent] >= t.rules.arcs.storesAcceptance
      )
    )
      return "defect-edge";
  }
  if (
    item.intent === "RECRUIT" &&
    target.tent === "strays" &&
    !["build_fifth_tent", "hold_fifth_tent"].includes(c.goal.id)
  )
    return "recruit-edge";
  return null;
}

export function safeFallback(
  t: Tables,
  state: CampState,
  id: string,
): Decision {
  return id === "venno"
    ? decision(t, state, id, "WATCH", { target: state.player })
    : decision(t, state, id);
}

export function reconcile(
  t: Tables,
  state: CampState,
  proposed: Decision[],
  fallback: Fallback = (id) => safeFallback(t, state, id),
) {
  const items: Decision[] = [],
    verdicts: Verdict[] = [];
  const actorIds = Object.keys(state.characters)
    .filter(
      (id) => id !== state.player && state.characters[id].life === "Alive",
    )
    .sort();
  for (const id of actorIds) {
    const matches = proposed.filter(
      (x) => x && typeof x === "object" && x.character === id,
    );
    let item = matches[0];
    const reason =
      matches.length !== 1
        ? matches.length
          ? "duplicate"
          : "missing"
        : legalProblem(t, state, item);
    if (reason) item = fallback(id);
    if (legalProblem(t, state, item))
      throw new Error(`Illegal fallback for ${id}`);
    const lineReason = lineProblem(t, item.line);
    item = structuredClone(item);
    if (lineReason) item.line = t.phrases[item.intent];
    items.push(item);
    verdicts.push({
      character: id,
      rejected: Boolean(reason),
      reason,
      lineReplaced: lineReason,
    });
  }
  for (const intent of Object.keys(t.rules.caps).filter(
    (x) => !x.endsWith("_eve"),
  )) {
    const cap = capFor(t, state.day, intent)!;
    const candidates = items
      .filter((x) => x.intent === intent)
      .sort(
        (a, b) =>
          state.characters[b.character].traits.cunning -
            state.characters[a.character].traits.cunning ||
          a.character.localeCompare(b.character),
      );
    for (const item of candidates.slice(cap)) {
      const v = verdicts.find((x) => x.character === item.character)!;
      v.rejected = true;
      v.reason = "cap";
      // A cap fallback cannot consume another scarce slot, even if the utility planner prefers it.
      const replacement = fallback(item.character);
      items[items.indexOf(item)] = Object.hasOwn(
        t.rules.caps,
        replacement.intent,
      )
        ? safeFallback(t, state, item.character)
        : replacement;
    }
  }
  return { items, verdicts };
}

export function seededUnit(
  seed: number,
  day: number,
  actor: string,
  action: string,
) {
  let h = 2166136261;
  for (const ch of `${seed}|${day}|${actor}|${action}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function resolve(
  t: Tables,
  before: CampState,
  items: Decision[],
  options: { settleNight?: boolean; namespace?: string; carry?: DayCarry } = {},
): Resolution {
  const state = structuredClone(before),
    trace: Trace[] = [],
    rolls: Roll[] = [],
    events: Fact[] = [],
    r = t.rules;
  if (state.ended) throw new Error("Season has ended");
  const set = (path: string, value: unknown, rule: string) => {
    const parts = path.split("/"),
      key = parts.pop()!;
    let obj = state as unknown as Record<string, unknown>;
    for (const p of parts) obj = obj[p] as Record<string, unknown>;
    if (JSON.stringify(obj[key]) !== JSON.stringify(value)) {
      trace.push({
        path,
        before: structuredClone(obj[key]),
        after: structuredClone(value),
        rule,
      });
      obj[key] = value;
    }
  };
  const add = (
    path: string,
    amount: number,
    rule: string,
    range?: number[],
  ) => {
    const old = path
      .split("/")
      .reduce<unknown>(
        (o, k) => (o as Record<string, unknown>)[k],
        state,
      ) as number;
    set(
      path,
      range
        ? Math.max(range[0], Math.min(range[1], old + amount))
        : old + amount,
      rule,
    );
  };
  const change = (id: string, field: string, amount: number, rule: string) =>
    add(`characters/${id}/${field}`, amount, rule, r.ranges[field]);
  const trust = (a: string, b: string, amount: number, rule: string) =>
    add(`trust/${a}>${b}`, amount, rule, r.ranges.trust);
  const die = (id: string, action: string) => {
    const unit = seededUnit(state.seed, state.day, id, action),
      value = Math.floor(unit * r.contests.dieSides) + 1;
    rolls.push({
      seed: state.seed,
      day: state.day,
      actor: id,
      action,
      unit,
      value,
      rule: "rules/contests/dieSides",
    });
    return value;
  };
  const fact = (
    type: string,
    actor: string,
    target: string,
    visibility: string,
    text: string,
    truth = true,
  ) => {
    const f = {
      id: `event:${state.day}:${options.namespace ? `${options.namespace}:` : ""}${actor}:${type}:${events.length}`,
      type,
      actor,
      target,
      visibility,
      text,
      truth,
    };
    events.push(f);
    // Only participants know secret events; public events reach everyone.
    for (const c of Object.values(state.characters))
      if (
        visibility === "public" ||
        c.id === actor ||
        c.id === target ||
        (visibility === "witnessed" &&
          [
            state.characters[actor]?.tent,
            state.characters[target]?.tent,
          ].includes(c.tent))
      ) {
        set(
          `characters/${c.id}/knowledge`,
          [...c.knowledge, f.id],
          "rules/factVisibility",
        );
      }
  };
  const train = (id: string, stat: string, points: number, rule: string) => {
    const c = state.characters[id];
    add(`characters/${id}/points/${stat}`, points, rule);
    set(
      `characters/${id}/stats/${stat}`,
      r.stats.rankThresholds.filter((n) => c.points[stat] >= n).length,
      "rules/stats/rankThresholds",
    );
  };
  const helped = new Set<string>(options.carry?.helped),
    working = new Set<string>(options.carry?.working),
    stopped = new Set<string>(options.carry?.stopped),
    freshStocks = new Set<string>(options.carry?.freshStocks);
  const base = { t, r, state, dayAct: options.settleNight === false, carry: { helped, working, stopped, freshStocks }, set, add, change, trust, train, fact };
  for (const c of Object.values(state.characters)) {
    if (options.settleNight !== false && !helped.has(c.id))
      set(`characters/${c.id}/warned`, false, "rules/effects/PROTECT/warningDc");
  }
  for (const item of [...items].sort(
    (a, b) =>
      r.resolutionOrder.indexOf(a.intent) -
        r.resolutionOrder.indexOf(b.intent) ||
      a.character.localeCompare(b.character),
  )) {
    const a = state.characters[item.character],
      b = state.characters[item.args.target],
      e: Record<string, number> = r.effects[item.intent];
    const ref = `rules/effects/${item.intent}`;
    set(`characters/${a.id}/mood`, item.mood, "characters/moods");
    set(`characters/${a.id}/goal/id`, item.goal, "goals");
    const roll = (c: Contest) => {
      const score = c.bonus + die(a.id, c.action);
      return { score, success: score > c.dc, record: rolls.at(-1)! };
    };
    campRules[item.intent].effect({ ...base, item, a, b, e, ref, roll });
  }
  if (options.settleNight === false) {
    set("facts", [...state.facts, ...events], "rules/factVisibility");
    return { state, trace, rolls, events, carry: {
      helped: [...helped], working: [...working], stopped: [...stopped], freshStocks: [...freshStocks],
    } };
  }
  for (const c of Object.values(state.characters)) {
    if (c.life !== "Alive") continue;
    if (c.tent === "strays" && !helped.has(c.id))
      change(
        c.id,
        "hunger",
        working.has(c.id)
          ? r.effects.daily.workingHunger
          : r.effects.daily.hunger,
        "rules/effects/daily",
      );
    const school = t.schools.find((x) => x.id === c.school);
    if (school && c.id !== state.player && !before.characters[c.id].stocks)
      train(
        c.id,
        school.preferredStat,
        r.effects.daily.routinePoints,
        "rules/effects/daily/routinePoints",
      );
    if (before.characters[c.id].stocks && !freshStocks.has(c.id))
      set(`characters/${c.id}/stocks`, false, "rules/effects/caught");
  }
  if ([...helped].some((id) => before.characters[id].tent === "strays"))
    set("strays", "huddled", "rules/arcs/huddledHelps");
  for (const c of Object.values(state.characters).filter(
    (x) => x.tent === "strays" && x.life === "Alive",
  )) {
    const host = Object.values(state.characters)
      .filter(
        (x) =>
          Object.hasOwn(state.stores, x.tent) &&
          state.trust[`${c.id}>${x.id}`] >= r.arcs.takenInTrust,
      )
      .sort((a, b) => a.id.localeCompare(b.id))
      .find((x) => {
        const elder = Object.values(state.characters).find(
          (e) => e.role === "elder" && e.tent === x.tent,
        );
        return (
          elder &&
          (elder.traits.warmth >= r.arcs.elderWarmth ||
            state.stores[x.tent] >= r.arcs.storesAcceptance)
        );
      });
    if (host) {
      set(`characters/${c.id}/tent`, host.tent, "rules/arcs/takenInTrust");
      set(
        `characters/${c.id}/loyalty`,
        r.arcs.newMemberLoyalty,
        "rules/arcs/newMemberLoyalty",
      );
      fact(
        "joined",
        c.id,
        host.id,
        "public",
        `${c.name} now sleeps in the ${host.tent} tent.`,
      );
    }
  }
  for (const a of Object.values(state.characters))
    for (const b of Object.values(state.characters))
      if (
        a.id !== b.id &&
        a.life === "Alive" &&
        b.life === "Alive" &&
        Object.hasOwn(state.stores, a.tent) &&
        a.tent === b.tent &&
        a.rank === b.rank
      )
        trust(
          a.id,
          b.id,
          r.effects.daily.sameTentTrust,
          "rules/effects/daily/sameTentTrust",
        );
  const mains = Object.values(state.characters).filter(
      (c) => c.role === "main",
    ),
    pairs = [];
  for (let i = 0; i < mains.length; i++)
    for (let j = i + 1; j < mains.length; j++)
      pairs.push(
        Math.min(
          state.trust[`${mains[i].id}>${mains[j].id}`],
          state.trust[`${mains[j].id}>${mains[i].id}`],
        ),
      );
  if (
    pairs.some((p) => p < r.arcs.bondFractureTrust) &&
    state.bond !== "scattered_four"
  )
    set("bond", "fractured", "rules/arcs/bondFractureTrust");
  if (
    state.bond === "scattered_four" &&
    state.day >= r.arcs.bondEarliestDay &&
    pairs.filter((p) => p >= r.arcs.bondTrust).length >= r.arcs.bondPairs
  )
    set("bond", "first_watch", "rules/arcs");
  if (
    state.bond === "plotting" &&
    pairs.every((p) => p >= r.arcs.bondSwornTrust) &&
    state.bondProgress >= r.arcs.bondStepProgress
  )
    set("bond", "sworn", "rules/arcs");
  const strays = Object.values(state.characters).filter(
    (c) => c.tent === "strays",
  );
  if (
    state.strays === "huddled" &&
    strays.length &&
    strays.reduce((sum, c) => sum + c.hunger, 0) / strays.length >=
      r.arcs.desperateHunger
  )
    set("strays", "desperate", "rules/arcs/desperateHunger");
  if (calendar(t, state.day).games)
    for (const c of Object.values(state.characters))
      set(`characters/${c.id}/sick`, false, "rules/schemes/poison");
  set("facts", [...state.facts, ...events], "rules/factVisibility");
  set(
    "board",
    events
      .filter(
        (f) =>
          f.visibility === "public" ||
          state.characters[state.player].knowledge.includes(f.id),
      )
      .map((f) => ({ factId: f.id, text: boardLine(f) })),
    "rules/factVisibility",
  );
  if (state.day >= t.season.weeks * t.season.daysPerWeek)
    set("ended", true, "season/weeks");
  else set("day", state.day + 1, "season/daysPerWeek");
  return { state, trace, rolls, events };
}

export function goldenNights(t: Tables) {
  let state = createState(t, t.scenarios.seed, t.scenarios.startDay);
  const nights = [];
  for (const scenario of t.scenarios.nights) {
    const proposed = Object.keys(state.characters)
      .filter((id) => id !== state.player)
      .map((id) => {
        const choice = scenario.choices[id];
        return choice
          ? decision(t, state, id, ...choice)
          : safeFallback(t, state, id);
      });
    const validated = reconcile(t, state, proposed);
    const result = resolve(t, state, validated.items);
    nights.push({
      id: scenario.id,
      label: "simulated",
      before: state,
      calendar: calendar(t, state.day),
      proposed,
      ...validated,
      ...result,
    });
    state = result.state;
  }
  return nights;
}
