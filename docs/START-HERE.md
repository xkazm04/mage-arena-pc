# START GUIDE — Mage Arena Combat Feel Lab

Use Windows PowerShell in the GAME worktree. Install Node.js 24 or newer first.
Run these commands exactly (the last command keeps the local server running):

```powershell
Set-Location C:\Users\kazda\kiro\mage-arena-int
npm ci
npm run gate
npm run build:game
$env:CAMP_DIRECTOR = "offline"
node --import tsx node_modules/vite/bin/vite.js preview --config packages/game/vite.config.ts --host 127.0.0.1 --port 4173 --strictPort
```

Open **http://127.0.0.1:4173/**. Keep this PowerShell window open; Ctrl+C stops
it. The server serves both the built canvas game and its local save API. No API
key or paid Director call is needed. If PowerShell blocks npm.ps1, use `npm.cmd`
for the three npm commands. If 4173 is occupied, stop the previous preview first.
After editing code, stop the preview, repeat gate/build, then restart.
Use browser zoom 100%, 1920×1080 or 2560×1440, mouse and keyboard. Fullscreen is
on the main menu. These builds version combat sources: older-source season saves
are rejected explicitly; start a fresh season for the new build. Lab bouts are
scratch experiments, not season saves. Export tuning before reloading the page.

Choose **Combat Feel Lab** on the main menu. It is also in **Escape → Combat
Feel Lab** during play. Entering from a season checkpoints and leaves that season
paused; Continue season returns to the accepted checkpoint. Direct route:
**http://127.0.0.1:4173/lab**.

## Choose an experiment

Click each setup button to cycle it. Choose **Dummy** (Still, Magic, Physical,
Charge) or **Mage AI**: there is exactly ONE opponent. Choose the opponent's
school, competence 1–4, aggression (0 cautious to 1 eager), distance in metres,
and fixed/random seed. A fixed seed repeats on reset; random mode samples and
displays a new seed each reset. A higher competence improves decisions/reactions,
not health or damage. Dummy action is ignored for Mage AI.

Choose your school and **Choose the four spell slots**. The composition screen
keeps slot 1 as the basic needle; slots 2–4 are three distinct lines with their
branches. Presets are quick loadouts. **Enter the arena** starts the chosen setup.
Otherwise use **Start / reset bout**. Fire, Earth and Air are distinct practice
profiles (cast/travel/movement/damage/control and school art) over Water spell
archetypes. Their complete unique season catalogues are still pending. Water is
the authored reference. Setup/loadout changes reset; tuning remains selected.

## Controls

| Control | Action |
|---|---|
| WASD / mouse | Move / aim at the feet on the ground |
| Left mouse held | Cast when ready; slot 1 becomes staff strike at close range |
| Right mouse held | Directional ward; front magic is absorbable, steel is partly reduced, unblockable marks require escape |
| 1–4 / mouse wheel | Select spell slot |
| Shift / Space | Sprint / roll in move direction, otherwise facing |
| Escape | Pause menu; from Lab panels, return to combat |
| L | Setup: opponent, schools, competence, aggression, distance, seed, loadout |
| T | Live tuning; opening it freezes the bout |
| R | Instantly reset the bout and metrics with selected setup/tuning |
| P | Freeze/resume; tuning's Run button runs the opponent with the panel open |
| . (period) | Freeze and advance exactly one 1/60-second simulation tick |
| G | Refill BOTH figures' health/mana/stamina and revive; marks metrics MIXED |
| H | Toggle HP damage for both sides; contacts/control still happen |
| V | Replay up to the last 20 seconds; V again restores the untouched live bout |

The Lab HUD repeats these shortcuts. During replay, P freezes playback and period
steps its frames; refill/damage changes are ignored. Replay freezes live simulation, holds its
last frame at the end and preserves the prior pause state on exit. Reset before
comparing presets. When either figure falls, the bout holds for reset/refill.

## Tune and compare

Every control is on the canvas. Drag a slider, or focus it and use Left/Right.
Click its numeric value, type a number, Enter applies, Escape cancels. Tabs:

- Movement: walk/sprint speed, acceleration, braking, visual body turn response,
  movement during casting. Zero acceleration/braking/turn means instant response.
  Mouse aim stays immediate; visual turn smoothing never delays the ward/hit arc.
- Roll: distance, duration, invulnerability and recovery. Invulnerability cannot
  exceed duration. Recovery movement has its own speed multiplier.
