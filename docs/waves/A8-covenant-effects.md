# A8 — Covenant spell and effect restoration

2026-10-03, ART session 6. Owner D27 prioritizes the energy, mist, sparks and
material fidelity of the A6 concepts. Camp and portraits are approved by the
owner's session verdict and are preserved. New exports remain owner-review.

Design: four painted elemental animation sheets, then an absorb barrier study.
Fire uses forked flame and embers; water uses crescents, fine spray and mist;
earth uses angular stone and dust; air uses split wisps and branching lightning.
An absorb is a curved energy membrane that compresses incoming energy, with an
open rear and a localized perfect flare. Never a solid disc or notification icon.
Cast, travel/projectile, impact, hit and aura keys are generated. Exact telegraph
geometry, timing, alpha extraction, atlas packing and any remapping are authored
derivations and will be labeled. Collision and slowing remain game-owned.

One reference-guided agy image proof first, serial calls, independent provider
latches, hash-bound briefs/reviews, local grader reject-or-owner only. Source
gates inspect gutters and crop margins; delivery checks inspect bounds, anchors,
alpha, frame variance and loop joins. A canvas consumer demonstrates animation
at 1080p/1440p and 3–4.5% body scale. Visual quality remains an owner judgment.

Budget: owner raised the inherited 223-charge cumulative guard to 300 and the
agy weekly guard to 300. Grok's local guard is also 300; the stricter cumulative
300 ceiling remains in force across providers this session. This conservative
interpretation allows 77 new reservations, with failures retained. Actual shared
allowances are unknown. No latch reset or refund is authorized or performed.

Planned commands: `python tools/art/session6.py check A8`,
`python tools/art/covenant.py check A8`,
`python tools/art/covenant_browser.py A8`, and pipeline unit tests.
Results and remaining limitations are appended before the wave commit.

## Delivery and measured results

`art/delivery/a8/effects.json` contains 35 clips on nine RGBA pages: 134 unique
generated painted keys and 64 authored telegraph keys, with 236 frame references
including aliases and ping-pong playback. The [owner board](../../art/review/a8/index.html)
includes source attempts, A6 references, the frame contact sheet and six native
canvas captures. The HTTP-served motion page uses the delivered hash-checking
Canvas loader. Seven calls charged: six agy, one Grok. Project 230/300, 70 remain;
known weekly agy 72 including four external probes, Grok 135. Both stops clear.

Gates PASS: `python tools/art/session6.py check A8` (35 clips, 236 references),
`python tools/art/covenant.py check A8` (16 board rows, one full source rejection),
`python tools/art/covenant_browser.py A8` (1080p/1440p/390px),
`python tools/art/restoration_browser.py A8` (real atlas playback, pause, hash
loader, one-shot expiry and loop continuation at both native resolutions),
`python tools/art/session6.py portable A8` (14 delivery files identical, no raw
access), and `python -m unittest discover -s tools/art -p 'test_*.py'` (65 PASS).
Test quota incidents are simulated; no live quota/moderation incident occurred.

Source failures remain visible. Earth impact was replaced after clipping in
both the first sheet and an agy correction; Grok supplied six richer stone/dust
keys but painted charcoal panels, which are removed using a measured RGB-25
matte subtraction. Two Air travel cells and two barrier approach cells are
excluded. Water travel cells 4 and 6 are mirrored. Perfect flares use explicit
isolation windows and a common authored pivot; no clipped glow is padded over.
Generated arc geometry is approximate; the engine enforces its actual arc.

Limits: these are low-frame-count component animations, not every spell tier's
choreography. Ag y output requests for 3K were not honored (actual dimensions
recorded per source). The agy elemental shapes are smoother/broader than the
finest A6 sparks. Grader style uncertainty remains visible. The owner must judge
motion/fidelity; no game integration, runtime FPS or sofa feel is certified.
A9 arena restoration follows. Camp and portraits were not regenerated.
