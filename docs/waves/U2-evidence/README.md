# U2 evidence

Open [index.html](index.html) directly for native screenshot links and filters.
The gallery has 144 final PNGs: 76 game screens, 56 delivery fixtures and 12 fallback captures.
The game remains a canvas; the HTML here is an evidence viewer only.

| Evidence | Reproduce from repository root | Meaning |
|---|---|---|
| `gate.txt` | `npm run gate` | Build, lint, 156 TypeScript tests, ten reference tests, zero design contradictions |
| `browser.json`, `screens/` | `npm run smoke:u2` | Both full two-week routes, 22 screen kinds, 80 capture events / 76 distinct PNGs, native input, emulated controller, exact camp/combat save-load |
| `art-browser.json`, `art/`, `fallbacks/` | `npm run smoke:u2:art` | Both-resolution delivery fixtures and six injected asset faults through camp and arena |
| `replay-save.json` | `npx tsx packages/tools/src/u2-replay.ts` | Two equal seeded seasons and byte-identical restored save, identical to U1 |
| `census.json`, `census-wave-*.json` | `npm --prefix packages/core run report:w4 -- --evidence U2-evidence --tag census` | 2,000 fights per wave, unchanged U1 digests and passing duration bands |
| `integration-audit.json` | `npx tsx packages/tools/src/u2-audit.ts` | Provenance, excluded legacy paths and unchanged gameplay authority |

Run the browser checks sequentially, after the production build. They boot
previews on 4188/4189 and use temporary save directories and the offline Director.
The full route includes ordinary short training combat and drives Games through
the unchanged authored input policy; it does not claim human balance/feel.

The 100-projectile fixture keeps all 100 moving projectiles visible for sixty
samples and measures the last 360 frames. Reported FPS is from requestAnimationFrame;
CPU p95 is application frame work. Browser JS heap is a single sampled value,
not a retained-heap leak test. Texture storage is estimated decoded RGBA8 bytes:
37 shared art sources, two UI pages (32 MiB), bitmap font pages (44 MiB), and the
derived arena floor (2.56 MiB). Image caches are on demand and bounded by the
manifest. Driver allocations, framebuffers, small procedural sources and texture
compression effects are excluded. This is not measured GPU VRAM or GPU frame time.
The census wall time (144.45 s) overlapped an earlier browser iteration; it is not
an uncontended performance benchmark. No new 30-minute soak was performed.

`art/` shows all 112 portrait expressions per resolution, eight places, three
time maps and six story illustrations. These harness fixtures call the production
art helpers; they do not create story facts or unlock later Games. Palette and
front/behind pylon screenshots likewise are labelled fixtures. Default figures
are still procedural under the partial A3c gate decisions.

`fallbacks/` deliberately causes missing all art, missing UI, corrupt UI page,
corrupt portrait, missing Door backdrop or missing accepted fonts. Each case
continues through character choice, camp, journal, composition and moving/casting
in the arena. Diagnostics are expected in those cases; normal runs have none.

`attempts/` retains the stale-preview mistake and the prop-order test failure
that exposed a real rendering bug. See its README for the fix. Final results are
in the top-level JSON files. Authored presentation, simulated outcomes and measured
engineering checks are distinct from owner visual judgment, sofa readability,
physical controller latency and G1 acceptance; those remain open.
