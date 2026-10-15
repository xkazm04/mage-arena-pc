import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compileArenaData } from './arena-data.mjs';
const root = new URL('../../../', import.meta.url);
writeFileSync(fileURLToPath(new URL('../src/arena/data.generated.ts', import.meta.url)), compileArenaData(path => readFileSync(new URL(path, root), 'utf8')));
console.log('Arena data compiled from reconciled arena and scale contract; clock, Nerve and absorb authorities agree.');
