import { mkdirSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { campPlay, listeningScene } from "@mage/core";
import {
  CampService,
  CostGuard,
  hash,
  loadTables,
  OllamaProvider,
  RequestCache,
} from "@mage/director";

// One capped local-only sample, separately charged from W1. Uses real elapsed act ticks.
const out = "docs/waves/W5-evidence";
mkdirSync(out, { recursive: true });
const service = new CampService(loadTables(), {
  provider: new OllamaProvider(),
  cache: new RequestCache(".director-runtime/w5-camp-cache"),
  guard: new CostGuard(
    ".director-runtime/w5-camp-ledger.json",
    "w5-live-night",
    "local",
    5,
    5,
  ),
});
const gaps: { afterTick: number; gapMs: number }[] = [];
const start = performance.now();
await service.command({ type: "wait" }, service.session.revision);
await service.command({ type: "wait" }, service.session.revision);
const started = performance.now();
await service.command({ type: "listen" }, service.session.revision);
let previous = Date.now();
await new Promise<void>((resolve) => {
  const timer = setInterval(() => {
    const now = Date.now();
    if (now - previous > 5000)
      gaps.push({
        afterTick: service.session.listening!.tick,
        gapMs: now - previous,
      });
    previous = now;
    const scene = listeningScene(service.session.listening!);
    service.control(
      scene.beacon,
      scene.beacon !== scene.patrol || scene.warning,
      service.session.camp.day,
    );
    service.tick();
    if (service.session.nightFinished) {
      clearInterval(timer);
      resolve();
    }
  }, campPlay.listening.tickMs);
});
const actEnd = performance.now();
const completedBeforeActEnd = service.job!.completed.size;
await service.command({ type: "dawn" }, service.session.revision);
const end = performance.now();
const report = {
  label: "measured",
  provider: "local",
  actMs: actEnd - started,
  postActWaitMs: end - actEnd,
  totalMs: end - start,
  completedBeforeActEnd,
  completedAtDawn: service.job!.completed.size,
  groups: service.job!.audit,
  plannerFilledMissingGroups: 5 - service.job!.completed.size,
  day: service.session.camp.day,
  afterHash: hash(service.session.camp),
  board: service.view().board,
  clockGaps: gaps,
  subscriptionCalls: 0,
};
writeFileSync(
  `${out}/local-night.json`,
  JSON.stringify(report, null, 2) + "\n",
);
service.close();
console.log(JSON.stringify(report));
