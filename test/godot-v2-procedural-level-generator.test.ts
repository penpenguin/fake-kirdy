import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, '..');
const proceduralLevelsPath = join(repoRoot, 'godot', 'levels', 'generated', 'procedural_levels.json');

type ProceduralLevelExport = {
  version?: number;
  generated_from?: string;
  levels?: Array<{
    id?: string;
    stage_id?: string;
    scene_strategy?: string;
    layout?: {
      rows?: number;
      columns?: number;
      tile_size?: number;
    };
    runtime_layout?: {
      tile_size?: { x?: number; y?: number };
      grid?: { columns?: number; rows?: number };
      room?: { width?: number; height?: number; variant?: string };
      camera_bounds?: { position?: { x?: number; y?: number }; size?: { x?: number; y?: number } };
      spawns?: Record<string, { x?: number; y?: number }>;
      doors?: Record<string, { x?: number; y?: number }>;
      safety?: {
        door_trigger_radius?: number;
        min_spawn_door_distance?: number;
      };
      platforms?: Array<{ id?: string; position?: { x?: number; y?: number }; size?: { x?: number; y?: number } }>;
      content?: {
        enemies?: Array<{
          id?: string;
          spawn_id?: string;
          enemy_type?: string;
          ability_type?: string;
          contact_damage?: number;
          position?: { x?: number; y?: number };
        }>;
        heals?: Array<{
          id?: string;
          heal_id?: string;
          amount?: number;
          reward_type?: string;
          position?: { x?: number; y?: number };
        }>;
        collectibles?: Array<{
          id?: string;
          collectible_id?: string;
          item_id?: string;
          trigger_radius?: number;
          position?: { x?: number; y?: number };
        }>;
        goals?: Array<{
          id?: string;
          goal_id?: string;
          result_label?: string;
          trigger_radius?: number;
          position?: { x?: number; y?: number };
        }>;
      };
    };
    metadata?: Record<string, string | number | boolean>;
    stage_neighbors?: Record<string, string>;
    neighbors?: Record<string, string>;
  }>;
};

