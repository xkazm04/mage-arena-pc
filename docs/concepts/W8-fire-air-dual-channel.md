# W8: Fire and Air on PC, built for two channels

Status: **designed** 2026-10-23 (spark rounds 1-4 with the owner; section 8 is the buildable brief and supersedes sections 4 and 6). Not started. The owner's direction (D40 in `../MAGE-ARENA-PLAN.md`): Fire TV is descoped. The game has two channels, **VR** (`kiro/mage-arena-vr`, competition build due **2026-11-18**) and **PC** (this repository), in separate repositories. PC is also where VR's mechanics get tested ("duality"), so PC implements **Fire and Air**. After the hackathon, VR wraps up and development continues on PC only.

This document fixes what the scouts could prove and lists what still needs a decision. The open items in section 6 are the agenda for the next `/spark` session with the owner: **how PC's playstyle deviates, the art, and the tooling dual development needs.** That session decides them; this one does not.

## 1. Why now, and what PC adds for VR

- **VR already runs Fire and Air in its C++ kernel, as AI opponents only.** Its competition slice ends on the Fire mage duel (Brennic) and an Air final (Lio, or Corvo as the fallback at the 23 Oct cut). VR files every school against this repository as a change request (CR). The VR decision of 2026-10-03 says every channel's kernel implements all four schools: VR builds each one first, then hands it over.
- **CR-002 "Fire school and Heat" is open against PC.** It has the full rule set, ten spell rows, hand checks with exact expected numbers, and two VR replay scenarios (`mage-arena-vr/docs/change-requests/CR-002-fire-school.md`, `docs/schools/FIRE.md`).
- **Air is a proposal with no CR.** `mage-arena-vr/docs/schools/AIR.md` and the overlay file `apps/vr/data/vr/schools/spells-air.csv` exist. The owner has not signed them off. CR-007 is listed as "to write". The numbers are untuned: VR's DF-008 reports that Lio loses every duel in 21-24 s (target median 45-80 s), and 53 of his 54 casts are Gale Darts.
- **PC's tooling is what VR lacks.** PC has these, and VR has no equivalent:
  - the 2,000-fight census per wave;
  - the Lab census forecast, about 400 fights in 6 s in the browser;
  - the threat-answer ledger;
  - replay seek and take-over.

  VR's open pacing findings could be tuned here, then returned as numbers. The same goes for DF-006 (rival phases), DF-007 (hound ember spit) and DF-008 (the Air duel). Duality pays off in that direction first.

## 2. Fixed by this concept (from evidence, not open)

| # | Decision | Evidence |
|---|---|---|
| F1 | **Fire is a port of CR-002 to the letter.** No retuning, no PC flavour in the kernel rules. The CR hand checks become core tests. VR scenario parity is checked on **outcome fields only** (the hashes differ: C++ FNV against TS `JSON.stringify`) | CR-002 "Scenarios", "Hand checks" |
| F2 | **Air enters the kernel only from a signed rule text.** PC implements AIR.md once the owner accepts it, and writes it down as CR-007 if VR has not. The open "Owner:" points in AIR.md are settled first (section 6, P6) | AIR.md:3-6, 31-36 |
| F3 | **Water stays the default everywhere.** The new schools sit behind flags: a Games flag for an Ember or Gale mage opponent, the Lab opponent school, and later the player school. Existing goldens, census digests and VR's 45 conformance vectors stay on the default | CR-002 "Fire mage"; `replay-golden.test.ts:32-46` |
| F4 | **Earth is out of W8.** No source exists in either repository | VR DECISIONS; scout |
| F5 | **PC stays its own repository and remains the owner of the canonical combat data.** VR keeps pinning a commit | owner, 2026-10-23; `../REPO-LAYOUT.md` |

## 3. What the PC kernel has to change (scout map, `file:line`)

Water reaches into almost every layer today. Fire and Air need a **school seam** first.

- **State.**
  - Every actor carries `Actor.water: WaterState` (`packages/core/src/arena/types.ts:28`, `kernel.ts:39`). Shared control fields also live there: `encasedUntil`, `rootUntil`, `slowUntil`, read in `kernel.ts:83,153,176,260,274,277`.
  - Split this into the shared control state plus a per-school resource (`flow` | `heat` | `momentum`).
  - `stateHash` serialises the whole state (`kernel.ts:352`). Following VR's precedent (`AirTests.cpp:1086`), keep absent school fields out of non-school actors so Water hashes stay unchanged.
