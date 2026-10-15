/** Per-frame CPU time by phase (ms), read through `__ui.performance().phases`. A few `performance.now()` calls a frame. */
const keep = 600;
export const phases: Record<string, number[]> = {};
let last = 0;
export function phaseStart(now = performance.now()) {
  last = now;
}
export function phase(name: string) {
  const now = performance.now(),
    list = (phases[name] ??= []);
  list.push(now - last);
  if (list.length > keep) list.shift();
  last = now;
}
export function resetPhases() {
  for (const k of Object.keys(phases)) delete phases[k];
}
