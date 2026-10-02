import { chromium } from "playwright";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { requiredRegions } from "../../game/src/ui/kit.ts";
import type { CanvasUI } from "../../game/src/ui/ui.ts";

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
    "4189",
    "--strictPort",
  ],
  {
    windowsHide: true,
    stdio: "ignore",
    env: {
      ...process.env,
      CAMP_DIRECTOR: "offline",
      MAGE_SAVE_DIRECTORY: mkdtempSync(join(tmpdir(), "mage-u1-kit-")),
    },
  },
);
const browser = await chromium.launch({ headless: true }),
  results: unknown[] = [];
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch("http://127.0.0.1:4189")).ok) break;
    } catch {
      /* preview startup */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  const fixture = await browser.newPage();
  const data = await fixture.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    g.fillStyle = "#153f47";
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = "#d2ba81";
    g.lineWidth = 4;
    g.strokeRect(4, 4, 120, 120);
    g.fillStyle = "#ffffff";
    g.fillRect(4, 4, 8, 8);
    return c.toDataURL("image/png").split(",")[1]!;
  });
  await fixture.close();
  const png = Buffer.from(data, "base64"),
    sha256 = createHash("sha256").update(png).digest("hex");
  const base = {
    schemaVersion: 1,
    id: "synthetic-test-only",
    designSize: [1920, 1080],
    pages: [{ id: "test", file: "test.png", size: [128, 128], sha256 }],
    regions: Object.fromEntries(
      requiredRegions.map((id) => [
        id,
        {
          page: "test",
          rect: [2, 2, 124, 124],
          anchor: [0, 0],
          nineSlice: [12, 12, 12, 12],
          minSize: [1, 1],
        },
      ]),
    ),
  };
  for (const kind of [
    "valid",
    "wrong-hash",
    "missing-region",
    "out-of-bounds",
    "unknown-schema",
    "missing-page",
  ] as const) {
    const manifest = structuredClone(base);
    if (kind === "wrong-hash") manifest.pages[0]!.sha256 = "0".repeat(64);
    if (kind === "missing-region") delete manifest.regions["button.focus"];
    if (kind === "out-of-bounds")
      manifest.regions["panel.body"]!.rect = [120, 120, 124, 124];
    if (kind === "unknown-schema") manifest.schemaVersion = 2;
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
      }),
      page = await context.newPage(),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/art/ui/kit.json", (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(manifest),
      }),
    );
    await page.route("**/art/ui/test.png", (r) =>
      r.fulfill({
        status: kind === "missing-page" ? 404 : 200,
        contentType: "image/png",
        body: png,
      }),
    );
    await page.goto("http://127.0.0.1:4189/");
    await page.waitForFunction(
      () =>
        (
          window as unknown as {
            __ui?: { snapshot(): ReturnType<CanvasUI["snapshot"]> };
          }
        ).__ui?.snapshot().screen === "menu",
    );
    const snapshot = await page.evaluate(() =>
      (
        window as unknown as {
          __ui: { snapshot(): ReturnType<CanvasUI["snapshot"]> };
        }
      ).__ui.snapshot(),
    );
    assert.equal(
      snapshot.kit,
      kind === "valid" ? "/art/ui/kit.json" : "procedural",
    );
    assert.equal(snapshot.diagnostics.length, kind === "valid" ? 0 : 1);
    assert.deepEqual(errors, []);
    if (kind === "valid") {
      const full = snapshot.buttons.find((b) => b.id === "fullscreen")!;
      await page.mouse.click(full.x + full.w / 2, full.y + full.h / 2);
      await page.waitForFunction(() => !!document.fullscreenElement);
      // Exit through the same game action; use its current scaled coordinates.
      const resized = await page.evaluate(() =>
        (
          window as unknown as {
            __ui: { snapshot(): ReturnType<CanvasUI["snapshot"]> };
          }
        ).__ui.snapshot(),
      );
      const exit = resized.buttons.find((b) => b.id === "fullscreen")!;
      await page.mouse.click(exit.x + exit.w / 2, exit.y + exit.h / 2);
      await page.waitForFunction(() => !document.fullscreenElement);
    }
    const button = snapshot.buttons.find((b) => b.id === "pick-character")!;
    await page.mouse.click(button.x + button.w / 2, button.y + button.h / 2);
    await page.waitForFunction(
      () =>
        (
          window as unknown as {
            __ui: { snapshot(): ReturnType<CanvasUI["snapshot"]> };
          }
        ).__ui.snapshot().screen === "character",
    );
    results.push({
      kind,
      source: snapshot.kit,
      diagnostics: snapshot.diagnostics,
      playable: true,
      fullscreenRoundTrip: kind === "valid" ? true : undefined,
    });
    await context.close();
  }
  writeFileSync(
    "docs/waves/U1-evidence/kit-loader.json",
    JSON.stringify(
      {
        label:
          "Synthetic atlas fixture, not delivered or accepted art; browser integration measured",
        command: "npx tsx packages/tools/src/u1-kit-browser.ts",
        passed: true,
        results,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify({ passed: true, cases: results.length }));
} finally {
  await browser.close();
  server.kill();
}
