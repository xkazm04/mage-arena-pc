# Season bridge (camp ↔ arena)

This file describes the contract between the camp and the arena: when the Tent Trial and the Games happen, how the Trial picks the entrant, how camp state becomes the arena fighter, and which rewards and consequences flow back.
Sources: `data/season-bridge.json`, `packages/core/src/season.ts`, wave W7 (`docs/waves/W7-integration-plan.md`, `W7-execution.md`, `W7-report.md`), arena tier data `docs/design/reconciled/data/arena/arena-tiers.json` and `stats.csv` (copied under `../gameplay/`).

Status: built for weeks 1-2, Water/Cassia, Tiro Games only (W7; automated gates PASS). Gate G1 (the owner plays weeks 1-2) is open. Bridge numbers are **authored**.

## Scope of the current chapter

| Field | Value | Source |
|---|---|---|
| Playable school | water | `season-bridge.json` `playableSchool` |
| Playable character | cassia | `playableCharacter` |
| Playable weeks | 2 (days 1-14; day 15 closes the chapter) | `weeksPlayable` |
| Games tier | Tiro only; mastery does not unlock tiers that are not built | W7 execution note |

Fire, Earth and Air mains are camp allies only. Higher tiers, other schools and endings are later waves.

## State machine

`camp → (Trial at eve dusk) → camp → (Games morning) prepared bout → active / intermission → terminal result → receipt → camp`

- A pending bout locks travel, waiting, Parley and dawn.
- Each Trial or Games result becomes a **receipt** with a unique id (`trial:{seed}:{day}`, `games:{seed}:{day}`). A receipt applies once. Reloading or navigating cannot reroll the day.
- The server derives the result by replaying the seeded bout inputs. It never accepts client-sent payouts or a client claim of victory. Inputs must be ordered, allowed and bounded; state hashes must match.
- Training and the Combat Feel Lab are separate routes and can never grant season rewards.

## Tent Trial

When: Games eve (weekday 6) at 18:00 at the Pit, once per day, lasting 2 hours. If the player cannot travel (stocks, or no time), a guard escorts them to the Pit; stocks, hours and stats stay as they are. This prevents a soft lock.

Form: an **unarmed best-of-three stamina exchange** against the player's same-school, same-rank rival (Cassia vs Nysa), judged by the tent elder.

| Rule | Value (`season-bridge.json` `trial`) |
|---|---|
| Stances | press, brace, feint |
| Beats | press beats feint; brace beats press; feint beats brace |
| Stamina cost | press 18, brace 8, feint 12 |
| Win | 2 exchanges, or best after 3 |
| Exchange total | d20 + (vigor + nerve) × 2 + 12 if your stance beats theirs − 8 if you could not pay the stamina |
| Starting stamina | each fighter's arena max stamina (from the camp snapshot) |
| Opponent choice | seeded per exchange (`trialTell`) |
| Respect | the rival's trust toward the player +3 after the Trial |

**Entrant score** (`arena-tiers.json` `tentTrial.score`): bout result 50% + elder's trust in the fighter 30% (trust / 100) + renown 20% (renown / 100). The higher score is the tent's entrant.
If the player loses the selection, they watch the rival's deterministic Water bout from the benches and get no gold or renown.

A public fact announces the entrant: "{name} carries the Tide into tomorrow's Tiro Games."

## From camp to arena fighter

`campPlayerSnapshot` builds the arena fighter from camp state:

| Camp value | Arena effect |
|---|---|
| vigor rank | max HP = 80 + 15 × rank; max stamina = 60 + 10 × rank (`stats.csv`) |
| focus rank | max mana = 80 + 15 × rank; mana regen = 6 + 1.5 × rank per second |
| nerve rank | absorb drain = 30 − 3 × rank mana per second held; perfect-absorb return × (1 + 0.1 × rank) |
| mastery | allowed composition (spell lines and branches) |
| fatigue | −2 stamina per fatigue point (`fatigueStaminaPerPoint`) |
| sick (poison) | −10 HP and −20 stamina (`rules.json` `schemes.poison`) |

Poison is applied before its expiry at Games-day settlement, so it cannot vanish before the bout. Only a living Water character can enter in this chapter. Guile has no arena formula in the current build (`stats.csv` lists scouting reveal as its arena effect; not built).

## Games

When: weekday 7, 08:00, lasting 4 camp hours regardless of real fight length. Needs the previous day's Trial receipt.
Tiro Games waves (soldiers, creatures, semifinal, final) are defined on the gameplay side. The bout seed comes from `(seed, day, entrant, "tiro-bout")`.

### Results and rewards

`GamesResult`: `kind` (missio or champion), `wavesCleared`, `gold`, `renown`, `finalReached`, `finalWon`. Arena "champion" means winning this bout, not the season ending.

| Reward | Value | Applies when |
|---|---|---|
| Gold | Tiro payout for 1 / 2 / 3 / 4 waves cleared: 20 / 40 / 60 / 100; 0 waves → 0 (`arena-tiers.json` `tiro.payoutGold`, `packages/core/src/arena/games.ts` `gamesResult`) | Player was the entrant |
| Renown | 1 / 2 / 3 / 4 waves cleared: 5 / 10 / 15 / 25 (`tiro.renown`) | Player was the entrant |
| Other mains' trust in the player | +3 if the final was won, +1 otherwise (`aftermath`) | Player was the entrant |
| Rumour fact (truth false) | champion: "Some say the Tide has found a crack in the collar. The story outruns its proof." / missio: "Some say the Tide saved its strength for another gate. Nobody agrees why." | Player was the entrant |
| Result fact | "{name} returns from the Tiro Games with the victor's wreath / under missio." | Always |

Fights below the Summa are not lethal: a fighter at 0 HP gets **missio**. Lethal bouts are reserved (see [deaths-and-endings.md](deaths-and-endings.md)).

### Not yet bridged

- Mastery gain from the Games (tier data says "+1: win a final, or reach a final twice"). Not wired in W7.
- Torn-to-peers and torn-to-strangers trust (duality bouts between tents). Reserved.
- Gear bought with gold (talisman, garment in `stats.csv`). Not built.
- Higher tiers (Veteranus, Primus, Summa) and the Summa's ending condition.

## Save and replay guarantees (W7, measured)

- Saves are versioned, size-bounded and checked against the source version; they are replaced atomically with a previous-good recovery slot.
- Arena references are saved as ids and replayed independently before load or reward.
- Seed 73 with identical inputs gives a byte-identical save envelope (1,296,151 bytes); a reload re-encodes byte-identically.
- A 30-minute browser soak ran 60 days (four full two-week seasons plus four days) with no errors (simulated inputs, not human play).
