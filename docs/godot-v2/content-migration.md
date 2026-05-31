# Content Migration

This document tracks the current Godot content migrated from the original game intent. The full canonical stage topology is now covered by either hand-authored Godot scenes or generated schema, but most procedural rooms still use simple generated layouts rather than final authored room art.

## Current Subset

- `central_hub`: a Godot hub level inspired by the canonical `central-hub` role. It uses marker metadata for player spawn, doors, camera bounds, representative dead-end rewards, and hub pacing/layout intent, plus a `LevelTileMap`-backed `TileMap` node for editor-authored grid metadata. The current dead-end reward coverage includes manifest-derived `health` and `max-health` `HealMarker.reward_type` values.
- `ice_area`, `mirror_corridor`, `fire_area`, `forest_area`, and `cave_area`: representative Godot branch rooms for the five explicit canonical neighbors of `central-hub`. Each room has marker-authored spawn, return door, enemy spawn, camera bounds metadata, and branch pacing/layout intent. They are representative branch slices rather than bulk art ports.
- `goal_sanctum`: the first mapped non-hub destination beyond the central branch rooms. It validates the `mirror-corridor -> goal-sanctum` edge, a return door to `mirror_corridor`, a guard enemy marker, and a `GoalMarker` clear condition.
- `sky_sanctum`, `starlit_keep`, and `aurora_spire`: the first mapped sky-cluster rooms from the canonical manifest. `sky_sanctum` links back to `goal_sanctum` and sideways to both sky branch rooms; `starlit_keep` and `aurora_spire` return to `sky_sanctum`.
- `labyrinth_001`: the first representative procedural room from the canonical generated schema. It validates the `forest-area -> labyrinth-001` entry edge, a return door to `forest_area`, an enemy marker, and a dead-end-style `HealMarker`. It does not imply the full procedural chain is scene-authored yet.
- `forest_reliquary`, `ice_reliquary`, `fire_reliquary`, and `ruins_reliquary`: the first mapped reliquary stage set. They validate manifest reliquary metadata and the `forest-keystone`, `ice-keystone`, `fire-keystone`, and `cave-keystone` collectibles through `CollectibleMarker` nodes, while their dynamic west neighbors remain represented as local return doors to current representative branch/procedural rooms. Each reliquary carries pacing/layout metadata that keeps the keystone on the critical path with a single guard encounter budget.
- `heal_room`: validates enemy contact damage, `HealMarker`, recovery trace, and goal completion.
- `revive_room`: validates the Phaser dead-end `revive` reward semantics in Godot: `player.revive_acquired`, one lethal-hit recovery through `player.revived`, then normal game-over once the revive count is empty.
- `combat_room`: validates the simple ground enemy, inhale/capture/swallow, ability acquire/use, and goal completion.
- `flying_combat_room`: validates the second enemy type selected by `EnemySpawnMarker.enemy_type`, plus release, recapture, swallow, `frost` ability acquisition/use, and goal completion.
- `jump_room`: validates controller-oriented platform layout and heal marker metadata.

`central_hub_to_heal_goal.json` is the first replay that starts from the representative hub, enters a branch room, collects a heal, and finishes at a goal. `central_hub_dead_end_max_health.json` validates the manifest-derived hub dead-end max-health reward through `heal.collected` and `player.max_hp_increased`. `revive_room_revive_then_game_over.json` validates the `revive` reward path through `player.revive_acquired`, `player.revived`, and final `game.over`. `ice_area_return_hub.json` loads a migrated branch room directly and walks back through its return door to the hub, giving the branch scene set at least one headless load/transition fixture. `mirror_to_goal_sanctum_finish.json` loads `mirror_corridor`, enters `goal_sanctum`, and finishes on the migrated goal marker. `sky_sanctum_to_goal_finish.json` loads the migrated sky hub and finishes through the goal path. `labyrinth_001_return_forest.json` loads the first procedural representative room and returns to `forest_area`. The `*_reliquary_collectible.json` replays load each reliquary representative and emit `collectible.collected` for their keystone ids. `flying_enemy_release_swallow_goal.json` covers the second combat enemy type and proves `enemy.released` remains traceable before a later swallow/ability finish.

`LevelPacingMarker.gd` is the lightweight polish contract for hand-authored representative scenes. It records `pacing_profile`, `critical_path_px`, `rest_stop_count`, `safe_spawn_radius`, `door_preview_spacing_px`, `encounter_budget`, and `collectible_visibility` as marker metadata so hub, branch, and reliquary scene intent is reviewable and testable without hard-coding layout policy in `GameSession.gd`.

## Level Catalog

`godot/levels/stage_manifest.json` is the canonical checked-in stage topology manifest. `npm run godot:stage-manifest -- --check` verifies that it stays self-contained and does not depend on legacy source file paths. It records durable stage ids, origin, literal neighbor edges, dynamic neighbor expressions, layout dimensions, tile size, and metadata. It includes the full generated procedural chain `labyrinth-001` through `labyrinth-132` as manifest data. This manifest is the current importer boundary for Godot content migration data.

