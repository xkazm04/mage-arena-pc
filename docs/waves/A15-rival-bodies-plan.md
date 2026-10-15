# A15 - Rival bodies: plan and owner decisions

Status: plan only, 2026-10-15. No generation calls, provider probes or code changes were made.
Owner note after the TV run: "Opponents need character art each at similar level we have main character".
Numbers marked **(est.)** are extrapolations and have not been measured.

## Summary

- The design never had Water opponents in the Tiro Games. Wave 3 is "entrant_of_another_tent" and wave 4 is
  "winner_of_other_semifinal" (`docs/design/reconciled/data/arena/arena-tiers.json`, tiro waves 3-4). The anonymous
  "Water proxy" is a W4 placeholder that lasts until W8 brings the other schools (`docs/waves/W4-tiro-games.md:9`,
  `docs/gameplay/opponents-and-arena-tiers.md:53`, `docs/gameplay/open-questions.md` #11).
- The current entrants of the other three tents are Brennic, Garran and Iskar, and painted 9-state bodies already exist
  for all three. Naming them as the opponents costs **zero generation calls**.
- The one Water character who needs a body is **Nysa**. She is Cassia's Tent Trial rival. When she wins the Trial she
  becomes the tent's entrant, so she fights in the Games while the player watches from the benches.
- Recommendation: **(d) named other-tent entrants now, plus one new body for Nysa** (A15.1): about 8 agy calls (est.),
  at most 10. That fits under the current target stop of 398 without raising any cap. Owner decisions are listed in section 6.

## 1. Who the rivals should be

**Design rule.** Tiro has four waves: soldiers, creatures, a semifinal against an "entrant of another tent" at
competence 1, and a final against the "winner of the other semifinal" at competence 1.5 (`arena-tiers.json`). Each
tent sends one entrant. The Tent Trial picks it: an unarmed best-of-three exchange against the same-school, same-rank
rival (`season.ts` `beginTrial`: `c.school === player.school && c.rank === player.rank && c.role !== 'elder'`). The
entrant score is 50% bout result, 30% elder trust and 20% renown (`arena-tiers.json` `tentTrial.score`;
`docs/campaign/season-bridge.md:45`).

**The Water candidates.** Only two Water characters exist: Nysa (rival, rank 1) and Elder Ophel (elder, rank 4)
(`docs/campaign/cast-and-schools.md`). The Trial rival is therefore Nysa. The one-entrant-per-tent rule means a
second Water fighter cannot meet Cassia in the semifinal or final. Making the opponents Water would contradict the
bracket. Nysa reaches the arena only by winning the Trial. The player then watches "the rival's deterministic Water
bout" (`season-bridge.md:46`; `season.ts` `prepareBout`, `spectator: entrant.id !== s.camp.player`).

**The other tents' entrants.** These come from `cast-and-schools.md` (bios and the `rank` column), the visual
descriptions in `art/cast-covenant.json` and `art/covenant-battle-roster.json`, and the portraits in
`assets/accepted/covenant/a2c/portraits/<id>/` (7 moods each: neutral, calm, proud, angry, afraid, grieving, scheming;
512 px busts).

| Tent / school | Current entrant (main) | Painted body? | Trial rival | Body? | Rival look (`cast-covenant.json`) |
|---|---|---|---|---|---|
| Ember / fire | Brennic the Red, Gaulish auxiliary who burned a ford for Rome | yes | Corvo, "was the Ember entrant until the new Fire mage arrived" | no | pale olive, crooked nose, coal-black hair, rust-red sash |
| Stone / earth | Garran Stonehand, Danube farmer and wall builder | yes | Senna, "best young fighter until Garran came" | no | deep brown skin, shaven head, eyebrow scar, ochre cloth |
| Gale / air | Iskar Windborn, steppe rider who hates the collar | yes | Lio, reckless, in debt, goal `win_games` | no | tawny skin, auburn curls, lavender scarf |
| Tide / water | Cassia (player) | yes | **Nysa**, "best liar in camp" | **no** | warm brown skin, thick black braid, pale blue/ivory, sea-glass charms |

The bios support the mains as the current entrants of their tents. That gives a zero-art bracket: the semifinal opponent
is a seeded one of {Brennic, Garran, Iskar}, and the final opponent is a seeded one of the remaining two. Naming them is
also a story gain. The Four start with mutual trust (`cast-and-schools.md`, starting relationships), and that bond
leads into the Summa's "Breaking" final (`arena-tiers.json`, summa wave 2).

**Can core name the real rival?** Yes, but it is not a one-line change. This is what it would touch:
- `packages/core/src/season.ts` `prepareBout`: derive the bracket from `s.camp.characters` (living `role: 'main'` of
  ember, stone and gale; a seeded order from `seededUnit`). Store it on `SeasonBout` so `replayBout` stays deterministic
  and saves carry it.
- `packages/core/src/arena/games.ts` `createGames`/`spawnWave`: accept an opponents list. Replace the
  `'Tiro entrant · Water proxy'` label (line 41) with the name and set `actor.school`. `GamesPlayer.school` is typed
  `'water'` only (line 14), so add a separate opponent type.
- Balance: `actor.school` turns on the CF1 Lab practice profiles (`tuning.ts` `profileFor`/`adjustedSpell`;
  `arena/data/lab-schools.json`, whose scope reads "practice profiles over shared Water archetypes; unique W8 school
  catalogues ... pending"). Fire, for example, gets damage 1.12 and control 0.8, and its spells are renamed "Ember
  Needle". The semifinal and final census must be rerun.
- Hashes: `stateHash` hashes `JSON.stringify(state)` (`kernel.ts:345-348`), so changing labels or school changes every
  wave 3-4 hash.
- Presentation: `body-policy.ts` `bodyIdentity` already maps `a.school` to `animation.json` `schoolBodies`
  (fire→brennic, earth→garran, air→iskar). `effect-player.ts:106-109` picks the `a8.page.<school>` effects from
  `a.school`, so those pages must be preloaded.
- Check in the in-flight label fix: `bodyIdentity` matches labels exactly against ids, and the season player label is
  the full name ("Cassia of the Lighthouse", "Nysa"; `campPlayerSnapshot`), so it probably also resolves to
  `mage.unknown` (read from code, not run). Docs: `opponents-and-arena-tiers.md:53`, `open-questions.md` #11,
  `season-bridge.md:46`.

## 2. What a body requires (current A10/A14 contract)

**Runtime deliverable.** The runtime manifest is `assets/accepted/covenant/a14/packed/characters.json`, which says
`aiMages: "reuse four school entities"` and `owner_accepted: false`. A complete body is 9 states (idle, run, cast,
absorb, hit, death, hit-light, hit-heavy, corpse) × 4 directions = 36 clips. Only ne and se are generated; nw and sw
are declared horizontal mirrors, never rotated bodies (`docs/waves/A10-character-direction.md`). Frame 384 px, body
160 px, anchor [0.5, 320/384]; scale v3 nominal 60.75 px at 1080p (range 48.6-72.9), draw multiplier 1.5 applied once
(`art/scale-contract-v3.json`; `art/SESSION-10-HANDOFF.md`).

**Source sheets per character, at minimum:**
1. **Identity master.** A full-body figure. The 12 existing bodies came from A3c battle crops
   (`A10-character-direction.md`); the rivals have only 512 px portrait busts. This takes 1 call, or 2 with one
   correction (est.).
2. **A10 locomotion sheet**, one 4×4 sheet for each of ne and se: 2 idle, 6 run, 2 cast, 2 absorb, 2 hit and 2 death
   keys (`A10-character-direction.md`). Each accepted sheet yields 12 clips including mirrors.
3. **A14 reaction sheet**, one 16-key sheet for each of ne and se: 4 recoil, 6 stagger and 6 collapse keys, exported as
   hit-light 160 ms, hit-heavy 240 ms, death 600 ms, and a corpse taken from the last key
   (`docs/waves/A14-1-hit-and-defeat.md`). Each accepted sheet yields 8 clips.
4. Optional **A14.3 combat/defense sheet**, 12 poses for each of ne and se, for better cast and absorb
   (`A14-3-stage3-motion.md`; job `a14-shieldman-ne-combat-agy-a01`).

That is a theoretical minimum of 5 calls for 36 clips.

**Every call passes** the identity reference, the Moonchalk painting-bar portrait and the Covenant style block.
**Gates:** source margins; silhouette and alpha mass; pigment and value drift against the identity crop; hash-bound
facing observations; scale and pivot; corpse equality; byte-identical offline rebuild; browser loop and hold checks.
The local grader may only reject a sheet or route it to the owner. Owner acceptance of animation is never claimed
(`art/ACCEPTANCE.md`; `tools/art/a14_build.py`, `a14_audit.py`, `a14_portable.py`, `a14_browser.py`). Each slot gets
at most two fresh attempts (`SESSION-10-HANDOFF.md`).

**Measured history.** Charged calls per entity, A10 plus A14, computed from `art/usage.json`:

| Entity | A10 | A14 | Total | Clip gaps today |
|---|---|---|---|---|
| conscript / slinger | 3 / 3 | 2 / 2 | 5 / 5 | slinger absorb ne,nw |
| iskar / shieldman / netter | 3 / 4 / 4 | 4 / 3 / 3 | 7 / 7 / 7 | iskar run se,sw; shieldman cast ne,nw; netter absorb ne,nw |
| brennic | 8 jobs, 9 charges | 2 | 11 | none (includes the agy duplicate-output anomaly, charged 2) |
| garran | 3 | 9 | 12 | none (rear collapse needed 5 attempts across both providers) |
| cassia | 10 | 3 | 13 | none (was the A10 direction pilot) |

Creature rates: A14.3 stage 2 made 52 slots from 20 calls (7 rejected sheets), **2.6 slots per call (0.38
calls/slot)** (`A14-3-stage2-creatures.md`); stage 3 made 46 slots from 18 calls, **2.56 slots per call (0.39)**
(`A14-3-stage3-motion.md`). Creatures needed separate hits and collapse sheets, so this overstates a humanoid: at
creature rates 36 slots take about 14 calls, the upper bound.

**Per-rival estimate: about 8 calls (est.)** (identity 1-2, 4 sheets, about 2 retries); **hard ceiling 10** under the
two-attempt rule (5 slots × 2); about 14 with combat/defense sheets.

Time per call: median 52 s, range 8-113 s (`art/usage.json` `elapsed_seconds`, 64 A14 jobs). Session 10 ran 40 serial
calls in about 71 minutes. Gating, export and boards take most of an art session (est. half a day per 1-2 characters).

## 3. Budget and provider state

**Ledger** (`art/usage.json`): 380 job rows and **382 charges**. The total matches `art/delivery/a14/session10/current.json`
`projectCharges` and `docs/MAGE-ARENA-PLAN.md:278`. No calls have been made since 2026-10-04.

**Caps** (`art/budget.json`, enforced in `tools/art/generate.py:72-80`):

| Cap | Limit | Room left |
|---|---|---|
| `target_images` (raises `TARGET_BUDGET_STOP`) | 398 | **16** |
| `wave_hard_cap` | 450 | **68** |
| `weekly_image_cap` | 450 | all charges so far are in 2026-W40 |
| `max_attempts_per_scene` | 3 | per scene |

- `session10_authorization` (40 fresh reservations) is **exhausted**, and the handoff says not to resume it. Any new
  call needs a new owner authorization.
- `automatic_stop_reset: false`. Failed and uncertain calls stay charged, and there are no refunds.

**Providers** (`art/providers/budget.json`, `art/providers/history.json`):

| Provider | Latch | Project charges | Local guard | Room left |
|---|---|---|---|---|
| agy (Nano Banana 2) | clear (`stop: null`) | 148, plus 4 known external probes | 500 | about 348 |
| Grok | **latched** 2026-10-04T09:37:55, job `a14-garran-ne-collapse-grok-a01`, HTTP 402 "exhausted Build balance" (`docs/PROVIDER-LEDGER.md:135`) | about 234 (est.: 75 tagged, plus 159 untagged pre-D20 jobs) | 450 | unusable until the owner tops up |

The real account allowances are not measured; the guards are local only.

**Owner rules:** every past raise is recorded as a host or owner authorization in `budget.json`
(120→180→240→300→345→450); the first quota or rate-limit error latches a stop (`MAGE-ARENA-PLAN.md:121`, D20 at
line 197); each provider has its own guard and latch. **Competing demand:** the A14 backlog of 12 priority and 12
legacy slots (`art/SESSION-10-HANDOFF.md`).

**Precondition (not measured).** The generation references are not in this checkout: `art/review/**/*.png|jpg` is
gitignored, and the A14 raw paths point at `C:\Users\kazda\kiro\mage-arena-art`, which no longer exists. A15 must first locate the Moonchalk painting bar and the style sources. The fallback is accepted assets, such as
`a2c/portraits/nysa/*.png` and the Cassia atlases.

## 4. Options

| Option | Calls / charges | Time (est.) | Quality risk | Unblocks |
|---|---|---|---|---|
| **(a)** Runtime recolour of Cassia per rival (Pixi ColorMatrix hue/saturation, maybe a drawn accessory) | 0 | ~0.5 day | **High** | Distinguishes the two opponents by colour |
| **(b)** Full new bodies for N rivals (N=4: Nysa, Corvo, Senna, Lio) | ~32 expected, ceiling 40 | 1-2 art sessions, plus ~1 day integration | **Medium** | Any of the 8 tent members can be an entrant (W8/W9 trials in other tents, Veteranus) |
| **(c)** Hybrid as asked: new body for the final opponent only | ~8, ceiling 10 | ~0.5-1 session | Same as (b) for one body | See row notes |
| **(d)** Name the other tents' entrants with their existing bodies | **0** | ~1 day code, plus a census rerun | **Low for art** | The owner's request, now |
| **(d)+Nysa** (recommended) | ~8, ceiling 10; 382→≤392 | ~0.5-1 session, plus integration | (d) plus one body at (b) risk | Every Tiro opponent and the spectator bout get painted, character-specific bodies |

Notes on each option:
- **(a)** The atlases have no palette masks, so a hue shift also moves skin, staff and water effects.
  `arena-scene.ts:677` overwrites `sprite.filters` with the hit flash, so the two filters would have to be composed.
  At 60.75 px the silhouette, hood and staff stay identical, so the result reads as "Cassia in a different dye", not
  a different person. It **does not meet** "art at a similar level". It also keeps the design contradiction.
- **(b)** Same pipeline as Cassia, but needs `target_images` 398 → about 430; the 450 hard cap holds (382+40=422)
  while the backlog competes for the same room. Risks: identity drift from a bust-only reference, leading-leg run
  repeats, rear views turning toward the viewer (14 rejected source sheets in session 10, `SESSION-10-HANDOFF.md`).
- **(c)** Collapses into (d): the final opponent is another tent's entrant, who already has a body; a unique Water
  final would break the one-entrant-per-tent rule.
- **(d)** These bodies come from the same A10/A14 pipeline, so they already match Cassia's level. Existing debt:
  Garran rear hood vs bare head, Iskar's front pink hood, and Iskar run se/sw missing (`characters.json`
  `identityDebt`/`backlog`). The design risk: they cast Water archetypes with Lab practice profiles until W8. That
  needs an honest label and a semifinal/final census rerun, because CF2 measured about 38% reference win rate
  (`opponents-and-arena-tiers.md:97`).
- **(d)+Nysa** Nysa's body also serves the future Trial scene and Water-rival content. Brief A15.1: the identity
  master comes from `a2c/portraits/nysa/neutral.png` plus the `cast-covenant.json` description; 2 A10 sheets and
  2 A14 reaction sheets, agy only, serial, at most two fresh attempts per slot.

## 5. Recommendation

Do **(d) now**: the semifinal is a seeded one of Brennic, Garran or Iskar and the final a seeded one of the other two,
each with their school's Lab practice profile and A8 element effects, labelled e.g. "Brennic the Red · Ember (practice
form)"; rerun the wave 3-4 census. Then **A15.1, a Nysa body**: agy only, 10 fresh reservations, ending at or below
392, which fits under the existing 398 target with no cap raise.

