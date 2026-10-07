# Deaths and endings

This file describes the reserved death system (a camp death as a guarded conspiracy, not a dice event), lethal arena bouts, and the five season endings.
Sources: `docs/MAGE-ARENA-PLAN.md` sections c (D3), d and k (Q1, Q2); `data/death-reservation.json`; `data/season.json` `endings`; arena tier data (`arena-tiers.json` Summa).

Status: **reserved, not built.** Death gameplay is disabled (`death-reservation.json` `enabled: false`). Deaths are planned for wave W10, endings for W12. Everything here is **authored** design intent.

## Principle

Order in the camp is heavily guarded (owner, 2026-10-01). A death is a conspiracy that someone, the player or a rival, must assemble over several nights. It is never something the dice hand out.

- **There is no kill intent.** The closed Director vocabulary has no assassination verb (`death-reservation.json` `deathIntent: null`). `PLOT` is nonlethal bond planning and can never create or advance a death Plot.
- Poison is nonlethal (Games penalties only).

## Data already reserved

`data/death-reservation.json` (present in every saved state since W0, with defaults):

| Field | Value |
|---|---|
| `enabled` | false |
| `lifeStates` | Alive, Dead, Executed |
| `plotStages` | means, vigil, window, cover, resolved, foiled |
| Plot fields | id, plotter, target, stage, meansNights, routineKnowing, guardRotaKnowing, guardianCompromised, isolated, witnesses, cover, result |
| Defaults | `plots: []`, `vigilAttention: 0`, `lifeState: Alive` |
| `meansSuccessesDifferentNights` | 2 |
| `window` | Games eve at dusk |
| `perfectPlanSuccessCeiling` | 0.35 |
| `npcDeathsPerSeasonTargetCeiling` | 0.15 |
| `censusSeasons` | 2,000 |

Code already respects `life` (only Alive characters act or are targeted), but nothing can change it.

## The Plot (planned, W10)

A death is the end state of a Plot object with required stages. Each stage is a normal intent with a hard precondition (plan section d):

| Stage | Requirement |
|---|---|
| 1. Means | Two successful poison or sabotage schemes on different nights, plus a Knowing about the target's routine |
| 2. The Vigil | A guardian looked away (bribe, distraction or defector). Needs gold, a Knowing of the guard rota, and a rank-contested roll |
| 3. The window | Only at dusk on a Games eve, with the target isolated (no ally in sight) and no witness |
| 4. Cover | A believable cause (an arena injury; a poisoned ration blamed on hunger). Without cover the Vigil investigates the next day and the plotter is **executed** (a real death) |

Targets and checks:

- Even a perfect plan succeeds at most 35% of the time (authored target).
- Each failed stage raises the Vigil's attention for everyone.
- NPC-on-NPC plots are possible but rare: at most 0.15 NPC deaths per season without the player, checked over 2,000 seeded seasons (a death-frequency census is a gate).
- Consequences: a crackdown (Vigil patrols raise everyone's caps; the `patrol` contest term is 0 today), trust shocks, quest chains, ending states. All numbers are to be data.

### The player as target (Q1)

Default (open question for the owner): yes, rarely. A warned player (a friend who knows) can foil it; an isolated, unwarned player can die. That death ends the run with a chronicle and the **martyr** ending.

## Arena deaths (Q2)

- Fights are not lethal by default: the crowd grants **missio** at 0 HP (`arena-tiers.json`: "Nobody dies below the Summa").
- Lethal bouts (*sine missione*) can be decreed from a high tier by the Vigil's politics, as a rare story beat. Default: from Tier III upward. Hooks are planned in W9 ("lethal-bout hooks").
- The current W7 bridge never invents a camp death from an arena result.

## Endings

`data/season.json` `endings`: five endings, computed from state.

| Ending | Meaning (reconciled README, plan) | Known condition |
|---|---|---|
| **breaking** | Two finalists of the Summa cooperate and turn the absorb mechanic on the arena: the Breaking opens the Door. "The absorb mechanic played as trust." | `arena-tiers.json` Summa final: if trust(player, finalist) ≥ 60 **and** both hold the Knowing `K-wardstones-drink`, the final can become the Breaking (a cooperative duet) |
| **champion** | The player wins and remains in Roman service | Win the Summa final as a duel (implied) |
| **betrayed** | Betrayal breaks the alliance | Attempting the Breaking with trust < 60 |
| **revolt** | The camp challenges the Vigil | Not specified in data (story pack: `dlg_revolt`, led by Fenna) |
| **martyr** | The player's run ends in death | A successful Plot against the player (Q1 default) |

The plan's opening says "four endings" but lists five; the data file is the authority (defect `ending-count`, fixed).
The story pack (in progress) also sets a sixth outcome, `collared` (refusal), and a "soft 50" Breaking threshold when `septima.cracked`. Neither is in the season data (see [open-questions.md](open-questions.md)).

Ending resolution, the Breaking duet in the arena and the epilogue cards are planned in W12 and depend on W9 (higher tiers, the Summa), W10 (deaths) and W11 (arcs).
