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
