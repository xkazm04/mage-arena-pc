# W4c — aim and hits under the oblique projection

Completed with W4b, 2026-10-02. This optional continuation uses the same camera and evidence gate; it does not add body snapping or change combat damage rules.

`ArenaInput` stores the pointer in client pixels and converts it through current canvas bounds to the displayed camera's logical pixels, then inverts the orthographic ground projection. It refreshes each input sample and rendered frame, so a stationary cursor stays at its screen location during camera follow, zoom and resize. Fixed simulation input remains an absolute ground aim point. Foot rings are the intended aim reference; upright head/body pixels are above that point and deliberately do not change collision geometry.

All existing swept projectile, area, lane, melee, shield and absorb tests remain ground-space code. The camera never mutates actor positions to project them. Added tests exercise projection/inverse over translations, negative/off-screen points, aspect ratios, three elevations, both resolutions and all zoom settings; CSS scale/offset; exact ward endpoints and ground-degree block boundaries; swept-hit edge/miss discrimination; actual Rain Needle hits in eight directions; and deliberate misses from aiming above the foot plane. Resolution/zoom do not change spell damage or collision radii.

Commands: `npm --prefix packages/game test`; `npm --prefix packages/core test`; `npm --prefix packages/game run smoke:w4b`. Reports are `W4b-evidence/game-tests.json`, `core-tests.json` and `browser.json`. The browser matrix is **32** real-pointer hits: 2 resolutions × 2 zooms × 8 directions, with one queued click and ordinary kernel steps per case. A separate probe moves the camera while retaining the pointer. These fixtures pause real-time simulation for reproducible input/collision assertions, then advance only normal fixed ticks; they are not owner play measurements.

Owner aim comfort and motion readability remain pending in `OWNER-CHECKS.md`. In particular, whether aiming at feet instead of the visible torso feels natural is not closed by a mathematically correct inverse.
