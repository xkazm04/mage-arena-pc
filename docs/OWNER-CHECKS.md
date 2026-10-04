# Owner checks

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
- Hit: stun, immunity tail, poise, recoil and defeat timing; see the updated START-HERE guide.
  distance at 10 damage.
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
Version 3 exports import version 1/2 experiments with explicit legacy timing migration.
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

---

## Historical review checks

Earlier-build notes below are retained as history; use the start guide above.


## U1 TV navigation / current G1 build - pending owner judgment

The owner rejected W7's browser-page presentation and near tracking camera.
U1 now uses one viewport-filling game canvas and the D17 far fixed camera.
This section supersedes the historical near-camera and A4/A5 checks below.

From `C:\Users\kazda\kiro\mage-arena-int` in Windows PowerShell:

```powershell
npm ci
npm run gate
npm run build:game
node --import tsx node_modules/vite/bin/vite.js preview --config packages/game/vite.config.ts --host 127.0.0.1 --port 4173 --strictPort
```

Open **http://127.0.0.1:4173**, choose **Fullscreen**, then **Begin your story**
and Water / Cassia. Use 1080p or 1440p, browser zoom 100%, and normal sofa distance.
The Director defaults offline. The camp, frames and figures are procedural while
the Covenant art delivery is pending; no discarded art is loaded.

- Judge the main menu, camp map, Season, Hollow Board, Journal, place visits,
  Parley, composition, arena HUD, pause/settings, results and save/load as one
  game. Record hierarchy, text comfort, focus visibility and desire to interact.
- Keyboard: arrows/Tab choose focus, Enter selects, Escape backs out/pauses.
  Mouse targets share the same actions. Try reduced motion and sound in settings.
- Standard controller: D-pad/left stick navigates; A selects/holds, B backs out,
  Start pauses/resumes. Try controller-only camp travel, listening and the Parley
  letter board. Unplug during combat: the game should pause.
- Arena: WASD moves, mouse aims at feet, LMB casts, RMB absorbs, Space rolls,
  Shift sprints, 1-4/wheel selects slots. Controller: left stick moves, right
  stick aims, RT casts, LT absorbs, A rolls, L3 sprints, LB/RB selects slots.
  Check health/mana/stamina, cooldowns, collar tier timing and absorb feedback.
- The nominal figure is 3.75% of screen height. Move centrally: the view should
  stay fixed. Approach each edge: it should ease only then. Judge silhouette,
  telegraph and ground-aim readability, especially while the camera moves.
- Follow the two-week route below: listen at night, learn the bread Knowing,
  speak to Nysa, enter the dusk Trials on days 6/13 and Games on 7/14. Save in
  camp and combat, change state, load and resume; restart the server and load.

Automated gates pass: 153 TypeScript plus ten reference tests, both resolution
routes, native aiming, exact saves and unchanged 8,000-fight census. Standard
Gamepad API emulation is measured, physical controllers and television latency
are not. The gallery is evidence, not a human quality verdict. **G1 remains open.**
See [U1 report](waves/U1-report.md), [gallery](waves/U1-evidence/index.html) and
[TV design note](waves/U1-tv.md). The atlas loader awaits the real art kit.

## W7 / G1 - historical route; presentation rejected, replaced by U1

From `C:\Users\kazda\kiro\mage-arena-int` in Windows PowerShell:

```powershell
npm ci
npm run gate
npm run build:game
node --import tsx node_modules/vite/bin/vite.js preview --config packages/game/vite.config.ts --host 127.0.0.1 --port 4173 --strictPort
```

Open **http://127.0.0.1:4173**, choose **Water / Cassia**, and play to the morning
of day 15. Use 1920x1080 or 2560x1440 at browser zoom 100%. The default is offline;
no provider setup is needed. Other schools are camp allies, and both weeks use Tiro.

- Spend day and dusk time visiting the Yard, Cistern, Pit, Exchange and Commons.
  Try training and a social act; check travel costs and the changes shown afterward.
