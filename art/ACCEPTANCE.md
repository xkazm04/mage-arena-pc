# Current owner boundary - session 2

Style choice: Tessera & Lime, explicitly recorded by the owner. A1 evidence below
is historical and retains its original snapshot. A1b camera evidence will live in
`review/a1b/`. A2, A4 and A5 follow A1b delivery; A3 is blocked until the owner
supplies `art/CAMERA-OK.md`. No agent or model may create that approval.
Current spend authority: `usage.json` under the 180-image weekly project cap in
`budget.json`; A1 spent 30. Shared-account remainder is not measured.

# Historical A1 delivery evidence (snapshot before owner choice)

At A1 delivery, style choice was pending. The owner subsequently chose Tessera & Lime; the evidence below preserves that earlier snapshot.
Open [the combined board](review/index.html), [paired contact sheet](review/contact-sheets/combined.png),
[arena sheet](review/contact-sheets/arena.png), or [camp sheet](review/contact-sheets/camp.png).
The board includes exact current images, direct observations, local diagnostics and
the full [attempt history](review/attempts.html).

## Measured locally

The persisted [budget snapshot](reports/budget.json), derived from `usage.json`,
records 30 reserved and generated images, 30 observed image-tool calls, no videos
and no stop incident. Remaining: 10 to the working target and 90 to the local hard
ceiling. The shared subscription's remaining allowance is **not measured**.
`budget.json` remains the cap authority; this paragraph reports the delivery snapshot.

The [delivery validation](reports/validation.json) records eight direction pairs,
exactly sixteen current images, thirty graded attempts and zero current rejects.
Fourteen rejected/superseded attempts remain visible with source bytes and reasons.
No source has been promoted to owner acceptance by a model or deterministic gate.

Reproduce without generating images:

```powershell
python tools/art/check.py
python tools/art/portable_check.py
```

The [offline gate](reports/checks.json) passes twenty-five unit tests, Python compile,
prompt compile, board build, delivery validation and actual Chrome browser checks.
Quota incidents printed by unit tests are **simulated**, not subscription incidents.
The [browser report](reports/browser-check.json) covers desktop and mobile image
loading, both scene filters, zoom, page errors and horizontal overflow, including
all thirty archived sources. The [portable check](reports/portable-check.json)
rebuilds without ignored raw files and reproduces all sixteen exported screen hashes.

There is no game package or game build on this branch baseline. No code package
was changed. These are standalone art build and test results, not engine evidence.

## Authored observations and local model diagnostics

Direction axes, prompt skeletons, UI composition and map coordinates are authored.
Sources are generated look studies, not manually painted works or game screenshots.
Exact baseline place names and time slots are drawn in code from the data files.
All final source images were directly inspected; those observations are hash-bound
in `direct-reviews.json` and exposed in the board.

The [comparative local grade](reports/comparative-ranking.json) is an actual vision
call on the paired sheet, with its input hash, model digest, schema and raw answer.
Its [shortlist](reports/ranking.json) is Forum in Four Inks, Tessera & Lime, then
Hearth Under Guard. This is diagnostic input, not a measured human preference.
Individual grades falsely described several rejected compositions as correct;
direct review overrode those grades. Human calibration has not been measured.

Remaining concept limitations include occasionally detached/dart-like spell paths,
extra lines or clash effects, the flat-print cistern's shallow appearance, and varying
confinement/contrast in the lighter camps. Static pictures cannot establish absorb
timing, the gameplay arc's exact angle, motion readability or performance.

## Historical A1 owner boundary

Felt quality and style preference are **not measured**. Owner review remains pending
in [OWNER-CHOICE.md](OWNER-CHOICE.md) and [the owner checklist](../docs/OWNER-CHECKS.md).
No A2–A5 work begins until the owner supplies a choice. A1 generation is finished;
unused working allowance is not an instruction to spend it.


# A1b delivery

[Camera board](review/a1b/index.html), [contact sheet](review/a1b/contact-sheet.jpg),
[scale contract](SCALE-CONTRACT.md), [recommendation](waves/A1b/recommendation.json).
27 generated attempts cover all 24 requested comparison cells; 18 semantic rejects
are retained and 9 route to owner review. The two pre-restart images are included
in spend, never regenerated as recovery. Recommend the second sparse-near plinth
attempt for framing only; no candidate demonstrates every gameplay requirement.
The exact absorb angle, motion, world extent and owner camera acceptance are not
measured. `CAMERA-OK.md` remains absent and A3 is blocked.

`python tools/art/waves.py check A1b` passes delivery integrity and Chrome viewport
checks at 1080p, 1440p and mobile. All 27 sources have local diagnostics and direct
observations; local models can only reject or route to the owner. Spend snapshot:
57 cumulative, 123 local-cap remaining; shared-account remainder not measured.


# A2 delivery

[Expression gallery](review/a2/portraits.html), [source board](review/a2/index.html),
[cast contact sheet](review/a2/cast-contact-sheet.jpg),
[crop manifest](delivery/a2/manifest.json). Six moods for each of 16 cast members,
96 opaque PNG panels. 18 source calls include two rejected first attempts and
their corrected replacements. Exact crop and browser gates pass; identities,
mood recognition and costume details still route to owner judgment. No A3 work.
Spend snapshot: 75 cumulative; 105 local-cap remaining, shared allowance unknown.


# A4 delivery

[Camp map](delivery/a4/camp.html), [Hollow Board](delivery/a4/hollow-board.html),
[source board](review/a4/index.html), [delivery manifest](delivery/a4/manifest.json).
Eight backdrops, six story illustrations, four scalable frame states, six map
captures at 1080p/1440p and one full-page Hollow Board capture. Data-driven slots,
closed-place controls, previews and mobile layout pass browser checks. Four local
UI diagnostics route to owner only. Night tint preserves static source residents;
these screens are art presentation, not game-state or engine evidence.
Spend snapshot: 89 cumulative / 91 local-cap remaining. A3 remains blocked.
