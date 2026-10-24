# Change-request inbox (VR to PC)

The VR channel (`mage-arena-vr`) and this PC repo run the same arena rules in two kernels: C++ in VR, TypeScript here.
When VR changes a shared rule it writes a change request (CR) in its own repo. This folder is the PC side of that
exchange: one file per VR CR, recording what PC decided and what it did.

## The flow

1. **Filed (VR).** VR writes `mage-arena-vr/docs/change-requests/CR-NNN-<slug>.md`. That text is the source; it is
   never copied here, only linked by path and by the VR commit it was read at.
2. **Received (PC).** PC adds `CR-NNN.md` here with the link, the VR commit read, and status `received`.
3. **Decided (owner).** The owner accepts or declines it for PC. Accepted can be partial (for example "the rule, not
   the numbers"). The decision, its date and its scope go in the entry.
4. **Ported (PC).** The lane that ports it names the PC commits and the tests that prove the hand checks. Status
   becomes `ported`.
5. **Re-pinned (VR).** VR moves `apps/vr/data/PINNED.json` to a PC commit that carries the port (or that it has read
   and accepted). Status becomes `re-pinned`, with the new pin commit. `npm run vr:drift` shows what PC changed since
   the current pin.
6. **Addenda (PC to VR).** Where PC plays a number differently from VR's canonical value, PC answers with an addendum:
   `npm run vr:tuning-return -- --evidence <census json> --out <file>` writes the overlay deviations
   (`packages/core/src/arena/data/school-balance.pc.json`) next to VR's canonical values, with census evidence. The
   addendum is appended to the CR entry it answers (or filed as a new PC-to-VR CR when it answers none).

Statuses: `received`, `accepted` (with scope), `declined`, `ported`, `re-pinned`. A declined CR stays in the ledger.

## Ledger

| CR | VR title | VR text | Status | Owner decision (2026-10-23) | PC owner |
| --- | --- | --- | --- | --- | --- |
| [CR-001](CR-001.md) | Blink input and rune pads | `CR-001-blink-and-pads.md` | declined | Declined for PC: blink pads are VR-only | - |
| [CR-002](CR-002.md) | Fire school and Heat | `CR-002-fire-school.md` | ported | Accepted; porting in W8 | W8 lane F |
| [CR-003](CR-003.md) | Threat geometry: enemies stay off the dais | `CR-003-threat-geometry.md` | ported | Accepted for the shared `Attack.RangeM` edit only; the rest is VR-only | W8 lane R |
| [CR-004](CR-004.md) | Cinder hounds spit embers | `CR-004-hound-ember-spit.md` | declined | Declined for PC | - |
| [CR-005](CR-005.md) | Named rivals: HP-gated phases, collar surge, granted signature | `CR-005-rival-phases.md` | ported | Accepted: the rule, not VR's numbers | W8 lane R |
| [CR-007](CR-007.md) | Air school and Momentum (AIR.md, VR T23) | not filed by VR; PC writes it | ported | Accepted 2026-10-23; text drafted by W8 lane A | W8 lane A |
| [CR-008](CR-008.md) | Exchange windows for close duels (PC to VR) | PC proposal; VR has no text | proposed | Director default 2026-10-24 (D1 Q4): stays a PC overlay deviation, returned to VR as a proposal; owner to confirm | D1 slice |

VR texts live under `mage-arena-vr/docs/change-requests/` (default checkout `C:/Users/kazda/kiro/mage-arena-vr`).
CR-006 is not a VR CR known to PC at the time of writing.
