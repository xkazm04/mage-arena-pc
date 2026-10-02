// One explicit audition brief through the guard; never an implicit whole-plan batch.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const id = process.argv[2];
const sample = JSON.parse(fs.readFileSync('tools/audio/audition-plan.json')).samples.find(s => s.id === id);
if (!sample || sample.scope === 'deferred-smaller-audition') throw Error('Not in the smaller AU1 scope');
const args = ['tools/audio/elevenlabs.mjs', sample.kind, sample.kind === 'music' ? '--prompt' : '--text', sample.prompt, '--out', `docs/audio/audition/r1/${id}.mp3`];
if (sample.seconds) args.push('--seconds', String(sample.seconds));
if (sample.voice) args.push('--voice', sample.voice);
if (sample.loop) args.push('--loop');
if (sample.vocals) args.push('--vocals');
const result = spawnSync(process.execPath, args, { stdio: 'inherit', shell: false });
process.exitCode = result.status ?? 1;
