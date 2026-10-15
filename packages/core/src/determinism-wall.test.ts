import { describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';

// The core's determinism wall is a lint rule set in eslint.config.mjs. A wall with no
// violations is invisible: a later config block, a renamed selector or a dropped entry
// would leave it silent with every test green. Each canary below plants one shape the
// wall exists to catch, under a path the core block covers, and requires an error from
// the named rule; the control proves the wall is not simply always red.
const root = fileURLToPath(new URL('../../../', import.meta.url));
const filePath = `${root}packages/core/src/arena/__canary.ts`;
const eslint = new ESLint({ cwd: root });

const canaries: [string, string, string][] = [
  ['Math.random', 'export const f = (): number => Math.random();', 'no-restricted-properties'],
  ['destructured Math.random', 'const { random } = Math; export const f = (): number => random();', 'no-restricted-properties'],
  ['Date.now', 'export const f = (): number => Date.now();', 'no-restricted-globals'],
  ['new Date', 'export const f = (): number => new Date().getTime();', 'no-restricted-globals'],
  ['performance', 'export const f = (): number => performance.now();', 'no-restricted-globals'],
  ['window', 'export const f = (): unknown => window;', 'no-restricted-globals'],
  ['globalThis aliasing', 'export const f = (): number => globalThis.Math.random();', 'no-restricted-globals'],
  ['setTimeout', 'export const f = (): void => { setTimeout(() => undefined, 0); };', 'no-restricted-globals'],
  ['setInterval', 'export const f = (): void => { setInterval(() => undefined, 9); };', 'no-restricted-globals'],
  ['queueMicrotask', 'export const f = (): void => { queueMicrotask(() => undefined); };', 'no-restricted-globals'],
  ['process', 'export const f = (): string | undefined => process.env.SEED;', 'no-restricted-globals'],
  ['crypto', 'export const f = (): string => crypto.randomUUID();', 'no-restricted-globals'],
  ['Intl', 'export const f = (): string => new Intl.NumberFormat().format(1);', 'no-restricted-globals'],
  ['toLocaleString', 'export const f = (n: number): string => n.toLocaleString();', 'no-restricted-properties'],
  ['node: import', 'import { readFileSync } from "node:fs"; export const f = readFileSync;', 'no-restricted-imports'],
  ['bare builtin import', 'import { readFileSync } from "fs"; export const f = readFileSync;', 'no-restricted-imports'],
  ['dynamic import', 'export const f = async (): Promise<unknown> => import("./kernel.ts");', 'no-restricted-syntax'],
  ['director package', 'import * as d from "@mage/director"; export const f = d;', 'no-restricted-imports'],
  ['director relative', 'import * as d from "../../../director/src/index.ts"; export const f = d;', 'no-restricted-imports'],
  ['game package', 'import * as g from "@mage/game"; export const f = g;', 'no-restricted-imports'],
  ['game relative', 'import * as g from "../../../game/src/main.ts"; export const f = g;', 'no-restricted-imports'],
  ['tools relative', 'import * as t from "../../../tools/src/report.ts"; export const f = t;', 'no-restricted-imports'],
];

async function rulesFired(code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return result!.messages.map(m => m.ruleId ?? `fatal: ${m.message}`);
}

describe('core determinism wall', () => {
  it('covers the canary path', async () => {
    expect(await eslint.isPathIgnored(filePath)).toBe(false);
  });
  it('passes a clean seeded transition (control)', async () => {
    expect(await rulesFired('export const f = (seed: number): number => (seed * 2) >>> 0;')).toEqual([]);
  });
  it.each(canaries)('rejects %s', async (_name, code, rule) => {
    expect(await rulesFired(code)).toContain(rule);
  });
});
