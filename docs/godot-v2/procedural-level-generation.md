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
