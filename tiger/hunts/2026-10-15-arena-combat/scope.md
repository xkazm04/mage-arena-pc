# Scope - arena combat and feel (2026-10-15)

**Thesis:** The perfect absorb is the game's signature skill, and today it is an invisible
9-tick cliff. This scope makes it a skill the player can read, retry and race, against an
opponent ladder that actually gets harder.

Council: 4 seats (Gemini, GPT, Grok, Opus), 2 rounds, 26 proposals.

**Hash rule.** Every item keeps the H1/U6c census digests and the 1,300,369-byte season replay
hash byte-identical, unless the item says it versions behaviour. H is the only one that
does, and only behind a toggle.

## Core

Build order: A → B, A → C, and D independently.

### A. Threat-answer ledger (pure core, read-only)

Every threat aimed at an actor gets a grade:
- the family (magic, steel, unblockable);
- the answer: perfect, held +n ticks, cast-blocked, wrong facing, rolled through, avoided,
  took it, or unclassified.

It feeds the Lab metrics line (a lead histogram), the Tiro results card and a per-wave
family × answer matrix in report-w4.

- **Effort:** S-M.
- **Anchors:** kernel.ts:69-95, 119-128; mage-ai.ts:21-52 (threat finder); lab.ts:173-206;
  report-w4.ts; game-shell.ts:1863-1955.
- **Verify:**
  - W2 timing bots grade 100% perfect at leads 0-8 and held +(lead-8) at lead ≥9, matching
    bots.json.
  - Census digests and the season replay hash are unchanged.
  - The training lessons (magic, physical, flanker, charge, stream) pin their expected
    answer.
- **Source:** P06, P21, P25, P15 (grading); peers 8.0.

### B. Say the answer on its frame; price slots as the kernel charges (presentation)

- On a committed ward mistake, the existing number pool shows STEEL, LEAVE, BEHIND or
  HELD +nf.
- The Flow tip names the weave, or the repeat that broke it.
- At Flow 5, slots read "0 MANA · x1.5 CREST". The line that would zero Flow carries a
  REPEAT badge.
- A perfect shows the mana, Flow and collar credit actually gained.
- Display flags and timings go in packages/game/data/combat-feedback.json. No new art.
- **Effort:** S.
- **Depends on:** A (shared grade function).
- **Anchors:** combat-feedback.ts:132-217; arena-entry.ts:743-846; water.ts:11-37.
- **Verify:**
  - Scripted contacts produce each word.
  - In a seven-cast rotation, cast seven's slot reads 0 mana and the deduction equals the
    displayed price.
  - A perfect at full mana shows +0.
  - The texture total and replay hash are unchanged.
- **Source:** P22, P16, P11, P03; peers 6.7 / 7.3 / 5.3.

### C. Take over from any frame of the Lab's 20 s replay

During V-replay, one key forks live play at the shown frame. The opponent's memory,
projectiles, rng and the Training scheduler all continue.
- A retake anchor (R) lets the owner retry the same moment.
- The fork is logged in `changes`, with one undo slot back to the pre-fork bout.
- No kernel change.
- **Effort:** S.
- **Depends on:** A for the per-retake timing grade (optional).
- **Anchors:** lab.ts:143-172; training.ts:6-40; lab-ui.ts:118-150, 814-849.
- **Verify:**
  - A headless 1,200-tick Lab bout forked at tick 600 with the same inputs deep-equals the
    uninterrupted run at tick 1200 (actors, projectiles, telegraphs, zones, rng, nextId,
    nextAttack).
  - The same test without scheduler restoration fails.
- **Source:** P07, P21, P25, P01, P14; peers 7.7.

### D. High competence plays the curve it names (monotonic ladder)

`usesTierCurve` is read for rows 3-4 only. Rows 1-2, which cover Tiro and the L2
reference, stay byte-identical.
- A plain absorb raises at impact − window − re-raise gap − 1 tick, refreshed from the
  live impact estimate. If that would land inside the window, it does not raise, so a
  failed perfect roll can never perfect.
- The AI keeps deciding (strafe, aim, cast) until the raise.
- Level 3+ prefers an unblockable when the target's ward is up or freshly raised.
- The reaction floor of 0.25 s and the perfect cap of 0.45 stay the authorities.
- **Effort:** M.
- **Anchors:** mage-ai.ts:9-16, 53-117; enemies.json:183-226; report-ladder.ts.
- **Verify:**
  - report-ladder at 500 trials gives reference wins strictly L1 > L2 > L3 > L4, with
    L4 > 0.
  - Failed perfect rolls produce zero perfects. Minimum reaction ticks ≥ ticks(0.25).
  - The 8,000-fight Tiro census hashes are unchanged.
- **Source:** P18, P02, P20, P26, P23; peers 6.7 / 4.7.

## Supporting

### E. Feel capsules

Press M in the Lab to tag a moment with the protocol's own words. Export writes:
- setup, the full tuning-change payloads and a run-compressed input tape;
- marks, data-source hashes and the final hash.

