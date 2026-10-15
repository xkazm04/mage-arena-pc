// Makes the shared .git/hooks/pre-push run .githooks/pre-push before Git LFS. Not
// core.hooksPath: that setting is shared by every worktree, and a worktree on a commit
// without .githooks would lose its LFS hooks. A checkout without the tracked hook skips
// the gate. Idempotent; re-running replaces the block.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const common = execFileSync('git', ['rev-parse', '--git-common-dir'], { encoding: 'utf8' }).trim();
const hook = path.join(path.resolve(common), 'hooks', 'pre-push');
const BEGIN = '# BEGIN tracked pre-push gate', END = '# END tracked pre-push gate';
// stdin carries the pushed refs for git lfs pre-push; the gate must not consume it.
const block = [BEGIN, 'if [ -f .githooks/pre-push ]; then sh .githooks/pre-push "$@" </dev/null || exit $?; fi', END];

const lines = (fs.existsSync(hook) ? fs.readFileSync(hook, 'utf8') : '#!/bin/sh\n').split('\n');
const start = lines.indexOf(BEGIN), end = lines.indexOf(END);
if (start !== -1 && end > start) lines.splice(start, end - start + 1);
const lfs = lines.findIndex(line => line.startsWith('git lfs pre-push'));
lines.splice(lfs === -1 ? lines.length : lfs, 0, ...block);
fs.writeFileSync(hook, lines.join('\n'));
fs.chmodSync(hook, 0o755);
console.log(`Installed the tracked pre-push gate into ${hook}`);
