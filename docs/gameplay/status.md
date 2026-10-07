# Gameplay status matrix

Purpose: one table that says, for each gameplay mechanic, whether it is built, partial or planned, and what evidence backs it. Use it to separate the designed game from the implemented game.
Status: snapshot of `integration` at `b1efd46` (2026-10-04). "Built" means implemented and covered by automated gates; **no mechanic is owner-felt yet** (gate G1 is open).

Legend: **built** = implemented and tested; **partial** = implemented in a reduced form; **planned** = designed (data or plan) but not implemented; **reserved** = data model only, gameplay off.

## Combat

| Mechanic | Status | Evidence (wave, test, report) | Notes |
|---|---|---|---|
| Fixed 60 Hz deterministic kernel, seeded RNG, state hash | built | W2; kernel tests; byte-exact season replay (U3, H1) | |
| WASD movement, acceleration/braking, sprint | built | W2, CF2; feel tests | |
| Roll with i-frames, recovery | built | W2, CF2 | |
| Staff strike at close range | built | W2 | |
| HP / mana / stamina from ranks | built | W2; stats.csv | |
| Collar tier clock (15 s tiers, perfect +2 s) | built | W2, W3 | |
| Mouse ground aim on oblique camera | built | W4c; 32 native pointer hits | owner aim comfort pending |
| Directional ward, 140° arc, drain, exhaustion | built | W2 | |
| Perfect absorb, refund, clock advance | built | W2; timing bots | window feel pending |
| Threat families and warning floors | built | W2, W3 linter | |
| Water catalogue: 5 lines, tiers I–IV, 3 branch points | built | W3; catalog tests; W4 tuning | |
| Composition screen and presets | built | W3, U1 | |
| Flow and Crest | built | W3 | |
| Cast commit point, release events, recovery | built | CF2 | |
| Hit stagger, poise, knockback, anti-stunlock tail | built | H1; hit tests | |
| DEFEATED state and persistent corpses | built | H1 | |
| Hit feedback (hit stop, flash, shake, numbers) | built | CF2, H1 | |
| Hit and death animation clips | partial | U6b, U6c | 12 creature rear views use front fallbacks |
| Painted sigils / telegraph art | built | U6 (A13 import) | procedural fallback remains |
| Fire / Earth / Air practice profiles | partial | CF1 | multipliers over Water archetypes, Lab only |
| Fire / Earth / Air unique catalogues and resources (Heat, Footing, Momentum) | planned | plan W8 | |
| Borrowed line from a cross-tent friend | planned | combat.json `lines.borrowedLine` | duality arc |
| Crowd mana flask at renown ≥ 40 in a final | planned | stats.csv | not in kernel |
| Gear (talisman, garment) bought with gold | planned | stats.csv | no item system |
| Guile scouting reveal before Games | planned | stats.csv | |
| Burning / wet statuses | planned | U6 note | art exists, no simulation status |

## Opponents and Games

| Mechanic | Status | Evidence | Notes |
|---|---|---|---|
| Soldier roster (4) and creature roster (4) | built | W4; roster tests; proving ground | |
| AI mage on the shared kernel, competence 1–4, aggression | built | W4, CF2 | level 4 over-defends |
| Mage opponents of other schools | partial | W4, CF1 | season opponents are Water proxies |
| Tiro Games: 4 bouts, intermission, missio, payout | built | W4, W7; census | |
| Pacing census, 2,000 fights per wave | built | H1 census, all 4 waves pass | simulated, not human |
| Veteranus, Primus tiers | planned | arena-tiers.json; plan W9 | data exists |
| Summa and the Breaking duet | planned | arena-tiers.json; plan W9, W12 | |
| Mastery gain and tier eligibility | planned | plan W9/W11 | not awarded in weeks 1–2 |
| Lethal bouts (sine missione) | reserved | plan section d, Q2 | |

## Camp and flow

| Mechanic | Status | Evidence | Notes |
|---|---|---|---|
| Full-canvas UI kit, TV-grade layout, focus graph | built | U1, U6 tour (106 captures) | |
| Main menu, character pick (Water only) | built | U1 | Fire/Earth/Air are camp allies |
| Hours model, free travel, place opening hours | built | U3a | |
| Name-only place buttons, stat header, daily rune clock | built | U3b | |
| Eight places and their activities | built | W5, U3a | |
| Listening night act hiding Director latency | built | W5 | |
| Hollow Board, journal, cast journal | built | W5, U1 | |
| Parley with Knowings, typed text, authored cards, letter board | built | W6, U1 | |
| Tent Trial (press / brace / feint) | built | W7 | |
| Season bridge: stats, fatigue, poison into Games; gold, renown, trust out | built | W7, `season.ts` | |
| Save/load anywhere, replay-verified bouts | built | W7, U3a | |
| Weeks 1–2 playable, chapter end | built | W7 | |
| Weeks 3–6, endings | planned | plan W11, W12 | see campaign docs |
| Gamepad navigation and combat | built | U1-tv | emulated Gamepad API only |
| Combat Feel Lab | built | CF1, CF2, H1, U6c | |
| Audio engine with buses, ducking, collar-driven music | built | AU4, U6b | musical sections not beat-aligned |
| Desktop shell (Electron/Tauri) | planned | Q4, plan W14 | browser for now |
| Fire TV port | planned | D4 | post-G2 spike only |

## Gates

| Gate | State |
|---|---|
| G1 (owner plays weeks 1–2) | open |
| G2 (release candidate) | not started |
| Latest automated gate | `npm run gate`: 205 TypeScript tests + 11 reference checks, zero design contradictions (H1) |
