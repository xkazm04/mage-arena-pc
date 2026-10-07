# Covenant camp handoff

`manifest.json` is the data entry point. Paths are repository-root relative.
`places` retains the eight baseline IDs and exact opening slots. `anchor` is a
normalized map landmark coordinate; the review layout clamps labels inside the
safe area. Generated images contain no navigation labels. Game code owns labels,
selection, opening times, story facts and visit actions.

Six maps cover day/dusk/night at 1920×1080 and 2560×1440. The eight full-screen
visit backdrops each have one authored light condition, not three time variants.
Use them as atmospheric visit views; do not infer a live slot from their light.
Six cropped story illustrations include source rectangles and hashes. Sample
titles and copy are thematic art-review text, not events emitted by the Director.

Hollow Board frames use the existing `card.normal`, `card.unread`,
`card.selected` and `card.warning` regions in `art/ui/kit.json`. Load them by the
unchanged UI contract in `art/ui/README.md`; no duplicated frame atlas is needed.

Serve the repository and open `art/delivery/a4c/preview.html` for the real canvas
consumer. Mouse, arrows, Enter and Escape work. Closed places may be selected
but cannot be visited. The review-only `setCampReview` function can display any
backdrop for inspection; it is not a gameplay action API.

Sources and exported files are owner-review candidates. Reference-guided maps
preserve major landmarks, not exact pixels. Native-size exports resample the
generated source and do not imply newly generated native resolution. Source
hashes and transformations remain in the manifest. Game integration, live state,
performance, physical gamepad and sofa readability remain unmeasured.
