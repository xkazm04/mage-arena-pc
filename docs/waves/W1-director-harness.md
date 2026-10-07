# W1 — headless Director harness

Design note before implementation, 2026-10-01. W0 commit: `cd29a21`.

Use npm workspaces, strict TypeScript, Vitest and ESLint. Extract the W0 reference
functions into the pure core; retain the W0 CLI as a reference adapter and require
its committed golden nights to replay without regeneration. No game or art work.

Pipeline: immutable CampState -> tent groups (excluding the selected player) ->
qualitative knowledge slices -> provider request -> complete-request hash/cache ->
atomic budget reservation -> provider -> per-item schema/domain checks -> planner
replacement -> camp-wide caps -> pure resolution with traced seeded dice.
Unknown, duplicate, missing and invalid members cannot smuggle actions through.
Bad flavour lines are repaired independently and reported separately from rejected
intents. Both rates are published; cap drops count as rejected items.

The planner scores legal candidates using goal, needs, school, relationship and
seeded small noise. Its fallback passes the same validator. It is never allowed to
reintroduce a capped intent. Caching stores raw output, and every hit is revalidated
against current state, so qualitative bucketing cannot bypass numeric preconditions.
Cache records keep the first valid response for a request key. Forced-live soak
samples bypass lookup; their individual recorded responses restore per-night cache
snapshots during offline verification. They are independent live samples, not a
single shared cache timeline. Scratch caches from measurement are not release data.
The final harness also bypasses cache writes in forced-live mode.

Model-facing facts omit numeric state. Static schema limits are transport metadata;
the model receives no editable gameplay quantities. Group members have their own
knowledge arrays. Prompt-injection-like text is treated as data. Public board facts
and personal known facts are bounded in the prompt by deterministic salience/recency;
the complete selected request is exactly what the cache hashes.

CLI verification performed first: installed Claude Code 2.1.287 exposes `--bare`,
`--json-schema`, `--tools`, `--model`, `--effort`, `--safe-mode`,
`--setting-sources`, `--strict-mcp-config`, `--no-session-persistence`.
Its help explicitly says `--bare` excludes subscription OAuth. Use `--safe-mode`
with empty tools/settings/MCP and a supplied system prompt for subscription auth;
do not silently switch to paid API credentials. Record the exact argv and duration
for every call. Sonnet is pinned to `claude-sonnet-5-5`, medium effort. No tools,
no session persistence, no retries, hard process-tree deadline.

Budget: reserve before spawning, count failed calls, durable per-run and UTC-day
ledger. The W1 profile is a separately named experiment with a hard ceiling derived
from the wave's nights and the group count. Include any development probes inside
that ceiling; no extra Sonnet judge calls. The local model supplies judge diagnostics.
The ordinary game profile retains a much smaller daily limit. No hidden reset on
process restart or day rollover can evade the run cap.

Local soak: prefer the installed `qwen3.8:27b-64k` at localhost:11434; use the
allowed `mimo-9b:q8-64k` if measured throughput makes the larger model impractical.
Run a short local prompt pilot, then freeze the prompt for the measured soak.
Every live call records raw output, duration, tokens, validation and resulting state
hash. Resume from checkpoints; cached nights cannot masquerade as live samples.
The kill decision is computed from rejected expected NPC items, including caps and
transport fallback. If the final local rate exceeds the plan's threshold after
prompt iteration, stop and report the prescribed alternatives.

The pilot stayed below the threshold, so the initial prompt was frozen for both
measured runs. Source review subsequently hardened immutable cache writes and added
planner draw logging without changing prompts, decisions, numeric rules or the
W0 fixture bytes. The report replays and logs the exact seeded planner draws for
early evidence recorded before that logging field was added.

Tests: unchanged W0 oracle; schema/intent/target/value/fact/goal/forbidden/edge/cap
cases; exactly the required hostile fuzz census with valid siblings preserved;
planner determinism and complete seasons; cache identity/corruption/revalidation;
durable budgets including failures and concurrent reservations; provider timeout,
nonzero exit, malformed envelopes and missing structured output. Owner receives
blind generated morning comparisons; no model or agent certifies feel.

Stop record: execution resumed at 2026-10-02 06:34 UTC after a requested short
wait reported more than seven hours elapsed. Cause is not established. The user’s
wall-clock window had passed, so the active local process was stopped and the
queued judge made no calls. Partial evidence is archived explicitly as partial;
W1 is not accepted as complete. One in-flight local call has no response record
and remains charged in the ledger. Do not reset that ledger to resume.

The orchestrator supplied Fable’s W0 review during the interruption. Its verdict
accepts handover with six fixes owed. Those and the lower-priority observations
are now listed in the defect register; frozen rules and fixture bytes were not
changed to hide those findings. Reported zero contradictions means the checker’s
implemented template, foreign-key and fixture checks, not semantic proof of all
free prose.

Second-session continuation is specified in `W1b-completion.md`. W0 review fixes
now have regenerated active fixtures. The original measured experiment's tables
are pinned separately so the saved 155 local and 30 subscription nights remain
exactly replayable; the resumed sample uses those same inputs. The frozen prompt
and subscription cap are unchanged. See the generated report for completion,
character diagnostics and the final pass/kill decision.
