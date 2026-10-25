// The one list of browser smoke suites behind `npm run smoke`. It sits on top of the suite files
// (it never edits them): what each one is, where its evidence lands, which port its preview claims,
// the env flags it reads, and whether it may run at all. registry.test.ts cross-checks it against the
// source tree, so a new suite cannot land unregistered and a DOM-era suite cannot pass as live.

export const SUITE_DIR = "packages/tools/src";

export type SuiteKind = "browser" | "tour" | "performance" | "audio" | "audit";

export interface SuiteEntry {
  id: string;
  file: string;
  kind: SuiteKind;
  /** canvas: drives the canvas UI through window.__ui; dom: drives HTML controls the game no longer renders. */
  surface: "canvas" | "dom" | "none";
  status: "live" | "retired";
  /** Why a retired suite is refused, naming the missing selector. */
  reason?: string;
  /** Makes provider calls that cost money; refused unless the operator passes --allow-paid. */
  paid: boolean;
  /** The --strictPort its own vite preview claims; null when it serves nothing. */
  port: number | null;
  /** Repo-relative evidence dir, or null when it only prints. */
  evidence: string | null;
  /** Record written on success, and on failure (null when a failure only throws). */
  pass: string | null;
  failure: string | null;
  /** Needs the built game (`npm run build:game`) before it runs. */
  needsBuild: boolean;
  /** Env the CLI sets for the child. */
  env?: Record<string, string>;
  /** Env flags / argv the suite also understands, for `smoke list`. */
  flags?: string[];
  /** package.json scripts that already run this file. */
  aliases: string[];
  summary: string;
}

type Spec = Omit<SuiteEntry, "kind" | "surface" | "status" | "paid" | "needsBuild" | "aliases" | "failure"> &
  Partial<Pick<SuiteEntry, "kind" | "surface" | "status" | "paid" | "needsBuild" | "aliases" | "failure">>;

const entry = (s: Spec): SuiteEntry => ({
  kind: "browser",
  surface: "canvas",
  status: "live",
  paid: false,
  needsBuild: true,
  aliases: [],
  failure: null,
  ...s,
});

const domEra = (selector: string) =>
  `DOM-era suite: drives ${selector}, which packages/game/src no longer renders (the camp is canvas-only)`;

