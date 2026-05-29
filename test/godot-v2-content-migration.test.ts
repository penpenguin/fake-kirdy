import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, '..');
const godotRoot = join(repoRoot, 'godot');

const readGodotFile = (relativePath: string): string =>
  readFileSync(join(godotRoot, relativePath), 'utf8');

describe('Godot v2 representative content migration', () => {
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

  it('adds representative Godot rooms for the Phaser central hub branch stages', () => {
    const expectedBranches = [
      ['ice_area', 'legacy/phaser-reference/src/game/world/stages/ice-area.ts'],
      ['mirror_corridor', 'legacy/phaser-reference/src/game/world/stages/mirror-corridor.ts'],
      ['fire_area', 'legacy/phaser-reference/src/game/world/stages/fire-area.ts'],
      ['forest_area', 'legacy/phaser-reference/src/game/world/stages/forest-area.ts'],
      ['cave_area', 'legacy/phaser-reference/src/game/world/stages/cave-area.ts'],
      ['goal_sanctum', 'legacy/phaser-reference/src/game/world/stages/goal-sanctum.ts'],
      ['sky_sanctum', 'legacy/phaser-reference/src/game/world/stages/sky-sanctum.ts'],
      ['starlit_keep', 'legacy/phaser-reference/src/game/world/stages/starlit-keep.ts'],
      ['aurora_spire', 'legacy/phaser-reference/src/game/world/stages/aurora-spire.ts'],
      ['labyrinth_001', 'legacy/phaser-reference/src/game/world/stages/procedural.ts'],
    ] as const;

    const catalog = JSON.parse(readGodotFile('levels/level_catalog.json')) as {
      levels?: Array<{ id?: string; phaser_source?: string; tags?: string[] }>;
    };

    for (const [levelId, phaserSource] of expectedBranches) {
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
      expect(catalogEntry?.phaser_source).toBe(phaserSource);
      expect(catalogEntry?.tags).toContain('representative');
      expect(catalogEntry?.tags).toContain('phaser_branch');
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

  it('adds a replay that loads a migrated Phaser branch room and returns to the hub', () => {
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

  it('adds a replay that reaches the migrated goal sanctum and finishes the run', () => {
    const replayPath = join(godotRoot, 'tests', 'replays', 'mirror_to_goal_sanctum_finish.json');

    expect(existsSync(replayPath)).toBe(true);

    const replay = JSON.parse(readFileSync(replayPath, 'utf8')) as {
      start_level_id?: string;
      max_frames?: number;
      frames?: Array<{ actions?: Record<string, boolean> }>;
    };

    expect(replay.start_level_id).toBe('mirror_corridor');
    expect(replay.max_frames).toBeGreaterThanOrEqual(180);
    expect(replay.frames?.some((frame) => frame.actions?.move_right)).toBe(true);
  });

  it('adds a replay that loads the migrated sky sanctum and finishes through the goal path', () => {
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

  it('documents the current representative content migration subset', () => {
    const docsPath = join(repoRoot, 'docs', 'godot-v2', 'content-migration.md');

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
    expect(docs).toContain('mirror_to_goal_sanctum_finish.json');
    expect(docs).toContain('sky_sanctum_to_goal_finish.json');
    expect(docs).toContain('labyrinth_001_return_forest.json');
    expect(docs).toContain('Phaser');
  });
});
