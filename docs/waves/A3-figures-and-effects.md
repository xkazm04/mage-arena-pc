# A3 — oblique figures and effects

2026-10-02, ART / art, third session. Owner camera authority is
`art/CAMERA-OK.md`: open-oval-sparse-near-a01, near zoom 1.2, about 55 degrees
elevation. Upright figures show faces, upper shoulders and shortened legs; never
90-degree plan-view figures. Tessera & Lime and the existing four cast identities
are binding references. All deliverables remain owner-review candidates.

## Scope and decisions before generation

Water first. Four main mages and eight enemy IDs from baseline enemies.json.
AI opponents reuse school figures. Echo is excluded from active exports because
the season plan removes loops/Echo; its baseline shadow-tint instruction requires
no separate generated design. No new gameplay rule is introduced.

Plan 48 paid two-panel sources: four paired sheets for each of twelve identities.
Mages: idle/absorb, run strides, cast windup/release, hit/fallen. Enemies: idle/alert,
run strides, attack windup/release, hit/fallen. Enemy absorb is unsupported in the
baseline and is marked unavailable, not depicted as a new ability. Fallen is a
non-gory death/downed key pose, not a claim that ordinary arena defeats are lethal.
Up to twelve focused corrections bring the working allowance to about 60 calls.
Project target becomes 149 (89 historical + 60); hard and weekly cap remain 180.
First quota/rate-limit or uncertain-result latch stops all further paid work.

The one-image pilot is Cassia idle/absorb. Inspect its actual pixels, local grade,
matte extraction and native-scale open-oval composite before authorizing siblings.
The generator accepts text only under the existing verbatim-call contract; visual
references inform authored identity descriptions but are not passed as image
conditioning. Cross-sheet identity and angle drift must be retained as limitations
or rejected with hash-bound correction, never described as guaranteed continuity.

Generated: body shapes and distinct key poses in flat fresco rendering.
Derived: chroma-key alpha, crop, uniform scale, anchors and atlases. Procedural:
ground shadows, exact 140-degree ground-projected absorb, perfect flash, bolt/line
effects, telegraphs and unblockable shape marks. Composited: review figures over
the unchanged selected arena source (its existing painted figures/effects remain
visible and explicitly labelled). No claim of a clean environment plate.
Two-key pose playback is a timing study, not generated in-between animation or a
finished eight-direction locomotion set. One southeast facing only; no rotating
upright bodies to counterfeit other camera directions.

## Scale and semantic boundaries

Head-to-sole height excludes weapons, shadows and effects. Near: 64.8 px at 1080p,
86.4 px at 1440p; also inspect 4% and 5%. Ground projection follows contract sin(55°).
Telegraphs use shape plus colour, >=3 px outline and projectiles >=4 px core at
1080p. Absorb radius 2.4 m is a visual proposal; all durations are preview timings,
not gameplay authority. Water line mappings come from spells-water.csv; other
school motifs are generic until W8 line catalogues exist. Baseline smaller attack
footprints must not silently become larger hitboxes: any minimum-size outer cue
is marked advisory around the true footprint.

## Gates and handoff

Retain guarded serial transport, atomic charged reservations, immutable briefs,
proof/local/direct review hashes and reject-or-owner routing. Commands and measured
results, final spend, owner board and remaining limitations will be appended here
before the single commit. No push. No owner question or manufactured approval.

## Stopped result and provenance

The guard stopped at `01-tessera-figure-cinder_hound-injury-a01` after the provider
returned HTTP 400 `imagine:content-moderated`, no image file, and a usage charge.
The existing guard classifies a no-file result as uncertain spend and latches.
The latch was not edited, cleared, refunded or bypassed. No quota/rate-limit
incident occurred. Exact result and remaining items: `art/waves/A3/stop-report.json`.
The first 89 ledger jobs and all pre-session events compare equal to HEAD.

Measured: 37 new charged calls, 36 saved images, 126 cumulative charged / 125
saved, 54 remaining under the 180 cap and 23 to the working 149 target. Shared
account allowance is not measured. One initial Cassia pose correction succeeded;
later planned corrections were not attempted after the stop.

Delivered as review candidates: 70 transparent pose exports and nine atlases
(four mages, four soldiers, six cinder-hound keys), 23 native effect recipes / 138
four-phase sheets at 1080p and 1440p across far/standard/near, four final composite
proofs, preserved two-resolution pilot, owner player/contact/source archive,
source hashes, direct/local reviews and explicit missing-item records.

