# m5 / m7 status (smoke hygiene lane)

## m5 — pins that drifted
- U3 + U4 tour: one re-pin. Reason: the `+2` / `+9` chip texts from 8.13/8.14 enter both pins. The hours-left chip (`7h`/`6h`, and other `Nh` chips) is now pinned as `Nh` (`packages/tools/src/smoke/pin-texts.ts`, used by `u3-browser.ts`; `u4-tour.ts` runs it), so time of day no longer moves the pin. The settled value is still asserted in the camp flow.
- AU4: `au4-browser.ts` pins the sorted decoded-cue set, settings, processing, scene (`smoke/au4-pin.ts`). Gains (`ducked`, `duckGains`), music state, crossfade voice count, active voices and full logs go to `docs/waves/AU4-evidence/perf.json` (git-ignored). Two re-pins: the shape change, then dropping `musicVoices` and event-kind order, which differed between runs on one commit (found by running the first re-pin 3 more times). The AU4 cue list was not changed by this lane; if the M3 audio lane changes it, `decodedBuffers` in the pin will move once, by design.

## m7 — frame advance
`u4-browser.ts` now samples the A10 body frames every 100 ms for up to 2000 ms (`smoke/frame-advance.ts`) and stops at the first advance. A window ending equal is a stall and fails with the element, height, every sample's time and frame hash, and the frame vector. Unit tests: `smoke/frame-advance.test.ts`, `smoke/pin-texts.test.ts`, `smoke/au4-pin.test.ts`.

## Run evidence (worktree 330b3e35, `git status` clean after each)
- `smoke:u3`: 3 consecutive passes, clean (after the re-pin commit).
- `smoke:u4` (u4-browser + u4-tour): 3 consecutive passes, clean.
- `smoke:audio`: 3 consecutive passes, clean, after the final AU4 re-pin (earlier runs on the first AU4 pin drifted once: musicVoices / music-play camp-day; fixed as above).
- No stall was observed in the u4 runs, so the m7 failure branch is proven by unit test only; the original flake is not shown to be fixed beyond 3 passes.
