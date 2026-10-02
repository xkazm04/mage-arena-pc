# A1 — paired style exploration

Design note, authored before implementation. Scope: art branch only; no code packages,
no push, no production art and no owner decision inferred. The current project plan
(all sections a–l read first) supersedes the baseline's loop, gamepad and JVM choices.

## Contract and decisions

- Build standalone Python tooling in `tools/art/`, with configuration and evidence in
  `art/`. This placement honors the explicit instruction not to touch code packages.
- Versioned direction cards cover mosaic/fresco, parchment ink, gouache, woodcut,
  dark oil, screen print, luminous dark ink and watercolor. Each changes line,
  palette, shading, density and mood. Each direction has the same arena action and
  the same camp action; only its style block changes across directions.
- Generate an arena proof, inspect its actual pixels, and record a hash-bound
  technical proof review before generating that direction's camp. This is permission
  to explore a sibling, never style acceptance. Independent comparison scenes use
  generation, not a claimed canonical character reference; recurring production
  character identity is deferred to the owner-selected style in A2.
- The camp has the baseline data's places and opening slots. Load the CSV instead of
  transcribing gains or inventing a Well. Use Day / Dusk / Night (night act) and a
  season label, with no loop/reset/Echo UI. Exact labels and controls are composed
  in code above a generated, text-free map. Map positions are authored concept
  coordinates, not gameplay navigation data. Proof images are concept screens,
  not screenshots, performance measurements or implemented gameplay.
- `art/budget.json` is the only spend authority: target about forty, wave and local
  weekly hard ceiling one hundred twenty. Reserve before invoking the CLI; failures
  and unknown spend remain charged. Serial generation protects the shared
  subscription. First quota/rate-limit error permanently latches this run closed;
  no retry, account switch, reset or alternative provider after it. No videos.
- Store exact compiled prompts, brief hashes, session IDs, actual tool-call
  arguments, image hashes and outcomes. A resumed job never silently regenerates.
  Content corrections require a recorded rejection and a new attempt; no transport
  retries. Stop on unknown spend or violation of the one-call contract as well.
- Deterministic image and provenance gates reject defective artifacts. Local vision
  grading answers fixed, schema-validated questions and ranks diagnostic candidates;
  it can only reject or route to the owner. No taste certification. Missing or
  uncertain grading stays explicit. Human calibration and felt quality are pending.
- Build a portable combined HTML board, arena/camp contact sheets, per-direction
  paired views and an attempt history. Keep exactly one arena and one camp on each
  direction's current comparison. Rejected attempts remain visible in the archive.
- `art/OWNER-CHOICE.md` remains pending until actual owner evidence exists. Stop after
  delivery. A2–A5 are outside this execution.

## Read-only references and lessons

Read the baseline HTML report and design data/cards and the Fable verdict. Inherited
worked examples are defective design evidence, not measured fixtures. No gameplay
numbers or gains are changed by this wave.

Read Death Ride `tools/art/gen.py`, `common.py`, `grade.py`, `art/ACCEPTANCE.md` and
`art/STYLE.md`. Reuse the patterns, not game assets or IDs: reservations before calls,
per-session provenance, conservative unknown-spend accounting, hash-bound proofs,
raw/export distinction and model disagreement routed to the owner. Numeric token
counts must not be mistaken for HTTP rate-limit status.

Read Grok bundled `imagine`, `game-assets`, `assets.md`, `ui-icons.md`; use full
style/action blocks, code-drawn factual UI, pixel readback and bounded correction.
The explicit Grok route and A1 proof scope supersede generic production-asset defaults
in the imagegen skill (no OpenAI image calls, sprite extraction or animations here).
Read the registry media laws and relevant prompting, medium, plate/text separation,
grading, variation and phase-boundary notes. References remain untouched.

## Gates planned

`python -m unittest discover -s tools/art -p "test_*.py"` must prove budget and latch
behavior, crash/resume accounting, quota parsing, fair prompts, proof invalidation,
pixel/provenance failures, grader validation and owner-only decisions.

`python tools/art/pipeline.py build` compiles prompts and builds the owner board from
the persisted evidence. `python tools/art/pipeline.py validate` verifies the deliverable.
`python tools/art/browser_check.py` checks actual desktop/mobile rendering and image
loads. Build/check output will be persisted. No game build exists on this branch at
the start; report that boundary honestly and run the standalone art build and tests.

## Execution evidence

The first camera proof placed the ward on an enemy. The v2 comparison gave overhead
floor layouts but repeatedly put the player's crescent behind them. A common v3 action
block names the shield's spatial relation concretely; all current arenas use that
base, with recorded front-arc or subsequent framing corrections. The unchanged camp prompt is reused
across brief metadata versions without spending again. Inputs retain their original
version/hash; content equivalence, not a rewritten history, establishes reuse.

Direct review caught errors that the local model marked clean. Its prompt-conditioned
descriptions cannot certify absorb geometry; the archived discrepancy is an explicit
limitation. The third Tessera attempt also cropped the player. Because this first
direction carried the extra global pilot, `budget.json` grants that scene one extra
framing attempt; other scene ceilings, target and hard caps remain unchanged. This
does not relax image acceptance gates. No transport or quota retry is permitted.

## Final delivery — 2026-10-02 (Europe/Prague)

Measured delivery snapshot: eight paired directions, sixteen current screens, thirty
generated attempts and thirty schema-validated local grades. Fourteen rejected or
superseded sources are preserved. The ledger records thirty image calls, zero videos,
no quota error and no stop latch. Ten images remain to the working target and ninety
to the local hard cap; the shared account's balance is not measured. Caps remain
authored only in `art/budget.json`; spending evidence lives in `art/usage.json`.

`python tools/art/check.py` passes: twenty-five unit tests, Python and prompt compile,
board build, delivery validation and Chrome desktop/mobile checks. Current delivery
validation has zero rejects and eight complete pairs; this does not mean owner
acceptance. `python tools/art/portable_check.py` passes: a disposable copy without
ignored raw files rebuilds all sixteen screens with identical hashes and no model
calls. Reports and exact command results are in `art/reports/`.

Direct pixel review covered every final source and the combined sheet. Browser checks
loaded the sixteen current screens and thirty archived sources, exercised both scene
filters and zoom, and found no page errors or horizontal overflow at desktop/mobile
sizes. There is no game build on this branch baseline and no code package was touched.

An actual local vision call on the combined paired sheet produced the advisory
shortlist: Forum in Four Inks, Tessera & Lime, Hearth Under Guard. The exact report is
hash-bound to the comparison. It remains hidden behind an optional board disclosure
so owner review need not start with a model's taste. All model judgments can only
reject or route to the owner. The model's false-clean earlier grades and visible
residual defects are retained as limitations, not described as calibrated accuracy.

The owner deliverables are `art/review/index.html`, three PNG contact sheets, the
attempt gallery and `art/ACCEPTANCE.md`. `docs/OWNER-CHECKS.md` lists the remaining
owner judgments. `art/OWNER-CHOICE.md` is pending. Human preference, felt quality,
in-motion combat readability, exact gameplay geometry, production character identity
and engine performance are not measured. No remaining A1 implementation work; stop
here for owner review. A2–A5 remain blocked on the choice. No push.
