# Reverse vectors (VR records, PC replays)

VR's 45 conformance vectors run one way: the pinned TypeScript kernel records, the C++ kernel replays. A reverse
vector runs the other way: VR's C++ kernel records a short Games bout, and PC replays it with `npm run vr:vectors`.
It exists for rules VR changed first (CRs), so PC can prove a port against the C++ run instead of against prose.

A reverse vector checks **outcomes only**. State hashes are excluded: the C++ FNV hash and the TypeScript
`stateHash` hash different serialisations, so they can never agree.

## File

One JSON object per file, extension `.vector.json`. Format id `mage-arena-vector-1`.

```json
{
  "format": "mage-arena-vector-1",
  "name": "water-hand",
  "note": "free text: what the bout shows",
  "recordedBy": "free text: channel, commit, tool (for example \"vr 41050f3 VectorRecorder\")",
  "setup": {
    "seed": 7,
    "wave": 0,
    "schoolRivals": null,
    "difficulty": null,
    "balance": "canonical",
    "preset": "Rotation",
    "referencePlayer": false,
    "autoAdvance": false
  },
  "ticks": 180,
  "inputs": [
    { "from": 1, "to": 30, "input": { "move": { "x": 1, "y": 0 }, "aim": { "x": 20, "y": 10 }, "slot": 0,
      "cast": false, "absorb": false, "roll": false, "sprint": false } }
  ],
  "checkpoints": [
    { "tick": 60, "phase": "active", "wave": 0,
      "actors": [ { "id": 1, "team": 0, "hp": 100, "mana": 40, "stamina": 100, "x": 6.5, "y": 10, "school": null, "down": false } ],
      "events": { "cast": 1, "hit": 0 } }
  ]
}
```

### `setup`

| Field | Type | Meaning |
| --- | --- | --- |
| `seed` | uint32 | Arena seed (`createGames(seed, ...)` / `TryCreateGames`). |
| `wave` | int | Tiro start wave, 0-based (0 soldiers, 1 creatures, 2 and 3 mage duels). |
| `schoolRivals` | `null` \| `"fire"` \| `"air"` \| `"named"` | The Games school-rivals mode. `null` is the Water proxies. |
| `difficulty` | `null` \| `"easy"` \| `"normal"` \| `"hard"` | PC pace (feel.json `pace`: the player at 1.5x, opponents by difficulty). `null` is unpaced, every actor at 1x, which is how VR runs: **VR records `null`**. PC applies `null` by lifting the pace right after the Games is created, before tick 1. |
| `balance` | `"canonical"` \| `"pc"` | `canonical` plays VR's numbers (PC sets `ArenaState.balance = 'canonical'` right after the Games is created, before tick 1; it ignores `school-balance.pc.json`). VR always records `canonical`. |
| `preset` | string | The player's Water composition by preset name (`presets` / `KernelData().Presets`). |
| `referencePlayer` | bool | The player runs the reference mage AI (`runtime.games.referenceCompetence`). Recorded inputs then overlay it. |
| `autoAdvance` | bool, optional | When a step ends in `intermission`, advance to the next wave at once (as the conformance `tiro-sequence` vector does). Default `false`. |

### `ticks` and `inputs`

The replay steps ticks `1..ticks`, one `stepGames` per tick. `inputs` is the **player's** input, run-length encoded:
each run applies `input` on every tick from `from` to `to`, both inclusive. Runs are sorted, do not overlap, and lie in
`1..ticks`. A tick no run covers passes **no** player input (the kernel's own default; with `referencePlayer` the AI
plays). Opponent inputs are never recorded: the kernel derives them (enemy and mage AI), so a mismatch in an opponent's
outcome is a rule difference, which is what the vector is for.

An `input` has every field of the shared input frame: `move` and `aim` (`{x, y}` metres; `aim` is a world point),
`slot` (int), `cast`, `absorb`, `roll`, `sprint` (bools).

### `checkpoints`

Sorted by `tick`, each in `1..ticks`, read **after** that tick's step (and after an auto-advance). Fields:

| Field | Compared as |
| --- | --- |
| `tick` | The checkpoint's tick; the kernel's own tick must equal it. |
| `phase` | Games phase: `active`, `intermission`, `lost`, `complete`. Exact. |
| `wave` | Games wave, 0-based. Exact. |
| `actors` | Every actor in the arena state, in state order; the count must match. Per actor: `id`, `team` (exact int); `hp`, `mana`, `stamina` (tolerance below); `x`, `y` (position rounded to 1e-6 when recorded, compared within 1e-6 absolute); `school` (the school resource, Heat or Momentum, `null` for an actor with no school state; tolerance); `down` (defeated, exact bool). |
| `events` | A map from event kind to how many events of that kind the current arena state holds at that tick (a Games wave advance keeps the state, so counts run from tick 0). Only the kinds the vector lists are compared; a listed kind with count `0` asserts that none happened. List only kinds both channels emit. |

Numbers other than positions use the conformance rule (`apps/vr/tools/conformance/oracle.mjs` `TOLERANCE`, C++
`FCheck::Close`): equal, or within 1e-9 absolute, or within 1e-6 relative. Integers on both sides compare exactly.

## Replay

`npm run vr:vectors [-- <file or dir> ...] [--json]` replays each vector against the PC kernel
(`packages/core/src/arena`, loaded through Node's type stripping; run `npm run build` once so
`data.generated.ts` exists). With no paths it replays `packages/tools/vr/vectors/`. It prints `pass` or the **first**
mismatch per vector (tick, field path, vector value, PC value) and exits 1 when any vector fails.

`node packages/tools/vr/vectors.mjs --record <skeleton.json> --out <file>` fills the checkpoint values of a skeleton
(setup, ticks, inputs, checkpoints with only `tick` and the event kinds to count) from the PC kernel. It is the PC
reference for what a recorder writes, and it is how `vectors/water-hand.vector.json` was made.
