# Mage Arena art pipeline

Standalone Python tools for the art waves. Run from the repository root. They do not depend on
or modify code packages. The Grok subscription is shared: never invoke image tools
outside this guard for the wave.

```powershell
python -m pip install -r tools/art/requirements.txt
python -m unittest discover -s tools/art -p 'test_*.py'
python tools/art/pipeline.py compile
python tools/art/pipeline.py status
python tools/art/pipeline.py generate --style 02-salt-ink --scene arena
# Inspect the actual generated image, then record a truthful note:
python tools/art/pipeline.py review-proof --job 02-salt-ink-arena-a02 --note '<direct pixel observation>'
python tools/art/pipeline.py generate --style 02-salt-ink --scene camp
python tools/art/pipeline.py grade
python tools/art/pipeline.py build
python tools/art/pipeline.py rank
python tools/art/pipeline.py build
python tools/art/pipeline.py validate
python tools/art/browser_check.py
python tools/art/portable_check.py
# Full offline gate (no generation or model calls):
python tools/art/check.py
```

Existing jobs resume with zero image calls. `generate` is serial under an exclusive
run lock. `usage.json` atomically stores the reservation before the subprocess can
start; failed and interrupted reservations remain charged. The local ISO-week and
wave ceilings, working target and per-scene ceilings have one authority:
`art/budget.json`. This ledger cannot know other projects' subscription spend.
The first actual quota/rate-limit result durably stops spending. There is no reset
command, retry loop, provider switch or refund. Unknown outcomes and unexpected
tool calls also stop spending. No video tool is permitted.

Every CLI call receives an explicit session UUID and a verbatim prompt file. Only
that UUID's history and images are read. The actual image tool call, exact prompt,
aspect and output count are checked. `--no-subagents`, a single allowed image tool,
bounded turns and a timeout constrain the CLI. A local model grade is a separate
Ollama request and consumes no image subscription reservations. Its exact model
digest, schema, prompt, raw answer, timing and image hash are cached.

A proof binds both scene inputs, the style and the reviewed source hash. Editing
any input or source invalidates it. `review-proof` records technical permission for
the next comparison image, never owner acceptance. `reject` requires an exact job
and a correction. A subsequent `generate --correction '<exact stored correction>'`
creates a new immutable attempt; it cannot retry a transport failure. Brief changes
require a new versioned file. An unchanged scene may reuse its original source when
only version metadata changes; all content and the original hash must still match.

`art/raw/` holds local transcripts and is ignored. Full provenance is retained in
`art/attempts/` and `usage.json`; exact source bytes are shipped in
`art/review/sources/`. The build and grader can use those portable source snapshots
after a fresh checkout without raw directories or a paid call. Do not delete or
edit the usage ledger to recover a crash. Inspect the specific session first; a
stale lock contains its owner PID and is never automatically stolen.

The build generates a combined HTML board, scene comparison controls, zoom, a full
attempt gallery, contact sheets and an integrity manifest. Raw images are never
silently cleaned or replaced. Code draws camp labels/opening slots from baseline
data. Latest attempts remain visible even if rejected; the board does not silently
pick a more flattering earlier generation.

`validate` checks delivery integrity and can pass while the manifest honestly retains
semantic rejections. Read its rejection count. Browser checks use locally installed
Chrome in headless mode at desktop and mobile sizes. They exercise image
loading, filters, zoom and overflow. This is not a game build or performance test.

`rank` sends the complete paired contact sheet to the local grader and validates
an ordering with visible strengths, concerns and a limitation for every direction.
Its input signature binds the exact current exports; rebuild afterward to display
that advisory ordering. No extra image subscription call occurs. `portable_check.py`
rebuilds without ignored raw files in a disposable copy and compares screen hashes.

The owner chose Tessera & Lime in `art/OWNER-CHOICE.md`. A1b, A2, A4 and A5
are authorized. A3 is blocked until owner-supplied `art/CAMERA-OK.md` exists;
neither this pipeline nor the local grader writes that approval.


Later waves use `waves.py generate|grade|review|build|check <wave>`. Briefs are
immutable versioned JSON; `art/waves/brief-index.json` chooses any non-default
version. Historical sources validate against their own recorded brief. Generation
resumes an existing exact input with zero spend; the A1b pilot that exhausted its
attempt cap stays archived. Changing an input never resets a scene's attempt cap.

For each wave, generate only its proof item, inspect it, run the local grade, and
record `review --proof --job <id> --note <actual observations>` before siblings.
A local rejection, missing grade, changed source or changed brief invalidates the
proof. Technical continuation is never owner approval. A2 portrait crops and the
expression gallery are reproduced with `python tools/art/portraits.py check`.

A4 presentation uses `python tools/art/camp.py build|check` for the data-driven
camp slots, unchanged map plate, exact source backdrops/story cards and native SVG
Hollow Board frames. `grade_ui.py` permits code-drawn labels when locally inspecting
actual UI captures; it retains the reject-or-owner boundary.

A5 is native SVG/HTML, with no paid image calls. `python tools/art/icons.py proof`
renders one Tide Orb pilot; `art/proofs/A5.json` binds its source, capture, brief,
style and local diagnostic before `icons.py build` permits batch export. The
catalogue JSON is the authority for original vector drawings and source mappings.
`icons.py check` validates all exports and browser states; `icons.py review-check`
requires the final captured board/HUD to match direct and local review records.
SVGs have transparent canvases; PNGs are browser rasterizations at exact sizes.
The proof's nominal inset is 6 units; individual delivered glyphs use the full
canvas with a measured minimum one-pixel transparent border at every export size.

`portable_check.py` rebuilds A1, A1b, A2 crops, A4 camp assets and A5 vectors/PNGs/
HUD in a disposable checkout-shaped copy without raw evidence or paid calls.
Fire glyphs bind to the explicitly labelled reference spell CSV, not approved
lines. W8 must supply Fire's line migration and Earth/Air's line catalogues before
their missing line-specific icons can be authored. A3 still needs owner CAMERA-OK.
`verify_ui.py` runs offline in both the main gate and disposable rebuild, rejecting
stale screenshot/local-grade/direct-review hashes and any automated acceptance.

## A3 stopped handoff

Owner camera is now confirmed, oblique at about 55 degrees. A3 generation used
the same serial guard and stopped at a no-file provider moderation result.
The latch remains set; do not regenerate or reset it. `stop-report.json` records
the missing work and exact error. Immutable prompts: `art/briefs/a3-v1.json`.

Offline rebuild: `python tools/art/figures.py build`, then
`python tools/art/effects.py`, `python tools/art/a3_board.py`, and
`python tools/art/waves.py build A3`. Sources are portable; raw is not required.
`python tools/art/check_a3.py` verifies the explicitly incomplete handoff.
`python tools/art/waves.py check A3` must still fail full-wave completeness.
The global UI gate must retain the current pose-contact framing rejection.
No gate pass here means owner acceptance or a finished animation package.

`a3-crops-v1.json` binds authored crop/flip/mask choices; `a3-derivations-v1.json`
names five salvaged subframes from still-rejected sheets and three reused cast
bodies. No generator output is silently repainted. Masks exclude neighbouring
poses that crossed the requested panel divider. `figures.json` stores source
hashes, bounds, master body scale and ground anchors for every export.
Effects are authored geometry; rotate world points before ground projection,
not already-projected raster strips. Preview durations are not gameplay numbers.
