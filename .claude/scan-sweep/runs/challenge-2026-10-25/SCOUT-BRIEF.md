# Scout brief - challenge run 2026-10-25 (mage-arena, PC channel)

You are a READ-ONLY scout for a `--challenge` sweep. Change no tracked file. Your one write is
your cards file: `.claude/scan-sweep/runs/challenge-2026-10-25/<context>.cards.json`, written
BEFORE you reply.

## Your job

Read your context once, in full (its `file_paths` in `context-map.json`, repo root
`C:/Users/kazda/kiro/mage-arena`, base sha `2d83a1e`). Also read: `.claude/scan-sweep/config.md`
(gates + repo law), `tiger/backlog.md`, the spark ideas in `.spark/Spark/ideas/`, and whatever
`docs/` file your context's code cites as its design source (e.g. `docs/concepts/*.md`,
`docs/MAGE-ARENA-PLAN.md`). Then return EXACTLY TWO cards:

- **Slot A - `architecture-challenger`:** the structural move this context needs to stop being the
  reason something else is hard - the seam that caps it, the duplicated rule that should be one
  module, the hand-list that should be derived, the state machine hiding in booleans, the
  1,000-line file that mixes three jobs. Not a tidy-up: a principal engineer's move.
- **Slot B - `ux-elevation`:** the experience LEAP for whoever uses this context (the player, the
  owner tuning in the Lab, the operator reading a report/CLI output) - a five-step flow that should
  be one, a blind decision the code already has the data for, a status surface that should let you
  act, a missing mode (compare, undo, preview, resume). A context with no user surface fills slot B
  with a second architecture card on a DIFFERENT seam: `"slot":"B-architecture (no UI surface)"`.
  An operator-facing CLI/report output IS a user surface.

## Floors (a card below any floor is re-homed, so do not return one)

size **M or L** (never S) | effort **>= 5** | impact **>= 7** | risk **4-8** |
write set **<= ~15 files, <= ~800 changed lines**, declared up front | **3-8 acceptance cases**,
each `input -> expected`, that a builder can write as failing tests FIRST (vitest
`packages/**/*.test.ts`, `node --test` for `.mjs`, `python -m unittest` in `tools/art`).
UX cards: the cases test the logic module under the surface (state entered, action enabled,
call made), not pixels.

## Repo law - a card that breaks one is void

- `packages/core` is a deterministic, IO-free simulator. A card must not change simulation
  OUTCOMES: replay golden hashes (`packages/core/src/arena/replay-golden.test.ts`) and the VR
  parity vectors (`arena/parity/cr-*.json`, `packages/tools/vr/vectors/`) must stay green
  UNCHANGED. A refactor of the simulator is fine and those tests are its proof.
- Balance values, AI ladder rows, rival plans are owner calls - never a card's content.
- No Fire TV work. No class triangles. No paid calls (providers, ElevenLabs, Director online).
- Never re-propose: anything in `tiger/backlog.md` (kept-not-chosen C/E/K and the owner-decision
  findings) or the spark ideas. You MAY adopt a tiger "kept" item only if it is in your context and
  you cite it.
- Every claim anchored `repo/relative/path.ts:line` (as `git ls-files` prints it). Verify each one.

## Output: `<context>.cards.json`

```json
{"context":"<ctx>","scout":"<your model id>","read":["<files read in full>"],
 "cards":[{"context":"<ctx>","slot":"A","lens":"architecture-challenger",
  "title":"<= 80 chars","size":"M|L","effort":7,"impact":8,"risk":6,
  "write_set":["path", "..."],"new_files":["path"],"shared_surfaces":[],
  "acceptance":["case 1: input -> expected", "..."],
  "premise":["path:line - the fact", "..."],
  "rollback":"how the commit series reverts cleanly",
  "gate":"none|contract|policy-tighten|architecture|direction",
  "runner_up":"the slot's second-best idea, one line",
  "body":"## Summary\n...\n\n## Description\n...\n\n## Flow\n- ...\n\n## Expected impact\n...\n\n## Evaluation\nClaim: ...\nBefore: 0 of N acceptance cases pass (...)\nAfter: N of N\nMethod: gate - ...\nResult: better\nGate: ...",
  "evidence":"the exact lines / grep output / counts that prove the premise"}, {"slot":"B", "...": "..."}]}
```

`gate` is `architecture` when the card changes how the context is structured across modules, `direction`
when it adds a capability the context does not have yet (inside the PC channel's scope). Both are
buildable under this run's deck approval; say which honestly.

Reply in <= 12 lines: the two titles with size/effort/impact/risk, the runner-ups, and the cards path.
