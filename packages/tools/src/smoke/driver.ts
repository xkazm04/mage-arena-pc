// The canvas-UI verbs the browser suites drive through `window.__ui`, typed by the game's harness
// contract. One click semantics for every suite: wait until the UI is idle and the button enabled,
// click its centre, wait until idle again, then (optionally) for the next screen.
import type { Page } from "playwright";
import type { HarnessWindow, UiSnapshot } from "../../../game/src/harness-contract.ts";

/** The page's `__ui.snapshot()`. */
export const ui = (p: Page): Promise<UiSnapshot> =>
  p.evaluate(() => (window as unknown as HarnessWindow).__ui.snapshot());

/** Waits for screen `id` with the UI idle. */
export async function screen(p: Page, id: string, timeout = 20000): Promise<void> {
  await p.waitForFunction(
    (id) => {
      const s = (window as unknown as HarnessWindow).__ui?.snapshot();
      return s?.screen === id && !s.busy;
    },
    id,
    { timeout },
  );
}

/** Waits for the UI to be idle with enabled button `id`, clicks its centre, waits idle, then for `next`. */
export async function click(p: Page, id: string, next?: string): Promise<void> {
  await p.waitForFunction(
    (id) => {
      const s = (window as unknown as HarnessWindow).__ui?.snapshot();
      return s && !s.busy && s.buttons.some((b) => b.id === id && !b.disabled);
    },
    id,
    { timeout: 15000 },
  );
  const b = (await ui(p)).buttons.find((b) => b.id === id)!;
  await p.mouse.click(b.x + b.w / 2, b.y + b.h / 2);
  await p.waitForFunction(() => !(window as unknown as HarnessWindow).__ui.snapshot().busy);
  if (next) await screen(p, next);
}

/** Waits until no art is pending. */
export async function artSettled(p: Page): Promise<void> {
  await p.waitForFunction(() => (window as unknown as HarnessWindow).__ui.snapshot().art.pending === 0);
}

/** Waits for any idle screen with controls (after a load or reload). */
export async function uiReady(p: Page, timeout = 20000): Promise<void> {
  await p.waitForFunction(
    () => {
      const s = (window as unknown as HarnessWindow).__ui?.snapshot();
      return !!s && !s.busy && s.buttons.length > 0;
    },
    undefined,
    { timeout },
  );
}
