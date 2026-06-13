# Godot Content And Gameplay Docs Summary

Updated from `docs/godot-v2/content.md`, `procedural-level-generation.md`, `combat-slice.md`, and `session-outcomes.md`.

## Content

Current playable levels include:
- hub/branch/goal: `central_hub`, `ice_area`, `mirror_corridor`, `fire_area`, `forest_area`, `cave_area`, `goal_sanctum`, `sky_sanctum`, `starlit_keep`, `aurora_spire`
- generated representative: `labyrinth_001`
- reliquaries: `forest_reliquary`, `ice_reliquary`, `fire_reliquary`, `ruins_reliquary`
- focused contract rooms: `heal_room`, `revive_room`, `combat_room`, `flying_combat_room`, `jump_room`, `danger_room`, `enemy_spawn_limit_room`, `enemy_crowd_spacing_room`, `hidden_discovery_room`

Representative replay fixtures include `central_hub_to_heal_goal.json`, `central_hub_dead_end_max_health.json`, `revive_room_revive_then_game_over.json`, `ice_area_return_hub.json`, `mirror_to_goal_sanctum_locked_without_keystone.json`, `sky_sanctum_to_goal_finish.json`, `labyrinth_001_return_forest.json`, `*_reliquary_collectible.json`, and `flying_enemy_release_swallow_goal.json`.

## Catalog And Generated Schema

`level_catalog.source.json` generates `level_catalog.json`; entries use `id`, `scene_path`, `tags`, `coverage_status`, `source_ref`, `stage_id`, `expected_neighbors`, `expected_collectibles`, and `expected_dead_end_rewards`.

`procedural_levels.json` defines `labyrinth_001` through `labyrinth_132` with topology, cluster metadata, dimensions, floor/platform geometry, camera bounds, spawn/door points, safety radii, branch rules, and gameplay marker payloads.

`LevelLoader.gd` materializes generated schema rooms with marker nodes, `LevelTileMap`, static geometry, enemies, heals, collectibles, hazards, ability gates, dead-end rewards, and terminal goals.

## Procedural Rules

Use:
```bash
npm run godot:procedural-levels
npm run godot:procedural-levels -- --check
```

Generated schema records branch density by cluster, room shape diversity, floor segments, branch exit rules, vertical transition safety, and generated content placement. Key replay fixtures cover generated-only room transitions, generated content, reliquary chains, sky exit to hand-authored goal path, and `labyrinth_132` terminal completion.

## Combat

Core loop: inhale, optional release, swallow, acquire ability type, use ability, and finish the room. Enemy types include `SimpleEnemy`, `FlyingEnemy`, `spark_wisp`, `flying`, and `sentry`. Ability AI profiles tune `frost`, `fire`, and `stone` enemies.

Combat trace events include `enemy.captured`, `enemy.released`, `enemy.swallowed`, `enemy.capture.cleared`, `ability.acquired`, `ability.detached`, `ability.used`, `ability.attack.visualized`, `ability.movement.applied`, `ability.projectile.spawned`, `ability.projectile.hit`, `enemy.ai.profile.applied`, `inhale.effect.fallback`, `enemy.feedback.shown`, and `run.finished`.

## Session Outcomes

`GameSession.gd` owns run outcome state. Death flow emits `player.damaged`, `player.defeated`, `game.over`, and `run.finished` with `outcome: game_over`. Revives emit `player.revive_acquired` and `player.revived`.

Heals use `HealMarker.reward_type`: `health`, `max-health`, or `revive`. Collectibles emit `collectible.collected` and `item.acquired`. Cross-cluster doors require keystones and emit `door.locked` when requirements are missing.

Goal completion emits `run.finished`; the goal-door path also emits `goal.door.entered` with score/time metrics. Runtime load failures emit `runtime.error.shown` and appear as `last_runtime_error` in `trace:summary`.