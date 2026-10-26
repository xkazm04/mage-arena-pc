import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';

/** Evidence lives under the repo root; scripts run from there, as every command in docs/waves/*.md does. */
export const wavesRoot = 'docs/waves';

/** A wave is registered by its docs/waves/<id>-evidence directory existing; no hand-kept list to edit. */
export function resolveWave(id: string, file = 'replay-save.json', root = wavesRoot): string {
  const dir = `${root}/${id}-evidence`;
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(id) || !existsSync(dir) || !statSync(dir).isDirectory())
    throw Error(`Invalid evidence destination: ${id} (no ${dir})`);
  return `${dir}/${file}`;
}

/** The command a record stamps is the argv that reproduces it, never a sibling entry point. */
export function stampCommand(entry: string, args: string[] = []): string {
  return ['npx tsx', `packages/tools/src/${entry}`, ...args].join(' ');
}

/** Records keep insertion key order, two-space indent and a trailing newline. */
export function writeRecord(path: string, record: object) {
  writeFileSync(path, JSON.stringify(record, null, 2) + '\n');
}

/**
 * A pinned record is rewritten only when its content changes, line endings aside. A checkout with core.autocrlf holds
 * the pin as CRLF while a smoke writes LF, and git then reports the file modified although no value moved.
 * Returns whether the file was written.
 */
export function writePin(path: string, text: string): boolean {
  const normal = (t: string) => t.replace(/\r\n/g, '\n');
  if (existsSync(path) && normal(readFileSync(path, 'utf8')) === normal(text)) return false;
  writeFileSync(path, text);
  return true;
}

/** Value of `--name <value>` in argv, else the fallback. */
export function flag(argv: string[], name: string, fallback?: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
}
