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

- Season weeks: {{season/weeks}}; days per week: {{season/daysPerWeek}}.
- Games weekday: {{season/gamesWeekday}}; Trial offset before Games: {{season/trialOffsetBeforeGames}}.
- Waking hours: {{season/wakingHours}}, starting at {{season/wakeHour}}:00. Phases begin at hours {{season/phases}}.
- Travel costs {{season/travelHours}} hours. Activity durations in hours: {{season/activityHours}}.
- Trial: {{season/trialLocation}} at {{season/trialHour}}:00, lasting {{season/trialHours}} hours. Games: {{season/gamesHour}}:00, lasting {{season/gamesHours}} hours.
- Opening intervals are [openHour, closeHour); activities must finish by closing. Wait advances to the next phase. Night occupies the final hours and settles once.
- Schemes open on weekday {{season/schemeOpensWeekday}} through Games.
- Fourth Watch: {{season/fourthWatchLocation}} at {{season/fourthWatchHour}}:00.
- Closed intents: {{@keys/intents}}. Count: {{@count/intents}}.
- Places: {{@count/locations}}; cast: {{@count/characters/characters}}.
- Befriend base: {{rules/effects/BEFRIEND/trust}}; cross-tent peer multiplier: {{rules/effects/BEFRIEND/peerMultiplier}}.
- Aggression gap threshold: {{rules/effects/BEFRIEND/aggressionGap}}; gap multiplier: {{rules/effects/BEFRIEND/gapMultiplier}}. Apply peer then gap, floor once, symmetrically.
- Protect feeding delta: {{rules/effects/PROTECT/hunger}}. A fed Stray skips hunger growth.
- Unfed Stray growth: {{rules/effects/daily/hunger}}; working growth: {{rules/effects/daily/workingHunger}}.
- Same-tent equal-rank daily directed trust: {{rules/effects/daily/sameTentTrust}}.
- Torn-to-peers trust, reserved for arena result integration: {{rules/effects/tornToPeers/trust}}.
- Camp caps: {{rules/caps}}. Priority retains higher cunning, then alphabetically earlier actor.
- Death gameplay enabled: {{death-reservation/enabled}}. Reserved life states: {{death-reservation/lifeStates}}.

Goal plans use closed intents with argument bindings resolved against the current
actor and state; they are guidance, not a second executable vocabulary. Official
school exceptions: {{rules/officialSchools}}; these officials have no routine
school training or tent stores. Review policy: {{rules/reviewPolicy}}. Paid
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

Resolution order is {{rules/resolutionOrder}}. Reports investigate before schemes;
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
