import { describe, expect, it } from "vitest";
import { firstGlInvalid, isGlInvalid } from "./gl-errors.ts";

describe("gl-errors", () => {
  it("matches any GL_INVALID_* console line", () => {
    expect(
      isGlInvalid(
        "[.WebGL-0x1] GL_INVALID_OPERATION: glUniform4f: Uniform size does not match uniform method.",
      ),
    ).toBe(true);
    expect(isGlInvalid("GL_INVALID_VALUE: glTexImage2D")).toBe(true);
    expect(isGlInvalid("Arena art: 3 pages late")).toBe(false);
  });
  it("returns the first offending line, undefined when clean", () => {
    expect(
      firstGlInvalid(["a", "GL_INVALID_ENUM: x", "GL_INVALID_OPERATION: y"]),
    ).toBe("GL_INVALID_ENUM: x");
    expect(firstGlInvalid(["a", "b"])).toBeUndefined();
  });
});
