# Active scale contract v2

[scale-contract-v2.json](scale-contract-v2.json) is authoritative under D17.
Fixed distant 55-degree oblique view; nominal head-to-sole height 3.75% of viewport
height. Range 3?4.5% = 32.4?48.6 px at 1080p and 43.2?64.8 px at 1440p.
Staff, shadow and aura do not count as body height. Ground projection and upright
billboard height are distinct. World art scale is 22.5 px/metre at 1080p on x;
y is foreshortened by sin(55 degrees). Metres per pixel is the reciprocal.

The camera is stationary inside a wide dead zone; only its soft edge follow moves.
The dead zone and damping in data are authored proposals for engine testing.
No runtime zoom is proposed. Arena world extent remains 192 by 144 metres; a
single plate depicts one viewport, not the entire physical arena or a tileable map.

Keep projectile cores at least 4 px and threat outlines at least 3 px at 1080p.
Advisory readability outlines never enlarge the game's true hitbox. The absorb
has a 140-degree forward sector and an open 220-degree rear. Render geometry in
code; a painted source cannot certify exact gameplay angles.

Owner-selected camera direction is established by D17. Generated elevation,
engine following, combat motion readability and owner feel remain unmeasured.

---
Historical v1 follows; its near camera is superseded.

# Arena scale contract v1

Data authority: [scale-contract-v1.json](scale-contract-v1.json). Authored proposal;
owner camera confirmation is pending. The owner requested 4-6% of screen height.
Measure head to sole, excluding weapon, spell and shadow. At 1080p this is
43.2-64.8 px. Camera elevation is above the ground, not from vertical.

| Distance | Zoom | Height at 1080p / 1440p | Ground m/px X / Y at 1080p | Visible ground m at 16:9 | Minimum danger diameter X / Y px at 1080p |
|---|---|---|---|---|---|
| Standard | 1.0 | 54.0 / 72.0 | 0.03333 / 0.04069 | 64.0 x 43.9 | 120.0 / 98.3 |
| Near | 1.2 | 64.8 / 86.4 | 0.02778 / 0.03391 | 53.3 x 36.6 | 144.0 / 118.0 |
| Far | 0.8 | 43.2 / 57.6 | 0.04167 / 0.05087 | 80.0 x 54.9 | 96.0 / 78.6 |

Ground Y is foreshortened by sin(55 degrees). Drawn upright silhouettes use the
separate screen-height fraction: do not project their 1.8 m height as ground depth.
At 1440p, scale pixel sizes by 4/3 and retain the same visible world area.

Arena extent: 192 x 144 m. Even at far zoom it spans 2.4 screens horizontally and
2.6 vertically. Minimum proof combatant spacing: 6 m. Danger circles have a 4 m
minimum ground diameter, 3 px outline at 1080p, and shape cues as well as colour.
Projectile core: at least 4 px at 1080p. These are authored visual targets.

Absorb: 140-degree forward sector and 220-degree open rear. Proposed visual radius:
2.4 m. This is comparison geometry, not a change to combat balance. Exact angle
must be drawn by game code; generated pictures cannot prove angle or world metres.

W4b should consume the JSON, test all three zooms at 1080p and 1440p, and measure
moving silhouettes, projectile separation, danger visibility and occlusion.
Static concepts do not establish motion readability or performance. No production
figures, poses or spell effects (A3) until owner-supplied `art/CAMERA-OK.md` exists.
