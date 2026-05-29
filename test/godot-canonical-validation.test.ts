import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, '..');

describe('Godot canonical validation and legacy boundary', () => {
  it('defines a canonical validation command that includes the replay suite', () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.scripts?.['test:canonical']).toContain('npm test');
    expect(packageJson.scripts?.['test:canonical']).toContain('godot:replay-suite');
    expect(packageJson.dependencies?.phaser).toBeUndefined();
    expect(packageJson.dependencies?.['matter-js']).toBeUndefined();
    expect(packageJson.devDependencies?.vite).toBeUndefined();
  });

  it('reports that the legacy reference copy has been removed from the canonical repository', () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    expect(packageJson.scripts?.['legacy:inventory']).toContain('scripts/legacy-inventory.mjs');

    const output = execFileSync('node', ['scripts/legacy-inventory.mjs'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    const inventory = JSON.parse(output) as {
      canonical_runtime?: string;
      legacy_runtime?: {
        status?: string;
        required_by_canonical_runtime?: boolean;
        source_dirs?: string[];
        config_files?: string[];
        commands?: string[];
        dependencies?: string[];
      };
      retirement_gates?: string[];
    };

    expect(inventory.canonical_runtime).toBe('godot');
    expect(inventory.legacy_runtime?.required_by_canonical_runtime).toBe(false);
    expect(inventory.legacy_runtime?.status).toBe('removed from canonical repository');
    expect(inventory.legacy_runtime?.source_dirs).toEqual([]);
    expect(inventory.legacy_runtime?.config_files).toEqual([]);
    expect(inventory.legacy_runtime?.commands).toEqual([]);
    expect(inventory.legacy_runtime?.dependencies).toEqual([]);
    expect(existsSync(join(repoRoot, 'legacy'))).toBe(false);
    expect(inventory.retirement_gates).toEqual(
      expect.arrayContaining(['canonical replay suite passes', 'root Phaser/Vite dependencies removed']),
    );
  });

  it('documents that the legacy reference copy has been removed', () => {
    const docsPath = join(repoRoot, 'docs', 'godot-v2', 'legacy-reference-boundary.md');
    expect(existsSync(docsPath)).toBe(true);

    const docs = readFileSync(docsPath, 'utf8');
    const readme = readFileSync(join(repoRoot, 'README.md'), 'utf8');
    const agents = readFileSync(join(repoRoot, 'AGENTS.md'), 'utf8');

    expect(docs).toContain('removed from the repository');
    expect(docs).toContain('not required by the canonical runtime');
    expect(docs).toContain('Root runtime dependencies removed');
    expect(docs).toContain('retirement gates');
    expect(readme).toContain('npm run test:canonical');
    expect(readme).toContain('npm run legacy:inventory');
    expect(readme).toContain('legacy reference copy has been removed');
    expect(agents).toContain('npm run test:canonical');
    expect(agents).toContain('legacy:inventory');
    expect(agents).toContain('legacy reference copy has been removed');
  });

  it('keeps root tests limited to Godot canonical validation', () => {
    const rootTestFiles = readdirSync(join(repoRoot, 'test'))
      .filter((fileName) => fileName.endsWith('.test.ts'))
      .sort();

    expect(
      rootTestFiles.every((fileName) => fileName.startsWith('godot') || fileName === 'trace-summary.test.ts'),
    ).toBe(true);
  });
});
