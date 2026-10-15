import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Every literal the season shell can draw, read from the source the way the compiler does.
const literals = (file: string) => {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
  );
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    )
      found.push(node.text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
};

describe("camp text", () => {
  it("never shows a lost separator as a question mark", () => {
    // U3b shipped "The day is spent ? dawn awaits": a dash or middle dot lost to an encoding pass.
    const garbled = literals("packages/game/src/game-shell.ts").filter((t) =>
      /(^|\S) \?( |$)/.test(t),
    );
    expect(garbled).toEqual([]);
  });
});
