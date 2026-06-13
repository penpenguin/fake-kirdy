# Godot Core Runtime Docs Snapshot

Imported from:
- `docs/godot-v2/README.md`
- `docs/godot-v2/controller-lab.md`
- `docs/godot-v2/replay-and-trace.md`
- `docs/godot-v2/level-lab.md`
- `docs/godot-v2/door-transition-flow.md`

## docs/godot-v2/README.md

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

## docs/godot-v2/controller-lab.md

# Godot v2 Controller Lab

The controller lab is the canonical movement tuning scene for the Godot mainline. It exists to tune platformer feel with deterministic replay and trace evidence.

## Running the Lab

Open `godot/project.godot` in Godot and run the main scene. The main scene is `res://scenes/Main.tscn`, and the standalone controller lab scene is `res://levels/controller_lab.tscn`.

The lab contains a player, a long floor, a ledge for coyote time checks, and a small platform for jump buffer checks. Use it to review controller changes before applying movement assumptions to larger gameplay rooms.

## Controls

- Move left: Left Arrow or `A`
- Move right: Right Arrow or `D`
- Jump: Space, Up Arrow, or `W`
- Hover: hold Jump while airborne and falling

## Tuning Fields

`Player.tscn` assigns a `PlayerTuning` resource to `PlayerController.gd`. Tune these values first:

- `max_speed`: top horizontal speed.
- `ground_accel`: how quickly the player reaches target speed on the floor.
- `ground_decel`: how quickly the player stops on the floor when there is no horizontal input.
- `air_accel`: how much control the player has while airborne.
- `air_decel`: how quickly airborne horizontal speed eases when input is released.
- `jump_velocity`: initial upward jump speed.
- `gravity_up`: gravity while rising.
- `gravity_down`: gravity while falling.
- `jump_cut_multiplier`: how much upward velocity remains when jump is released early.
- `coyote_time_ms`: late-jump grace period after leaving a floor.
- `jump_buffer_ms`: early-jump grace period before touching a floor.
- `hover_gravity_scale`: gravity multiplier while hover is active.
- `hover_max_fall_speed`: maximum downward speed during hover.

## Tuning Workflow

Start with horizontal movement. Adjust `max_speed`, `ground_accel`, and `ground_decel` until ground movement feels responsive without snapping instantly to full speed.

Tune air control separately with `air_accel` and `air_decel`. Air control should be useful enough to correct jumps, but lower than ground control.

Tune jump shape with `jump_velocity`, `gravity_up`, `gravity_down`, and `jump_cut_multiplier`. A good baseline has a clean high jump when held and a visibly shorter hop when the jump button is released early.

Tune forgiveness with `coyote_time_ms` and `jump_buffer_ms`. Keep both small enough to feel intentional, but large enough to remove common missed inputs around platform edges and landings.

Tune hover last. Hold jump while falling and adjust `hover_gravity_scale` and `hover_max_fall_speed` until descent feels controlled without erasing the need to land.

## Trace Hooks

`PlayerController.gd` emits lightweight `trace_event` signals for spawn, jump start, jump cut, hover start/end, and landing. `godot/tests/run_replay.gd` also records `player.sampled` during scene replays so movement tuning can be compared frame by frame.

Use the canonical replay and summary commands:

```bash
npm run godot:replay -- --replay res://tests/replays/controller_lab_jump.json --out /tmp/fake-kirdy-controller-lab.ndjson
npm run trace:summary -- /tmp/fake-kirdy-controller-lab.ndjson
```

The summary includes `player_motion` with sample count, min/max position, max absolute velocity, max falling speed, and max rising speed. These metrics make controller changes reviewable without relying only on subjective feel.

When tuning, note which trace events changed and why. Good controller changes should explain the movement feel improvement and preserve deterministic event timing where practical.

## docs/godot-v2/replay-and-trace.md

# Godot v2 Replay And Trace

Replay and trace are the first tools for making movement feel observable. The goal is to let agents and humans compare what happened in the controller lab without relying only on subjective feel.

This is a minimal foundation. It is ready for headless execution, but Godot remains optional for the repository test suite.

## Optional Headless Command

From the repository root:

```bash
godot --headless --path godot --script tests/run_replay.gd -- --replay res://tests/replays/controller_lab_jump.json --out user://controller_lab_jump.ndjson
```

`npm test` does not require Godot. Static Vitest coverage checks the replay and trace structure until a Godot binary is available in CI.

## Replay Suite

The canonical representative suite is `godot/tests/replay_suite.json`. It groups the current playable Godot mainline checks: controller/combat flow, hub heal and dead-end max-health flow, revive flow, generated reliquary chains, generated goal paths, and the minimal game-over path.

List the suite without launching Godot:

```bash
npm run godot:replay-suite -- --list
```

Filter the suite to a focused fixture id or id substring:

```bash
npm run godot:replay-suite -- --filter flat_room_fall_recovery
```

Run every replay and write per-replay NDJSON traces:

```bash
npm run godot:replay-suite
```

Use an explicit output directory when comparing traces across tuning changes:

```bash
npm run godot:replay-suite -- --out-dir /tmp/fake-kirdy-replay-suite
```

The command skips gracefully when Godot is not installed. When Godot is available, it runs each replay headlessly, summarizes each trace with `npm run trace:summary`, checks the expected outcome, required `expected_events`, blocked `forbidden_events`, ordered `expected_event_sequence`, and prints one aggregate JSON result. The suite includes `controller_lab_jump` so controller tuning changes always have movement trace coverage alongside combat, door, content, and outcome coverage.

## Replay Schema

Sample replay: `godot/tests/replays/controller_lab_jump.json`.

```json
{
  "scene_path": "res://levels/controller_lab.tscn",
  "level_id": "controller_lab",
  "fps": 60,
  "max_frames": 150,
  "frames": [
    {
      "frame": 12,
      "actions": {
        "move_right": true,
        "jump": true
      }
    }
  ]
}
```

Frames are sparse keyframes. Action state persists until a later frame changes it, so short replays can describe long holds without repeating every frame.

Session replays can seed state before the first frame with `start_level_id`, `start_spawn_id`, `initial_ability_type`, `initial_item_ids`, `initial_player_max_hp`, and `initial_player_hp`. Use those fields only for focused route, lock, combat, or save fixtures where replaying the full prerequisite path would make the check noisy.

## Trace Schema

`TraceRecorder.gd` writes JSON or NDJSON. Use `.ndjson` output for streaming-friendly traces and `.json` output for a single JSON array.

Each event uses this shape:

```json
{
  "frame": 42,
  "time_ms": 700,
  "event_type": "player.jump.started",
  "level_id": "controller_lab",
  "player": {
    "position": { "x": 128.0, "y": 240.0 },
    "velocity": { "x": 60.0, "y": -320.0 }
  },
  "payload": {}
}
```

The runner always records `run.finished` at the end of a successful replay. Failures record `replay.error` with a payload message. Hidden exploration flows emit `hidden.discovered` before a hidden collectible can be collected or a hidden door can transition.

Session replays normally stop once `GameSession.is_finished()` becomes true. A replay can opt into post-result input by setting `continue_after_finished: true`; this is used for result menu flows such as `game_over_restart_option.json`.

Stage fall recovery is also replay-backed. `flat_room_fall_recovery.json` starts outside the safe floor, emits `player.fall.recovered`, returns Kirdy to the level's default spawn, and then emits `player.jump.started` from later replay input. This proves the player can recover from a stage-edge fall and continue playing instead of remaining out of bounds.

`npm run trace:summary -- <trace>` extracts run metrics for agent review, including event counts, visited levels, outcome, collected collectible ids, acquired item ids from pickup, save, and `inventory.updated` events, completed levels, saved visited level ids, unlocked door ids, explored tiles by level, explored tile count, `player_motion`, the last saved player position, the last saved ability type, the last saved settings payload, the latest inventory/progress payload as `last_inventory`, the last saved revive count, the latest HUD payload as `last_hud`, the latest result overlay payload as `last_result_overlay`, the latest dedicated ResultsScene payload as `last_results_scene`, acquired abilities, and used abilities.

`player_motion` is built from every trace event that contains a player position or velocity. It reports sample count, min/max player position, max absolute velocity per axis, max falling speed, and max rising speed. Use it to compare controller tuning changes such as acceleration, jump cut, hover descent, and landing behavior between replay runs.