Five source sheets remain semantic rejects. Five isolated, explicitly reviewed
subframes are salvaged without accepting their sheets: three valid mage idles,
Brennic's first recoil, and his single fallen figure. Brennic's extra recoil is
excluded by a narrow crop. Fallen heads and outstretched hands sometimes crossed
the requested equal divider; authored crop overrides and two Iskar exclusion
rectangles retain the complete subject while removing neighbouring anatomy.
These are cropping operations, not new generated or hand-painted poses.

Cassia has a separately generated absorb key. Brennic, Garran and Iskar absorb
exports reuse their generated casting bodies; the procedural arc communicates
the state. They are not successful generated two-palm blocking poses. Their
dedicated source corrections remain pending. Run pairs mostly repeat after
disclosed horizontal flips, so playback uses one key plus procedural bob, not a
claimed two-stride gait. Full directions and in-between animation are absent.
Colour drift is substantial on several sheets, especially Brennic injury,
Garran injury and Iskar run. Bronze collars can be understated. No owner identity
or animation acceptance is implied by source or export integrity.

Effects are wholly authored geometric drawing, following the existing native
interface palette. All 24 Water data rows retain exact name/line/tier/branch and
shape authority; the sheet supplies family motifs, not 24 implemented spell
animations. Other schools are generic pending W8. Minimum projectile centre
thickness is measured at 4 px at 1080p for Water at every zoom (others are wider),
with resolution-scaled 1440p exports. The inverse-projected arc occupies the
forward sector and leaves the rear clear. Geometry is exact by code; generated
anatomical camera elevation and actual head-to-sole calibration remain approximate.
The effect contact sheet may fit large shapes; native sheets carry actual widths.
Net/ember effects retain their smaller solid footprint and add a separate dashed
4 m advisory outline to meet the contract's readability minimum. That outer cue
must never be used as the damage or root footprint; both diameters are in metadata.

## Gate results

- `python tools/art/check_a3.py`: PASS, explicitly incomplete handoff integrity;
  70 frame hashes, nine atlases, 138 effect sheets, source/proof chains, alpha,
  projectile pixels, rear-open arc and Chrome controls/loading at 1920x1080,
  2560x1440 and 390x844. `a3_complete` remains false.
- `python tools/art/waves.py check A3`: FAIL, exactly `DELIVERY_INCOMPLETE`.
  36 archived sources, five semantic rejects, no missing source reviews/grades.
- `python tools/art/check.py`: 37 unit tests PASS, Python/prompt compile PASS,
  A1 rebuild/validation PASS and A3 integrity PASS; overall FAIL at the unchanged
  global UI acceptance boundary for `ui-a3-poses.json`.
- `python tools/art/browser_check.py`: PASS separately for the prior A1 board.
- `python tools/art/portable_check.py`: all historical source/crop/icon hashes
  and all 224 A3 PNG hashes reproduce without raw files or paid calls. Overall
  FAIL remains the same unresolved pose-contact UI rejection, not a portability
  failure. The first concurrent run had an A1 capture race; final serial rebuild
  compares all 16 A1 screen hashes equal.
  The owner-player screenshot wait was also tightened to require the absorb
  state and two settled animation frames; two consecutive captures then matched
  SHA-256 `e6be72536d71830fcc62232347230e01a5fe327ba32117fd6101baccf56ada20`.
- `git diff --check`: PASS before commit. No game build exists on this art
  baseline; no game package or accepted production asset was modified.

Local pose-contact diagnostic: `overhead_view=no` yields reject, while its prose
describes a clear correctly labelled grid. The schema says this field checks UI
framing, not literal overhead. That inconsistency is disclosed, not resolved by
repeated grading or an agent override. Final effect/composite/owner-board grades
route to owner, never approve. A separate shieldman source diagnostic exhausted
its JSON response with repeated prose; one bounded local-only retry asked for
under 100 words, retained the failed cache, and completed valid JSON. No image
generation retry occurred.

## Remaining and handoff

Missing 13 source items: all four pairs for Mire maw, Thornback and Hush moth,
plus cinder-hound injury. Planned pose/costume corrections, additional facings,
real run cycles, full spell branch/tier composition, resolved net footprint,
engine integration/performance, motion readability and owner feel remain open.
The active source-spec catalogue includes these planned designs, but no fake
placeholder is presented as their generated art. AI mages reuse school figures;
Echo stays excluded by the season plan. The stop latch takes precedence over
unused time or image allowance. One commit, no push.
