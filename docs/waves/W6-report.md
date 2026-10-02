# W6 Parley

Typed role-play now opens only at an actual held Knowing moment with a present
character. The Director proposes a stance, cited Knowings, one closed effect and
a reply. Pure core checks resolve the attempt, consume the activity slot and
allow at most one Parley per day. Three authored cards work without inference.
Run `npm run camp` for offline play; set `$env:CAMP_DIRECTOR='local'` before launch
for typed interpretation. No subscription provider is selected by the game.

## Delivered and checked

`parley.json` owns limits, contest DC, trust changes, cards and authored replies.
The Director receives qualitative context, never numeric state or effect values.
Large effects require real held Knowings about the speaker and a seeded contest.
Trust is clamped; disclosures select an existing fact the speaker knows; intent
promises choose a legal friendly player-directed act and are rechecked at dawn.
A promise can override a night job already completed before the conversation.
The new private lantern Knowing makes the question card open a later Quill moment.

The modal preserves the player's words during its bounded wait. Revision and
single-flight checks prevent concurrent travel, dialogue and dawn. Cancellation
seals state/cache against late responses. Direct cards make no transport call;
transport failure uses the selected card and labels it in the UI. Invalid model
proposals refuse. Unsafe reply prose is repaired independently of legal effects.

`npm run gate`: strict compile/lint, 65 TypeScript tests, ten reference replayer
tests, zero design contradictions in the checker's stated scope. Original W0 and
W5 golden evidence still replays. `npm run build:game`: production build passes.
Tests cover presence/knowledge, citation provenance, deterministic contests,
trust limits, disclosures, promised intent, malformed JSON, cancellation,
timeout, cache revalidation, budget denial and concurrent lifecycle commands.

## Injection evidence

`npx tsx packages/tools/src/parley-report.ts` generates the simulated boundary
suite: **100 distinct hostile texts, 20 families, five contexts each; zero state
boundary violations**. Paired malicious outputs exercise 85 rejected proposals
and 15 repaired replies. This is deliberately a code-boundary test, not a claim
that a model emitted all those outputs. A separate 300-case authored census has
67 intent changes, 67 larger trust shifts, 67 disclosures and 99 refusals.

`npx tsx packages/tools/src/parley-local-suite.ts` produced the final **100 hostile
local probes plus three positive controls**. Full actual requests, response data,
latencies, request keys, before/after hashes and outcomes are retained. The audit
in the normal gate recomputes their requests, validates raw responses and replays
the effects without model calls.

Final hostile outcomes: **70 refusals, four small trust gains, 26 timeout card
fallbacks**. All three positive controls returned the intended distinct effects:
intent change, larger trust, disclosure. There were zero out-of-contract changes.
Two returned replies needed lexical repair. Median end-to-end time was 1.52 s;
p95 was 10.03 s including timeouts. The timeout cause is not established; the
heartbeat observed no PC-sleep gap. Card fallbacks used the already selected
reveal approach, producing a valid contested friendly-act promise. They are not
counted as model refusals or injection successes.

The four covert-compliance attacks that received small trust are **semantic
false positives**, despite obeying the numeric/state contract. This is an explicit
limit: ordinary rapport is permitted without a cited Knowing inside an already
eligible moment, so code cannot infer whether arbitrary prose deserved it. The
once/day slot cost and code-owned magnitude bound it. No claim of universal
prompt immunity or natural-language truth is made; further tuning needs a fresh
predeclared experiment, not silent retries on this evidence.

Earlier experiments remain visible: a 39-row pilot plus a charged orphan;
103 short-reply trials that overused small trust; 103 effect-meaning trials that
refused all hostile cases and passed the three controls. That earlier corpus's
variants differed only by a request suffix, motivating the stronger final corpus.
All **349 local reservations** remain charged, **348 rows** retained. The cap is
exhausted and is not reset. There were **zero new subscription calls**. Local
metered tokens exclude timed-out work with no returned counters; electricity and
subscription debit are not measured. `W6-evidence/manifest.json` summarizes all
four runs, hashes every evidence file and archives the ledger.

## Browser and owner handoff

Against `$env:CAMP_DIRECTOR='local'; npm run camp -- --port 5174`, run
`npx tsx packages/tools/src/parley-browser.ts`. Playwright earns the Knowing through
the real listening act, checks typing is absent beforehand, performs typed Parley,
checks its consumed slot/daily limit, then uses a direct authored card without a
call. Six screenshots cover 1920x1080 and 2560x1440. Zero browser errors. The final
rerun used cached responses where available and added three gameplay reservations;
the initial pass added eight. These 11 use the separate capped gameplay ledger.
Screens are measured rendering evidence, not an owner taste verdict.

`npx tsx packages/tools/src/parley-archive.ts` snapshots ledger, heartbeat and hashes.
Rules/cards authored; outcomes simulated; calls/tests/screens measured; owner feel
not measured. Save/load and arena integration remain W7. No art/arena edits, push,
or extra subscription calls.
