# Procedural Level Generation

Godot is now the canonical runtime, but the old Phaser stage graph is still useful as migration input. The procedural expanse chain is handled in two layers:

- `godot/levels/phaser_stage_manifest.json` records Phaser/reference stage ids and topology, including `labyrinth-001` through `labyrinth-132`.
- `godot/levels/generated/procedural_levels.json` converts those procedural stage ids into Godot-friendly ids and durable schema data.

Generate or verify the schema with:

```sh
npm run godot:procedural-levels
npm run godot:procedural-levels -- --check
```

`npm run check:godot` runs the `--check` form, so stale generated schema fails validation before Godot-specific checks run.

## Schema

Each generated level entry contains:

- `id`: Godot level id, such as `labyrinth_001`.
- `phaser_stage_id`: legacy/reference id, such as `labyrinth-001`.
- `source_path`: the Phaser source that generated the stage metadata.
- `layout`: rows, columns, and tile size from the manifest.
- `runtime_layout`: canonical Godot placement data for generated rooms, including tile size, grid dimensions, room size and route variant, camera bounds, spawn points, door points, spawn/door safety values, floor geometry, generated platform geometry, and generated gameplay marker placement.
- `metadata`: durable cluster, difficulty, and index fields.
- `phaser_neighbors`: original Phaser neighbor ids.
- `neighbors`: Godot id equivalents for the same topology.
- `scene_strategy`: currently `generated_schema`, meaning the level exists as canonical data but is not necessarily hand-authored as a `.tscn` scene.

## Current Boundary

Only `labyrinth_001` is currently scene-authored in Godot. The remaining generated levels are not hand-authored scenes, but `LevelLoader.gd` can now load them through a `generated_schema://<level_id>` fallback. That fallback creates a `Node2D` room with:

- a `PlayerSpawn` marker
- directional `PlayerSpawn` markers for `west`, `east`, `north`, and `south` door targets
- `DoorMarker` nodes for generated neighbors
- a `CameraBoundsMarker`
- a `LevelTileMap` metadata node
- static floor geometry and schema-driven platform variants
- generated enemy, heal, collectible, and goal markers from `runtime_layout.content`

`runtime_layout.safety` records the generated door trigger radius and the minimum required distance between a target spawn and its corresponding door. This prevents a player who just entered a generated room from immediately re-triggering the door they arrived through. The generator currently writes `door_trigger_radius: 48` and `min_spawn_door_distance: 64`, and Vitest checks every generated neighbor against that rule.

`godot/tests/replays/labyrinth_002_to_003_generated.json` is the first headless replay fixture that starts in a generated-only room and transitions into another generated-only room. This proves the schema can be loaded at runtime without adding 132 placeholder `.tscn` files.

`godot/tests/replays/labyrinth_010_generated_content.json` exercises generated content in an ice procedural room. It produces trace coverage for enemy contact damage, heal collection, player healing, generated shard collection, item acquisition, and the generated door into `ice_reliquary`.

`godot/tests/replays/labyrinth_002_to_forest_reliquary_generated_chain.json` follows the generated forest chain from `labyrinth_002` through `labyrinth_005` into the hand-authored `forest_reliquary`. This validates directional generated spawns, repeated generated room transitions, generated damage/heal events, generated shard acquisition, and the Phaser-derived reliquary exit.

`godot/tests/replays/labyrinth_006_to_ice_reliquary_generated_chain.json` applies the same chain coverage to the ice cluster, ending in `ice_reliquary` with generated shard and `ice-keystone` acquisition.

`godot/tests/replays/labyrinth_029_to_fire_reliquary_generated_chain.json` applies the generated chain coverage to the fire cluster, ending in `fire_reliquary` with generated shard and `fire-keystone` acquisition.

`godot/tests/replays/labyrinth_047_to_ruins_reliquary_generated_chain.json` applies the generated chain coverage to the ruins cluster, ending in `ruins_reliquary` with generated shard and `cave-keystone` acquisition.

`godot/tests/replays/labyrinth_051_to_sky_sanctum_generated_exit.json` validates a generated sky branch exit into `sky_sanctum`, then continues through the existing hand-authored goal path into `goal_sanctum` so the trace ends with `outcome: complete`.

`godot/tests/replays/labyrinth_132_generated_goal.json` validates a generated terminal room that completes through a generated `GoalMarker`, producing `run.finished` with `outcome: complete`.

The generated fallback now reads placement from `runtime_layout` instead of keeping spawn, door, floor, platform, and gameplay marker positions as scattered GDScript constants. This makes future importer work safer: layout changes can be reviewed in generated JSON, tested in Vitest, and then replayed headlessly.

Generated rooms with north or south exits now set `runtime_layout.room.variant` to `vertical_route` and receive a `GeneratedPlatformVerticalStep` platform. This is intentionally small, but it proves route shape can vary from schema data without editing `LevelLoader.gd`.

Next steps are to make the generated rooms richer: multi-shape layouts, branch-exit rules beyond the current terminal void goal, and replay coverage through longer representative generated chains.
