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
