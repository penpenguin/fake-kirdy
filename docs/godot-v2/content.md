# Godot Content

This document summarizes the current playable Godot content surface. Runtime truth lives in `godot/levels/level_catalog.json`, source catalog data in `godot/levels/level_catalog.source.json`, stage topology in `godot/levels/stage_manifest.json`, and generated-room layout data in `godot/levels/generated/procedural_levels.json`.

## Playable Levels

- `central_hub`: starting hub with branch doors, support/test room doors, dead-end rewards, camera bounds, and `LevelTileMap` metadata.
- `ice_area`, `mirror_corridor`, `fire_area`, `forest_area`, and `cave_area`: branch rooms with marker-authored spawns, doors, enemies, camera bounds, and route intent.
- `goal_sanctum`: goal-door clear room with score/result traces.
- `sky_sanctum`, `starlit_keep`, and `aurora_spire`: late-route sky hub and side rooms.
- `labyrinth_001`: hand-authored representative procedural room that connects back to `forest_area`.
- `forest_reliquary`, `ice_reliquary`, `fire_reliquary`, and `ruins_reliquary`: keystone rooms using `CollectibleMarker` ids.
- `heal_room`, `revive_room`, `combat_room`, `flying_combat_room`, `jump_room`, `danger_room`, `enemy_spawn_limit_room`, `enemy_crowd_spacing_room`, and `hidden_discovery_room`: focused replay and contract rooms for pickups, combat, controller behavior, hazards, crowding, hidden discovery, and run outcomes.

## Replay Coverage

Representative replay fixtures include:

- `central_hub_to_heal_goal.json`
- `central_hub_dead_end_max_health.json`
- `revive_room_revive_then_game_over.json`
- `ice_area_return_hub.json`
- `mirror_to_goal_sanctum_locked_without_keystone.json`
- `sky_sanctum_to_goal_finish.json`
- `labyrinth_001_return_forest.json`
- `*_reliquary_collectible.json`
- `flying_enemy_release_swallow_goal.json`

Use `godot/tests/replay_suite.json` as the canonical replay list and `npm run godot:replay-suite -- --list` to inspect it.

## Catalog Data

`godot/levels/level_catalog.source.json` generates `level_catalog.json` through `npm run godot:catalog`. Each level entry uses:

- `id`: stable level id used by `DoorMarker.target_level_id` and replay `start_level_id`.
- `scene_path`: Godot scene path loaded by `LevelLoader.gd`.
- `tags`: gameplay grouping such as `hub`, `heal`, `combat`, or `representative`.
- `coverage_status`: validation grouping such as `representative`, `sandbox`, or `test`.
- `source_ref`: durable topology reference such as `stage_manifest:<stage_id>`.
- `stage_id`: optional stage id matched against `stage_manifest.json`.
- `expected_neighbors`, `expected_collectibles`, and `expected_dead_end_rewards`: validation hooks for topology, item, and reward data.

`LevelLoader.gd` reads `level_catalog.json` for hand-authored scenes. Generated rooms are resolved through the generated schema fallback rather than through hand-authored `.tscn` files.

## Generated Schema

`godot/levels/generated/procedural_levels.json` defines `labyrinth_001` through `labyrinth_132`. Each entry records Godot ids, topology, cluster metadata, room dimensions, generated floor/platform geometry, camera bounds, spawn points, door points, safety radii, branch rules, and generated gameplay marker payloads.

`LevelLoader.gd` materializes generated schema rooms at runtime with:

- `PlayerSpawn`, directional spawn, `DoorMarker`, `GoalMarker`, and `CameraBoundsMarker` nodes
- `LevelTileMap` metadata
- static floor and platform geometry
- generated enemy, heal, collectible, hazard, ability gate, dead-end reward, and terminal goal markers

## Validation

- `npm run godot:stage-manifest -- --check`
- `npm run godot:procedural-levels -- --check`
- `npm run godot:catalog -- --check`
- `npm run godot:content-check`
- `npm run godot:replay-suite --`
- `npm run trace:summary -- <trace.json|trace.ndjson>`

Run `npm run test:canonical` before claiming canonical gameplay behavior on a machine with Godot available.
