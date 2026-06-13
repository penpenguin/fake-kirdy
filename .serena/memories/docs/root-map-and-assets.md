# Root Docs, Map Structure, And Asset Metadata

Updated from `docs/README.md`, `docs/map-structure.md`, and docs image metadata.

## Root Docs

`docs/README.md` is the active docs entrypoint. Read order:
1. `README.md` for command entrypoints.
2. `docs/map-structure.md` for fixed maps, generated rooms, and cluster flow.
3. `docs/godot-v2/README.md` for Godot mainline docs.
4. `Task.md` for current backlog/status.

Current topic groups:
- Controller and replay: `godot-v2/controller-lab.md`, `godot-v2/replay-and-trace.md`
- Levels and content: `godot-v2/level-lab.md`, `godot-v2/content.md`, `godot-v2/procedural-level-generation.md`
- Gameplay loop: `godot-v2/combat-slice.md`, `godot-v2/session-outcomes.md`
- UI/save/performance: `godot-v2/hud-overlay.md`, `godot-v2/save-persistence.md`, `godot-v2/performance-testing.md`, `godot-v2/web-fallback.md`

Validation commands:
- `npm run test`
- `npm run test:canonical`
- `npm run trace:summary -- <trace.json|trace.ndjson>`

## Map Structure

Runtime map truth:
- `godot/levels/level_catalog.json`
- `godot/levels/level_catalog.source.json`
- `godot/levels/stage_manifest.json`
- `godot/levels/generated/procedural_levels.json`

Fixed map highlights:
- `central_hub`: start hub connected to `ice_area`, `fire_area`, `forest_area`, `cave_area`, `mirror_corridor`, `heal_room`, `combat_room`, and `jump_room`.
- `mirror_corridor` -> `goal_sanctum`; `goal_sanctum` -> `sky_sanctum`.
- `sky_sanctum` connects to `aurora_spire`, `starlit_keep`, and the generated sky chain.
- Branch rooms connect to their generated chains and reliquaries.
- Focused test rooms include `flat_room`, `door_room`, `heal_room`, `danger_room`, `revive_room`, `combat_room`, `flying_combat_room`, `enemy_spawn_limit_room`, `enemy_crowd_spacing_room`, and `hidden_discovery_room`.

Generated map clusters:
- forest: `labyrinth_001` - `labyrinth_005`, entry `forest_area`, exit `forest_reliquary`
- ice: `labyrinth_006` - `labyrinth_010`, entry `ice_area`, exit `ice_reliquary`
- fire: `labyrinth_011` - `labyrinth_032`, entry `fire_area`, exit `fire_reliquary`
- ruins: `labyrinth_033` - `labyrinth_050`, entry `cave_area`, exit `ruins_reliquary`
- sky: `labyrinth_051` - `labyrinth_068`, entry `sky_sanctum`
- void: `labyrinth_069` - `labyrinth_132`, terminal generated goal

Map validation:
- `npm run godot:stage-manifest -- --check`
- `npm run godot:procedural-levels -- --check`
- `npm run godot:catalog -- --check`
- `npm run godot:content-check`
- `npm run godot:replay-suite --`

## Image Metadata

- `docs/Key visual.png`: PNG, 1400 x 1024, SHA-256 `c87a46c4e347a229ddc6c684d0d894f0fb8a60e9343a921ab129c4624c7863a9`.
- `docs/key_visual.gif`: GIF, 800 x 450, SHA-256 `b57e6ca2ec4b8e9a7282785a551a62e60129fbe39b27497d53a655bbc23bc334`.