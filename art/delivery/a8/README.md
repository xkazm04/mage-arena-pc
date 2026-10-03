# Covenant effects / A8

Entry point: `effects.json`. Paths are repository-root relative. Read
`schemaVersion: 1`, load each page once and verify its SHA-256. Frame rectangles
are integer `[x,y,w,h]`, unrotated, untrimmed, with a two-pixel transparent gutter.
RGBA is straight alpha in sRGB. Convert to premultiplied alpha exactly once when
uploading to a renderer that needs it. Canvas `drawImage` already handles alpha.

Each clip supplies `frameCount`, durations, `anchor`, `loop`, blend hint and
`designSize1080`. Multiply design dimensions by viewport height / 1080. Anchors
are normalized within the frame, independent of the visible pixels. Do not fit
individual dissolving frames to their alpha bounds; that makes residue grow.
`projectile` aliases the same painted frames as `travel`, rather than a second
generation. The game moves its anchor; the art supplies internal motion.

Use `lighter` for emitted light, with a restrained per-effect opacity. Exact
telegraphs use normal `source-over`. Source black was converted to alpha by
setting A to maximum RGB and unpremultiplying RGB; RGB×A reconstructs emitted
source light. Earth impact first subtracts the measured charcoal matte
`[25,25,25]` and rescales the remaining light; the generated panel background
does not survive. This is authored extraction, not generated transparency.
Earth is an emissive stone/dust effect, not opaque physical debris. Do not use
these luminous frames for opaque rubble.

Cast, impact, hit, contact and perfect clips are one-shots; hide them after the
last frame. Travel runs while a projectile exists. Auras use explicitly authored
ping-pong playback of six generated keys to avoid a bright/dim last-first jump.
That playback has ten frame references, not ten generated drawings. Air travel
has four usable keys; two clipped cells are excluded. Absorb contact similarly
uses four clean compression keys, excluding two crossed-grid approach cells.
Water travel keys 4 and 6 are explicitly mirrored to face right. Frame times
are visual proposals; bind them to game events, not independent gameplay clocks.

Absorb has separate hold, incoming-energy compression and perfect-flare clips.
It is a decorative membrane with an open rear. The exact game arc is 140 degrees;
game-owned geometry clips or remaps the painted membrane when necessary. The
image does not determine collisions or change projectile speed. Drive the
compression animation from a real contact event; it must not imply an extra hit.
For arbitrary aim angles, transform in unprojected ground coordinates then apply
the 55-degree projection. Do not rotate an already projected ellipse as if it
were a circular disc. Ground telegraphs similarly follow the engine's exact
shape and radius; the supplied ring/cone are visual proposals.

Draw ground marks first, aura behind the body, then cast/projectile/contact and
the front membrane. Split an aura into front/rear masks if body occlusion needs
it. Keep the bright perfect flare localized at the actual contact point.

Source frames and findings are on the [owner board](../../review/a8/index.html).
Serve the repository and open [motion.html](../../review/a8/motion.html) to see
actual atlas playback. The preview reuses existing A3c bodies as scale witnesses;
they are not new character animation. A7 backgrounds are comparison surfaces;
A9 owns their restoration. The preview is not gameplay or a performance result.

No claim of owner approval, exact generated camera geometry, pixel-perfect
cyclic motion or complete tier/branch-specific spell choreography. The delivered
element families are components for that choreography. Six generated keys per
event are a low-frame-count animation and require owner motion review.
