# Opponents and arena tiers

Purpose: defines the enemy roster (soldiers, creatures, AI mages), how mage AI competence works, the structure of a Games day (four bouts), the arena tiers, payouts, and the pacing census used as the balance gate.
Status: roster and Tiro Games built (W4, W7 pacing, CF2 AI, H1). Veteranus, Primus and the Summa are designed in data but **not playable** (planned W9). Lethal bouts are reserved. Values are authored; pacing is simulated; difficulty is not owner-felt.

Sources: [data/arena-design/enemies.json](data/arena-design/enemies.json), [arena-tiers.json](data/arena-design/arena-tiers.json), [runtime.json](data/arena-runtime/runtime.json) `games`, [feel.json](data/arena-runtime/feel.json) `ai`, `packages/core/src/arena/{enemies,mage-ai,games}.ts`, W4, W7, CF2, H1 reports.

## Threat design principle

"Three threat families, three answers: magic is absorbed (if you face it), steel is rolled, unblockable is left or broken." Every enemy teaches one lesson. See [ward-and-absorb.md](ward-and-absorb.md).

## Soldiers (Roman legion, non-magical)

| Id | Name | HP | Speed m/s | Attack | Family | Damage | Windup s | Other | Poise | Teaches |
|---|---|---|---|---|---|---|---|---|---|---|
| conscript | Hastatus conscript | 38 | 3.8 | spear lunge, range 2.0 m | physical | 10 | 0.6 | recovery 0.5 s, then backs off 1 s (3 m); sprints with real stamina while approaching | 1 | roll timing |
| shieldman | Scutum bearer | 70 | 3.0 | shield bash, range 1.5 m | physical | 8 | 0.7 | recovery 0.6 s; front 120° blocks direct hits completely; areas and flanks bypass | 1.8 | flank or use area damage |
| slinger | Funditor | 28 | 3.6 | sling stone, 14 m/s, range 24 m | physical | 7 | 0.5 | cooldown 2.2 s; keeps 8–10 m; plants to fire, 0.8 s reload; retreats when crowded | 1 | close distance; priority target |
| netter | Net-thrower | 45 | 3.4 | net cast, ring 2.5 m, range 10 m | physical | 0, root 1.0 s | 0.8 | cooldown 6 s; then conscripts converge | 1 | roll out of a telegraph |

## Creatures

| Id | Name | HP | Speed m/s | Attack | Family | Damage | Windup s | Other | Poise | Teaches |
|---|---|---|---|---|---|---|---|---|---|---|
| cinder_hound | Cinder hound | 25 | 6.0 | bite | physical | 6 | 0.35 | pack of 3; only 2 engage at once (nearest), the third circles at 3.5 m; **on death** ember burst: magic tier 0, 5 damage, r 1.5 m, after 0.6 s | 1 | perfect absorb on death bursts |
| mire_maw | Mire maw | 100 | 1.5 | bog glob, 9 m/s | magic tier 1 | 14 | 0.7 | stationary artillery, cooldown 3.5 s | 2 | absorb a slow projectile |
| | | | | tongue pull, line 10 m × 0.7 m | physical | 4, pull 4 m | 1.0 | line telegraph | | leave a line telegraph |
| thornback | Thornback | 140 | 2.2 | thorn charge, lane 2 m × 12 m | unblockable | 22 | 1.0 | cooldown 5 s; self-stun 1.5 s if it hits the wall; Rain Needle deals × 0.5 | 2.3 | leave the lane, punish the stun |
| hush_moth | Hush moth | 8 | 3.0 | mana sip on contact | physical | 0, drains 6 mana/s | 0 | pack of 6; drifts toward whoever holds the ward | 1 | the ward is not always the answer; use area spells |

Shared roster rules (`runtime.json/games`): default melee range 1.2 m, melee arc 80°, default recovery 1.1 s, contact range 0.8 m, separation 1 m (weight 1.1). Enemies face their committed attack point during windup. Staff strikes interrupt windups. No enemy reads future player input.

## AI mages

AI mages use the **same kernel** as the player: same spells, ward, tier clock and resources. The AI produces the same input frame as mouse and keyboard and has no direct authority over HP, mana, damage or cooldowns. Competence is "a dial with human-plausible caps, never extra stats".

