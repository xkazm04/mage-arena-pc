/** Console lines Chromium prints for a rejected GL call, e.g. "GL_INVALID_OPERATION: glUniform4f: ...". */
export const isGlInvalid = (text: string) => /GL_INVALID/.test(text);
/** The first offending line, or undefined when the console was clean. */
export const firstGlInvalid = (lines: readonly string[]) =>
  lines.find(isGlInvalid);