- On the first night, listen at the tent flap. A/D or 1-3 changes cover, Space
  listens, releasing hides. Follow the voices and avoid the patrol. With the bread
  Knowing, visit Nysa in the Commons on the next day and open Parley. Try a card,
  then typing on another day; offline typing uses the selected authored approach.
- Read the Hollow Board each morning. Distinguish a rumour from a witnessed result;
  check whether relationships and facts make yesterday's choices matter.
- On days **6 and 13**, go to the Pit at dusk for the Tent Trial. Read the stance
  tell and counter it (brace beats press, feint beats brace, press beats feint).
  An escort is available when travel is spent. A lost selection leads to spectating.
- On days **7 and 14**, choose three Water lines and branches, fight the Tiro waves,
  absorb incoming magic, watch the collar tiers and enter each next bout. Aim at
  feet. WASD moves; left mouse casts; right mouse absorbs; Space rolls; Shift
  sprints; 1-4/wheel changes slot. Try both a win and missio if practical; don't
  restart a season bout to reroll it. Returning should show gold, renown, trust and
  the following morning's result/rumour cards.
- Press **Escape** for pause, sound and controls. Save in camp and during combat,
  change something, then load. Loading stays paused until Resume. Close and reopen
  the server/browser and use **Load saved season**. The slot lives at
  `.director-runtime/saves/season.json`; **Recover previous save** loads its backup.
  A changed source build rejects old saves clearly rather than partially loading.

Record whether the first two weeks make you want to continue, whether camp choices
have readable consequences, whether the Trial is understandable, and whether the
55-degree near camera and ground aiming are comfortable. Record dull/unfair
encounters and actual bout times. Placeholder figure quality is not an art approval.
The measured census now passes all four original median bands; this supersedes the
historical W4b pacing failure below. Automated play and screenshots cannot close G1.

All discarded A2/A3 figure work is excluded from runtime. Accepted A4/A5 camp art
remains; the arena uses the A1b camera/ground reference and procedural placeholders.
See [W7 execution and evidence](waves/W7-execution.md) and
[build/controls details](../packages/game/README.md). **G1 remains open for the owner.**


## W2 — absorb and aim (pending; not felt)

Run the arena as described in `packages/game/README.md`. Use the magic thrower, then alternating flanks, then the three-bolt stream for about five minutes. Controls follow D4; a white ring and bell mark a perfect.

- Record attempts and perfects; classify the timing as too tight / right / too forgiving.
- Record whether turning toward a threat becomes natural and whether cursor aim reads clearly.
- Check steel versus magic versus black/red lane readability, roll distance and stamina pressure.
- Record audio audibility and comfort. Automated screenshots do not certify either.
- Physical input-to-photon latency: **not measured**. Optional filmed button/flash method requires real hardware and owner observation; do not infer latency from frame rate.

All placeholder visuals are authored code shapes, not an art direction choice. No owner verdict has been supplied.

## W3 — Water composition and Flow (pending; not felt)

Use **Compose** to compare Undertow, Mirror tide and Rotation, then change a branch. Check whether the tier table explains what will happen to each button and whether upgrades are noticeable without watching the clock. Alternate slots, try a Crest, then compare physical and magic training.

- Do all five lines earn a slot, including Mire and Mend, whose value is not raw damage?
- Is Flow readable while moving and timing absorbs? Does repetition resetting it feel fair?
- Are the long unblockable warnings, freeze area, fog, decoy and encasement distinguishable?
- Does the branch preview match what you expect when the same button upgrades?

Screenshots and automated mouse/keyboard checks exist in `docs/waves/W3-evidence/`; they do not certify feel. W4 will supply moving opponents and real Tiro bouts. No borrowed-school play or other-school identity is claimed yet.

## W4 — living opponents and Tiro (pending; not felt)

