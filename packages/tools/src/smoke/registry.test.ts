import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REGISTRY, SUITE_DIR, deadLocators, suite } from './registry.ts';

const smokeFile = /-(browser|tour|performance)\.ts$|^u6b-audio\.ts$/;
const gameSource = (dir: string): string =>
  readdirSync(dir, { withFileTypes: true })
    .map((d) => (d.isDirectory() ? gameSource(join(dir, d.name)) : d.name.endsWith('.ts') ? readFileSync(join(dir, d.name), 'utf8') : ''))
    .join('\n');

describe('smoke registry', () => {
  it('registers every browser / tour / performance / audio-walk suite exactly once', () => {
    const onDisk = readdirSync(SUITE_DIR).filter((f) => smokeFile.test(f)).sort();
    const registered = REGISTRY.filter((e) => e.kind !== 'audit').map((e) => e.file);
    expect(registered.toSorted()).toEqual(onDisk);
    expect(new Set(registered).size).toBe(registered.length);
    expect(new Set(REGISTRY.map((e) => e.id)).size).toBe(REGISTRY.length);
  });

  it('retires every suite whose DOM locators no longer exist in the game', () => {
    const game = gameSource('packages/game/src');
    const dead = REGISTRY.filter((e) => deadLocators(readFileSync(join(SUITE_DIR, e.file), 'utf8'), game).length > 0);
    expect(dead.map((e) => e.id).sort()).toEqual(['camp', 'parley', 'season', 'w7-director', 'w7-scenes']);
    for (const e of dead) {
      expect(e.status).toBe('retired');
      expect(e.surface).toBe('dom');
      expect(e.reason).toMatch(/\[data-|#settings-dialog/);
    }
    for (const e of REGISTRY.filter((x) => !dead.includes(x))) expect(e.status, e.id).toBe('live');
  });

  it('finds data-* and #id locators, and keeps the ones the game still sets', () => {
    const src = `page.locator("[data-place]"); page.waitForSelector('body[data-ready=true]'); page.locator('#settings-dialog[open]'); const c = "#ffffff";`;
    expect(deadLocators(src, 'document.body.dataset.ready = "true"')).toEqual(['[data-place]', '#settings-dialog']);
    expect(deadLocators(src, 'el.dataset.place = "x"; dialog.id = "settings-dialog"; body.dataset.ready = "1"')).toEqual([]);
    expect(deadLocators(`page.locator('#prepare-games')`, `{ id: "prepare-games" }`)).toEqual(['#prepare-games']);
  });

  it('marks the Director suite paid and nothing else', () => {
    expect(REGISTRY.filter((e) => e.paid).map((e) => e.id)).toEqual(['w7-director']);
    expect(suite('w7-director')?.env?.CAMP_DIRECTOR).toBe('claude');
  });

  it('resolves every package.json smoke:* / audit:* script to a registry entry', () => {
    const scripts = (JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> }).scripts;
    const names = Object.keys(scripts).filter((n) => /^(smoke|audit):/.test(n));
    expect(names.length).toBeGreaterThanOrEqual(9);
    for (const name of names) {
      const files = [...scripts[name]!.matchAll(/packages\/tools\/src\/([\w-]+\.ts)/g)].map((m) => m[1]);
      expect(files.length, name).toBeGreaterThan(0);
      for (const f of files) expect(REGISTRY.filter((e) => e.file === f).length, `${name} -> ${f}`).toBe(1);
      expect(REGISTRY.some((e) => e.aliases.includes(name)), `${name} alias`).toBe(true);
    }
    expect(REGISTRY.find((e) => e.aliases.includes('audit:u4'))?.file).toBe('u4-audit.ts');
  });

  it('gives every suite with an evidence dir a pass record name', () => {
    for (const e of REGISTRY) if (e.evidence) expect(e.pass, e.id).toBeTruthy();
  });
});
