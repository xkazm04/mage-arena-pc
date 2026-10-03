import { hourDays } from './hour-days.mjs';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { loadTables, designRoot } from './tables.mjs';
import { goldenNights } from './reference.mjs';
import { check, render, readArtifacts } from './check.mjs';
import { itemSchema } from '../../director/src/schema.ts';
import { branchNights } from './scenarios.mjs';

const t = loadTables(), command = process.argv[2];
if (command === 'generate') {
  writeFileSync(new URL('fixtures/hour-days.json',designRoot),JSON.stringify(hourDays(t),null,2)+'\n');
  writeFileSync(new URL('data/decision.schema.json',designRoot),JSON.stringify(itemSchema(t),null,2)+'\n');
  writeFileSync(new URL('fixtures/branch-nights.json',designRoot),JSON.stringify(branchNights(t),null,2)+'\n');
  writeFileSync(new URL('fixtures/golden-nights.json',designRoot),JSON.stringify(goldenNights(t),null,2)+'\n');
  writeFileSync(new URL('README.md',designRoot),render(t,readFileSync(new URL('README.template.md',designRoot),'utf8')));
  console.log('Generated golden nights and table-backed prose.');
} else if (command === 'check') {
  const a = readArtifacts(), errors = check(t,a.fixtures,a.prose,a.template,a.schema);
  if (JSON.stringify(JSON.parse(readFileSync(new URL('fixtures/hour-days.json',designRoot),'utf8')))!==JSON.stringify(hourDays(t))) errors.push('hour fixture drift');
  const branches=JSON.parse(readFileSync(new URL('fixtures/branch-nights.json',designRoot),'utf8'));
  if (JSON.stringify(branches)!==JSON.stringify(branchNights(t))) errors.push('branch fixture drift');
  console.log(JSON.stringify({ contradictions: errors.length, errors, nights: a.fixtures.length, deltas: a.fixtures.reduce((n,f) => n+f.trace.length,0) },null,2));
  if (errors.length) process.exitCode = 1;
} else if (command === 'build') {
  for (const file of readdirSync(new URL('.',import.meta.url)).filter(f => f.endsWith('.mjs'))) {
    const result = spawnSync(process.execPath,['--check',new URL(file,import.meta.url).pathname.replace(/^\/([A-Z]:)/i,'$1')],{encoding:'utf8'});
    if (result.status !== 0) { console.error(result.stderr); process.exitCode = 1; }
  }
  if (!process.exitCode) console.log('Reference tool syntax build passed.');
} else throw new Error('Use generate, check, or build');
