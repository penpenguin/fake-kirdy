import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, '..');
const godotRoot = join(repoRoot, 'godot');

const readGodotFile = (relativePath: string): string =>
  readFileSync(join(godotRoot, relativePath), 'utf8');

describe('Godot v2 representative content', () => {
  it('adds a central hub level with TileMap and marker-driven door graph metadata', () => {
    const level = readGodotFile('levels/central_hub.tscn');
    const catalog = readGodotFile('levels/level_catalog.json');

    expect(level).toContain('TileMap');
    expect(level).toContain('PlayerSpawn.gd');
    expect(level).toContain('DoorMarker.gd');
    expect(level).toContain('CameraBoundsMarker.gd');
    expect(level).toContain('target_level_id = "combat_room"');
    expect(level).toContain('target_level_id = "heal_room"');
    expect(level).toContain('target_level_id = "jump_room"');
    expect(level).toContain('target_level_id = "ice_area"');
    expect(level).toContain('target_level_id = "mirror_corridor"');
    expect(level).toContain('target_level_id = "fire_area"');
    expect(level).toContain('target_level_id = "forest_area"');
    expect(level).toContain('target_level_id = "cave_area"');
    expect(level).toContain('HealMarker.gd');
    expect(level).toContain('heal_id = "central_hub_dead_end_health"');
    expect(level).toContain('heal_id = "central_hub_dead_end_max_health"');
    expect(catalog).toContain('"central_hub"');
  });

  it('adds representative Godot rooms for the canonical central hub branch stages', () => {
    const expectedBranches = [
      ['ice_area', 'stage_manifest:ice-area'],
      ['mirror_corridor', 'stage_manifest:mirror-corridor'],
      ['fire_area', 'stage_manifest:fire-area'],
      ['forest_area', 'stage_manifest:forest-area'],
      ['cave_area', 'stage_manifest:cave-area'],
      ['goal_sanctum', 'stage_manifest:goal-sanctum'],
      ['sky_sanctum', 'stage_manifest:sky-sanctum'],
      ['starlit_keep', 'stage_manifest:starlit-keep'],
      ['aurora_spire', 'stage_manifest:aurora-spire'],
      ['labyrinth_001', 'stage_manifest:labyrinth-001'],
    ] as const;

    const catalog = JSON.parse(readGodotFile('levels/level_catalog.json')) as {
      levels?: Array<{ id?: string; source_ref?: string; tags?: string[] }>;
    };

    for (const [levelId, sourceRef] of expectedBranches) {
      const scene = readGodotFile(`levels/${levelId}.tscn`);
      const catalogEntry = catalog.levels?.find((level) => level.id === levelId);

      expect(scene).toContain('PlayerSpawn.gd');
      expect(scene).toContain('DoorMarker.gd');
      expect(scene).toContain('EnemySpawnMarker.gd');
      expect(scene).toContain('CameraBoundsMarker.gd');
      if (levelId === 'goal_sanctum') {
        expect(scene).toContain('target_level_id = "mirror_corridor"');
      } else if (levelId === 'sky_sanctum') {
        expect(scene).toContain('target_level_id = "goal_sanctum"');
        expect(scene).toContain('target_level_id = "starlit_keep"');
        expect(scene).toContain('target_level_id = "aurora_spire"');
      } else if (levelId === 'starlit_keep' || levelId === 'aurora_spire') {
        expect(scene).toContain('target_level_id = "sky_sanctum"');
      } else if (levelId === 'labyrinth_001') {
        expect(scene).toContain('target_level_id = "forest_area"');
      } else {
        expect(scene).toContain('target_level_id = "central_hub"');
      }
      expect(catalogEntry?.source_ref).toBe(sourceRef);
      expect(catalogEntry?.tags).toContain('representative');
      expect(catalogEntry?.tags).toContain('branch');
    }
  });

  it('adds pacing/layout polish metadata to representative hub, branch, and reliquary scenes', () => {
    const pacingMarker = readGodotFile('scripts/level/markers/LevelPacingMarker.gd');
    const hub = readGodotFile('levels/central_hub.tscn');
    const branchLevels = ['forest_area', 'ice_area', 'fire_area', 'cave_area', 'mirror_corridor'];
    const reliquaryLevels = ['forest_reliquary', 'ice_reliquary', 'fire_reliquary', 'ruins_reliquary'];

    expect(pacingMarker).toContain('class_name LevelPacingMarker');
    expect(pacingMarker).toContain('@export var pacing_profile');
    expect(pacingMarker).toContain('@export var critical_path_px');
    expect(pacingMarker).toContain('@export var rest_stop_count');
    expect(pacingMarker).toContain('@export var safe_spawn_radius');
    expect(pacingMarker).toContain('@export var door_preview_spacing_px');
    expect(pacingMarker).toContain('@export var encounter_budget');
    expect(pacingMarker).toContain('@export var collectible_visibility');
    expect(pacingMarker).toContain('"marker_type": "level_pacing"');

    expect(hub).toContain('LevelPacingMarker.gd');
    expect(hub).toContain('pacing_profile = "hub"');
    expect(hub).toContain('critical_path_px = 720.0');
    expect(hub).toContain('rest_stop_count = 2');
    expect(hub).toContain('safe_spawn_radius = 112.0');
    expect(hub).toContain('door_preview_spacing_px = 120.0');

    for (const levelId of branchLevels) {
      const scene = readGodotFile(`levels/${levelId}.tscn`);
      expect(scene, `${levelId} missing pacing marker`).toContain('LevelPacingMarker.gd');
      expect(scene, `${levelId} missing branch profile`).toContain('pacing_profile = "branch"');
      expect(scene, `${levelId} missing critical path budget`).toContain('critical_path_px = 560.0');
      expect(scene, `${levelId} missing spawn safety`).toContain('safe_spawn_radius = 96.0');
      expect(scene, `${levelId} missing door preview spacing`).toContain('door_preview_spacing_px = 144.0');
      expect(scene, `${levelId} missing encounter budget`).toContain('encounter_budget = 1');
    }

    for (const levelId of reliquaryLevels) {
      const scene = readGodotFile(`levels/${levelId}.tscn`);
      expect(scene, `${levelId} missing pacing marker`).toContain('LevelPacingMarker.gd');
      expect(scene, `${levelId} missing reliquary profile`).toContain('pacing_profile = "reliquary"');
      expect(scene, `${levelId} missing critical path budget`).toContain('critical_path_px = 520.0');
      expect(scene, `${levelId} missing collectible visibility`).toContain('collectible_visibility = "critical_path"');
      expect(scene, `${levelId} missing encounter budget`).toContain('encounter_budget = 1');
    }
  });

  it('adds a replay from central hub into a representative room completion path', () => {
    const replayPath = join(godotRoot, 'tests', 'replays', 'central_hub_to_heal_goal.json');

    expect(existsSync(replayPath)).toBe(true);

    const replay = JSON.parse(readFileSync(replayPath, 'utf8')) as {
      start_level_id?: string;
      max_frames?: number;
      frames?: Array<{ actions?: Record<string, boolean> }>;
    };

    expect(replay.start_level_id).toBe('central_hub');
    expect(replay.max_frames).toBeGreaterThan(180);
    expect(replay.frames?.some((frame) => frame.actions?.move_right)).toBe(true);
  });

  it('adds a replay that loads a branch room and returns to the hub', () => {
    const replayPath = join(godotRoot, 'tests', 'replays', 'ice_area_return_hub.json');

    expect(existsSync(replayPath)).toBe(true);

    const replay = JSON.parse(readFileSync(replayPath, 'utf8')) as {
      start_level_id?: string;
      max_frames?: number;
      frames?: Array<{ actions?: Record<string, boolean> }>;
    };

    expect(replay.start_level_id).toBe('ice_area');
    expect(replay.max_frames).toBeGreaterThanOrEqual(240);
    expect(replay.frames?.some((frame) => frame.actions?.move_right)).toBe(true);
  });

  it('adds a replay that proves the goal shortcut is locked without the cave keystone', () => {
    const replayPath = join(godotRoot, 'tests', 'replays', 'mirror_to_goal_sanctum_locked_without_keystone.json');

    expect(existsSync(replayPath)).toBe(true);

    const replay = JSON.parse(readFileSync(replayPath, 'utf8')) as {
      start_level_id?: string;
      max_frames?: number;
      frames?: Array<{ actions?: Record<string, boolean> }>;
    };

    expect(replay.start_level_id).toBe('mirror_corridor');
    expect(replay.max_frames).toBeGreaterThanOrEqual(90);
    expect(replay.frames?.some((frame) => frame.actions?.move_right)).toBe(true);
  });

  it('adds a replay that loads the sky sanctum and finishes through the goal path', () => {
    const replayPath = join(godotRoot, 'tests', 'replays', 'sky_sanctum_to_goal_finish.json');

    expect(existsSync(replayPath)).toBe(true);

    const replay = JSON.parse(readFileSync(replayPath, 'utf8')) as {
      start_level_id?: string;
      max_frames?: number;
      frames?: Array<{ actions?: Record<string, boolean> }>;
    };

    expect(replay.start_level_id).toBe('sky_sanctum');
    expect(replay.max_frames).toBeGreaterThanOrEqual(240);
    expect(replay.frames?.some((frame) => frame.actions?.move_right)).toBe(true);
  });

  it('adds a replay that loads the first procedural labyrinth room and returns to forest area', () => {
    const replayPath = join(godotRoot, 'tests', 'replays', 'labyrinth_001_return_forest.json');

    expect(existsSync(replayPath)).toBe(true);

    const replay = JSON.parse(readFileSync(replayPath, 'utf8')) as {
      start_level_id?: string;
      max_frames?: number;
      frames?: Array<{ actions?: Record<string, boolean> }>;
    };

    expect(replay.start_level_id).toBe('labyrinth_001');
    expect(replay.max_frames).toBeGreaterThanOrEqual(180);
    expect(replay.frames?.some((frame) => frame.actions?.move_right)).toBe(true);
  });

  it('documents the current playable content subset without migration history', () => {
    const docsPath = join(repoRoot, 'docs', 'godot-v2', 'content.md');

    expect(existsSync(docsPath)).toBe(true);

    const docs = readFileSync(docsPath, 'utf8');
    expect(docs).toContain('central_hub');
    expect(docs).toContain('ice_area');
    expect(docs).toContain('goal_sanctum');
    expect(docs).toContain('sky_sanctum');
    expect(docs).toContain('starlit_keep');
    expect(docs).toContain('aurora_spire');
    expect(docs).toContain('labyrinth_001');
    expect(docs).toContain('heal_room');
    expect(docs).toContain('central_hub_to_heal_goal.json');
    expect(docs).toContain('ice_area_return_hub.json');
    expect(docs).toContain('mirror_to_goal_sanctum_locked_without_keystone.json');
    expect(docs).toContain('sky_sanctum_to_goal_finish.json');
    expect(docs).toContain('labyrinth_001_return_forest.json');
    expect(docs).not.toContain('Content Migration');
    expect(docs).not.toContain('Phaser');
    expect(docs).not.toContain('legacy');
  });
});
