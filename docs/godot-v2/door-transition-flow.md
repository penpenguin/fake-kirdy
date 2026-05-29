# Godot v2 Door Transition Flow

Door Transition moves the prototype from one editable test room to another without adding a full area graph.

## Markers

`DoorMarker` owns transition metadata:

- `door_id`
- `target_level_id`
- `target_spawn_id`
- `trigger_radius`

`PlayerSpawn` owns spawn placement. `GoalMarker` owns completion placement and has a `trigger_radius` for the minimal proximity check.

## Session Flow

`GameSession.gd` owns the active level, player instance, trace recorder, run timer, and outcome. It loads levels by id through `LevelLoader.gd`, builds a `LevelDefinition` from marker nodes, places the player at a spawn marker, and checks proximity to door and goal markers each physics frame.

When the player reaches a door, the session emits `door.entered`, loads the target level, places the player at `target_spawn_id`, and emits `level.loaded`.

When the player reaches a goal, the session sets the outcome to completed and emits `run.finished`.

## Replay

The sample replay is `prototypes/godot-v2/tests/replays/door_to_goal.json`. It starts in `door_room`, holds right to enter the door, transitions to `flat_room`, and continues to the goal.

Optional headless command:

```bash
godot --headless --path prototypes/godot-v2 --script tests/run_replay.gd -- --replay res://tests/replays/door_to_goal.json --out /tmp/fake-kirdy-door_to_goal.ndjson
```

Expected trace events include:

- `level.loaded`
- `door.entered`
- `level.loaded`
- `run.finished`

This flow does not implement the full area graph, enemy systems, HUD, save data, map UI, inhale, or swallow.
