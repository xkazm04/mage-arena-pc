# Deck - challenge run 2026-10-25 (mage-arena)

Approval: **in advance** - the operator invoked the run with an explicit instruction to apply all adjustments ("apply all adjustments context by context until all done"). That approval covers the architecture/direction cards named here; no card is irreversible, policy-loosen or a VR-consumed contract (vr-replay-tools B revised to an opt-in --triage flag so the strict parity report stays the default).

30 cards, 15 build, 15 revise, 0 void by critic; 1 coordinator void (duplicate). idea_score: ambition 3.53, grounding 4.63, falsifiability 4.20.

| context | slot | title | size | risk | gate | files | critic mean | verdict |
|---|---|---|---|---|---|---|---|---|
| arena-kernel | A | One contact verdict: the kernel decides guard/perfect, the ledger reads it | M | 6 | architecture | 7 | 4.67 | build |
| art-pipeline | B | art plan <wave>: per-slot next legal action and blocker, zero spend, zero writes | M | 5 | direction | 6 | 4.67 | build |
| arena-progression-tuning | A | One mage-build seam (rows, ranks, level, apply) for Lab, Games and census | L | 6 | architecture | 9 | 4.33 | build |
| arena-render | A | ArenaSession: one driver per arena mode instead of ArenaGame's flag soup | L | 6 | architecture | 4 | 4.33 | build |
| arena-render | B | Answer cues: the ward word before the contact, graded by the kernel's own rule | M | 5 | direction | 6 | 4.33 | revise |
| art-pipeline | A | One locked spend authority: sessions, every cap and latch clears inside Budget | M | 6 | architecture | 12 | 4.33 | revise |
| audio-pipeline | B | Owner verdicts as data: ingest triage exports, show pending, derive keeps | M | 4 | direction | 5 | 4.33 | build |
| camp-season | A | One camp rulebook: each intent's legality, effect, preview and options in one row | L | 6 | architecture | 5 | 4.33 | build |
| core-census | B | census:compare - two evidence files in, the D1 before/after table out, with noise verdicts | M | 4 | direction | 4 | 4.33 | revise |
| vr-replay-tools | B | vr:drift --vectors triage: mask PC-only events, group diffs by cause, flag residue | M | 5 | direction | 8 | 4.33 | revise |
| game-shell-ui | A | Screen router: registry + navigation stack replacing the shell's hand-lists | M | 5 | architecture | 13 | 4.67 | revise |
| arena-schools-ai | B | Plan-branch ledger: the builds census says WHY each build pressed or withheld | M | 4 | direction | 6 | 4.00 | build |
| camp-season | B | Contest odds on every camp action and parley card, from the resolver's own DC | M | 5 | direction | 9 | 4.00 | revise |
| combat-lab | B | Pin a baseline: Lab forecast compares against your pinned tuning + builds | M | 5 | direction | 7 | 4.00 | revise |
| game-audio-art-data | A | Event-to-cue routing as data: one pure router replaces the arena hand-switch | M | 5 | architecture | 6 | 4.00 | build |
| game-shell-ui | B | Rebindable controls: one binding table drives input, remap screen and all hints | M | 5 | direction | 13 | 4.00 | build |
| smoke-browser-suite | A | Smoke kit: one preview lifecycle, typed harness contract, one canvas driver | L | 5 | architecture | 12 | 4.00 | revise |
| smoke-browser-suite | B | `npm run smoke` operator CLI: registry, list/status, safe parallel run, one summary | M | 4 | direction | 8 | 4.00 | build |
| arena-progression-tuning | B | Lab forecast against a pinned baseline, with a changed-knobs readout | M | 5 | direction | 9 | 4.33 | void (duplicate of combat-lab B, merged) |
| combat-lab | A | Split lab-ui.ts: Lab mode machine + shared replay transport under a thin canvas | L | 5 | architecture | 10 | 4.33 | build |
| director | B | Night ledger: show which tents the Director has decided before the player meets dawn | M | 5 | direction | 6 | 4.33 | revise |
| director | A | One Director call pipeline: harness, CampNight and Parley share source resolution | M | 5 | architecture | 5 | 4.00 | revise |
| evidence-judging | A | One evidence-record kernel: registry-driven replay-save and school census | M | 5 | architecture | 10 | 4.00 | build |
| evidence-judging | B | Owner blind read that records its verdict: capture, unblind, report | M | 5 | direction | 7 | 4.00 | revise |
| vr-replay-tools | A | One VR parity harness: shared bout builder, comparator and diff record | M | 5 | architecture | 8 | 4.00 | build |
| arena-schools-ai | A | One SchoolKit per school: derive role, shape class, resource, brain skeleton | L | 6 | architecture | 10 | 3.67 | build |
| audio-pipeline | A | One round registry + shared settle core: next audio round is a row, not 5 forks | M | 6 | architecture | 12 | 3.67 | revise |
| core-census | A | One census kernel: a fight runner with read-only observers and one report harness | M | 5 | architecture | 12 | 3.67 | revise |
| game-audio-art-data | B | Cue sheet for the owner listening pass: a scripted bout's audio, drops explained | M | 4 | direction | 5 | 3.67 | revise |
| arena-kernel | B | Compile enemy behaviour once: a typed table replaces 17 id branches and prose regex | M | 6 | architecture | 3 | 3.33 | revise |

## Waves

- W1: arena-kernel A, game-shell-ui A, director A, evidence-judging A, combat-lab A, vr-replay-tools A | side lane (no TS gate): art-pipeline A, audio-pipeline A
- W2: arena-render A, arena-progression-tuning A, arena-schools-ai A, camp-season A, arena-kernel B, vr-replay-tools B | side: art-pipeline B, audio-pipeline B
- W3: arena-render B, arena-schools-ai B, camp-season B, director B, combat-lab B, smoke-browser-suite B
- W4: game-shell-ui B, core-census A, core-census B, evidence-judging B
- W5: game-audio-art-data A
- W6: smoke-browser-suite A, game-audio-art-data B

Shared surfaces under the mkdir lock: package.json, packages/core/package.json, packages/game/package.json, packages/core/src/index.ts, packages/core/src/arena/index.ts.
