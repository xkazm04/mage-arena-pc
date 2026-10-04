# Image provider ledger (measured 2026-10-02)

## Antigravity CLI (`agy`) with Nano Banana 2, probed after the owner signed in

- Binary: `C:\Users\kazda\AppData\Local\agy\bin\agy.exe` (version 1.2.15), not on PATH. `agy models` lists Gemini 3.8, 3.7, 3.6 Flash (low, medium, high), Gemini 3.1 Pro, and three other models; the image tool is Nano Banana 2 via a `generate_image` tool (the agent's own report).
- Invocation that worked: run **inside the output directory** `agy -p "<prompt>" --dangerously-skip-permissions --model gemini-3.8-flash-medium --output-format text`; the image is saved into the current directory under the name given in the prompt. Reference images are made available by copying them into the same directory and naming them in the prompt.
- **Generation:** works. 1376x768 PNG in about one minute (dark-fantasy arena floor, oblique, rune glyphs, pylons: clean, no text, coherent).
- **Reference-guided generation:** works and is strong. A new fire-mage portrait generated from the Moonchalk Tempest portrait kept the painting style, frame logic, lighting and mood and changed the character, accessories and elemental accents (embers, ember staff).
- **Editing:** **not true pixel inpainting.** The agent says plainly that it regenerates conditioned on the reference. A palette change request (rust and sand, add blue water swirls) kept the macro composition, camera angle and positions, but re-rasterised fine detail, softened floor cracks and re-cast the lighting. Treat it as "restyle with a strong reference", not as surgical editing; do not rely on it to change one object and leave the rest identical.
- **Sprites:** generated a full-body hooded water mage on a solid magenta background (1024x1024, painted, readable, strong elemental aura and staff) usable for keying. The model cannot output a real alpha channel directly; key the magenta out locally.
- Output is RGB PNG; sizes seen 1376x768 and 1024x1024. Image sizes are not controllable by exact pixel request (to verify).
- **Not measured:** quota and rate limits of the Antigravity account (unknown), consistency of a whole set of sprites, determinism, speed under parallel use, moderation behaviour, per-call cost. Keep a local budget guard and a stop latch exactly as for Grok.

## Grok CLI (`grok`, SuperGrok login)

- Generation through the built-in image tool, reference-guided edits via the image edit tool, 1024x1024 or 16:9 outputs, flat colour background reliable. Weekly allowance unknown, shared with the Death Ride art stream. Content moderation can refuse a prompt with HTTP 400 (seen on an injury pose); treat as a prompt finding.

## Routing

Grok and `agy` are interchangeable behind the pipeline's provider interface: each has its own budget guard and stop latch; a quota or rate-limit error latches that provider only and routes the remaining work to the other; a moderation refusal is a prompt finding for that provider and may be retried once on the other. Use `agy` first for: reference-guided style variations (palette and character variants from an accepted reference), concept art, textures, UI kit sheets. Use Grok for: pose sheets and effect sheets where it already proved itself, and whenever `agy` drifts from the style.


## ART session 5 observations (2026-10-02)

The real pipeline is `tools/art/providers.py`, exposed through
`pipeline.py provider-generate`. `art/providers/budget.json` records the local
150-image agy guard and four known external probe outputs; the project ledger
retains its separate 240-image cumulative ceiling. Independent provider stops
and events live in `art/providers/history.json`. No automatic latch reset or
refund is allowed. CLI requests, reference hashes and stdout are archived under
`art/providers/runs/`; actual internal agy image-tool prompts are not exposed and
are explicitly unverified.

Reference-guided palette changes retained major arena/camp landmarks but changed
fine details. Camp generation once added labels despite a text-free brief; the
correction removed them. Sheets can change cell count: a six-story request made
nine cells, so only six explicitly reviewed crops were used. Magenta UI primitives
keyed cleanly with a stricter matte threshold than pale-lilac battle sprites.
Portrait output also used 900x1200 and six-cell 1264x848 layouts; do not promise an
exact requested pixel size. Strong reference conditioning preserved cast faces
but sometimes suppressed emotion changes; explicit chin/gaze/mouth direction was
needed for corrections. Neutral versus proud and grief remain human-review gates.
These are observed session findings, not general quality or quota guarantees.

## ART session 6 observations (2026-10-03)

Owner authorization raises Grok's local guard and the inherited cumulative
project ceiling to 300, and agy's weekly local guard to 300. The cumulative
ceiling is retained as an additional conservative limit across providers; the
session began at 223 project charges. This does not assert the shared account's
real remaining allowance. No historical charge is reclassified or refunded.

A8 reference-guided agy sheets returned 1200x896 and 1264x848 despite requests
for larger dimensions. Six-column layouts were broadly coherent, but requested
empty gutters were not reliable: three Earth impact cells and two Air travel
cells touched their crop edges. A roomier Earth correction also clipped its
peak frame and was rejected. Two Water projectile keys faced left; explicit
local mirroring corrects those keys, with provenance in the clip metadata.
These are concrete findings from this session, not general provider guarantees.

Black-matte effect outputs are RGB. Local emitted-light alpha extraction,
atlas padding, playback order, timing and exact telegraph geometry are authored
derivations. The generated six-key source is not relabeled as a larger number of
generated frames when ping-pong playback adds frame references. Local diagnostics
have expressed uncertainty about painting fidelity; they remain reject-or-owner
observations and do not establish quality acceptance.

The Earth correction routed to Grok succeeded in 21.5 seconds with a 1280x720
JPEG: richer mineral painting, six separated keys, but charcoal panels instead
of the requested black background. Measured RGB-25 matte subtraction removes
those panels locally. The agy barrier sheet took 338 seconds; explicit isolation
windows recover its complete perfect flares, while two crossed-grid approach
cells are excluded. A8 charged seven images (six agy, one Grok), cumulative
230/300; both provider stops clear. Actual account quota remains unknown.

### Session 6 / A9 / 2026-10-03

Eleven serial Grok calls, no retry/refund or latch reset. Rich masonry and floor painting was usable; requested resolution/aspect was not reliable (most outputs 1280x720). Rust banner clipped; corrected by a separate reserved image. Decal sheet introduced letter-like marks and an unwanted figure; those cells are excluded. Individual physical materials outperform the earlier simplified A7 export, but generated front/back wall prompts did not produce trustworthy opposite facings. Source variants are treated as materials, with authored geometry disclosed. Cumulative 241/300; remaining 59 under the conservative shared ceiling. agy actual weekly allowance remains unknown.

### Session 6 / A10 / 2026-10-03

A10 PARTIAL candidate: 198/288 state-direction clips in 11 atlases; 90 missing clips explicitly enumerated. Two generated diagonal views where available, two declared mirrored left views, six states, shared pivots and scale, canvas loader and native A9/A8 context proofs. Repeated leading-leg poses and identity differences remain; technical gates do not certify production animation. Cinder hound and Iskar front-gait repair rejected. 43 serial attempts, 44 charges: 41 generated jobs, one agy duplicate-output anomaly charged twice, one Grok HTTP 429. Both provider latches retained; cumulative 285/300. Owner review, missing animation and game integration remain open.

agy first: multi-direction grids drifted; its front-right Cassia keys were usable. Brennic emitted two byte-identical files (finding and hash archived in art/waves/A10/agy-duplicate-finding.json). The conservative two charges and anomaly latch are retained. Grok consumes only the first reference, and output aspect follows that image; square single-body inputs reduced copied collage layouts. Direction flips, missing weapons, repeated leading legs and pink-cloth matte collision still occurred. The generic humanoid wording contaminated the hound prompt; animal-only correction was prepared but received HTTP 429 “temporarily at capacity”. Per policy it remains latched, even with 15 local reservations left. No more image calls. The shieldman reference-path collision was recovered from exact archived request bytes without changing original hashes; see reference-relocations.json.

### Session 6 / A11 / 2026-10-03

No provider call. agy remains stopped on duplicate output anomaly and Grok remains stopped on HTTP 429. The stat proof, painted clock states and independent-layer briefs are staged under art/briefs/a11 but not submitted. No third provider or untracked generation bypass was used. A11 assets explicitly distinguish old generated material from authored geometry; the requested new generated paintings are not complete. Cumulative 285 charged; session charges A8 7, A9 11, A10 44, A11 0.

### Session 7 / A12 / 2026-10-03

The owner authorized preserving/clearing both old latches and raised guards to agy 400 / Grok 330 for this wave. Snapshot and original latches are under `art/waves/A12/before` and `latches`. The combined ceiling is 345 (285 inherited + about 60), serial calls and first-error provider stops retained.

agy diagnosis is now concrete: the old Brennic parent explicitly copied output.png to source.png; their bytes are identical. Its linked worker nevertheless made **three** image calls. The old two-charge row is unchanged; `a12-a10-agy-hidden-call-reconciliation` appends one historical charge. Evidence contains task-linked tool arguments and original transcript hashes. The repaired driver groups file aliases, isolates its own `_driver` copy, rejects unchanged references, monitors exact-request-linked parent/worker image calls, and fails closed on unverified or extra calls. Extra-call/rate-limit detection terminates the process tree and latches only that provider; already started calls remain conservatively charged.

One Grok clean-plate proof succeeded in about 28 seconds. The prior “temporarily at capacity” 429 is no longer blocking; this is consistent with transient capacity, not proof of the account allowance type. One agy proof also succeeded, and its single internal call is archived. Subsequent agy runs use live transcript monitoring. No new quota/rate errors or moderation refusals occurred. Four visually rejected Grok scenes remain charged and archived.

**11 new images: agy 6, Grok 5; plus 1 historical reconciliation. Project total 297/345.** Current provider project charges: agy 81, Grok 189; agy's 4 known external probes additionally count against its guard. Local guard remainders: agy 315, Grok 141; combined project remainder 48. Both latches are clear. Actual account balance and image monetary cost remain unknown; CLI token cost is not image-generation spend.

No other paid image provider was used. Three local RealESRGAN_x4plus passes use the existing CUDA/Comfy runtime. No upscale weights were installed before this wave; the official release URL and BSD-3-Clause licence were recorded **before** downloading the 67,040,989-byte weight, SHA-256 `4fa0d38905f75ac06eb49a7951b426670021be3018265fd191d2125df9d682f1`. Source/licence/hash and learned-versus-Lanczos comparisons are under `art/waves/A12`; the ignored model is not committed. Existing EasyOCR weights were reused with downloads disabled. Local Qwen/OCR observations remain advice only.

### Session 8 / A13 / 2026-10-03 to 2026-10-04

agy was used first for a reference-guided single rune proof. Its first sheet
introduced letter-like forms and was rejected; the corrected sheet supplies
canonical cutouts, excluding its H-like warning cell. Technical proof permits
siblings only; local grades never accept art. The next agy casting job initiated
two internal image calls despite a one-image request. The live monitor detected
`EXTRA_TOOL_CALL`, terminated it and latched agy. Both started calls remain
charged. A final exact-request-linked parent/worker audit found no additional
late calls. No latch was cleared. Grok then ran serially under its independent
clear latch. Its sheets frequently missed phase or shape constraints: icon-like
start/release, pseudowriting, an invalid cone, closed ward and geometric floor
runes were rejected and remain visible in the attempt archive. Corrected hold
sheets supply painted keys; start/release are honestly authored from these.

Twenty jobs, nineteen archived generated images, **21 session charges** (agy 4,
Grok 17). Ten selected paintings feed the delivery. No moderation refusal or
quota/rate error this wave; no refund, third provider or guard increase. Total
**318/345**, conservative project remainder **27**. Recorded provider guards:
agy 400, Grok 330. Provider project charges: agy 85 plus 4 known external,
Grok 206; guard remainders 311 and 124 are subordinate to the combined ceiling.
Actual shared-account allowance and monetary image cost remain unmeasured.
The history of 296 earlier job rows and 280 protected asset files is unchanged.
[Final audit](../art/waves/A13/provider-final-audit.json),
[spend](../art/delivery/a13/spend.json),
[all attempts](../art/review/a13/attempts.html).

### Session 9 / A14 stage 1 / 2026-10-04

PARTIAL: 124/192 state-direction slots. All four mages and four soldiers have hit-light/heavy in all directions; death plus persistent corpse in all directions except Garran ne/nw. Creature A14 generation remains missing. 21 generated sources, 24 charged attempts, total 342/450; Grok latched on HTTP 402 exhausted Build balance, agy on repeated pre-image HTTP 503. One agy extra-call driver repair/reset and one bounded preflight recovery are archived; no refunds. 88 tests, 49-product offline rebuild and five browser viewport cases pass. Existing 378 protected art files and inherited ledger prefix are unchanged. Owner animation/readability and game integration remain unmeasured.

A13 extra-call diagnosis: the root forwarded an incomplete one-call constraint; the image worker made output_v2. The driver now forwards the full constraint, watches every 100ms for the first completed scoped artifact, captures it and terminates the request before critique, then audits again. An attempted direct-agent CLI flag still delegated and was removed; it is not a claimed guard. Every successful A14 agy job has exactly one completed scoped image call in the final audit. Original stops and charges are retained.

Grok returned HTTP 402 before any image call; the quota detector now recognizes exhausted Build balance, and its latch remains. agy later failed its eligibility check with HTTP 503 and zero scoped calls. A read-only models probe succeeded; one explicitly documented bounded manual recovery produced Netter se. The next request repeated 503; its latch remains and no more image calls followed. This is service availability, not measured image-account quota. [Recovery evidence](../art/waves/A14/preflight-503-recovery.json), [final audit](../art/waves/A14/provider-final-audit.json), [spend](../art/delivery/a14/spend.json).

### Session 9 / A14 stage 2 / 2026-10-04

Zero calls and charges. Existing A10 gait audit and remaining queue only; no
new clips or safe local gait correction. Total stays 342/450 (24 this session),
with 56 of the 80 session reservations unused. Usage and provider-history bytes
match stage-1 commit `3c4f4a9`; both latches remain set. No account-credit or
availability claim follows from these unused local reservations.
