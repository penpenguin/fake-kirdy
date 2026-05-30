import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

const readPackageScripts = (): Record<string, string> => {
  const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };
  return packageJson.scripts ?? {};
};

describe('Godot run command', () => {
  it('uses a project-local wrapper for the canonical run command', () => {
    const scripts = readPackageScripts();
    const readme = readFileSync(join(repoRoot, 'README.md'), 'utf8');

    expect(scripts['godot:run']).toBe('node scripts/run-godot.mjs');
    expect(scripts.dev).toBe('npm run godot:run --');
    expect(readme).toContain('GODOT_BIN');
  });

  it('reports a clear error when no Godot executable is available', () => {
    const emptyPath = mkdtempSync(join(tmpdir(), 'fake-kirdy-empty-path-'));

    try {
      const result = spawnSync(process.execPath, ['scripts/run-godot.mjs'], {
        cwd: repoRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          GODOT_BIN: '',
          PATH: emptyPath,
        },
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('[godot:run] Godot executable was not found.');
      expect(result.stderr).toContain('Set GODOT_BIN');
    } finally {
      rmSync(emptyPath, { recursive: true, force: true });
    }
  });

  it('can validate a godot4 executable without opening the editor', () => {
    const binDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-godot-bin-'));
    const fakeGodot = join(binDir, 'godot4');
    writeFileSync(fakeGodot, '#!/bin/sh\nprintf "Godot Engine v4.4.test\\n"\n');
    chmodSync(fakeGodot, 0o755);

    try {
      const result = spawnSync(process.execPath, ['scripts/run-godot.mjs', '--check'], {
        cwd: repoRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          GODOT_BIN: '',
          PATH: binDir,
        },
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('[godot:run] Godot executable available: godot4');
      expect(result.stdout).toContain('Godot Engine v4.4.test');
    } finally {
      rmSync(binDir, { recursive: true, force: true });
    }
  });
});
