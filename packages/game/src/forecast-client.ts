import type { CombatTuning, LabConfig } from "@mage/core/arena";
import { forecastPolicy, labConfigOf, type ForecastResult } from "./forecast-job.ts";
import type { ForecastCommand, ForecastMessage } from "./forecast.worker.ts";

export interface ForecastView {
  status: "idle" | "waiting" | "running" | "done" | "error";
  done: number;
  total: number;
  result?: ForecastResult;
  ms?: number;
  error?: string;
}
/** Main-thread side of the Lab forecast: debounces tuning changes, cancels stale runs, never touches simulation state. */
export class ForecastClient {
  view: ForecastView = { status: "idle", done: 0, total: 0 };
  private worker?: Worker;
  private timer?: ReturnType<typeof setTimeout>;
  private key = "";
  private id = 0;
  constructor(private changed: (view: ForecastView) => void) {}
  private set(view: ForecastView) {
    this.view = view;
    this.changed(view);
  }
  want(tuning: CombatTuning, setup: LabConfig) {
    const lab = labConfigOf(setup), key = JSON.stringify([tuning, lab]);
    if (key === this.key) return;
    this.key = key;
    const id = ++this.id;
    clearTimeout(this.timer);
    this.worker?.postMessage({ kind: "cancel" } satisfies ForecastCommand);
    this.set({ status: "waiting", done: 0, total: 0, result: this.view.result });
    this.timer = setTimeout(() => {
      this.worker ??= this.spawn();
      this.worker.postMessage({ kind: "run", request: { id, tuning: structuredClone(tuning), lab } } satisfies ForecastCommand);
    }, forecastPolicy.debounceMs);
  }
  private spawn() {
    const worker = new Worker(new URL("./forecast.worker.ts", import.meta.url), { type: "module" });
    worker.addEventListener("message", (e: MessageEvent<ForecastMessage>) => {
      const m = e.data;
      if (m.id !== this.id) return;
      if (m.kind === "progress") this.set({ status: "running", done: m.done, total: m.total, result: this.view.result });
      else if (m.kind === "done") this.set({ status: "done", done: 0, total: 0, result: m.result, ms: m.ms });
      else this.set({ status: "error", done: 0, total: 0, error: m.message });
    });
    worker.addEventListener("error", (e) => this.set({ status: "error", done: 0, total: 0, error: e.message }));
    return worker;
  }
  cancel() {
    clearTimeout(this.timer);
    this.id++;
    this.key = "";
    this.worker?.postMessage({ kind: "cancel" } satisfies ForecastCommand);
    this.view = { status: "idle", done: 0, total: 0, result: this.view.result };
  }
  dispose() {
    this.cancel();
    this.worker?.terminate();
    this.worker = undefined;
  }
}
