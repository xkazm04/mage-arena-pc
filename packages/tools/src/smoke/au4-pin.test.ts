import { describe, expect, it } from "vitest";
import {
  measureAudio,
  pinAudio,
  sortedEntries,
  type AudioShot,
} from "./au4-pin.ts";

const shot = (over: Partial<AudioShot> = {}): AudioShot => ({
  state: "running",
  settings: { master: 0.8 },
  scene: "camp:night",
  worldPaused: true,
  music: { id: "camp-night", offset: 1.5, duration: 20 },
  musicVoices: 0,
  decodedBuffers: { "ui-deny": { bytes: 1 }, "ui-click": { bytes: 2 } },
  streamedTracks: {},
  decodedAudioBytes: 3,
  active: [{ id: 1 }],
  processing: { highCutHz: 6500 },
  duckGains: { music: 0.4483 },
  logs: [
    { time: 1, event: "play", cue: "ui.click" },
    { time: 2, event: "play", cue: "ui.click" },
    { time: 3, event: "locked" },
  ],
  ...over,
});

describe("au4 pin", () => {
  it("sorts decoded cues whichever decoded first", () => {
    const a = shot({ decodedBuffers: { b: 1, a: 2 } });
    const b = shot({ decodedBuffers: { a: 2, b: 1 } });
    expect(JSON.stringify(pinAudio(a))).toBe(JSON.stringify(pinAudio(b)));
    expect(Object.keys(sortedEntries({ z: 1, a: 2 }))).toEqual(["a", "z"]);
  });
  it("keeps gains, offsets and log clocks out of the pin", () => {
    const a = pinAudio(shot());
    const b = pinAudio(
      shot({
        duckGains: { music: 0.448 },
        music: { id: "camp-night", offset: 9, duration: 20 },
        active: [],
        logs: [
          { time: 7, event: "locked" },
          { time: 9, event: "play", cue: "ui.click" },
        ],
      }),
    );
    expect(a).toEqual(b);
    expect(a.logKinds).toEqual(["locked", "play ui.click"]);
  });
  it("still pins a changed cue set and measures the gains", () => {
    expect(pinAudio(shot({ decodedBuffers: { x: 1 } }))).not.toEqual(
      pinAudio(shot()),
    );
    expect(measureAudio(shot()).duckGains).toEqual({ music: 0.4483 });
  });
});
