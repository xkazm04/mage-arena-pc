# A11 Tideglass and stat art — partial candidate

Entry point: `art/ui/kit.json`, extension `a11-tideglass-stats`. The separate
`daily-stats` atlas adds 18 regions; all 90 A5b regions and both old pages remain
unchanged. Use `canvas-loader.js` for a minimal SHA-checked canvas consumer.

No new images were generated in A11. Both provider latches were already set.
The silver clock rim is an existing generated A5b crop; the mist reuses an A8
water aura key. Stat shapes, relief shading, sky plates, water, markers, glass
and assembly are authored locally. `provenance.json` states this explicitly.
The requested new generated icon and clock paintings remain in the backlog.

Gold uses stacked crescent coins, reputation an open laurel seal, fatigue a
guttering candle. Header regions are 64px source / 32 design units; large
regions are 256px source / 128 units. Each has a centre pivot and normal alpha.
These are deliberately separate exports, with 2x source density at 1080p and
1.5x at 1440p. No resource values, text or labels are baked into the sprites.

The Tideglass layers share a 512px untrimmed canvas and [0.5,0.5] pivot. Full
design size is 240px; header size is 96px. Phase plates are dawn, midday, dusk
and night. The game supplies phaseFrom, phaseTo, phaseMix and elapsed day
fraction; the art does not infer activity durations or the hour schedule.

Draw phase plates, basin, clipped water, moving meniscus, optional mist, glass,
rim, hour marks, then the rotating pointer. Water clips from source Y
`307 + clamp(dayFraction,0,1)*104` down to 411, with X bounds 103..409. The
meniscus crop [100,290,312,31] moves to Y=cut−17 and narrows by
`max(0.1,sqrt(1−fraction²))`; omit it at fraction >= .995. Rotate the pointer
clockwise by fraction×2π around the shared centre. Reduced motion omits mist
and idle shimmer and directly displays game state. Do not rotate any other
layer or stretch the rim. Keep phase plates clipped by their own alpha.

All layers use straight RGBA/source-over by default. Source-over mist is the
reference implementation; optional low-opacity additive rendering needs game
review. Upload with premultiplication once. The atlas has transparent 2px
gutters and no rotated or trimmed rectangles. Its 4096×2048 maximum dimension
requires a texture-capable canvas backend; no device performance claim is made.

Review: `art/review/a11/index.html` and `motion.html`. Check:
`.venv-art6/Scripts/python.exe tools/art/restoration_ui.py check`.
Rebuild: same command with `build`; it consumes the archived A5b baseline and
tracked A5b/A8 images only. It never calls a provider. Generation briefs are
prepared but unsubmitted under `art/briefs/a11/`.
