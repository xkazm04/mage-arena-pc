# U2 — Covenant art wiring

2026-10-03. Presentation only; core, Director, geometry and save schema remain
unchanged. Read the full plan (especially j/m/n/o), OWNER-CHECKS, U1 report,
game source and the session-5 delivery/combined board before implementation.

Five commits: assets (including a real merge of art), UI, arena, camp, polish.
Resolve the shared plan/checklist with integration's content, preserving its
merged gameplay history and owner direction. Art's handoff remains in its own
files. Never write the art worktree or read art/raw.

Acceptance here means authorized integration, not owner approval. Preserve the
delivery's owner-review labels and provenance. Copy only A7, A5b/UI, A4c, A2c
and A3c manifest-listed files to assets/accepted/covenant, verify SHA-256 and
emit an individual sidecar plus a runtime index. Historical A2/A3/A4/A5 paths
are not runtime sources. Load failures must retain a playable procedural view.

The UI uses the exact 90-region atlas, Cinzel / Source Sans 3, clipped bars,
independent selection/focus, cursor hotspots and published motion durations.
Camp navigation uses delivery landmark anchors with game-owned opening slots.
Story illustrations are thematic accompaniments, never evidence of an event;
all copy and state remain supplied by the game. Portrait moods use explicit
game mood keys, otherwise neutral; never guess a character's identity.

Arena palette table: proving ground = verdigris; Games 1/2 = verdigris;
3/4 = rust-sand; 5/6 = moonlit. All three get explicit preview evidence without
unlocking unimplemented Games. Ground is world anchored and projected once.
A7 is a flattened scene, not a layered ground/prop delivery: record any derived
crop/occlusion limitations. Preserve exact code-owned ward and threat geometry.
A3c keys must pass pose, facing, painterly continuity and distant readability
before use. Otherwise use Covenant procedural figures, with a per-identity
decision table; no unsupported pose substitution or invented animation claims.

Validation: npm run gate at each commit; final production Playwright tour of
every screen at 1920x1080 and 2560x1440, ordinary input bout, save round trips,
failure injection, 100 visible moving projectiles, frame-time/heap/texture bytes,
deterministic replay and fresh 2,000 fights per wave. Store evidence in
docs/waves/U2-evidence. Authored layout/art, simulated fights, measured tests;
owner visual quality, sofa feel and G1 remain pending.
