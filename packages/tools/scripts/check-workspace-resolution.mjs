// Guard: @mage/* must resolve to THIS checkout's packages/*, whatever node_modules links say.
// Reads the specifiers from the tsconfig paths and the vitest/vite aliases, and checks each
// lands inside the repo root. Fails loudly if node_modules/@mage/<x> realpaths outside the
// root while those entries are missing.
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, relative, resolve, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const NL = String.fromCharCode(10);
const SPECS = {
  "@mage/core": "packages/core/src/index.ts",
  "@mage/core/arena": "packages/core/src/arena/index.ts",
  "@mage/director": "packages/director/src/index.ts",
};
const PKGS = ["core", "director", "game", "tools"];

export const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const inside = (root, p) => {
  const r = relative(root, p);
  return r !== "" && !r.startsWith("..") && !isAbsolute(r);
};

function stripJsonc(t) {
  return t
    .split(NL)
    .filter((l) => !l.trim().startsWith("//"))
    .join(NL);
}

/** Resolved target (absolute) per specifier from a tsconfig's compilerOptions.paths. */
export function tsconfigPaths(root, file = "tsconfig.json") {
  const full = join(root, file);
  const paths = JSON.parse(stripJsonc(readFileSync(full, "utf8"))).compilerOptions?.paths ?? {};
  return Object.fromEntries(
    Object.entries(paths).map(([k, v]) => [k, resolve(dirname(full), v[0])]),
  );
}

/** Alias targets from a vitest/vite config source: each `find: /^@mage\/x$/ ... "path"` entry. */
export function aliasTargets(root, file = "vitest.config.ts") {
  const lines = readFileSync(join(root, file), "utf8").split(NL);
  const slash = String.fromCharCode(92) + "/";
  const out = {};
  for (const spec of Object.keys(SPECS)) {
    const needle = "^" + spec.split("/").join(slash) + "$/";
    const line = lines.find((l) => l.includes(needle));
    const m = line?.match(/local[(]"([^"]+)"/);
    if (m) out[spec] = resolve(root, m[1]);
  }
  return out;
}

export function linkRealpaths(root) {
  const out = {};
  for (const p of PKGS) {
    const link = join(root, "node_modules/@mage", p);
    if (existsSync(link)) out[p] = realpathSync(link);
  }
  return out;
}

/** Returns a list of problems; empty means the checkout resolves itself. */
export function check(root = defaultRoot) {
  const problems = [];
  const root0 = realpathSync(root);
  const ts = tsconfigPaths(root);
  const al = aliasTargets(root);
  for (const spec of Object.keys(SPECS)) {
    for (const [kind, map] of [["tsconfig paths", ts], ["vitest alias", al]]) {
      const t = map[spec];
      if (!t) problems.push(`${kind}: ${spec} is missing`);
      else if (!inside(root0, existsSync(t) ? realpathSync(t) : t)) problems.push(`${kind}: ${spec} -> ${t} is outside ${root0}`);
      else if (!existsSync(t)) problems.push(`${kind}: ${spec} -> ${t} does not exist`);
    }
  }
  const outside = Object.entries(linkRealpaths(root)).filter(([, r]) => !inside(root0, r));
  if (outside.length && problems.length)
    problems.push(
      `node_modules/@mage/{${outside.map(([p]) => p).join(",")}} realpath outside the repo root and the paths/alias entries do not cover it`,
    );
  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = check();
  if (problems.length) {
    console.error("workspace resolution FAILED:\n  " + problems.join("\n  "));
    process.exit(1);
  }
  console.log("workspace resolution ok: @mage/* resolve inside", defaultRoot);
}