Choose **Tiro Games**, pick a composition, and play through the four bouts. Use **Next bout** after a clear; HP recovers by a fraction of missing HP while mana, stamina and collar reset. A loss grants missio. The eight individual enemy entries in **Training** expose the complete roster, including enemies outside Tiro.

- Can you read spear, steel, net, charge, magic and hound death warnings while moving? Are shield flanks and roll escapes understandable?
- Do mage mistakes look plausible, and does their ward leave useful openings? Other-school entrants are explicitly Water proxies until W8.
- Does each composition offer useful choices against moving targets? Does Flow remain legible under pressure?
- Record each bout's duration, outcome and any dull or unfair stretch. The simulated median gate does not certify human pacing or the full-Games win rate.
- Check loadout locking, recovery, next-bout controls, missio and final reward clarity.

Automated evidence is in `docs/waves/W4-evidence/`. Levels 1–4 obey reaction/stat caps, but level 4 overdefends in the tested duel and wins less than level 3; later-ladder tuning is logged for W9. No owner feel verdict or physical latency measurement has been supplied. G1 remains open.

## A1 - choice recorded

The owner chose Tessera & Lime on 2026-10-02; see
[OWNER-CHOICE.md](../art/OWNER-CHOICE.md). The [A1 board](../art/review/index.html)
is historical. Its large arena figures are superseded by the distant camera brief.

## W4b / W4c — oblique camera, scale and aim (pending; not felt)

Run the game using `packages/game/README.md`; use a 1920×1080 or 2560×1440 browser viewport. Start at **View = 1.2**, then compare 0.8. Toggle **Scale overlay** to inspect the contract and rulers, then turn it off for play. The [evidence gallery](waves/W4b-evidence/index.html) includes both resolutions, live charge warnings, overlap and projectile-field views. The comparison images are explicitly paused fixtures, not evidence of motion feel.

- **Camera distance:** at near, the mage is 6% of viewport height, the ground is viewed at 55°, and the arena continues for several screens. Is that enough space to read incoming threats while retaining an identifiable upright figure? Compare far at 4%; do not judge placeholder drawing quality as accepted A3 art.
- **Readability:** face incoming magic and rotate the 140° ward through all directions. Is its open rear obvious? Distinguish steel diamonds, magic cores and unblockable marks while moving. Solid warning outlines are the actual footprint; separated outer ticks are locators for small threats. Do those cues remain understandable at both distances?
- **Aim accuracy:** aim at enemies' foot rings, first stationary and then while strafing/sprinting. Shoot diagonally and vertically as well as horizontally. Leave the mouse still while the camera follows. Record any apparent offset or need to aim at the head instead. There is no hidden body-snapping assist; whether ground aiming feels natural needs your judgment.
- **Depth and coverage:** pass behind/in front of other figures; check that the feet and targeting rings explain overlap. Check enemies indicated beyond the view/behind the HUD and whether the HUD masks a warning you needed.
- Record resolution, zoom, scenario, and any miss/readability problem. Judge camera distance as too close / right / too far, and oblique aiming as clear / learnable / misleading.

Automated projection/ground-hit tests, 32 real-pointer hit cases, both resolution screenshots and sustained 100-visible-projectile measurements are available; these do not certify human aim comfort, motion readability or physical input latency. The enlarged arena reopened W4 pacing: soldiers/creatures have simulated medians 44.38/45.55 s outside their old bands. Record actual bout times, but do not treat the selected full-Games browser fixture as balance approval. G1 remains open.

## A1b - camera confirmation recorded

Open the [camera board](../art/review/a1b/index.html) or
[contact sheet](../art/review/a1b/contact-sheet.jpg). Inspect full-size sources,
observed character heights, spacing, warnings and the stated absorb defects.
The [scale contract](../art/SCALE-CONTRACT.md) is an authored proposal.

