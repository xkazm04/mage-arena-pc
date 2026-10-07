# Moonchalk cast handoff

Load `manifest.json`. All file paths are repository-root relative. Sixteen cast
IDs match the baseline; new appearances are described in `art/cast-covenant.json`.
Main clothing/staff identities match the Covenant battle roster. No discarded A2
portrait or identity image is a source.

`portraits` contains exact original-resolution opaque RGB crops, source hashes,
source job, crop rectangle, intended mood, atlas page and rectangle. `pages` are
sixteen 1024x640 RGB atlases. A page uses 256x320 cells in this order: neutral,
calm, proud, afraid / angry, scheming, grieving, unused. `anchor` is normalized
within the cell. Atlas images contain-scale the source with Lanczos and a dark
matte; they never stretch faces. Prefer original crops for large dialogue views.
A generated ornate border belongs to the portrait image, not a nine-slice panel.

Neutral portraits and expression sheets may have small lighting, pose and frame
variations. Mood labels describe the requested expression, not validated emotion
recognition. Owner review must judge identity, acting and style. Unresolved or
rejected sources remain on the wave board and never silently become accepted.
`missing` in the manifest reports any absent requested identity/mood.

`art/review/a2c/portraits.html` shows every delivered crop. Serve the repository
and open `art/delivery/a2c/preview.html` for the canvas conversation study. Left/
right change character, M cycles moods, up/down move choice focus. Dialogue text
is an authored visual study, not a shipped conversation or gameplay-state claim.
The review API `setPortraitReview(id, mood)` rejects unknown keys. Choice buttons
only demonstrate the art layout; game code owns actions and live dialogue.

Sources are not true inpainting or alpha output. Every file is an owner-review
candidate. Native screenshots validate loading/layout, not game integration,
physical sofa/gamepad readability, animation timing or runtime performance.
