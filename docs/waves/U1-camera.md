# U1 camera — design before implementation

Owner D17 supersedes the near/player-follow camera. Game presentation numbers
live in `packages/game/data/camera.json`; the art stream owns its independent
`art/scale-contract-v2.json`. Cross-check those on delivery, never modify the art
worktree. Keep the 55-degree ground projection, the 192 by 144 metre oval, all
combat geometry, openings and pacing untouched. Initial default figures were 4%
of screen height; the permitted view range is 3–4.5%. During U1-screens the art
v2 contract arrived: the nominal value is aligned to 3.75% (40.5px at 1080p,
54px at 1440p), 22.5 ground pixels/metre, the art's asymmetric normalized zone
[.16,.18,.84,.8], and .35-second time constant. The game data file owns runtime
values; no art worktree files were changed. No player zoom control is exposed.

Anchor the view on entry. A wide screen-space dead zone keeps it perfectly still
through ordinary movement. Outside it, exponentially approach the nearest edge
of the zone; a bounded presentation delta avoids jumps after tab suspension.
No recentering inside the zone. Resize preserves the world anchor. Pointer aim
is inverted from the current camera every simulation frame and after rendering.
Camera state never enters simulation, replay hashes or save envelopes.

Validation: projection/ground hit regression tests at both target resolutions,
dead-zone immobility, soft edge convergence, frame-rate independence, invalid
inputs, camera changes preserving state hashes; `npm run gate`. The final U1
browser route captures the new view and the unchanged 2,000-fight census is rerun.
Owner checks cover edge motion and distant silhouette readability, not yet felt.

Measured: `npm run gate` PASS, 147 TypeScript and ten reference tests; zero design contradictions. Census runs separately for final U1 evidence.