export const REGISTRY: readonly SuiteEntry[] = [
  entry({ id: "u1", file: "u1-browser.ts", port: 4188, evidence: "docs/waves/U1-evidence", pass: "browser.json", failure: "browser-failure.json", aliases: ["smoke:u1"], summary: "U1 canvas camp tour" }),
  entry({ id: "u1-kit", file: "u1-kit-browser.ts", port: 4189, evidence: "docs/waves/U1-evidence", pass: "kit-loader.json", summary: "U1 synthetic atlas kit loader" }),
  entry({ id: "u2", file: "u2-browser.ts", port: 4188, evidence: "docs/waves/U2-evidence", pass: "browser.json", failure: "browser-failure.json", aliases: ["smoke:u2"], summary: "U2 canvas tour" }),
  entry({ id: "u2-art", file: "u2-art-browser.ts", port: 4189, evidence: "docs/waves/U2-evidence", pass: "art-browser.json", aliases: ["smoke:u2:art"], summary: "U2 art loading" }),
  entry({ id: "u3", file: "u3-browser.ts", kind: "tour", port: 4193, evidence: "docs/waves/U3-evidence", pass: "browser.json", failure: "browser-failure.json", flags: ["--quick (1080p only)"], aliases: ["smoke:u3"], summary: "U3 full canvas tour (the live tour)" }),
  entry({ id: "audio", file: "au4-browser.ts", kind: "audio", port: 4194, evidence: "docs/waves/AU4-evidence", pass: "browser.json", failure: "failure.json", aliases: ["smoke:audio"], summary: "AU4 audio in the browser" }),
  entry({ id: "u4", file: "u4-browser.ts", port: 4196, evidence: "docs/waves/U4-evidence", pass: "art-browser.json", failure: "art-browser-failure.json", aliases: ["smoke:u4"], summary: "U4 art + frame budget" }),
  entry({ id: "u4-tour", file: "u4-tour.ts", kind: "tour", port: 4193, evidence: "docs/waves/U4-evidence/tour", pass: "browser.json", failure: "browser-failure.json", aliases: ["smoke:u4"], summary: "U4 profile of the U3 tour (MAGE_EVIDENCE=U4)" }),
  entry({ id: "u4-audit", file: "u4-audit.ts", kind: "audit", surface: "none", port: null, needsBuild: false, evidence: "docs/waves/U4-evidence", pass: "audit.json", aliases: ["audit:u4"], summary: "U4 census/replay audit over recorded evidence" }),
  entry({ id: "u5", file: "u5-browser.ts", port: 4195, evidence: "docs/waves/U5-evidence", pass: "browser.json", summary: "U5 canvas checks + texture ceiling" }),
  entry({ id: "u6", file: "u6-browser.ts", port: 4197, evidence: "docs/waves/U6-evidence", pass: "browser.json", failure: "browser-failure.json", summary: "U6 canvas checks + frame budget" }),
  entry({ id: "u6-tour", file: "u6-tour.ts", kind: "tour", port: 4193, evidence: "docs/waves/U6-evidence/tour", pass: "browser.json", failure: "browser-failure.json", summary: "U6 tour (U3 clone)" }),
  entry({ id: "u6b", file: "u6b-browser.ts", port: 4199, evidence: "docs/waves/U6b-evidence", pass: "browser.json", failure: "browser-failure.json", summary: "U6b canvas checks" }),
  entry({ id: "u6b-audio", file: "u6b-audio.ts", kind: "audio", port: 4195, evidence: "docs/waves/U6b-evidence/audio-walk", pass: "browser.json", failure: "failure.json", summary: "U6b audio walk" }),
  entry({ id: "u6b-performance", file: "u6b-performance.ts", kind: "performance", port: 4196, evidence: "docs/waves/U6b-evidence/performance", pass: "browser.json", failure: "browser-failure.json", summary: "U6b frame/CPU budget" }),
  entry({ id: "u6c", file: "u6c-browser.ts", port: 4198, evidence: "docs/waves/U6c-evidence", pass: "browser.json", failure: "browser-failure.json", flags: ["U6C_COLLAPSE_ONLY=1"], summary: "U6c canvas checks" }),
  entry({ id: "u6c-performance", file: "u6c-performance.ts", kind: "performance", port: 4197, evidence: "docs/waves/U6c-evidence/performance", pass: "browser.json", failure: "browser-failure.json", summary: "U6c frame/CPU budget" }),
  entry({ id: "cf1", file: "cf1-browser.ts", port: 4195, evidence: "docs/waves/CF1-evidence", pass: "browser.json", flags: ["MAGE_EVIDENCE=CF1|CF2"], summary: "CF1 combat feel" }),
  entry({ id: "h1", file: "h1-browser.ts", port: 4198, evidence: "docs/waves/H1-evidence", pass: "browser.json", failure: "browser-failure.json", summary: "H1 canvas checks" }),
  entry({ id: "d3", file: "d3-widescreen-browser.ts", port: 4210, evidence: "docs/waves/D3-evidence", pass: "d3-widescreen.json", failure: "d3-failure.json", aliases: ["smoke:d3"], summary: "D3 widescreen layouts" }),
  entry({ id: "forecast", file: "forecast-browser.ts", kind: "performance", port: 4197, evidence: null, pass: null, flags: ["argv[2]: screenshot path"], summary: "Lab forecast worker + frame times (prints only)" }),
  entry({ id: "preload", file: "preload-browser.ts", port: 4199, evidence: null, pass: null, flags: ["argv[2]: out dir (default os.tmpdir()/mage-preload)"], aliases: ["smoke:preload"], summary: "Asset preload card, abort and hang" }),
  entry({ id: "camp", file: "camp-browser.ts", surface: "dom", status: "retired", reason: domEra("[data-place] / [data-visit] / [data-command]"), port: null, evidence: "docs/waves/W5-evidence", pass: "browser.json", flags: ["W7_EVIDENCE=1", "CAMP_URL"], summary: "W5 DOM camp" }),
  entry({ id: "parley", file: "parley-browser.ts", surface: "dom", status: "retired", reason: domEra("[data-parley-target] / [data-place] / #parley-text"), port: null, evidence: "docs/waves/W6-evidence", pass: "browser.json", flags: ["W7_EVIDENCE=1", "W7_OFFLINE", "CAMP_URL"], summary: "W6 DOM parley" }),
  entry({ id: "season", file: "season-browser.ts", surface: "dom", status: "retired", reason: domEra("#settings-dialog / [data-place] / [data-preset]"), port: null, evidence: "docs/waves/W7-evidence", pass: "season-browser.json", flags: ["CAMP_URL"], summary: "W7 DOM season route" }),
  entry({ id: "w7-scenes", file: "w7-scenes-browser.ts", surface: "dom", status: "retired", reason: domEra("#settings-dialog / #composition / [data-preset]"), port: null, evidence: "docs/waves/W7-evidence", pass: "scenes-browser.json", flags: ["--prepared-save", "CAMP_URL"], summary: "W7 DOM scenes" }),
  entry({ id: "w7-director", file: "w7-director-browser.ts", surface: "dom", status: "retired", reason: domEra("[data-place] / [data-visit] / [data-command]"), paid: true, env: { CAMP_DIRECTOR: "claude" }, port: 4180, evidence: "docs/waves/W7-evidence", pass: "director-browser.json", summary: "W7 live Director night (paid provider calls)" }),
];

export const suite = (id: string, registry: readonly SuiteEntry[] = REGISTRY): SuiteEntry | undefined =>
  registry.find((e) => e.id === id);

const SELECTOR_CALL = /(?<![\w$])(?:locator|waitForSelector|click|fill|check|hover|press|isVisible|textContent|innerText|getAttribute|selectOption|\$\$?eval|\$\$?)\(\s*(["'`])(.*?)\1/g;
const camel = (s: string) => s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/**
 * DOM locators a suite drives (`[data-x]`, `#id` inside a Playwright selector call) that the game
 * source never sets: `data-x` must appear literally or as `dataset.x`, `#id` as an `id = "id"`
 * assignment or `getElementById`. A canvas button `{ id: "x" }` is not a DOM id.
 */
export function deadLocators(source: string, gameSource: string): string[] {
  const dead: string[] = [];
  for (const [, , selector] of source.matchAll(SELECTOR_CALL)) {
    for (const [, attr] of selector!.matchAll(/\[(data-[a-z][a-z-]*)/g)) {
      const live = gameSource.includes(attr!) || gameSource.includes(`dataset.${camel(attr!.slice(5))}`);
      if (!live && !dead.includes(`[${attr}]`)) dead.push(`[${attr}]`);
    }
    for (const [, id] of selector!.matchAll(/#([a-z][\w-]*)/gi)) {
      const quoted = `["'\`]${id!.replace(/-/g, "\\-")}["'\`]`;
      const live = new RegExp(`\\bid\\s*=\\s*${quoted}|getElementById\\(\\s*${quoted}`).test(gameSource);
      if (!live && !dead.includes(`#${id}`)) dead.push(`#${id}`);
    }
  }
  return dead;
}
