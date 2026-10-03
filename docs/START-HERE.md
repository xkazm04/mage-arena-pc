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

The Lab HUD repeats these shortcuts. Replay freezes live simulation, holds its
last frame at the end and preserves the prior pause state on exit. Reset before
comparing presets. When either figure falls, the bout holds for reset/refill.

## Tune and compare

Every control is on the canvas. Drag a slider, or focus it and use Left/Right.
Click its numeric value, type a number, Enter applies, Escape cancels. Tabs:

- Movement: walk/sprint speed, acceleration, braking, visual body turn response,
  movement during casting. Zero acceleration/braking/turn means instant response.
  Mouse aim stays immediate; visual turn smoothing never delays the ward/hit arc.
- Roll: distance, duration, invulnerability and recovery. Invulnerability cannot
  exceed duration.
- Casting: cast/cooldown/projectile multipliers, commit fraction, recovery. A roll
  can cancel before the commit point; 1 preserves cancellation through windup.
- Impact: stagger duration and knockback distance at 10 damage.
- Absorb: perfect window, arc angle, drain and perfect-refund multipliers.
- Resources: mana regeneration and seconds between collar tiers.
- Opponent: reaction-delay and aim-error multipliers. Reaction has a 250 ms floor.
- Spells: select slot/tier, then edit that archetype's cast time, cooldown or
  projectile speed. Overrides affect both sides. Nonprojectile speed is unused.

**Current**, **Snappier**, **Heavier** are named experiments, not owner-approved
balance. Changes apply to future actions; active casts retain their spell data
and travelling projectiles retain launch speed. Dangerous warning floors remain
0.8 s unblockable / 0.4 s positional even if you shorten casting. Return to combat
resumes. Export tuning downloads JSON. Import opens a canvas panel: paste JSON
with Ctrl+V or drop that file on the canvas, then Enter validates/applies. Invalid
values/unknown parameters are rejected without altering the current tuning.
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
