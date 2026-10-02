import { SeasonService } from "./season-service.ts";
import { loadTables } from "./data.ts";
import { CostGuard } from "./budget.ts";
import { RequestCache } from "./cache.ts";
import { OllamaProvider, PlannerProvider } from "./providers.ts";
import config from "./config.json" with { type: "json" };
/** Provider names and budgets belong here, not in game UI or assets. */
export function createCampRuntime(mode: "local" | "offline") {
  const tables = loadTables();
  const service: SeasonService = new SeasonService(tables, {
    provider:
      mode === "local"
        ? new OllamaProvider()
        : new PlannerProvider(tables, () => service.session.camp),
    cache: new RequestCache(".director-runtime/camp-cache"),
    guard: new CostGuard(
      ".director-runtime/camp-ledger.json",
      "camp-play",
      mode,
      config.budget.game.runCalls,
      config.budget.game.dayCalls,
    ),
  });
  return service;
}
