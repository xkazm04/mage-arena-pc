/** What the AU4 smoke pins of an audio snapshot: the cue set and its settings, never a measured gain, a crossfade voice count or a log clock or order. */
type Dict<T> = Record<string, T>;
export type AudioShot = {
  state: string;
  settings: unknown;
  scene: string;
  worldPaused: boolean;
  music: { id: string; offset: number; duration: number } | null;
  musicVoices: number;
  decodedBuffers: Dict<unknown>;
  streamedTracks: Dict<unknown>;
  decodedAudioBytes: number;
  active: unknown[];
  processing: unknown;
  duckGains: Dict<number>;
  logs: { time: number; event: string; cue?: string; detail?: unknown }[];
};
/** Object entries in key order, so a resident set is pinned the same whichever cue decoded first. */
export const sortedEntries = <T>(o: Dict<T>): Dict<T> =>
  Object.fromEntries(
    Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
/** Each distinct `event cue` pair once, sorted: the log's coverage without its clock or count. */
export const logKinds = (logs: AudioShot["logs"]) =>
  [
    ...new Set(logs.map((l) => (l.cue ? `${l.event} ${l.cue}` : l.event))),
  ].sort();
export function pinAudio(a: AudioShot) {
  return {
    state: a.state,
    settings: a.settings,
    scene: a.scene,
    worldPaused: a.worldPaused,
    decodedBuffers: sortedEntries(a.decodedBuffers),
    streamedTracks: sortedEntries(a.streamedTracks),
    decodedAudioBytes: a.decodedAudioBytes,
    processing: a.processing,
  };
}
/** Measured values go to the unpinned section: gains, music state and voices, active voices, event kinds and the full log. */
export function measureAudio(a: AudioShot) {
  return {
    music: a.music,
    musicVoices: a.musicVoices,
    logKinds: logKinds(a.logs),
    duckGains: a.duckGains,
    active: a.active,
    logs: a.logs,
  };
}
