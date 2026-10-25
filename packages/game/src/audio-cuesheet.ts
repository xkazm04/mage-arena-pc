import forecast from "../data/forecast.json" with { type: "json" };
import {
  attachMageAI,
  combat,
  createLab,
  defaultLabConfig,
  mageInput,
  makeTuning,
  seconds,
  stepLab,
  type School,
} from "@mage/core/arena";
import {
  admit,
  audioData,
  variation,
  type ActiveSound,
  type AudioManifest,
  type Cue,
  type OneShotBus,
} from "./audio-policy.ts";
import { routeEvent, uncuedKinds, type Routes } from "./audio-routing.ts";

/**
 * The owner listening pass's script (D2 4.5): every cue a bout asks for, run through the live
 * admission policy (admit()) on a simulated clock, with the reason each silent one went silent.
 * GameAudio.play makes the same decisions against WebAudio; this sheet never plays a sound.
 */
export interface SheetRequest {
  /** Seconds on the bout clock. */
  t: number;
  cue: string;
  /** What asked for it, e.g. `release enemy`. */
  source?: string;
  pan?: number;
  gain?: number;
}
export type Outcome =
  "play" | "cooldown" | "concurrency" | "priority" | "unknown-cue";
export interface SheetRow extends SheetRequest {
  /** 1-based request order; also the voice id admit() sees. */
  id: number;
  outcome: Outcome;
  bus?: OneShotBus;
  /** Played rows: the variation picked and when the voice would end unstolen. */
  asset?: string;
  pitch?: number;
  ends?: number;
  stolenBy?: string;
  stolenAt?: number;
}
export interface CueTally {
  requested: number;
  played: number;
  cooldown: number;
  concurrency: number;
  priority: number;
  stolen: number;
}
export interface CueSheet {
  rows: SheetRow[];
  summary: {
    requested: number;
    played: number;
    cues: Record<string, CueTally>;
    /** Most voices sounding at once on each bus. */
    peakBus: Record<OneShotBus, number>;
    /** Sim event kinds no route plays, with how often the bout raised them. */
    silentKinds: Record<string, number>;
  };
}

/** Fixed-seed variation draws (mulberry32), so one seed is one sheet. */
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Requests in time order -> one row each, as GameAudio.play would admit them (variation drawn first). */
export function cueSheet(
  requests: SheetRequest[],
  manifest: AudioManifest,
  options: {
    random?: () => number;
    events?: { kind: string }[];
    routes?: Routes;
  } = {},
): CueSheet {
  const random = options.random ?? seededRandom(1),
    rows: SheetRow[] = [],
    voices = new Map<number, ActiveSound & { ends: number }>(),
    last = new Map<string, number>(),
    cues: Record<string, CueTally> = {},
    peakBus: Record<OneShotBus, number> = { effects: 0, ui: 0, voice: 0 };
  for (const [i, request] of requests.entries()) {
    const id = i + 1,
      now = request.t,
      tally = (cues[request.cue] ??= {
        requested: 0,
        played: 0,
        cooldown: 0,
        concurrency: 0,
        priority: 0,
        stolen: 0,
      });
    tally.requested++;
    for (const [vid, v] of voices) if (v.ends <= now) voices.delete(vid);
    if (!(request.cue in audioData.cues)) {
      rows.push({ ...request, id, outcome: "unknown-cue" });
      continue;
    }
    const cue = request.cue as Cue,
      c = audioData.cues[cue],
      bus = c.bus as OneShotBus,
      v = variation(cue, random),
      policy = admit(cue, now, [...voices.values()], last.get(cue));
    if (!policy.allowed) {
      const reason = policy.reason as "cooldown" | "concurrency" | "priority";
      tally[reason]++;
      rows.push({ ...request, id, bus, outcome: reason });
      continue;
    }
    for (const victim of policy.steal) {
      const row = rows[victim - 1]!;
      row.stolenBy = cue;
      row.stolenAt = now;
      cues[row.cue]!.stolen++;
      voices.delete(victim);
    }
    const ends = now + manifest.assets[v.asset]!.duration / v.pitch;
    voices.set(id, { id, cue, bus, priority: c.priority, started: now, ends });
    last.set(cue, now);
    tally.played++;
    peakBus[bus] = Math.max(
      peakBus[bus],
      [...voices.values()].filter((s) => s.bus === bus).length,
    );
    rows.push({
      ...request,
      id,
      bus,
      outcome: "play",
      asset: v.asset,
      pitch: v.pitch,
      ends,
    });
  }
  const silent = new Set(
      uncuedKinds(
        [...new Set((options.events ?? []).map((e) => e.kind))],
        options.routes,
      ),
    ),
    silentKinds: Record<string, number> = {};
  for (const e of options.events ?? [])
    if (silent.has(e.kind))
      silentKinds[e.kind] = (silentKinds[e.kind] ?? 0) + 1;
  return {
    rows,
    summary: {
      requested: rows.length,
      played: rows.filter((r) => r.outcome === "play").length,
      cues,
      peakBus,
      silentKinds,
    },
  };
}

