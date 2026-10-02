import {
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
import { CampNight } from "./camp-night.ts";
import { plan } from "./planner.ts";
import type { HarnessOptions } from "./harness.ts";

export type CampCommand =
  | { type: "travel"; place: string }
  | { type: "act"; action: string }
  | { type: "wait" | "listen" | "dawn" };
export class CampService {
  session: CampSession;
  job: CampNight | null = null;
  private dawn: Promise<void> | null = null;
  private input = { lane: 0, listening: false };
  constructor(
    readonly tables: Tables,
    readonly options: HarnessOptions,
    seed = 73,
  ) {
    this.session = createCampSession(tables, seed);
  }
  view() {
    return {
      ...campView(this.tables, this.session),
      settling: this.dawn !== null,
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
    if (revision !== this.session.revision || this.dawn)
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
        this.dawn = this.finish();
        try {
          await this.dawn;
        } finally {
          this.dawn = null;
        }
        break;
      }
      default:
        throw new Error("Unknown camp action.");
    }
    if (beforeSlot === "dusk" && this.session.slot === "night") {
      this.job = new CampNight(
        remainingCaps(this.tables, this.session),
        structuredClone(this.session.camp),
        this.options,
      );
    }
    return this.view();
  }
  private async finish() {
    const proposals = await this.job!.finish(campPlay.listening.graceMs);
    this.session = settleCamp(this.tables, this.session, proposals, (id) =>
      plan(this.tables, this.session.camp, id, true),
    );
  }
  close() {
    this.job?.close();
  }
}
