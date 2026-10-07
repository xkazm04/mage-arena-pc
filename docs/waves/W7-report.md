# W7 integration report

**Implementation and automated gates PASS. G1 remains open for the owner.**
Windows browser, Water/Cassia, days 1-14; day 15 closes this
chapter. Fire, Earth and Air remain camp allies. Both Games use Tiro, with Water
mage opponents. Higher schools, Games tiers and season endings remain later waves.

The integration branch began at `ff99607` and merged arena
`68a4d68d315856c89339d331ac0db7f4784d566f`. The eight measured conflicts were resolved
as prescribed, preserving both entry modules and their owned lifecycles. There is
one root lock and dependency graph, one reconciled camp/arena data authority, and
the original 55-degree, 192x144 m, near-1.2 camera contract.

## Measured gates

| Gate | Command (repository root) | Result / evidence |
|---|---|---|
| Build, lint, tests, design contradictions | `npm run gate` | PASS: 144 TypeScript and ten reference tests; zero contradictions |
| Production bundle | `npm run build:game` | PASS; menu, camp and arena included |
| Package compatibility | `npm --prefix packages/core run build`, `npm --prefix packages/game run build`, corresponding `run test` | PASS: core 54 and game 13 tests; game has a separate unit-test config so tests do not start the HTTP sidecar |
| W2 timing/determinism | `npm --prefix packages/core run report:w2 -- W7-evidence/controls` | [PASS](W7-evidence/controls/bots.json) |
| W3 catalog/curves | `npm --prefix packages/core run report:w3 -- W7-evidence/water` | [PASS](W7-evidence/water/water-curves.json) |
| W4 census | `npm --prefix packages/core run report:w4 -- --evidence W7-evidence --tag integrated-census` | [PASS, 2,000 fights per wave](W7-evidence/integrated-census.json) |
| Competence and complete Games fixture | `npm --prefix packages/core run report:w4:ladder -- W7-evidence` | [PASS; selected seed 4](W7-evidence/competence-ladder.json); separate from the unbiased census |
| Native controls / composition / Games | `npm --prefix packages/game run smoke -- W7-evidence/controls`, `smoke:w3 -- W7-evidence/water`, `smoke:w4 -- W7-evidence/games` | [Controls](W7-evidence/controls/browser.json), [Water](W7-evidence/water/browser.json), [Games](W7-evidence/games/browser.json) PASS |
| Camera, aim, fallback, performance | `npm --prefix packages/game run smoke:w4b -- W7-evidence/camera` | [PASS](W7-evidence/camera/browser.json): 32 native pointer hits; 100 visible moving projectiles at both resolutions; about 60 fps; CPU p95 1.4/1.3 ms against 8 ms |
| Weeks 1-2 through production UI | `CAMP_URL=http://127.0.0.1:4181` then `npx tsx packages/tools/src/season-browser.ts` | [PASS](W7-evidence/season-browser.json), 1080p and 1440p, four real receipts, champion and ordinary-damage missio, save/load in camp/combat/after settlement, no page errors |
| Existing camp and Parley regressions | `W7_EVIDENCE=1`, `CAMP_URL` as above, `npx tsx packages/tools/src/camp-browser.ts`; additionally `W7_OFFLINE=1` for `parley-browser.ts` | [Camp](W7-evidence/camp/browser.json) and [offline Parley](W7-evidence/parley/browser.json) PASS; typed fallback and cards, zero new provider reservations |
| Byte-exact replay and save | `npx tsx packages/tools/src/w7-replay.ts` | [PASS](W7-evidence/replay-save.json): seed 73 and identical inputs produce the same 1,296,151-byte envelope; reloaded envelope is byte-identical |
| Pending/save failure matrix | `npx vitest run packages/tools/src/save.test.ts` | [Seven tests PASS](W7-evidence/save-tests.json): listening, pending Parley/dawn, partial Director results, arena phases, rewards, corruption, previous-good recovery, no duplicate paid work |
| Repeated scene ownership | `npx tsx packages/tools/src/w7-scenes-browser.ts` | [PASS](W7-evidence/scenes-browser.json): six composer cancellations, eight arena remounts, one bout identity and one Trial receipt |
| Prepared-save presentation | `npx tsx packages/tools/src/w7-scenes-browser.ts --prepared-save` | [PASS](W7-evidence/scenes-prepared-save.json): loaded entrant at tick zero, paused, then resumes normally |
| 30-minute soak | `npx tsx packages/tools/src/w7-soak.ts 30` | [PASS](W7-evidence/soak.json): 1,800,083 ms, 60 cycles/days, four complete seasons plus four days; 5.0-7.3 MiB retained browser heap; zero errors or added paid calls |
| Numeric/camera preservation | `npx tsx packages/tools/src/w7-authorities.ts` | [PASS](W7-evidence/data-authorities.json): pinned combat/stats/spells/tiers and camera bytes preserved; every enemy numeric field unchanged |

