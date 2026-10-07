# ART session 10 / A14.3 / 2026-10-04

Partial owner-review delivery: **180/192 priority slots and 46 additional
state-direction clips**, 226 clips in the A14 patch. All eight humanoids have
both hits, collapse and persistent corpse in four directions. Cinder Hound and
Hush Moth have all priority slots. Every creature now has front candidates.

[Owner death board](review/a14/index.html),
[death contact sheet](review/a14/contact-sheet.jpg),
[additional motion strips](review/a14/extra.html),
[timed playback](review/a14/motion.html),
[loader/merge note](delivery/a14/README.md),
[current audit](delivery/a14/session10/current.json).

Forty serial agy calls produced forty archived images and forty charges. The
342 inherited charges remain immutable; total 382. Session allowance 40/40 is
exhausted. The background-worker driver waits for the completed scoped file
after root exit, with a timeout; final transcript audit requires one image
call and one unique output per successful job. No Grok calls. agy is clear;
Grok remains latched for exhausted balance. The previous agy latch and Garran
counter evidence are retained under `waves/A14/session10/`. No refunds, hidden
extra calls, third slot attempts or pushes. Actual shared account allowance is
not measured; provider cap 500 is a local guard, not measured available credit.

The exact [remaining queue](delivery/a14/session10/backlog.json) is:

| Entity | Missing state | Directions | Reason |
|---|---|---|---|
| Mire Maw | death, corpse | ne, nw | Both rear collapse attempts failed facing/pose |
| Thornback | hit-light, hit-heavy, death, corpse | ne, nw | Both attempts for each rear source slot failed |
| Thornback | run, cast | se, sw | Both front motion attempts lacked adequate motion |
| Shieldman | cast | ne, nw | Clipped release and equipment-side inconsistency; budget exhausted |
| Iskar | run | se, sw | Not reached within session allowance |
| Slinger | absorb | ne, nw | Not reached within session allowance |
| Netter | absorb | ne, nw | Not reached within session allowance |

That is 12 priority slots and 12 other legacy slots, without overlap. The old
session-9 backlog and notes are historical evidence, not the current queue.
Do not resume the exhausted session wrapper or bypass the two-attempt limits.

Merge only present entity/state/direction entries over A10; keep its remaining
clips. A10 schema is unchanged. Honour per-clip anchors and v3 drawing size;
do not apply 1.5 again. Death is nonlooping, then corpse persists until game
cleanup. Standalone corpse PNGs already contain their left mirroring. Attacks
use `cast`, resistance uses `absorb`; mechanics remain simulation-owned.

Generated keys, local matte extraction, whole-body normalization, pivot
alignment, frame selection and mirrored directions are labelled separately.
Fourteen source reviews reject the requested sheet as a whole; this includes
partial salvage and superseded corrections. Exported partial salvage explicitly
lists excluded states. The local grader can only reject or route to the owner.
Owner animation/identity/camera quality and game integration remain unmeasured.
In particular, inspect Mire Maw's rounder front brace face, moth antennae/eyes,
small resistance motion and Cinder's bounding gait before accepting them.

Stage 1 is committed as `e90992e`, stage 2 as `da3ac66`; this handoff belongs to
the stage-3 commit. Design notes are `docs/waves/A14-3-stage1-garran.md`,
`A14-3-stage2-creatures.md` and `A14-3-stage3-motion.md`. Work remains local on
branch `art`; nothing pushed.

Final checks: all 90 tests pass; 91 atlas/corpse/manifest/gate products rebuild byte-identically offline without raw files, providers or network. Seven browser cases pass, including 44 persistent corpses and 46 additional clip loop/hold checks at both native sizes, plus 12 native arena composites. All 378 protected earlier files, 75 stage-2 atlas/corpse images and inherited ledger rows are unchanged. These checks do not constitute owner acceptance.
