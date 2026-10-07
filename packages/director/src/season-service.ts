import { applyBoutInput, beginTrial, boutHash, bridgeRules, createSeason, exchangeTrial, prepareBout, receiveBout, receiveTrial, seasonDue, startBout, trialTell, type BoutInput, type SeasonProgress, type TrialStance } from '@mage/core';
import type { Composition } from '@mage/core/arena';
import { CampService, type CampCommand } from './camp-service.ts';
import type { ParleyInput } from './parley.ts';

export type SeasonCommand = { type: 'escort-trial' | 'trial' } | { type: 'exchange'; stance: TrialStance } | { type: 'receive-trial' } | { type: 'prepare'; composition: Composition } | { type: 'start' } | { type: 'receive' };
export class SeasonService extends CampService {
  progress: SeasonProgress = createSeason();
  paused = false;
  get locked() { return !!this.progress.bout || this.progress.trial?.phase === 'active'; }
  override tick() { if (!this.locked && !this.paused) super.tick(); }
  override view() {
    const view = super.view(), p = this.progress;
    return { ...view, season: {
      due: seasonDue(this.tables, this.session, p), locked: this.locked, paused: this.paused,
      scope: 'Weeks 1–2 · Water · Tiro Games',
      complete: this.session.camp.day > this.tables.season.daysPerWeek * bridgeRules.weeksPlayable,
      trial: p.trial ? { ...p.trial, tell: p.trial.phase === 'active' ? trialTell(this.session, p.trial) : null, rivalName: this.session.camp.characters[p.trial.rival].name, entrantName: p.trial.entrant ? this.session.camp.characters[p.trial.entrant].name : null } : null,
      bout: p.bout ? { id: p.bout.id, phase: p.bout.phase, spectator: p.bout.spectator } : null,
      receipts: p.receipts, renown: this.session.camp.characters[this.session.camp.player].renown,
      allies: Object.values(this.session.camp.characters).filter(c => c.role === 'main').map(c => ({ id: c.id, name: c.name, school: c.school, trust: this.session.camp.trust[`${c.id}>${this.session.camp.player}`] ?? 0 })),
    } };
  }
  private ready(revision: number) {
    if (revision !== this.session.revision || this.dawn || this.conversation || this.closed) throw Error('The season has moved on. Refresh this scene.');
  }
  override async command(command: CampCommand, revision: number) {
    this.ready(revision);
    if (this.locked || this.paused) throw Error('Return from the bout or resume first.');
    const due = seasonDue(this.tables, this.session, this.progress);
    if (due && command.type !== 'travel') throw Error(due === 'trial' ? 'The Tent Trial is waiting at the Pit.' : 'The Games must settle before this day continues.');
    if (this.view().season.complete) throw Error('The first two weeks are complete.');
    await super.command(command, revision); return this.view();
  }
  override async parley(input: ParleyInput, revision: number) {
    if (this.locked || this.paused || seasonDue(this.tables, this.session, this.progress)) throw Error('This moment must wait until after the bout.');
    await super.parley(input, revision); return this.view();
  }
  seasonCommand(command: SeasonCommand, revision: number) {
    this.ready(revision);
    if (!command || Object.keys(command).sort().join() !== (command.type === 'prepare' ? 'composition,type' : command.type === 'exchange' ? 'stance,type' : 'type')) throw Error('Invalid season command envelope.');
    if (this.paused) throw Error('Resume the season first.');
    const p = this.progress;
    switch (command.type) {
      case 'escort-trial':
        if (seasonDue(this.tables, this.session, p) !== 'trial' || this.locked) throw Error('No Trial summons.');
        this.session.location = this.tables.season.trialLocation;
        break;
      case 'trial': p.trial = beginTrial(this.tables, this.session, p); break;
      case 'exchange': if (!p.trial) throw Error('No Trial'); p.trial = exchangeTrial(this.tables, this.session, p.trial, command.stance); break;
      case 'receive-trial': this.session = receiveTrial(this.tables, this.session, p); this.startNight(); return this.view();
      case 'prepare': p.bout = prepareBout(this.tables, this.session, p, command.composition); p.composition = structuredClone(command.composition); break;
      case 'start': if (!p.bout) throw Error('No prepared bout'); startBout(p.bout); break;
      case 'receive': this.session = receiveBout(this.tables, this.session, p); return this.view();
      default: throw Error('Unknown season action');
    }
    this.session.revision++; return this.view();
  }
  boutInputs(id: string, entries: BoutInput[], expectedHash: string) {
    if (this.closed || this.paused || !this.progress.bout || this.progress.bout.id !== id || !Array.isArray(entries) || !entries.length || entries.length > bridgeRules.limits.batchTicks) throw Error('Invalid bout batch.');
    const next = structuredClone(this.progress.bout);
    for (const entry of entries) {
      if (!entry || Object.keys(entry).sort().join() !== (entry.type === 'tick' ? 'input,tick,type' : 'tick,type')) throw Error('Invalid input envelope.');
      applyBoutInput(next, entry);
    }
    if (boutHash(next) !== expectedHash) throw Error('Arena checkpoint mismatch.');
    this.progress.bout = next; this.session.revision++;
    return { hash: expectedHash, revision: this.session.revision };
  }
}
