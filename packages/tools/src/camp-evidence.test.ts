import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { it, expect } from "vitest";
import { campMornings } from "./camp-fixtures.ts";
it("replays the three saved camp mornings with exact effects, boards and traces", () => {
  const stored = JSON.parse(
    readFileSync("docs/waves/W5-evidence/golden-mornings.json", "utf8"),
  );
  expect(campMornings()).toEqual(stored);
  expect(
    stored[0].board.some((c: { text: string }) =>
      c.text.includes("bread to Fenna"),
    ),
  ).toBe(true);
  expect(
    stored[0].journal.some((f: { id: string }) => f.id === "K-nysa-bread"),
  ).toBe(true);
  expect(stored[1].player.gold).toBe(12);
  expect(stored[2].player.points.vigor).toBe(3);
});
it("all accepted textures have unchanged delivery hashes and provenance sidecars", () => {
  const manifest = JSON.parse(
    readFileSync("assets/accepted/camp/manifest.json", "utf8"),
  ) as {
    version: number;
    entries: Record<string, { path: string; sha256: string; sidecar: string }>;
  };
  expect(manifest.version).toBe(1);
  expect(Object.keys(manifest.entries)).toHaveLength(22);
  for (const entry of Object.values(manifest.entries)) {
    const bytes = readFileSync(entry.path.slice(1));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(entry.sha256);
    const sidecar = JSON.parse(readFileSync(entry.sidecar.slice(1), "utf8"));
    expect(sidecar.sha256).toBe(entry.sha256);
    expect(sidecar.authorization).toContain("third-session");
  }
});
