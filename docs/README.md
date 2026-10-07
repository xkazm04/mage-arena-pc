# Mage Arena: documentation index

Mage Arena is a PC action RPG (Windows, mouse and keyboard first) about elemental battle mages (Fire, Water, Earth, Air), betrayed by Rome and held in a warded camp.
The game alternates between a **camp** played on a calendar of hours (places, relationships, schemes), where an LLM Director decides what every character does each night, and the **arena** (oblique-camera real-time combat with spell tiers on a 15-second collar clock and a directional magical ward).

These docs are written for an LLM reader first and a human reader second. Each topic folder is self-contained: its numbers come from the JSON copies in its own `data/` folder, and **the data wins over prose**.

## Topics

| Folder | Covers | Start at |
|---|---|---|
| [campaign/](campaign/README.md) | Premise, season and time, cast and schools, camp simulation (closed intents), social systems, the LLM Director, the camp-to-arena bridge, quests and story, deaths and endings | [campaign/README.md](campaign/README.md) |
| [gameplay/](gameplay/README.md) | What the player does: game flow and screens, controls, the camp phase (non-combat), camera and scale, movement and resources, casting and spells, ward and absorb, hit reactions and defeat, opponents and arena tiers, the Combat Feel Lab | [gameplay/README.md](gameplay/README.md) |

Each folder has a `status.md` (built, partial, planned or reserved, for each mechanic) and an `open-questions.md` (owner decisions still open and known contradictions between sources).

## Other files

| File | What it is |
|---|---|
| [MAGE-ARENA-PLAN.md](MAGE-ARENA-PLAN.md) | The project plan and decision log (D1-D39). Its status table is not maintained; use the `status.md` files for the current state |
| [OWNER-NOTES.md](OWNER-NOTES.md) | The owner's original concept notes, verbatim |
| `design/baseline-fourteen-nights/`, `design/reference-the-ledger/` | The two original design-contest proposals. **Historical**: the reconciled design in `campaign/` and `gameplay/` supersedes them |
| `judging/` | The objective review of the design contest (historical) |
| [PROVIDER-LEDGER.md](PROVIDER-LEDGER.md) | Image-generation provider probe (art pipeline, not game design) |
| `death-ride-process/` | An example plan from a sister project, kept as a process reference |

## Provenance

Exported on 2026-10-07 from the development branch `integration` at commit `b1efd46`, plus uncommitted quest work in progress. The game source code is not in this repository; source paths quoted in the docs are relative to the development repository.
