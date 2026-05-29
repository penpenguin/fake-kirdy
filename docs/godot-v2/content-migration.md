# Content Migration

This document tracks the current Godot content migrated from Phaser intent. The full Phaser stage topology is now covered by either hand-authored Godot scenes or generated schema, but most procedural rooms still use simple generated layouts rather than final authored room art.

## Current Subset

- `central_hub`: a Godot hub level inspired by the Phaser `central-hub` role. It uses marker metadata for player spawn, doors, camera bounds, and representative dead-end rewards, plus a `LevelTileMap`-backed `TileMap` node for editor-authored grid metadata. The current dead-end reward coverage includes Phaser-derived `health` and `max-health` `HealMarker.reward_type` values.
- `ice_area`, `mirror_corridor`, `fire_area`, `forest_area`, and `cave_area`: representative Godot branch rooms for the five explicit Phaser neighbors of `central-hub`. Each room has marker-authored spawn, return door, enemy spawn, and camera bounds metadata. They are intentionally simple rooms, not full layout ports.
- `goal_sanctum`: the first mapped non-hub Phaser destination beyond the central branch rooms. It validates the `mirror-corridor -> goal-sanctum` edge, a return door to `mirror_corridor`, a guard enemy marker, and a `GoalMarker` clear condition.
- `sky_sanctum`, `starlit_keep`, and `aurora_spire`: the first mapped sky-cluster rooms from the static Phaser manifest. `sky_sanctum` links back to `goal_sanctum` and sideways to both sky branch rooms; `starlit_keep` and `aurora_spire` return to `sky_sanctum`.
- `labyrinth_001`: the first representative procedural room from `legacy/phaser-reference/src/game/world/stages/procedural.ts`. It validates the `forest-area -> labyrinth-001` entry edge, a return door to `forest_area`, an enemy marker, and a dead-end-style `HealMarker`. It does not imply the full procedural chain is scene-authored yet.
- `forest_reliquary`, `ice_reliquary`, `fire_reliquary`, and `ruins_reliquary`: the first mapped reliquary stage set. They validate Phaser reliquary metadata and the `forest-keystone`, `ice-keystone`, `fire-keystone`, and `cave-keystone` collectibles through `CollectibleMarker` nodes, while their dynamic west neighbors remain represented as local return doors to current representative branch/procedural rooms.
- `heal_room`: validates enemy contact damage, `HealMarker`, recovery trace, and goal completion.
- `revive_room`: validates the Phaser dead-end `revive` reward semantics in Godot: `player.revive_acquired`, one lethal-hit recovery through `player.revived`, then normal game-over once the revive count is empty.
- `combat_room`: validates the simple ground enemy, inhale/capture/swallow, ability acquire/use, and goal completion.
- `flying_combat_room`: validates the second enemy type selected by `EnemySpawnMarker.enemy_type`, plus release, recapture, swallow, `frost` ability acquisition/use, and goal completion.
- `jump_room`: validates controller-oriented platform layout and heal marker metadata.

`central_hub_to_heal_goal.json` is the first replay that starts from the representative hub, enters a branch room, collects a heal, and finishes at a goal. `central_hub_dead_end_max_health.json` validates the Phaser-derived hub dead-end max-health reward through `heal.collected` and `player.max_hp_increased`. `revive_room_revive_then_game_over.json` validates the `revive` reward path through `player.revive_acquired`, `player.revived`, and final `game.over`. `ice_area_return_hub.json` loads a migrated Phaser branch room directly and walks back through its return door to the hub, giving the branch scene set at least one headless load/transition fixture. `mirror_to_goal_sanctum_finish.json` loads `mirror_corridor`, enters `goal_sanctum`, and finishes on the migrated goal marker. `sky_sanctum_to_goal_finish.json` loads the migrated sky hub and finishes through the goal path. `labyrinth_001_return_forest.json` loads the first procedural representative room and returns to `forest_area`. The `*_reliquary_collectible.json` replays load each reliquary representative and emit `collectible.collected` for their keystone ids. `flying_enemy_release_swallow_goal.json` covers the second combat enemy type and proves `enemy.released` remains traceable before a later swallow/ability finish.

## Level Catalog

`godot/levels/phaser_stage_manifest.json` is generated from the legacy/reference Phaser stage TypeScript files by `npm run godot:stage-manifest`. It records durable stage ids, source paths, literal neighbor edges, dynamic neighbor expressions, layout dimensions, tile size, and metadata. It now includes the full generated procedural chain `labyrinth-001` through `labyrinth-132` as manifest data. This manifest is the current importer boundary between Phaser content and Godot migration data.

`godot/levels/generated/procedural_levels.json` is generated from that manifest by `npm run godot:procedural-levels`. It converts the full `labyrinth-*` chain into Godot ids such as `labyrinth_001`, preserves the original Phaser neighbor ids under `phaser_neighbors`, records the Godot neighbor graph under `neighbors`, and includes `runtime_layout` placement metadata for generated rooms. These entries use `scene_strategy: generated_schema`. They are not hand-authored `.tscn` scenes, but `LevelLoader.gd` can now load them through a `generated_schema://<level_id>` fallback that creates marker nodes, generated doors, camera bounds, `LevelTileMap` metadata, static floor/platform geometry, route-variant platform geometry, and schema-driven enemy/heal/collectible/goal markers at runtime.

`godot/levels/level_catalog.source.json` is the Godot source migration map. `npm run godot:catalog` generates `godot/levels/level_catalog.json`, which is the runtime catalog loaded by `LevelLoader.gd`.

