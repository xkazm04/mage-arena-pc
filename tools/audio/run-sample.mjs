// One explicit AU2 audition brief through the guard. The round cap is separate.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const id = process.argv[2];
const sample = JSON.parse(fs.readFileSync('tools/audio/audition-plan-r2.json')).samples.find(s => s.id === id);
if (!sample) throw Error('Not in the AU2 scope');
const args = ['tools/audio/elevenlabs.mjs', sample.kind, sample.kind === 'music' ? '--prompt' : '--text', sample.prompt, '--out', `docs/audio/audition/r2/${id}.mp3`];
if (sample.seconds) args.push('--seconds', String(sample.seconds));
if (sample.voice) args.push('--voice', sample.voice);
if (sample.loop) args.push('--loop');
if (sample.vocals) args.push('--vocals');
const result = spawnSync(process.execPath, args, { stdio: 'inherit', shell: false });
process.exitCode = result.status ?? 1;
