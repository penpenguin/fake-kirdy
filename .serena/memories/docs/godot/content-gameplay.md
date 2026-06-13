# Godot Content And Gameplay Docs Snapshot

Imported from:
- `docs/godot-v2/content-migration.md`
- `docs/godot-v2/procedural-level-generation.md`
- `docs/godot-v2/combat-slice.md`
- `docs/godot-v2/session-outcomes.md`

## docs/godot-v2/content-migration.md

# Content Migration

This document tracks the current canonical Godot content. The full stage topology is now covered by either hand-authored Godot scenes or generated schema, but most procedural rooms still use simple generated layouts rather than final authored room art.

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

`central_hub_to_heal_goal.json` is the first replay that starts from the representative hub, enters a branch room, collects a heal, and finishes at a goal. `central_hub_dead_end_max_health.json` validates the manifest-derived hub dead-end max-health reward through `heal.collected` and `player.max_hp_increased`. `revive_room_revive_then_game_over.json` validates the `revive` reward path through `player.revive_acquired`, `player.revived`, and final `game.over`. `ice_area_return_hub.json` loads a migrated branch room directly and walks back through its return door to the hub, giving the branch scene set at least one headless load/transition fixture. `mirror_to_goal_sanctum_locked_without_keystone.json` loads `mirror_corridor` and proves the direct final gate now emits `door.locked` until the cave Keystone is collected. `sky_sanctum_to_goal_finish.json` loads the migrated sky hub and finishes through the goal path. `labyrinth_001_return_forest.json` loads the first procedural representative room and returns to `forest_area`. The `*_reliquary_collectible.json` replays load each reliquary representative and emit `collectible.collected` for their keystone ids. `flying_enemy_release_swallow_goal.json` covers the second combat enemy type and proves `enemy.released` remains traceable before a later swallow/ability finish.

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
- `migration_status`: whether the level is `representative`, `test`, or another catalog-specific migration state.

This is the first schema/importer boundary: new representative levels should be added to the source map and regenerated instead of hard-coded into `LevelLoader.gd`. `npm run check:godot` runs `npm run godot:stage-manifest -- --check`, `npm run godot:procedural-levels -- --check`, `npm run godot:catalog -- --check`, and `npm run godot:content-check`, so stale manifests, stale procedural schema, stale catalogs, missing scene door markers, missing canonical stage mappings, or unresolved generated neighbor targets fail validation. The content checker currently validates all 146 canonical stage ids and all generated neighbor edges against either hand-authored Godot scenes or generated schema.

For `central_hub`, the catalog generator validates `stage_id: central-hub`, representative neighbor targets, and `expected_dead_end_rewards: ["health", "max-health"]` through `stage_manifest.json`. The five branch rooms also validate their canonical stage ids, explicit return/forward neighbor strings where they are durable literals, and selected `metadata` fields such as `cluster` and `difficulty`. Reliquary mappings validate `expected_collectibles` for all four current keystones, and `labyrinth_001` validates its representative procedural `health` dead-end reward. This keeps the Godot representative hub tied to the canonical door graph while richer generated room art is still pending.

`scripts/check-godot-content-migration.mjs` checks both scene-authored and generated topology. For every mapped canonical neighbor edge where both endpoints have Godot scene levels, the source scene must contain a `DoorMarker.target_level_id` for the mapped Godot target. For generated rooms, every schema neighbor must resolve to either another generated level id or a hand-authored catalog level id. Any canonical stage id missing from both the catalog and generated schema fails validation.

## Canonical Reference Data

The Godot mainline now uses checked-in canonical data rather than legacy source paths:

- `godot/levels/stage_manifest.json` defines the hub role, branch directions, branch identities, metadata, return edges, sky-cluster edges, goal destination, collectible/reliquary targets, and generated procedural topology.
- `docs/map-structure.md`, `docs/README.md`, and the Godot docs in this directory describe maze exploration, dead-end heals, collectibles, goal flow, replay/trace evidence, and current validation commands.
- `godot/levels/generated/procedural_levels.json` receives all generated `labyrinth-*` ids from `stage_manifest.json`, including representative `health`, `max-health`, and `revive` dead-end reward metadata. Generated `runtime_layout.content.heals` preserves those rewards as marker `reward_type` values instead of flattening them into a generic heal. The Godot runtime still only has a hand-authored scene for `labyrinth_001`, but generated-only rooms such as `labyrinth_002`, `labyrinth_003`, `labyrinth_004`, `labyrinth_005`, `labyrinth_006`, `labyrinth_010`, `labyrinth_029`, `labyrinth_032`, `labyrinth_047`, `labyrinth_050`, `labyrinth_051`, and `labyrinth_132` can now be loaded by `LevelLoader.gd` from schema data. `runtime_layout` now owns generated placement metadata, including route variants and enemy/heal/collectible/goal marker payloads, so future layout variation does not require editing GDScript constants.

