import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
  openSync,
  closeSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { canonical } from "./data.ts";
export function hash(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}
export class RequestCache {
  constructor(readonly directory: string) {
    mkdirSync(directory, { recursive: true });
  }
  get(request: unknown): unknown | undefined {
    const key = hash(request),
      path = join(this.directory, `${key}.json`);
    if (!existsSync(path)) return undefined;
    try {
      const record = JSON.parse(readFileSync(path, "utf8")) as {
        requestHash: string;
        output: unknown;
        outputHash: string;
      };
      return record.requestHash === key &&
        record.outputHash === hash(record.output)
        ? record.output
        : undefined;
    } catch {
      return undefined;
    }
  }
  put(request: unknown, output: unknown): boolean {
    const key = hash(request),
      path = join(this.directory, `${key}.json`),
      temp = `${path}.${process.pid}.tmp`;
    const lock = `${path}.lock`;
    let fd: number;
    try {
      fd = openSync(lock, "wx");
    } catch {
      return false;
    }
    try {
      // First valid response wins. A second live result cannot rewrite the past.
      if (this.get(request) !== undefined) return false;
      writeFileSync(
        temp,
        JSON.stringify({ requestHash: key, output, outputHash: hash(output) }),
      );
      renameSync(temp, path);
      return true;
    } catch {
      return false;
    } finally {
      closeSync(fd);
      unlinkSync(lock);
    }
  }
}
