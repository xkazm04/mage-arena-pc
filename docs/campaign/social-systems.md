# Social systems

This file describes the social state of the camp: trust, debt, loyalty, renown, hunger and the Strays, rumours, tent admission and defection, the bond of the Four, and Parley (typed or carded role-play at Knowing moments).
Numbers come from `data/rules.json`, `data/parley.json` and `packages/director/src/config.json`. Behaviour comes from `packages/core/src/camp.ts` and `packages/core/src/parley.ts`.

Status: built (W0-W6). Numbers are **authored**. Parley's injection boundary is **measured** (W6). How the social systems feel in play is not owner-felt yet.

## Social quantities

| Quantity | Scope | Range | Start | Main sources of change |
|---|---|---|---|---|
| Trust | directed pair `a>b` | −100..100 | 0, or `relationships.json` | BEFRIEND, CONFIDE, PROTECT, WATCH noticed, RECRUIT, caught, rumour reactions, same-tent decay, Parley, Trial respect, Games aftermath |
| Debt | directed pair `a>b` (a owes b) | 0..99 | 0 (lio owes iskar 1) | PROTECT (+1 when socially effective) |
| Loyalty | character, to own tent | 0..100 | trait loyalty × 10; Strays 10 | persuade −15, RECRUIT −8, DEFECT/admission → 40 |
| Renown | character | 0..100 | 5 | rumour −3, caught −5, Games rewards |
| Hunger | character | 0..100 | 0; Strays 60 | Strays +15/day (+8 if working); PROTECT −30 |
| Fatigue | character | 0..10 | 0 | WORK +1, REST −2 |
| Gold | character | 0..9999 | 10 | WORK +4, PROTECT −2, Games payout |
| Stores | tent | 0..9999 | 6 per tent | WORK +2, steal −4 |

Thresholds that change behaviour: hungry at hunger ≥ 70 (training yields 2 instead of 3); fatigued at fatigue ≥ 6 (training halved).

### What the Director sees instead of numbers

`packages/director/src/config.json` `bands` turn numbers into words:

| Quantity | Bands |
|---|---|
| Trust | hostile (< −20), wary (< 0), acquainted (< 20), friendly (< 50), devoted (≥ 50) |
| Traits | low (< 4), moderate, high (≥ 7) |
| Hunger | hungry (≥ 70) / fed |
| Fatigue | tired (≥ 4) / rested |
| Gold | empty purse (< 2), modest purse, comfortable (≥ 20) |

## Trust rules in detail

- **BEFRIEND** is the main trust builder: +6 both ways, ×1.5 between different tents at the same rank (the "duality of tribalism": same-rank peers in other tents bond faster than rivals in your own), then ×0.5 if aggression traits differ by 6 or more, rounded down once, symmetric. Only `rules.json` `effects.BEFRIEND` owns these numbers (defect `trust-authorities` fixed).
- **Same-tent rivalry decay:** every same-tent, same-rank directed pair loses 1 trust per day.
- **Torn-to-peers / torn-to-strangers** (`effects.tornToPeers.trust` +10, `effects.tornToStrangers.trust` −20) are **reserved**. They need arena duality bouts that are not built (defect `torn-to-peers`).
- **Caught** schemers lose 30 trust from their target.
- **Trial respect:** after a Tent Trial the rival's trust toward the player rises by 3 (`data/season-bridge.json`).
- **Games aftermath:** after a player bout, each other main's trust toward the player rises by 3 for a won final or 1 for missio.

## Hunger and the Strays

Strays (Fenna, Old Quill) start at hunger 60 with loyalty 10 and no stores.

| Strays state | Trigger |
|---|---|
| `scattered` | start |
| `huddled` | any Stray was protected today (`arcs.huddledHelps`) |
| `desperate` | huddled and average Stray hunger ≥ 70 (`arcs.desperateHunger`) |

Being fed by PROTECT gives social gain (trust +10 toward the protector, and a debt) only if the target was hungry (`reviewPolicy.protectNeedsHungerForSocialGain`). Paid protection still warns a fed target.
The states are recorded. Consequences of `desperate` beyond the state itself are not specified (deeper Stray arcs are planned for W11).

### Tent admission and the fifth tent

- **Admission** (nightly): a Stray joins a tent if they trust some member of a tent with stores ≥ 20 (`arcs.takenInTrust`), and the tent's elder has warmth ≥ 6 (`arcs.elderWarmth`) or the tent has ≥ 6 stores (`arcs.storesAcceptance`). New loyalty 40 (`arcs.newMemberLoyalty`).
- **DEFECT** (an intent): loyalty < 20, trust ≥ 20 toward someone in the target tent, and the same elder-warmth or stores condition. New loyalty 40.
- **Fifth tent:** a successful RECRUIT of a Stray adds them to the `fifth` list. Only characters with goal build_fifth_tent or hold_fifth_tent may recruit Strays. A fifth tent with its own stores or rules is not built; `fifth` is a tracked list only.

## Rumours

