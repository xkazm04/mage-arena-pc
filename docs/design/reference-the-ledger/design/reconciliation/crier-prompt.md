# The Crier prompt (Variant 1)

The Crier turns the Night Ledger into the Dawn Board. **It decides nothing.** Code has already
decided what happened, who knows it, and which 3 to 5 facts the board shows (salience order).
The Crier only chooses words. The same prompt is used in two places:

1. **At build time** (the default, ships offline): a local 27B model runs this prompt over every
   fact type x speaker voice x tone combination with placeholder slots (`{actor}`, `{target}`,
   `{place}`), producing the **phrase bank** (target 6 phrasings per combination, about 3,000 lines
   for the full game). The bank is validated (below) and committed as data.
2. **At run time, optional** ("Live voice" setting, off by default): the same prompt with the real
   facts, sent to a small cloud model or a local model. If the call is slow (> 4 s), fails, or its
   output fails validation, the board is filled from the bank. The player never waits.

## System message

```
You are the Crier of Castra Clausa, a prison camp of collared mages behind a magic Door.
You write the Dawn Board: short lines that camp people say to each other at the morning fire.
You are given FACTS that already happened. You may only retell them.

Rules you must follow:
- Use only the people, places and facts given. Never invent a person, a place, an event,
  a number, a cause, or a consequence that is not in a fact.
- Every item cites the factIds it retells.
- Secret facts are never told. Witnessed facts are told as gossip ("they say", "someone saw").
- A fact with "true": false is a rumour. Tell it as a rumour, never as truth.
- When a speaker is given, write in that speaker's voice card; never break their "never" list.
- Headline <= 70 characters. Line <= 160 characters. Plain words. No modern slang.
- No magic happens inside the camp. No one dies in the camp.
- Output JSON only, matching the schema. No commentary.
```

## User message (filled per night; this is night 1 of the worked days)

```json
{
  "day": 2,
  "playerCharacter": "brennic",
  "boardSlots": 4,
  "facts": [
    { "id": "F1-01", "type": "joined_tent", "actors": ["fenna"], "targets": ["stone"], "place": "ditch", "true": true, "visibility": "public", "salience": 8, "aboutPlayer": false,
      "context": { "playerWalkedPastActorYesterday": true, "helper": "pell" } },
    { "id": "F1-02", "type": "rumour", "actors": ["corvo"], "targets": ["brennic"], "topic": "cowardice", "true": false, "visibility": "witnessed", "salience": 9, "aboutPlayer": true,
      "context": { "claim": "brennic ran from the barbarians at the ford", "starterKnownToPlayer": false } },
    { "id": "F1-03", "type": "helped", "actors": ["pell"], "targets": ["fenna"], "place": "ditch", "true": true, "visibility": "public", "salience": 4 },
    { "id": "F1-04", "type": "bond_event", "actors": ["garran", "quill"], "place": "well", "true": true, "visibility": "witnessed", "salience": 5 }
  ],
  "voices": {
    "tilla": { "register": "eager, breathless", "never": ["sits still"] },
    "pell": { "register": "gentle, simple", "never": ["lies"] },
    "quill": { "register": "riddling, half-mad", "never": ["says what he knows for free"] }
  },
  "speakerSuggestions": { "F1-01": "pell", "F1-02": "tilla", "F1-04": null }
}
```

## Expected output

```json
{
  "items": [
    { "factIds": ["F1-01", "F1-03"], "headline": "Fenna sleeps in the Stone Tent now",
      "line": "Pell gave her his bread at the Ditch, and Elder Ruadh gave her a blanket. She did not look at you when she passed.",
      "speaker": "pell", "tone": "plain" },
    { "factIds": ["F1-02"], "headline": "A rumour about you: you ran at the ford",
      "line": "Tilla, breathless: 'They say the new Fire ran from the barbarians! Did you? Someone at the Pit says so.'",
      "speaker": "tilla", "tone": "gossip" },
    { "factIds": ["F1-04"], "headline": "Garran sat with Old Quill at the Well",
      "line": "Someone saw them by the dry stones until the fires died. Quill was talking to the stones again.",
      "tone": "gossip" }
  ]
}
```

Note: the line "She did not look at you when she passed" is allowed only because the fact's
context says the player walked past her (`playerWalkedPastActorYesterday`). The validator checks
that kind of reference against the context keys, not against the text's meaning.

## Validator (code, runs on bank lines at build time and on live output at run time)

| Check | How | On failure |
|---|---|---|
| Schema | JSON schema `night-ledger-schema.json#/properties/board` | whole board from bank |
| Cited facts exist and are not secret | every `factIds[]` is in the night's selected facts and `visibility != secret` | drop item, refill from bank |
| No unknown names | tokenise; every capitalised word is in the cast/place/tent lexicon or a stop list | drop item |
| No unknown numbers | every digit sequence appears in a cited fact | drop item |
| Rumour framing | a fact with `true: false` must be retold with a hedge word from a list ("they say", "rumour", "someone says", "word is") | drop item |
| Voice "never" list | a per-character banned-pattern list (e.g. Pell: no lie markers; Septima: no first person) | drop item |
| Length | headline <= 70, line <= 160 characters | truncate at a word; if still invalid, drop |
| Coverage | every board slot is filled | fill from bank |

**Bank coverage linter** (build time): every `fact type x tone` pair has at least 4 valid phrasings,
every phrasing's slots are fillable by every actor kind that the planner can produce for that fact
type. A pair below 4 fails the build.

## Cost (authored estimate, prices are placeholders)

- Build time: about 3,000 lines over about 500 prompts on the local 27B model: GPU hours only, no API cost.
- Run time, Live voice on: 1 call per night, about 2,200 input and 450 output tokens. At a placeholder
  price of 0.50 USD per million input tokens and 2.00 USD per million output tokens: about 0.002 USD a
  night, about 0.08 USD for a 42-day season. Live voice off (default): zero.
- Latency: the call starts when the player commits the evening slot and has the whole Night scene
  (about 20 s of animation and the ledger reveal) to return; a 4 s cut-off after the scene ends.
