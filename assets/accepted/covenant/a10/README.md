# A10 character animation candidate

`characters.json` is the runtime entry. Load through `canvas-loader.js` or
consume its atlas rectangles directly. Paths are repository-root relative.
Every source and page is hash-bound. All exports require owner review.

Two generated diagonal views are rear-right (ne) and front-right (se), where
available. Rear-left (nw) and front-left (sw) mirror those views; equipment
handedness mirrors too. Several enemy views and action clips are missing. Select directions from
world movement or aim. Keep the last facing while stationary. Do not rotate
upright figures. Feet share anchor [0.5, 0.833333] in 384px frames, with 160px
nominal body height; draw the full frame at 97.2px at 1080p for a 40.5px body.
At 1440p multiply by 4/3. The 3–4.5% range multiplies by 0.8–1.2.

Idle/run loop; cast, hit and death hold the last key until the game changes
state. Absorb loops its resisting keys. Gameplay timing, invulnerability,
projectiles, collision and exact absorb geometry stay game-owned. Enemy
`cast` means weapon/natural attack and `absorb` means brace. This contract
does not grant an enemy a new ability. AI mages reuse the school bodies.

Generated poses undergo local measured-magenta removal, edge decontamination,
uniform scale and baseline alignment. Left facings are derived mirroring. There is no
procedural limb animation or body rotation. Master pixel size is packaging,
not a claim of newly generated resolution; each clip records native source
detail relative to 1440p. Background removal cannot restore clipped anatomy.

`source-gates.json` reports source crop margins, silhouette coverage, median
pigment drift and exclusions. Hash-bound direct facing observations accompany
local grader records in `art/waves/A10/facings`. Statistics cannot establish
pose quality or identity by themselves. Missing/rejected clips appear in the
manifest backlog and the loader returns false, rather than silently faking a
direction. Game integration, perceived smoothness and owner approval remain
separate from file and browser checks.

This is a PARTIAL delivery. Several loops contain repeated leading-leg poses;
six distinct paintings do not certify a real alternating gait. Netter front
details came through a text-only direction guide and differ from the rear;
Iskar front-gait repair was rejected because bright pink cloth keyed away.
Cinder hound generated clothes and a staff and was rejected in full. The
animal-only correction received HTTP 429. Both providers remain latched.
The manifest backlog enumerates every absent entity/state/direction.

Facing review is authored and hash-bound, not an automated anatomy classifier.
Deterministic gates check source margins, alpha coverage/mass, median palette
drift, exact duplicate keys, atlas bounds and source integrity. The local
vision grader only rejects or routes; neither process grants owner acceptance.
Native 1080p/1440p proofs combine A9/A8 and available A10 clips; missing bodies
are not substituted. Open the owner board and motion page for actual coverage.
