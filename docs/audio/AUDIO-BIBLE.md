# Mage Arena — audio bible, AU1 proposal

2026-10-02. **Everything below is proposed unless explicitly attributed to an owner decision or source mechanic.** No sample is accepted production audio. [CHOICES.md](CHOICES.md) is the owner authority and overrides this document. [Round 1](audition/r1/index.html) tests directions; [the proof report](PROOF-REPORT.html) records cost and limitations.

## World and pillars

Owner D14–D19 establish a raw, brutal, magical world on a Roman baseline, the Covenant family of verdigris, rust/sand and moonlit blue-black palettes, and a distant mostly fixed arena camera. Sound should make tiny figures physically present without filling every gap. Roman material culture supplies worn bronze, hide drums, leather, linen, sandals, stone and breath; it does not demand archaeological reconstruction. The mages' energy is dangerous and personal.

1. **Matter under impossible pressure.** A spell starts with a tangible fracture, breath or liquid movement; magic bends that material into an impossible resonance. Keep the attack readable through the shimmer.
2. **The collar conducts the fight.** A dry metal release and a distinct rune resonance mark actual tier unlocks. The growing score describes restraint coming loose, not a stopwatch counting every second.
3. **Defense has grammar.** Normal absorb pulls inward and closes. Perfect absorb adds a clear, brief opening resonance: energy has returned to the player. Hits collapse downward. Never confuse success with damage.
4. **A camp with people and time.** Magic is suppressed inside camp (source mechanic). Its beds carry cloth, cooking, labour, distant patrols and empty space. The ward's pressure is environmental, never a suggestion that the player can cast there.
5. **Brutality with space.** Weight comes from contrast and transients, not constant sub-bass or shrillness. Silence after impact is part of its force. Protect threats, feedback and speech from crowd and music.
6. **One authored interface.** D19/D24: UI audio belongs to the UI kit. Slate, bronze and restrained rune harmonics connect the collar, spell slots, menus and Hollow Board. No separate generic computer vocabulary.

The Wardstones drink magic spilled in the Games (reference story); the collar's escalation is a harvest. Proposal: low stone tension with a short inhaling overtone after major arena discharges. The Breaking can transform the perfect-absorb motif into a cooperative exchange; no ending audio is produced in AU1. D2 replaces the baseline time loop with one six-week season; no reset/reincarnation sound is implied by camp dawn.

## Element palette and event grammar

Audition A = **Wounded matter** (physical, dry, raw). Audition B = **Bound radiance** (impossible harmonic energy over the same material). Neither is selected. Identifiable midrange should survive small speakers; bass is support.

| Element / source identity | Cast | Travel | Impact | Absorb tint / perfect tint |
|---|---|---|---|---|
| Fire / Heat, aggressive, tension-fed | resin snap, furnace exhale, ember grit | tearing flame ribbon, irregular crackle | compact pressure thud and cinder spit | flame sucked through a narrow throat / ember resonance opens upward |
| Water / Flow, intelligent rotation | taut liquid whip, bead click, compressed spray | narrow hiss, droplets orbiting a clear core | dense splash slap, short ice-like overtone | water curls inward / two lucid droplet partials and a returning pulse |
| Earth / Footing, protective mass | slate shear, gravel crush, low wooden staff knock | coarse stone grind, sparse motes | stone body with crisp chipped edge, little sub tail | sand cinches into stone / brief mineral ring, grounded body |
| Air / Momentum, restless motion | cloth-pressure flick, compressed breath, sparse electric filament | focused hiss with moving narrow whistle | air clap, short crackling arc | air folds inward / open airy harmonic and a directional return flick |

Shared event shapes prevent element identity from hiding outcome:

| Event | Proposed shape / trigger contract |
|---|---|
| Cast | attack at successful cast start; short body identifies school; interrupted cast stops body with 30 ms fade; no reward on failed input |
| Travel | tied to a live projectile, low gain; stop on despawn, no tail queue; prioritize closest threats |
| Impact | hard physical onset plus material debris; distinguish world collision from successful player damage |
| Absorb raise/hold/release | one inward onset, quiet tension while held, short closed release; ongoing mana drain does not beep |
| Normal absorb contact | muffled inward catch, never the perfect ring; physical mitigation has dull cloth/metal contact |
| Perfect absorb | immediate crisp return pulse and opening harmonic; one shared recognizable core with school tint; only confirmed magic perfects, never physical or unblockable hits |
| Hit / impact pair | hit on a body = cloth/leather weight; world impact = hard stone and chips; separate cues, no pain speech in AU1 |
| Roll | linen/leather sweep into grit scuff; no magical teleport; follows actual roll start, not every Space press |
| Collar rune tick | restrained bronze pin release plus one resonant rune; actual unlock only, distinct from slot selection |
| Crowd | broad distant human mass, nonverbal, no modern sports chant; swells at resolved events with long cooldown, never marks invisible outcomes |
| Unblockable threat | rough split-band warning with no absorb-like inward motion; immediate gameplay cue, never delayed by music grid |