`godot/levels/generated/procedural_levels.json` is generated from that manifest by `npm run godot:procedural-levels`. It converts the full `labyrinth-*` chain into Godot ids such as `labyrinth_001`, preserves the original Phaser neighbor ids under `stage_neighbors`, records the Godot neighbor graph under `neighbors`, and includes `runtime_layout` placement metadata for generated rooms. These entries use `scene_strategy: generated_schema`. They are not hand-authored `.tscn` scenes, but `LevelLoader.gd` can now load them through a `generated_schema://<level_id>` fallback that creates marker nodes, generated doors, camera bounds, `LevelTileMap` metadata, static floor/platform geometry, route-variant platform geometry, and schema-driven enemy/heal/collectible/goal markers at runtime.

`godot/levels/level_catalog.source.json` is the Godot source migration map. `npm run godot:catalog` generates `godot/levels/level_catalog.json`, which is the runtime catalog loaded by `LevelLoader.gd`.

Each source entry has:

- `id`: the stable level id used by `DoorMarker.target_level_id` and replay `start_level_id`.
- `scene_path`: the Godot scene path loaded by `LevelLoader.gd`.
- `tags`: migration and gameplay tags such as `hub`, `heal`, `combat`, and `representative`.
- `source_ref`: the canonical source reference, usually `stage_manifest:<stage_id>` or a design document.
- `stage_id`: optional canonical stage id expected in `source_ref`.
- `expected_neighbors`: optional canonical neighbor target ids that must remain present in `stage_manifest.json`.
- `expected_collectibles`: optional collectible ids or item ids that must remain present in `stage_manifest.json`.
- `expected_dead_end_rewards`: optional dead-end reward types that must remain present in `stage_manifest.json`.
- `migration_status`: whether the level is `representative`, `test`, or `prototype`.

This is the first schema/importer boundary: new representative levels should be added to the source map and regenerated instead of hard-coded into `LevelLoader.gd`. `npm run check:godot` runs `npm run godot:stage-manifest -- --check`, `npm run godot:procedural-levels -- --check`, `npm run godot:catalog -- --check`, and `npm run godot:content-check`, so stale manifests, stale procedural schema, stale catalogs, missing scene door markers, missing canonical stage mappings, or unresolved generated neighbor targets fail validation. The content checker currently validates all 146 canonical stage ids and all generated neighbor edges against either hand-authored Godot scenes or generated schema.

For `central_hub`, the catalog generator validates `stage_id: central-hub`, representative neighbor targets, and `expected_dead_end_rewards: ["health", "max-health"]` through `stage_manifest.json`. The five branch rooms also validate their canonical stage ids, explicit return/forward neighbor strings where they are durable literals, and selected `metadata` fields such as `cluster` and `difficulty`. Reliquary mappings validate `expected_collectibles` for all four current keystones, and `labyrinth_001` validates its representative procedural `health` dead-end reward. This keeps the Godot representative hub tied to the canonical door graph while richer generated room art is still pending.

`scripts/check-godot-content-migration.mjs` checks both scene-authored and generated topology. For every mapped canonical neighbor edge where both endpoints have Godot scene levels, the source scene must contain a `DoorMarker.target_level_id` for the mapped Godot target. For generated rooms, every schema neighbor must resolve to either another generated level id or a hand-authored catalog level id. Any canonical stage id missing from both the catalog and generated schema fails validation.

## Canonical Reference Data

The Godot migration now uses checked-in canonical data rather than legacy source paths:

- `godot/levels/stage_manifest.json` defines the hub role, branch directions, branch identities, metadata, return edges, sky-cluster edges, goal destination, collectible/reliquary targets, and generated procedural topology.
- `docs/design.md` describes maze exploration, dead-end heals, collectibles, goal flow, and broad area count ambition.
- `godot/levels/generated/procedural_levels.json` receives all generated `labyrinth-*` ids from `stage_manifest.json`, including representative `health`, `max-health`, and `revive` dead-end reward metadata. Generated `runtime_layout.content.heals` preserves those rewards as marker `reward_type` values instead of flattening them into a generic heal. The Godot runtime still only has a hand-authored scene for `labyrinth_001`, but generated-only rooms such as `labyrinth_002`, `labyrinth_003`, `labyrinth_004`, `labyrinth_005`, `labyrinth_006`, `labyrinth_010`, `labyrinth_029`, `labyrinth_032`, `labyrinth_047`, `labyrinth_050`, `labyrinth_051`, and `labyrinth_132` can now be loaded by `LevelLoader.gd` from schema data. `runtime_layout` now owns generated placement metadata, including route variants and enemy/heal/collectible/goal marker payloads, so future layout variation does not require editing GDScript constants.

## Next Content Steps

Remaining content work is primarily final audio/presentation polish and any future expansion beyond the representative Godot scene set. Generated room richness and representative hand-authored pacing now have checked-in contracts.
