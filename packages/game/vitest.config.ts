import { defineConfig } from 'vitest/config';
// Unit tests do not start the Vite HTTP sidecar or a provider runtime.
export default defineConfig({ test: { include: ['src/**/*.test.ts'] } });
