// Pin drift report: what this PC repo changed since the commit VR pinned (mage-arena-vr apps/vr/data/PINNED.json).
// Node built-ins only; git via execFileSync. `--vectors` also replays VR's conformance vectors against PC HEAD.
//   npm run vr:drift [-- --vr <path>] [--vectors] [--json]
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { cliMain, renderDiff } from './harness.mjs';

export const DEFAULT_VR = 'C:/Users/kazda/kiro/mage-arena-vr';
export const WATCHED = ['packages/core/src/arena', 'packages/core/scripts', 'docs/design/reconciled/data'];
const defaultPc = fileURLToPath(new URL('../../../', import.meta.url));

function git(cwd, args, encoding = 'utf8') {
  return execFileSync('git', ['-C', cwd, ...args], {
    encoding, maxBuffer: 64 * 1024 * 1024, windowsHide: true,
    env: { ...process.env, GIT_PAGER: '', PAGER: '', GIT_TERMINAL_PROMPT: '0' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
}

export function readPin(vrRoot) {
  const path = join(vrRoot, 'apps', 'vr', 'data', 'PINNED.json');
  let pin;
  try {
    pin = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    throw new Error(`cannot read ${path}: ${err.message}`, { cause: err });
  }
  if (typeof pin.commit !== 'string' || !/^[0-9a-f]{7,40}$/i.test(pin.commit) || !Array.isArray(pin.files)) {
    throw new Error(`${path} has no hex commit or no files array`);
  }
  return pin;
}

function blobAt(pcRoot, commit, path) {
  try {
    return git(pcRoot, ['show', `${commit}:${path}`], 'buffer');
  } catch {
    return null;
  }
}

/** The drift between the pinned commit and `head` in pcRoot. Pure git: the working tree is not read. */
export function driftReport({ pcRoot = defaultPc, vrRoot = DEFAULT_VR, head = 'HEAD' } = {}) {
  const pin = readPin(vrRoot);
  try {
    git(pcRoot, ['cat-file', '-e', `${pin.commit}^{commit}`]);
  } catch {
    throw new Error(`pinned commit ${pin.commit} is not in ${pcRoot}`);
  }
  const headSha = git(pcRoot, ['rev-parse', head]).trim();
  const log = git(pcRoot, ['log', '--format=%H%x09%P%x09%ad%x09%s', '--date=short', `${pin.commit}..${headSha}`, '--', ...WATCHED]);
  const commits = log.split('\n').filter(Boolean).map((line) => {
    const [sha, parents, date, ...subject] = line.split('\t');
    const merge = parents.trim().split(' ').length > 1;
    // A merge lists the watched paths it brought in against its first parent.
    const range = merge ? [`${sha}^1`, sha] : [sha];
    const paths = git(pcRoot, ['diff-tree', '--no-commit-id', '--name-only', '-r', ...range, '--', ...WATCHED]).split('\n').filter(Boolean);
    return { sha, short: sha.slice(0, 7), date, merge, subject: subject.join('\t'), areas: WATCHED.filter((w) => paths.some((p) => p.startsWith(`${w}/`))) };
  });
  const pinnedFiles = pin.files.map((file) => {
    const atHead = blobAt(pcRoot, headSha, file.path);
    const sha256 = atHead ? createHash('sha256').update(atHead).digest('hex') : null;
    const status = !atHead ? 'missing at HEAD' : sha256 === file.sha256 ? 'unchanged' : 'changed';
    return { path: file.path, status, pinnedSha256: file.sha256, headSha256: sha256, pinnedBytes: file.bytes, headBytes: atHead ? atHead.length : null };
  });
  return {
    vr: vrRoot, pc: pcRoot, pinnedCommit: pin.commit, pinnedShort: pin.commit.slice(0, 7), head: headSha, headShort: headSha.slice(0, 7),
    watched: WATCHED, commits, pinnedFiles,
  };
}

/** Replays VR's conformance vectors against this repo's kernel (the working tree, which is HEAD when clean). */
export async function vectorsReport(vrRoot = DEFAULT_VR) {
  const { loadKernel, readConformanceVectors, replayConformance } = await import('./conformance.mjs');
  const kernel = await loadKernel();
  const results = readConformanceVectors(vrRoot).map((v) => replayConformance(kernel, v));
  return { total: results.length, passed: results.filter((r) => r.pass).length, results };
}

export function renderText(report) {
  const lines = [];
  lines.push(`VR pin: ${report.pinnedShort} (${join(report.vr, 'apps/vr/data/PINNED.json')})`);
  lines.push(`PC HEAD: ${report.headShort}`);
  lines.push('');
  lines.push(`Commits ${report.pinnedShort}..${report.headShort} touching ${report.watched.join(', ')}: ${report.commits.length}`);
  for (const c of report.commits) lines.push(`  ${c.short} ${c.date} ${c.subject}  [${[...(c.merge ? ['merge'] : []), ...c.areas.map((a) => a.split('/').pop())].join(', ')}]`);
  lines.push('');
  const changed = report.pinnedFiles.filter((f) => f.status !== 'unchanged');
  lines.push(`Pinned files: ${report.pinnedFiles.length}, changed since the pin: ${changed.length}`);
  for (const f of report.pinnedFiles) {
    const size = f.status === 'changed' ? ` (${f.pinnedBytes} -> ${f.headBytes} bytes)` : '';
    lines.push(`  ${f.status === 'unchanged' ? '  ' : '* '}${f.status.padEnd(15)} ${f.path}${size}`);
  }
  if (report.vectors) {
    const v = report.vectors;
    lines.push('');
    lines.push(`Conformance vectors against PC HEAD: ${v.passed}/${v.total} pass`);
    for (const r of v.results) {
      lines.push(r.pass ? `  pass  ${r.name}` : `  diff  ${r.name}: ${renderDiff(r.record)}`);
    }
  }
  return lines.join('\n');
}

export function parseArgs(argv) {
  const opts = { vr: DEFAULT_VR, vectors: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--vectors') opts.vectors = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--vr') {
      opts.vr = argv[++i];
      if (!opts.vr) throw new Error('--vr requires a path');
    } else if (arg.startsWith('--vr=')) opts.vr = arg.slice(5);
    else throw new Error(`unknown argument: ${arg}`);
  }
  return opts;
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
    const report = driftReport({ vrRoot: opts.vr });
    if (opts.vectors) report.vectors = await vectorsReport(opts.vr);
    process.stdout.write(`${opts.json ? JSON.stringify(report, null, 2) : renderText(report)}\n`);
  } catch (err) {
    process.stderr.write(`vr:drift: ${err.message}\n`);
    process.exitCode = 2;
  }
}

await cliMain(import.meta.url, main);
