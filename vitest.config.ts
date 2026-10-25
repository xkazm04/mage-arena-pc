import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
// @mage/* resolve to this checkout's own sources, never through node_modules links
// (a worktree's links point into the main checkout). Longer subpaths first.
const local = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@mage\/core\/arena$/, replacement: local("./packages/core/src/arena/index.ts") },
      { find: /^@mage\/core$/, replacement: local("./packages/core/src/index.ts") },
      { find: /^@mage\/director$/, replacement: local("./packages/director/src/index.ts") },
    ],
  },
  test: { include: ["packages/**/*.test.ts"], testTimeout: 30000 },
});
