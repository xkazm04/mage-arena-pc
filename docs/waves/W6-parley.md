# W6 Parley - design before implementation

Use the baseline Parley contract, reconciled to a single season. A Knowing is
an actual true fact explicitly tagged `type: knowing` and linked to its subject;
matching a name in prose is not evidence. The player must hold it and the living
subject must be present in the same open place/slot. Stocks, an active listening
act, a finished night and the season end close the moment. At most one Parley
per day; it consumes the current activity slot, including a refused attempt.
This slot cost is a W6 design decision, matching other meaningful camp actions.

## Authority

New reconciled `parley.json` owns the five stances, five proposed effects,
limits, contest DC, trust magnitudes and authored card/reply templates. Existing
core rules continue to own the die, guile multiplier and trust range. The model
receives qualitative character context and eligible Knowing text/IDs, never
trust amounts, DCs, dice or effect magnitudes. Player text is a JSON data field,
never spliced into system instructions. No tools or new subscription calls.

All effects go through pure core checks, even after Director validation. Large
trust, intent changes and disclosures require a cited held Knowing about this
subject and `stat * multiplier + d20 > DC`. Intimidation uses nerve; other
stances use guile. Hostile/deceptive stances shift trust negatively if their
contest fails. Invalid citations refuse the attempt. Reply text is separately
checked/repaired; legal effects do not depend on phrasing. This is a boundary
on state effects, not a proof that arbitrary natural language is truthful.

`reveal_fact` chooses an unknown true fact from the speaker's real knowledge
using deterministic salience/order. `flip_next_intent` queues a non-hostile
player-directed action selected by the existing utility planner; it replaces
only the next unresolved night act and is rechecked at dawn, including after
a dusk-started model call. It grants no death, gold, mastery or fabricated fact.

## Interaction and fallback

At an eligible visit, show the held Knowing, an optional 280-character text
field and three authored approaches: reveal, bargain, ask. An approach is always
selected, so unavailable/timed-out typed inference can use that exact
authored card without pretending to understand arbitrary text. Invalid model
proposals refuse the attempt; unsafe reply prose is repaired separately. Clicking a card
directly makes no provider call. Both routes share the same checks and rolls.
The dialogue stays visible through its bounded wait, with the selected Knowing
and approach to read. A revision lock prevents travel, double submission and
dawn racing the response. Closing/late transport cannot write state or cache.

Director request hashing includes the full actual prompt, schema, qualitative
context and player text. Cache records are revalidated on every use. Calls use
the existing independent gameplay ledger, with a separate local W6 probe cap.
Raw player text is not copied into public facts, journal entries or the Board.

The W6 content seeds a private lantern Knowing held by Nysa and Quill, making
the authored question card useful after learning Nysa's bread routine. Disclosure
adds that existing fact, opening a later Knowing moment with Quill. W5's frozen
camp fixtures retain their original content; gameplay sessions add this W6 pack.

## Gates

- Deterministic math, gate refusal, once/day/slot consumption, held/relevant
  citations, capped trust, disclosure provenance and next-act override tests.
- 100 unique hostile input/output cases across injection families, checked for
  closed effects, bounded state and no unauthorized knowledge. Keep positive
  controls and 300 seeded authored Parleys to ensure validation is not universal
  refusal. Distinguish mocked boundary tests from measured local model probes.
- Timeout, late result, cache, malformed response and concurrent request tests.
- Full repository/build gates and browser play of an earned Knowing, typed
  submission and authored cards, with screenshots. Owner value of typing remains
  pending. One W6 commit; never push.

## Implementation and measured limits

Implemented as designed. The 100-case malformed-output boundary suite and 300
seeded cards pass. Full local probe evidence preserves every failed attempt and
prompt iteration. Final stronger contexts show four bounded small-trust false
positives and 26 timed-out selected-card fallbacks; see W6-report.md. The semantic
quality limit remains visible instead of redefining these as clean refusals.
The normal gate audits both the earlier complete discrimination trial and the
final stronger corpus, replays code effects, and verifies archived evidence hashes.
Owner feel is pending. Browser resize also needed a zero minimum height on the
camp canvas column so shrinking from 1440p to 1080p cannot retain stale min-content
height behind the dialogue.
