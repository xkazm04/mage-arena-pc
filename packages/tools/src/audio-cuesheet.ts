// npm run audio:cuesheet -- [--seed 7] [--player water] [--opponent fire] [--json] [--out file]
// The owner listening pass's script: one seeded Lab duel's cues, each admitted or dropped by the
// live audio policy, with the reason. Offline and deterministic; it never plays audio.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { schools, type School } from "@mage/core/arena";
import { validateAudioManifest } from "../../game/src/audio-policy.ts";
import { boutCueSheet, formatCueSheet } from "../../game/src/audio-cuesheet.ts";

const args = process.argv.slice(2),
  flag = (name: string) => {
    const i = args.indexOf(`--${name}`);
    return i < 0 ? undefined : args[i + 1];
  },
  school = (name: string): School | undefined => {
    const v = flag(name);
    if (v !== undefined && !schools.includes(v as School))
      throw Error(`--${name} must be one of ${schools.join(", ")}`);
    return v as School | undefined;
  },
  seed = Number(flag("seed") ?? 7);
if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
  throw Error("--seed must be an unsigned 32-bit integer");
const manifest = validateAudioManifest(
    JSON.parse(
      readFileSync(
        fileURLToPath(
          new URL("../../game/public/audio/manifest.json", import.meta.url),
        ),
        "utf8",
      ),
    ),
  ),
  result = boutCueSheet(seed, manifest, {
    player: school("player"),
    opponent: school("opponent"),
  }),
  text = args.includes("--json")
    ? JSON.stringify(result, null, 2) + "\n"
    : formatCueSheet(result),
  out = flag("out");
if (out) writeFileSync(out, text);
else process.stdout.write(text);
