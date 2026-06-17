# Godot v2 Door Transition Flow

Door Transition is the canonical level-change path for hand-authored scenes and generated schema rooms.

## Markers

`DoorMarker` owns transition metadata:

- `door_id`
- `target_level_id`
- `target_spawn_id`
- `trigger_radius`
- `door_role`
- `door_label`
- `door_visual_style`

Representative Hub doors must use readable labels and distinct roles/styles. Doors in `central_hub` and doors returning to `central_hub` use the `hub_` visual family, such as `hub_trial`, `hub_region`, `hub_support`, `hub_return`, or `hub_locked`, so they read differently from ordinary room-to-room doors. The scene lint rule `nearby_door_ambiguity` checks `central_hub` so nearby visible doors fail validation when they do not have distinct labels, roles, or `door_visual_style` values.

Unlocked Central return doors use `images/ui/hub-return-door.webp` through `DoorMarker.gd` when `door_visual_style` is `hub_return`. This keeps branch exits such as `fire_area_to_central_hub` and `forest_area_to_central_hub` visually distinct from ordinary `images/ui/door-marker.webp` movement doors even when they have no lock requirements.

Branch and generated door traces carry readable display names alongside canonical ids. For example, the Forest branch exposes `Central Hub` and `Labyrinth 001` labels, and the first labyrinth return door exposes `Forest Area`, while trace payloads keep the stable ids `central_hub`, `labyrinth_001`, and `forest_area`.

Locked doors use the sealed `images/ui/locked-door.webp` visual when `door_visual_style` is `locked` or `hub_locked`, `door_role` is `locked_gate`, or any item/ability/boss requirement is present. `hub_locked` keeps the sealed door texture and adds the Central Hub connection tint, so doors such as `hub_to_mirror_corridor` are not mistaken for ordinary `region` doors. The usability gate also checks that visible `central_hub` doors have a nearby platform support, so key exits do not appear to float without footing.

`PlayerSpawn` owns spawn placement. `GoalMarker` owns completion placement and has a `trigger_radius` for the minimal proximity check.

## Session Flow

`GameSession.gd` owns the active level, player instance, trace recorder, run timer, and outcome. It loads levels by id through `LevelLoader.gd`, builds a `LevelDefinition` from marker nodes, places the player at a spawn marker, and checks proximity to door and goal markers each physics frame.

When the player reaches a door, the session emits `door.entered`, loads the target level, places the player at `target_spawn_id`, and emits `level.loaded`.

When the player reaches a goal, the session sets the outcome to completed and emits `run.finished`.

## Replay

The sample replay is `godot/tests/replays/door_to_goal.json`. It starts in `door_room`, holds right to enter the door, transitions to `flat_room`, and continues to the goal.

Optional headless command:

```bash
godot --headless --path godot --script tests/run_replay.gd -- --replay res://tests/replays/door_to_goal.json --out /tmp/fake-kirdy-door_to_goal.ndjson
```

Expected trace events include:

- `level.loaded`
- `door.entered`
- `level.loaded`
- `run.finished`

Door transitions also update save, HUD, inventory, map discovery, and trace state when those systems are enabled by the session. Focused replay fixtures can still use small rooms such as `door_room` and `flat_room` to validate the transition contract in isolation.
