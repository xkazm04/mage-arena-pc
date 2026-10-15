import js from "@eslint/js";
import tseslint from "typescript-eslint";
import { builtinModules } from "node:module";
export default tseslint.config(
  { ignores: ["**/dist/**", "node_modules/**", "packages/tools/replay/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["packages/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    // The core is a pure, replayable transition function: inputs and the seed arrive as
    // values, time is the tick. Every restriction here is probed by
    // packages/core/src/determinism-wall.test.ts; add a canary there when you add one here.
    files: ["packages/core/src/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: builtinModules.filter(name => !name.startsWith("_") && !name.startsWith("node:")),
          patterns: [
            { group: ["node:*"], message: "The core performs no I/O; the Director and the game own the host." },
            { group: ["*director*"], message: "The Director drives the core, never the reverse." },
            { group: ["@mage/game", "@mage/game/*", "@mage/tools", "@mage/tools/*", "**/game/**", "**/tools/**"], message: "The core is consumed by game and tools, never the reverse." },
          ],
        },
      ],
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random" },
        { object: "Date", property: "now" },
        { property: "toLocaleString", message: "Locale output differs by host; format outside the core." },
        { property: "toLocaleDateString" },
        { property: "toLocaleTimeString" },
      ],
      "no-restricted-globals": [
        "error",
        "Date",
        "window",
        "document",
        "fetch",
        "performance",
        "globalThis",
        "setTimeout",
        "setInterval",
        "setImmediate",
        "queueMicrotask",
        "process",
        "crypto",
        "Intl",
        "Buffer",
        "navigator",
        "location",
        "localStorage",
      ],
      "no-restricted-syntax": [
        "error",
        { selector: "ImportExpression", message: "Dynamic import loads code at run time; the core imports statically." },
      ],
    },
  },
  {
    // Build/report scripts execute in Node; Playwright callbacks execute in Chromium.
    files: ["packages/*/scripts/*.mjs"],
    languageOptions: { globals: Object.fromEntries(["URL", "console", "process", "fetch", "setTimeout", "window", "document"].map(name => [name, "readonly"])) },
  },
);
