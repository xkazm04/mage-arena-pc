# Scoreboard - Mage Arena design

Judges: claude-claude-fable-5-1_medium

| # | Entry | Who | Mean | Spread | wow | clarity | wayfinding | interaction | craft | concept | utility | Judges |
|--:|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|---|
| 1 | B/1 | claude:claude-opus-5-5@xhigh | 7.29 | 0 | 8 | 5 | 8 | 8 | 6 | 8 | 8 | claude-claude-fable-5-1_medium: 7.29 |
| 2 | B/2 | claude:claude-opus-5-5@xhigh | 7 | 0 | 8 | 4 | 7 | 8 | 6 | 9 | 7 | claude-claude-fable-5-1_medium: 7 |
| 3 | A/1 | codex:gpt-6-astra@xhigh | 6.57 | 0 | 5 | 7 | 6 | 7 | 8 | 5 | 8 | claude-claude-fable-5-1_medium: 6.57 |
| 4 | A/2 | codex:gpt-6-astra@xhigh | 6.29 | 0 | 6 | 6 | 6 | 7 | 7 | 5 | 7 | claude-claude-fable-5-1_medium: 6.29 |

## Patterns named

- (1) Define every camp quantity by its single arena consequence and every arena result by what it writes back, so the two halves are one economy and the worked examples can show a camp choice changing a fight and a fight changing a relationship. - B/1, A/2
- (1) Give the language model a job that can fail without breaking the world: let it choose words or verbs from a closed list, let code own every number, roll and effect, and ship a deterministic planner that writes the same schema so the rest of the system cannot tell which one ran. - B/1, B/2, A/1
- (1) Make the fiction and the mechanic the same object: when the camp's magic ban, the arena's tier clock and the ending all come from one piece of lore (a collar that loosens, stones that drink), every rule the player learns is also a story beat, and no mechanic needs a separate justification. - B/1, B/2
- (1) Prove the bet before the art: the first wave should be a headless harness for the one claim the design cannot survive losing, with a numeric kill rule and a named fallback design, so a wrong bet costs a week, not a project. - B/2, B/1
- (1) Ship worked examples with a replayer: fixtures that a script actually re-executes against the stated rules catch contradictions before a coding agent inherits them as a failing golden test. - A/1, A/2

## Anti-patterns named

- (1) Deriving a second variant by changing parameters (platform, day count, slot count) in a shared document instead of changing the design question; sibling leaks and near-identical text show the reader there is one idea, and the brief scores that as one.
- (1) Engineering the risky feature out so thoroughly that it no longer matters: a reconciliation where the model picks one of three pre-compiled safe bundles is safe, but it also cannot produce the 'world moved without you' moment the owner asked for, and the report then has to list 'the model adds no value' as a risk.
- (1) Leaving the 'thing that must never break' to an owner read-through late in the plan; if sensibility is judged only by human taste at wave 7, the unattended agent has no gate that can stop it earlier.
- (1) Stating a determinism or caching property in prose while the example payload beside it violates it; the executing agent reads the payload, and a central bet that fails on its own illustration undermines trust in every other number.
- (1) Writing worked days from the narrative you want and back-filling 'rules used here' that exist in no data file; every delta in a golden fixture must be derivable from the authoritative tables, or the fixture becomes the first thing the implementing agent cannot reproduce.