| Level | Reaction delay s | Ward chance vs absorbable | Perfect chance | Aim error ° | Decision cadence s | Tier play |
|---|---|---|---|---|---|---|
| 1 | 0.55 | 0.40 | 0.05 | 12 | 0.50 | random |
| 2 | 0.45 | 0.60 | 0.15 | 8 | 0.40 | holds the best spell for its tier |
| 3 | 0.35 | 0.75 | 0.30 | 5 | 0.35 | baits absorbs before unblockables |
| 4 | 0.30 | 0.85 | 0.40 | 3 | 0.30 | full curve play |

Caps: reaction delay never below 0.25 s; perfect chance never above 0.45. Fractional competence (Tiro final 1.5) interpolates between rows.

Behaviour (W4, CF2):

- Preferred distance 5–8 m, scaled by aggression (`× (1.3 − 0.3 × aggression)`) plus a seeded spacing variation of ±0.75 m (`feel.json/ai/spacingVariationM` 1.5); strafe period 2.4 s with a seeded phase (1.7 s); aim lead 45% of predicted travel; defence hold 0.35 s.
- A new threat cannot be answered before the reaction delay from when it was first seen. Travel time uses the actual pending spell profile.
- The AI avoids starting a cast it cannot finish before a planned ward (safety 0.05 s). Spell choice is weighted by usefulness and variety (weight 8).
- Aggression (0–1) is the chance to cast when a cast is possible.
- Fog Bank blocks target acquisition; Mirage redirects aim.
- Season mage opponents are **Water proxies** using the Undertow or Mirror tide presets, labelled as training proxies until W8.

Known issue: level 4 over-defends and can win less often than level 3 (W4 ladder, logged for W9).

## A Games day (bout lifecycle)

- Four bouts (waves) in order. Composition is locked for all four.
- Spawns: player at (8, 10), enemies anchored at (24, 10) on a sparse grid with ≥ 6 m separation, jitter 0.8 m; multi-enemy waves start 8 m closer; slingers take front positions so a priority target is reachable at once.
- A bout is won when the player is alive, all opponents are DEFEATED and remaining hostile hazards (for example hound bursts) have resolved. A simultaneous defeat is a loss.
- Win → intermission → "Enter the next bout": heal 30% of missing HP, refill mana and stamina, reset the collar.
- Loss → **missio**: the crowd spares the player; that Games day ends.
- Payout: gold and renown of the **highest completed wave** (not summed). Results are idempotent and replayed by the server before they apply.
- Safety timeout 180 s (`fightTimeoutS`), not a forced outcome.

## Tiers

Source: `arena-tiers.json`. Only Tiro is playable; mastery is not awarded yet.

| Tier | Requires mastery | Wave 1 | Wave 2 | Wave 3 (semifinal) | Wave 4 (final) | Gold by highest wave | Renown by highest wave | Status |
|---|---|---|---|---|---|---|---|---|
| Tiro Games | 1 | 4 conscript + 2 slinger | 3 cinder hound + 1 mire maw | mage of another tent, competence 1 | winner of other semifinal, competence 1.5 | 20 / 40 / 60 / 100 | 5 / 10 / 15 / 25 | built |
| Veteranus Games | 2 | 2 shieldman + 3 conscript + 1 netter | 1 thornback + 6 hush moth | mage, competence 2 | mage, competence 2.5 | 30 / 60 / 90 / 150 | 6 / 12 / 18 / 30 | planned W9 |
| Primus Games | 3 | 2 shieldman + 2 slinger + 3 cinder hound | 2 thornback + 1 mire maw | mage, competence 3 | champion of another tent, competence 3.5 | 40 / 80 / 120 / 200 | 8 / 15 / 22 / 35 | planned W9 |
| The Summa (Grand Games) | 4 | best entrant by standing, competence 4 | other finalist, competence 4 — final or **the Breaking** | — | — | 0 / 0 | 20 / 50 | planned W9/W12 |

