# ART session 6 — Covenant restoration

Open the [combined owner board](review/session6/index.html) or
[contact sheet](review/session6/contact-sheet.jpg). Work is committed locally on
`art`; nothing was pushed. Camp and portraits are unchanged across all 156
tracked delivery files. New work remains owner-review material.

| Wave | Delivery | Remaining boundary |
| --- | --- | --- |
| [A8](review/a8/index.html) | 35 effect clips, 9 pages, 236 frame references; four schools, absorb and telegraphs | Owner motion/readability review and game integration |
| [A9](review/a9/index.html) | Three grounds, 36 structures/props, 15 decals, explicit layout and native comparison proofs | Approved-concept equivalence is unproven; repeated stands, derived rim and lighting differences remain |
| [A10](review/a10/index.html) | 198/288 state-direction clips in 11 atlases, four-direction canvas consumer | 90 clips absent; repeated leading-leg poses and cross-view identity differences remain |
| [A11](review/a11/index.html) | 18 added UI regions: stat design symbols and layered four-state Tideglass clock | Zero new generated images; authored geometry is below the requested painted fidelity bar |

## Loading

- Effects: [effects.json](delivery/a8/effects.json), [notes](delivery/a8/README.md),
  [canvas playback](review/a8/motion.html). Generated painted keys are separated
  from authored telegraph geometry, ping-pong loops and projectile aliases.
- Arena: [arena.json](delivery/a9/arena.json), [layout.json](delivery/a9/layout.json),
  [decals.json](delivery/a9/decals.json), [placement notes](delivery/a9/README.md).
  Grounds retain native 1280×720 detail at 32 source px/metre: 1.422 source px
  per 1080p display px and 1.067 at 1440p along X. Ground Y accounts for the
  55° projection. Tiles cover 40×22.5m. The baseline core ellipse is unchanged.
  Use object base lines for sorting; rim segmentation and rune stencils are
  authored construction, not newly generated geometry.
- Characters: [characters.json](delivery/a10/characters.json),
  [source gates](delivery/a10/source-gates.json), [notes](delivery/a10/README.md),
  [motion preview](review/a10/motion.html). Two generated diagonal views where
  available, plus two explicitly mirrored views; handedness mirrors too.
  Never rotate an upright figure. Draw the 384px master at 97.2px at 1080p for
  a nominal 40.5px body (3.75% screen height); multiply by 4/3 at 1440p.
  Missing clips return false and are not silently substituted. Game-owned
  fallback policy is still needed; this is not a complete animation replacement.
- UI: [kit.json](ui/kit.json), [contract](ui/README.md),
  [A11 notes](delivery/a11/README.md), [clock preview](review/a11/motion.html).
  All original 90 regions and both old pages remain unchanged. New IDs use
  `icon.stat.*` and `clock.daily.*`. The game supplies day progress and phase
  transitions. The reference loader demonstrates water clipping, meniscus
  motion and the orbiting bead; no game clock schedule was changed.

Serve the repository for module-based canvas previews. Static owner boards
open directly as local files. These are standalone art consumers, not the
game stream's implementation. The integration checkout was read-only.

## Exact remaining work

A9's three side-by-side comparisons are evidence of the current difference,
not a declaration of “no loss of fidelity.” Bespoke stand/arch integration,
less obvious repeating layout and integrated lighting still need work.

A10 missing clips by entity: Garran 4, Iskar 2, shieldman 6, slinger 4,
netter 2, cinder hound 24, mire maw 16, thornback 14, hush moth 18. Cassia,
Brennic and conscript have all state-direction slots but still need gait and
painting review. A slot count is not production-quality animation. Several
six-key loops repeat the same leading leg; some source keys were explicitly
reselected into compatible gestures. Creature front views were not generated.
The dressed/staff-bearing hound source is rejected in full. Iskar's front-gait
repair was rejected because bright pink garment paint keyed away. Netter's
front guide was text-only and introduced costume differences; the downstream
sheet is reference-guided, but that does not establish cross-view identity.

A11 is an authored design reference with existing generated A5b silver rim
and A8 mist. Stat relief, sky plates and water construction are local geometry.
The local grader flags the faceted icons as below Covenant painting quality;
the direct review agrees. New generated stat symbols and clock paintings are
still required. Three [unsubmitted briefs](waves/A11/generation-backlog.json)
preserve the design and one-proof-first sequence. No fake generation or owner
approval was recorded.

## Providers and history

Project reservations: **285/300**, including **62 this session**: A8 7, A9 11,
A10 44, A11 0. The 15 remaining local reservations are not provider availability.
Grok and agy guards are 300; the stricter combined project ceiling remains 300.
The real account allowances remain unknown; four known external agy probe
charges are still guarded separately.

Both independent stop latches remain set:

- agy: Brennic returned two byte-identical output files. The anomaly and both
  charges are retained; no refund or automatic latch reset.
- Grok: animal-only hound correction returned HTTP 429, “temporarily at
  capacity.” The failed reservation remains charged. No retry or third-provider
  bypass followed.

The first 223 ledger entries match the session-start digest. One local
shieldman reference filename collision was recovered from exact archived
request bytes; [the audit mapping](waves/A10/reference-relocations.json) keeps
the original input hashes and records the relocated consumed bytes. Future
writes refuse reference collisions. agy internal image prompts remain unverified;
Grok's image-edit wrapper consumes only the first reference. Those limits are
documented rather than presented as stronger reference guidance.

## Validation and commits

All four portable rebuilds pass with raw access forbidden. Source/page hashes,
crop and alpha gates, atlas rectangles, density, loop/timing metadata and
explicit coverage checks pass for the exported candidates. Owner boards load
at 1080p, 1440p and 390px. Actual A8/A10/A11 canvas playback passes at both
native resolutions. A11 full/empty water, four phase renders, layer visibility
and the original UI consumer's 11 screens/focus/fonts were checked. Offline
suite: 69 tests pass. [Session audit](reports/session6-audit.json).

Historical `A3 STOP_SNAPSHOT_DRIFT` and `UNRESOLVED_UI:ui-a3-poses.json` remain
historical failures; this session did not rewrite them as passes. No game FPS,
physical controller/sofa feel or owner acceptance is claimed.

Wave commits in order: A8 `e28435b`, A9 `fd8b310`, A10 `f18ea88`; A11 is the
commit containing this handoff (find with `git log --oneline -4`). Each wave
has its own design note, plan status, session-log entry and owner board.
