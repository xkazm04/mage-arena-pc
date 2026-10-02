# A2 - cast portraits and expressions

Design before generation, 2026-10-02. A1b delivery gate passed and committed;
Tessera & Lime is the owner-selected baseline. Camera confirmation is irrelevant
to camp portraits; A3 remains blocked and no full-body sprites are authored.

Use the original 16-character baseline cast without importing loop mechanics.
`art/cast-v1.json` binds IDs, existing names/roles and authored visual identities
to the source file hash. Each character receives one 3-column by 2-row expression
sheet: calm, proud, afraid, angry, scheming, grieving, in reading order. Faces,
hair, age, costume and collar remain stable within a sheet. Neutral pale plaster
background, bust framing, no generated text, no active magic in camp.

Budget target: 16 source images; corrections only for observed failures under the
existing per-scene cap. Start with one lead portrait sheet, local grade and direct
inspection, then hash-bind technical continuation before the other 15. Every
source is preserved. Derivative portrait tiles are deterministic rectangular
exports with coordinates and source hashes, never claimed to be separate image
calls or accepted production assets. Owner judges identity and emotional reading.

Gates: `python tools/art/waves.py check A2`, `python tools/art/portraits.py check`,
`python tools/art/check.py`, `python tools/art/portable_check.py`. Verify all cast
IDs, six moods, crop bounds, hashes, dimensions, no missing browser images and no
model acceptance. Meaningful identity consistency needs direct/owner inspection;
file checks alone cannot certify it. One commit after delivery, no push.
