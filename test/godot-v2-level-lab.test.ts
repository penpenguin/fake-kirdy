import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, '..');
const godotRoot = join(repoRoot, 'godot');

const readGodotFile = (relativePath: string): string =>
  readFileSync(join(godotRoot, relativePath), 'utf8');

describe('Godot v2 level lab', () => {
  it('defines editor-placeable marker scripts for level metadata', () => {
    [
      'PlayerSpawn',
      'DoorMarker',
      'EnemySpawnMarker',
      'HealMarker',
      'CollectibleMarker',
      'GoalMarker',
      'CameraBoundsMarker',
    ].forEach((scriptName) => {
      const source = readGodotFile(`scripts/level/markers/${scriptName}.gd`);

      expect(source).toContain('extends Node2D');
      expect(source).toContain(`class_name ${scriptName}`);
      expect(source).toContain('to_level_marker');
      expect(source).toContain('marker_type');
      expect(source).toContain('global_position');
    });
  });

  it('defines a LevelDefinition resource and a marker-scanning LevelLoader', () => {
    const definition = readGodotFile('scripts/level/LevelDefinition.gd');
    const loader = readGodotFile('scripts/level/LevelLoader.gd');
    const tilemap = readGodotFile('scripts/level/LevelTileMap.gd');

    expect(definition).toContain('extends Resource');
    expect(definition).toContain('class_name LevelDefinition');
    expect(definition).toContain('var tilemaps');
    expect(definition).toContain('var player_spawns');
    expect(definition).toContain('var doors');
    expect(definition).toContain('var enemy_spawns');
    expect(definition).toContain('var heals');
    expect(definition).toContain('var collectibles');
    expect(definition).toContain('var goals');
    expect(definition).toContain('var camera_bounds');

    expect(loader).toContain('extends Node');
    expect(loader).toContain('class_name LevelLoader');
    expect(loader).toContain('build_level_definition');
    expect(loader).toContain('get_children');
    expect(loader).toContain('has_method("to_level_marker")');
    expect(loader).toContain('has_method("to_level_tilemap")');
    expect(loader).toContain('add_marker');
    expect(loader).toContain('add_tilemap');

    expect(tilemap).toContain('extends TileMap');
    expect(tilemap).toContain('class_name LevelTileMap');
    expect(tilemap).toContain('@export var metadata_tile_size');
    expect(tilemap).toContain('to_level_tilemap');
    expect(tilemap).toContain('tilemap');
  });

  it('captures TileMap metadata in the central hub level definition contract', () => {
    const level = readGodotFile('levels/central_hub.tscn');
    const docs = readFileSync(join(repoRoot, 'docs', 'godot-v2', 'level-lab.md'), 'utf8');

    expect(level).toContain('LevelTileMap.gd');
    expect(level).toContain('type="TileMap"');
    expect(level).toContain('metadata_tile_size = Vector2i(32, 32)');
    expect(level).toContain('columns = 29');
    expect(level).toContain('rows = 17');
    expect(docs).toContain('LevelTileMap');
    expect(docs).toContain('TileMap');
  });

  it('adds three marker-authored test levels', () => {
    ['flat_room', 'jump_room', 'door_room'].forEach((levelName) => {
      const scene = readGodotFile(`levels/${levelName}.tscn`);

      expect(scene).toContain('PlayerSpawn.gd');
      expect(scene).toContain('GoalMarker.gd');
      expect(scene).toContain('CameraBoundsMarker.gd');
      expect(scene).toContain('StaticBody2D');
      expect(scene).not.toContain('RigidBody2D');
    });

    expect(readGodotFile('levels/door_room.tscn')).toContain('DoorMarker.gd');
    expect(readGodotFile('levels/jump_room.tscn')).toContain('HealMarker.gd');
    expect(readGodotFile('levels/jump_room.tscn')).toContain('EnemySpawnMarker.gd');
  });

  it('keeps spawn, door, and goal placement in marker nodes instead of controller code', () => {
    const controller = readGodotFile('scripts/player/PlayerController.gd');
    const flatRoom = readGodotFile('levels/flat_room.tscn');
    const doorRoom = readGodotFile('levels/door_room.tscn');

    expect(controller).not.toContain('PlayerSpawn');
    expect(controller).not.toContain('DoorMarker');
    expect(controller).not.toContain('GoalMarker');
    expect(flatRoom).toContain('type="Node2D"');
    expect(flatRoom).toContain('PlayerSpawn');
    expect(flatRoom).toContain('GoalMarker');
    expect(doorRoom).toContain('DoorMarker');
  });

  it('documents level lab editor workflow', () => {
    const docsPath = join(repoRoot, 'docs', 'godot-v2', 'level-lab.md');

    expect(existsSync(docsPath)).toBe(true);

    const docs = readFileSync(docsPath, 'utf8');
    expect(docs).toContain('Level Lab');
    expect(docs).toContain('PlayerSpawn');
    expect(docs).toContain('DoorMarker');
    expect(docs).toContain('CollectibleMarker');
    expect(docs).toContain('GoalMarker');
    expect(docs).toContain('editor');
    expect(docs).toContain('Do not');
  });
});
