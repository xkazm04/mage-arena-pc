# Open questions and pending checks

Purpose: lists the unresolved gameplay design questions, the owner feel checks still pending, and the contradictions or gaps found while exporting these docs. Useful as a starting backlog for reviewers.
Status: snapshot 2026-10-07 from `integration` `b1efd46`, `docs/OWNER-CHECKS.md` and `docs/MAGE-ARENA-PLAN.md`. Campaign-side questions are in [../campaign/open-questions.md](../campaign/open-questions.md).

## Open design questions (owner)

From plan section k; each has a default so work is not blocked.

| # | Question | Default |
|---|---|---|
| Q2 | Arena deaths: lethal bouts decreed from a high tier as story beats? | Yes, rare, from Tier III upward |
| Q3 | Starting character: pick one of four, the other three become allies/rivals? | Yes (only Water is playable now) |
| Q4 | Desktop shell: browser first, Electron or Tauri at packaging? | Browser first; decide at W14 |
| Q5 | Parley scope? | Only at Knowing moments, via the Director, with offline cards |

Q1 (player death by camp plot) is a campaign question.

## Pending owner feel checks

None of these is closed. Simulations and screenshots do not count as feel.

| Area | What the owner must judge | Source |
|---|---|---|
| Ward and perfect absorb | Is the 0.15 s window too tight, right or too forgiving? Is turning toward threats natural? | OWNER-CHECKS W2 |
| Threat readability | Steel vs magic vs unblockable while moving; flank readability; roll distance and stamina pressure | W2, W4, U6 |
| Water composition and Flow | Does each of the five lines earn a slot (incl. Mire, Mend)? Is Flow readable? Does the repeat reset feel fair? Are tier upgrades noticeable? | W3 |
| Living opponents and Tiro | Plausible mage mistakes, fair flanks, bout pacing, retry and next-bout clarity | W4 |
| Camera and aim | Distance, edge-follow comfort, silhouette readability during motion, aiming at feet instead of torso | W4b/W4c, U1 camera, U5 |
| Movement and casting feel | Current vs Snappier vs Heavier; floaty, snappy, heavy, unfair, unreadable | CF1/CF2 (START-HERE) |
| Difficulty | Reference duel win rates fell to about 38–40% after CF2. Is that the right difficulty? | CF2 report |
| Hit reactions and defeat | Interruption length, visible struggle, recovery under a stream, sound payoff, clear lying corpse | H1 |
| Animation clips | Size and pivot continuity, light/heavy hits, creature identities and fallbacks | U6b, U6c |
| Camp day pacing | Number of meaningful choices per day, night act placement, clock clarity at sofa distance | U3a, U3b |
| Listening act | Difficulty and fun of the 45 s act | W5 |
| Parley | Is typing valuable compared with the authored cards? | W6 |
| Screens as a whole | Hierarchy, text comfort at TV distance, focus visibility, desire to interact | U1, U6 |
| Physical latency, physical controller, TV viewing | Not measured | W2, U1-tv |

## Contradictions and gaps found during export

| # | Finding | Where | Suggested resolution |
|---|---|---|---|
| 1 | `arena-tiers.json` and `enemies.json` still contain loop-era content: "last day of every loop", `orEchoFromLoop`, the `echo` opponent, Tent Trial "loop day 2", "Mastery persists across resets". D2 removed loops. | `data/arena-design/arena-tiers.json`, `enemies.json` | Remove or mark as archived; code ignores these fields |
| 2 | `stats.csv` has an `on_reset` column (Echo, resets to 5 / 10). No resets exist in a season. | `data/arena-design/stats.csv` | Drop the column |
| 3 | `combat.json/pacingTargets` (soldier 25–40, creature 30–48, duel 45–85) disagrees with the current census bands in `arena-tiers.json` (25–45, 35–60, 45–75, 45–80). Only `deadAirBucketS` is read from `pacingTargets`. | `combat.json` | Keep one authority; move or delete the stale bands |
| 4 | `combat.json/aimMode` (hold-to-aim, soft-lock) is unused by the mouse-and-keyboard kernel. | `combat.json` | Mark as unused or move to a gamepad-assist design note |
| 5 | `combat.json/absorb/facing` says "aim direction if aiming, else movement facing"; with mouse aim always active the ward always follows the aim. | `combat.json` | Clarify wording |
| 6 | The art contract states 22.5 px/m at zoom 1; the game `camera.json` states 30 px/m at fixed zoom 0.75 (also 22.5). Same scale, two conventions. | `data/presentation/` | Use one convention |
| 7 | OWNER-CHECKS U1 section still says "nominal figure 3.75% of screen height"; U5 changed it to 5.625%. | `docs/OWNER-CHECKS.md` | Mark historical |
| 8 | The baseline renown effect ("crowd throws a +25 mana flask in a final at renown ≥ 40"), guile scouting and gear have no implementation or wave assigned. | `stats.csv` | Assign to W9/W11 or cut |
| 9 | Header label says "Reputation"; data and code call it `renown`. | U3b, rules.json | Pick one player-facing term |
| 10 | Glacier Tomb "resets Flow/Heat/Footing/Momentum", but Heat, Footing and Momentum do not exist yet. | `spells-water.csv` | Define in W8 |
| 11 | Fire, Earth and Air practice profiles exist only in the Lab; the season's "mage of another tent" is always a Water proxy, so school identity is not yet part of season combat. | W4, CF1 | W8 |
| 12 | Level 4 AI over-defends and wins less than level 3. | W4 ladder | W9 tuning |
| 13 | The HUD covers part of the southern arena rim; the camera cannot move beyond the painting. | U5, CF2 | Layout pass |
| 14 | Mastery is never awarded and later tiers never unlock in the playable chapter. | W7 | W9/W11 |
| 15 | The integration worktree has uncommitted quest work (`quest.ts`, `quest-lint.ts`, `story/`). Its status is unknown. | integration working tree | Commit or discard before the next export |