- Casting: cast/cooldown/projectile multipliers, commit fraction, recovery. A roll
  can cancel before the commit point; 1 preserves cancellation through windup.
  Cancelling keeps the mana cost and cooldown already spent.
- Hit: damage-scaled stun, immunity tail, poise, knockback, recoil, flash and defeat timing (three pages).
- Absorb: perfect window, arc angle, drain and perfect-refund multipliers.
- Resources: mana regeneration and seconds between collar tiers.
- Opponent: reaction-delay and aim-error multipliers. Reaction has a 250 ms floor.
- Spells: select slot/tier, then edit that archetype's cast time, cooldown or
  projectile speed. Overrides affect both sides. Nonprojectile speed is unused.

**Current**, **Snappier**, **Heavier** are named experiments, not owner-approved
balance. Current now includes CF2's short acceleration/braking, cast commitment
and recovery, stagger and knockback. Watch the white hit flash/damage numbers and
the bright fresh-ward window with the actual +mana refund. Settings → Motion:
Reduced disables camera shake, hit stop and perfect slow-down. These local holds
stretch wall time; metrics count simulation seconds. Replay omits those holds
and does not re-trigger sounds. [The CF report](waves/CF-report.md) records the
changed difficulty and before/after numbers.

Changes apply to future actions; active casts retain their spell data
and travelling projectiles retain launch speed. Dangerous warning floors remain
0.8 s unblockable / 0.4 s positional even if you shorten casting. Return to combat
resumes. Export tuning downloads JSON. Import opens a canvas panel: paste JSON
with Ctrl+V or drop that file on the canvas, then Enter validates/applies. Invalid
values/unknown parameters are rejected without altering the current tuning.
Version 3 exports also import version 1/2 files; their old constant stun duration is preserved. New H1 parameters take defaults. Re-export to keep an experiment current.
Exports contain tuning and preset name; record school/loadout/seed separately.

HUD counts damaging contacts landed/taken, ward successes per incoming magic
contact, perfect absorbs per incoming magic contact, damage per gross mana spent
(cast + raise + drain), elapsed time and first target-down time (TTK). A miss or
rolled-through projectile is not an incoming contact. Damage OFF measures
hypothetical post-ward damage without removing HP; TTK is unavailable. Changes
mid-bout/refill label results MIXED. Replay shows historical action with live
aggregate metrics, explicitly labelled REPLAY. Lab history is session-only.

## First ten minutes

1. Minutes 0–2: Water, Still dummy, fixed seed 7331, distance 10, Current. Move,
   reverse direction, sprint, roll and cast all four slots. Feel start/stop and
   whether the spell arrives when the animation suggests it should.
2. Minutes 2–4: Magic dummy, damage OFF. Face it, hold the ward, then release and
   raise just before contact. Watch perfect count and mana. Turn away to test the
   open rear; try Physical/Charge to distinguish what must be dodged.
3. Minutes 4–7: Mage AI Water, competence 2, aggression .75, distance 10, fixed
   seed. Reset and play Current, then Snappier, then Heavier with the same loadout.
   Toggle damage ON for TTK. Replay a contact that felt unfair or unreadable.
4. Minutes 7–10: Change ONE parameter (for example accelerationMps2,
   castTimeScale, rollRecoveryS or absorbWindowS), reset, repeat. Try another
   opponent school/competence only after that comparison. Export the preferred set.

Report feel using concrete words: **floaty, snappy, heavy, unfair, unreadable**.
Include resolution, school/loadout, target school/competence/aggression/distance,
fixed seed, preset name, exact parameter name/value, damage mode, and the action
that exposed it. Example: “1080p, Water Rotation vs Water level 2, .75 aggression,
10 m, seed 7331; Snappier, accelerationMps2=90, damage ON: reversal feels snappy,
roll recovery feels heavy; incoming orb was unreadable behind the south HUD.”
Attach tuning JSON and a clip/screenshot when useful. Simulations verify rules;
only your hands can judge responsiveness, sound payoff, fairness and legibility.


## H1: feel-test the hit reactions and defeat

Start a fresh season after rebuilding: source-versioned older season saves are rejected.
Open Combat Feel Lab, choose Water / Rotation, one Mage AI (Water, competence 2,
aggression .75, distance 10), fixed seed 7331, Current and **damage ON**. The
reaction needs actual HP loss; damage OFF counts practice contacts but does not
stun. Press T and choose **Hit**. Previous/Next select three pages:

| Parameter | Current | What to look for |
|---|---:|---|
| Minimum / maximum stun | .10 / .20 s | A brief stop, with control returning promptly |
| Stun per damage | .003 s/HP | Larger damaging hits hold longer, within the bounds |
| Stagger immunity after hit | .18 s after stun | Repeated bolts cannot keep renewing the same stun |
| Poise multiplier | 1 | Scales authored poise for all bodies |
| Your / opponent poise | 1 / 1 | Independent Lab values; try opponent 2.3 for a heavy target |
| Knockback at 10 damage | .16 m | Actual displacement in core, reduced by heavy poise |
| Visual recoil / flinch | .35 m / .20 s | The sprite recoils away from contact and returns to its feet |
| Recoil squash / sprite shake | .18 / 3 px | A readable struggle without losing the silhouette |
| White flash / player edge cue | .065 / .22 s | The struck figure and your own damage are easy to identify |
| Fallback fall / aura fade | .55 / .30 s | Missing death clips settle flat; aura fades away |

The formula is `(minimum + HP removed * per-damage) / effective poise`, clamped
to minimum/maximum, then rounded up to a 60 Hz tick. Heavy shipped poise is
shieldman 1.8, mire maw 2, thornback 2.3; other actors 1. The explicit immunity
tail protects movement and a fresh cast from repeated interruption; damage and
visual flinch still happen during it. Ward chip can stagger, but holding your
ward never grants a fresh perfect window because of that stagger. Roll i-frames
prevent both damage and stun; a later hit can stop the unprotected end of a roll.

1. Move sideways while charging Bubble Shot. Take a hit: movement stops briefly,
   the charge disappears and the spell never releases. Mana and cooldown stay
   spent. The HUD shows stagger counts (dealt/taken) and your cancelled casts.
2. Keep moving into a stream. There must be a short recovery opportunity between
   stuns. Raise opponent poise, reset with R, and compare the same seed. Change
   only one parameter at a time; live changes mark the comparison MIXED.
3. Strike the opponent repeatedly. Look for flinch, away-from-hit recoil, squash,
   white flash, sound and the damage number. Reduce motion in Settings to check
   that flash/edge cue and the final corpse still explain what happened.
4. Defeat the opponent, then stop touching controls. The body falls and stays on
   the ground; it has no targeting ring, health bar or AI and cannot take another
   hit. Walk/aim across it where play continues. A10 death clips hold their last
   frame; delivered A14 collapse clips settle to matching persistent corpse keys.
   Missing A14 clips retain the same-entity A10/procedural fallback.
5. Let your own vitality reach zero. In ordinary practice/Games, the results panel
   leaves the body visible on the arena floor. In the Lab the DEFEATED label
   keeps the experiment inspectable. **G** refills and revives; **R** makes a new
   bout. The bout reset removes old corpses. **V** replays the recent sequence.

Export the chosen tuning JSON. Report whether the stop is too long, recoil too
small, repeated hits unfair, or the fall unclear, with the seed and exact changed
parameters. [H1 measurements and limitations](waves/H1-report.md) and
[native evidence](waves/H1-evidence/index.html) accompany this build.


## U6b: delivered reactions and full arena music

The four mages and four soldiers now use A14 light/heavy hits in all directions.
The heavy threshold is 18 actual damage (presentation policy); the entire clip
is fitted to the visual flinch time. New death/corpse pairs cover those figures
except Garran's rear directions, which retain their original A10 death keys.
Creature A14 reactions are still missing; their same-entity fallback remains.
Watch the feet/ground anchor and figure size when changing from walking to a hit,
then watch the death settle without a direction jump. Left-facing clips mirror once.

With Music enabled, collar II starts the full 150-second **Reed oath (C)**;
III starts **Lyre under iron (D)**. At a stable tier, these advance through the
whole track and crossfade to the other track near its end. I/IV still start the
previous short **Hide and iron (A)** preview; full-length A was deferred upstream.
Tier changes use two-second whole-track crossfades from the entrance. Pause/resume
keeps the current position; resetting a bout starts its entrance again. These
are not beat/bar section transitions: verified downbeats and approved sustain
loops have not landed. Listen for music under spells, hit/stagger cues and collar
payoff; technical measurements do not decide your musical preference.

[Delivery audit and remaining work](waves/U6b-report.md),
[native reaction gallery](waves/U6b-evidence/index.html).