- **Catalogue.**
  - The compiler reads `spells-water.csv` by name (`packages/core/scripts/arena-data.mjs:55`).
  - `catalog.ts:16-54` parses Water lines and throws on anything else. Ids are `line:tier:branch`.
  - Fire and Air ids (`fire_bolt`, `air_veer`) and their loadouts (four slots, no branches, per `docs/design/reference-the-ledger/design/data/spell-sheet-fire.md`) need a catalogue per school and a per-school `Composition` union.
  - The same change reaches the line tuple (`types.ts:10`), `spellIdPattern` (`tuning.ts:313`), the save-schema composition and school (`packages/director/src/save-schema.ts:20,26`), presets and `validateComposition`.
- **Source data.**
  - `spells-fire.csv` exists only in the reference folder (`docs/design/reference-the-ledger/design/data/`).
  - The Heat and Momentum identity is in `docs/design/baseline-fourteen-nights/design/data/schools.json:57-96`.
  - Air has no CSV in this repository.
  - Both CSVs move into `docs/design/reconciled/data/arena/` as canonical data. Section 6, T5 decides the Air CSV's home.
- **Spell shapes the kernel lacks** (today's kinds are `projectile | cone | ring | zone | target | self | passive | wave`, `catalog.ts:9`):

  | Shape | Spells that need it |
  |---|---|
  | spell-owned line (lance, unblockable lance) | Fire Brand Lance, Air Tempest Lance |
  | delayed ground detonation with a fill telegraph | Fire Pyre, Fire Sunfall (a meteor whose shadow outlives the caster), Air Downdraft |
  | channelled beam that ticks every 0.25 s and follows facing | Fire Brand Wrath, Air Cyclone; the two differ on perfect absorb (Fire allows only the first tick, Air every tick) |
  | dash, with a damaging trail or without | Fire Cinder Step, Air Slipstream |
  | curving arc projectile | Air Veering Bolt |
  | sequenced multi-shot | Air Squall |
  | evasion with one RNG draw per hit | Air Form; the draw needs its own RNG stream key so draw order is portable |
  | deflect on perfect absorb | Air; replaces the Water Mirror reflection |
  | spell knockback | Fire Ring of Cinders |

  Enemy telegraphs already provide `lane` and `area` (`kernel.ts:254-286`), which can be reused for spell-owned lines and detonations. Other readers of `Spell.kind` must learn the new kinds: `mage-ai.ts:49-62`, `packages/game/src/arena-scene.ts:609-660`, `effect-player.ts:174-176`.
- **Resource hooks.**
  - Damage multiplier: beside `damageMult` in `trySpellCast` (`water.ts:34-53`).
  - Absorb drain: next to `wardDrainMult` (`kernel.ts:143`).
  - Stamina regen: `kernel.ts:330`.
  - "Unabsorbed hit" gains: `resolveHit` (`kernel.ts:87-102`).
  - Momentum's speed rule: `moveActor` (`kernel.ts:148-188`).
  - Per-tick decay and proximity: a per-school `update` beside `updateWater` (`kernel.ts:328`). CR-002 requires the resource tick before the same-tick release.
- **AI.**
  - `mage-ai.ts:149` aims its lead with Water bolt speed. Fire needs 18 m/s, Air 24 m/s.
  - Spell choice reads `a.water.*` (`:155-170`). Fire needs CR-002's Sunfall bank rule. Air needs `ChooseAirSpell` (AIR.md:96-101).
  - `rival-plan.ts` is typed to Water lines (`:9,16,30,94`).
- **Season and identity.**
  - Hard-wired to Water: `GamesPlayer.school: 'water'` and the `Water proxy` labels (`games.ts:13,16,43-49`), `season-bridge.json` `playableSchool`, and character pick (`packages/game/src/game-shell.ts:377-401`).
  - The Lab practice profiles (`tuning.ts:277-312`, `lab-schools.json`) are retired for schools that become real.
  - **The Lab opponent defaults to `fire` (`lab.ts:43`), so making Fire real rehashes the `lab7331` golden.** Expect that and re-pin it deliberately.
- **Guards that will fire.**
  - Save-source hashing refuses old saves on any kernel or data edit (`packages/director/src/save.ts:22-27`). Expected; communicate it in START-HERE.
  - The census `sourceHashes` list `spells-water.csv` (`report-w4.ts:46`). The new CSVs join that list.
  - Authored-data validators and `lintSpells` extend to each school.
- **Presentation already delivered.**
  - Fire and Air effects atlases (`assets/accepted/covenant/a8/`): aura, cast, hit, impact, projectile, travel.
  - Casting sigils and cone, line and ring threat sigils (`a13/`).
  - `status.burning`; Brennic and Iskar bodies; `cast.fire` and `cast.air` audio cues.
  - **Missing:** art for the meteor shadow, beam, dash trail and curving arc; a sigil extent for the new shapes (`sigil-contract.ts:19` has only ring, cone and line); and a HUD meter for Heat and Momentum. Today the HUD shows Flow as a text panel (`arena-entry.ts:993-1000`).

## 4. Work packages (proposed split; final sizing at the next spark)

The effort is split so the AI-opponent half, which serves VR now, lands before the player-facing half, which serves PC long term.

| WP | Content | Depends on | Acceptance (summary) |
|---|---|---|---|
| **WP0 School seam** | Shared control state plus per-school resource; per-school catalogue and composition union; save schema; compiler takes a CSV per school | none | **Zero behaviour change:** all goldens and census digests equal today's; gate green |
| **WP1 Fire kernel** | Heat; ten Fire rows; new shapes (line, detonation and meteor, beam, dash trail, knockback) | WP0 | Every CR-002 hand check is a passing core test, with numbers exact |
| **WP2 Fire mage** | Ember mage AI (competence model, 18 m/s lead, Sunfall bank rule); Games flag; Lab opponent school | WP1 | CR-002's VR scenarios match on outcome fields (seed 40000 and 40001: loss, 960 and 1103 ticks, hp 0, mana 20.875 and 18.75, sunfall 0); `SunfallBeat` equivalent; census of a Fire duel recorded, not tuned |
| **WP3 Air kernel** | Momentum; ten Air rows; curving arc, sequenced shots, evasion RNG, deflect | WP0 + owner sign-off (P6) | Hand checks derived from the signed text (CR-007), written test-first |
| **WP4 Air mage** | `ChooseAirSpell`; Games flag | WP3 | Duel census on PC; **pacing findings returned to VR as numbers** (DF-008) |
| **WP5 Presentation** | Heat and Momentum meters, new-shape telegraphs and effects, labels, readouts | WP1/WP3 | Native 1080p/1440p captures; owner feel stays open |
| **WP6 Playable Fire/Air** | Player composition, presets, character pick, season-bridge school | WP2/WP4 + P1-P5 | Decided at the next spark |
| **WP7 Dual-dev tooling** | Section 6, T1-T6 | none (WP7a can start at once) | Decided at the next spark |

**Timing against 18 Nov:** VR's content freeze is 25 Oct, and its desktop core gate is 31 Oct. VR needs the PC port only for parity and for tuning answers, not to ship. So the deadline-sensitive work is **WP2's census plus WP4's pacing answers**, which VR can use before its 16 Nov store freeze. WP5 and WP6 serve PC after the hackathon.

## 5. Risks

- **Hash churn.** WP0 must stay hash-neutral or every downstream verdict loses its baseline. Land it alone, prove the goldens equal, then build on it.
- **Air spec drift.** VR may retune Air during the hackathon (DF-008). Port from a pinned revision of AIR.md and the CSV, and re-port by CR, never by copying a working tree.
- **Portable RNG and order.** Air Form's evasion draw and Veering Bolt's launch-side parity must follow VR's draw order exactly. Otherwise outcome parity fails silently on seeds.
- **Pin drift is invisible today.** 31 PC commits have touched `packages/core/src/arena` since VR's pin (`baeac66`). VR's `check-pin.mjs --source` only checks bytes at the pinned commit. See T3.
- **Doc staleness.** The status tables are dated 2026-10-07. W8 should refresh `docs/gameplay/status.md` and `docs/campaign/status.md` as part of its doc surface.

## 6. Questions put to the owner (all answered 2026-10-23; see section 8)

### Playstyle deviations (PC vs VR)

| # | Question | Context |
|---|---|---|
| P1 | **Player loadout for Fire/Air on PC.** The four-slot, no-branch sheet from `spell-sheet-fire.md` (loadouts Pit-dog, Brand, Sunfall gambit), or the Water-style five lines with branches? | VR has bolt plus three lines plus a mudra seal; PC Water uses the composition screen |
| P2 | **Momentum for a walking player.** The pinned rule (+20/s above 4 m/s; sprint is 6.5 m/s) means WASD sprinting builds it constantly. Accept that, or add a PC-specific gate? | AIR.md:23-25 defers seated Air; PC is the first walking Air |
| P3 | **Roll vs blink.** CR-001 asks for a kernel blink to three pads. Adopt only the shared pad id on actors, which costs PC nothing, or ignore it? | CR-001 is mostly VR-only |
| P4 | **Rival phases (CR-005).** HP breaks at 0.66 and 0.33, a tier surge, and the `opensWith` signature. Take the rule onto PC's named rivals (Brennic, Garran, Iskar) or keep it VR-only? | DF-006: the rule works, the pacing does not |
| P5 | **Threat geometry and ember spit (CR-003, CR-004).** These are seated-specific. Accept only the shared-path edit (projectile range reads `Attack.RangeM`) and decline the rest? | CR-003 "the dais does not become a kernel field until a channel wants it shared" |
| P6 | **Air sign-off.** Lio or Iskar as the Air rival; the pierce reading; the Momentum dead band (0-4 m/s); Shear's diverging fan; deflect replacing Mirror; the evasion RNG key; whether the staff dome reduces area and line rows (DF-008 option C) | AIR.md "Owner:" points |
| P7 | **Missio semantics.** TV/PC ends the Games day on missio; VR retries. Keep PC's rule? | VR `docs/campaign/03-tv-divergence.md:79` |

### Art

| # | Question | Context |
|---|---|---|
| A1 | **New-shape art.** Meteor shadow and impact, beam, dash trail, curving arc, squall orbs. Generate, or build them procedurally from the existing a8 clips? Under which budget? | Project is at about 382 of 450 images; Grok is latched on HTTP 402 |
| A2 | **Heat and Momentum HUD.** A painted meter in the collar language, or a text panel like Flow today? | `arena-entry.ts:993-1000` |
| A3 | **Shared or separate art direction.** VR's style pick (13/25/30) is still undecided, and VR said Tessera & Lime is not inherited. Does PC keep its own direction permanently? | VR DECISIONS:342-343 |
| A4 | **Rival bodies.** Air rival Lio has no body (A15 plan: Corvo, Senna and Lio are unpainted). Paint Lio, or use Iskar as the Air rival? | `../waves/A15-rival-bodies-plan.md` |

### Tooling for dual development

| # | Question | Context |
|---|---|---|
| T1 | **CR inbox on PC.** A `docs/change-requests/` ledger here (status: received, accepted, ported, re-pinned) that mirrors VR's CRs, so a CR is acknowledged where it is applied | No CR is acknowledged on PC today |
| T2 | **Parity harness.** Turn each CR's hand checks and VR scenario summaries into a `parity` test suite that compares outcome fields, since the hashes differ. Or build a shared portable hash (VR MOONSHOT `SimMath`)? | CR-002 "matches outcome fields" |
| T3 | **Pin drift report.** A PC-side command that lists kernel and data changes since VR's `PINNED.json` commit and runs VR's 45 vectors against PC HEAD (behaviour diff on re-pin) | 31 arena commits since the pin, nothing flags them |
| T4 | **Reverse vectors (VR to PC).** VR records new-school vectors (`conformance-vr/`, VectorRecorder) that PC replays | Proposed in VR MOONSHOT:655-712, not built |
| T5 | **Shared school data home.** Canonical `spells-fire.csv` and `spells-air.csv` here, with VR pinning them like the Water data, instead of `spells-air.csv` living only in VR's overlay | VR overlay `apps/vr/data/vr/schools/` |
| T6 | **Tuning return path.** A Lab or census export that writes a proposed number set back to VR as a CR addendum | Makes section 1's "PC tunes VR" concrete |

## 7. Sources

- PC scouts, 2026-10-23: kernel, catalogue, guards and presentation (section 3).
- VR, read-only: `docs/change-requests/CR-001..005`, `docs/schools/FIRE.md`, `AIR.md`, `docs/DECISIONS.md`, `docs/campaign/02-vr-run-as-campaign.md`, `03-tv-divergence.md`, `docs/REPO-LAYOUT.md`, `apps/vr/tools/conformance/`, `apps/vr/data/PINNED.json`.
- Repo decisions: D40 (`../MAGE-ARENA-PLAN.md`), `../REPO-LAYOUT.md`, `../gameplay/open-questions.md` #10-11.

## 8. Design brief (spark 2026-10-23, owner answers)

### Decisions

| # | Answer | Implication |
|---|---|---|
| P1 | **Bolt + 4 free slots, no branches** for Fire and Air (authored sheet; presets Pit-dog, Brand, Sunfall gambit; Air presets authored the same way) | `Composition` becomes a per-school union; a second composition-screen layout |
| P2 | **Momentum as pinned** (+20/s above 4 m/s, -25/s still), walking counts | The census measures saturation; any change goes into the PC overlay |
| P3-P5 | PC takes **CR-005 rival phases (the rule, not VR's numbers)** and **CR-003's shared `Attack.RangeM` edit only**; CR-001 and CR-004 stay VR-only | Named-rival duels on PC get breaks at 0.66/0.33, a surge, and the `opensWith` signature |
| P6 | **AIR.md as built by VR's T23, rival Lio**: pierce = one extra target; still = zero displacement; deflect replaces Mirror; Shear diverges; the evade RNG key and activation parity follow VR | PC writes the accepted text as CR-007 in its CR inbox |
| P7 | Director, by convention: **PC keeps missio-ends-the-day** (season channel) | none |
| A1 | **Procedural shape art** from the a8 fire/air clips, plus new sigil extents (`circle-fill`, `beam`, `arc`); no generation | `sigil-contract.ts` gains shapes |
| A2 | **Rune meter** built procedurally from the a13 glyphs and inscriptions, marked at 50/80 (Heat) and 40/80 (Momentum), on the player HUD and at the opponent's feet | Replaces the text panel for school resources; Flow keeps its panel |
| A3 | Director, by convention: **PC keeps its own art direction**; VR's style pick does not apply | none |
| A4 | **Generate Lio** as an A15 body: about 8-10 agy calls, two attempts per slot, under the 398 target | Art lane; Grok stays latched |
| WP6 | **Lab + practice entry** can play Fire (Brennic body) and Air (Iskar body); **season character pick stays Water** (W8b) | Lab setup and the training select gain a player-school choice |
| T1/T5 | **CR inbox** `docs/change-requests/` (received, accepted, ported, re-pinned) plus **canonical** `spells-fire.csv` and `spells-air.csv` in `docs/design/reconciled/data/arena/` holding **VR's numbers** | VR pins them like the Water data |
| T2 | **Outcome-parity suite**: CR hand checks plus VR scenario summaries, compared field by field; a shared hash is revisited after 18 Nov | `packages/core/src/arena/parity/` |
| T3 | **Pin drift report**: core/data diff since VR's `PINNED.json` commit, plus VR's 45 vectors re-run at HEAD | `npm run vr:drift` |
| T4 | **Reverse vectors**: PC defines the format and builds the replayer and checker; **the VR recorder is filed as a CR in mage-arena-vr (doc only)** | No VR code from W8 |
| T6 | **Tuning return export**: a census- or Lab-backed number set plus evidence written as a CR addendum for VR | Closes the PC-tunes-VR loop |
| Balance | **PC tunes locally** through an overlay: canonical CSVs keep VR's numbers, and `school-balance.pc.json` per-key overrides apply at load. Parity runs with the overlay **off**; Lab, census and practice run with it **on** | Each overlay key is a visible deviation and a CR candidate |
| Order | **Parallel lanes** after WP0 | WP0 is committed by the Director as wire types plus compilable stubs before the fan-out |

### Wire contract (every lane builds against these names)

- School ids: `'water' | 'fire' | 'air'` (the existing `School` type, `tuning.ts:7`).
- Spell ids: the CSV `id` column verbatim (`fire_bolt` ... `fire_wrath`, `air_bolt` ... `air_cyclone`). Water keeps `line:tier:branch`.
- Composition: `WaterComposition` (today's shape) | `SlotComposition = { school: 'fire' | 'air'; name: string; bolt: SpellId; slots: [SpellId, SpellId, SpellId, SpellId] }`.
- Actor resource (**amended by WP0**): `Actor.school?: School` plus one optional `Actor.schoolState?: SchoolState` (`school`, `loadout`, `value` = Heat or Momentum, `lastGainTick`, `lockedUntil`, `gained`, `cooldowns`, `formUntil`). Every actor keeps `water` (CR-002 keeps the water composition on a Fire mage), and the shared control fields stay where they are: moving them would rehash every golden. Cross-tick spell effects live in an optional `ArenaState.schoolEffects?: SchoolEffect[]`, and a parity run sets `ArenaState.balance = 'canonical'`.
- **Absent-value convention: a non-school actor omits the resource key.** Never `null` or `0`, so Water state hashes stay byte-equal.
- Overlay: `{ "version": "school-balance-1", "overrides": { "<spellId>.<column>": number, "<school>.identity.<key>": number } }`. Unknown keys are refused at load. File: `packages/core/src/arena/data/school-balance.pc.json`, empty in WP0.
- Games flag: `runtime.games.schoolRivals: boolean` (default `false`). When true, the semifinal and final use named rivals, Brennic (fire) and Lio (air), with their own schools.
- Parity fixtures: `packages/core/src/arena/parity/<cr-id>.json`, outcome fields `{seed, wave, outcome, phase, ticks, hp, mana, wavesCleared, extra}`.

### Work packages

| Lane | Content | Files (primary) | Acceptance | Doc owner |
|---|---|---|---|---|
| **WP0 seam** (Director, before fan-out) | Wire types, compilable stubs, compiler reads both school CSVs, empty overlay loader, kernel hook points (`schools.ts` dispatch). **No save-schema change in W8**: season saves stay Water | `types.ts`, `catalog.ts`, `arena-data.mjs`, `save-schema.ts`, `tuning.ts` | All goldens and census digests unchanged; gate green | this doc |
| **F: Fire** | Heat, ten rows, line/detonation/meteor/beam/dash-trail/knockback shapes, Ember mage AI (18 m/s lead, Sunfall bank), Lab opponent school; CR-002 parity suite; deliberate `lab7331` re-pin | `fire.ts`, `kernel.ts` (shape hooks), `mage-ai.ts`, `parity/cr-002.*` | Every CR-002 hand check exact; both VR scenarios match on outcome fields; parity runs overlay-off | `docs/gameplay/casting-and-spells.md` (Fire section) |
| **A: Air** | Momentum, ten rows, curving arc, sequenced volley, evade RNG, deflect, Gale mage AI (Lio); CR-007 text; parity from the T23 readings | `air.ts`, `mage-ai.ts` (air branch), `parity/cr-007.*` | Hand checks from the CR-007 text pass; draw order per VR | emits a section to scratch; the Director merges it into F's doc |
| **R: rivals** | CR-005 phases on named rivals; CR-003 `RangeM` edit | `games.ts`, `rival-plan.ts`, `enemies.ts` | Breaks at 0.66/0.33, surge capped at 4, signature granted once; a killing blow is a win, not a break | `docs/gameplay/opponents-and-arena-tiers.md` |
| **T: tooling** | CR inbox; `vr:drift`; tuning return export; reverse-vector format plus PC replayer; VR recorder CR doc | `docs/change-requests/`, `packages/tools/vr/` | Drift report runs against `C:/Users/kazda/kiro/mage-arena-vr`; replayer passes a hand-made vector and fails a planted one | `docs/change-requests/README.md` |
| **P: presentation** (after F/A merge) | Rune meters, procedural shape telegraphs, sigil extents, bolt+4 composition screen and presets, player school in Lab and practice entry, Brennic/Iskar player bodies | `packages/game/src/*` | Native 1080p/1440p captures; desktop stress at 60 fps with beams and trails | `docs/START-HERE.md` |
| **Art: Lio** | A15.1 Lio body, nine states | `tools/art`, `assets/accepted` | Delivery gates of the art pipeline; at most 10 calls | art ledger |
| **B: balance** (after F/A) | PC census of Fire and Air duels; overlay keys; T6 export for VR (DF-006/007/008) | `school-balance.pc.json`, census reports | Duels in the 45-80 s band with the overlay on; parity is still green with it off | `docs/gameplay/status.md` |

### Non-goals

Earth; season character pick for Fire or Air (W8b); any code in `mage-arena-vr`; painted shape art; PC numbers in the canonical CSVs; CR-001 and CR-004 on PC; a shared portable hash.

### Risks

WP0 hash neutrality (land it alone and prove it). Parallel lanes share `kernel.ts` and `mage-ai.ts`: WP0 stubs give each school its own module, and kernel edits are limited to named hook points. Air spec drift: port from AIR.md and the CSV at a recorded VR commit. Old saves are refused after WP0; say so in START-HERE.

### WP0 as landed (2026-10-23)

- **Data.** `spells-fire.csv` is byte-identical to the blob at `baeac66` that VR pins. `spells-air.csv` comes from VR `f134847`. `schools-combat.json` holds the Fire and Air `combatIdentity` from `baeac66`. The compiler exports `fireRows`, `airRows` and `schoolIdentity`, and checks headers and numeric cells.
- **Seam.** `arena/schools.ts` holds the catalogues, the overlay (unknown keys fail at load), presets, `slotSpell`, and `SchoolRules` dispatch. `arena/fire.ts` and `arena/air.ts` are stubs. `arena/shapes.ts` declares the shared shapes and is owned by lane F.
- **Kernel hook points** (`kernel.ts`), the only places lanes plug into the kernel:

  | Hook | Where |
  |---|---|
  | `schoolTick` | before `updateWater` |
  | `schoolStaminaRegenMult` | stamina regen |
  | `schoolDrainMult` | ward drain |
  | `schoolRollStaminaMult` | roll cost |
  | `schoolAfterMove` | after `moveActor` |
  | `trySchoolCast` / `releaseSchoolSpell` | the cast/release branch |
  | `schoolEvades` | after the immune check in `resolveHit` |
  | `schoolOnHit` | before the defeat check |
  | `schoolDeflects` | before `reflectProjectile` |
  | `stepSchoolEffects` | after `updateProjectiles` |
  | `resetSchool` | in `resetWave` |

  A lane that needs a different placement asks the Director.
- **Proof.** The gate is green. The golden replay hashes are unchanged. Census digests for 2,000 fights per wave are equal before and after WP0 (wave 1 `0bf61caf`, wave 2 `df82257a`, wave 3 `0f671697`, wave 4 `9a9b4a79`). These are the **pre-reaction-fix** digests.
- **Current baseline (W8 lane X, AI reaction at pace, `W8-evidence/w8x.json`):** wave 1 `d51d8530`, wave 2 `c115fe14`, wave 3 `016c24a2`, wave 4 `869772b4`. Lane X re-pinned them on purpose. Named census `named.json`: semifinal `c89f64d1`, final `c73a64aa` (lane B's pre-fix values were `ae484ddb` and `b7dd23f3`).
- **Inherited, not W8.** The census semifinal median is 38.9 s against a 45-75 s band on `main` before WP0, so `report:w4` prints "gate FAIL". The cause is the 1.5x pace (`4127797`). Lane X paced the AI reaction, and the median rose only to 41.1 s, so it still fails. The same semifinal at 1x runs a median of 56.7 s, so the duel is compressed by pace, not by reaction. It needs an owner decision; W8 does not tune Water.

### Build progress (2026-10-23)

| Lane | State | Commits |
|---|---|---|
| WP0 / WP0b seams | landed, hash-neutral | `5b88caf`, `f1038cc` |
| T tooling | landed: `docs/change-requests/`, `npm run vr:drift`, `vr:tuning-return`, `vr:vectors` | `8602307` |
| F Fire | landed: every CR-002 hand check exact. The VR duels match outcome, phase, hp, waves and sunfall. Ticks and mana diverge from tick 0 on PC's post-pin variety draw (`mage-ai.ts`), documented, not tuned | `6a89060`, `ca08eba` |
| A Air | landed: AirTests.cpp hand checks exact; no VR Air duel exists to compare | `c84524d`, adoption merge `9052086` |
| Director kernel seams | hit flags, Air flight and evade, interrupted/busy/rooted hooks, onHit role, `createGames` balance/unpaced | `d09a474` |
| R rivals (CR-005, CR-003 RangeM) | landed: named-only phases via `hookArena` (outside the hash), granted signature through `grantedCast` in fire.ts/air.ts, `rivals.json` at VR values. CR-003 approach range reads `attack.rangeM` | lane R commit |
| B balance | Lio's final in band, Brennic's semifinal not (structural): overlay of seven keys (darts 2.1 / 1.1 damage, 2 mana; Air Form 0 s cast, 3 s cooldown, 0 mana), `rivals.json` unchanged. Full named census (2,000 per duel, `npm --prefix packages/core run census:named`): Lio 45.3 % wins, median 47.6 s, PASS; Brennic 47.5 % wins, median 32.5 s against 45-75 s, FAIL. Cause: no AI actor wards or rolls in a Tiro duel at pace 1.5 (threats stay visible ~23 ticks, reaction delays are 27-33 ticks and unpaced), so a duel is a DPS race, and with every Fire damage cell at 0 the reference player still kills Brennic in a median of 33.8 s. Needs an owner decision (pace law or the reaction model, or named-rival HP), not overlay numbers. Default census digests unchanged | lane B commit |
| X reaction (owner decision 2026-10-23) | AI mage reaction runs at the mage's own pace: `paced(max(0.25 s, delay x scale))`, with the floor in authored seconds. AI mages ward again in Games duels: a Water semifinal rival goes from 0 to 1.6 reactions per duel. Goldens, the ladder, rival-plan and bout-reader pins were re-pinned with reasons. Default census: waves 1, 2 and 4 pass; the semifinal fails at 41.1 s, and the cause is pace (56.7 s at 1x). Named census: Lio passes (54.3 %, 52.2 s) with the air dart cut 1.1 to 0.9. Brennic is at 51.6 % but 34.1 s, under band, with a harmless ceiling of 35.4 s | lane X commit |
| P presentation, Art Lio | after R | |

Proof: gate green (470 tests, 0 skipped). Water goldens unchanged. Census digests equal to the pre-W8 baseline after every core commit up to lane B. Lane X changed Water behaviour on purpose: it re-pinned the goldens and set the new census baseline above.

Findings for later lanes:
- **Duel pacing (lane B).** A smoke run of six Air finals has Lio beating the reference player in 9-15 s at Momentum 100. VR's Air census is also short (DF-008). The pacing fix goes into the PC overlay and is returned to VR with `vr:tuning-return`.
- **VR pin drift (T3).** `vr:drift --vectors` passes 2 of VR's 45 conformance vectors at PC HEAD. The causes are PC changes after the pin: release and stagger events, Games spawn spacing, pace, and AI draws. A re-pin needs a deliberate review, not a byte copy.
- **Still open.** Air event kinds (evade, deflect), an aim seam for Slipstream (it writes the brain input today), the generic threat reader's straight-line view of a curving bolt, and the `schools.ts` import-order trap (a test must import `kernel.ts` before `fire.ts`/`air.ts`).

Lane R measurement (20 seeds, 70001-70020, reference player at competence 2): the reference player loses **all 40** named duels. The Brennic semifinal median is 13.9 s with phases on and off. The Lio final median is 14.6 s with phases on and 15.0 s off. The rival reached its last phase in only 2/20 duels of each, because it rarely drops below 33%. Phases cannot be judged until lane B makes the duels winnable: the rivals run competence 1 and 1.5, yet beat the reference build easily, so the Fire and Air kits outclass the Water reference loadout at VR's numbers.

## 9. Next session: the combat system (owner direction 2026-10-23)

> "We should not focus that much on pacing now, the measured times are looking relatively well, it would be the combat system - balancing of spells and way how each class attacks and contra spells we should focus on next session. The mechanics are very generic, more sophisticated variants we will come up with, the more we leverage simulation tooling you designed in this session."

**Where the semifinal stands (accepted for now).**
- Brennic semifinal median 34.1 s against a 45-75 s band, at 52% reference wins. The Lio final is in band.
- Option 4 (more rival HP) was measured on 300 seeds, with rivals.json `maxHp` now supported but unset:
  - 125 HP gives a median of 39.4 s at 22.7% wins;
  - 130 HP gives 40.0 s at 16.0% wins.

  HP alone trades the win rate away without reaching the band, so no value was committed.
- Adding `fire_sunfall.damage` 55 on top of 125 HP produced numbers identical to 125 HP alone (39.4 s, 22.7%).
  - Either Sunfall is not what decides these duels, or **the granted signature cast does not read the PC overlay**.
  - Check this first: `rival-phases.ts` `tryGrantedCast` -> `fire.ts` `grantedCast`; compare `balancedSpell` against
    `canonicalSpells`.
  - **Checked 2026-10-23 (combat session): the seam is sound.** `grantedCast` reads `balancedSpell(row, state)`. Planting `fire_sunfall.damage` 20 on 60 named semifinal seeds moved player damage taken 4589 -> 4553 and wins 36 -> 38, so the overlay applies. Sunfall is simply a weak lever: the census ledger shows unblockable contacts avoided 5585 against 286 taken, so the reference player dodges it almost every time. Treat the signature as a telegraph the player reads, not as damage.

**What the simulation tooling now offers the combat work.**

| Tool | Command or location | Use |
|---|---|---|
| Default census (Water season) | `npm --prefix packages/core run report:w4` | baseline digests in `docs/waves/W8-evidence/w8x*` |
| Named census (Brennic, Lio) | `npm --prefix packages/core run census:named` | win rate, median, phase readings |
| Threat-answer ledger | `ledger.ts` | why each contact landed: perfect, held, rolled, took, ... |
| PC balance overlay | `school-balance.pc.json` | what PC deviates from VR |
| VR addendum | `npm run vr:tuning-return` | returns those deviations to VR with evidence |
| Parity suites | `parity/cr-002`, `parity/cr-007` | guard VR's rules while variants are explored |
| Lab forecast | in the Lab | about 400 fights in 6 s in the browser |

**Starting questions for that spark.**
- How should each school attack: rhythm, range bands, signature setups? Today the AIs pick by damage and competence, and darts dominate.
- What counter-spells and answers exist: school-specific counters to Sunfall, Tempest, the volley and the beam; read and punish windows?
- How do the four kits relate to each other: a Fire vs Air vs Water triangle, or something else?
- Which numbers come out of the census rather than out of hand-tuning: target answer mixes per school from the ledger?
