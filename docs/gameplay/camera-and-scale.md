# Camera and scale

Purpose: defines the arena camera, figure size, arena geometry and readability minimums that every combat mechanic and sprite is authored against.
Status: built (W4b, U1 camera, U5). Values are authored in the scale contract and measured in browser captures; camera comfort and motion readability are not owner-felt. Owner confirmed the camera angle and framing direction on 2026-10-02 (`art/CAMERA-OK.md`, D11, D17).

## Contract

Sources: `data/presentation/scale-contract-v3.json` (art authority, from `art/scale-contract-v3.json`), `data/presentation/camera.json` (game runtime authority, from `packages/game/data/camera.json`).

| Property | Value | Notes |
|---|---|---|
| Projection | Orthographic ground plane; upright billboard figures | Figures are never foreshortened or laid flat (except corpses) |
| Camera elevation | 55° above the ground | Allowed range 45–60°; never 90° top-down |
| Ground scale at 1080p | 22.5 px per metre (X); Y = X × sin 55° ≈ 18.4 px/m | `camera.json` stores 30 px/m × fixed zoom 0.75 = 22.5 |
| Resolution scale | viewport height / 1080 | Reference 1920×1080, second target 2560×1440 |
| Visible ground at 1080p | ≈ 85 m × 59 m | width / 22.5, height / 18.4 |
| Player zoom control | none (zoom fixed) | |
| Figure height (head to sole) | 5.625% of viewport height: 60.75 px at 1080p, 81 px at 1440p | Allowed 4.5–6.75%; nominal body 1.8 m; draw multiplier 1.5 (D32) |
| Playable arena | Ellipse 94 × 62 m, centre (16, 10) m | U5; decorative pylons are not obstacles |
| Arena painting | 102.4 × 70.32 m, 2304 × 1296 px at 1080p, offset [0, −52] m | Three palette plates (A12) |
| Minimum opening separation | 6 m between combatant centres | Close combat may close the gap |
| Telegraph minimum ground diameter | 6 m (advisory outer locator, not the hitbox) | |
| Minimum telegraph outline | 4.5 px at 1080p | |
| Minimum projectile core | 6 px at 1080p | |
| Ward visual radius | 3.6 m, 140° arc, 220° open rear | Visual only; the game owns ward balance |

## Camera behaviour (D17)

- The view is anchored on bout entry at the arena centre.
- A wide screen-space **dead zone** `[0.16, 0.18, 0.84, 0.80]` (normalized left, top, right, bottom). While the player stays inside it, the camera does not move.
- Outside the dead zone the camera eases toward the nearest zone edge: response 2.857 per second (time constant 0.35 s); frame delta bounded to 0.05 s to avoid jumps after tab suspension.
- The camera is clamped to the painting coverage (16:9 centre range X 7.47–24.53 m, Y 4.14–15.86 m). Other aspect ratios show a quiet matte where the painting ends.
- Camera state never enters the simulation, replay hashes or saves.
- Resize keeps the world anchor. Pointer aim is re-inverted from the current camera each frame (see [controls-and-input.md](controls-and-input.md)).

## Rendering rules that matter for gameplay

- Figures are depth-sorted by interpolated foot position, then actor ID. Painted occluders have baselines; figures can pass behind them.
- Ground marks (telegraphs, sigils, ward) are drawn in ground space and projected once. They never scale with the 1.5× character draw multiplier.
- **Damage shapes are exact data geometry.** A larger dotted locator may be drawn around small threats for readability; it never enlarges the hit test.
- Painted sigils (A13) are a skin over data geometry. Their pigment envelope is checked against the authored ring, cone and lane boundaries (coverage scale ring 1.12, cone 1.04, lane 1.3 × 1.8; tolerance 2 texels + 3%). Source: `data/presentation/sigils.json`.

## Superseded

| Version | Camera / scale | Arena | Why replaced |
|---|---|---|---|
| A1 proofs | Close camera, large figures | — | D11: too close to play |
| W4b (scale v1) | "Near" zoom 1.2, 36 px/m, figure 6% (64.8 px), player-follow camera | 192 × 144 m oval, centre (16, 62) | D17: owner wanted more distance and a mostly fixed camera |
| U1 (scale v2) | 22.5 px/m, figure 3.75% (40.5 px), dead zone + edge follow | 192 × 144 m oval | D32: figures too small |
| U5 (scale v3, current) | 22.5 px/m, figure 5.625% (60.75 px) | 94 × 62 m ellipse, centre (16, 10) | — |

The owner-check text for U1 still says "nominal figure 3.75%"; that is historical.

## Open

- The large HUD can cover the southern arena rim; actors there can pass under it.
- The camera cannot follow beyond the painting edge.
- Readability of silhouettes and telegraphs while the camera eases, and comfort of aiming at feet: owner checks pending.
