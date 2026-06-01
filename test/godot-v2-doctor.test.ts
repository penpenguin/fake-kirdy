import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

const readPackageScripts = (): Record<string, string> => {
  const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };
  return packageJson.scripts ?? {};
};

describe('Godot doctor runtime gate', () => {
  it('defines explicit local, runtime, and full quality gates', () => {
    const scripts = readPackageScripts();

    expect(scripts['godot:doctor']).toBe('node scripts/check-godot-doctor.mjs');
    expect(scripts['check:godot:runtime']).toContain('godot:doctor');
    expect(scripts['check:godot:runtime']).toContain('--require-godot');
    expect(scripts['check:godot:runtime']).toContain('--skip-export-templates');
    expect(scripts['check:godot:runtime']).toContain('godot:replay-suite');
    expect(scripts['check:full']).toContain('check:godot');
    expect(scripts['check:full']).toContain('check:godot:runtime');
    expect(scripts['check:full']).toContain('build:public');
    expect(scripts['check:full']).toContain('godot:web-performance');
  });

  it('reports missing runtime tools as local warnings without failing', () => {
    const emptyPath = mkdtempSync(join(tmpdir(), 'fake-kirdy-empty-doctor-path-'));

    try {
      const result = spawnSync(process.execPath, ['scripts/check-godot-doctor.mjs', '--json'], {
        cwd: repoRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          CHROME_BIN: '',
          GODOT_BIN: '',
          PATH: emptyPath,
        },
      });

      expect(result.status).toBe(0);
      const report = JSON.parse(result.stdout) as {
        required: boolean;
        failed_checks: unknown[];
        checks: { godot?: { status?: string }; browser?: { status?: string } };
      };
      expect(report.required).toBe(false);
      expect(report.failed_checks).toEqual([]);
      expect(report.checks.godot?.status).toBe('warning');
      expect(report.checks.browser?.status).toBe('warning');
    } finally {
      rmSync(emptyPath, { recursive: true, force: true });
    }
  });

  it('fails when the Godot runtime is required but unavailable', () => {
    const emptyPath = mkdtempSync(join(tmpdir(), 'fake-kirdy-empty-doctor-path-'));

    try {
      const result = spawnSync(process.execPath, ['scripts/check-godot-doctor.mjs', '--require-godot', '--json'], {
        cwd: repoRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          CHROME_BIN: '',
          GODOT_BIN: '',
          PATH: emptyPath,
        },
      });

      expect(result.status).toBe(1);
      const report = JSON.parse(result.stdout) as {
        required: boolean;
        failed_checks: { id: string; severity: string }[];
      };
      expect(report.required).toBe(true);
      expect(report.failed_checks).toContainEqual(expect.objectContaining({ id: 'godot', severity: 'error' }));
    } finally {
      rmSync(emptyPath, { recursive: true, force: true });
    }
  });

  it('accepts explicit Godot and browser executables', () => {
    const binDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-doctor-bin-'));
    const fakeGodot = join(binDir, 'godot4');
    const fakeChrome = join(binDir, 'chromium');
    const fakeNpm = join(binDir, 'npm');
    writeFileSync(fakeGodot, '#!/bin/sh\nprintf "4.4.stable.official.test\\n"\n');
    writeFileSync(fakeChrome, '#!/bin/sh\nprintf "Chromium 124.0.0\\n"\n');
    writeFileSync(fakeNpm, '#!/bin/sh\nprintf "11.0.0\\n"\n');
    chmodSync(fakeGodot, 0o755);
    chmodSync(fakeChrome, 0o755);
    chmodSync(fakeNpm, 0o755);

    try {
      const result = spawnSync(
        process.execPath,
        ['scripts/check-godot-doctor.mjs', '--require-godot', '--skip-export-templates', '--json'],
        {
          cwd: repoRoot,
          encoding: 'utf8',
          env: {
            ...process.env,
            CHROME_BIN: fakeChrome,
            GODOT_BIN: fakeGodot,
            PATH: binDir,
          },
        },
      );

      expect(result.status).toBe(0);
      const report = JSON.parse(result.stdout) as {
        checks: {
          godot?: { status?: string; version?: string };
          browser?: { status?: string; executable?: string };
        };
      };
      expect(report.checks.godot).toEqual(
        expect.objectContaining({ status: 'ok', version: '4.4.stable.official.test' }),
      );
      expect(report.checks.browser).toEqual(expect.objectContaining({ status: 'ok', executable: fakeChrome }));
    } finally {
      rmSync(binDir, { recursive: true, force: true });
    }
  });
});
