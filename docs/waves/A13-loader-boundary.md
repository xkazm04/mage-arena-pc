# GAME sigil adapter contract (U5)

The optional `a13.manifest` entry in `assets/accepted/covenant/manifest.json`
uses the existing hash-checked `EffectManifest` schema (`schemaVersion: 1`,
pages, clips, rectangular frames with durationMs, anchors and designSize1080).
Page keys are `a13.page.<page id>`. The shared loader accepts `a13/` files.
No A13 files are required or fetched when the manifest entry is absent.

Current optional clip names: `casting.water`, `casting.fire`, `casting.earth`,
`casting.air`, `telegraph.area`, `telegraph.line`, `telegraph.cone`, `absorb.hold`.
Cast keys follow the caster's school; ground cues receive world size and angle.
Barrier art uses the authoritative forward arc mask. Missing pages/clips retain
the current A8 barrier and code geometry. Thin exact damage boundaries are kept
above decorative glyphs; an ornamental flourish never expands a hitbox.

The arena owns geometry/timing; `EffectPlayer("a13")` owns skin, decode,
animation, bounded sprite reuse and source leases. An eventual delivery with a
different manifest format needs an adapter at this boundary, not kernel edits.
Perfect window/ward payoff hooks can add clip names here without changing the
combat contract. The art stream is not edited or made dependent on this proposal.
