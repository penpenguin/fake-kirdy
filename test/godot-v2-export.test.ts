import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

const readText = (relativePath: string): string =>
  readFileSync(join(repoRoot, relativePath), 'utf8');

describe('Godot v2 export workflow', () => {
  it('defines a canonical Godot export preset for the default build path', () => {
    const presetPath = join(repoRoot, 'godot', 'export_presets.cfg');

    expect(existsSync(presetPath)).toBe(true);

    const preset = readFileSync(presetPath, 'utf8');
    expect(preset).toContain('name="Linux Headless"');
    expect(preset).toContain('platform="Linux/X11"');
    expect(preset).toContain('export_path="../dist-godot/fake-kirdy.x86_64"');
  });

  it('adds a graceful Godot export wrapper and package scripts', () => {
    const packageJson = JSON.parse(readText('package.json')) as {
      scripts?: Record<string, string>;
    };
    const script = readText('scripts/export-godot.mjs');

    expect(packageJson.scripts?.['godot:export']).toContain('scripts/export-godot.mjs');
    expect(packageJson.scripts?.['build:godot']).toBe('npm run godot:export --');
    expect(packageJson.scripts?.['build:legacy:web']).toBeUndefined();
    expect(packageJson.scripts?.build).toBe('npm run build:godot --');
    expect(packageJson.scripts?.['check:godot']).toContain('npm run godot:export -- --check');
    expect(script).toContain('export_presets.cfg');
    expect(script).toContain('Godot is not installed; skipped export');
    expect(script).toContain('export templates are not installed; skipped export');
  });

  it('can validate the export configuration without requiring export templates', () => {
    const output = execFileSync('node', ['scripts/export-godot.mjs', '--check'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(output).toContain('[godot:export]');
    expect(output).toContain('export preset available: Linux Headless');
  });

  it('forwards build:godot arguments to the export wrapper', () => {
    const output = execFileSync('npm', ['run', 'build:godot', '--', '--check'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(output).toContain('export preset available: Linux Headless');
  });

  it('forwards default build arguments to the Godot export wrapper', () => {
    const output = execFileSync('npm', ['run', 'build', '--', '--check'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(output).toContain('export preset available: Linux Headless');
  });

  it('documents the default Godot build command and the legacy web build', () => {
    const readme = readText('README.md');
    const agents = readText('AGENTS.md');
    const plan = readText('docs/godot-v2/full-migration-execplan.md');

    expect(readme).toContain('npm run godot:export');
    expect(readme).toContain('legacy/reference source');
    expect(readme).toContain('npm run build');
    expect(agents).toContain('npm run godot:export');
    expect(agents).toContain('npm run build');
    expect(plan).toContain('Godot export');
    expect(plan).toContain('default `build` command');
  });
});
