# Godot v2 Combat Slice

The Combat Slice adds the smallest Kirdy-like loop: inhale an enemy, optionally release it, swallow it, acquire its ability type, use that ability once, and finish the room.

This is not a full enemy port. It has `SimpleEnemy` and a small `FlyingEnemy` variant selected by `EnemySpawnMarker.enemy_type`. There is no polished animation, no audio, no broad enemy roster, and only the minimal mainline HUD described in `hud-overlay.md`.

## Controls

- `inhale`: hold to capture a nearby enemy in front of the player.
- `swallow`: press while an enemy is captured to acquire its `ability_type`.
- `use_ability`: press after swallowing to emit an ability trace.

## Trace Events

The session emits:

- `enemy.captured`
- `enemy.released`
- `enemy.swallowed`
- `ability.acquired`
- `ability.used`
- `run.finished`

## Replay

Sample replays:

- `godot/tests/replays/combat_capture_swallow_goal.json`
- `godot/tests/replays/flying_enemy_release_swallow_goal.json`

Optional command:

```bash
godot --headless --path godot --script tests/run_replay.gd -- --replay res://tests/replays/combat_capture_swallow_goal.json --out /tmp/fake-kirdy-combat_capture_swallow_goal.ndjson
```

Expected flow:

1. Start in `combat_room`.
2. Hold right and inhale to capture the simple enemy.
3. Press swallow to acquire `spark`.
4. Press use ability once.
5. Reach the goal and emit `run.finished`.

The flying replay starts in `flying_combat_room`, captures `FlyingEnemy`, releases it to emit `enemy.released`, captures it again, swallows it to acquire `frost`, uses the ability once, and reaches the goal.
