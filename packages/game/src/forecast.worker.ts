import { ForecastRunner, forecastPolicy, type ForecastRequest, type ForecastResult } from "./forecast-job.ts";

export type ForecastCommand = { kind: "run"; request: ForecastRequest } | { kind: "cancel" };
export type ForecastMessage =
  | { kind: "progress"; id: number; done: number; total: number }
  | { kind: "done"; id: number; result: ForecastResult; ms: number }
  | { kind: "error"; id: number; message: string };
/** Runs the pure forecast in time slices so a newer request (or cancel) preempts it between fights. */
const runner = new ForecastRunner();
let latest = 0;
const post = (m: ForecastMessage) => postMessage(m);
async function run(request: ForecastRequest) {
  const started = performance.now();
  let slice = started;
  try {
    const { total, steps } = runner.plan(request);
    for (;;) {
      if (request.id !== latest) return;
      const next = steps.next();
      if (next.done) return post({ kind: "done", id: request.id, result: next.value, ms: performance.now() - started });
      if (performance.now() - slice >= forecastPolicy.workerSliceMs) {
        post({ kind: "progress", id: request.id, done: next.value, total });
        await new Promise((r) => setTimeout(r, 0));
        slice = performance.now();
      }
    }
  } catch (e) {
    post({ kind: "error", id: request.id, message: String(e) });
  }
}
addEventListener("message", (e: MessageEvent<ForecastCommand>) => {
  if (e.data.kind === "cancel") latest = 0;
  else {
    latest = e.data.request.id;
    void run(e.data.request);
  }
});
