/**
 * The Combat Feel Lab's mode machine, without the canvas: which mode the Lab is in, what each hotkey means
 * there, and the pause flag a replay borrows from the host and gives back. lab-ui.ts draws and carries out.
 */
export type LabMode = "live" | "replay" | "setup" | "builds" | "tuning" | "number" | "import";
export interface LabModeState {
  mode: LabMode;
  /** The host's pause flag when the replay began; restored when it ends. */
  replayWasPaused: boolean;
}
export type LabAction =
  | "reset"
  | "pause-toggle"
  | "live-step"
  | "replay-pause-toggle"
  | "replay-step"
  | "refill"
  | "damage"
  | "tuning"
  | "setup"
  | "builds"
  | "replay-start"
  | "replay-stop";
export interface LabHost {
  paused: boolean;
  /** Frames in the replay ring; read only when a replay is asked for. */
  ringLength: () => number;
}
export type LabKeyResult =
  /** The key is not the Lab's: the caller lets it through. */
  | { kind: "unhandled" }
  /** The key is the Lab's but does nothing in this mode. */
  | { kind: "swallowed" }
  | { kind: "notice"; text: string }
  /** `pause`, when present, is the host pause flag to set. */
  | { kind: "action"; action: LabAction; next: LabModeState; pause?: boolean };

export const replayTooShort = "Play a few moments before replaying.";
/** Text entry owns the keyboard: no Lab hotkey fires while a number or a tuning import is being typed. */
const typing = new Set<LabMode>(["number", "import"]);
const screens: Record<string, LabMode> = {
  "lab-setup": "setup",
  "lab-builds": "builds",
  "lab-tuning": "tuning",
  "lab-number": "number",
  "lab-import": "import",
};
/** The mode a Lab page puts the Lab in; any other screen (the arena HUD) is live play. */
export const labModeOf = (screen: string): LabMode => screens[screen] ?? "live";

export function startReplay(host: LabHost): LabKeyResult {
  if (host.ringLength() < 2) return { kind: "notice", text: replayTooShort };
  return {
    kind: "action",
    action: "replay-start",
    next: { mode: "replay", replayWasPaused: host.paused },
    pause: true,
  };
}
export function stopReplay(s: LabModeState): { next: LabModeState; pause: boolean } {
  return { next: { mode: "live", replayWasPaused: false }, pause: s.replayWasPaused };
}

export function labKey(s: LabModeState, code: string, repeat: boolean, host: LabHost): LabKeyResult {
  if (typing.has(s.mode) || repeat) return { kind: "unhandled" };
  const replay = s.mode === "replay",
    act = (action: LabAction): LabKeyResult => ({ kind: "action", action, next: s });
  switch (code) {
    case "KeyR":
      return act("reset");
    case "KeyP":
      return act(replay ? "replay-pause-toggle" : "pause-toggle");
    case "Period":
      return act(replay ? "replay-step" : "live-step");
    case "KeyG":
      return replay ? { kind: "swallowed" } : act("refill");
    case "KeyH":
      return replay ? { kind: "swallowed" } : act("damage");
    case "KeyT":
      return act("tuning");
    case "KeyL":
      return act("setup");
    case "KeyB":
      return s.mode === "setup" ? act("builds") : { kind: "unhandled" };
    case "KeyV": {
      if (!replay) return startReplay(host);
      const out = stopReplay(s);
      return { kind: "action", action: "replay-stop", ...out };
    }
    default:
      return { kind: "unhandled" };
  }
}
