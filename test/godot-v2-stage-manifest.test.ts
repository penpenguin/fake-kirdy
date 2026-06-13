import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, '..');
const manifestPath = join(repoRoot, 'godot', 'levels', 'stage_manifest.json');

type StageManifest = {
  version?: number;
  canonical_source?: string;
  stages?: Array<{
    id?: string;
    name?: string;
    origin?: string;
    layout?: {
      rows?: number;
      columns?: number;
      tile_size?: number;
    };
    neighbors?: Record<string, string>;
    dynamic_neighbors?: Record<string, string>;
    metadata?: Record<string, string | number | boolean>;
    collectibles?: Array<{
      id?: string;
      itemId?: string;
      column?: number;
      row?: number;
    }>;
    dead_ends?: Array<{
      id?: string;
      reward?: string;
      column?: number;
      row?: number;
    }>;
  }>;
};

describe('Godot v2 canonical stage manifest', () => {
  it('validates the checked-in canonical stage manifest without legacy source', () => {
    const output = execFileSync('node', ['scripts/check-godot-stage-manifest.mjs', '--check'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(output).toContain('stage_manifest.json is up to date');
    expect(output).toContain('validated 146 stages');
    expect(existsSync(manifestPath)).toBe(true);
  });

  it('captures durable topology and metadata needed by Godot content validation', () => {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as StageManifest;
    const stages = new Map(manifest.stages?.map((stage) => [stage.id, stage]));

    expect(manifest.version).toBe(1);
    expect(manifest.canonical_source).toBe('godot/levels/stage_manifest.json');
    expect(JSON.stringify(manifest)).not.toContain('legacy/phaser-reference');
    expect(JSON.stringify(manifest)).not.toContain('source_path');
    expect(stages.get('central-hub')?.neighbors).toMatchObject({
      northwest: 'ice-area',
      north: 'mirror-corridor',
      northeast: 'fire-area',
      southeast: 'forest-area',
      southwest: 'cave-area',
    });
    expect(stages.get('central-hub')?.layout).toEqual({
      rows: 10,
      columns: 20,
      tile_size: 32,
    });
    expect(stages.get('central-hub')?.dead_ends).toEqual([
      { id: 'dead-end-0', column: 3, row: 2, reward: 'health' },
      { id: 'dead-end-1', column: 15, row: 7, reward: 'max-health' },
    ]);
    expect(stages.get('ice-area')?.neighbors?.southeast).toBe('central-hub');
    expect(stages.get('ice-area')?.dynamic_neighbors?.east).toBe('getIceExpanseEntryId()');
    expect(stages.get('forest-area')?.neighbors?.east).toBe('labyrinth-001');
    expect(stages.get('central-hub')?.origin).toBe('authored');
    expect(stages.get('labyrinth-001')?.origin).toBe('generated_schema');
    expect(stages.get('labyrinth-001')?.neighbors).toMatchObject({
      west: 'forest-area',
      east: 'labyrinth-002',
    });
    expect(stages.get('labyrinth-001')?.metadata).toMatchObject({
      cluster: 'forest',
      difficulty: 2,
    });
    expect(stages.get('labyrinth-001')?.dead_ends?.map((deadEnd) => deadEnd.reward)).toEqual([
      'health',
      'max-health',
      'revive',
    ]);
    expect(stages.get('fire-area')?.metadata).toMatchObject({
      cluster: 'fire',
      difficulty: 3,
    });
    expect(stages.get('forest-reliquary')?.collectibles).toContainEqual({
      id: 'forest-keystone',
      itemId: 'forest-keystone',
      column: 18,
      row: 3,
    });
    expect(stages.get('ice-reliquary')?.collectibles).toContainEqual({
      id: 'ice-keystone',
      itemId: 'ice-keystone',
      column: 14,
      row: 3,
    });
    expect(stages.get('fire-reliquary')?.collectibles).toContainEqual({
      id: 'fire-keystone',
      itemId: 'fire-keystone',
      column: 16,
      row: 3,
    });
    expect(stages.get('ruins-reliquary')?.collectibles).toContainEqual({
      id: 'cave-keystone',
      itemId: 'cave-keystone',
      column: 10,
      row: 3,
    });
  });

  it('exports the generated procedural area chain instead of only a single representative node', () => {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as StageManifest;
    const stages = new Map(manifest.stages?.map((stage) => [stage.id, stage]));
    const proceduralStages = manifest.stages?.filter((stage) => stage.origin === 'generated_schema') ?? [];

    expect(proceduralStages).toHaveLength(132);
    expect(stages.get('labyrinth-005')?.neighbors).toMatchObject({
      west: 'labyrinth-004',
      east: 'forest-reliquary',
    });
    expect(stages.get('labyrinth-006')?.neighbors).toMatchObject({
      west: 'ice-area',
      east: 'labyrinth-007',
    });
    expect(stages.get('labyrinth-010')?.neighbors?.east).toBe('ice-reliquary');
    expect(stages.get('labyrinth-011')?.neighbors).toMatchObject({
      east: 'labyrinth-012',
      south: 'fire-area',
    });
    expect(stages.get('labyrinth-032')?.neighbors?.east).toBe('fire-reliquary');
    expect(stages.get('labyrinth-033')?.neighbors).toMatchObject({
      east: 'labyrinth-034',
      south: 'cave-area',
    });
    expect(stages.get('labyrinth-050')?.neighbors?.east).toBe('ruins-reliquary');
    expect(stages.get('labyrinth-051')?.neighbors).toMatchObject({
      east: 'labyrinth-052',
      south: 'sky-sanctum',
    });
    expect(stages.get('labyrinth-069')?.neighbors).toMatchObject({
      east: 'labyrinth-070',
      north: 'labyrinth-068',
    });
    expect(stages.get('labyrinth-132')?.neighbors?.west).toBe('labyrinth-131');
    expect(stages.get('labyrinth-132')?.metadata).toMatchObject({
      cluster: 'void',
      index: 141,
      difficulty: 1,
    });
  });

  it('wires the manifest into canonical Godot validation', () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const catalogGenerator = readFileSync(join(repoRoot, 'scripts', 'generate-godot-level-catalog.mjs'), 'utf8');
    const docs = readFileSync(join(repoRoot, 'docs', 'godot-v2', 'procedural-level-generation.md'), 'utf8');

    expect(packageJson.scripts?.['godot:stage-manifest']).toContain('scripts/check-godot-stage-manifest.mjs');
    expect(packageJson.scripts?.['check:godot']).toContain('godot:stage-manifest');
    expect(catalogGenerator).toContain('stage_manifest.json');
    expect(docs).toContain('Stage authoring workflow');
    expect(docs).toContain('Add an authored stage');
    expect(docs).toContain('npm run godot:stage-manifest -- --check');
    expect(docs).toContain('npm run godot:catalog -- --check');
    expect(docs).toContain('npm run godot:scene-lint');
  });
});
