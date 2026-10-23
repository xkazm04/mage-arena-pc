# D4. Visual target prompts (Leonardo): the best-case look for D1-D3

Status: **prompt pack**, written 2026-10-23. Not generated yet. The owner generates these images in Leonardo. They
are deliberately imprecise "ceiling" pictures: they show how good the game could look, so the engine spike (D2
section 5) can ask whether PixiJS can chase that look or the PC channel should move to a native engine.

> Owner: "lets try to create image generation prompt for Leonardo with expected ceiling/to-be state for each of the three in best case. Even if very imprecise with careful prompting it can bring me imagination whether PixiJS can be beautiful and chase, or whether to jump into native engine"

## How to use

- **Settings:**
  - **Aspect:** 16:9 (e.g. 1536 x 864 or the closest preset).
  - **Model:** a model with strong prompt adherence (Phoenix-class or newer).
  - **Style preset:** None or Cinematic.
  - **Batch:** 4 images per prompt.
- **Two variants per target:** every target has a **2.5D painted** prompt (what Pixi plausibly reaches with painted
  billboards, normal maps and shaders) and a **stylised 3D** prompt (what a native engine buys). Pick the image that
  makes you want to play, then note which variant it came from.
- **Shared look:** the world vocabulary below is shared, so the images agree with each other. It comes from
  `art/STYLE.md` (Covenant family), translated into image-prompt language. No existing game, studio or artist is
  named, so the look stays original.
- **Keeping results:** save the picks into `art/targets/` (create it) with the prompt id in the file name, and record the
  choice in the D2 and D3 spark.

**Shared world vocabulary** (append to every prompt if the model drifts):
`Tiro, a walled gladiatorial academy where young mages duel in a sunken stone arena; dark enamel and aged silver, restrained verdigris, pale layered cloth, worn metal, warm torchlight against cool magic; each element has its own shape language: fire as forked flames and embers, water as crescents and droplets, air as branching wind and lightning, earth as angular stone and dust`

**Shared negative prompt:**
`text, watermark, logo, signature, UI mockup clutter, lens dirt, noisy film grain, paper texture, canvas texture, stippling, oversaturated neon, full-body glow, chibi, cartoon mascot, photorealistic modern clothing, guns, sci-fi armour, blurry faces, extra limbs, deformed hands`
(For the HUD and menu targets, drop `text` and `UI mockup clutter` from the negative.)

## T1. D1: a close duel as a readable exchange

**T1-A, 2.5D painted**
```
Close three-quarter view, camera about 40 degrees above the ground, of two young mages dueling at arm's length in a sunken circular stone arena. Left: a water mage in pale layered robes raising a curved shield of water crescents that catches a burst of flame. Right: a fire mage in dark ember-trimmed coat lunging forward, a cone of forked flame leaving his open hand, embers streaming. A glowing floor sigil ring under the fire mage telegraphs the next strike in thin silver runes. Clear readable silhouettes, strong rim light, painted illustrative style with sculpted volumes and confident broken contours, hand-painted game art, rich but controlled colour, torchlit arena walls softly out of focus, sand and scorch marks on the floor, dramatic moment of impact, high detail, 16:9
```

**T1-B, stylised 3D**
```
Stylised 3D game screenshot, close three-quarter camera at 40 degrees, two young mages in a sunken circular stone arena trading blows at arm's length: a water mage blocks with a translucent curved water shield that splashes and refracts the light, a fire mage lunges with a cone of volumetric flame and flying embers. Toon-shaded characters with painterly textures, real-time global illumination, the flame lights the water mage's robes orange while cool blue caustics play on the floor, a thin glowing rune ring on the ground telegraphs the next attack, soft depth of field on the crowd balconies, crisp silhouettes, premium indie action game look, 16:9
```

## T2. D2: the combat look at full ambition

**T2-A, 2.5D painted**
```
Wide gameplay view of a magical arena duel at dusk, camera at 45 degrees from a moderate distance, four combatants visible: a water mage in pale cloth, an air mage in grey-blue wrapped garments mid-dash leaving streaks of wind, a fire mage calling down a meteor whose large glowing circular shadow grows on the sand, and an armoured arena soldier with a shield. A crackling beam of lightning crosses the arena, casting light on the stone floor. Readable spell shapes: a filled warning circle, a straight beam, a curving projectile arc. Hand-painted 2.5D game art, painted characters with normal-mapped lighting, dynamic light from spells on bodies and floor, verdigris bronze statues around the arena rim, crowd silhouettes in torchlit balconies, atmospheric dust, deep shadows, cohesive palette of dark enamel, aged silver and warm torchlight, 16:9
```