## Next Content Steps

Remaining content work is primarily final audio/presentation polish and any future expansion beyond the representative Godot scene set. Generated room richness and representative hand-authored pacing now have checked-in contracts.

## docs/godot-v2/procedural-level-generation.md

# Procedural Level Generation

Godot is now the canonical runtime. The procedural expanse chain is handled in two layers:

- `godot/levels/stage_manifest.json` records canonical stage ids and topology, including `labyrinth-001` through `labyrinth-132`.
- `godot/levels/generated/procedural_levels.json` converts those procedural stage ids into Godot-friendly ids and durable schema data.

Generate or verify the schema with:

```sh
npm run godot:procedural-levels
npm run godot:procedural-levels -- --check
```

`npm run check:godot` runs the `--check` form, so stale generated schema fails validation before Godot-specific checks run.

## Stage authoring workflow

Use the repository-owned data and validation loop when adding or changing playable stages. The goal is to make stage production reviewable from text files before relying on a manual Godot editor pass.

### Add an authored stage

1. Add or update the authored `.tscn` under `godot/levels/` using marker nodes for `PlayerSpawn`, `DoorMarker`, `EnemySpawn`, `HealMarker`, `CollectibleMarker`, `GoalMarker`, and `CameraBoundsMarker`.
2. Give every visible representative-route `DoorMarker` a `door_role` such as `progress`, `return`, `locked_gate`, `shortcut`, `secret`, `goal`, or `side_room`, plus a `door_label` unless it is a plain return door.
3. Register the stage in `godot/levels/level_catalog.source.json` and the canonical topology in `godot/levels/stage_manifest.json` when it belongs to the mainline graph.
4. Regenerate or check derived data with `npm run godot:stage-manifest -- --check`, `npm run godot:catalog -- --check`, and `npm run godot:scene-lint`.
5. Add a focused replay or static test when the stage changes progression, door locking, collectibles, hazards, enemies, or final route pacing.

Generated procedural stages follow the same review principle: update manifest/schema data first, run `npm run godot:procedural-levels -- --check`, then prove runtime behavior with a replay fixture when the generated room behavior changes.

## Schema

Each generated level entry contains:

- `id`: Godot level id, such as `labyrinth_001`.
- `stage_id`: canonical stage id, such as `labyrinth-001`.
- `origin`: manifest origin, currently `generated_schema` for generated procedural levels.
- `validation`: CI-facing generated metrics, including branch density, multi-shape layout counts, and branch-exit rule counts.
- `layout`: rows, columns, and tile size from the manifest.
- `runtime_layout`: canonical Godot placement data for generated rooms, including tile size, grid dimensions, room size, route variant, shape profile, camera bounds, spawn points, door points, spawn/door safety values, floor segments, generated platform geometry, branch-exit rules, and generated gameplay marker placement.
- `metadata`: durable cluster, difficulty, and index fields.
- `stage_neighbors`: canonical neighbor stage ids.
- `neighbors`: Godot id equivalents for the same topology.
- `scene_strategy`: currently `generated_schema`, meaning the level exists as canonical data but is not necessarily hand-authored as a `.tscn` scene.

## Current Boundary

Only `labyrinth_001` is currently scene-authored in Godot. The remaining generated levels are not hand-authored scenes, but `LevelLoader.gd` can now load them through a `generated_schema://<level_id>` fallback. That fallback creates a `Node2D` room with:

- a `PlayerSpawn` marker
- directional `PlayerSpawn` markers for `west`, `east`, `north`, and `south` door targets
- `DoorMarker` nodes for generated neighbors
- a `CameraBoundsMarker`
- a `LevelTileMap` metadata node
- static floor-segment geometry and schema-driven platform variants
- generated enemy, heal, collectible, and goal markers from `runtime_layout.content`

