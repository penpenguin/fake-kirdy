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
