# Mage Arena — gameplay design (export)

Purpose: describes what the player does, in camp (non-combat) and in the arena (combat), as built on the `integration` branch plus the planned design that is not built yet.
Audience: LLM reviewers and developers first, human readers second. Read with [../campaign/README.md](../campaign/README.md), which covers the season, the camp simulation, the Director, the cast and the endings.
Status: exported 2026-10-07 from `integration` at commit `b1efd46` (2026-10-04, wave U6c). Water is the only fully authored school; the playable season covers weeks 1–2.

## Overview

Mage Arena is a single-player action RPG. The player is one of four elemental battle mages (Fire, Water, Earth, Air) who were betrayed by Rome and locked in a magic-warded camp. Magic is silenced inside the camp by collars; it works only in the arena.

Two phases feed each other:

| Phase | Genre reference | What the player does | Main doc |
|---|---|---|---|
| Camp (non-combat) | Persona-style calendar | Spend waking hours at eight places: train stats, work for gold, befriend, scheme, report; listen at night; use Parley at Knowing moments; win the Tent Trial to be the tent's entrant | [camp-phase.md](camp-phase.md) |
| Arena (combat) | Diablo / Path of Exile style real-time combat at an oblique camera | One hand moves (WASD), the other aims and casts (mouse). Spell tiers unlock on a 15 s collar clock. A directional ward absorbs magic; a perfect absorb refunds mana and speeds up the clock | [casting-and-spells.md](casting-and-spells.md), [ward-and-absorb.md](ward-and-absorb.md) |

## Core loop

```
 Camp day (08:00–20:00)   spend hours at places, free travel
        │
 Dusk / Night (18:00–22:00)  Pit, Edge, tent; night act = Listening (hides Director latency)
        │
 Dawn settlement            Director + planner resolve every NPC's day; Hollow Board and journal update
        │   (repeat for days 1–5 of each week)
 Day 6 dusk: Tent Trial     unarmed stamina bout vs tent rival → decides the tent entrant
        │
 Day 7 08:00: Games         composition screen → four arena bouts (soldiers, creatures, semifinal, final)
        │
 Results → camp             gold and renown, ally trust, rumour fact; Games consume 4 hours
        └──────────────► next week (6 weeks in the full design; 2 weeks playable now)
```

The calendar, hours and settlement rules belong to the campaign: see [../campaign/season-and-time.md](../campaign/season-and-time.md) and [../campaign/camp-simulation.md](../campaign/camp-simulation.md).

## Reading order

1. [game-flow-and-screens.md](game-flow-and-screens.md): every screen and how the player moves between them.
2. [controls-and-input.md](controls-and-input.md): mouse and keyboard, gamepad and TV navigation.
3. [camp-phase.md](camp-phase.md): the player-facing camp day, listening, Parley, Trial and Games entry.
4. [camera-and-scale.md](camera-and-scale.md): oblique camera, figure size, arena geometry.
5. [movement-and-resources.md](movement-and-resources.md): movement, sprint, roll, HP, mana, stamina, collar tier clock.
6. [casting-and-spells.md](casting-and-spells.md): slots, cast pipeline, Water spell lines and branches, Flow and Crest, school profiles.
7. [ward-and-absorb.md](ward-and-absorb.md): directional ward, perfect window, threat families, telegraphs.
8. [hit-reactions-and-defeat.md](hit-reactions-and-defeat.md): stagger, poise, knockback, DEFEATED and corpses, combat feedback.
9. [opponents-and-arena-tiers.md](opponents-and-arena-tiers.md): enemy roster, mage AI, Tiro Games, later tiers, pacing census.
10. [combat-feel-lab.md](combat-feel-lab.md): the tuning sandbox, its parameters and metrics.
11. [status.md](status.md): built, partial or planned for each mechanic.
12. [open-questions.md](open-questions.md): open design questions and pending owner feel checks.
13. [data/README.md](data/README.md): copies of the data files that hold the numbers.

## Authority rules (inherited from the project)

- **Data wins over prose.** Every number in these docs is copied from a data file; the source is cited next to each table. If a doc and a file in `data/` disagree, the file is right.
- **Later waves win over earlier ones.** Superseded values are listed in a "Superseded" section where relevant.
- **Code owns every number, roll and effect.** The language-model Director chooses NPC verbs only; it never sets combat values.
- **Determinism.** The arena kernel is a fixed 60 Hz simulation with seeded randomness, no wall clock and no DOM. Same seed + same inputs = same state hash. Presentation effects (hit stop, slow-down, camera) never change the simulation.

## Honesty labels

| Label | Meaning |
|---|---|
| authored | Value chosen by a designer or agent; not validated by play |
| simulated | Produced by headless seeded simulation (for example the 2,000-fight census) |
| measured | Measured on the real build (browser frame time, pointer hits, byte-exact replay) |
| owner-felt | Confirmed by the owner playing. **No combat or camp feel is owner-felt yet**; G1 is open |

## Glossary