`runtime_layout.safety` records the generated door trigger radius, the minimum required distance between a target spawn and its corresponding door, and the gameplay marker safe radius around active doors. This prevents a player who just entered a generated room from immediately re-triggering the door they arrived through, and keeps generated enemies, heals, collectibles, hazards, ability gates, and goals out of the door 3x3 safety ring. The generator currently writes `door_trigger_radius: 48`, `min_spawn_door_distance: 64`, and `door_safe_radius: 96`, and Vitest checks every generated neighbor and gameplay marker against those rules.

`validation.branch_density_by_cluster` records how many generated levels in each biome contain dead-end branch metadata. The generator enforces `branch_density_minimum: 0.2`, so `npm run godot:procedural-levels -- --check` fails if any generated biome falls below 20% dead-end coverage.

`validation.multi_shape_layouts_by_shape` records generated room shape diversity. Current generated shapes include `branch_room`, `reliquary_gate`, `vertical_route`, `arena_route`, `terminal_goal`, and `single_corridor`. `runtime_layout.floor_segments` is now the authoritative floor geometry consumed by `LevelLoader.gd`, so branch rooms, reliquary approaches, vertical routes, arena routes, and terminal goal rooms no longer share the same single-floor layout.

`runtime_layout.branch_exit_rules` records route continuation, reliquary shard locks, and cluster entry Keystone expectations. `LevelLoader.gd` applies `required_item_id` from the reliquary rule to generated `DoorMarker` nodes, so generated reliquary exits require the local generated shard before the door can transition. Cluster Keystone enforcement remains session-owned through the cross-cluster door gate.

`godot/tests/replays/labyrinth_002_to_003_generated.json` is the first headless replay fixture that starts in a generated-only room and transitions into another generated-only room. This proves the schema can be loaded at runtime without adding 132 placeholder `.tscn` files.

`godot/tests/replays/labyrinth_010_generated_content.json` exercises generated content in an ice procedural room. It produces trace coverage for enemy contact damage, heal collection, player healing, generated shard collection, item acquisition, and the generated door into `ice_reliquary`.

`godot/tests/replays/labyrinth_002_to_forest_reliquary_generated_chain.json` follows the generated forest chain from `labyrinth_002` through `labyrinth_005` into the hand-authored `forest_reliquary`. This validates directional generated spawns, repeated generated room transitions, generated damage/heal events, generated shard acquisition, and the manifest-derived reliquary exit.

`godot/tests/replays/labyrinth_006_to_ice_reliquary_generated_chain.json` applies the same chain coverage to the ice cluster, ending in `ice_reliquary` with generated shard and `ice-keystone` acquisition.

`godot/tests/replays/labyrinth_029_to_fire_reliquary_generated_chain.json` applies the generated chain coverage to the fire cluster, ending in `fire_reliquary` with generated shard and `fire-keystone` acquisition.

`godot/tests/replays/labyrinth_047_to_ruins_reliquary_generated_chain.json` applies the generated chain coverage to the ruins cluster, ending in `ruins_reliquary` with generated shard and `cave-keystone` acquisition.

`godot/tests/replays/labyrinth_051_to_sky_sanctum_generated_exit.json` validates a generated sky branch exit into `sky_sanctum`, then continues through the existing hand-authored goal path into `goal_sanctum` so the trace ends with `outcome: complete`. The replay suite now requires `door.entered`, `goal.door.entered`, and `run.finished` for this path, giving the long generated-to-hand-authored cross-cluster chain explicit event coverage.

`labyrinth_132` also carries the canonical generated final boss metadata, `labyrinth_132_final_boss`, in `runtime_layout.content.enemies`. `godot:progression-solver` treats boss ids separately from ordinary enemy groups and requires the final boss id in its canonical solution before accepting the generated terminal clear.

`godot/tests/replays/labyrinth_132_generated_goal.json` validates a generated terminal room that completes through a generated `GoalMarker`, producing `run.finished` with `outcome: complete`.

The generated fallback now reads placement from `runtime_layout` instead of keeping spawn, door, floor, platform, and gameplay marker positions as scattered GDScript constants. This makes future importer work safer: layout changes can be reviewed in generated JSON, tested in Vitest, and then replayed headlessly.

