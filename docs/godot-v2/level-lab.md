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