A rumour is a SCHEME of kind `rumour` with a topic. On success: target renown −3, and a public fact "A rumour questions X's conduct." (truth false). Then listeners react.

A listener reacts if all are true: they are not the target; they are not the author (`reviewPolicy.rumourExcludesAuthor`); they share a tent with the author or the target, or both they and the target are among the Four; their trust in the target is below 20 (`disbeliefTrust`); and they hold one of the topic's values.

| Topic | Values that react | Listener's trust in target |
|---|---|---|
| serves_rome | freedom, spite | −10 |
| cowardice | strength, honour | −6 |
| theft | order | −6 |
| kindness_to_strays | kin, belonging | +4 |

## The bond of the Four

The four mains (Cassia, Brennic, Garran, Iskar) share one bond state. Pair trust = the lower of the two directions.

| From | To | Condition (`rules.json` `arcs`) |
|---|---|---|
| `scattered_four` | `first_watch` | day ≥ 2 and at least 3 of the 6 pairs have trust ≥ 20 |
| `first_watch` / `plotting` | `plotting` | any main resolves PLOT (+1 bond progress) |
| `plotting` | `sworn` | every pair ≥ 40 and bond progress ≥ 3 |
| any except `scattered_four` | `fractured` | any pair below −20, or one main REPORTs another |

PLOT is legal only for mains and only in first_watch, plotting or sworn. The Fourth Watch meets at the Edge at 20:00. `sworn` is the precondition the endings design relies on. What a fractured bond leads to is not specified beyond blocking PLOT.

`arcs.peerTrust` (20) and `arcs.swornTrust` (50) are present in the data but not referenced by the camp code read for this export.

## Parley

Parley is the player's typed role-play. It opens only at a **Knowing moment**. The player-facing dialog is in [../gameplay/](../gameplay/); the rules are here. Source: `data/parley.json`, `packages/core/src/parley.ts`, wave W6.

### When Parley is available

- The player holds a **Knowing**: a true fact explicitly typed `knowing` and linked to its subject. Matching a name in prose is not enough.
- The living subject is present at the same open place and phase.
- At most **1 Parley per day** (`perDay`). It costs **2 hours**, even if refused.
- Not available in the stocks, during the listening act, after the night is finished, or after the season ends.

### Inputs and limits

| Field | Value |
|---|---|
| Player text | optional, ≤ 280 characters (`maxTextChars`) |
| Reply | ≤ 200 characters (`maxReplyChars`) |
| Cited Knowings | ≤ 3 (`maxCitations`) |
| Model timeout | 10,000 ms (`timeoutMs`) |
| Stances | intimidate, appeal, bargain, reveal, deceive |
| Effects (closed list) | shift_trust_small (8), shift_trust_large (20), flip_next_intent, reveal_fact, refuse |

### Resolution

1. The player picks one of three authored approaches (cards), and can also type text. A card is always selected, so a typed attempt that fails or times out falls back to the card.
2. With text and a model provider, the Director proposes a stance, cited Knowings, one effect and a reply. The model sees qualitative context and Knowing texts, never trust amounts, DCs or dice. Player text is a JSON data field, never part of the instructions.
3. Code checks the proposal. An invalid proposal refuses the attempt. Unsafe reply text is repaired separately; legal effects do not depend on phrasing.
4. Large effects (large trust, flipping an intent, disclosing a fact) need a cited, held Knowing about this subject and a contest: `stat × 4 + d20 > 15` (`contestDc`). Intimidate uses nerve; the other stances use guile. Hostile or deceptive stances that fail shift trust negatively.
5. `reveal_fact` gives the player an unknown true fact the speaker really knows (chosen deterministically by salience).
6. `flip_next_intent` replaces the speaker's next night act with a friendly act toward the player (BEFRIEND, PROTECT or CONFIDE, chosen by the planner) and is rechecked at dawn.
7. Trust is clamped. Parley never grants death, gold, mastery or invented facts.

### Authored cards

| Card | Stance | Effect | Text template |
|---|---|---|---|
| reveal | reveal | flip_next_intent | "I know this: {knowing} Stand with me when the camp falls quiet." |
| bargain | bargain | shift_trust_large | "I can keep this close: {knowing} Let us find some common ground." |
| ask | appeal | reveal_fact | "I have heard this: {knowing} What else should I understand?" |

Seeded content: the Knowing `K-nysa-bread` can be earned by listening. Asking Nysa about it can reveal `K-quill-lantern`, which opens a later Knowing moment with Quill.

### Measured limits (W6)

- 100 hostile boundary cases (20 families × 5 contexts): zero state-boundary violations (**simulated** code-boundary test).
- 100 hostile local-model probes plus 3 positive controls (**measured**): 70 refusals, 4 small trust gains (semantic false positives that stayed within the contract), 26 timeouts that fell back to cards. All three controls produced their intended effects. Median 1.52 s, p95 10.03 s.
- Known limit: ordinary rapport (small trust) needs no cited Knowing inside an eligible moment, so code cannot tell whether arbitrary prose deserved it. The daily limit and the code-owned magnitude bound it.