The owner confirmed **open-oval-sparse-near-a01**, near distance, on 2026-10-02
in [CAMERA-OK.md](../art/CAMERA-OK.md). That confirmation supersedes the board's
agent recommendation and unblocks A3. W4b implements the numeric contract and
the final 55° oblique-view instruction; the proof's rear arc and approximate
figure measurement do not override those numbers.
Static images do not establish motion readability, timing, aim feel or performance.


## A2 - discarded by the owner

Plan section n supersedes the former portrait review. The rejected galleries and
portrait files were removed from the current tree in W7; their historical versions
remain in Git. Use the procedural figures for G1. New portraits and mage/enemy
figures require a separate owner-directed art pass.


## A4 - camp atmosphere and story presentation pending

Open the [camp map](../art/delivery/a4/camp.html), cycle Day/Dusk/Night, and inspect
the available place backdrops. Review [Hollow Board](../art/delivery/a4/hollow-board.html)
card hierarchy, frame states and legibility. Night lighting is an authored tint
over the same static map; actual camp activity will come from the game stream.
Review the recorded source deviations and atmospheric coherence before accepting
these candidates for integration.


## A5 - icon recognition and HUD hierarchy pending

Open the [icon board](../art/review/a5/index.html) at 32 and 64 px, then the
[HUD study](../art/delivery/a5/hud.html). Inspect the light/dark silhouettes and
change tier time and slot state. Labels accompany locked, cooldown and borrowed
treatments. Check line names against arena focus at both desktop resolutions.
Readability in motion remains an engine/owner check, not a static-art result.
Fire reference spell names retain their reference status; W8's missing Fire line
migration and Earth/Air line catalogues are explicitly deferred. Native symbols
are candidates for integration review, not automatically accepted production art.

## U1 camera - pending owner feel

D17 supersedes the historical near-view checks above. Default figures are now 3.75% of viewport height, aligned to art v2 during the screens sub-wave. Move in the central view: the camera should remain fixed. Sprint toward each edge, reverse direction and aim at feet while the view eases. Judge distant silhouette/telegraph readability and whether movement occurs rarely enough. Both resolutions are required. Combat geometry and pacing remain unchanged. See [camera note](waves/U1-camera.md).

## U1 framework - pending visual judgment

Shared dark stone, verdigris and moonchalk canvas primitives replace browser controls in the following screen sub-wave. Assess texture restraint, luminous focus, bitmap type and mouse cursor against the Covenant direction. Art kit is a replaceable delivery; placeholder quality is not approval of final art. See [framework note](waves/U1-framework.md).

## U1 screens - pending owner judgment

Use the same Windows build/preview commands above. The page now fills the window
with one game canvas. Begin your story, enter the camp, open Season/Board/Journal,
visit places, then try the proving ground and compose Water. Escape pauses;
settings and save/load are canvas screens. Fullscreen is a menu/settings action.
D18 supersedes historical A4/A5 acceptance: camp scenery is now procedural until
the Covenant delivery. Judge hierarchy, typography, texture, magical identity
and whether you want to interact. Both two-week automated resolution routes and
emulated-controller checks now pass. See [screens note](waves/U1-screens.md).


## U2 ? Covenant delivery integrated; owner quality and G1 pending

Use the Windows production build/preview commands above, or `npm run camp`.
The [U2 gallery](waves/U2-evidence/index.html) contains native 1080p/1440p game
screens, every cast expression, all eight places, three time maps, three arena
palettes and failure examples. Read the short [U2 report](waves/U2-report.md)
for measured performance and the next art backlog. These new A2c/A4c/A5b
integrations supersede the historical discarded-portrait/procedural-camp notes;
discarded A2/A3 art remains excluded.

Begin a Water story; inspect camp landmarks and slot changes, visit a place,
read the Hollow Board, open Journal ? People of the camp, and try Parley.
Judge portrait identity/expression, text size from sofa distance, focus visibility,
card hierarchy and whether the painted world and UI belong together. Use mouse,
keyboard and a physical gamepad. Try reduced motion and fullscreen.

