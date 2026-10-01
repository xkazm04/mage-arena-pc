# W2 — arena kernel design note

Status: design recorded before implementation, 2026-10-01. Scope is the current plan W2; D4/D5 supersede the baseline's gamepad/JVM instructions. No director or art changes, no root workspace configuration. The baseline report and Fable verdict were read; executable evidence is generated, never hand-authored as a claimed result.

## Authority and decisions

- `docs/design/baseline-fourteen-nights/design/data/combat.json` owns combat constants; `spells-water.csv` owns Rain Needle, including its **zero** cast time. The cast state machine still supports delayed casts. `stats.csv` owns rank-derived maxima and regeneration. No baseline file is copied into a second editable authority.
- A deterministic data compiler produces an ignored TypeScript module from those sources. Missing geometry, training scenarios and harness settings live in `packages/core/src/arena/data/runtime.json`, explicitly authored. Combat's `tierClock.perfectAbsorbAdvanceS` is the authority for clock reward; its duplicate in `absorb.perfect` is consistency-checked. Nerve formulas in stats and combat must agree.
- Fixed integer ticks at the data's step rate. Inclusive perfect boundary: impact tick minus fresh raise tick <= window ticks; release lockout rounds up. A held ward never refreshes its timestamp. Exhaustion latches until release, preventing automatic re-raises from regeneration. Regeneration continues during absorb; both gross drain and returns are reported.
- Mouse aim is always active, movement never supplies aim when a valid cursor direction exists. Absolute input frame: move vector, world aim point, selected slot, cast/absorb/roll/sprint. Roll is rising-edge triggered and uses movement, then aim. Number keys/wheel select; left casts; right wards; Space rolls; Shift sprints. Focus loss clears inputs; menu pauses simulation.
- Simulation order: tick, resource/status updates, inputs/ward edges, movement, cast completion/new casts, projectiles and impact resolution, deferred cleanup, tier unlock. Stable actor/activation order, activation-local hit sets, swept projectile collision. Core has no DOM, system time, random source or rendering dependency. Seeded draws include purpose and tick in the state log.
- A perfect absorbs magic inside the arc only. Physical uses ordinary reduction; unblockables ignore it. Invulnerable rolling avoids hits. Down actors stop acting. Staff attacks at close range use combat data and interrupt cast windups. Collar progression is per actor and respects minimum spacing even with accumulated perfect credit.
- Separate package manifests/configs for core and game keep this branch runnable before the core stream merges. Arena exports live under `core/src/arena`, avoiding the camp namespace. Local npm lockfiles pin dependencies. The integration stream may reconcile package manifests into its root workspace.

## Deliverables and reproducible gate

Pure TypeScript kernel and state hash, seeded training scenarios (front magic, side physical, alternating flank, unblockable lane, three-bolt stream), four timing policies, PixiJS placeholder scene, resource/clock HUD, audible/visible perfect feedback, Playwright keyboard/mouse script and screenshots.

Commands from repository root:

1. `npm --prefix packages/core ci`; `npm --prefix packages/game ci` (first install).
2. `npm --prefix packages/core run build`; `npm --prefix packages/core test`.
3. `npm --prefix packages/core run report:w2` produces simulated bot economics, window sweep, unlock timings and deterministic hashes under `docs/waves/W2-evidence/`.
4. `npm --prefix packages/game run build`; `npm --prefix packages/game run smoke` boots Chromium, drives real input and saves screenshots plus a measured frame report in that folder.

Unit gates cover arc edges, impact-window boundaries, tiers/ranks, exhaustion/release, stream, roll/stamina, cast interruption, 120-second replay equality, fixed-step render accumulator parity, and no forbidden ambient APIs in core. Performance scene holds at least 100 projectiles; measure frame intervals and CPU simulation/render submission separately. Target 60 fps; headless scheduling is reported honestly and is not a physical display or input-latency measurement. Profile if CPU p95 exceeds the baseline's 8 ms budget.

## Owner gate and exclusions

`docs/OWNER-CHECKS.md`: absorb timing/aim feel, flank readability, five-minute mouse/keyboard trial. Feel and filmed input latency remain **not measured** until owner evidence. No feel claim, gamepad, camp, borrowed schools, calendar or death gameplay in W2. W3 follows only after green build/tests and the W2 commit.
