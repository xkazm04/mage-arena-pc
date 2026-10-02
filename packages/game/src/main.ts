import "./style.css";
import { mountCamp } from "./camp-entry.ts";
import { mountArena } from "./arena-entry.ts";

const root = document.querySelector<HTMLElement>("#app")!;
let dispose: (() => void) | undefined;
async function route() {
  dispose?.();
  dispose = undefined;
  dispose = location.pathname === "/training" ? await mountArena(root) : await mountCamp(root);
}
void route().catch((error: unknown) => { console.error(error); root.textContent = String(error); });
window.addEventListener("pagehide", () => dispose?.());
