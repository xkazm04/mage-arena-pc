# W5 camp scenes - design before implementation

Build the season map and player day/dusk/night state machine headlessly first.
The existing eight-place table owns opening times and activities; rules.json
owns gains. New camp-play.json owns routes, travel/action budgets, presence and
the listening act. One activity ends a slot. Travel spends a visible budget;
waiting is always possible. Daytime effects resolve immediately, while daily
settlement runs exactly once at dawn. Warnings, feeding, reports, stocks and
scarce-action use carry into that settlement. Existing default night replay
must remain identical, including the pinned W1 experiment.

Director calls start when dusk is committed. A deterministic listening scene
lasts 45 seconds: move between cover, hold Listen at the conversation marker,
and avoid the patrol. Earn an existing, code-selected Knowing. Rest and other
night activities are shorter alternatives. Keep completed groups and validated
siblings; after an act ends allow the authored grace, then fill missing items
with the planner, cancel outstanding work and ignore late results. Only one
dawn can commit. All calls stay in the sidecar, local or offline, with a separate
durable gameplay ledger. Never invoke the subscription provider in the game.

The browser receives player-visible data, never full NPC knowledge. Hollow Board
cards show public/witnessed facts; secret Knowings live in a private journal.
PixiJS draws placeholder limewash, slate and terracotta shapes. Neither available
copy of the plan contains a concrete loader API, so establish the conservative
boundary here: only a versioned accepted-asset manifest under /assets/accepted/
may supply named camp textures, through one loader; absent art uses placeholders.
The third-session instruction authorizes read-only art delivery imports. Copy
the map, eight backdrops, board frames and selected interface icons with hashed
provenance sidecars; never modify the source worktree. Source manifests still
say owner-review: preserve that historical label and record the user's explicit
third-session approval as the integration authorization, without inventing a
new art review. No arena-kernel edits or invented bout results.
Trial and Games dates are calendar announcements; arena integration remains W7.

Gates: pure state/content tests, golden-morning snapshots, timeout/late-response
tests, full build/lint/design gate, Playwright scripted slots and screenshots,
and a measured local night behind the listening act. Commands and measured
results go in W5-report.md. Owner feel stays pending. API references checked:
[Pixi Application](https://pixijs.com/8.x/guides/components/application),
[Graphics](https://pixijs.com/8.x/guides/components/scene-objects/graphics),
[Vite](https://vite.dev/guide/), and
[Playwright](https://playwright.dev/docs/library).

## Third-session implementation decisions

The browser renders Pixi scenes and accessible HTML controls over them. The
loopback sidecar owns sessions, elapsed listening ticks, model calls and dawn.
Only a player projection crosses HTTP. Hidden NPC relationships, knowledge,
rolls and internal effect traces never reach the browser. Commands carry a
revision; repeated/stale commits fail, and dawn is single-flight. Listening
input is lane/hold only, never a client-supplied reward or tick count.

Default play uses authored planning; an explicit local mode starts serial group
calls at dusk's completion. The same partial-night coordinator validates each
completed group and pins cache entries. A deadline fills missing groups and
aborts outstanding transport; late results cannot alter dawn or cache. Existing
W1 night harness behavior and archived evidence remain unchanged. No additional
subscription calls. Refresh reconnects to the current in-memory session; durable
save/load belongs to W7. Calendar Games are announcements, not fabricated bouts.

Implementation review found that merely counting exposure allowed an always-
listening player to collect enough fragments during patrol warnings. An exposure
now costs one collected fragment (data-owned), once per continuous encounter;
the regression tests compare successful, idle and exposed routes. Player-visible
effect traces are limited to their own stats and relationships. Canvas resize
uses a scaled logical scene inside the actual renderer viewport, so the two
required display sizes retain readable text and correct pointer coordinates.