Source combat data: 140-degree absorb arc, 0.15 s fresh-raise perfect window; nominal tier unlocks 0/15/30/45 s, each perfect advances the clock 2 s, minimum 6 s between unlocks, reset each wave. Data remains gameplay authority; AU4 consumes confirmed events rather than duplicating combat arithmetic. School resources: Heat, Flow, Footing, Momentum; source values are not retuned by audio.

## Camp time and places

Day and dusk are the two activity slots, followed by a night act; source place access below comes from baseline `design/data/locations.csv`. Night activity hides Director latency, so audio must not reveal provider success, cache state or latency. A new morning is a calendar transition, not a time-loop reset.

| Time | Bed proposal | Musical proposal |
|---|---|---|
| Day | light moving air, distant work, loose canvas and pots; no recognizable repeating chatter | sparse plucked strings and breath flute; warmth constrained by a low unresolved note |
| Dusk | fewer work sounds, cloth settles, brazier grit, sandals passing | bowed low strings with exposed plucked intervals; 2 s equal-power change from day |
| Night | open still air, canvas, a remote patrol; room for secrets | slow dark strings and separated bell harmonics, no constant horror drone |

| Place / open | Local foreground / acoustic identity proposal |
|---|---|
| Yard / day, dusk | dry staff wood, foot grit, distant drill breath; open stone reflection, 0.3 s decay, 8% wet |
| Cistern / day, dusk | dry empty masonry resonance, occasional grit falling, Quill close; it is a **dry** cistern, not a flowing fountain; 1.6 s sparse echoes, 18% wet |
| Pit / dusk | wrapped knuckle, sand scuff, close nonverbal audience; shallow earth, 0.25 s / 5% |
| Exchange / day | pottery, cloth barter, muted bronze weights, indistinct voices; awnings, 0.4 s / 8% |
| Commons / day, dusk | quiet crockery, cloth and mixed groups at distance; open gathering, 0.5 s / 10% |
| Door / day | heavy grille stress, boot passage and distant arena through mass; 0.9 s stone / 15%; beyond-door texture -9 dB and 1.8 kHz low-pass |
| Own tent / day, dusk, night | canvas flex, bedding, small wooden objects; 0.18 s / 4%; tint schools through material, no spell casting |
| Edge / night | near-absent air, remote measured patrol, faint ward pressure; diffuse exterior, 0.6 s / 8%; silence permits whispered story |

Time bed + one place bed + up to two local details is the ordinary camp arrangement. Crossfade zones over 1–2 s; do not stack all eight places. Preserve authored overrides if scene data regenerates. Hollow Board: slate card movement and a single confirmation on opening a chosen card; no autoplay voice for every card. Parley and herald: one calm, intelligible storyteller, text always present; voice optional and owner-cast after this small test.

## UI kit

Two audition families: **A / Cut bronze** (dry worn metal and slate) and **B / Rune glass** (short subdued mineral partials). Test click, confirm, deny, slot select and tab in each. These are five separate event assets, not one long demonstration falsely sold as five usable cues.

| Cue | Shape and restraint |
|---|---|
| click | single muted tactile contact; only activation, no mouse-motion chatter |
| confirm | short two-part settling gesture, rising interval only in B |
| deny | short closed scrape / damped low partial; information without punishment |
| slot select | small clear tick, one per changed slot; weaker than collar unlock |
| tab | cloth/slate slide with soft stop, lower than confirm |
| tooltip | normally silent; optional tiny breath on deliberate keyboard focus after 400 ms |
| save | quiet closure on completed save only; no false success while pending |
| menu / pause | a brief material reveal, fade combat textures; silence is valid |

UI stays positionless. Separate UI volume, speech, effects, ambience and music controls plus master mute. All cues accompany visible feedback; sound never carries the sole threat, success or resource signal.

## Mix, placement and simultaneous voice budget