export interface BoutCueSheet {
  bout: {
    seed: number;
    playerSchool: School;
    opponentSchool: School;
    outcome: "win" | "loss" | "timeout";
    durationS: number;
    events: number;
  };
  sheet: CueSheet;
}

/**
 * The scripted bout: the Lab reference duel (data/forecast.json competence and cap, reference
 * mage AI on both sides), each new sim event routed through audio.json routes for the player.
 */
export function boutCueSheet(
  seed: number,
  manifest: AudioManifest,
  schools: { player?: School; opponent?: School } = {},
): BoutCueSheet {
  const lab = createLab(
      {
        ...defaultLabConfig,
        opponent: "mage",
        seed,
        playerSchool: schools.player ?? defaultLabConfig.playerSchool,
        opponentSchool: schools.opponent ?? defaultLabConfig.opponentSchool,
      },
      makeTuning(),
    ),
    { state, player, dummy } = lab.training,
    cap = forecast.duelCapS * combat.simStepHz,
    requests: SheetRequest[] = [];
  attachMageAI(player, forecast.duelPlayerCompetence);
  while (
    state.tick < cap &&
    !player.tags.includes("DEFEATED") &&
    !dummy.tags.includes("DEFEATED")
  ) {
    const first = state.events.length;
    stepLab(lab, mageInput(state, player), false);
    for (const e of state.events.slice(first)) {
      const actor = state.actors.find((a) => a.id === e.actorId);
      if (!actor) continue;
      const who =
        actor.id === player.id ? "player" : actor.enemy ? "enemy" : "rival";
      for (const r of routeEvent(e, { listener: player, actor }))
        requests.push({ t: seconds(e.tick), source: `${e.kind} ${who}`, ...r });
    }
  }
  const won = dummy.tags.includes("DEFEATED"),
    lost = player.tags.includes("DEFEATED");
  return {
    bout: {
      seed,
      playerSchool: player.school!,
      opponentSchool: dummy.school!,
      outcome: won ? "win" : lost ? "loss" : "timeout",
      durationS: seconds(state.tick),
      events: state.events.length,
    },
    sheet: cueSheet(requests, manifest, {
      random: seededRandom(seed),
      events: state.events,
    }),
  };
}

const num = (n: number | undefined, digits: number, signed = false) =>
  n === undefined ? "-" : `${signed && n >= 0 ? "+" : ""}${n.toFixed(digits)}`;

/** The sheet as fixed-width text for reading beside the bout: rows, then per-cue and per-bus totals. */
export function formatCueSheet({ bout, sheet }: BoutCueSheet): string {
  const out = [
    `Cue sheet - seed ${bout.seed}, ${bout.playerSchool} vs ${bout.opponentSchool}, ${bout.outcome} at ${num(bout.durationS, 2)} s, ${bout.events} sim events`,
    `${audioData.label}; limits effects ${audioData.limits.buses.effects} / ui ${audioData.limits.buses.ui} / voice ${audioData.limits.buses.voice} / all ${audioData.limits.oneShots}`,
    "",
    "      t  #     source            cue          pan   gain  outcome",
  ];
  for (const r of sheet.rows) {
    const detail =
      r.outcome === "play"
        ? `play ${r.asset} x${num(r.pitch, 3)} to ${num(r.ends, 2)}${r.stolenBy ? `, stolen by ${r.stolenBy} at ${num(r.stolenAt, 2)}` : ""}`
        : `dropped: ${r.outcome}`;
    out.push(
      [
        num(r.t, 2).padStart(7),
        String(r.id).padStart(5),
        (r.source ?? "-").padEnd(17),
        r.cue.padEnd(12),
        num(r.pan, 2, true).padStart(5),
        num(r.gain, 2).padStart(6),
        "",
        detail,
      ].join(" "),
    );
  }
  out.push(
    "",
    "cue          requested  played  cooldown  concurrency  priority  stolen",
  );
  for (const [cue, t] of Object.entries(sheet.summary.cues).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  ))
    out.push(
      [
        cue.padEnd(12),
        String(t.requested).padStart(9),
        String(t.played).padStart(7),
        String(t.cooldown).padStart(9),
        String(t.concurrency).padStart(12),
        String(t.priority).padStart(9),
        String(t.stolen).padStart(7),
      ].join(" "),
    );
  const peak = sheet.summary.peakBus,
    silent = Object.entries(sheet.summary.silentKinds);
  out.push(
    "",
    `played ${sheet.summary.played} of ${sheet.summary.requested}; peak voices effects ${peak.effects} / ui ${peak.ui} / voice ${peak.voice}`,
    `silent event kinds (no route): ${silent.length ? silent.map(([k, n]) => `${k} x${n}`).join(", ") : "none"}`,
  );
  return out.join("\n") + "\n";
}
