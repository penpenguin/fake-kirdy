# Godot Mainline Docs

These documents describe the canonical Godot 4 project under `godot/`. The previous migration language is historical; current work should update the Godot project, Godot-owned data, and the validation scripts directly.

## Core Runtime

- `controller-lab.md`: `CharacterBody2D` controller tuning, coyote time, jump buffer, hover, and movement trace hooks.
- `level-lab.md`: editor-placeable marker nodes, `LevelTileMap`, catalog-backed loading, and generated schema boundaries.
- `door-transition-flow.md`: `DoorMarker` transitions, `level.loaded`, `door.entered`, and `run.finished` behavior.
- `session-outcomes.md`: death, revive, heal, collectible, goal, HUD, and runtime error flows.

## Replay and trace

- `replay-and-trace.md`: Replay and trace schema, `godot:replay-suite`, `replay_suite.json`, `player_motion`, `last_hud`, and `last_result_overlay`.
- `performance-testing.md`: local replay performance budgets, Web export browser 60 FPS checks, RSS, and load time.

## Content and gameplay

- `content-migration.md`: hand-authored scenes, generated schema/importer data, level catalog, and replay coverage.
- `procedural-level-generation.md`: `labyrinth_001` through `labyrinth_132`, branch density, generated markers, and terminal goals.
- `combat-slice.md`: capture, release, swallow, ability acquisition/use, spit projectile, enemy damage, and replay evidence.

## UI, save, and Web export

- `hud-overlay.md`, `pause-overlay.md`, `result-overlay.md`, `virtual-controls.md`: visible player-facing UI state.
- `save-persistence.md`: save schema, localStorage, sessionStorage fallback, hidden discovery, and settings persistence.
- `audio-polish.md`: audio mix traces and lightweight presentation polish.
- `web-fallback.md`: Godot Web export and Canvas 2D fallback for WebGL 2 unavailable cases.
- `usability-accessibility-testing.md`: static usability/accessibility contract.

## Historical records

- `full-migration-execplan.md`: completed migration record.
- `gameplay-completion-execplan.md`: completed gameplay-loop record with one ongoing polish/tuning follow-up.
- `legacy-reference-boundary.md`: boundary for the removed legacy reference copy.

## Validation

Use `npm run test` for the fast gate and `npm run test:canonical` before claiming canonical gameplay parity on a machine with Godot installed.
