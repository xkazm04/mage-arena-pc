# U1 TV navigation â€” design before implementation

Finish standard gamepad navigation across every screen: D-pad/left stick chooses
spatial focus, A activates/holds, B backs out, Start pauses/resumes. A held across
a transition must never activate the next screen. Repeat has an initial delay;
disconnect/blur releases held controls. Listening and the letter board stay
fully playable without typing. Mouse, keyboard and controller share callbacks.

Combat: left stick movement, right stick aim on the oblique ground plane, RT
cast, LT directional absorb, A roll, left-stick press sprint, LB/RB spell slots.
The last right-stick direction persists when released; a mouse movement restores
mouse aim. Gamepad input uses the existing deterministic InputFrame only.

Audit every screen's targets against the 5% safe rectangle and 64-unit minimum,
text overflow, visible focus and focus-graph reachability. Test gamepad edges,
repeat, axis dead zone and projection. The browser harness emulates the browser's
standard Gamepad API; label this accurately, not as a physical-controller test.
Capture every screen at 1080p and 1440p, play native arena controls, and retain
the complete two-week/save-load route. Add a gallery and a final report with the
camera/art handoff, remaining owner checks and exact gate commands.

Final polish uses real kit states through the atlas loader (including cursors,
bars and clock when present), preserves selection under focus, and implements
reduced motion. Art worktree stays read-only. No new balance changes, model
calls, provider probes, pushes or owner questions.

Measured completion: `npm run gate` PASS, 153 TypeScript plus ten reference
tests, zero contradictions. Production build PASS. `npm run smoke:u1` PASS at
1080p/1440p: 64 capture events, 60 distinct PNGs; every screen's directional
focus graph reaches all enabled controls, safe bounds/64-unit targets and text
overflow checks pass. Standard Gamepad API emulation verifies held edges, arena
movement/aim/cast/ward/slots, pause/resume and disconnect. Native mouse aiming
hits all sixteen targets. Both 100-visible-projectile samples measure 60.00 fps
and 1.70/1.90 ms render CPU p95 (1080p/1440p) over 360 frames. Full two-week routes and camp/combat
save-load remain green. Atlas integration's six cases and native fullscreen
round trip pass. The initial transpiler bootstrap failure is archived honestly.

Final artefacts: [report](U1-report.md), [gallery](U1-evidence/index.html), and
[owner route](../OWNER-CHECKS.md). Art kit remains absent; procedural components
stay active behind the published loader. Physical controller, sofa readability,
camera comfort and G1 remain owner measurements. No balance changes or art edits.
