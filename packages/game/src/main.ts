import "./style.css";
import { GameShell } from "./game-shell.ts";
import { ensureQualityProfile, installSettings } from "./settings/apply.ts";
const game = new GameShell();
void (
  ensureQualityProfile()
    ? Promise.resolve()
    : game
        .init(document.querySelector<HTMLElement>("#app")!)
        .then(() => installSettings(game.ui))
).catch((error) => {
  console.error(error);
  document.querySelector("#app")!.textContent =
    `The gate could not open: ${String(error)}`;
});
window.addEventListener("pagehide", () => game.dispose());
