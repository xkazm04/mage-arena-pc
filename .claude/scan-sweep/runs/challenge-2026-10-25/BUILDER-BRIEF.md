# Builder brief - challenge run 2026-10-25 (mage-arena)

Repo: `C:/Users/kazda/kiro/mage-arena`, branch `main`, SHARED checkout (other builders are
editing disjoint files at the same time). **Commit on `main`, never push.** Your card is in
`.claude/scan-sweep/runs/challenge-2026-10-25/<context>.cards.json` (slot named in your prompt),
plus any critic revision named in your prompt (it overrides the card).

## Order - do not reorder

1. **Re-verify the premise** at HEAD (`git log -1`). False premise -> write your return file with
   `status: "demoted"`, no code.
2. **Write the acceptance cases as tests and watch them FAIL.** Run them and record how many were
   red. A case that pins behaviour that must NOT change is a *guard*: declare it as such in your
   return (`guards: [...]`) before building; it is green before by design.
3. **Build** inside the card's `write_set` (+ its tests + at most one coupled doc).
4. **Gates, each asserted by exit code** (`cmd && next`, never `cmd | tail`, never `cmd; echo $?`):
   - your new tests, then **the FULL gate from the repo root: `npm run gate`** (build + lint
     `--max-warnings 0` + every vitest file + node tests + check:design). Baseline: 649 vitest tests
     green.
   - under `packages/game/`: also `npm run build:game`.
   - `tools/art`: `cd tools/art && python -m unittest <your test modules> <test_pipeline>`.
   - `tools/audio`: `node --test tools/audio/*.test.mjs`.
   A red whole-tree gate on a path you did NOT touch is a sibling's in-flight work: wait ~1 minute,
   re-run once, then report it in `notes` instead of fixing someone else's file.
5. **Commit as a short series**, each commit green: `test(<context>): ...` then
   `feat|refactor(<context>): ...`. Body: one line `lens: <lens> (challenge 2026-10-25)` and the
   measured figures. End every message with
   `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
   **Commit ONLY with pathspecs: `git add <new files>` then `git commit -m "..." -- <paths>`.**
   Never `git add -A`/`.`/`-u`, never `git stash`, never `git reset`/`checkout` other files.
   `.ai/manifest.yaml` and `.gitignore` are dirty from the operator - never stage them.

## Shared surfaces - the lock

`package.json`, `packages/core/package.json`, `packages/game/package.json`,
`packages/core/src/index.ts`, `packages/core/src/arena/index.ts` may be edited by several builders.
Before editing one: take the lock with an atomic
`mkdir C:/Users/kazda/kiro/mage-arena/.git/scan-sweep-challenge.lock` (retry every 5 s; stale
after 10 min), make the edit (append at the END of a list, never reflow), commit it IMMEDIATELY
together with whatever it needs to compile (`git commit -- <paths>`), then `rmdir` the lock.
Never leave a shared surface uncommitted while you keep working. `.gitignore` is operator-dirty:
never edit or commit it; write run output to the OS temp dir instead of a new gitignored path.

## Repo law

- `packages/core` is a deterministic IO-free simulator (`tsconfig.purity.json`). Replay golden
  hashes and the VR parity vectors (`packages/core/src/arena/parity/`, `packages/tools/vr/vectors/`)
  must stay green UNCHANGED. Never re-pin a hash or re-record a vector: if your change needs that,
  revert and return `demoted`.
- Never change balance/tuning values, AI ladder rows or rival plans to make anything pass.
- `packages/core/src/arena/data.generated.ts` is generated (gitignored) - `npm --prefix packages/core
  run data` regenerates it; edit its sources.
- Never run Playwright smoke suites, `soak`, provider/ElevenLabs/online-Director calls.
- Never point a cache or temp dir inside the repo. Before your last commit, `git status --porcelain`
  must show none of your litter.
- Lint is `--max-warnings 0`; match the surrounding code's style and comment density.

## Demotion

Past the write set (beyond tests + one coupled doc), past size L, or a gate you cannot turn green in
two attempts -> revert YOUR uncommitted work only (`git checkout -- <your paths>`, delete your new
files) and return `demoted` with why. Already-committed green commits may stay; say so.

## Return - write it BEFORE replying

`.claude/scan-sweep/runs/challenge-2026-10-25/<context>-<slot>.result.json`:

```json
{"card":"<title>","context":"<ctx>","slot":"A|B","status":"landed|demoted|partial","shas":[],
 "tests_added":0,"cases_red_before":0,"cases_green_after":0,"guards":[],
 "gates":{"npm run gate":0,"npm run build:game":0},"files_changed":0,"lines_changed":0,
 "deviations_from_card":"","notes":""}
```

Reply in <= 8 lines: status, shas, cases red/green, gate exits.