Enter the proving ground, cast and absorb, sprint toward the rim and reverse.
Judge far-camera silhouette and threat readability, ground tiling, pylon/figure
occlusion, ward direction and the HUD while moving. All combat figures still
use procedural silhouettes: A3c lacks valid consistent directional animation.
Floor/rim crops are provisional adaptations of flattened paintings; proper
layered surfaces/props and animated characters are the next art round.

Automated gates, both complete chapter routes, missing/corrupt-asset playability,
exact saves and the 8,000-fight census pass. Both measured 100-projectile samples
reach 60 fps; screenshots/emulated controls do not establish physical latency,
sofa readability or visual acceptance. No owner feel result or G1 closure is
claimed by U2.


## U3a ? hour pacing, pending owner play

D25 supersedes the old slot/travel instructions. The waking day is 08:00?22:00;
travel is free, activities spend their displayed hours. Dusk begins at 18:00,
night at 20:00. Trials remain at 18:00 on days 6/13; Games begin at 08:00 on 7/14.
Judge the number of meaningful choices per day and the night act's placement.
Old slot saves are explicitly incompatible; begin a new story. Deterministic
replay is measured, hour-model pacing is not yet felt. See [U3a note](waves/U3a-hours.md).


## U3b ? revised camp clock and header

The owner accepted U2's camp and portraits as production quality. Review the
[U3 gallery](waves/U3-evidence/index.html), then use `npm run camp` for motion.
Place buttons now show only names; closed places fade and hatch. Travel is free.
Read gold, reputation and fatigue in the top right. Spend two hours training:
the rune dial drains, and refills at dawn. The header always shows the core hour;
the dial's count eases during the brief spending animation. At night, check the
low-hours warning. Try reduced motion and both resolutions from sofa distance.
Activity costs stay inside facilities. Assess daily pacing and clock clarity;
screenshots/emulated controls cannot certify those. See [U3b note](waves/U3b-camp-ui.md).

## AU4 — listening pending

Run `npm run camp`, then click or press Enter to unlock sound. Begin a Water
story; listen through day, dusk and night. In Escape → Settings → Sound & music,
try all volumes and mute, cycle Test effects through the four elements, hit,
impact, the single roll step and provisional perfect accent, then Test voice.
Use your normal speakers and headphones. Judge harshness, uneven levels,
intelligibility, fatigue and whether the step crop still reads as one sand step.

In the proving ground, cast, roll and time a perfect absorb. Listen across
collar tier changes: arena A, C, D, then the final-tier playlist. Judge crossfade
seams and whether music, impacts, the collar and voice remain distinct. Pause,
resume, mute/unmute and reload settings. The kept music is still short loops;
full-length replacements are pending. The perfect accent currently borrows
the kept collar sound; ordinary absorb/title/crowd have no approved source.

Automated checks measure context unlocking, the processing graph, events and
limits. **Headless audio cannot be listened to**; mix quality, perceived loudness,
true peaks, physical device latency and artistic fit are not certified. Review
the [AU4 note](waves/AU4-audio-engine.md) and
[event evidence](waves/AU4-evidence/browser.json). Final trims and acceptance
await owner listening; no new audio was generated.


## U4 ? effects, characters and Tideglass; owner motion review pending

Open the [U4 native gallery](waves/U4-evidence/index.html) and
[report](waves/U4-report.md), then run `npm run camp`. Use 1080p and 1440p.
The owner called the delivered effects and characters a very significant
improvement; automated integration does not add a game-feel verdict.

In the proving ground, move diagonally, turn while casting, hold the ward and
time a perfect absorb. Judge effect scale/brightness, compression versus flare,
open-rear clarity, body visibility during casting, front/rear identity and gait.
Enemies now use A10 where available; the cinder hound and target dummy remain
procedural. Missing clips hold the nearest same-entity direction/state. F8 shows
the fallback log; [ and ] page through it. Confirm that the disclosed direction
holds remain readable. The ground/rim is intentionally unchanged pending new art.

