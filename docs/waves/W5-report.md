# W5 camp scenes

The uncommitted headless groundwork from session two is retained and now drives
a playable Pixi camp. Run `npm run camp`, then open `http://127.0.0.1:5173`.
Default play is offline. For local Director calls in PowerShell, set
`$env:CAMP_DIRECTOR='local'` before starting the server. This is a loopback
development app; the production client also builds, while packaged sidecar
distribution and durable saves remain later integration work.

## Delivered

- Six-week calendar, day/dusk/night slots, eight place nodes, opening hours,
  shortest-route costs, presence, legal activities and table-derived gain previews.
- Place backdrops, Hollow Board cards with unread/read/selected/rumour frames,
  private journal, keyboard and pointer controls, and scalable scenes.
- A listening act with three cover positions, changing voices, a patrol warning,
  held listening and a code-selected Knowing. Being exposed costs a fragment.
  Its authored duration is 450 ticks at 100 ms, nominally 45 seconds.
- The Director begins on dusk commit. Completed validated groups survive a slow
  neighbour. Dawn waits at most the authored grace, fills missing groups using
  the planner, aborts transport and ignores late results. The sidecar commits
  dawn once. The browser cannot submit ticks, outcomes or numeric effects.
- Read-only import of 22 hash-verified Tessera & Lime textures: map, eight
  backdrops, four frames and nine icons. Each has a provenance sidecar. Full
  original generation records are archived under `W5-evidence/art-provenance/`,
  keeping provider bookkeeping out of runtime assets. Historical owner-review
  flags are preserved; the third-session instruction authorizes this integration.
  The single loader falls back to drawn placeholders when delivery is missing.

## Measured gates

`npm run gate`: strict TypeScript, lint, 41 TypeScript tests and ten reference
replayer tests pass. The design checker reports zero contradictions in its
declared scope, with three W0 golden nights and 216 traced changes unchanged.
New coverage includes travel, opening times, legal/present targets, carried
feeding/work, cap use, stocks, secret projection, deterministic listening,
late transport, partial results, cache, budget denial, stale commands and one dawn.
A 42-day offline simulation finishes with valid ranges and unique fact IDs;
it is a camp-only simulation, not an arena/season balance claim.

`npm run build:game`: production browser bundle passes. `npx tsx
packages/tools/src/camp-fixtures-write.ts` generates three camp mornings;
`camp-evidence.test.ts` replays their state hashes, board/journal content, traces
and seeded rolls and verifies all delivery hashes and sidecars.

`npx tsx packages/tools/src/camp-browser.ts` against `npm run camp`: Playwright
captures at 1920×1080 and 2560×1440, scripted travel/training/slots, real-time
listening and its earned Knowing, refresh continuity, dawn, board/journal and
missing-art play. Evidence: `W5-evidence/browser.json` and `screens/`.

`npx tsx packages/tools/src/camp-local-night.ts`: one separately capped local
night, five live group calls, zero rejected intents, no subscription calls.
Measured listening act 48,590.56 ms (timer scheduling overhead included); four
groups complete during the act, all five by dawn, post-act wait 802.78 ms.
No missing groups needed planner completion in this sample. The first group
took 20,995.46 ms; this sample does not establish warm/cold latency percentiles.
See `W5-evidence/local-night.json`. Re-running uses its immutable cache and
retains the five-call ledger; it must not be relabelled a second live sample.

## Boundaries and observations

Art and rules are authored; outcomes and golden mornings are simulated; browser
checks and local latency are measured. Owner feel is not measured. The owner
still judges the reading experience, slot economy and listening difficulty.
The original W1 engineering PASS and its 4.73% rejection rate are not a claim
about a new full live soak of this camp UI.

The initial browser pass revealed that the canvas stayed at its logical size
at 1440p; resizing now changes the renderer viewport and scales the scene while
preserving pointer coordinates. Listening counters update without replacing
held controls. A browser rerun interrupted by development-server hot reload
is excluded; the final completed run is the retained browser gate.

Games and Tent Trials are calendar notices. No bout results, endings or death
mechanics are fabricated. Refresh preserves the current process session;
server restart loses it until W7 save/load. No art or arena branch edits, no push.