`node packages/tools/src/capsule.ts f.json` replays to the hash and prints the ledger ±2 s
around each mark. The Tiro results screen can keep a bout capsule before settlement
discards the log.
- **Effort:** M.
- **Depends on:** A (ledger window); C (shared tape).
- **Anchors:** lab.ts:52-61, 173-223; lab-ui.ts:738-751; lab-setup.ts:28-54 (moves to core);
  season.ts:123-155.
- **Verify:**
  - 20 scripted sessions with mid-bout tuning, refills and damage toggles replay in node
    to the identical hash (20/20).
  - A Tiro capsule replays to the accepted boutHash.
  - Editing combat.json makes the replayer refuse and name that file.
- **Source:** P09, P21, P25; peers 8.3 (highest).

### F. Live creatures in the Lab

Add a "live" setup value beside "still". It runs `enemyInputs` and adds shieldman and
netter to the target list. Still stays the default and is byte-identical.
- **Effort:** S.
- **Anchors:** lab-setup.ts:27-52; lab.ts:173-186; enemies.ts:32-87; lab-ui.ts:245-294.
- **Verify:**
  - Still creatures hold position for 20 steps and keep the post-death hash.
  - A live thornback charge hits a scripted in-lane stand-in and misses a sidestep.
  - A live moth drains mana through a held ward.
  - A live shieldman blocks frontal hits and takes flank hits.
- **Source:** P19, P24; peers 7.3.

### G. Rival collar rune at the duelist's feet

Mage opponents show their tier with the existing collar inscription, in dim gold. Soldiers
and creatures show none. Nothing is added to the southern rim.
- **Effort:** S.
- **Anchors:** kernel.ts:83, 267-272; arena-entry.ts:790-846; arena-scene.ts:572-579.
- **Verify:**
  - In a duel fixture the drawn rune equals actor.tier on every tick.
  - A perfect advances only the player's countdown, subject to the 6 s gap.
  - A soldier bout draws none.
- **Source:** P17, P23; peers 6.7.

### H. Two Water rivals with readable plans (Lab first, toggle for Tiro)

- Undertow closes to Lash range, commits and withdraws.
- Mirror tide holds range, budgets its ward and counters after a release.
- Engagement distances are derived from spell ranges. Weights are authored in enemies.json.
- Off by default. Turning it on for Tiro versions behaviour and reruns the census against
  the unchanged bands.
- **Effort:** M.
- **Depends on:** D.
- **Anchors:** mage-ai.ts:83-106; games.ts:33-40; runtime.json:27-31, 46-49.
- **Verify:**
  - Over 100 seeds, Undertow enters 3 m and lands Lash (today: 0 from 7 m).
  - Mirror tide completes a defend-then-counter cycle under Rain Needle pressure.
  - With plans off, census hashes are unchanged.
- **Source:** P12, P20, P23, P26; peers 6.7.

## Leaps (optional; specified enough to build)

### I. Census forecast beside every Lab tuning change

A Web Worker runs 50 seeds per wave plus 50 duels for the live tuning. Results are labelled
"simulated, reference policy, n=50".
- **Effort:** M.
- **Verify:**
  - With Current, seeds 40000-40049 reproduce the H1 census per-fight hashes.
  - 400 fights complete in ≤20 s with main-thread p95 ≤16.7 ms.
- **Source:** P08, P01; peers 7.7.

### J. Read and take over a settled Tiro bout

The results screen gains "Read the bout": the ledger timeline plus a seek over the season
log through `replayBout`. Take-over runs a practice clone, and the receipt hash stays
untouched.
- **Effort:** M.
- **Depends on:** A, C, E.
- **Verify:**
  - The state at handoff equals a fresh replay stopped on that tick.
  - The settlement hash is unchanged.
- **Source:** P15, P25, P21; peers 7.3.

### K. The player's Shade

A capped AI is fitted to the player's ledger and tape, and offered as a Lab target "Your
Shade". It is used as the census reference only after a hold-out check passes.
- **Effort:** L.
- **Depends on:** A, E.
- **Verify:** a Shade fitted to the known L3 AI reproduces its absorb rate, perfect rate and
  reaction within ±5 points and ±50 ms.
- **Source:** P10; peers 4.3.

### L. Lunges and charges that commit moving bodies

The conscript lunge and thornback charge travel along a committed lane, with swept contact.
- **Effort:** M.
- **Changes:** combat behaviour, so the save is versioned.
- **Verify:**
  - An in-lane target takes no damage before contact.
  - The census medians stay in their bands with no subsidies.
- **Source:** P13; peers 6.3.

## Left out

- **P04 (camp rivals, guile, crowd flask):** crosses into the camp, which is outside this
  hunt. Its asset premise (3D GLB bodies) is false.
- **P05 (Veteranus–Summa, Resonance):** these are the planned waves W9 and W12. Resonance
  invents Breaking rules the owner has not designed. Peers rated it 3.0.
- **P14 and P24 (drills, certified alternatives):** C and E are their foundation. The
  "verified alternative" search is unspecified.
- **P01 ghost render:** deferred. Its re-simulation core lives in I and J.
- **P02 staff interrupt** (`interruptsCasts`): the semantics against the stagger-immune tail
  are an owner decision.
