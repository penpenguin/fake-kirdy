import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, '..');
const godotRoot = join(repoRoot, 'godot');

const readGodotFile = (relativePath: string): string =>
  readFileSync(join(godotRoot, relativePath), 'utf8');

describe('Godot v2 procedural runtime loading', () => {
  it('loads generated procedural schema as a LevelLoader fallback, not as hand-authored scenes', () => {
    const source = readGodotFile('scripts/level/LevelLoader.gd');

    expect(source).toContain('procedural_levels_path');
    expect(source).toContain('load_procedural_level_catalog');
    expect(source).toContain('procedural_levels');
    expect(source).toContain('create_generated_procedural_level');
    expect(source).toContain('generated_schema://');
    expect(source).toContain('get_runtime_layout');
    expect(source).toContain('runtime_layout');
    expect(source).toContain('LevelTileMapScript');
    expect(source).toContain('PlayerSpawnScript');
    expect(source).toContain('DoorMarkerScript');
    expect(source).toContain('CameraBoundsMarkerScript');
    expect(source).toContain('EnemySpawnMarkerScript');
    expect(source).toContain('HealMarkerScript');
    expect(source).toContain('CollectibleMarkerScript');
    expect(source).toContain('HazardMarkerScript');
    expect(source).toContain('AbilityGateMarkerScript');
    expect(source).toContain('GoalMarkerScript');
  });

  it('generates metadata-driven gameplay markers and platform variants for procedural rooms', () => {
    const source = readGodotFile('scripts/level/LevelLoader.gd');

    expect(source).toContain('add_generated_directional_spawns');
    expect(source).toContain('get_generated_spawn_position');
    expect(source).toContain('get_layout_vector2');
    expect(source).toContain('add_generated_platforms');
    expect(source).toContain('add_generated_content_markers');
    expect(source).toContain('runtime_layout.get("content"');
    expect(source).toContain('add_generated_enemy_marker');
    expect(source).toContain('attack_damage');
    expect(source).toContain('attack_cooldown_ms');
    expect(source).toContain('add_generated_heal_marker');
    expect(source).toContain('add_generated_collectible_marker');
    expect(source).toContain('add_generated_hazard_marker');
    expect(source).toContain('add_generated_ability_gate_marker');
    expect(source).toContain('add_generated_goal_marker');
    expect(source).toContain('generated_enemy');
    expect(source).toContain('generated_heal');
    expect(source).toContain('generated_shard');
    expect(source).toContain('generated_goal');
    expect(source).toContain('generated_hazard');
    expect(source).toContain('generated_ability_gate');
  });

  it('keeps generated procedural levels out of the scene-authored catalog until they are playable through the fallback', () => {
    const catalog = JSON.parse(readFileSync(join(godotRoot, 'levels', 'level_catalog.json'), 'utf8')) as {
      levels?: Array<{ id?: string; scene_path?: string }>;
    };
    const generated = JSON.parse(readFileSync(join(godotRoot, 'levels', 'generated', 'procedural_levels.json'), 'utf8')) as {
      levels?: Array<{ id?: string; scene_strategy?: string }>;
    };

    const catalogIds = new Set(catalog.levels?.map((level) => level.id));
    const generatedById = new Map(generated.levels?.map((level) => [level.id, level]));

    expect(catalogIds.has('labyrinth_001')).toBe(true);
    expect(catalogIds.has('labyrinth_002')).toBe(false);
    expect(generatedById.get('labyrinth_002')?.scene_strategy).toBe('generated_schema');
  });

  it('adds a headless replay fixture that loads a generated procedural room and enters another generated room', () => {
    const replayPath = join(godotRoot, 'tests', 'replays', 'labyrinth_002_to_003_generated.json');

    expect(existsSync(replayPath)).toBe(true);

    const replay = JSON.parse(readFileSync(replayPath, 'utf8')) as {
      start_level_id?: string;
      max_frames?: number;
      frames?: Array<{ frame?: number; actions?: Record<string, boolean> }>;
    };

    expect(replay.start_level_id).toBe('labyrinth_002');
    expect(replay.max_frames).toBeGreaterThanOrEqual(180);
    expect(replay.frames?.[0]?.actions?.move_right).toBe(true);
  });

  it('adds a longer headless replay fixture that follows generated procedural topology into a reliquary', () => {
    const replayPath = join(godotRoot, 'tests', 'replays', 'labyrinth_002_to_forest_reliquary_generated_chain.json');

    expect(existsSync(replayPath)).toBe(true);

    const replay = JSON.parse(readFileSync(replayPath, 'utf8')) as {
      start_level_id?: string;
      max_frames?: number;
      frames?: Array<{ frame?: number; actions?: Record<string, boolean> }>;
    };

    expect(replay.start_level_id).toBe('labyrinth_002');
    expect(replay.max_frames).toBeGreaterThanOrEqual(600);
    expect(replay.frames?.[0]?.actions?.move_right).toBe(true);
  });

  it('adds a headless replay fixture that follows the generated ice chain into the ice reliquary', () => {
    const replayPath = join(godotRoot, 'tests', 'replays', 'labyrinth_006_to_ice_reliquary_generated_chain.json');

    expect(existsSync(replayPath)).toBe(true);

    const replay = JSON.parse(readFileSync(replayPath, 'utf8')) as {
      start_level_id?: string;
      max_frames?: number;
      frames?: Array<{ frame?: number; actions?: Record<string, boolean> }>;
    };

    expect(replay.start_level_id).toBe('labyrinth_006');
    expect(replay.max_frames).toBeGreaterThanOrEqual(600);
    expect(replay.frames?.[0]?.actions?.move_right).toBe(true);
  });

  it('adds a headless replay fixture that follows the generated fire chain into the fire reliquary', () => {
    const replayPath = join(godotRoot, 'tests', 'replays', 'labyrinth_029_to_fire_reliquary_generated_chain.json');

    expect(existsSync(replayPath)).toBe(true);

    const replay = JSON.parse(readFileSync(replayPath, 'utf8')) as {
      start_level_id?: string;
      max_frames?: number;
      frames?: Array<{ frame?: number; actions?: Record<string, boolean> }>;
    };

    expect(replay.start_level_id).toBe('labyrinth_029');
    expect(replay.max_frames).toBeGreaterThanOrEqual(600);
    expect(replay.frames?.[0]?.actions?.move_right).toBe(true);
  });

  it('adds a headless replay fixture that follows the generated ruins chain into the ruins reliquary', () => {
    const replayPath = join(godotRoot, 'tests', 'replays', 'labyrinth_047_to_ruins_reliquary_generated_chain.json');

    expect(existsSync(replayPath)).toBe(true);

    const replay = JSON.parse(readFileSync(replayPath, 'utf8')) as {
      start_level_id?: string;
      max_frames?: number;
      frames?: Array<{ frame?: number; actions?: Record<string, boolean> }>;
    };

    expect(replay.start_level_id).toBe('labyrinth_047');
    expect(replay.max_frames).toBeGreaterThanOrEqual(600);
    expect(replay.frames?.[0]?.actions?.move_right).toBe(true);
  });

  it('adds a headless replay fixture that follows a generated sky branch exit into sky_sanctum', () => {
    const replayPath = join(godotRoot, 'tests', 'replays', 'labyrinth_051_to_sky_sanctum_generated_exit.json');

    expect(existsSync(replayPath)).toBe(true);

    const replay = JSON.parse(readFileSync(replayPath, 'utf8')) as {
      start_level_id?: string;
      max_frames?: number;
      frames?: Array<{ frame?: number; actions?: Record<string, boolean> }>;
    };

    expect(replay.start_level_id).toBe('labyrinth_051');
    expect(replay.max_frames).toBeGreaterThanOrEqual(180);
    expect(replay.frames?.[0]?.actions?.move_right).toBe(true);
  });

  it('adds a headless replay fixture that exercises generated enemy, heal, and collectible markers', () => {
    const replayPath = join(godotRoot, 'tests', 'replays', 'labyrinth_010_generated_content.json');

    expect(existsSync(replayPath)).toBe(true);

    const replay = JSON.parse(readFileSync(replayPath, 'utf8')) as {
      start_level_id?: string;
      max_frames?: number;
      frames?: Array<{ frame?: number; actions?: Record<string, boolean> }>;
    };

    expect(replay.start_level_id).toBe('labyrinth_010');
    expect(replay.max_frames).toBeGreaterThanOrEqual(180);
    expect(replay.frames?.[0]?.actions?.move_right).toBe(true);
  });

  it('adds a headless replay fixture that completes a generated terminal room through a generated goal marker', () => {
    const replayPath = join(godotRoot, 'tests', 'replays', 'labyrinth_132_generated_goal.json');

    expect(existsSync(replayPath)).toBe(true);

    const replay = JSON.parse(readFileSync(replayPath, 'utf8')) as {
      start_level_id?: string;
      max_frames?: number;
      frames?: Array<{ frame?: number; actions?: Record<string, boolean> }>;
    };

    expect(replay.start_level_id).toBe('labyrinth_132');
    expect(replay.max_frames).toBeGreaterThanOrEqual(120);
    expect(replay.frames?.[0]?.actions?.move_right).toBe(true);
  });
});
