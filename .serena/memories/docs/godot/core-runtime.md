# Godot Core Runtime Docs Summary

Updated from `docs/godot-v2/README.md`, `controller-lab.md`, `replay-and-trace.md`, `level-lab.md`, and `door-transition-flow.md`.

## Core Runtime Index

- `controller-lab.md`: `CharacterBody2D` controller tuning, coyote time, jump buffer, hover, and movement trace hooks.
- `level-lab.md`: editor-placeable marker nodes, `LevelTileMap`, catalog-backed loading, and generated schema boundaries.
- `door-transition-flow.md`: `DoorMarker` transitions, `level.loaded`, `door.entered`, and `run.finished` behavior.
- `session-outcomes.md`: death, revive, heal, collectible, goal, HUD, and runtime error flows.
- `replay-and-trace.md`: replay schema, trace schema, replay suite behavior, `player_motion`, `last_hud`, and result payload summaries.

## Controller

`res://levels/controller_lab.tscn` is the movement tuning scene. `Player.tscn` assigns `PlayerTuning` to `PlayerController.gd`. Tune: `max_speed`, `ground_accel`, `ground_decel`, `air_accel`, `air_decel`, `jump_velocity`, `gravity_up`, `gravity_down`, `jump_cut_multiplier`, `coyote_time_ms`, `jump_buffer_ms`, `hover_gravity_scale`, and `hover_max_fall_speed`.

Movement trace hooks include spawn, jump start, jump cut, hover start/end, landing, and replay `player.sampled` frames. Use:

```bash
npm run godot:replay -- --replay res://tests/replays/controller_lab_jump.json --out /tmp/fake-kirdy-controller-lab.ndjson
npm run trace:summary -- /tmp/fake-kirdy-controller-lab.ndjson
```

## Replay And Trace

Replay frames are sparse keyframes and action state persists until changed. Session replays can seed `start_level_id`, `start_spawn_id`, `initial_ability_type`, `initial_item_ids`, `initial_player_max_hp`, and `initial_player_hp`.

Trace events are JSON/NDJSON with `frame`, `time_ms`, `event_type`, `level_id`, optional `payload`, and optional player position/velocity. Successful replays emit `run.finished`; failures emit `replay.error`.

Useful commands:
- `npm run godot:replay-suite -- --list`
- `npm run godot:replay-suite -- --filter <id>`
- `npm run godot:replay-suite -- --out-dir <dir>`
- `npm run trace:summary -- <trace>`

## Level Metadata

Levels use marker nodes as `Node2D` children with scripts under `res://scripts/level/markers/`:
- `PlayerSpawn`
- `DoorMarker`
- `EnemySpawnMarker`
- `HealMarker`
- `CollectibleMarker`
- `GoalMarker`
- `CameraBoundsMarker`

`LevelTileMap` stores tile size, grid dimensions, and collision source metadata. `LevelLoader.gd` builds a `LevelDefinition` with spawns, doors, enemies, heals, collectibles, goals, camera bounds, and tilemaps.

## Door Flow

`DoorMarker` owns `door_id`, `target_level_id`, `target_spawn_id`, `trigger_radius`, `door_role`, `door_label`, and `door_visual_style`. `GameSession.gd` loads the active level through `LevelLoader.gd`, places the player at a spawn marker, checks door/goal proximity each physics frame, emits `door.entered` on transitions, and emits `run.finished` on goals.