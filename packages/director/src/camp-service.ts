import {
  applyParley,
  authoredParley,
  parleyMoments,
  parleyRules,
  seedParleyFacts,
  actCamp,
  beginListening,
  campActions,
  campPlay,
  campView,
  createCampSession,
  moveCamp,
  passSlot,
  remainingCaps,
  settleCamp,
  stepListening,
  type CampSession,
  type Tables,
} from "@mage/core";
import { CampNight, type NightCheckpoint } from "./camp-night.ts";
import { hash } from './cache.ts';
import { plan } from "./planner.ts";
import type { HarnessOptions } from "./harness.ts";
import {
  ParleyDirector,
  parleyInputProblem,
  parleyRequest,
  type ParleyInput,
  type ParleyOptions,
} from "./parley.ts";
import { OllamaProvider } from "./providers.ts";

export type CampCommand =
  | { type: "travel"; place: string }
  | { type: "act"; action: string }
  | { type: "wait" | "listen" | "dawn" };
export interface CampCheckpoint {
  session: CampSession;
  input: { lane: number; listening: boolean };
  night: NightCheckpoint | null;
  parleyAudit: CampService['parleyAudit'];
  pendingParley: { input: ParleyInput; key: string | null } | null;
  pendingDawn: boolean;
}
export class CampService {
  session: CampSession;
  job: CampNight | null = null;
  protected dawn: Promise<void> | null = null;
  protected conversation: Promise<void> | null = null;
  protected closed = false;
  private epoch = 0;
  private pendingParley: CampCheckpoint['pendingParley'] = null;
  readonly parleyDirector: ParleyDirector;
  readonly parleyAudit: {
    day: number;
    source: string;
    problem: string | null;
    key: string | null;
    replyReplaced: string | null;
  }[] = [];
  protected input = { lane: 0, listening: false };
  constructor(
    readonly tables: Tables,
    readonly options: HarnessOptions,
    seed = 73,
    parleyOptions?: ParleyOptions,
  ) {
    this.session = seedParleyFacts(createCampSession(tables, seed));
    this.parleyDirector = new ParleyDirector(
      parleyOptions ?? {
        cache: options.cache,
        guard: options.guard,
        transport:
          options.provider instanceof OllamaProvider
            ? options.provider
            : undefined,
      },
    );
  }
  view() {
    return {
      ...campView(this.tables, this.session),
      settling: this.dawn !== null,
      parley: {
        pending: this.conversation !== null,
        maxTextChars: parleyRules.maxTextChars,
        canType: Boolean(this.parleyDirector.options.transport),
        moments: parleyMoments(this.tables, this.session),
        last: this.session.parleys.length
          ? (() => {
              const last = this.session.parleys.at(-1)!;
              return {
                day: last.day,
                target: last.target,
                name: this.session.camp.characters[last.target].name,
                reply: last.reply,
                effect: last.effect,
                trustDelta: last.trustDelta,
                reason: last.reason,
                usedCard:
                  this.parleyAudit.at(-1)?.source.includes("card") ?? false,
                revealed:
                  this.session.camp.facts.find(
                    (f) => f.id === last.revealedFact,
                  )?.text ?? null,
              };
            })()
          : null,
      },
    };
  }
  control(lane: number, listening: boolean, day: number) {
    if (
      day !== this.session.camp.day ||
      !this.session.listening ||
      this.session.nightFinished
    )
      throw new Error("This listening act has ended.");
    if (
      !Number.isInteger(lane) ||
      lane < 0 ||
      lane >= campPlay.listening.lanes ||
      typeof listening !== "boolean"
    )
      throw new Error("Invalid listening input.");
    this.input = { lane, listening };
  }
  tick() {
    if (!this.dawn && this.session.listening && !this.session.nightFinished)
      this.session = stepListening(this.session, this.input);
  }
  async command(command: CampCommand, revision: number) {
    if (
      revision !== this.session.revision ||
      this.dawn ||
      this.conversation ||
      this.closed
    )
      throw new Error("The camp has moved on. Try again.");
    const beforeSlot = this.session.slot;
    switch (command.type) {
      case "travel":
        this.session = moveCamp(this.tables, this.session, command.place);
        break;
      case "act": {
        const action = campActions(this.tables, this.session).find(
          (a) => a.id === command.action,
        );
        if (!action) throw new Error("That activity is no longer available.");
        this.session = actCamp(this.tables, this.session, action.decision);
        break;
      }
      case "wait":
        this.session = passSlot(this.session);
        break;
      case "listen":
        this.session = beginListening(this.session);
        this.input = { lane: 0, listening: false };
        break;
      case "dawn": {
        if (!this.session.nightFinished || !this.job)
          throw new Error("Finish your night act first.");
        const pending = this.finish();
        this.dawn = pending;
        try {
          await this.dawn;
        } finally {
          if (this.dawn === pending) this.dawn = null;
        }
        break;
      }
      default:
        throw new Error("Unknown camp action.");
    }
    if (beforeSlot === "dusk" && this.session.slot === "night")
      this.startNight();
    return this.view();
  }
  protected startNight() {
    this.job = new CampNight(
      remainingCaps(this.tables, this.session),
      structuredClone(this.session.camp),
      this.options,
    );
  }
  async parley(input: ParleyInput, revision: number) {
    if (
      revision !== this.session.revision ||
      this.dawn ||
      this.conversation ||
      this.closed
    )
      throw new Error("The camp has moved on. Try again.");
    const problem = parleyInputProblem(this.tables, this.session, input);
    if (problem) throw new Error(problem);
    const pending = this.speak(input);
    this.conversation = pending;
    try {
      await this.conversation;
    } finally {
      if (this.conversation === pending) this.conversation = null;
    }
    return this.view();
  }
  private async speak(input: ParleyInput) {
    const epoch = this.epoch, transport = this.parleyDirector.options.transport;
    this.pendingParley = { input: structuredClone(input), key: input.text && transport ? hash(parleyRequest(this.session, input.target, input.text, transport.model, transport.options)) : null };
    const beforeSlot = this.session.slot;
    const result = await this.parleyDirector.speak(
      this.tables,
      structuredClone(this.session),
      input,
    );
    if (this.closed || epoch !== this.epoch) return;
    this.pendingParley = null;
    this.session = applyParley(
      this.tables,
      this.session,
      input.target,
      result.proposal,
    );
    this.parleyAudit.push({
      day: this.session.camp.day,
      source: result.source,
      problem: result.problem,
      key: result.key,
      replyReplaced: result.replyReplaced,
    });
    if (beforeSlot === "dusk" && this.session.slot === "night")
      this.startNight();
  }
  private async finish() {
    const epoch = this.epoch;
    const proposals = await this.job!.finish(campPlay.listening.graceMs);
    if (this.closed || epoch !== this.epoch) return;
    this.settle(proposals);
  }
  private settle(proposals: import('@mage/core').Decision[]) {
    this.session = settleCamp(
      this.tables,
      this.session,
      proposals,
      (id) => plan(this.tables, this.session.camp, id, true),
      (id) =>
        plan(
          this.tables,
          this.session.camp,
          id,
          true,
          undefined,
          (d) =>
            d.args.target === this.session.camp.player &&
            parleyRules.friendlyIntents.includes(d.intent),
        ),
    );
  }
  /** Freeze transport, never refund paid reservations. The original run and a loaded
   * copy resume the same authored fallback for work not complete at this boundary. */
  checkpointCamp(): CampCheckpoint {
    const checkpoint = structuredClone({ session: this.session, input: this.input, night: this.job?.checkpoint() ?? null, parleyAudit: this.parleyAudit, pendingParley: this.pendingParley, pendingDawn: this.dawn !== null });
    this.restoreCamp(checkpoint);
    return checkpoint;
  }
  restoreCamp(checkpoint: CampCheckpoint) {
    this.epoch++; this.job?.close(); this.parleyDirector.close();
    this.dawn = null; this.conversation = null; this.pendingParley = null;
    this.session = structuredClone(checkpoint.session); this.input = { ...checkpoint.input };
    this.parleyAudit.splice(0, this.parleyAudit.length, ...structuredClone(checkpoint.parleyAudit));
    const night = checkpoint.night;
    this.job = night ? new CampNight({ ...this.tables, rules: { ...this.tables.rules, caps: night.caps } }, structuredClone(night.state), this.options, night) : null;
    if (checkpoint.pendingParley) {
      const pending = checkpoint.pendingParley, oldSlot = this.session.slot;
      this.session = applyParley(this.tables, this.session, pending.input.target, authoredParley(this.session, pending.input.target, pending.input.cardId));
      this.parleyAudit.push({ day: this.session.camp.day, source: 'checkpoint-card', problem: 'unfinished-at-checkpoint', key: pending.key, replyReplaced: null });
      if (oldSlot === 'dusk' && this.session.slot === 'night' && !this.job) {
        // The fallback crosses dusk. A restored checkpoint never initiates inference.
        const tables = remainingCaps(this.tables, this.session), state = structuredClone(this.session.camp);
        this.job = new CampNight(tables, state, this.options, { state, caps: tables.rules.caps, completed: [], audit: [], requests: [] });
      }
    }
    if (checkpoint.pendingDawn) this.settle(night?.completed.flatMap(g => g.items) ?? []);
  }
  close() {
    this.closed = true;
    this.parleyDirector.close();
    this.job?.close();
  }
}
