# A9 arena restoration candidate

Load `arena.json`, `layout.json` and `decals.json`. Paths are repository-root
relative. All three palettes share placement and physical dimensions. This is
owner-review art; no game integration or owner acceptance is claimed.

Map world coordinates to the screen as:
`x = width/2 + (worldX-cameraX)*p`,
`y = height/2 + (worldY-cameraY)*p*sin(55deg)`, where `p=22.5*height/1080`
at the nominal far zoom. Body witnesses are 3.75% of screen height.
Use the game's camera follow and zoom; proof centre is [16,14], entry [12,10].
Preserve the core ellipse [16,62], size [192,144], and existing collisions.

Ground is an unprojected native 1280x720 tile at 32 source pixels/metre:
40x22.5 metres per repeat. Repeat from [-80,-10], project Y once, and clip to
the core ellipse. Density is 1.422 source pixels/screen pixel at 1080p and
1.067 at 1440p horizontally; projection increases Y density. Opposite 64px
edge bands were conditioned locally; there is no invented higher resolution.

Draw decals on the ground, then contact shadows. Sort upright objects, actors
and rim strips by base world Y, using each sprite's anchor and base line.
Scale upright sprites uniformly from `designSize1080`; never squash their Y
by the ground projection or rotate them to face a boundary tangent.

For the continuous rim, use each segment's two ellipse angles, 4px vertical
source strips within `rimTextureSpanPx`, and the recorded top/base profiles.
Map strip centres onto the ellipse; stretch the strip vertically to the
declared 2.2 metre wall height. This is authored texture deformation from a
generated wall, not a set of generated directional architecture views. The
central 76% excludes painted end caps. `restoration_arena.py:render` is the
executable reference placement implementation used for all six native proofs.

Thirty-six cutouts include rim variants, stands, arches, gates, wardstones,
banners, braziers, rubble, supplies, altars and columns. The five wardstones
are decorative presentation nodes. Generated brazier fire and pylon light are
static. Dynamic magic belongs to A8; new body animation belongs to A10.

Damage uses three reviewed generated texture windows, keyed/feathered locally
and explicitly palette graded. Rune seal and glyph geometry is authored and
weathered with generated ground luminance. Generated letter-like marks and
the unrequested figure are excluded. A clipped rust banner was replaced by a
separate generation; its rejected cell stays in the source history.

The native proofs and A6 comparisons are in `proofs/`. Rich surface detail is
restored, but identical concept fidelity is **not established**: modular stands
remain repetitive, the rim uses derived geometry, and the concept's integrated
atmospheric lighting is richer than this separated-asset proof. Owner review
and game camera/motion validation remain required. No numeric gate accepts art.
