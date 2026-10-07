import { chromium, type Page } from "playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { CanvasUI } from "../../game/src/ui/ui.ts";
import type { ArenaGame } from "../../game/src/arena-entry.ts";
type Shape = "ring" | "cone" | "line" | "ward" | "cast" | "status";
type Element = "water" | "fire" | "earth" | "air";
type Win = Window & {
  __ui: {
    snapshot(): ReturnType<CanvasUI["snapshot"]>;
    performance(): { frames: number[]; cpu: number[] };
    resetPerformance(): void;
  };
  __arena: {
    snapshot(): ReturnType<ArenaGame["snapshot"]>;
    hitFixture(
      kind: "player" | "opponent" | "defeat-player" | "defeat-opponent",
      entity?: string,
      direction?: "ne" | "se" | "sw" | "nw",
      damage?: number,
    ): void;
    reset(): void;
    sigilFixture(k: Shape, e: Element, p: number, a: number, u: boolean): void;
    artFixture(k?: "stress"): void;
    setPalette(p: string): void;
    feedbackFixture(k: "perfect" | "cast"): void;
    stepInput(n: number): void;
  };
};
const out = resolve("docs/waves/U6b-evidence");
mkdirSync(join(out, "screens"), { recursive: true });
const server = spawn(
  process.execPath,
  [
    "--import",
    "tsx",
    "node_modules/vite/bin/vite.js",
    "preview",
    "--config",
    "packages/game/vite.config.ts",
    "--host",
    "127.0.0.1",
    "--port",
    "4199",
    "--strictPort",
  ],
  {
    windowsHide: true,
    stdio: "pipe",
    env: {
      ...process.env,
      CAMP_DIRECTOR: "offline",
      MAGE_SAVE_DIRECTORY: mkdtempSync(join(tmpdir(), "mage-u6b-")),
    },
  },
);
let serverLog = "";
server.stdout.on("data", (b) => (serverLog += String(b)));
server.stderr.on("data", (b) => (serverLog += String(b)));
const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=d3d11"],
});
const errors: string[] = [],
  screens: unknown[] = [],
  runs: unknown[] = [];
let current: Page | undefined;
const ui = (p: Page) =>
  p.evaluate(() => (window as unknown as Win).__ui.snapshot());
const arena = (p: Page) =>
  p.evaluate(() => (window as unknown as Win).__arena.snapshot());
async function click(p: Page, id: string) {
  const b = (await ui(p)).buttons.find((b) => b.id === id && !b.disabled);
  assert(b, id);
  await p.mouse.click(b.x + b.w / 2, b.y + b.h / 2);
  await p.waitForTimeout(200);
}
async function shot(p: Page, name: string, height: number) {
  await p.mouse.move(10, 10);
  await p.waitForFunction(
    () => (window as unknown as Win).__ui.snapshot().art.pending === 0,
  );
  await p.waitForTimeout(220);
  const s = await ui(p);
  assert.deepEqual(s.overflow, [], name);
  assert.deepEqual(s.art.diagnostics, []);
  assert.deepEqual(s.diagnostics, []);
  assert.equal(await p.locator("input,select,textarea,button").count(), 0);
  const file = `${height}-${name}.png`;
  await p.screenshot({ path: join(out, "screens", file) });
  screens.push({ file, screen: s.screen, texts: s.texts });
}