Proposal: **32 total playback voices** (one WebAudio source/stream, mono or stereo, counts as one voice), including running silent phase-locked layers and both sides of overlaps. 4 reserved for critical threat/confirmed perfect/collar feedback; 8 maximum music slots (4 layers × 2 during a set crossfade); 1 optional speech; 2 UI; 4 ambience/crowd; remaining 13 ordinary world SFX. These allocations sum to 32; the noncritical allocations are ceilings, unused slots can be lent to world SFX. A musical accent uses a critical feedback slot, not a hidden ninth music voice. When pressure binds, thin music and texture first; do not steal an already playing critical transient.

Buses: master → critical, combat, movement, UI, voice, ambience, crowd, music. Speech uses **ducking**, not its own guaranteed reservation: music -6 dB, ambience/crowd -4 dB, 100 ms attack / 600 ms release; never duck critical warnings. Critical feedback uses **reservation**, not a second duck. Music layer gains allow -6 dB summation headroom. A master safety limiter is a ceiling, not a loudness solution.

Priorities: critical P0; player feedback P1; world/UI P2; texture/music P3. On exhausted noncritical pool, drop lowest priority new one-shots, steal quietest equal-priority texture with 20 ms fade; long beds virtualize by retaining transport phase. Cooldown drops, never queues. Aggregate many simultaneous same-material impacts into one closest audible instance. Per-emitter cooldown plus class concurrency prevents the distant swarm masking the player.

| Class / confirmed hook | Bus / priority | Space | Max concurrent (class; emitter) | Cooldown ms (emitter unless stated) | Protection |
|---|---|---|---|---|---|
| threat.unblockable / telegraph start | critical P0 | positioned, audible floor | 2; 1 | 0; coalesce identical event id | reserved |
| absorb.perfect / resolved perfect | critical P0 | player feedback centered, enemy positioned | 1; 1 | 0; merge same-step contacts | reserved |
| collar.unlock / tier changed | critical P0 | centered player | 1; 1 | 0; idempotent wave+tier | reserved |
| cast / cast committed | combat P1 player, P2 enemy | positioned | 4; 1 | 80 | normal pool |
| travel / projectile active | combat P2 | positioned | 3; 1 | 100 | normal pool |
| impact / collision | combat P2 | positioned | 4; 2 | 60 | normal pool |
| absorb contact / resolved non-perfect | combat P1 | positioned | 2; 1 | 80 | normal pool |
| absorb hold / held state | combat P2 | positioned | 2; 1 | state-owned loop | normal pool |
| hit / damage resolved | combat P1 | centered player / positioned enemy | 2; 1 | 100 | normal pool |
| roll / roll committed | movement P1 | positioned | 2; 1 | 150 | normal pool |
| footsteps / foot plant | movement P3 | positioned | 2; 1 | 160 | normal pool |
| UI click/slot/tab | UI P2 | centered | 2; 1 | 80 global per cue | normal pool |
| UI confirm/deny/save | UI P1 | centered | 1; 1 | 250 global per cue | normal pool |
| crowd / resolved spectacle | crowd P3 | diffuse stereo | 1; 1 | 6000 global | normal pool |
| camp time/place/details | ambience P3 | beds stereo, details positioned | 4 total | 1500 detail | normal pool |
| herald/Parley / line requested | voice P1 | centered | 1; 1 | no queue; replace with 100 ms fade | duck other buses |
| music layers / music state | music P3 | stereo, no occlusion | 8 including overlap | musical grid | declared allocation, yields to critical |

The far fixed camera must not move the audio listener away from the combatant. Proposal: world distance is relative to player in metres; stereo pan follows screen direction, clamped ±0.75. Critical offscreen threats retain a -12 dB floor and visual indicator. Ordinary sounds full gain to 2 m, taper to inaudible at 24 m; filter 12 kHz near to 3 kHz far. Values await reconciled camera/arena scale and AU4 verification. Camp uses place zones; no artificial emitter for the music. Zone transitions glide rather than switch filters.

## Loudness and acceptance

These are project proposals, not claims that a platform mandates them. AU1 preserves raw provider files and measures every sample with ffmpeg `ebur128=peak=true`; browser audition gain trims compare directions at a matched nominal level without altering evidence. Brief one-shots are judged mainly by peak/envelope; short integrated LUFS alone is not a perceptual quality score.

| Delivery / playback class | Proposed target |
|---|---|
| Representative combat + camp session mix | -20 LUFS integrated ±2, true peak ≤ -1 dBTP; optional reduced-dynamic-range mode |
| Voice | -20 LUFS ±1, true peak ≤ -3 dBTP |
| Arena music at working gain | -26 LUFS; four-layer sum checked, not each layer independently normalized to full level |
| Camp music / menu | -30 / -26 LUFS |
| Camp/arena ambience | -34 LUFS; crowd peaks ≤ -12 dBFS at working gain |
| Common SFX / critical accents | practical peak targets -10 / -6 dBFS, no clipped transients; short cues use measured true-peak guard |
| UI | peak ≤ -15 dBFS; softer slot and tab than confirm |

