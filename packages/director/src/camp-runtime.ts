import { SeasonService } from "./season-service.ts";
import { loadTables } from "./data.ts";
import { CostGuard } from "./budget.ts";
import { RequestCache } from "./cache.ts";
import { ClaudeProvider, OllamaProvider, PlannerProvider } from "./providers.ts";
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import config from "./config.json" with { type: "json" };
/** Provider names and budgets belong here, not in game UI or assets. */
export function createCampRuntime(mode: "local" | "offline" | "claude" = process.env.CAMP_DIRECTOR === 'claude' ? 'claude' : process.env.CAMP_DIRECTOR === 'local' ? 'local' : 'offline') {
  const tables = loadTables();
  const runtime = fileURLToPath(new URL('../../../.director-runtime/', import.meta.url));
  const cli = resolve(runtime, 'w7-cli'); mkdirSync(cli, { recursive: true });
  const service: SeasonService = new SeasonService(tables, {
    provider:
      mode === 'claude' ? new ClaudeProvider(cli) : mode === "local"
        ? new OllamaProvider()
        : new PlannerProvider(tables, () => service.session.camp),
    cache: new RequestCache(resolve(runtime, mode === 'claude' ? 'w7-cache' : 'camp-cache')),
    guard: new CostGuard(
      resolve(runtime, mode === 'claude' ? 'w7-ledger.json' : 'camp-ledger.json'),
      mode === 'claude' ? 'w7-integration-session' : 'camp-play',
      mode,
      mode === 'claude' ? 20 : config.budget.game.runCalls,
      mode === 'claude' ? 20 : config.budget.game.dayCalls,
    ),
  });
  return service;
}