try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch("http://127.0.0.1:4199/api/health")).ok) break;
    } catch {
      /*starting*/
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  for (const height of [1080, 1440]) {
    const context = await browser.newContext({
        viewport: { width: (height * 16) / 9, height },
        deviceScaleFactor: 1,
      }),
      p = await context.newPage();
    current = p;
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await p.goto("http://127.0.0.1:4199/lab?harness=1");
    await p.waitForFunction(
      () => (window as unknown as Win).__ui?.snapshot().screen === "lab-setup",
    );
    await click(p, "lab-config-start");
    for (const entity of [
      "cassia",
      "brennic",
      "garran",
      "iskar",
      "conscript",
      "shieldman",
      "slinger",
      "netter",
    ]) {
      // Warm this entity's immutable atlas pages before measuring the short one-shot.
      await p.evaluate(
        (entity) =>
          (window as unknown as Win).__arena.hitFixture(
            "opponent",
            entity,
            "se",
            8,
          ),
        entity,
      );
      await p.waitForTimeout(700);
      await p.waitForFunction(
        () => (window as unknown as Win).__ui.snapshot().art.pending === 0,
      );
      for (const direction of ["ne", "se", "sw", "nw"] as const) {
        for (const damage of [8, 24]) {
          await p.evaluate(
            ({ entity, direction, damage }) =>
              (window as unknown as Win).__arena.hitFixture(
                "opponent",
                entity,
                direction,
                damage,
              ),
            { entity, direction, damage },
          );
          // Capture after the 65 ms flash, while the painted flinch still holds.
          await p.waitForTimeout(95);
          const a = await arena(p),
            pose = a.animation.displayed.find(
              (x) => x.id === a.state.actors[1]!.id,
            )!;
          assert.equal(
            pose.delivery,
            "A14",
            JSON.stringify({
              pose,
              animation: a.animation,
              art: (await ui(p)).art,
            }),
          );
          assert.equal(
            pose.selected,
            `${damage === 8 ? "hit-light" : "hit-heavy"}:${direction}`,
          );
          assert(
            Math.abs(Number(pose.fullFramePx) - (145.8 * height) / 1080) < 0.01,
          );
          if (direction === "se") {
            const file = `${height}-${entity}-${damage === 8 ? "hit-light" : "hit-heavy"}.png`;
            await p.screenshot({ path: join(out, "screens", file) });
            screens.push({ file });
          }
          runs.push({ height, entity, direction, damage, pose });
        }
        await p.evaluate(
          ({ entity, direction }) =>
            (window as unknown as Win).__arena.hitFixture(
              "defeat-opponent",
              entity,
              direction,
            ),
          { entity, direction },
        );
        await p.waitForTimeout(150);
        const falling = await arena(p),
          fall = falling.animation.displayed.find(
            (x) => x.id === falling.state.actors[1]!.id,
          )!;
        assert.equal(fall.selected, `death:${direction}`);
        await p.waitForTimeout(700);
        const a = await arena(p),
          pose = a.animation.displayed.find(
            (x) => x.id === a.state.actors[1]!.id,
          )!;
        const delivered =
          entity !== "garran" || direction === "se" || direction === "sw";
        assert.equal(
          pose.selected,
          `${delivered ? "corpse" : "death"}:${direction}`,
        );
        assert.equal(pose.delivery, delivered ? "A14" : "A10");
        assert.equal(pose.proceduralFall, false);
        assert(pose.corpse);
        await shot(p, `${entity}-corpse-${direction}`, height);
        const held = (await arena(p)).animation.displayed.find(
          (x) => x.id === a.state.actors[1]!.id,
        )!;
        assert.equal(held.frame, pose.frame);
        assert.equal(held.selected, pose.selected);
        runs.push({ height, entity, direction, fall, pose, held });
      }
    }
    for (const who of ["player", "opponent"] as const) {
      await p.evaluate(
        (who) => (window as unknown as Win).__arena.hitFixture(who),
        who,
      );
      await p.waitForTimeout(50);
      const a = await arena(p),
        target = a.state.actors.find(
          (x) =>
            x.id === (who === "player" ? a.player.id : a.state.actors[1]!.id),
        )!;
      assert(target.tags.includes("STAGGERED"));
      assert(!target.pending);
      const reacted = a.animation.displayed.find((x) => x.id === target.id)!;
      assert(
        Math.abs(Number(reacted.offsetX)) + Math.abs(Number(reacted.offsetY)) >
          0,
        "visible recoil",
      );
      assert(a.state.events.some((e) => e.kind === "interrupt"));
      await p.screenshot({
        path: join(out, "screens", `${height}-recoil-${who}.png`),
      });
      screens.push({ file: `${height}-recoil-${who}.png` });
      runs.push({
        height,
        kind: who,
        animation: a.animation,
        feedback: a.feedback,
      });
    }
    for (const entity of [
      undefined,
      "conscript",
      "shieldman",
      "slinger",
      "netter",
      "cinder_hound",
      "thornback",
      "mire_maw",
      "hush_moth",
    ]) {
      await p.evaluate(
        (entity) =>
          (window as unknown as Win).__arena.hitFixture(
            "defeat-opponent",
            entity,
          ),
        entity,
      );
      const before = await arena(p);
      await p.waitForTimeout(1100);
      const dead = await arena(p);
      const actor = dead.state.actors[1]!,
        pose = dead.animation.displayed.find((x) => x.id === actor.id)!;
      assert(actor.tags.includes("DEFEATED"));
      assert(pose.corpse);
      assert(dead.state.tick === before.state.tick);
      await shot(p, `corpse-${entity ?? "mage"}`, height);
      await p.waitForTimeout(250);
      const later = await arena(p),
        held = later.animation.displayed.find((x) => x.id === actor.id)!;
      assert.equal(held.rotation, pose.rotation);
      assert.equal(held.frame, pose.frame);
      assert.equal(later.state.actors.length, dead.state.actors.length);
      runs.push({ height, kind: entity ?? "mage", pose, held });
      await p.keyboard.press("KeyG");
      assert(
        (await arena(p)).state.actors.every(
          (a) => !a.tags.includes("DEFEATED"),
        ),
      );
    }
    await p.evaluate(() =>
      (window as unknown as Win).__arena.hitFixture("defeat-player"),
    );
    await p.waitForTimeout(1100);
    await shot(p, "lab-player-corpse", height);
    await p.keyboard.press("KeyR");
    assert(
      (await arena(p)).state.actors.every((a) => !a.tags.includes("DEFEATED")),
    );
    await p.evaluate(() => localStorage.setItem("mage-motion", "reduced"));
    await p.evaluate(() =>
      (window as unknown as Win).__arena.hitFixture(
        "defeat-opponent",
        "shieldman",
      ),
    );
    await p.waitForTimeout(120);
    await shot(p, "reduced-motion-corpse", height);
    await p.evaluate(() => localStorage.removeItem("mage-motion"));
    // Ordinary training has the real result transition; Lab intentionally remains inspectable.
    await p.evaluate(() => {
      const a = (window as unknown as Win).__arena;
      a.reset();
      a.hitFixture("defeat-player");
    });
    await p.waitForFunction(
      () => (window as unknown as Win).__ui.snapshot().screen === "results",
    );
    await p.waitForTimeout(1100);
    await shot(p, "defeat-results", height);
    const result = await arena(p);
    assert(result.player.tags.includes("DEFEATED"));
    assert(
      result.animation.displayed.find((x) => x.id === result.player.id)?.corpse,
    );
    await context.close();
    current = undefined;
  }
  assert.deepEqual(errors, []);
  writeFileSync(
    join(out, "browser.json"),
    JSON.stringify(
      {
        passed: true,
        command:
          "npm run build:game && npx tsx packages/tools/src/u6b-browser.ts",
        runs,
        screens,
        errors,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify({ passed: true, screens: screens.length }));
} catch (e) {
  if (current) await current.screenshot({ path: join(out, "failure.png") });
  writeFileSync(
    join(out, "browser-failure.json"),
    JSON.stringify({ error: String(e), errors, serverLog }, null, 2),
  );
  throw e;
} finally {
  await browser.close();
  server.kill();
}
