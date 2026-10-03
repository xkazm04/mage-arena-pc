import data from "../data/audio.json" with { type: "json" };
export const audioData = data;
export type Cue = keyof typeof data.cues;
export type Bus = "music" | "effects" | "ui" | "voice";
export type OneShotBus = Exclude<Bus, "music">;
export interface ActiveSound {
  id: number;
  cue: Cue;
  bus: OneShotBus;
  priority: number;
  started: number;
}
export interface AudioAsset {
  file: string;
  sha256: string;
  duration: number;
  trimDb: number;
  kind: "loop" | "track" | "one-shot";
}
export interface AudioManifest {
  version: 1;
  assets: Record<string, AudioAsset>;
}
export interface AudioSettings {
  master: number;
  music: number;
  effects: number;
  ui: number;
  voice: number;
  muted: boolean;
}
export const dbGain = (db: number) => 10 ** (db / 20);
export function settingsFrom(value: unknown): AudioSettings {
  const result: AudioSettings = { ...data.defaults };
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    for (const key of ["master", "music", "effects", "ui", "voice"] as const)
      if (typeof v[key] === "number" && Number.isFinite(v[key]))
        result[key] = Math.max(0, Math.min(1, v[key]));
    if (typeof v.muted === "boolean") result.muted = v.muted;
  }
  return result;
}
export function validateAudioManifest(value: unknown): AudioManifest {
  const m = value as AudioManifest;
  if (
    m?.version !== 1 ||
    !m.assets ||
    typeof m.assets !== "object" ||
    Array.isArray(m.assets)
  )
    throw Error("Unsupported audio manifest");
  for (const [id, a] of Object.entries(m.assets)) {
    if (
      !/^[a-z0-9-]+$/.test(id) ||
      !a ||
      !/^[a-z0-9-]+\.(mp3|wav|ogg)$/.test(a.file) ||
      !/^[a-f0-9]{64}$/.test(a.sha256) ||
      !Number.isFinite(a.duration) ||
      a.duration <= 0 ||
      a.duration > data.limits.maxDurationSeconds ||
      !Number.isFinite(a.trimDb) ||
      a.trimDb > 0 ||
      a.trimDb < -40 ||
      !["loop", "track", "one-shot"].includes(a.kind)
    )
      throw Error(`Invalid audio asset: ${id}`);
  }
  return m;
}
export function audioDataProblems(manifest: AudioManifest): string[] {
  const errors: string[] = [];
  for (const [id, c] of Object.entries(data.cues)) {
    if (
      !["effects", "ui", "voice"].includes(c.bus) ||
      !Number.isInteger(c.priority) ||
      c.priority < 0 ||
      c.priority > 3 ||
      !Number.isInteger(c.concurrency) ||
      c.concurrency < 1 ||
      c.cooldownMs < 0
    )
      errors.push(`policy:${id}`);
    if (
      c.gainDb > 0 ||
      c.volumeVariationDb < 0 ||
      c.volumeVariationDb > 3 ||
      c.pitch.length !== 2 ||
      c.pitch[0]! < 0.8 ||
      c.pitch[1]! > 1.2 ||
      c.pitch[0]! > c.pitch[1]!
    )
      errors.push(`trim:${id}`);
    if (!c.assets.length || c.assets.some((a) => !manifest.assets[a]))
      errors.push(`assets:${id}`);
  }
  for (const playlist of [
    ...Object.values(data.music.arena),
    ...Object.values(data.music.camp),
  ])
    if (
      !playlist.length ||
      playlist.some(
        (id) =>
          !manifest.assets[id] || manifest.assets[id]!.kind === "one-shot",
      )
    )
      errors.push("playlist");
  return errors;
}
/** Cooldown and class limits drop; a bus/global limit may steal lower-priority work. */
export function admit(
  cue: Cue,
  now: number,
  active: ActiveSound[],
  last?: number,
): { allowed: boolean; reason: string; steal: number[] } {
  const c = data.cues[cue],
    bus = c.bus as OneShotBus;
  if (last !== undefined && now - last < c.cooldownMs / 1000)
    return { allowed: false, reason: "cooldown", steal: [] };
  if (active.filter((a) => a.cue === cue).length >= c.concurrency)
    return { allowed: false, reason: "concurrency", steal: [] };
  const survivors = [...active],
    steal: number[] = [];
  for (const scope of [bus, "all"]) {
    const members = () =>
      survivors.filter((a) => scope === "all" || a.bus === scope);
    const limit =
      scope === "all" ? data.limits.oneShots : data.limits.buses[bus];
    while (members().length >= limit) {
      const victim = members()
        .filter((a) => a.priority > c.priority)
        .sort(
          (a, b) =>
            b.priority - a.priority || a.started - b.started || a.id - b.id,
        )[0];
      if (!victim) return { allowed: false, reason: "priority", steal: [] };
      steal.push(victim.id);
      survivors.splice(survivors.indexOf(victim), 1);
    }
  }
  return { allowed: true, reason: "play", steal };
}
export function variation(cue: Cue, random: () => number = Math.random) {
  const c = data.cues[cue];
  return {
    asset:
      c.assets[
        Math.min(c.assets.length - 1, Math.floor(random() * c.assets.length))
      ]!,
    pitch: c.pitch[0]! + (c.pitch[1]! - c.pitch[0]!) * random(),
    gain: dbGain(c.gainDb + (random() * 2 - 1) * c.volumeVariationDb),
  };
}
export function playlistFor(scene: string): string[] {
  const [kind, value] = scene.split(":");
  if (kind === "arena")
    return (
      data.music.arena[value as keyof typeof data.music.arena] ??
      data.music.arena[1]
    );
  if (kind === "camp")
    return data.music.camp[value as keyof typeof data.music.camp] ?? [];
  return [];
}
export const nextTrackDelay = (duration: number, offset = 0) =>
  Math.max(
    0.1,
    duration - offset - Math.min(data.music.crossfadeSeconds, duration / 2),
  );
