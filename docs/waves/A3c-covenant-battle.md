# A3c — distant Covenant battle figures and effects

Design before generation, session 5, 2026-10-02. Use scale v2 and the three A7
empty plates. No discarded A2/A3 identities or assets are inputs. Cast IDs and
enemy mechanics come from the baseline data; new visual identities are authored.

One Water mage four-key sheet is the pilot: ready, running, casting, absorbing.
Staff, belt equipment, pale blue/ivory layered cloth, dark hood and lower contour,
compact droplets/mist. Three other mains have distinct staffs, hems and elemental
accents. All are experienced battle mages. Pose keys are static animation inputs,
not a claim of complete walk cycles or multiple facings.

Eight baseline enemies: conscript, shieldman, slinger, netter (non-magical legion);
cinder hound, mire maw, thornback, hush moth (raw magical creatures). AI mages
reuse school silhouettes. Baseline Echo is excluded because seasons removed it.
Sheets conserve spend; one source per identity with four spaced key poses. Use
Grok for pose/effect sheets; agy for reference-guided designs or provider fallback.
Flat magenta is extracted locally with explicit crop/anchor metadata and edge
checks. Sprite body bounds are authored from direct inspection, independent of
staff/aura bounds. Transparent exports are genuine local RGBA, not provider alpha.

Generated spell/aura motifs supply painted texture; exact directional absorb,
threat geometry and minimum core widths remain native geometry. No image changes
combat hitboxes. Compose every palette at 1080p/1440p at 3.75% nominal height,
and a separate 3/3.75/4.5% scale strip. All effects use shape as well as colour.
Local grading only rejects or routes to owner; direct issues remain visible.

Commands, spend, limitations and backlog are appended before the wave commit.

## Delivered partial pose set and review evidence

[Owner board](../../art/review/a3c/index.html),
[loading notes](../../art/delivery/a3c/README.md). All 12 identities have usable
review keys: 38 transparent frames in twelve 1024-square atlases. Six required
palette/resolution composites, a 3/3.75/4.5% strip and an enlarged key contact.
Twenty native effects and twelve painted motifs; all 24 baseline Water CSV rows
map to family motifs. Game owns exact spell rules and timing.

Seventeen new image calls: fifteen agy, two Grok; project 179/240 charged,
61 remain. No quota/moderation/rate-limit incident. agy local known week count
is 22 including four external probe images (account allowance unknown).
Four source rejects stay visible: two Water camera pilots, first effects sheet
(tinted panels/physical rims), optional painterly four-mage sheet (front camera
and clipping). No source was repaired by relabeling it accepted.

The third Water source yields rear run/absorb only; front keys excluded. Conscript
panel lines are cropped away and frontal windup excluded. Shieldman sword attacks,
slinger duplicate/lost sling attacks, netter clipped/mismatched attacks and moth
invented discharge are excluded. The delivered keys have stronger outlines and
smoother paint than the A6 portrait bar; painterly fidelity is still owner-review.
The shared painterly correction looked richer but failed runtime camera/margins.
No complete animation set, consistent all-direction camera, finished gait or
engine integration is claimed. Body y bounds are authored pixel estimates;
rendered target heights derive from those bounds, not a model's size claim.

Matte testing exposed erased lilac/green spill. A conservative key threshold
preserves pale lilac; VFX RGB is mapped to authored school pigment after keying,
retaining painted brightness and alpha. A regression test covers that failure.
Auras sit behind bodies. Earth uses angular stone motes, not a flame-like ring.
Painted near-full ward rings are excluded; native forward absorb is exactly 140
degrees with rear open. Static compositing is not measured combat readability.

`python tools/art/covenant_battle.py check`: PASS, 12 identities/38 frame hashes,
RGBA, sizes, source chains and all composite scale placements. `covenant.py check
A3c`: integrity PASS, four semantic rejects explicitly reported. `covenant_browser.py
A3c`: PASS at 1080p, 1440p, 390px; all 25 board images load without errors/overflow.
54 unit tests PASS, including key/colour regression, open rear and 4px core.
Two actual native-composite local diagnostics route owner-only. First 159 project
jobs compare identical to a0c77b7; no refund/history replacement. Historical A3
failures remain. No game build exists on this branch; game code unchanged.

Backlog: owner style/scale review, stronger painterly continuity across pose keys,
Water ready/cast, missing valid soldier attacks, additional facings, true gait
cycles/in-betweens, exact engine animation timing and performance, full branch/tier
spell animations, motion/sofa readability. A5b follows in priority order.
