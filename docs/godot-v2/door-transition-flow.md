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

Representative Hub doors must use readable labels and distinct roles/styles such as `trial`, `region`, `locked`, or `support`. The scene lint rule `nearby_door_ambiguity` checks `central_hub` so nearby visible doors fail validation when they do not have distinct labels, roles, or `door_visual_style` values.

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
