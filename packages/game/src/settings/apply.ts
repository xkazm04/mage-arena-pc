import { quality } from "../quality.ts";
import type { CanvasUI } from "../ui/ui.ts";
import {
  onSettings,
  qualityProfile,
  settings,
  updateSettings,
  type WindowMode,
} from "./settings.ts";

/** Enters or leaves browser fullscreen. False when the browser refuses (it needs a user gesture). */
export async function applyWindowMode(mode: WindowMode): Promise<boolean> {
  try {
    const full = !!document.fullscreenElement;
    if (mode === "fullscreen" && !full)
      await document.documentElement.requestFullscreen();
    else if (mode === "windowed" && full) await document.exitFullscreen();
    return true;
  } catch {
    return false;
  }
}

/**
 * Reloads once with `?quality=<profile>` when the chosen tier maps to another quality.json profile than the running
 * one (quality.ts reads the profile at load). With a single `desktop` profile this never fires.
 */
export function ensureQualityProfile(
  location: Location = globalThis.location,
): boolean {
  const want = qualityProfile(settings().quality);
  const url = new URL(location.href);
  if (want === quality.name || url.searchParams.has("quality")) return false;
  url.searchParams.set("quality", want);
  location.replace(url.toString());
  return true;
}

/** Wires settings to the running UI: scale follows the setting; fullscreen follows the browser and is restored on the first gesture. */
export function installSettings(ui: CanvasUI) {
  ui.setUiScale(settings().uiScale);
  onSettings((s) => ui.setUiScale(s.uiScale));
  document.addEventListener("fullscreenchange", () => {
    const mode = document.fullscreenElement ? "fullscreen" : "windowed";
    if (settings().windowMode !== mode) updateSettings({ windowMode: mode });
  });
  if (settings().windowMode === "fullscreen") {
    const restore = () => {
      window.removeEventListener("pointerdown", restore);
      window.removeEventListener("keydown", restore);
      if (settings().windowMode === "fullscreen")
        void applyWindowMode("fullscreen");
    };
    window.addEventListener("pointerdown", restore);
    window.addEventListener("keydown", restore);
  }
}
