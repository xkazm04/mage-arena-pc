# U6c — rewiring the latest clips

2026-10-04. GAME / integration, starting at 47c1856. Read-only art delivery
82f5bc4 (A14.3). Follow plan j, q, r, s. No art/audio changes, generation or push.

Four sub-waves, each with build/tests green and its own commit:

1. Import the technically passed A14.3 files, sidecars and source hashes. Reuse
   the A10 loader key, additive schema merge and lossless trim packing. Preserve
   owner-review status: delivered does not mean owner-approved. Import all 226
   clips; consumer changes are unnecessary for this schema merge.
2. Verify every reaction and persistent corpse; fix selection/lifetime defects
   where necessary. Missing rear Maw death/corpse and rear Thornback reactions
   use nearest same-entity delivered direction. Add creature choices to the Lab
   using existing enemy rules, without changing season combat or tuning defaults.
3. Audit and exercise all 46 additional state/direction clips (23 generated views
   plus mirrors). Honor anchors, durations and loop/clamp behavior. Preserve the
   12 documented legacy gaps, and repair presentation timing where needed.
4. Native 1080p/1440p Playwright reaction/corpse evidence for every entity/facing;
   reset/refill, depth, mirroring, motion and debug diagnostics. Measure 100 visible
   projectiles plus all 12 figures at 60 fps and texture residency. Consider
   unloading if decoded textures exceed 330 MiB. Re-run gate, save/replay and the
   full 8,000-fight census, comparing actual results to H1. Report limitations and
   update the owner guide and plan log.

The current handoff is authoritative over historical stage-1/2 reports: 180/192
priority slots and 46 extra clips, with 12 priority and 12 other slots missing.
Mire Maw rear hits ARE delivered. Standalone corpse PNGs are already mirrored;
the runtime uses atlas clips and their mirrorX flag exactly once. H1 defeat and
cleanup remain authoritative; all clip choice/timing is presentation only.


Sub-wave 1 complete: `df6587a`; `npm run gate` 211 tests + 11 reference checks,
zero contradictions; `npm run build:game` pass. Imported 122 delivery files,
45 packed pages / 68.839 MiB. All 226 clips merged without loader code changes.

Sub-wave 2 decision: use stationary creature targets, explicitly labelled in
Lab setup, with roster health and authored poise multiplied by the Lab override.
Facing is selectable. This supports reaction/corpse inspection without modifying
any deterministic core or save-version inputs. Existing active creature roster
practice remains available. Prefer delivered paired collapse/corpse over legacy
unpaired rear deaths for Maw/Thornback; retain all source clips in the manifest.


Sub-wave 2 complete: `420d1cc`; `npm run gate` 213 tests + 11 reference checks;
build pass. Native reaction walk subsequently passed with 276 captures at both
sizes, including all 48 entity/direction collapse/corpse pairs and Lab choices.

Sub-wave 3: all 46 additional clips fill actual A10 gaps (28 idle/run/cast,
18 absorb). Absorb artwork does not grant an enemy a ward mechanic; Garran's
rear ward can use its new clip and enemy resistance clips are available to
presentation consumers/preview. Creature telegraph windups now fit the complete
cast sequence, and release holds the last key. Hush Moth contact drain has no
cast event, so a read-only contact predicate selects its delivered attack pose
in active creature combat, excluding the stationary Lab target. Art fixture
casts have finite preview windows and pose inspections exclude synthetic hits.
The stress fixture now contains twelve distinct roster identities, including
Cinder Hound (the previous fixture duplicated Cassia).


Sub-wave 3 complete: `d5c626f`; gate 215 tests + 11 reference checks, build pass.
Extra playback passes at both sizes. Stress after the full extra walk measured
60.002/60.003 fps, frame p95 16.8 ms, CPU p95 2.6/2.2 ms, 325.716 MiB decoded
textures. Existing arena teardown releases character atlas pages; below 330 MiB,
no additional eviction is needed in this delivery.

Sub-wave 4 verification adjustments: disable periodic synthetic hit injection
while a fixture explicitly previews another pose; allow the real-input basic
needle test up to 90 seconds (Thornback's authored bolt resistance makes this
stationary test take about 43 seconds, with mana regeneration and no refill).
Capture collapse at 430 ms so the 390 ms contact effect has cleared. These are
verification choices; no gameplay values or source artwork were changed.

Sub-wave 4 complete: the final main browser walk passes (286 captures), the clear
collapse/active-Moth supplement passes (98 captures, 96 replacing earlier fall
shots), and the extra/performance walk passes (38 captures). The final gallery
contains 326 images. `u6c-verify.ts` rechecks 122 source/destination file hashes,
192 native collapse/corpse images, all 8,000 unchanged fight rows, unchanged
save/replay hash and clean art/audio worktrees. Final `npm run gate`: 215 tests,
11 reference checks, zero contradictions; game build pass. Full commands,
measurements, remaining 24 art slots and owner limits are in the U6c report.
