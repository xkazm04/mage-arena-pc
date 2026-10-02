import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

interface Ledger {
  runs: Record<string, number>;
  days: Record<string, number>;
  reservations: { run: string; day: string; provider: string; key: string }[];
}
export class CostGuard {
  constructor(
    readonly path: string,
    readonly run: string,
    readonly provider: string,
    readonly runCap: number,
    readonly dayCap: number,
    readonly utcDay: () => string = () => new Date().toISOString().slice(0, 10),
  ) {
    if (![runCap, dayCap].every((n) => Number.isSafeInteger(n) && n >= 0))
      throw new Error("Invalid budget");
    mkdirSync(dirname(path), { recursive: true });
  }
  reserve(key: string): boolean {
    const lock = `${this.path}.lock`;
    let fd: number;
    // Fail closed on another process or stale lock; never silently reset a cost ledger.
    try {
      fd = openSync(lock, "wx");
    } catch {
      return false;
    }
    try {
      const ledger: Ledger = existsSync(this.path)
        ? (JSON.parse(readFileSync(this.path, "utf8")) as Ledger)
        : { runs: {}, days: {}, reservations: [] };
      if (!ledger.runs || !ledger.days || !Array.isArray(ledger.reservations))
        throw new Error("Invalid ledger");
      const day = `${this.provider}:${this.utcDay()}`,
        run = `${this.provider}:${this.run}`;
      const runCalls = ledger.runs[run] ?? 0,
        dayCalls = ledger.days[day] ?? 0;
      if (![runCalls, dayCalls].every((n) => Number.isSafeInteger(n) && n >= 0))
        throw new Error("Invalid counters");
      if (runCalls >= this.runCap || dayCalls >= this.dayCap) return false;
      ledger.runs[run] = runCalls + 1;
      ledger.days[day] = dayCalls + 1;
      ledger.reservations.push({ run, day, provider: this.provider, key });
      const temp = `${this.path}.${process.pid}.tmp`;
      writeFileSync(temp, JSON.stringify(ledger, null, 2));
      renameSync(temp, this.path);
      return true;
    } catch {
      return false;
    } finally {
      closeSync(fd);
      unlinkSync(lock);
    }
  }
}