**Defer** Corvo, Senna and Lio (about 24 calls (est.), ceiling 30) to W8/W9. That is when other-tent trials can
change who the entrant is, and it needs `target_images` raised to about 430. Do not ship (a).

## 6. Owner decisions needed

1. **Which characters:** accept other-tent entrants as the Tiro opponents (semifinal from {Brennic, Garran, Iskar},
   final from the remaining two), or keep the anonymous proxies until W8.
2. **Combat honesty until W8:** allow Lab fire/earth/air practice profiles over Water archetypes (balance shifts;
   census rerun), or keep Water loadouts under the characters' names with an explicit "Water practice" label.
3. **Art budget:** authorize **A15.1 Nysa**: 10 fresh agy reservations from 382, two attempts per slot, under the
   existing target 398 and cap 450. Optionally pre-authorize `target_images` 398 → 430 for Corvo, Senna and Lio later.
4. **Provider:** agy only. Grok stays latched unless you top up its Build balance, which is the HTTP 402 cause.
5. **Priority:** should Nysa go before the 24-slot A14 backlog? Both draw on the same 16-call room under the target.
6. **Reference archive:** confirm where the Moonchalk painting bar and the Covenant source sheets now live. The path
   `C:\Users\kazda\kiro\mage-arena-art` is gone.