**T2-B, stylised 3D**
```
Stylised 3D action game screenshot, elevated camera at 45 degrees over a sunken stone arena at dusk, four combatants: water mage, air mage dashing with wind trails, fire mage summoning a meteor with a large glowing impact circle on the sand, armoured arena soldier with shield. A lightning beam crosses the arena with bloom and real-time light on the stone. Painterly toon shading, volumetric fog, particle embers and droplets, screen-space reflections on wet stone near the water mage, crowd in torchlit balconies, verdigris bronze statues, cinematic colour grading with warm torches against cool magic, clean readable silhouettes, 16:9
```

## T3. D3: the in-fight HUD, school-aware

**T3-A, 2.5D painted**
```
Game screenshot of a fire mage duel with an elegant fantasy HUD overlay. Bottom centre: five spell slots framed in aged silver and dark enamel, each with a painted rune icon of fire spells, small rank pips under each slot, one slot glowing gold as an ultimate form. Above the slots: a curved Heat meter made of glowing runes filling from ember red to white-hot, with two engraved threshold marks. Top left: vitality, mana and stamina bars as slim engraved silver bars with pale serif labels. Top right: the rival's name banner with three phase gems, one cracked. Restrained, legible, diegetic-feeling interface, thin ornamental lines, verdigris accents, painted arena battle in the background, 16:9
```

**T3-B, stylised 3D**
```
Stylised 3D game screenshot with a premium fantasy HUD: a fire mage fights an air mage in a stone arena. Bottom centre: five spell slots in brushed silver frames with glowing rune icons, rank pips, one slot pulsing gold for an ultimate. A curved rune Heat meter above the slots glows from red to white with two threshold notches. Top left: slim engraved vitality, mana and stamina bars. Top right: rival banner with phase gems. Clean modern layout with ornamental restraint, soft glow, sharp serif typography, 16:9
```

## T4. D3: the campaign (camp map and calendar)

**T4-A, 2.5D painted**
```
Illustrated campaign map screen of a mage academy camp at dusk, seen from above at an angle: a walled compound with a training yard, a water cistern, a fighting pit, a market exchange, communal tents, a gate and a cliff edge, each place marked by a small glowing silver sigil and a hand-painted label plaque. Lanterns lit, smoke rising, tiny figures of students at the yard. On the right, a parchment-free dark enamel panel shows a six-week calendar with Games days marked by water droplets and trial eves by stone glyphs, and a small portrait of a young water mage with a thoughtful expression. Painterly illustration, warm lantern light against blue dusk, sculpted volumes, pale serif type, cohesive dark enamel and aged silver interface, 16:9
```

**T4-B, stylised 3D**
```
Stylised 3D campaign hub: a miniature diorama of a walled mage academy camp at dusk on a table-like view, tilt-shift depth of field, training yard, cistern, fighting pit, market, tents, gate, cliff edge, each with a floating silver sigil marker. Animated lantern light, smoke, tiny students. A side panel in dark enamel and silver shows a six-week calendar and a character portrait card of a young water mage. Painterly textures, soft global illumination, cosy yet tense atmosphere, 16:9
```

## T5. D3: the title screen

**T5-A, 2.5D painted**
```
Key art title screen for a fantasy mage dueling game: a young water mage in pale layered robes stands in the centre of a sunken stone arena at night, a ring of floating water crescents around her, moonlight from above, four faint elemental sigils (flame, crescent, stone, lightning) carved into the arena floor glowing softly, crowd balconies dark, verdigris bronze statues framing the scene. Empty space at the top for a title, a vertical column of four menu options on the left in pale serif type on dark enamel plaques. Painterly illustration, sculpted forms, cinematic composition, 16:9
```

**T5-B, stylised 3D**
```
Stylised 3D key art title screen: young water mage in pale robes in the centre of a moonlit sunken stone arena, orbiting water crescents with refraction, four elemental sigils glowing in the floor, volumetric moonbeams, verdigris statues, dark balconies. Space at the top for a title, a vertical menu column on the left with silver-framed dark enamel buttons. Painterly toon rendering, cinematic lighting, 16:9
```

## What to record after generating

| Target | Picked variant (A/B) | Why | Image path |
|---|---|---|---|
| T1 close duel | | | |
| T2 combat look | | | |
| T3 HUD | | | |
| T4 campaign | | | |
| T5 title | | | |

If most picks are **A**, the Pixi vertical-slice frame (D2 section 5) is the next step. If most are **B**, price the
native-engine port first, including how the deterministic TS core moves with it.
