# tiger backlog - mage-arena-tv

## Kept, not chosen (2026-10-15 arena combat; scope.md has full specs)
- **C. Lab replay takeover** (P07; P01, P21, P25) - fork live play from any frame of the 20 s Lab ring, retake anchor. S. Peers 7.7. J built a bout-level takeover, the Lab ring still has none.
- **E. Feel capsules** (P09; P21, P25) - tagged, replayable Lab/Tiro bundles agents replay to the exact hash. M. Highest peer score (8.3).
- **K. The player's Shade** (P10) - capped AI fitted to the player's ledger and tape. L. Needs A (landed) and E.

## Findings raised during the build (owner decisions)
- **AI ladder bottom is inverted:** reference wins L1 176 < L2 218 (level 1 is harder than level 2). Rows below 3 also drive Tiro opponents (1, 1.5), so fixing it changes Tiro. Root cause found by D: `runtime.games.mageAimLeadFraction` 0.45 under-leads strafing targets, so more aim error hits more.
- **Bait-then-punish never fires:** curve AIs cast 0 unblockables per fight; mana never banks to the 40-45 tier-IV cost. The level-2 row's "holds the best spell for its tier" is unimplemented.
- **Rival plans for Tiro:** with `games.rivalPlans: true`, the semifinal (Undertow) median falls to 36.4 s, below its 45-75 band (reference wins 1678/2000); the final (Mirror tide) is 68.1 s, in band. Undertow's close pressure loses to the reference build. Stays off.
- **Lunge telegraph overstates reach:** after L the lunge hits a narrower envelope at full extension, but the windup still draws the old 2 m, 80 degree sector.
- **Key-order-dependent stateHash:** L fixed save-resume (director/save.ts resumes from the validated replay). A browser refresh mid-bout against a still-running server can still hash apart. The full fix is key-order-free hashing, which re-pins every hash.
- **Stale evidence:** docs/waves/W2-evidence/bots.json predates the current kernel (lead 9 now perfects 39/40), and W4 competence-ladder.json predates CF2/H1 (dossier figures 443/287/115/184 vs live 176/218/163/204). Wave-1 H1 census evidence no longer matches after L.
- **Forecast blind spots:** the Lab forecast does not model rival preset/plans or live creatures.
- **Staff strike `interruptsCasts`** (from P02): semantics against the stagger-immune tail need an owner call.