The environment assignments in the table describe inputs, not PowerShell syntax.
Use `$env:CAMP_URL = 'http://127.0.0.1:4181'`, `$env:W7_EVIDENCE = '1'`, and
`$env:W7_OFFLINE = '1'` as appropriate. Browser runs use a separately running
production preview. The smoke scripts launch and close their own preview servers.

## Pacing correction

| Wave | Original median | Original band | Final median |
|---|---:|---:|---:|
| Soldiers | 44.383 s | 25-40 s | **38.233 s** |
| Creatures | 45.550 s | 30-45 s | **44.633 s** |
| Semifinal | 45.483 s | 45-70 s | **45.483 s** |
| Final | 58.000 s | 45-80 s | **58.000 s** |

Each median includes wins and losses; every seed and tail is retained. There are
zero timeouts, early Downs, invalid states or sampled replay failures. Creature
pacing remains close to the upper limit. No target band, enemy HP, spell damage,
reference-controller stat, camera or oval size was changed to secure this result.

The closer separated opening cells expose the slingers and maw earlier. Slingers
approach their authored firing band, plant to fire/reload, and retreat when crowded;
they no longer circle indefinitely. The closest two hounds engage rather than
distant spawn IDs reserving those slots. Conscripts use the shared stamina-costed
sprint while approaching, with unchanged kernel resource rules. The
[single execution note](W7-execution.md) records every candidate, including the
failed full census at 40.65 s for soldiers. LF attributes preserve the promoted
source bytes on Windows; the final census was rerun after that correction and
produced identical fight digests.

## Director, saves and art

**Seven of twenty** Claude CLI Sonnet 5.5 medium reservations were used in this
session, all recorded in the [ledger](W7-evidence/director-ledger.json). Five live
groups supplied the [initial sample](W7-evidence/director-night.json); the first
browser night reused three and obtained two further live groups. A new driver wait
advanced too early and failed twice; its explicit server-state polling correction
completed the [browser night from validated cache](W7-evidence/director-browser.json)
without further calls. [All attempts](W7-evidence/director-browser-attempts.json)
are disclosed. All bulk runs used the offline planner. No live local-model typing
claim is made by the offline Parley browser gate.

The optional CLI runtime shares the same fixed ledger and cap as the sample tools;
server restarts and save/load cannot reset it. The default build works offline.
Snapshots freeze unfinished inference to the authored card/planner boundary,
preserve completed groups and request keys, and ignore late completions. Arena
references are saved as IDs and independently replayed before load or reward.
Save files are bounded, versioned, source-checked and atomically replaced with a
previous-good recovery slot. A discovered live/history alias was fixed with
independent camp history and last-resolution snapshots. Extra malformed-save probes
found and fixed invalid pending actions, duplicated character identities and
entrant/camp mismatches. Fallback settlement is staged in an isolated service
before any live state is replaced. The successful first soak is retained
[separately](W7-evidence/soak-before-validation-hardening.json); final fingerprints,
replay, browser evidence and soak were refreshed after that hardening. The final
soak and exact-byte replay use the same source fingerprint, recorded in both JSON
artifacts. The soak combines a measured production-browser lifecycle run with
simulated ordinary season inputs; it is not a human play session.

Accepted A4/A5 camp assets retain their hashes. A1b provides the confirmed camera
and ground reference; its proof contains figures and is not a clean floor texture,
so the ground remains procedural. Both art loaders retain playable procedural
fallbacks. The 120 discarded A2 delivery/review files and portrait images were
removed from the current tree and remain in Git history. No A3 figures are loaded,
and no replacement portraits or figures are represented as accepted art.

## Owner handoff

Open [OWNER-CHECKS.md](../OWNER-CHECKS.md) for exact Windows build/run instructions
and the first-two-week G1 route. The [screenshot gallery](W7-evidence/index.html)
provides native-size evidence at both resolutions.

Five local sub-waves: merge `53b49b5`, season `c9168a1`, pacing `8ac55e6`, save/load
`6ddc5f3`, and the final soak/handoff commit containing this report. The fifth
commit also contains the save-validation and scene-cleanup fixes discovered by
the final gate work. The test-created local save slot was reset to day 1 for handoff.

G1, human pacing, camera/aim comfort, physical input latency and desire to continue
remain owner judgments. The executing agent has not performed the independent
orchestrator rerun or dispatched the separate G1 review. No push was made.