## Agent Usage

Agents should compare trace output before and after movement tuning changes. Useful checks include:

- Did `player.jump.started` happen on the expected buffered or coyote frame?
- Did `player.jump.cut` happen after jump release?
- Did `player.hover.started` and `player.hover.ended` bracket the intended falling window?
- Did `player.landed` happen at the expected position and velocity?
- Did the replay end with `run.finished` instead of `replay.error`?

Keep replay additions small. A replay should isolate one movement question, such as jump height, coyote time, jump buffer, or hover descent.

## docs/godot-v2/level-lab.md

# Godot v2 Level Lab

The Level Lab keeps gameplay metadata in editor-placeable marker nodes and TileMap metadata in a small editor-visible script. The goal is to make Godot levels editable in the Godot editor without hard-coding spawn, door, goal, heal, enemy, collectible, hazard, ability gate, tile grid, or camera-bound positions in gameplay code.

The current mainline has both hand-authored scenes and generated schema rooms. This lab defines the marker contract shared by both paths; it is not a place to hard-code level topology in session or controller scripts.

## Test Levels

The first test levels live in `godot/levels/`:

- `flat_room.tscn`: simple floor, player spawn, goal, and camera bounds.
- `jump_room.tscn`: floor, platforms, player spawn, heal marker, metadata-only enemy spawn marker, goal, and camera bounds.
- `door_room.tscn`: simple floor, player spawn, door marker, goal, and camera bounds.

## Marker Nodes

Create marker nodes as `Node2D` children in a level scene and attach the matching script from `res://scripts/level/markers/`.

- `PlayerSpawn`: sets a spawn id and facing direction.
- `DoorMarker`: sets a door id, target level id, and target spawn id.
- `EnemySpawnMarker`: records metadata for a future enemy spawn.
- `HealMarker`: records metadata for a future heal pickup.
- `CollectibleMarker`: records collectible or relic metadata, including a stable collectible id and item id.
- `GoalMarker`: marks a level completion or test objective point.
- `CameraBoundsMarker`: records the intended camera bounds center and size.

Each marker implements `to_level_marker()`. `LevelLoader.gd` scans the scene tree and builds a `LevelDefinition` from those marker nodes.

## TileMap Metadata

Use `LevelTileMap` on TileMap nodes that represent the room grid. It exposes:

- `metadata_tile_size`: tile dimensions for importer and map-system comparisons.
- `columns` and `rows`: intended room grid size.
- `collision_source`: where collision currently comes from, such as `static_body` while transitional rooms still use simple bodies.

`LevelTileMap` implements `to_level_tilemap()`, and `LevelLoader.gd` stores those entries in `LevelDefinition.tilemaps`. This keeps TileMap layout metadata next to the editor-authored scene instead of in session or player code.

## Editor Workflow

1. Open `godot/project.godot` in the Godot editor.
2. Duplicate one of the test levels or create a new `Node2D` scene under `res://levels/`.
3. Add simple `StaticBody2D` geometry for the room.
4. Add or select a `TileMap` node and attach `LevelTileMap` if the room needs grid metadata.
5. Add marker nodes as `Node2D` children and attach the marker scripts.
6. Move marker nodes in the editor to change gameplay metadata placement.
7. Edit exported TileMap and marker fields in the inspector.
8. Save the scene and run a static test or headless smoke before review.

Do not put spawn, door, or goal coordinates into `PlayerController.gd`. Do not add topology or generated-room policy directly in this lab; keep that data in the catalog, manifest, generated schema, or marker-authored scenes.

## Loader Contract

`LevelLoader.gd` should be used by future scene orchestration code to call `build_level_definition(root, level_id)`. The resulting `LevelDefinition` groups discovered metadata into:

- `player_spawns`
- `doors`
- `enemy_spawns`
- `heals`
- `collectibles`
- `goals`
- `camera_bounds`
- `tilemaps`

The current lab proves metadata discovery plus session consumption for doors, enemies, heals, collectibles, goals, hazards, ability gates, camera bounds, and trace events. Future PRs should keep new placement metadata observable through `LevelDefinition` and replay traces.

## docs/godot-v2/door-transition-flow.md

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