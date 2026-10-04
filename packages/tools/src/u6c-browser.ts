import { chromium, type Page } from "playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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
    startRoster(id: string): void;
    sigilFixture(k: Shape, e: Element, p: number, a: number, u: boolean): void;
    artFixture(k?: "stress"): void;
    setPalette(p: string): void;
    feedbackFixture(k: "perfect" | "cast"): void;
    stepInput(n: number): void;
  };
};
const priorityGaps = (
  JSON.parse(
    readFileSync("assets/accepted/covenant/a14/session10/backlog.json", "utf8"),
  ) as { priority: string[] }
).priority;
const out = resolve("docs/waves/U6c-evidence");
const collapseOnly = process.env.U6C_COLLAPSE_ONLY === "1";
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
    "4198",
    "--strictPort",
  ],
  {
    windowsHide: true,
    stdio: "pipe",
    env: {
      ...process.env,
      CAMP_DIRECTOR: "offline",
      MAGE_SAVE_DIRECTORY: mkdtempSync(join(tmpdir(), "mage-u6c-")),
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
      if ((await fetch("http://127.0.0.1:4198/api/health")).ok) break;
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
    await p.goto("http://127.0.0.1:4198/lab?harness=1");
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
      "cinder_hound",
      "mire_maw",
      "thornback",
      "hush_moth",
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
        for (const damage of collapseOnly ? [] : [8, 24]) {
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
            `${damage === 8 ? "hit-light" : "hit-heavy"}:${entity === "thornback" && direction.startsWith("n") ? (direction === "ne" ? "se" : "sw") : direction}`,
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
        // The contact effect lasts 390 ms; capture the fall after it clears.
        await p.waitForTimeout(430);
        const falling = await arena(p),
          fall = falling.animation.displayed.find(
            (x) => x.id === falling.state.actors[1]!.id,
          )!;
        const selectedDirection =
          ["mire_maw", "thornback"].includes(entity) &&
          direction.startsWith("n")
            ? direction === "ne"
              ? "se"
              : "sw"
            : direction;
        assert.equal(fall.selected, `death:${selectedDirection}`);
        assert.equal(fall.delivery, "A14");
        const collapseFile = `${height}-${entity}-collapse-${direction}.png`;
        await p.screenshot({ path: join(out, "screens", collapseFile) });
        screens.push({ file: collapseFile });
        if (collapseOnly) {
          runs.push({ height, entity, direction, fall });
          continue;
        }
        await p.waitForTimeout(700);
        const a = await arena(p),
          pose = a.animation.displayed.find(
            (x) => x.id === a.state.actors[1]!.id,
          )!;
        assert.equal(pose.selected, `corpse:${selectedDirection}`);
        assert.equal(pose.delivery, "A14");
        assert.equal(pose.mirrorX, selectedDirection.endsWith("w"));
        assert.equal(pose.rotation, 0);
        assert.equal(pose.offsetX, 0);
        assert.equal(pose.offsetY, 0);
        assert.equal(pose.groundDepth, a.state.actors[1]!.pos.y);
        assert.deepEqual(pose.anchor, fall.anchor);
        assert.equal(pose.fullFramePx, fall.fullFramePx);
        assert.equal(
          Math.sign(Number(pose.scaleX)),
          selectedDirection.endsWith("w") ? -1 : 1,
        );
        assert(
          a.depthOrder.every((x, i) => !i || x.y >= a.depthOrder[i - 1]!.y),
          "ground sorting",
        );
        assert.equal(pose.proceduralFall, false);
        assert(pose.corpse);
        await shot(p, `${entity}-corpse-${direction}`, height);
        const held = (await arena(p)).animation.displayed.find(
          (x) => x.id === a.state.actors[1]!.id,
        )!;
        assert.equal(held.frame, pose.frame);
        assert.equal(held.selected, pose.selected);
        // The corpse also persists if ordinary core ticks continue around it.
        await p.evaluate(() =>
          (window as unknown as Win).__arena.stepInput(120),
        );
        await p.waitForTimeout(40);
        const advanced = await arena(p);
        assert.deepEqual(advanced.state.actors[1]!.pos, a.state.actors[1]!.pos);
        assert.equal(advanced.state.actors[1]!.hp, 0);
        assert.equal(
          advanced.animation.displayed.find(
            (x) => x.id === a.state.actors[1]!.id,
          )!.selected,
          pose.selected,
        );
        runs.push({ height, entity, direction, fall, pose, held });
        await p.keyboard.press("KeyR");
        await p.waitForTimeout(40);
        const reset = await arena(p);
        assert(reset.state.actors.every((x) => !x.tags.includes("DEFEATED")));
        assert(reset.animation.displayed.every((x) => !x.corpse));
      }
    }
    if (collapseOnly) {
      // The real moth brain drains on contact without emitting a cast event.
      await p.evaluate(() =>
        (window as unknown as Win).__arena.startRoster("hush_moth"),
      );
      await p.waitForFunction(
        () => {
          const a = (window as unknown as Win).__arena.snapshot();
          return (
            a.player.mana < a.player.maxMana - 1 &&
            a.animation.displayed.some(
              (x) =>
                x.entity === "hush_moth" &&
                x.requested === "cast" &&
                x.delivery === "A14",
            )
          );
        },
        undefined,
        { timeout: 45000 },
      );
      await p.waitForTimeout(650);
      const feeding = await arena(p);
      assert(
        feeding.animation.displayed.some(
          (x) => x.entity === "hush_moth" && x.requested === "cast",
        ),
      );
      await shot(p, "active-moth-contact-attack", height);
      runs.push({
        height,
        kind: "active-moth-contact",
        mana: feeding.player.mana,
        animation: feeding.animation,
      });
      await context.close();
      current = undefined;
      continue;
    }
    const fallbackSnapshot = (await arena(p)).animation.fallbacks;
    for (const gap of priorityGaps)
      assert.equal(
        fallbackSnapshot.filter((f) => f.startsWith(gap + " ")).length,
        1,
        gap,
      );
    await p.keyboard.press("F8");
    await shot(p, "priority-fallback-debug", height);
    await p.keyboard.press("F8");
    runs.push({
      height,
      kind: "priority-fallbacks",
      entries: fallbackSnapshot,
    });
    // Exercise the owner-facing selector, facing control, live input, G and R.
    await p.keyboard.press("KeyL");
    for (const entity of [
      "cinder_hound",
      "mire_maw",
      "thornback",
      "hush_moth",
    ]) {
      for (let i = 0; i < 6; i++) {
        const target = (await ui(p)).buttons.find(
          (b) => b.id === "lab-config-opponent",
        )!;
        if (target.label.toLowerCase().includes(entity.replaceAll("_", " ")))
          break;
        await click(p, "lab-config-opponent");
      }
      await shot(p, `setup-${entity}`, height);
      await click(p, "lab-config-start");
      const selected = await arena(p);
      assert.equal(selected.lab!.config.creature, entity);
      assert.equal(selected.state.actors[1]!.enemy!.id, entity);
      assert.equal(selected.state.actors.length, 2);
      // Use real mouse/keyboard casting against the selected roster target.
      await p.waitForTimeout(250);
      await p.keyboard.press("Digit1");
      let live = await arena(p);
      const targetId = live.state.actors[1]!.id;
      let grounded = live.animation.displayed.find((x) => x.id === targetId)!;
      await p.mouse.move(Number(grounded.groundX), Number(grounded.groundY));
      await p.mouse.down();
      for (
        let i = 0;
        i < 360 && !live.state.actors[1]!.tags.includes("DEFEATED");
        i++
      ) {
        await p.waitForTimeout(250);
        live = await arena(p);
        grounded = live.animation.displayed.find((x) => x.id === targetId)!;
        await p.mouse.move(Number(grounded.groundX), Number(grounded.groundY));
      }
      await p.mouse.up();
      assert(
        live.state.actors[1]!.tags.includes("DEFEATED"),
        `live input defeats ${entity}: ${JSON.stringify({ target: live.state.actors[1]!.hp, mana: live.player.mana, metrics: live.lab!.metrics })}`,
      );
      assert(live.lab!.metrics.landed > 0);
      assert(live.lab!.metrics.timeToKillS !== null);
      await p.waitForTimeout(800);
      await shot(p, `live-input-${entity}-corpse`, height);
      runs.push({
        height,
        kind: "live-creature-fight",
        entity,
        metrics: live.lab!.metrics,
      });
      await p.evaluate(() =>
        (window as unknown as Win).__arena.hitFixture(
          "defeat-opponent",
          undefined,
          "sw",
        ),
      );
      await p.waitForTimeout(900);
      assert(
        (await arena(p)).animation.displayed.some(
          (x) => x.entity === entity && x.corpse,
        ),
      );
      await p.keyboard.press("KeyG");
      assert(
        (await arena(p)).state.actors.every(
          (x) => !x.tags.includes("DEFEATED"),
        ),
      );
      await p.keyboard.press("KeyR");
      const reset = await arena(p);
      assert.equal(reset.state.actors[1]!.enemy!.id, entity);
      assert(reset.state.actors.every((x) => !x.tags.includes("DEFEATED")));
      runs.push({
        height,
        kind: "creature-selector-reset",
        entity,
        config: reset.lab!.config,
      });
      await p.keyboard.press("KeyL");
    }
    // Restore the default dummy for generic H1 fixtures.
    await click(p, "lab-config-opponent");
    await click(p, "lab-config-start");
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
    join(out, collapseOnly ? "collapse.json" : "browser.json"),
    JSON.stringify(
      {
        passed: true,
        command: `${collapseOnly ? "U6C_COLLAPSE_ONLY=1 " : ""}npx tsx packages/tools/src/u6c-browser.ts`,
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