| Term | Meaning |
|---|---|
| Collar / collar tier clock | Magic-suppressing collar. In the arena it unlocks spell tier I at 0 s, II at 15 s, III at 30 s, IV at 45 s of each bout |
| Tier (I–IV) | Power level of a spell line; the same slot upgrades in place when the collar unlocks the next tier |
| Line | One of five Water spell families (Tide Orb, Lash, Mire, Mend, Mirror); a slot holds one line |
| Branch | A/B choice at certain tiers of a line (Lash II, Mirror II, Tide Orb IV) |
| Rain Needle / bolt | Slot 1 basic spell, always equipped; becomes a staff strike at close range |
| Ward / absorb | Right-button directional 140° barrier toward the aim point; drains mana while held |
| Perfect absorb | A magic hit that lands within 0.15 s of a fresh ward raise: full block, mana refund, +2 s on the collar clock |
| Flow / Crest | Water combo resource: alternating lines builds Flow (max 5); at 5 the next cast is a free, ×1.5 damage Crest |
| Threat family | magic (absorb it), physical/steel (roll it), unblockable (leave it or break the caster) |
| Missio | Crowd grants the defeated fighter's life; a bout loss ends that Games day without death |
| Tiro / Veteranus / Primus / Summa | Arena tiers 1–4, gated by mastery; only Tiro is playable |
| Tent Trial | Dusk unarmed stamina bout at the Pit on Games eve; decides who enters the Games |
| Knowing | A secret true fact the player holds; it unlocks Parley with its subject |
| Parley | Optional typed role-play with an NPC at a Knowing moment, with authored fallback cards |
| Hollow Board | Public camp news board, refreshed each dawn |
| Director | The language-model service that picks each NPC's daily verb; backed by a deterministic planner. See [../campaign/director.md](../campaign/director.md) |
| Poise | Per-body stagger resistance; divides stun duration and knockback |
| DEFEATED | Serialized state tag; the body becomes a persistent corpse |
| Combat Feel Lab | Training sandbox with one opponent, live tuning, replay and metrics |
| Census | 2,000 seeded headless fights per Tiro wave, used as the pacing gate |

## File map

| File | Scope |
|---|---|
| [game-flow-and-screens.md](game-flow-and-screens.md) | Main menu, character pick, camp, visit, calendar, Board, journal, listening, Parley, Trial, composition, proving ground, arena HUD, results, chapter end, pause, settings, save/load |
| [controls-and-input.md](controls-and-input.md) | Bindings, the input frame, aim projection, UI navigation, gamepad |
| [camp-phase.md](camp-phase.md) | Hours, places, activities, header and clock, listening act, Parley, Trial, season bridge |
| [camera-and-scale.md](camera-and-scale.md) | Scale contract v3, dead-zone camera, arena ellipse, telegraph minimums |
| [movement-and-resources.md](movement-and-resources.md) | Walk, sprint, roll, staff strike, HP, mana, stamina, ranks, collar clock, between-wave recovery |
| [casting-and-spells.md](casting-and-spells.md) | Cast pipeline, commit point, cooldowns, Water catalogue, Flow, school practice profiles |
| [ward-and-absorb.md](ward-and-absorb.md) | Ward rules, reductions, perfect window, threat language, telegraph floors |
| [hit-reactions-and-defeat.md](hit-reactions-and-defeat.md) | Stagger formula, poise, knockback, DEFEATED, feedback (hit stop, flash, shake, numbers) |
| [opponents-and-arena-tiers.md](opponents-and-arena-tiers.md) | Soldiers, creatures, mage AI competence, Tiro waves, payouts, later tiers, census |
| [combat-feel-lab.md](combat-feel-lab.md) | Lab setup, keys, tuning fields with bounds, presets, metrics, replay |
| [status.md](status.md) | Mechanic status matrix with evidence |
| [open-questions.md](open-questions.md) | Open questions, pending owner checks, known gaps |
| [data/](data/README.md) | Copied authoritative JSON and CSV |

## Provenance

- Source repository: local git, branch `integration`, worktree `mage-arena-int`, commit `b1efd46` ("U6c.4 verify native reactions, performance and unchanged simulation", 2026-10-04).
- Sources read: `docs/START-HERE.md`, `docs/OWNER-CHECKS.md`, `docs/MAGE-ARENA-PLAN.md`, wave notes W2–W7, U1, U3a/b, U4, U5, U6/U6b/U6c, CF1/CF2, H1, the reconciled design data, `packages/core/src/arena/*`, `packages/core/src/season.ts`, `packages/game/data/*`, `packages/game/src/game-shell.ts`, `art/scale-contract-v3.json`.
- The integration worktree also has uncommitted quest work (`packages/core/src/quest*.ts`, `story/`). It is not covered here; see [../campaign/quests-and-story.md](../campaign/quests-and-story.md).
- Owner direction and decision numbers (D1–D39) come from `docs/MAGE-ARENA-PLAN.md` on `main`.
