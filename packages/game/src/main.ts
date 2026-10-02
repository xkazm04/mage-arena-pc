import "./style.css";
import { GameShell } from "./game-shell.ts";
const game = new GameShell();
void game.init(document.querySelector<HTMLElement>("#app")!).catch((error) => {
  console.error(error);
  document.querySelector("#app")!.textContent =
    `The gate could not open: ${String(error)}`;
});
window.addEventListener("pagehide", () => game.dispose());
