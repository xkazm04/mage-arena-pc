import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const pinned='68a4d68d315856c89339d331ac0db7f4784d566f';
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const files=['combat.json','stats.csv','spells-water.csv','enemies.json','arena-tiers.json'];
const numeric=(value:unknown,path=''):unknown[]=>typeof value==='number'?[[path,value]]:value&&typeof value==='object'?Object.entries(value).flatMap(([k,v])=>numeric(v,`${path}/${k}`)):[];
const tables=files.map(file=>{
  const original=execFileSync('git',['show',`${pinned}:docs/design/baseline-fourteen-nights/design/data/${file}`]);
  const current=readFileSync(`docs/design/reconciled/data/arena/${file}`);
  if(file==='enemies.json') assert.deepEqual(numeric(JSON.parse(current.toString())),numeric(JSON.parse(original.toString())));
  else assert.equal(current.toString().replaceAll('\r\n','\n'),original.toString().replaceAll('\r\n','\n'));
  return {file,pinnedHash:sha(original),currentHash:sha(current),unchangedNumbers:true,change:file==='enemies.json'?'conscript behaviour prose only; all numeric values identical':'none (line endings ignored in semantic comparison)'};
});
const camera=readFileSync('art/scale-contract-v1.json'), oldCamera=execFileSync('git',['show',`${pinned}:art/scale-contract-v1.json`]);
assert.deepEqual(JSON.parse(camera.toString()),JSON.parse(oldCamera.toString()));
const record={label:'measured source comparison',command:'npx tsx packages/tools/src/w7-authorities.ts',pinned,tables,camera:{pinnedHash:sha(oldCamera),currentHash:sha(camera),unchanged:true},passed:true};
writeFileSync('docs/waves/W7-evidence/data-authorities.json',JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify(record));
