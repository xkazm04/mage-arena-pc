# U6c — rewiring the latest clips

2026-10-04. GAME / integration. [Design and sub-waves](U6c-design.md),
[native evidence](U6c-evidence/index.html), [owner guide](../START-HERE.md#u6c-creature-reactions-in-the-combat-feel-lab).

## Imported delivery

Read-only A14.3 source: art `82f5bc403d59c7f33daffaec1fa17accbc45302c`.
Copied 122 delivery files with hashes, original manifests, loader note, source
gates, stage outputs and standalone corpses. No `art/raw` reads, generation,
art/audio worktree edits or pushes. Audio remains `8e8ab42`. Both sibling
worktrees were clean at the final audit. Technical delivery passes are preserved;
owner art acceptance remains false.

The existing `a10.packed.manifest` key now merges all **226 A14 clips** over A10:
180/192 priority slots and 46 additional clips. Unreplaced A10 clips remain in
the manifest. Each delivered clip carries its own v3 size and anchor. The schema
merge required no loader changes. [Import hashes and packing witnesses](U6c-evidence/import.json)
record 45 losslessly packed pages, **68.839 MiB decoded RGBA**, with no resampling
or discarded nonzero alpha. Original delivery atlases remain available for audit.

## Reactions, defeat and Lab

All twelve roster entities now select real A14 light/heavy hits, collapse and
persistent lying sprites. Delivered exact directions take precedence. Missing
rear Maw/Thornback collapse requests select the matching left/right front
collapse **and its own corpse**; inherited A10 rear deaths remain in the data
but no longer prevent that paired handoff. Thornback rear hits also select its
front hits. F8 logs each requested missing state/direction once per arena scene.

H1 still owns damage, stagger, defeat and cleanup. Light/heavy uses the existing
18 actual damage threshold; complete hit clips fit the visual recoil/stagger
window. Collapse lasts the delivered 600 ms on presentation time, even when the
Lab simulation holds. Its final pixels, anchor and mirror match the persistent
corpse. Corpses stay at their world ground position, sort by ground depth, have
no targeting ring/health bar/AI/collision, and clear on explicit revival/reset.
The runtime uses atlas `mirrorX` once; the copied standalone corpse PNGs, already
mirrored upstream, are not drawn or mirrored again. Full A14 frames draw at
145.8 px / 194.4 px at 1080p / 1440p, without repeating D32's size increase.

The canvas Lab Target selector now cycles Dummy, Mage AI, Cinder Hound, Mire Maw,
Thornback and Hush Moth. Creature targets are **explicitly stationary**, with
roster health, selectable SE/SW/NW/NE facing and roster poise multiplied by the
Lab opponent-poise control. School/competence/aggression/dummy action do not
control these targets. This game-layer adapter leaves every core source and
season save-version input unchanged. Active creature AI remains in ordinary
roster practice. The guide documents the exact setups and controls.

## The 46 additional clips

[Per-clip audit](U6c-evidence/extra-audit.json): every extra replaces a genuinely
absent A10 slot. The 23 source views each include their left-facing mirror.

| Kind | Clips | Playback |
|---|---:|---|
| Idle | 10 | Delivered 720 ms loops |
| Run | 8 | Delivered 430 ms loops |
| Attack (`cast`) | 10 | Delivered 540 ms, nonlooping; full sequence fits the existing windup |
| Brace/resistance (`absorb`) | 18 | Delivered 480/540/600 ms loops |

Cinder Hound gains idle/run/attack in all directions; Maw gains front motion;
Moth gains front idle/run and all-direction attack; Thornback gains front idle.
Creature telegraph attacks now use the same full-sequence windup fitting as
mage casts, and release holds the last key. Moth's existing contact mana drain
does not emit a cast event, so a read-only contact check presents its attack
sequence in active creature combat; it adds no damage, drain or ability and
does not animate an attack for the stationary Lab target.

All 18 resistance clips are available through the existing absorb state,
including Garran's rear ward. Enemy resistance art is exercised in the preview;
it does **not** grant a ward to enemies whose mechanics have none. This is a
presentation delivery, not a new defensive mechanic. Partial salvage/reused-key
metadata and owner review limitations remain intact.

## Still missing, with exact fallback policy

| Entity | Missing state | Requested directions | Same-entity selection |
|---|---|---|---|
| Mire Maw | death, corpse | NE, NW | SE, SW paired collapse/corpse |
| Thornback | hit-light, hit-heavy, death, corpse | NE, NW | SE, SW hits or paired collapse/corpse |
| Iskar | run | SE, SW | NE, NW run |
| Shieldman | cast | NE, NW | SE, SW cast |
| Slinger | absorb | NE, NW | SE, SW absorb |
| Netter | absorb | NE, NW | SE, SW absorb |
| Thornback | run, cast | SE, SW | NE, NW matching state |

That is **12 priority + 12 other slots**, without overlap. Maw rear hits and
Garran rear collapse/corpse are delivered and no longer missing. No roster entity
needs a procedural hit/death/lying substitute with the healthy shipped assets.
The separate training dummy retains its own procedural practice marker. Loader
failure safeguards still preserve identity rather than borrow another creature.

Art still needed is exactly the table above. Upstream owner review also remains
open for identity and animation quality: Maw's front face, Moth antennae/eyes,
subtle resistance motion and Hound gait are specifically called out in the
handoff. GAME's tests do not approve those artistic qualities.

## Verification

The gallery contains **326 native screenshots**, including **192 collapse/corpse
captures** (12 entities × 4 directions × 2 states × 2 resolutions). Every copied
delivery file and every collapse/corpse PNG is hash-checked in
[the final audit](U6c-evidence/verification.json).

- `npm run gate`: **215 TypeScript tests + 11 reference checks**, zero design
  contradictions ([output](U6c-evidence/gate.txt)). `npm run build:game`: pass;
  existing bundle-size advisory.
- `npx tsx packages/tools/src/u6c-browser.ts`: every roster entity in NE/SE/SW/NW,
  actual light/heavy hit selection, collapse and held corpse at both native sizes.
  Checks scale, anchor, mirror sign, zero corpse rotation/displacement and ground
  depth sorting; H1 recoil, G/R, reduced motion and ordinary defeat results remain
  covered. The owner-facing selector is also exercised with real mouse casting
  until each creature falls, then G/R. Each fixture corpse survives further core
  ticks and is explicitly removed on reset. [Detailed observations](U6c-evidence/browser.json).
- `$env:U6C_COLLAPSE_ONLY="1"; npx tsx packages/tools/src/u6c-browser.ts`: captures
  the fall after the 390 ms contact effect clears, before the 600 ms collapse
  finishes; also verifies the actual active Moth brain drains mana while the
  delivered attack sprite plays. [Collapse/contact observations](U6c-evidence/collapse.json).
- `npx tsx packages/tools/src/u6c-performance.ts`: all 46 extra clips animate at
  both sizes, frame selection agrees with authored durations, casts clamp, and
  all 12 legacy gaps log once. It then measures the stress scene and asserts
  character atlases release on leaving the arena. The fixture now includes all
  **12 distinct identities**, including Hound; the older stress fixture duplicated
  Cassia. [Playback/performance record](U6c-evidence/performance/browser.json).
- `$env:MAGE_EVIDENCE="U6c"; npx tsx packages/tools/src/u3-replay.ts`: unchanged
  same-seed, save/load and replay bytes: **1,300,369**, SHA-256
  `2451fa7085c6a8534036a26e347b48d6281d42f22dcf51616570ea82b7452bc2`.
- `npm --prefix packages/core run report:w4 -- --evidence U6c-evidence --tag census`:
  **8,000 fights**, all gates pass. Every raw fight record and wave summary equals
  H1, including replay hashes, with zero timeouts, invalid states or replay failures.
  [Comparison](U6c-evidence/census-comparison.json), [census](U6c-evidence/census.json).
  Median seconds remain **36.03 / 45.93 / 57.10 / 62.00**. No tuning, bands,
  combat data or core/director implementation changed.
- `npx tsx packages/tools/src/u6c-verify.ts`: rechecks copied-file hashes against
  the unchanged art worktree, native collapse/corpse PNG dimensions and hashes,
  all raw census rows, save hash and untouched core/data sources. `npx tsx
  packages/tools/src/u6c-gallery.ts` rebuilds the local searchable gallery.

## Frame time and memory

Windows headless Chromium, D3D11, native viewport, 100 continuously visible
projectiles plus all 12 animated roster figures after the full extra-clip walk:

| Native size | Mean FPS | Frame p95 | Renderer CPU p95 | Decoded resident textures |
|---|---:|---:|---:|---:|
| 1920×1080 | 60.002 | 16.80 ms | 2.60 ms | 325.716 MiB |
| 2560×1440 | 60.003 | 16.80 ms | 2.20 ms | 325.716 MiB |

The estimate includes resident art, UI, font and derived textures; it is not total
driver/process memory. Audio is unchanged and separate. At **4.284 MiB below the
330 MiB threshold**, no new atlas eviction is introduced. Existing arena-disposal
release is checked. The remaining margin is small: additional art should trigger
a fresh full-roster residency check and consideration of per-entity/page eviction.

Owner tactile feel, animation/identity acceptance and television viewing-distance
judgment remain unmeasured. No remaining upstream art is labelled complete.
