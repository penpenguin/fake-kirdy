import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, '..');
const godotRoot = join(repoRoot, 'godot');

describe('Godot v2 catalog generation pipeline', () => {
  it('keeps a source migration map for generating the canonical level catalog', () => {
    const mapPath = join(godotRoot, 'levels', 'level_catalog.source.json');

    expect(existsSync(mapPath)).toBe(true);

    const source = JSON.parse(readFileSync(mapPath, 'utf8')) as {
      version?: number;
      levels?: Array<{
        id?: string;
        scene_path?: string;
        phaser_source?: string;
        phaser_stage_id?: string;
        expected_neighbors?: string[];
        expected_collectibles?: string[];
        expected_dead_end_rewards?: string[];
        expected_metadata?: Record<string, string | number | boolean>;
        migration_status?: string;
      }>;
    };

    expect(source.version).toBe(1);
    expect(source.levels?.some((level) => level.id === 'central_hub' && level.phaser_source === 'legacy/phaser-reference/src/game/world/stages/central-hub.ts')).toBe(true);
    expect(source.levels?.every((level) => typeof level.migration_status === 'string')).toBe(true);

    const centralHub = source.levels?.find((level) => level.id === 'central_hub');
    expect(centralHub?.phaser_stage_id).toBe('central-hub');
    expect(centralHub?.expected_neighbors).toEqual([
      'ice-area',
      'mirror-corridor',
      'fire-area',
      'forest-area',
      'cave-area',
    ]);
    expect(centralHub?.expected_dead_end_rewards).toEqual(['health', 'max-health']);

    const phaserStageIds = source.levels
      ?.map((level) => level.phaser_stage_id)
      .filter((stageId): stageId is string => typeof stageId === 'string');

    expect(phaserStageIds).toEqual(expect.arrayContaining([
      'central-hub',
      'ice-area',
      'mirror-corridor',
      'fire-area',
      'forest-area',
      'cave-area',
      'goal-sanctum',
      'sky-sanctum',
      'starlit-keep',
      'aurora-spire',
      'labyrinth-001',
      'forest-reliquary',
      'ice-reliquary',
      'fire-reliquary',
      'ruins-reliquary',
    ]));

    expect(source.levels?.find((level) => level.phaser_stage_id === 'ice-area')?.expected_metadata).toEqual({
      cluster: 'ice',
      difficulty: 2,
    });
    expect(source.levels?.find((level) => level.phaser_stage_id === 'fire-area')?.expected_metadata).toEqual({
      cluster: 'fire',
      difficulty: 3,
    });
    expect(source.levels?.find((level) => level.phaser_stage_id === 'goal-sanctum')?.expected_metadata).toEqual({
      cluster: 'ruins',
      difficulty: 4,
    });
    expect(source.levels?.find((level) => level.phaser_stage_id === 'sky-sanctum')?.expected_metadata).toEqual({
      cluster: 'sky',
      difficulty: 4,
    });
    expect(source.levels?.find((level) => level.phaser_stage_id === 'labyrinth-001')?.expected_metadata).toEqual({
      cluster: 'forest',
      difficulty: 2,
    });
    expect(source.levels?.find((level) => level.phaser_stage_id === 'labyrinth-001')?.expected_dead_end_rewards).toEqual([
      'health',
    ]);
    expect(source.levels?.find((level) => level.phaser_stage_id === 'forest-reliquary')?.expected_metadata).toEqual({
      cluster: 'forest',
      difficulty: 3,
    });
    expect(source.levels?.find((level) => level.phaser_stage_id === 'forest-reliquary')?.expected_collectibles).toEqual([
      'forest-keystone',
    ]);
    expect(source.levels?.find((level) => level.phaser_stage_id === 'ice-reliquary')?.expected_collectibles).toEqual([
      'ice-keystone',
    ]);
    expect(source.levels?.find((level) => level.phaser_stage_id === 'fire-reliquary')?.expected_collectibles).toEqual([
      'fire-keystone',
    ]);
    expect(source.levels?.find((level) => level.phaser_stage_id === 'ruins-reliquary')?.expected_collectibles).toEqual([
      'cave-keystone',
    ]);
  });

  it('generates the checked-in level_catalog.json from the source map', () => {
    const output = execFileSync('node', ['scripts/generate-godot-level-catalog.mjs', '--check'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(output).toContain('level_catalog.json is up to date');
    expect(output).toContain('validated 15 Phaser stage mappings');
    expect(output).toContain('validated expected_collectibles for 4 level mappings');
    expect(output).toContain('validated expected_dead_end_rewards for 2 level mappings');
    expect(output).toContain('against phaser_stage_manifest.json');
  });

  it('wires catalog generation into package validation scripts', () => {
    const manifest = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };

    expect(manifest.scripts?.['godot:catalog']).toContain('scripts/generate-godot-level-catalog.mjs');
    expect(manifest.scripts?.['check:godot']).toContain('godot:catalog');
  });
});
