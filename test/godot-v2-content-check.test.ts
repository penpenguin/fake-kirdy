import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, '..');

describe('Godot v2 content migration checker', () => {
  it('validates mapped canonical neighbor edges against Godot DoorMarker targets', () => {
    const output = execFileSync('node', ['scripts/check-godot-content-migration.mjs'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(output).toContain('validated 20 mapped neighbor door(s)');
    expect(output).toContain('deferred 0 unmapped neighbor(s)');
    expect(output).toContain('central-hub -> ice-area maps to central_hub -> ice_area');
    expect(output).toContain('mirror-corridor -> goal-sanctum maps to mirror_corridor -> goal_sanctum');
    expect(output).toContain('goal-sanctum -> mirror-corridor maps to goal_sanctum -> mirror_corridor');
    expect(output).toContain('goal-sanctum -> sky-sanctum maps to goal_sanctum -> sky_sanctum');
    expect(output).toContain('sky-sanctum -> aurora-spire maps to sky_sanctum -> aurora_spire');
    expect(output).toContain('sky-sanctum -> starlit-keep maps to sky_sanctum -> starlit_keep');
    expect(output).toContain('forest-area -> labyrinth-001 maps to forest_area -> labyrinth_001');
    expect(output).toContain('labyrinth-001 -> forest-area maps to labyrinth_001 -> forest_area');
  });

  it('validates the full canonical stage topology against Godot scenes or generated schema', () => {
    const output = execFileSync('node', ['scripts/check-godot-content-migration.mjs'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(output).toContain('validated 146 canonical stage topology mapping(s)');
    expect(output).toContain('validated 132 generated schema level(s)');
    expect(output).toContain('validated 263 generated neighbor edge(s)');
  });

  it('is part of the canonical Godot validation command', () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.['godot:content-check']).toContain('scripts/check-godot-content-migration.mjs');
    expect(packageJson.scripts?.['check:godot']).toContain('godot:content-check');
  });
});
