import { colours } from "./kit.ts";
import type { CanvasUI } from "./ui.ts";

/** Every kicker and heading size, colour and offset, in design units. The default values are today's scene header. */
export const headingSpec = {
  separator: "  /  ",
  kicker: {
    screen: { x: 96, y: 57, size: 24, colour: colours.gold },
    tag: { x: 0, y: 0, size: 16, colour: colours.muted },
    card: { x: 620, y: 410, size: 24, colour: colours.gold },
    note: { x: 112, y: 976, size: 24, colour: colours.muted },
  },
  title: { x: 96, y: 99, size: 58, colour: colours.text, width: 1550 },
  rule: { x: 96, y: 183, w: 1728 },
} as const;

export type KickerVariant = keyof typeof headingSpec.kicker;
export type HeadingVariant = "screen";
type Painter = Pick<CanvasUI, "text" | "line">;

/** The one casing rule (upper case) and the one separator: callers pass segments, never a joined string. */
export const kickerText = (segments: readonly string[]) =>
  segments.map((s) => s.toUpperCase()).join(headingSpec.separator);

/** Draws a kicker. `opts` places a tag, which has no home of its own, and gives it a school colour. */
export function drawKicker(
  ui: Pick<CanvasUI, "text">,
  segments: readonly string[],
  variant: KickerVariant = "screen",
  opts: { x?: number; y?: number; colour?: number } = {},
) {
  const v = headingSpec.kicker[variant];
  return ui.text(
    kickerText(segments),
    opts.x ?? v.x,
    opts.y ?? v.y,
    v.size,
    opts.colour ?? v.colour,
  );
}

/** Title, optional kicker above it and the rule below. */
export function drawHeading(
  ui: Painter,
  h: { title: string; kicker?: readonly string[]; variant?: HeadingVariant },
) {
  const t = headingSpec.title,
    r = headingSpec.rule;
  if (h.kicker?.length) drawKicker(ui, h.kicker, h.variant ?? "screen");
  ui.text(h.title, t.x, t.y, t.size, t.colour, t.width, true);
  ui.line(r.x, r.y, r.w);
}
