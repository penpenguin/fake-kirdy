# Godot v2 Combat Slice

The Combat Slice adds the smallest Kirdy-like loop: inhale an enemy, optionally release it, swallow it, acquire its ability type, use that ability once, and finish the room.

This is not a full enemy port. It has `SimpleEnemy`, a small `FlyingEnemy` variant, and lightweight early-route archetype profiles selected by `EnemySpawnMarker.enemy_type`. `spark_wisp` uses the simple enemy scene with a bright electric tint and faster chase profile, `flying` uses `FlyingEnemy`, and `sentry` uses a heavier simple enemy profile with slower movement and higher HP. The Godot mainline now uses retained Phaser reference sprites, basic combat audio cues, and small Godot-owned visual differentiation; a broad enemy roster remains outside this slice.

Spawned enemies also receive a lightweight ability AI profile. `frost`, `fire`, and `stone` tune chase speed, detection, attack cadence, or hover behavior, and emit `enemy.ai.profile.applied` when the profile is applied.

## Controls

- `inhale`: hold to capture a nearby enemy in front of the player.
- `swallow`: press while an enemy is captured to acquire its `ability_type`.
- `swallow`: press with no captured enemy and a current ability to detach that ability and return to the base state.
- `use_ability`: press after swallowing to emit an ability trace.
- `spark` ability use also applies a short facing-direction dash, uses an `electric_burst` visual contract backed by `images/effects/inhale-sparkle.webp`, shows the attack line only for `ability_attack_effect_duration_ms`, and emits `ability.movement.applied`.
- `fire` ability use spawns an `AbilityProjectile` node, emits projectile spawn/hit trace events, and resolves damage from the projectile hit.

## Trace Events

The session emits:

- `enemy.captured`
- `enemy.released`
- `enemy.swallowed`
- `enemy.capture.cleared`
- `ability.acquired`
- `ability.detached`
- `ability.used`
- `ability.attack.visualized`
- `ability.movement.applied`
- `ability.projectile.spawned`
- `ability.projectile.hit`
- `enemy.ai.profile.applied`
- `inhale.effect.fallback`
- `enemy.feedback.shown`
- `run.finished`

## Replay

Sample replays:

- `godot/tests/replays/combat_capture_swallow_goal.json`
- `godot/tests/replays/combat_detach_ability.json`
- `godot/tests/replays/capture_defeated_enemy_auto_clear.json`
- `godot/tests/replays/fire_ability_projectile_hit.json`
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

The detach replay starts with `spark`, presses `swallow` without a captured enemy, emits `ability.detached`, and updates HUD/inventory state with an empty ability.

The fire projectile replay starts with `fire`, presses `use_ability`, spawns `AbilityProjectile`, emits `ability.projectile.spawned` and `ability.projectile.hit`, then damages the target enemy from a projectile source.

Spark is explicitly not mapped to the sword texture, spit texture, or sword/iai presentation. `PlayerController.gd` exposes `kirdy_spark_texture`, the player scene maps it to `images/characters/kirdy/kirdy-spark.webp`, and `GameSession.get_ability_profile("spark")` reports `attack_type: burst` plus `visual_effect: electric_burst`. The Spark texture is a 64x64 transparent WebP generated for this ability and covered by the asset fallback audit.

The capture-clear replay captures a ground enemy, applies replay-scoped external damage while it is held, emits `enemy.defeated`, and then clears the held enemy link through `enemy.capture.cleared`.

The inhale pull visual has a safe fallback independent of migrated effect assets. On capture, `PlayerController.show_inhale_effect_fallback()` creates or reuses a local `Line2D` named `InhaleEffectFallback` from Kirdy to the target enemy, and `GameSession` emits `inhale.effect.fallback`. Release, swallow, or capture-clear hides the fallback line.

Enemy damage now also triggers visible feedback on `SimpleEnemy.Body`: hits flash the sprite with `hit_flash_color`, and defeated enemies remain visible for `defeat_flash_ms` before hiding. `GameSession` emits `enemy.feedback.shown` with the damage, HP, defeated flag, feedback type, and flash duration so headless replays can verify the effect without image inspection.
