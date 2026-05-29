import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, '..');
const godotRoot = join(repoRoot, 'godot');

const readGodotFile = (relativePath: string): string =>
  readFileSync(join(godotRoot, relativePath), 'utf8');

describe('Godot v2 canonical level catalog', () => {
  it('defines level ids, scene paths, tags, and canonical source references in JSON', () => {
    const catalogPath = join(godotRoot, 'levels', 'level_catalog.json');

    expect(existsSync(catalogPath)).toBe(true);

    const catalog = JSON.parse(readFileSync(catalogPath, 'utf8')) as {
      version?: number;
      levels?: Array<{
        id?: string;
        scene_path?: string;
        tags?: string[];
        source_ref?: string;
      }>;
    };

    expect(catalog.version).toBe(1);
    expect(Array.isArray(catalog.levels)).toBe(true);

    const byId = new Map(catalog.levels?.map((level) => [level.id, level]));
    expect(byId.get('central_hub')?.scene_path).toBe('res://levels/central_hub.tscn');
    expect(byId.get('central_hub')?.tags).toContain('hub');
    expect(byId.get('central_hub')?.source_ref).toBe('stage_manifest:central-hub');
    expect(byId.get('heal_room')?.tags).toContain('heal');
    expect(byId.get('combat_room')?.tags).toContain('combat');
  });

  it('loads level paths from the catalog instead of hard-coded level_paths entries', () => {
    const source = readGodotFile('scripts/level/LevelLoader.gd');

    expect(source).toContain('level_catalog_path');
    expect(source).toContain('load_level_catalog');
    expect(source).toContain('JSON.parse_string');
    expect(source).toContain('catalog_levels');
    expect(source).not.toContain('var level_paths: Dictionary = {');
  });

  it('documents catalog use as the next content migration interface', () => {
    const docs = readFileSync(join(repoRoot, 'docs', 'godot-v2', 'content-migration.md'), 'utf8');

    expect(docs).toContain('level_catalog.json');
    expect(docs).toContain('source_ref');
    expect(docs).toContain('schema/importer');
  });
});
