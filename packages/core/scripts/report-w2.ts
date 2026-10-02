import { mkdirSync, writeFileSync } from 'node:fs';
import { runTimingBot, runtime, type BotKind } from '../src/arena/index.ts';
const destination = new URL('../../../docs/waves/W2-evidence/', import.meta.url);
mkdirSync(destination, { recursive: true });
const policies = (['perfect', 'holder', 'never', 'late'] as BotKind[]).map(kind => runTimingBot(kind));
const sweep = runtime.training.windowSweepTicks.map(lead => runTimingBot('perfect', runtime.training.reportDurationS, lead));
const report = { label: 'simulated', command: 'npm --prefix packages/core run report:w2',
  methodology: 'Fixed-step stationary timing oracle versus front magic dummy; ranks from runtime data. Down HP reset solely to continue sampling, never mana. Mana returned is actual capped credit. Holder never releases after exhaustion. Lead ticks count impact age. No human-feel or filmed-latency claim.',
  policies, sweep, deterministic: policies[0]!.hash === runTimingBot('perfect').hash };
writeFileSync(new URL('bots.json', destination), JSON.stringify(report, null, 2) + '\n');
console.table(policies.map(({ kind, perfects, hits, manaDrained, manaReturned, downs, unlockSeconds }) => ({ kind, perfects, hits, manaDrained, manaReturned, downs, unlockSeconds: unlockSeconds.join(', ') })));
if (!report.deterministic || policies[0]!.perfectRate !== 1 || policies.slice(1).some(p => p.perfects !== 0)) throw Error('W2 bot gate failed');
console.log('W2 bot/determinism gate passed.');