Rank-up rule (data): mastery +1 for winning a final, or reaching a final twice. The Summa final can become the Breaking (a cooperative duet that destroys the arena) if trust(player, finalist) ≥ 60 and both hold the Knowing `K-wardstones-drink`; attempted with lower trust it becomes the Betrayed ending. See [../campaign/deaths-and-endings.md](../campaign/deaths-and-endings.md).

Arena palettes per Games (U5): Games 1–2 verdigris, 3–4 rust-sand, 5–6 moonlit.

## Lethal bouts and arena deaths (reserved)

- Default: no one dies in the arena below the Summa; a loss is missio.
- Plan section d and open question Q2: lethal bouts (sine missione) may be decreed from Tier III upward by the Vigil's politics as rare story beats. Not built; planned with W9/W10. Camp deaths are a campaign topic: [../campaign/deaths-and-endings.md](../campaign/deaths-and-endings.md).

## Pacing census (the balance gate)

Command: `npm --prefix packages/core run report:w4 -- --evidence <dir> --tag census`. 2,000 seeded fights per Tiro wave (seeds from 40000), a fixed reference controller (Water Rotation, competence 2, rank-one stats) against the wave. Gate: completed-bout median inside the wave's target band, timeouts ≤ 1%, no player defeat before 5 s, finite states, exact replay of sampled seeds. Losing seeds and tails are always kept.

Current target bands (`arena-tiers.json/tiers/tiro/waves/targetDurationS`) and the latest census (H1, `H1-evidence/census.json`):

| Wave | Target band s | Median s | In-band fraction | Notes |
|---|---|---|---|---|
| Soldiers | 25–45 | 36.03 | ≈ 90% | p90 43.85 |
| Creatures | 35–60 | 45.93 | ≈ 90% | p10 37.43, p90 55.78 |
| Semifinal | 45–75 | 57.10 | ≈ 88% | reference win rate fell to about 38% in CF2 |
| Final | 45–80 | 62.00 | ≈ 93% | reference win rate about 40% in CF2 |

Zero timeouts, invalid states, replay failures or early player defeats. These are simulated reference-policy numbers, not a human skill model. **Difficulty is an open owner check** (CF2: reference duel wins dropped from 91% / 70% to 38% / 40% after the feel pass).

History of the bands and medians:

Target bands by stage (s):

| Stage | Soldiers | Creatures | Semifinal | Final |
|---|---|---|---|---|
| W4–W7 (original) | 25–40 | 30–45 | 45–70 | 45–80 |
| U5 | 25–40 | 30–46 | 45–70 | 45–80 |
| CF2 | 25–40 | 30–48 | 45–75 | 45–85 |
| H1 (current data) | 25–45 | 35–60 | 45–75 | 45–80 |

Census medians by stage (s):

| Stage | Soldiers | Creatures | Semifinal | Final |
|---|---|---|---|---|
| W4 compact court | 37.58 | 40.48 | 46.37 | 58.13 |
| W4b large oval (FAIL) | 44.38 | 45.55 | 45.48 | 58.00 |
| W7 pacing fix | 38.23 | 44.63 | 45.48 | 58.00 |
| U5 compact ellipse | 38.48 | 45.08 | 45.48 | 58.00 |
| CF2 feel pass | 36.02 | 45.85 | 60.88 | 67.35 |
| H1 hit reactions (current) | 36.03 | 45.93 | 57.10 | 62.00 |

Note: `combat.json/pacingTargets` (soldier 25–40, creature 30–48, duel 45–85) is an older copy used only for the dead-air bucket size (2 s). The census uses `arena-tiers.json`. See [open-questions.md](open-questions.md).

## Superseded

| Old | Current | Source |
|---|---|---|
| The Echo (your previous-loop self as a semifinal opponent), `orEchoFromLoop` fields | Removed with loops; no Echo in a season | D2, W4 |
| "Games are the last day of every loop" | Games every 7th day of a six-week season | D2 |
| Tent Trial "loop day 2" | Day 6 and 13 at 18:00 | season.json |
| Slingers orbiting at range 24 m | Plant inside 8–10 m band, 0.8 s reload | W7 |
| First-spawned hounds reserving engagement slots | Nearest two hounds engage | W7 |