describe('Godot v2 procedural level schema generation', () => {
  it('generates a checked-in Godot schema for every Phaser procedural stage', () => {
    const output = execFileSync('node', ['scripts/generate-godot-procedural-levels.mjs', '--check'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(output).toContain('procedural_levels.json is up to date');
    expect(output).toContain('exported 132 procedural levels');
    expect(existsSync(proceduralLevelsPath)).toBe(true);
  });

  it('maps Phaser procedural topology into Godot level ids without requiring hand-authored scenes', () => {
    const generated = JSON.parse(readFileSync(proceduralLevelsPath, 'utf8')) as ProceduralLevelExport;
    const levels = new Map(generated.levels?.map((level) => [level.id, level]));

    expect(generated.version).toBe(1);
    expect(generated.generated_from).toBe('godot/levels/stage_manifest.json');
    expect(generated.levels).toHaveLength(132);

    expect(levels.get('labyrinth_001')).toMatchObject({
      stage_id: 'labyrinth-001',
      scene_strategy: 'generated_schema',
      layout: {
        rows: 12,
        columns: 18,
        tile_size: 32,
      },
      metadata: {
        cluster: 'forest',
        difficulty: 2,
      },
      stage_neighbors: {
        west: 'forest-area',
        east: 'labyrinth-002',
      },
      neighbors: {
        west: 'forest_area',
        east: 'labyrinth_002',
      },
    });

    expect(levels.get('labyrinth_005')?.neighbors?.east).toBe('forest_reliquary');
    expect(levels.get('labyrinth_006')?.neighbors).toMatchObject({
      west: 'ice_area',
      east: 'labyrinth_007',
    });
    expect(levels.get('labyrinth_010')?.neighbors?.east).toBe('ice_reliquary');
    expect(levels.get('labyrinth_033')?.neighbors?.south).toBe('cave_area');
    expect(levels.get('labyrinth_050')?.neighbors?.east).toBe('ruins_reliquary');
    expect(levels.get('labyrinth_051')?.neighbors?.south).toBe('sky_sanctum');
    expect(levels.get('labyrinth_069')?.neighbors?.north).toBe('labyrinth_068');
    expect(levels.get('labyrinth_132')?.neighbors?.west).toBe('labyrinth_131');
  });

  it('exports runtime layout metadata for generated rooms instead of leaving placement in GDScript constants', () => {
    const generated = JSON.parse(readFileSync(proceduralLevelsPath, 'utf8')) as ProceduralLevelExport;
    const levels = new Map(generated.levels?.map((level) => [level.id, level]));
    const iceRoom = levels.get('labyrinth_010');
    const terminalRoom = levels.get('labyrinth_132');

    expect(iceRoom?.runtime_layout).toMatchObject({
      tile_size: { x: 32, y: 32 },
      grid: { columns: 18, rows: 12 },
      room: { width: 760, height: 432 },
      camera_bounds: {
        position: { x: 380, y: 270 },
        size: { x: 840, y: 540 },
      },
      spawns: {
        default: { x: 96, y: 368 },
        west: { x: 112, y: 368 },
        east: { x: 624, y: 368 },
      },
      doors: {
        west: { x: 16, y: 368 },
        east: { x: 704, y: 368 },
      },
      safety: {
        door_trigger_radius: 48,
        min_spawn_door_distance: 64,
      },
    });
    expect(iceRoom?.runtime_layout?.platforms?.map((platform) => platform.id)).toEqual([
      'GeneratedPlatformLow',
      'GeneratedPlatformHigh',
    ]);
    expect(terminalRoom?.runtime_layout?.platforms?.map((platform) => platform.id)).toEqual([]);
  });

  it('exports generated gameplay marker placement in runtime layout metadata', () => {
    const generated = JSON.parse(readFileSync(proceduralLevelsPath, 'utf8')) as ProceduralLevelExport;
    const levels = new Map(generated.levels?.map((level) => [level.id, level]));
    const iceRoom = levels.get('labyrinth_010');
    const terminalRoom = levels.get('labyrinth_132');

    expect(iceRoom?.runtime_layout?.content).toMatchObject({
      enemies: [
        {
          id: 'GeneratedEnemySpawn',
          spawn_id: 'labyrinth_010_generated_enemy',
          enemy_type: 'generated_ground',
          ability_type: 'frost',
          contact_damage: 1,
          position: { x: 336, y: 400 },
        },
      ],
      collectibles: [
        {
          id: 'GeneratedCollectibleMarker',
          collectible_id: 'labyrinth_010_generated_shard',
          item_id: 'ice-generated-shard',
          trigger_radius: 48,
          position: { x: 592, y: 368 },
        },
      ],
      goals: [],
    });
    expect(iceRoom?.runtime_layout?.content?.heals).toEqual(expect.arrayContaining([
      {
        id: 'GeneratedHealMarkerRoute',
        heal_id: 'labyrinth_010_generated_heal',
        amount: 1,
        reward_type: 'health',
        position: { x: 456, y: 368 },
      },
      {
        id: 'GeneratedHealMarkerHealth',
        heal_id: 'labyrinth_010_dead_end_health',
        amount: 1,
        reward_type: 'health',
        position: { x: 80, y: 304 },
      },
      {
        id: 'GeneratedHealMarkerMaxHealth',
        heal_id: 'labyrinth_010_dead_end_max_health',
        amount: 1,
        reward_type: 'max-health',
        position: { x: 496, y: 80 },
      },
      {
        id: 'GeneratedHealMarkerRevive',
        heal_id: 'labyrinth_010_dead_end_revive',
        amount: 1,
        reward_type: 'revive',
        position: { x: 304, y: 272 },
      },
    ]));
    expect(terminalRoom?.runtime_layout?.content?.goals).toEqual([
      {
        id: 'GeneratedGoalMarker',
        goal_id: 'labyrinth_132_generated_goal',
        result_label: 'complete',
        trigger_radius: 48,
        position: { x: 224, y: 368 },
      },
    ]);
  });

  it('marks north/south procedural rooms with vertical-route layout metadata', () => {
    const generated = JSON.parse(readFileSync(proceduralLevelsPath, 'utf8')) as ProceduralLevelExport;
    const levels = new Map(generated.levels?.map((level) => [level.id, level]));
    const southExitRoom = levels.get('labyrinth_033');
    const northLinkRoom = levels.get('labyrinth_069');

    expect(southExitRoom?.neighbors?.south).toBe('cave_area');
    expect(southExitRoom?.runtime_layout?.room?.variant).toBe('vertical_route');
    expect(southExitRoom?.runtime_layout?.platforms?.map((platform) => platform.id)).toContain(
      'GeneratedPlatformVerticalStep',
    );

    expect(northLinkRoom?.neighbors?.north).toBe('labyrinth_068');
    expect(northLinkRoom?.runtime_layout?.room?.variant).toBe('vertical_route');
    expect(northLinkRoom?.runtime_layout?.platforms?.map((platform) => platform.id)).toEqual([
      'GeneratedPlatformVerticalStep',
    ]);
  });

  it('keeps generated target spawns outside their corresponding door trigger radius', () => {
    const generated = JSON.parse(readFileSync(proceduralLevelsPath, 'utf8')) as ProceduralLevelExport;
    const oppositeDirection: Record<string, string> = {
      west: 'east',
      east: 'west',
      north: 'south',
      south: 'north',
    };

    for (const level of generated.levels ?? []) {
      const layout = level.runtime_layout;
      const doorTriggerRadius = layout?.safety?.door_trigger_radius ?? 48;
      const minSpawnDoorDistance = layout?.safety?.min_spawn_door_distance ?? 0;

      expect(minSpawnDoorDistance).toBeGreaterThan(doorTriggerRadius);

      for (const direction of Object.keys(level.neighbors ?? {})) {
        const targetSpawnId = oppositeDirection[direction];
        const door = layout?.doors?.[targetSpawnId];
        const spawn = layout?.spawns?.[targetSpawnId];
        expect(door, `${level.id} missing ${targetSpawnId} door`).toBeTruthy();
        expect(spawn, `${level.id} missing ${targetSpawnId} spawn`).toBeTruthy();

        const distance = Math.hypot(Number(spawn?.x) - Number(door?.x), Number(spawn?.y) - Number(door?.y));
        expect(distance, `${level.id} ${targetSpawnId} spawn too close to door`).toBeGreaterThanOrEqual(
          minSpawnDoorDistance,
        );
      }
    }
  });

  it('wires procedural schema generation into canonical Godot validation', () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.['godot:procedural-levels']).toContain('scripts/generate-godot-procedural-levels.mjs');
    expect(packageJson.scripts?.['check:godot']).toContain('godot:procedural-levels');
  });
});
