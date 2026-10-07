import { readFileSync } from "node:fs";
import type { Tables } from "@mage/core";
export const designRoot = new URL(
  "../../../docs/design/reconciled/",
  import.meta.url,
);
export function loadTables(): Tables {
  const names = [
    "season",
    "death-reservation",
    "characters",
    "relationships",
    "facts",
    "schools",
    "rules",
    "intents",
    "goals",
    "phrases",
    "locations",
    "scenarios",
  ];
  return Object.fromEntries(
    names.map((name) => [
      name,
      JSON.parse(
        readFileSync(new URL(`data/${name}.json`, designRoot), "utf8"),
      ),
    ]),
  ) as unknown as Tables;
}
export function canonical(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value))
    return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map(
        (k) =>
          `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`,
      )
      .join(",")}}`;
  throw new Error("Non-JSON value cannot be hashed");
}
