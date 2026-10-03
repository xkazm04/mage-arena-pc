# The guarded season

Active camp contract; balancing data is **authored**. Generated nights are
**simulated**. No owner feel has been certified. The archived contest reports are
historical evidence, not additional runtime authorities.

The legion betrayed its mages at the ford. The Vigil guards the camp, the collars
hold magic silent inside its walls, and the Games feed the Wardstones. The season
ends; the camp does not repeat time. Trust, knowledge, mastery and consequences
persist. The Breaking opens the Door; champion remains in Roman service; betrayal
breaks the alliance; revolt challenges the Vigil; martyr ends the player's run.
Ending resolution belongs to the later ending wave.

## Data-derived contract

- Season weeks: 6; days per week: 7.
- Games weekday: 7; Trial offset before Games: 1.
- Waking hours: 14, starting at 8:00. Phases begin at hours {"day":8,"dusk":18,"night":20}.
- Travel costs 0 hours. Activity durations in hours: {"TRAIN":2,"WORK":4,"BEFRIEND":2,"CONFIDE":1,"PROTECT":1,"WATCH":2,"SCHEME":2,"RECRUIT":2,"DEFECT":2,"REPORT":1,"PLOT":2,"REST":2,"OFFER":1,"PARLEY":2,"LISTEN":2}.
- Trial: pit at 18:00, lasting 2 hours. Games: 8:00, lasting 4 hours.
- Opening intervals are [openHour, closeHour); activities must finish by closing. Wait advances to the next phase. Night occupies the final hours and settles once.
- Schemes open on weekday 4 through Games.
- Fourth Watch: edge at 20:00.
- Closed intents: ["TRAIN","WORK","BEFRIEND","CONFIDE","PROTECT","WATCH","SCHEME","RECRUIT","DEFECT","REPORT","PLOT","REST","OFFER"]. Count: 13.
- Places: 8; cast: 16.
- Befriend base: 6; cross-tent peer multiplier: 1.5.
- Aggression gap threshold: 6; gap multiplier: 0.5. Apply peer then gap, floor once, symmetrically.
- Protect feeding delta: -30. A fed Stray skips hunger growth.
- Unfed Stray growth: 15; working growth: 8.
- Same-tent equal-rank daily directed trust: -1.
- Torn-to-peers trust, reserved for arena result integration: 10.
- Camp caps: {"SCHEME":2,"SCHEME_eve":3,"DEFECT":1,"REPORT":1,"OFFER":1}. Priority retains higher cunning, then alphabetically earlier actor.
- Death gameplay enabled: false. Reserved life states: ["Alive","Dead","Executed"].

Goal plans use closed intents with argument bindings resolved against the current
actor and state; they are guidance, not a second executable vocabulary. Official
school exceptions: {"septima":"salt","venno":"none"}; these officials have no routine
school training or tent stores. Review policy: {"rumourExcludesAuthor":true,"rumourFailsAtOrBelow":1,"protectNeedsHungerForSocialGain":true}. Paid
protection still warns a fed target, but adds no trust or debt. Rumour authors
do not react to their own claim, and minimum rumour rolls fail.

PLOT means nonlethal bond planning (player label: Plan the bond); it never creates
or advances the reserved death Plot object. Trial is a calendar event, not an intent.

## Night transaction

The request envelope describes the resolution phase qualitatively; the host records
the numeric resolution day outside the model request. Decision items contain no day.
`data/decision.schema.json` is generated from the shared schema builder and checked
against every generated proposal and accepted item. All groups see the same immutable start state. Validation precedes resolution; invalid items
use the planner. Caps apply across the whole camp, in deterministic order, after
group validation. A capped fallback cannot consume any scarce slot.

Resolution order is ["PROTECT","BEFRIEND","WORK","TRAIN","REST","CONFIDE","WATCH","REPORT","SCHEME","RECRUIT","DEFECT","PLOT","OFFER"]. Reports investigate before schemes;
this corrects the baseline's conflicting order and warning prose. Schemes compare
against the actor's last resolved attempt’s target on the preceding resolution day. A
rejected or capped item never records an attempt. Poison is nonlethal and
lasts through the next Games. Games settlement clears it in this reference model;
the arena bridge must consume its penalty before settlement.

The reference replayer resolves the main act and routine training, then hunger,
admission to tents, every eligible rivalry decay, and available bond transitions.
Each changed value records its source rule. Every random draw has a seed, day,
actor, action and result. The player is excluded from Director-controlled actions.

The model sees time in hours and qualitative character facts, never numeric character sheets, rolls, deltas or numeric
caps. Its choices contain only the closed vocabulary. Private facts stay attached
to their knowing character, rather than entering a shared group fact dictionary.
Shared group context can still influence a model implicitly; citation checks prove
only explicit fact provenance, not perfect semantic isolation.

Cache identity covers the canonical **complete provider request**: system prompt,
schema, visible facts, model identity and generation settings. Nothing seen by the
call may be omitted from the key. Identical requests share a key; changed visible
facts or prompt text must change it. No cross-day cache hit is promised.

Hollow Board facts come from resolution. Private knowledge enters the player's
journal only when known to the player. Generated flavour is never evidence that
an event succeeded. Free text is checked for digits, number words, unknown names,
instructions and banned consequences; a bad line is replaced from the phrase bank.
The bank is authored, has no model dependency and adds no mechanical outcomes.

## Verification boundary

Run `node packages/tools/replay/cli.mjs check` to compare this rendered document
with its table-backed template, lint references and vocabularies, and replay the
golden nights. Run `node --test packages/tools/replay/*.test.mjs` for planted
contradictions and content assertions. Run `node packages/tools/replay/cli.mjs build`
for source syntax checks. Generate fixtures with `node packages/tools/replay/cli.mjs generate`.

The checker is limited to the active contract and executable fixtures. It does not
prove free-prose semantics, including prose edited identically in the template and
README, or verify deferred quests.
See `defects.json` for each inherited defect and its disposition.