Generated rooms with north or south exits now set `runtime_layout.room.variant` to `vertical_route` and receive `GeneratedPlatformVerticalLanding` plus `GeneratedPlatformVerticalStep` platforms. `runtime_layout.safety.vertical_transition` records the protected vertical spawn ids, the 72px clearance radius, a 96px maximum spawn drop distance, and the landing surface ids used to keep north/south transitions from spawning the player into an unsafe fall. This is intentionally schema-owned so future importer work can review vertical safety in JSON before touching `LevelLoader.gd`.

The rich generated-room slice is now schema-owned rather than hand-authored scene churn: topology remains generated for all 132 labyrinth rooms, while floor shapes, branch-exit rules, route objectives, vertical safety, generated content, and long representative replay coverage are validated from data.

## docs/godot-v2/combat-slice.md

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

## docs/godot-v2/session-outcomes.md

# Session Outcomes

`GameSession.gd` owns the minimal Godot mainline run outcome state. A run currently ends by reaching a `GoalMarker` or by player defeat.

## Death Flow

The player starts each replay/session with `player_max_hp`. Idle enemies can apply contact damage from `EnemySpawnMarker.contact_damage`, which is copied onto `SimpleEnemy.contact_damage` when the level loads.

Enemy spawning is capped by `GameSession.max_active_enemy_count`, currently 3. If a level contains more enemy markers than the cap, the session skips later markers and emits `enemy.spawn.skipped` so replay traces can verify the crowd-control rule.

Enemy crowding near Kirdy is also constrained. When at least two targetable enemies are within `enemy_crowd_player_radius`, `GameSession.apply_enemy_crowd_spacing()` pushes any enemy closer than `enemy_crowd_min_player_distance` back to that minimum and emits `enemy.crowd.spacing_applied` once for the level.

When contact damage is applied, the session emits:

- `player.damaged`
- `player.defeated` when HP reaches zero
- `game.over`
- `run.finished` with `outcome: game_over`

If `player_revive_count` is greater than zero when HP reaches zero, the session consumes one revive before game-over. That emits `player.revived`, restores HP to `player_max_hp`, writes save state when enabled, and lets the run continue. A later lethal hit with no revive left follows the normal game-over flow.

`danger_room_game_over.json` is the smallest replay fixture for this flow. It loads `danger_room`, moves into a high-damage enemy, and should finish with `game.over` and `run.finished`.

`game_over_restart_option.json` keeps replay input active after the first finished state with `continue_after_finished`. It presses `result_restart`, emits `run.restart.selected`, reloads the current level, restores HP, and continues until `replay.max_frames_reached` with the HUD back to `outcome: running`.

## Heal Flow

`HealMarker` metadata is consumed by `GameSession.gd`. When the player overlaps a heal marker, the session records the marker id in `consumed_heal_ids`, emits `heal.collected`, and applies the marker `reward_type`.

The current reward types are:

- `health`: restore HP by `amount`; emits `player.healed` when HP changes.
- `max-health`: increase `player_max_hp` by `amount`, heal by the same amount, emit `player.max_hp_increased`, and write the new max HP through the save path when save is enabled.
- `revive`: increase `player_revive_count` by `amount`, emit `player.revive_acquired`, and write the new revive count through the save path when save is enabled.

Enemy contact damage uses a `player_invulnerability_ms` window so a single enemy does not drain all HP every physics frame. The default recovery is now 2000ms with blinking translucent player feedback. The session emits `player.invulnerability.started` and `player.invulnerability.ended`, and the `player.damaged` payload includes `invulnerability_remaining_ms` so replay traces can prove repeated contact during the recovery window does not stack damage.

`heal_room_recover_and_goal.json` loads `heal_room`, takes one enemy contact hit, collects `heal_room_recovery`, emits `player.healed`, then reaches the goal and emits `run.finished`.

`central_hub_dead_end_max_health.json` starts at the Phaser-derived `central_hub` dead-end max-health marker, collects `central_hub_dead_end_max_health`, emits `player.max_hp_increased`, and ends by `replay.max_frames_reached`. The replay is intentionally short so it validates pickup/session/save behavior without drifting into a nearby hub door.

Dead-end reward markers can also set `dead_end_id`. Collecting such a reward emits `dead_end.completed`, records the id in session state, and updates the map feature payload so the minimap can render the completed dead end separately from ordinary heal markers.