In camp, read the 32px gold/reputation/fatigue symbols. Train twice to reach noon,
then advance through dusk and night: inspect sky layers, falling water, orbiting
bead and the existing final-hours warning. Try reduced motion. A11 uses delivered
authored relief/compositing; richer painted icon/clock art remains art backlog.

Both full screen tours, 100-projectile/12-figure performance checks, page failures,
exact saves and fresh 8,000-fight census pass. Fire/Earth/Air gallery scenes are
presentation fixtures, not newly playable schools. Judge motion, sofa legibility
and physical input/controller feel during play; screenshots and headless checks
cannot certify them. G1 remains open.


## U5 ? plates accepted for now, larger figures ready

The A12 plates now cover a compact arena; figures are 50% larger (60.75px at
1080p, 81px at 1440p). See [native captures](waves/U5-evidence/index.html) and
[geometry and measurements](waves/U5-report.md). Use the proving ground to
move to every edge, pass behind pylons, and turn the 140-degree ward. Judge
foot aiming, larger effects, HUD coverage at the southern rim and camera
clamps. Decorative stones are not solid obstacles. Old source-version saves
are rejected explicitly; start a new season after rebuilding. Painted A13
sigils are still pending behind the optional loader. CF1 adds the direct Lab
entry and a new start guide next.


## U6 - painted sigils and complete screen pass (2026-10-04)

Review [the native screenshot gallery](waves/U6-evidence/index.html). All twelve threat/element combinations, progress phases, ward/perfect window, three floor palettes and the complete screen tour are included. In the Lab check that approaching threats read before they resolve, that ward orientation is clear, and that text reads at normal TV distance. This is an owner feel/visual judgment, not a claim made by the automated checks. H1 follows next.


## H1 - reactions and persistent defeat (2026-10-04)

Follow [START-HERE: H1 feel-test](START-HERE.md#h1-feel-test-the-hit-reactions-and-defeat).
The owner judgments are interruption length, visible struggle, recovery under a
stream, hit/stagger sound payoff, and whether the body clearly lies down and stays.
Check Current and one exported variation with the same school/loadout/seed. The
[H1 report](waves/H1-report.md) records deterministic checks, full census and
before/after numbers. Browser proof is in [the gallery](waves/H1-evidence/index.html).
These checks do not declare the owner's acceptance of feel or art.


## U6b - landed A14 and AU3 deliveries (2026-10-04)

Use [the updated start guide](START-HERE.md#u6b-delivered-reactions-and-full-arena-music)
to compare light/heavy hits, death-to-corpse continuity and full C/D arena tracks.
Check that the figure keeps its size and ground anchor as its clip changes, and
that a corpse stays settled after the results panel opens. Listen through a
long stable tier as well as tier transitions and pause/resume. The art/audio
streams' technical passes are preserved separately from owner acceptance.
Missing clips, full A and adaptive musical certification are enumerated in
[the U6b report](waves/U6b-report.md). No new generation was requested by GAME.


## U6c - creature reactions and persistent lying poses (2026-10-04)

Follow [the creature Lab guide](START-HERE.md#u6c-creature-reactions-in-the-combat-feel-lab).
Cycle Target to Cinder Hound, Mire Maw, Thornback or Hush Moth; choose all four
facings. These are explicitly stationary inspection targets with roster health
and poise. Hit, defeat, leave the corpse visible, then G revive / R reset. Judge
silhouette, struggle, pivot/size continuity, left mirroring and settled ground
pose. Specifically inspect the Maw front face, Hound gait, Moth antennae/eyes
and subtle resistance motion flagged by ART. Use [native evidence](waves/U6c-evidence/index.html)
for comparison. The [report](waves/U6c-report.md) distinguishes delivered views
from 12 priority + 12 legacy fallbacks; technical passes do not declare approval.
