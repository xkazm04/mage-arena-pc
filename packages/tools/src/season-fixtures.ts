import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyBoutInput, boutHash, bridgeRules, trialTell, type BoutInput, type TrialStance } from '@mage/core';
import { idleInput, presets } from '@mage/core/arena';
import { CostGuard, loadTables, PlannerProvider, RequestCache, SeasonService } from '@mage/director';
import { SeasonPolicy } from './season-policy.ts';
export function fixtureService(seed = 73) {
  const dir = mkdtempSync(join(tmpdir(), 'mage-season-')), t = loadTables();
  const service: SeasonService = new SeasonService(t, {
    provider: new PlannerProvider(t, () => service.session.camp),
    cache: new RequestCache(join(dir, 'cache')), guard: new CostGuard(join(dir, 'ledger'), 'test', 'planner', 0, 0),
  }, seed);
  return service;
}
export async function campDay(service: SeasonService) {
  // Ordinary slot actions. Training at the Pit improves the Trial skill; travel is paid.
  if (service.session.slot === 'day') {
    if (service.session.location !== 'yard') await service.command({ type: 'travel', place: 'yard' }, service.session.revision);
    const train = service.view().actions.find(a => a.intent === 'TRAIN');
    await service.command(train ? { type: 'act', action: train.id } : { type: 'wait' }, service.session.revision);
  }
  if (service.session.slot === 'dusk') {
    await service.command({ type: 'travel', place: 'pit' }, service.session.revision);
    const train = service.view().actions.find(a => a.intent === 'TRAIN');
    await service.command(train ? { type: 'act', action: train.id } : { type: 'wait' }, service.session.revision);
  }
  await service.command({ type: 'wait' }, service.session.revision);
  await service.command({ type: 'dawn' }, service.session.revision);
}
export function trialPolicy(service: SeasonService) {
  service.seasonCommand({ type: 'trial' }, service.session.revision);
  while (service.progress.trial!.phase === 'active') {
    const tell = trialTell(service.session, service.progress.trial!);
    const stance = Object.entries(bridgeRules.trial.beats).find(([, value]) => value === tell)![0] as TrialStance;
    service.seasonCommand({ type: 'exchange', stance }, service.session.revision);
  }
  service.seasonCommand({ type: 'receive-trial' }, service.session.revision);
}
export function playBout(service: SeasonService, lose = false) {
  service.seasonCommand({ type: 'prepare', composition: presets[2]! }, service.session.revision);
  service.seasonCommand({ type: 'start' }, service.session.revision);
  const policy = new SeasonPolicy();
  while (service.progress.bout!.phase !== 'terminal') {
    const local = structuredClone(service.progress.bout!), entries: BoutInput[] = [];
    for (let i = 0; i < bridgeRules.limits.batchTicks && local.phase !== 'terminal'; i++) {
      const g = local.games!;
      const entry: BoutInput = g.phase === 'intermission' ? { type: 'advance', tick: g.state.tick } : { type: 'tick', tick: g.state.tick, input: lose ? idleInput() : policy.frame(g) };
      applyBoutInput(local, entry); entries.push(entry);
    }
    service.boutInputs(local.id, entries, boutHash(local));
  }
  service.seasonCommand({ type: 'receive' }, service.session.revision);
}
export async function fourteenDays(seed = 73) {
  const service = fixtureService(seed);
  while (service.session.camp.day <= 14) {
    const view = service.view();
    if (view.day.eve) {
      if (service.session.location !== 'yard') await service.command({ type: 'travel', place: 'yard' }, service.session.revision);
      const train = service.view().actions.find(a => a.intent === 'TRAIN');
      await service.command(train ? { type: 'act', action: train.id } : { type: 'wait' }, service.session.revision);
      await service.command({ type: 'travel', place: 'pit' }, service.session.revision);
      trialPolicy(service);
    } else if (view.day.games) playBout(service, view.day.day === 14);
    await campDay(service);
  }
  return service;
}