`revive_room_revive_then_game_over.json` collects `revive_room_dead_end_revive`, emits `player.revive_acquired`, survives the first lethal enemy contact through `player.revived`, then reaches a later lethal contact and emits the normal game-over trace once the revive count is empty.

## Collectible Flow

`CollectibleMarker` metadata is also consumed by `GameSession.gd`. When the player overlaps a collectible marker, the session records the marker id in `collected_collectible_ids` and emits `collectible.collected` with both `collectible_id` and `item_id`.

The session also tracks acquired item ids in `acquired_item_ids`. A newly acquired item emits `item.acquired` with the collected item id and the sorted `items_collected` list. When `save_enabled` is true, those ids are loaded from and written to the minimal Godot save store alongside current level id, HP, max HP, completed level ids, visited level ids, unlocked door ids, explored tiles, player position, current ability type, and the minimal settings payload.

The `*_reliquary_collectible.json` replays load `forest_reliquary`, `ice_reliquary`, `fire_reliquary`, and `ruins_reliquary`, walk into the room keystone, and leave trace events that can be summarized by `npm run trace:summary`.

Cluster progression is enforced by `GameSession.get_cluster_transition_lock_reason()`. `LevelLoader.get_level_cluster()` resolves authored cluster tags and generated `metadata.cluster`, then cross-cluster door transitions require the previous cluster keystone: ice requires `forest-keystone`, fire requires `ice-keystone`, ruins requires `fire-keystone`, and sky requires `cave-keystone`. Missing requirements emit `door.locked` with `missing_cluster_keystone:<item_id>`. `central_hub_ice_gate_without_keystone.json` validates that the hub ice door remains locked before the forest keystone, while the sky generated goal replay seeds the completed keystone chain explicitly through replay `initial_item_ids`.

## Goal Flow

Goal completion remains separate: touching a `GoalMarker` emits `run.finished` with the goal metadata payload.

The canonical goal-door path uses `GoalDoorController.gd`, a thin `GoalMarker` specialization with the migrated `goal-door.webp` visual contract. `goal_sanctum.tscn` uses it for `goal_sanctum_clear`. Reaching that controller emits `goal.door.entered` before `run.finished`; both payloads include `time_ms`, `frames`, `score`, and `remaining_life_bonus` so trace review can compare the physical goal-door clear with result UI metrics.

When save is enabled, touching a `GoalMarker` also records the current level in `completed_level_ids` before `run.finished`.

Completed and game-over runs also call `ResultOverlay.set_result_state()` and emit `result.overlay.shown`. The overlay payload carries the level id, outcome, run time, frame count, collected item ids, and completed level ids. `trace:summary` exposes the latest payload as `last_result_overlay` so replay review can compare the player-facing result screen with `run.finished` and save state.

The dedicated `ResultsScene` can then be shown by pressing `result_continue` or by waiting for the automatic result delay. `results_scene_continue.json` validates the key-driven path after a completed run and emits `results.scene.shown`, which `trace:summary` exposes as `last_results_scene`.

Result menu input remains active after the full results scene is visible. `results_scene_restart.json` presses `result_continue`, then `result_restart`; the session emits `results.scene.hidden` and `run.restart.selected` before returning the HUD to `outcome: running`.

## Runtime Error Flow

If a session cannot load its requested level, `GameSession` records the existing `replay.error`, switches the outcome to `error`, and shows `ErrorOverlay.gd`. The overlay receives the requested level/spawn, a user-facing message, and retry metadata.

The same path emits `runtime.error.shown`; `trace:summary` exposes the latest payload as `last_runtime_error`. Pressing the configured `error_retry_action` records `runtime.error.retry_selected` before attempting to restart the requested session.

All flows use the same trace schema so metrics can compare completed runs, game-over runs, and replay failures without special parsing.

## HUD Flow

`HudOverlay.gd` is the first minimal player-facing HUD for the Godot mainline. `GameSession` creates it when `hud_overlay_enabled` is true and syncs level id, HP, max HP, revive count, ability type, collected item ids, and outcome.

Each meaningful HUD state change can emit `hud.updated`. `trace:summary` exposes the latest HUD payload as `last_hud`, which lets replay review compare player-facing state with save, combat, item, and outcome events.