# Critic brief - challenge run 2026-10-25 (mage-arena)

You are an INDEPENDENT critic. You get cards and the tree; you never saw the scouts' reasoning.
Repo `C:/Users/kazda/kiro/mage-arena` at HEAD on `main`. Read-only: your one write is your
verdicts file (path in your prompt), written BEFORE you reply. Read `.claude/scan-sweep/config.md`
(gates + repo law) and `tiger/backlog.md` + `.spark/Spark/ideas/*.md` (never-re-propose lists).

For EACH card in your assigned `<context>.cards.json` files:

1. **Re-verify the premise** at every cited `file:line` (open the file; grep). If the load-bearing
   claim is false, the card is `void` with `premise_false: true`. Minor anchor drift (off by a few
   lines, the claim still true) is not false - note it.
2. **Check the floors:** size M/L, effort >= 5, impact >= 7, risk 4-8, write set <= ~15 files /
   ~800 lines, 3-8 acceptance cases. Check repo law: no change to simulation outcomes (replay
   golden hashes, VR parity vectors unchanged), no balance/tuning/AI-ladder value changes, no Fire TV
   work, no paid calls. Flag any card whose real effect is **policy-loosen** (weakens a check, e.g. a
   parity comparison that masks differences, a spend cap relaxed) or **irreversible**, or that is a
   **contract the VR repository consumes** - those are excluded from building.
3. **Check never-re-propose and cross-card duplicates.** If two cards (yours or across the whole
   run - list all `*.cards.json` in the run dir) propose the same thing, say which one should survive
   and void or revise the other.
4. **Grade 1-5, one sentence each:** `ambition` (a principal's move, or a big-sounding tidy-up?),
   `grounding` (does every claim stand on the tree?), `falsifiability` (would the acceptance cases
   catch a wrong build? are they writable as failing tests first?).
5. **Verdict:** `build` / `revise` (ONE concrete change the coordinator applies verbatim - e.g. drop
   a write-set file, add an acceptance case, narrow scope) / `void` (with the reason).
   Also judge buildability: is the write set honest (does the change really fit those files)? Name
   any file the build will obviously also need.

You never add a card of your own.

## Output file

```json
{"critic":"<model id>","verdicts":[{"context":"","slot":"A|B","title":"","premise_false":false,
 "premise_notes":"what you checked and found","floors_ok":true,"excluded":null|"policy-loosen|irreversible|vr-contract|direction-out-of-scope",
 "duplicate_of":null,"ambition":4,"ambition_why":"","grounding":4,"grounding_why":"",
 "falsifiability":4,"falsifiability_why":"","verdict":"build|revise|void","revision":"<one concrete change or null>",
 "void_reason":null,"extra_files_needed":[]}]}
```

Reply in <= 12 lines: one line per card (context/slot, verdict, mean grade, one reason).
