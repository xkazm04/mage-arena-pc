import { describe, expect, it } from "vitest";
import { labKey, labModeOf, startReplay, stopReplay, type LabModeState } from "./lab-mode.ts";

const live: LabModeState = { mode: "live", replayWasPaused: false };
const host = (paused: boolean, ring: number) => ({ paused, ringLength: () => ring });

describe("Lab mode machine", () => {
  it("refuses a replay of a ring too short to play, staying live", () => {
    const r = labKey(live, "KeyV", false, host(false, 1));
    expect(r).toEqual({ kind: "notice", text: "Play a few moments before replaying." });
  });
  it("enters and leaves replay, restoring the host's pause flag", () => {
    const paused = { ...live };
    const into = labKey(paused, "KeyV", false, host(true, 2));
    expect(into).toMatchObject({ kind: "action", action: "replay-start", pause: true, next: { mode: "replay", replayWasPaused: true } });
    if (into.kind !== "action") throw Error("expected an action");
    const out = labKey(into.next, "KeyV", false, host(true, 2));
    expect(out).toMatchObject({ kind: "action", action: "replay-stop", pause: true, next: { mode: "live" } });
    const running = labKey(live, "KeyV", false, host(false, 40));
    if (running.kind !== "action") throw Error("expected an action");
    expect(stopReplay(running.next)).toEqual({ next: { mode: "live", replayWasPaused: false }, pause: false });
  });
  it("leaves every hotkey alone while a number or import is being typed, and on key repeat", () => {
    for (const mode of ["number", "import"] as const)
      for (const code of ["KeyR", "KeyP", "KeyV", "KeyT", "KeyL", "Period", "KeyG", "KeyH", "KeyB"])
        expect(labKey({ mode, replayWasPaused: false }, code, false, host(false, 40))).toEqual({ kind: "unhandled" });
    expect(labKey(live, "KeyR", true, host(false, 40))).toEqual({ kind: "unhandled" });
  });
  it("routes freeze and step to the replay while it plays, and swallows refill and damage there", () => {
    const replay: LabModeState = { mode: "replay", replayWasPaused: false }, h = host(false, 40);
    expect(labKey(replay, "KeyP", false, h)).toMatchObject({ action: "replay-pause-toggle" });
    expect(labKey(replay, "Period", false, h)).toMatchObject({ action: "replay-step" });
    expect(labKey(replay, "KeyG", false, h)).toEqual({ kind: "swallowed" });
    expect(labKey(replay, "KeyH", false, h)).toEqual({ kind: "swallowed" });
    expect(labKey(live, "KeyP", false, h)).toMatchObject({ action: "pause-toggle" });
    expect(labKey(live, "Period", false, h)).toMatchObject({ action: "live-step" });
    expect(labKey(live, "KeyG", false, h)).toMatchObject({ action: "refill" });
    expect(labKey(live, "KeyH", false, h)).toMatchObject({ action: "damage" });
  });
  it("keeps today's hotkey table: B only on the setup page, Comma and other keys unhandled", () => {
    const h = host(false, 40);
    expect(labKey(live, "KeyR", false, h)).toMatchObject({ action: "reset" });
    expect(labKey(live, "KeyT", false, h)).toMatchObject({ action: "tuning" });
    expect(labKey(live, "KeyL", false, h)).toMatchObject({ action: "setup" });
    expect(labKey({ mode: "setup", replayWasPaused: false }, "KeyB", false, h)).toMatchObject({ action: "builds" });
    expect(labKey(live, "KeyB", false, h)).toEqual({ kind: "unhandled" });
    expect(labKey({ mode: "builds", replayWasPaused: false }, "KeyB", false, h)).toEqual({ kind: "unhandled" });
    expect(labKey(live, "Comma", false, h)).toEqual({ kind: "unhandled" });
    expect(labKey(live, "KeyX", false, h)).toEqual({ kind: "unhandled" });
  });
  it("names the mode of each Lab screen and starts a replay from any of them", () => {
    expect(["lab-setup", "lab-builds", "lab-tuning", "lab-number", "lab-import", "arena"].map(labModeOf)).toEqual(["setup", "builds", "tuning", "number", "import", "live"]);
    expect(startReplay(host(true, 9))).toMatchObject({ next: { mode: "replay", replayWasPaused: true }, pause: true });
  });
});
