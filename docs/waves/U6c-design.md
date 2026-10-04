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
