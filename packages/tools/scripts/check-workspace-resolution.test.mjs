import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { check, defaultRoot, aliasTargets, tsconfigPaths } from "./check-workspace-resolution.mjs";

test("this checkout resolves @mage/* to its own packages", () => {
  assert.deepEqual(check(defaultRoot), []);
});

test("tsconfig paths and alias cover the same three specifiers", () => {
  const specs = ["@mage/core", "@mage/core/arena", "@mage/director"];
  assert.deepEqual(Object.keys(tsconfigPaths(defaultRoot)).sort(), specs.sort());
  assert.deepEqual(Object.keys(aliasTargets(defaultRoot)).sort(), specs.sort());
});

test("fails loudly when paths and alias are missing", () => {
  const dir = mkdtempSync(join(tmpdir(), "wsres-"));
  writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({ compilerOptions: {} }));
  writeFileSync(join(dir, "vitest.config.ts"), "export default {};");
  const problems = check(dir);
  assert.ok(problems.some((p) => p.includes("tsconfig paths: @mage/core is missing")));
  assert.ok(problems.some((p) => p.includes("vitest alias: @mage/core/arena is missing")));
});

test("flags an alias that points outside the root", () => {
  const dir = mkdtempSync(join(tmpdir(), "wsres-"));
  const outside = mkdtempSync(join(tmpdir(), "wsres-out-"));
  const paths = Object.fromEntries(["@mage/core", "@mage/core/arena", "@mage/director"].map((k) => [k, [join(outside, "x.ts")]]));
  writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({ compilerOptions: { paths } }));
  writeFileSync(join(dir, "vitest.config.ts"), readFileSync(join(defaultRoot, "vitest.config.ts")));
  assert.ok(check(dir).some((p) => p.includes("outside")));
});
