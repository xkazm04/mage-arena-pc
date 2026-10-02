import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createState } from '@mage/core';
import { ClaudeProvider, CostGuard, loadTables, night, RequestCache } from '@mage/director';
const out = 'docs/waves/W7-evidence';
mkdirSync(out, { recursive: true });
mkdirSync('.director-runtime/w7-cli', { recursive: true });
if (existsSync(`${out}/director-night.json`)) throw Error('This live sample already exists; replay its evidence instead.');
const tables = loadTables();
const provider = new ClaudeProvider(`${process.cwd()}/.director-runtime/w7-cli`);
const ledger = '.director-runtime/w7-ledger.json';
const result = await night(tables, createState(tables, 73), {
  provider, cache: new RequestCache('.director-runtime/w7-cache'),
  guard: new CostGuard(ledger, 'w7-integration-session', 'claude', 20, 20),
});
writeFileSync(`${out}/director-night.json`, JSON.stringify({ label: 'measured calls, simulated consequences', command: 'npx tsx packages/tools/src/w7-director.ts', model: provider.model, options: provider.options, result }, null, 2) + '\n');
writeFileSync(`${out}/director-ledger.json`, readFileSync(ledger));
console.log(JSON.stringify({ calls: result.groups.map(g => ({ group: g.group, source: g.source, error: g.error, elapsedMs: g.elapsedMs })), afterHash: result.afterHash }));