Each source entry has:

- `id`: the stable level id used by `DoorMarker.target_level_id` and replay `start_level_id`.
- `scene_path`: the Godot scene path loaded by `LevelLoader.gd`.
- `tags`: migration and gameplay tags such as `hub`, `heal`, `combat`, and `representative`.
- `phaser_source`: the Phaser legacy/reference file or doc that informed the Godot level.
- `phaser_stage_id`: optional Phaser `AreaDefinition.id` expected in `phaser_source`.
- `expected_neighbors`: optional Phaser neighbor target ids that must remain present in the referenced stage file.
- `expected_collectibles`: optional Phaser collectible ids or item ids that must remain present in the referenced stage file.
- `expected_dead_end_rewards`: optional Phaser dead-end reward types that must remain present in the referenced stage manifest data.
- `migration_status`: whether the level is `representative`, `test`, or `prototype`.

This is the first schema/importer boundary: new representative levels should be added to the source map and regenerated instead of hard-coded into `LevelLoader.gd`. `npm run check:godot` runs `npm run godot:stage-manifest -- --check`, `npm run godot:procedural-levels -- --check`, `npm run godot:catalog -- --check`, and `npm run godot:content-check`, so stale generated manifests, stale procedural schema, stale catalogs, missing scene door markers, missing Phaser stage mappings, or unresolved generated neighbor targets fail validation. The content checker currently validates all 146 Phaser stage ids and all generated neighbor edges against either hand-authored Godot scenes or generated schema.

For `central_hub`, the catalog generator validates `phaser_stage_id: central-hub`, representative Phaser neighbor targets, and `expected_dead_end_rewards: ["health", "max-health"]` through `phaser_stage_manifest.json`. The five branch rooms also validate their Phaser stage ids, explicit return/forward neighbor strings where they are durable literals, and selected `metadata` fields such as `cluster` and `difficulty`. Reliquary mappings validate `expected_collectibles` for all four current keystones, and `labyrinth_001` validates its representative procedural `health` dead-end reward. This keeps the Godot representative hub tied to the legacy/reference door graph while the full stage importer is still pending.

`scripts/check-godot-content-migration.mjs` checks both scene-authored and generated topology. For every mapped Phaser neighbor edge where both endpoints have Godot scene levels, the source scene must contain a `DoorMarker.target_level_id` for the mapped Godot target. For generated rooms, every schema neighbor must resolve to either another generated level id or a hand-authored catalog level id. Any Phaser stage id missing from both the catalog and generated schema fails validation.

## Phaser Reference

The Phaser version remains the legacy/reference source for full content intent:

- `legacy/phaser-reference/src/game/world/stages/central-hub.ts` defines the hub role and branch directions.
- `legacy/phaser-reference/src/game/world/stages/ice-area.ts`, `mirror-corridor.ts`, `fire-area.ts`, `forest-area.ts`, `cave-area.ts`, `goal-sanctum.ts`, `sky-sanctum.ts`, `starlit-keep.ts`, `aurora-spire.ts`, and the four `*-reliquary.ts` files define the first representative branch identities, metadata, return edges, sky-cluster edges, goal destination, and collectible/reliquary targets.
- `docs/design.md` describes maze exploration, dead-end heals, collectibles, goal flow, and broad area count ambition.
- `legacy/phaser-reference/src/game/world/stages/procedural.ts` now feeds all generated `labyrinth-*` ids into `phaser_stage_manifest.json` and then into `godot/levels/generated/procedural_levels.json`, including representative `health`, `max-health`, and `revive` dead-end reward metadata. Generated `runtime_layout.content.heals` now preserves those rewards as marker `reward_type` values instead of flattening them into a generic heal. The Godot runtime still only has a hand-authored scene for `labyrinth_001`, but generated-only rooms such as `labyrinth_002`, `labyrinth_003`, `labyrinth_004`, `labyrinth_005`, `labyrinth_006`, `labyrinth_010`, `labyrinth_029`, `labyrinth_032`, `labyrinth_047`, `labyrinth_050`, `labyrinth_051`, and `labyrinth_132` can now be loaded by `LevelLoader.gd` from schema data. `runtime_layout` now owns generated placement metadata, including route variants and enemy/heal/collectible/goal marker payloads, so future layout variation does not require editing GDScript constants. `labyrinth_010_generated_content.json` covers generated enemy contact damage, generated heal pickup, generated shard pickup, item acquisition, and the generated door into `ice_reliquary`. `labyrinth_002_to_forest_reliquary_generated_chain.json` covers a longer generated chain into the hand-authored `forest_reliquary`, including generated directional spawns and the Phaser-derived reliquary exit. `labyrinth_006_to_ice_reliquary_generated_chain.json` adds equivalent coverage for the ice cluster and `ice-keystone`. `labyrinth_029_to_fire_reliquary_generated_chain.json` and `labyrinth_047_to_ruins_reliquary_generated_chain.json` add equivalent coverage for `fire-keystone` and `cave-keystone`. `labyrinth_051_to_sky_sanctum_generated_exit.json` covers a generated sky exit into `sky_sanctum` and onward to the hand-authored goal path. `labyrinth_132_generated_goal.json` covers a generated terminal goal and `run.finished` with `outcome: complete`.

## Next Content Steps

The next migration step should enrich the generated room loader with multi-shape layouts, stronger vertical transition safety, branch-exit rules beyond the terminal void goal, and longer cross-cluster replay coverage without manually recreating every area.
