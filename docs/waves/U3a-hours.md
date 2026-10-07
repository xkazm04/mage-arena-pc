# U3a — hours are the camp clock

Authored, 2026-10-03. D25 supersedes the slot/travel wording in earlier waves.
The authoritative season table defines 14 waking hours, 08:00–22:00, dusk at
18:00 and night at 20:00. Travel is free. Each facility activity has a duration;
it must finish before closing and cannot cross the Trial appointment. Waiting
advances to the next phase boundary. The final two hours offer the night act.
Trials begin at 18:00 on Games eve and occupy two hours; Games begin at 08:00
and occupy four hours regardless of real-time combat duration.

NPC choices remain one main daily activity, resolved at night: their durations
must fit an opening interval, and the Director sees that schedule in hours.
Scarce-activity caps remain per day, shared with the player's activities.
Repeated player activities use distinct hour namespaces for facts. Contests retain
one seeded actor/action/day draw, so spending more hours does not reroll a contest.
The stored phase is derived from the hour, verified on load. Save version 2
explicitly rejects old slot saves. Arena simulation and census inputs stay fixed.

Measured: `npm run gate` passes (162 TypeScript tests, 11 reference tests,
zero contradictions). `node packages/tools/replay/cli.mjs generate` regenerates
all active golden/branch/hour fixtures; `npx tsx packages/tools/src/camp-fixtures-write.ts`
regenerates the W5 morning oracle. Historical paid W1/W6 transport evidence stays
byte-pinned, with explicit adapters for its old request shape; it is not new
hour-model inference evidence. The model sees numeric time facts only; D25
supersedes the older prohibition on all numbers in a request.

`npx tsx packages/tools/src/u3-replay.ts` runs the two-week route twice and checks
byte-identical version-2 envelopes and load/re-encode, including four Trial/Games
receipts. Evidence: `U3-evidence/replay-save.json`. No provider calls, new pacing
claim or human feel claim. The 2,000-fight-per-wave census sources are untouched;
the hour model changes camp policy timing, not the combat kernel. U3b follows.
