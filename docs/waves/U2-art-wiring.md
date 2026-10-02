# U2 — Covenant art wiring

2026-10-03. Presentation only; core, Director, geometry and save schema remain
unchanged. Read the full plan (especially j/m/n/o), OWNER-CHECKS, U1 report,
game source and the session-5 delivery/combined board before implementation.

Five commits: assets (including a real merge of art), UI, arena, camp, polish.
Resolve the shared plan/checklist with integration's content, preserving its
merged gameplay history and owner direction. Art's handoff remains in its own
files. Never write the art worktree or read art/raw.

Acceptance here means authorized integration, not owner approval. Preserve the
delivery's owner-review labels and provenance. Copy only A7, A5b/UI, A4c, A2c
and A3c manifest-listed files to assets/accepted/covenant, verify SHA-256 and
emit an individual sidecar plus a runtime index. Historical A2/A3/A4/A5 paths
are not runtime sources. Load failures must retain a playable procedural view.

The UI uses the exact 90-region atlas, Cinzel / Source Sans 3, clipped bars,
independent selection/focus, cursor hotspots and published motion durations.
Camp navigation uses delivery landmark anchors with game-owned opening slots.
Story illustrations are thematic accompaniments, never evidence of an event;
all copy and state remain supplied by the game. Portrait moods use explicit
game mood keys, otherwise neutral; never guess a character's identity.

Arena palette table: proving ground = verdigris; Games 1/2 = verdigris;
3/4 = rust-sand; 5/6 = moonlit. All three get explicit preview evidence without
unlocking unimplemented Games. Ground is world anchored and projected once.
A7 is a flattened scene, not a layered ground/prop delivery: record any derived
crop/occlusion limitations. Preserve exact code-owned ward and threat geometry.
A3c keys must pass pose, facing, painterly continuity and distant readability
before use. Otherwise use Covenant procedural figures, with a per-identity
decision table; no unsupported pose substitution or invented animation claims.

Validation: npm run gate at each commit; final production Playwright tour of
every screen at 1920x1080 and 2560x1440, ordinary input bout, save round trips,
failure injection, 100 visible moving projectiles, frame-time/heap/texture bytes,
deterministic replay and fresh 2,000 fights per wave. Store evidence in
docs/waves/U2-evidence. Authored layout/art, simulated fights, measured tests;
owner visual quality, sofa feel and G1 remain pending.

## Implemented decisions

The real merge keeps integration's plan and owner checklist; it imports the art
handoff, contracts and current deliveries. Removed the discarded legacy A3
figure/review tree introduced by that merge. Runtime and build copying are
restricted to the new accepted Covenant tree; old A2/A3 are never requested.
Individual sidecars retain upstream hashes and owner-review labels. Integration
is authorized by this task; it does not change those labels into owner approval.

A7 has no tileable bare ground or transparent props. The renderer derives a
1552x432 floor texture from the central ground crop, blending opposite edges,
and repeats it at world scale inside the unchanged oval. The rune motif visibly
repeats. Native-scale polygon crops provide five pylons and rim stones (32
sorted prop instances); figures and props share world-foot Y sorting. The three
palettes reuse normalized crop anchors, so edge cleanup and exact palette
alignment remain art work. This is a disclosed provisional adaptation, not a
claim that layered arena art was delivered. No camera or combat dimensions were
changed to fit a painting.

All twelve roster identities stay procedural, with individual gate reasons in
`packages/game/data/covenant.json`. The Water mage now has light layered cloth,
a hood, staff and water energy. Painted A3c water aura, bolt and impact motifs
accompany code-owned trails and exact 140-degree absorb geometry; telegraphs
retain their exact footprints. Other school motifs are available but do not add
unimplemented Fire/Earth/Air gameplay. Atlas cast/cooldown fills and independent
locked/cooldown/focus states finish the HUD feedback.

Camp uses eight manifest anchors, three time maps and eight place backdrops.
Board cards use illustrated story art and A5b Hollow Board frames; story choice
is thematic, never a new fact. Cast journal shows all sixteen baseline identities
even when the art manifest fails; seven expressions per identity are available.
Parley selects neutral, calm or angry from its explicit game result, Trials use
proud and chapter closure calm. The full expression sheets are review fixtures,
not fabricated dialogue outcomes. Canvas panel fades, focus pulse and authored
cursor states respect reduced motion; body text is Source Sans 3 and headings
Cinzel at weight 600. Geometry, saves, Director and kernel remain untouched.

Validation includes bounds/focus/native input, both complete chapter routes,
front/behind prop ordering, all delivery variants and six fault injections.
Earlier layout iterations exposed button overflow (fixed with label/inset
changes); one final-tour attempt used a stale preview build and failed at the
new prop fixture. That attempt is archived, then the production build and full
route were rerun. The new front/behind test then exposed actor re-insertion
bypassing stable prop sorting; retaining actor containers fixed the visual
occlusion and both cases now pass. That failure is archived too. See the final report and evidence gallery for measured values.
