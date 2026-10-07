# Controls and input

Purpose: the full binding table for combat and menus, how raw input becomes a deterministic simulation input, and how the cursor maps onto the oblique ground.
Status: built. Mouse and keyboard is the primary input (D4). Gamepad is built and tested with the emulated browser Gamepad API only; a physical controller has not been tested. Input feel and physical latency are not measured.

## Combat bindings

Sources: `docs/START-HERE.md`, pause screen "Settings & controls", U1-tv note.

| Action | Mouse + keyboard | Standard gamepad |
|---|---|---|
| Move | WASD | Left stick |
| Aim | Mouse cursor; aim at the **feet / ground point** of the target | Right stick (last direction persists on release; moving the mouse restores mouse aim) |
| Cast selected slot | Left button (held: casts whenever ready) | RT |
| Directional ward (absorb) | Right button held | LT held |
| Select spell slot | 1–4 or mouse wheel | LB / RB |
| Roll | Space (in movement direction, otherwise facing) | A |
| Sprint | Shift (held) | Left stick press (L3) |
| Pause | Escape | Start |
| Staff strike | Left button with slot 1 when an enemy is within 1.6 m inside a 90° front arc | RT, same rule |

Combat Feel Lab keys (L, T, R, P, period, G, H, V) are listed in [combat-feel-lab.md](combat-feel-lab.md).

## Menu and camp bindings

| Action | Keyboard | Mouse | Gamepad |
|---|---|---|---|
| Move focus | Arrows / Tab | Hover | D-pad / left stick |
| Activate | Enter | Click | A (hold for hold-actions) |
| Back / pause | Escape | Back button | B back, Start pause |
| Listening: listen / hide | Hold Space / release | — | Hold A |
| Listening: change cover | A / D or 1–3 | — | D-pad / stick |
| Parley text | Type on keyboard; Enter writes, Escape ends text entry | — | Letter board |

Gamepad navigation timing (source `packages/game/data/ui.json`): dead zone 0.24, first repeat after 360 ms, then every 190 ms. Tooltip delay 450 ms. A button held across a screen change never activates the next screen. Disconnecting the controller or losing window focus releases held inputs; disconnecting during combat pauses the game.

## The input frame (simulation boundary)

Source: W2 note, `packages/core/src/arena/kernel.ts`.

Each 1/60 s tick the game produces one absolute `InputFrame`:

| Field | Meaning |
|---|---|
| move | Movement vector |
| aim | World ground point (metres), not a screen position |
| slot | Selected slot 0–3 (slot 0 = Rain Needle) |
| cast, absorb, roll, sprint | Button states |

Rules:

- The player, the mage AI and the gamepad all produce the same frame. The mage AI has no other authority over HP, mana, tier or cooldowns.
- Roll triggers on the rising edge only.
- Mouse aim is always active. Movement never supplies aim while a valid cursor direction exists.
- Focus loss clears all inputs. Opening a menu pauses the simulation.
- Season bouts store their input log. The server checks the log (bounded, ordered, hashed) and replays the bout from its initial snapshot before it accepts a result.

## Aim on the oblique ground (W4c)

- The pointer is stored in client pixels. It is converted through the current canvas bounds to the camera's logical pixels, then the orthographic ground projection is inverted to give a ground point.
- The conversion runs every input sample and every rendered frame, so a stationary cursor keeps its screen position when the camera moves, zooms or the window resizes.
- Figures are upright billboards drawn above their feet. Aiming at the torso or head hits the ground behind the target. **There is no body-snap or aim assist.** Foot rings are the intended aim reference.
- Collision and damage never depend on resolution or zoom. Measured: 32 real-pointer hit cases (2 resolutions × 2 zooms × 8 directions) in W4b/W4c, and 16 native mouse hits in U1.

## Not used

The baseline `combat.json/aimMode` block (hold-to-aim, soft-lock cone 60°, sticky 1 s, no movement while aiming) came from the gamepad-first design. It is **not used** by the current mouse-and-keyboard kernel. Soft-lock survives only as an AI targeting concept (Fog Bank breaks it; Mirage attracts it).

## Open

- Whether aiming at the feet feels natural with taller (U5) figures: pending owner check.
- Physical input-to-photon latency: not measured.
- Physical controller and TV distance: not measured.
