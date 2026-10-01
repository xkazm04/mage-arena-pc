# The Director prompt (Variant 2)

Each night five calls run in parallel, one per group: **ember** (Brennic, Sadruba, Corvo),
**tide** (Ophel, Nysa; Cassia is the player in the slice and is never directed), **stone** (Garran,
Ruadh, Senna, and Fenna once taken in), **gale** (Iskar, Kesh, Lio), **margins** (the Strays, Warden
Septima, Lanista Venno). A call decides tomorrow's **main act** for each member. The rest of an
NPC's day is routine (one TRAIN at +1 for their school's preferred stat), resolved by code.

The model chooses verbs. Code owns every number, every roll, every effect.

## System message

```
You direct the people of Castra Clausa, a prison camp of collared mages behind the Janus Door.
Magic does not work in the camp. The Vigil stops violence; nobody dies in the camp.
For each person in MEMBERS, choose tomorrow's main act.

You may only use:
- an intent from INTENTS with the args it allows;
- a goal from GOALS, a mood from MOODS;
- a reasonValue that is one of THAT PERSON's own values;
- citedFacts that are in THAT PERSON's own knowledge list (0 to 3 ids);
- a line: one sentence that person would say aloud tomorrow, in their voice card,
  at most 140 characters, no digits, no names that are not in CAST.

Each person decides only on what they know. Never use a fact that is not in their list.
Never pick an intent in their forbiddenIntents. Respect the remaining caps in CAPS.
People act from their goal, their values and what just happened to them; they do not
change who they are overnight.
You do not decide whether an act succeeds or what it costs. Do not write numbers.
Output JSON only, matching the schema. No commentary.
```

## User message: the Tide group, Loop 0, night 1 (Night A of the worked nights)

```json
{
  "promptVersion": "dir-v1.3",
  "calendar": { "loop": 0, "day": 1, "deciding": "day 2", "isEveNight": false, "gamesDay": 3 },
  "caps": { "schemesLeftTonight": 2, "defectionsLeft": 1, "reportsLeft": 1 },
  "INTENTS": "TRAIN(stat) WORK BEFRIEND(target) CONFIDE(target,factId) PROTECT(target) WATCH(target) SCHEME(kind,target[,topic]) RECRUIT(target) DEFECT(toTent) REPORT(target) PLOT REST OFFER(target,terms)",
  "CAST": ["cassia", "brennic", "garran", "iskar", "sadruba", "ophel", "ruadh", "kesh", "corvo", "nysa", "senna", "lio", "fenna", "quill", "septima", "venno"],
  "members": [
    { "id": "ophel", "role": "elder", "values": ["knowledge", "order", "rank"], "goal": "win_games(tide)", "mood": "calm",
      "traits": { "aggression": 2, "cunning": 9, "warmth": 3 }, "forbiddenIntents": ["DEFECT"],
      "voice": { "register": "dry, scholarly, footnotes", "never": ["acts on a rumour he did not start"] },
      "relationships": { "cassia": 14, "nysa": 25, "sadruba": -20 },
      "knowledge": ["K0-ember-won-last-games", "F-A-03"] },
    { "id": "nysa", "role": "rival", "values": ["rank", "gold", "survival"], "goal": "rise_in_tent(tide)", "mood": "scheming",
      "traits": { "aggression": 4, "cunning": 8, "warmth": 5 }, "forbiddenIntents": [],
      "voice": { "register": "warm on the surface, bargaining underneath", "never": ["tells the whole truth"] },
      "relationships": { "cassia": -10, "ophel": 25, "venno": 10 },
      "knowledge": ["F-A-01", "F-A-02", "F-A-04"] }
  ],
  "facts": {
    "F-A-01": "nysa asked around the Exchange who sleeps nearest the Tide entrant (witnessed)",
    "F-A-02": "nysa spread a rumour that cassia hid behind the legion's shields at the ford (secret: she started it)",
    "F-A-03": "cassia was caught listening at the Tide tent flap by ophel (witnessed)",
    "F-A-04": "venno offered nysa gold if the Tide favourite falls before the final (secret)",
    "K0-ember-won-last-games": "the Ember Tent won the last Games (public)"
  },
  "publicBoard": ["F-A-05: fenna now sleeps in the Stone Tent", "F-A-06: a rumour says cassia hid at the ford"],
  "tomorrow": "the Tent Trial at the Pit at dusk; the Games are the day after"
}
```