Production acceptance (AU3/AU4, deferred): PCM masters, output codec and loop points tested in browser decoding; three repeats minimum, no click and no content hole; declared BPM/meter/downbeat verified from audio; phase-compatible stems of identical sample length; every allowed layer subset; mono/small-speaker check; full 32-voice worst-case cue-log mix with suppressed events reported. Decode, duration and loudness do not prove any of these perceptual properties.

## Adaptive arena music on the collar clock

Proposal: vertical layering for escalating spell power, with a shared phrase and four independent authored layers. AU1 clips are **style sketches of complete mixes**, not stems and not proof of adaptive capability. Do not stack separately generated full mixes and call them layers.

| Gameplay state (source event) | Musical state proposal |
|---|---|
| wave starts, tier I | low bowed/drone foundation + sparse pulse |
| tier II confirmed | add skin/wood rhythmic detail |
| tier III confirmed | add moving strings/flute or dark brass by chosen direction |
| tier IV confirmed | add high energy texture/wordless choral colour; leave threat band clear |
| perfect absorb confirmed | immediate unpitched return accent (feedback voice), optional harmonic answer next beat |
| wave ends | stop adding density, release on next bar; one-bar tail; reset layer map for next wave |
| pause / resume | pause transport and gameplay together; resume in phase; no queued accents |

Authored candidate grid: 96 BPM, 4/4; beat 0.625 s, bar 2.5 s, six bars = 15 s. The nominal clock aligns conveniently, **but perfect absorbs break that alignment**. React instantly with the collar tick and a short gain ramp on already-running sustained layers; schedule a newly audible rhythmic entry at the next safe beat (worst nominal wait 625 ms plus 50 ms commit horizon), or next bar for a harmonic change (up to 2.55 s, covered by immediate feedback). Never delay the gameplay cue or tier unlock to fit music. If a request is inside the horizon, use the next boundary; never clamp to now. Tempo is an authored request until measured from accepted audio.

Music state follows confirmed unlocked tier, monotonic within a wave. Coalesce pending transitions to latest tier; do not play obsolete intermediate stingers. Two-bar minimum musical dwell applies only to discretionary threat colouring, never to confirmed collar advancement (source minimum unlock gap 6 s already exceeds two 2.5 s bars). Tier IV can rotate a sparse/top texture every 8 bars to reduce fatigue while retaining tier identity. No enemy-count oscillation drives collar music. Camp changes use 2 s crossfades without a beat grid; title is its own theme.

Future manifest contract: cue id, bus, priority, spatial mode, concurrency, cooldown, variants, gain, loop intent; music adds measured sample rate/count, tempo, meter, downbeat sample, loop in/out, tail, layer memberships and permitted transition grid. Missing assets are explicit placeholders. Runtime traces must include wave reset, accelerated unlock, multiple same-frame perfects, pause and tier IV; absent cases are not measured.

## AU1 production discipline

`tools/audio/budget.json` owns cap/reserve and conservative call bounds; `ledger.jsonl` records every generated sample and a sidecar records exact prompt/request, immediate shared-account snapshots, documented estimate, conservative estimate, optional exact billing header and conservative cap debit. Shared deltas are upper-bound proxies, not attributable charges. Three proof calls precede sizing the rest. Original prompts name materials, envelopes, instruments and structure; never franchises or artists. No production generation until owner chooses and a new budget is authorized. The reports are development review tools, not game UI; provider and model provenance lives here, not in player-facing screens.

## Smaller audition authorization (2026-10-02, session 2)

The owner reduced the cap to **4,000 credits total including session 1**, retaining the 8,000 shared reserve. The earlier 12,000 allowance is superseded. The billing-fault latch is archived; only a real quota/rate-limit error or funds exhaustion/refusal latches this run. Missing headers and anomalous shared-balance deltas are flagged, never treated as free generation.

Priorities: 27 one-shot SFX (eight elemental casts, four absorb outcomes, two hits, collar, roll, crowd and ten UI cues); two contrasting arena music sketches and one camp night sketch, 20 s each; at most two short stock narrator lines. Two already-authored 20 s ambience probes may use leftover capacity for loop evidence. Day/dusk music, title and the extra arena/voice directions remain proposals, ungenerated. This round cannot establish a complete score, production variation, an accepted cast or a finished adaptive layer set.
