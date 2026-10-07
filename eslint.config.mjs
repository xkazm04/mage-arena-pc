import js from "@eslint/js";
import tseslint from "typescript-eslint";
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
    files: ["packages/core/src/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: ["node:*", "*director*"] },
      ],
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random" },
        { object: "Date", property: "now" },
      ],
      "no-restricted-globals": [
        "error",
        "Date",
        "window",
        "document",
        "fetch",
        "performance",
      ],
    },
  },
  {
    // Build/report scripts execute in Node; Playwright callbacks execute in Chromium.
    files: ["packages/*/scripts/*.mjs"],
    languageOptions: { globals: Object.fromEntries(["URL", "console", "process", "fetch", "setTimeout", "window", "document"].map(name => [name, "readonly"])) },
  },
);