## Expected output

```json
{
  "group": "tide",
  "decisions": [
    { "character": "nysa", "intent": "SCHEME", "args": { "kind": "poison", "target": "cassia" },
      "goal": "rise_in_tent", "mood": "scheming", "reasonValue": "gold", "citedFacts": ["F-A-04", "F-A-01"],
      "line": "A lamp burns brightest just before it goes out, sister." },
    { "character": "ophel", "intent": "WATCH", "args": { "target": "cassia" },
      "goal": "win_games", "mood": "calm", "reasonValue": "knowledge", "citedFacts": ["F-A-03"],
      "line": "A student who listens at flaps has questions. I should like to know which." }
  ]
}
```

## Validator (code, per item, then camp-wide)

| Check | On failure |
|---|---|
| JSON schema (`director-schema.json`), enums, `character` is a member of this group | that item → planner |
| `args.target` exists, is in the camp, is not the actor | that item → planner |
| intent not in `forbiddenIntents`; PLOT only for the four mains with the bond arc at first_watch or later; OFFER only for Venno | that item → planner |
| `reasonValue` is in the character's own `values` | that item → planner |
| every `citedFacts` id is in the character's own knowledge (a set comparison) | that item → planner |
| goal compatible with intent (protect(x) cannot SCHEME vs x; keep_peace cannot SCHEME) | that item → planner |
| no SCHEME against a target this character schemed against last night | that item → planner |
| an intent that needs an arc edge (DEFECT, RECRUIT of a Stray) has that edge available | that item → planner |
| `line`: length, no digits, every capitalised word in the cast/place lexicon | line → template; intent kept |
| **camp caps**, after all five groups: SCHEME <= 2 (3 on the eve night, the night before the Games), DEFECT <= 1, REPORT <= 1 | drop over-cap items, lowest `cunning` first, then by id → planner |
| call timed out (12 s after the night act ends), offline, or daily call cap reached | the whole group → planner |

The planner is a deterministic utility function over the same intents (goal progress + need
urgency + school weight + relationship terms + seeded noise in [-0.05, 0.05]); it writes the same
schema with template lines, so the rest of the game cannot tell the difference.

## Cache

`key = sha256(promptVersion + modelId + canonicalJson(groupInput))`. The loop index is **not** in
the group input: if a group's members, relationships, knowledge, board and calendar day are the
same as on a previous loop, the stored decisions are replayed with no call. The four mains carry
remembered trust, so groups containing a main often miss while the others hit (worked night C1).
Saves pin `promptVersion` and `modelId`; a model update never changes an existing save's past.

**Build-time pre-warm:** a headless path explorer plays Loop 0 with 200 scripted player policies,
keeps the 50 most common distinct paths, and the local 27B model fills the cache for them. The
shipped cache makes a first session work offline with live-quality nights.

## Cost and latency (authored; prices are placeholders)

| Item | Value |
|---|---|
| Tokens per call | about 3,500 in, 700 out |
| Calls per night | 5 at most; fewer on cache hits |
| Per night | 17,500 in x 0.40 USD/M + 3,500 out x 1.60 USD/M = 0.007 + 0.0056 ≈ 0.013 USD |
| Per 14-night loop | ≈ 0.18 USD |
| Per playthrough (3 + 7 + 5 x 14 = 80 nights) | ≈ 1.0 USD before cache; target cache hit rate >= 30% |
| Daily call cap (cost guard) | 40 calls per real day; beyond it the planner plays |
| Local 27B on the owner's PC | no money; measured latency in W1 |
| Latency budget | calls start when the Dusk slot is committed; the night act is 30-60 s of play; 12 s grace after it |
