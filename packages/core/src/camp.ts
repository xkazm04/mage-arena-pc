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
          life: t["death-reservation"].defaults.lifeState as "Alive",
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
): string | null {
  const c = state.characters[item.character];
  if (!c || c.life !== "Alive" || item.character === state.player)
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
    const cap =
      intent === "SCHEME" && calendar(t, state.day).eve
        ? t.rules.caps.SCHEME_eve
        : t.rules.caps[intent];
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
      id: `event:${state.day}:${actor}:${type}:${events.length}`,
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
  const helped = new Set<string>(),
    working = new Set<string>(),
    stopped = new Set<string>();
  for (const c of Object.values(state.characters)) {
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
    switch (item.intent) {
      case "REST":
        change(a.id, "fatigue", e.fatigue, `${ref}/fatigue`);
        break;
      case "TRAIN": {
        let p =
          a.hunger >= r.effects.daily.hungryAt ? e.hungryPoints : e.points;
        if (a.fatigue >= r.effects.daily.fatiguedAt)
          p = Math.floor(p * r.effects.daily.fatigueTrainMultiplier);
        train(a.id, item.args.stat, p, ref);
        break;
      }
      case "WORK":
        change(a.id, "gold", e.gold, `${ref}/gold`);
        change(a.id, "fatigue", e.fatigue, `${ref}/fatigue`);
        working.add(a.id);
        if (Object.hasOwn(state.stores, a.tent))
          add(`stores/${a.tent}`, e.stores, `${ref}/stores`, r.ranges.stores);
        break;
      case "BEFRIEND": {
        let gain = e.trust;
        if (a.tent !== b.tent && a.rank === b.rank) gain *= e.peerMultiplier;
        if (
          Math.abs(a.traits.aggression - b.traits.aggression) >= e.aggressionGap
        )
          gain *= e.gapMultiplier;
        gain = Math.floor(gain);
        trust(a.id, b.id, gain, ref);
        trust(b.id, a.id, gain, ref);
        fact(
          "befriended",
          a.id,
          b.id,
          "public",
          `${a.name} shared a quiet moment with ${b.name}.`,
        );
        break;
      }
      case "PROTECT":
        change(a.id, "gold", -e.costGold, `${ref}/costGold`);
        change(b.id, "hunger", e.hunger, `${ref}/hunger`);
        trust(b.id, a.id, e.trust, `${ref}/trust`);
        add(`debt/${b.id}>${a.id}`, e.debt, `${ref}/debt`, r.ranges.debt);
        set(`characters/${b.id}/warned`, true, `${ref}/warningDc`);
        helped.add(b.id);
        fact(
          "protected",
          a.id,
          b.id,
          "witnessed",
          `${a.name} brought bread to ${b.name}.`,
        );
        break;
      case "CONFIDE":
        trust(a.id, b.id, e.trust, `${ref}/trust`);
        trust(b.id, a.id, e.trust, `${ref}/trust`);
        if (!b.knowledge.includes(item.args.factId))
          set(
            `characters/${b.id}/knowledge`,
            [...b.knowledge, item.args.factId],
            "intents/CONFIDE",
          );
        fact(
          "confided",
          a.id,
          b.id,
          "secret",
          `${a.name} confided in ${b.name}.`,
        );
        break;
      case "WATCH": {
        const success =
          a.stats.guile * r.contests.guileMultiplier +
            die(a.id, `WATCH:${b.id}`) >
          r.contests.baseDc + b.stats.guile * r.contests.guileMultiplier;
        const known = state.facts.find(
          (f) =>
            b.knowledge.includes(f.id) &&
            f.visibility !== "secret" &&
            !a.knowledge.includes(f.id),
        );
        if (success && known)
          set(
            `characters/${a.id}/knowledge`,
            [...a.knowledge, known.id],
            "intents/WATCH",
          );
        if (!success) trust(b.id, a.id, e.noticedTrust, `${ref}/noticedTrust`);
        break;
      }
      case "REPORT": {
        const success =
          die(a.id, `REPORT:${b.id}`) + r.contests.vigilBonus >
          r.contests.baseDc + b.stats.guile * r.contests.guileMultiplier;
        if (success) stopped.add(b.id);
        set(
          "investigations",
          [
            ...state.investigations,
            {
              actor: a.id,
              target: b.id,
              day: state.day,
              substantiated: success,
            },
          ],
          "intents/REPORT",
        );
        if (a.role === "main" && b.role === "main")
          set("bond", "fractured", "rules/arcs/bondFractureTrust");
        break;
      }
      case "SCHEME": {
        set(
          `characters/${a.id}/lastScheme`,
          { day: state.day, target: b.id },
          "intents/SCHEME",
        );
        const kind = item.args.kind;
        let dc =
          r.contests.baseDc +
          b.stats.guile * r.contests.guileMultiplier +
          r.contests.patrol;
        if (kind === "persuade")
          dc =
            r.contests.baseDc +
            Math.floor(b.loyalty / r.contests.loyaltyDivisor);
        if (kind === "rumour")
          dc =
            r.contests.rumourBaseDc +
            Math.floor(b.renown / r.contests.renownDivisor);
        if (b.warned) dc += r.effects.PROTECT.warningDc;
        const score =
          a.stats.guile * r.contests.guileMultiplier +
          die(a.id, `SCHEME:${kind}:${b.id}`);
        const success = !stopped.has(a.id) && score > dc;
        rolls.at(-1)!.score = score;
        rolls.at(-1)!.dc = dc;
        rolls.at(-1)!.success = success;
        if (success) {
          if (kind === "poison")
            set(`characters/${b.id}/sick`, true, `rules/schemes/${kind}`);
          if (kind === "steal")
            add(
              `stores/${b.tent}`,
              r.schemes.steal.stores,
              `rules/schemes/${kind}/stores`,
              r.ranges.stores,
            );
          if (kind === "persuade")
            change(
              b.id,
              "loyalty",
              r.schemes.persuade.loyalty,
              `rules/schemes/${kind}/loyalty`,
            );
          if (kind === "rumour") {
            change(
              b.id,
              "renown",
              r.schemes.rumour.renown,
              `rules/schemes/${kind}/renown`,
            );
            const reactions: Record<
              string,
              { values: string[]; trust: number }
            > = r.schemes.rumour.reactions;
            const reaction = reactions[item.args.topic];
            for (const listener of Object.values(state.characters))
              if (
                listener.id !== b.id &&
                ([a.tent, b.tent].includes(listener.tent) ||
                  (b.role === "main" && listener.role === "main")) &&
                state.trust[`${listener.id}>${b.id}`] <
                  r.schemes.rumour.disbeliefTrust &&
                listener.values.some((v) => reaction.values.includes(v))
              ) {
                trust(
                  listener.id,
                  b.id,
                  reaction.trust,
                  `rules/schemes/rumour/reactions/${item.args.topic}/trust`,
                );
              }
            fact(
              "rumour",
              a.id,
              b.id,
              "public",
              `A rumour questions ${b.name}'s conduct.`,
              false,
            );
          }
        } else if (
          die(a.id, `CAUGHT:${kind}:${b.id}`) + r.contests.vigilBonus >
          a.stats.guile * r.contests.guileMultiplier + r.contests.baseDc
        ) {
          set(`characters/${a.id}/stocks`, true, "rules/effects/caught");
          change(
            a.id,
            "renown",
            r.effects.caught.renown,
            "rules/effects/caught/renown",
          );
          trust(
            b.id,
            a.id,
            r.effects.caught.trust,
            "rules/effects/caught/trust",
          );
          fact(
            "caught",
            a.id,
            b.id,
            "public",
            `The Vigil stopped ${a.name} meddling with ${b.name}.`,
          );
        }
        break;
      }
      case "RECRUIT": {
        const success =
          a.stats.guile * r.contests.guileMultiplier +
            Math.floor(a.renown / r.contests.renownDivisor) +
            die(a.id, `RECRUIT:${b.id}`) >
          r.contests.baseDc + b.loyalty;
        if (success) {
          change(b.id, "loyalty", e.loyalty, `${ref}/loyalty`);
          trust(b.id, a.id, e.trust, `${ref}/trust`);
          if (b.tent === "strays" && !state.fifth.includes(b.id))
            set("fifth", [...state.fifth, b.id], "intents/RECRUIT");
          fact(
            "recruited",
            a.id,
            b.id,
            "witnessed",
            `${b.name} listened to ${a.name}'s invitation.`,
          );
        }
        break;
      }
      case "DEFECT":
        set(`characters/${a.id}/tent`, item.args.toTent, "intents/DEFECT");
        set(`characters/${a.id}/loyalty`, e.newLoyalty, `${ref}/newLoyalty`);
        fact(
          "joined",
          a.id,
          a.id,
          "public",
          `${a.name} now sleeps in the ${item.args.toTent} tent.`,
        );
        break;
      case "PLOT":
        add("bondProgress", e.progress, `${ref}/progress`);
        set("bond", "plotting", "intents/PLOT");
        break;
      case "OFFER":
        fact(
          "offered",
          a.id,
          b.id,
          "secret",
          `${a.name} offered ${b.name} a favour.`,
        );
        break;
    }
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
    if (before.characters[c.id].stocks)
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
      .map((f) => ({
        factId: f.id,
        text:
          f.visibility === "secret"
            ? `Journal: ${f.text}`
            : f.visibility === "witnessed"
              ? `Someone saw: ${f.text}`
              : f.text,
      })),
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
