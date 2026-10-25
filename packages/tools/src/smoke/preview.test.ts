import { describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { freePort, previewArgs, waitReady } from './preview.ts';

const listen = (server: { listen(port: number, host: string, cb: () => void): unknown }, port: number) =>
  new Promise<void>((done) => server.listen(port, '127.0.0.1', done));
const close = (server: { close(cb: () => void): unknown }) => new Promise<void>((done) => server.close(() => done()));

describe('smoke preview', () => {
  it('hands out two distinct OS-assigned ports that are each bindable', async () => {
    const [a, b] = await Promise.all([freePort(), freePort()]);
    expect(a).not.toBe(b);
    for (const port of [a, b]) {
      expect(port).toBeGreaterThan(0);
      const s = createNetServer();
      await listen(s, port);
      await close(s);
    }
  });

  it('fails fast with the server log when the preview child has exited', async () => {
    const started = Date.now();
    await expect(waitReady('http://127.0.0.1:1/api/health', { exited: () => 1, log: 'boom' })).rejects.toThrow(/boom/);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('rejects with the log when the budget runs out instead of proceeding silently', async () => {
    const port = await freePort();
    await expect(
      waitReady(`http://127.0.0.1:${port}/api/health`, { exited: () => null, log: () => 'still starting', budgetMs: 300 }),
    ).rejects.toThrow(/not ready after 300 ms[\s\S]*still starting/);
  });

  it('resolves once the health endpoint answers ok', async () => {
    const server: Server = createServer((_, res) => res.end('ok'));
    const port = await freePort();
    await listen(server, port);
    try {
      await expect(waitReady(`http://127.0.0.1:${port}/api/health`, { exited: () => null, log: '' })).resolves.toBeUndefined();
    } finally {
      await close(server);
    }
  });

  it('builds a strictPort vite preview command on the given port', () => {
    const args = previewArgs(4321);
    expect(args.slice(0, 3)).toEqual(['--import', 'tsx', 'node_modules/vite/bin/vite.js']);
    expect(args).toContain('--strictPort');
    expect(args[args.indexOf('--port') + 1]).toBe('4321');
    expect(args[args.indexOf('--config') + 1]).toBe('packages/game/vite.config.ts');
  });
});
