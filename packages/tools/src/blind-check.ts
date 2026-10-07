import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const root = resolve("docs/waves/W1-evidence");
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1080 },
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(pathToFileURL(resolve(root, "OWNER-READ.html")).href);
  assert.equal(await page.locator("section").count(), 3);
  assert.equal(await page.locator("article").count(), 6);
  const text = await page.locator("body").innerText();
  assert.doesNotMatch(
    text,
    /sonnet|claude|ollama|qwen|planner|live accepted|blind-source-map/i,
  );
  assert.equal(errors.length, 0);
  await page.screenshot({
    path: resolve(root, "owner-read-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({
    path: resolve(root, "owner-read-mobile.png"),
    fullPage: true,
  });
  writeFileSync(
    resolve(root, "blind-browser-check.json"),
    JSON.stringify(
      {
        label: "measured browser layout and source-label checks; not felt",
        browser: await browser.version(),
        mornings: 3,
        cards: 6,
        desktop: [1440, 1080],
        mobile: [390, 844],
        overflow: false,
        errors,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await browser.close();
}
