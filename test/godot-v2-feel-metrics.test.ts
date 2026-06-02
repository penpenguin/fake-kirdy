import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

const writeContract = (path: string, overrides: Record<string, unknown> = {}): void => {
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        version: 1,
        source_paths: {
          player_tuning: 'godot/scripts/player/PlayerTuning.gd',
          game_session: 'godot/scripts/session/GameSession.gd',
        },
        simulation: {
          fps: 60,
          max_seconds: 4,
          target_speed_ratio: 0.95,
        },
        metrics: {
          jump_apex_frames: { min: 12, max: 32 },
          jump_height_px: { min: 50, max: 120 },
          landing_frames: { min: 24, max: 80 },
          coyote_time_frames: { min: 4, max: 10 },
          jump_buffer_frames: { min: 5, max: 12 },
          hover_max_fall_speed: { min: 40, max: 140 },
          acceleration_frames: { min: 4, max: 12 },
          stop_frames: { min: 3, max: 10 },
          turn_frames: { min: 6, max: 18 },
          attack_latency_frames: { min: 0, max: 6 },
          damage_recovery_frames: { min: 24, max: 80 },
        },
        ...overrides,
      },
      null,
      2,
    )}\n`,
  );
};

describe('Godot feel metrics', () => {
  it('defines a feel metrics command and static gate hook', () => {
    const scripts = readPackageScripts();

    expect(scripts['godot:feel-metrics']).toBe('node scripts/check-godot-feel-metrics.mjs');
    expect(scripts['check:godot']).toContain('godot:feel-metrics');
    expect(existsSync(join(repoRoot, 'scripts', 'check-godot-feel-metrics.mjs'))).toBe(true);
    expect(existsSync(join(repoRoot, 'godot', 'tests', 'feel_metrics_contract.json'))).toBe(true);
  });

  it('computes jump, acceleration, hover, attack, and recovery metrics from real tuning', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-feel-metrics-'));
    const contractPath = join(tempDir, 'feel_metrics_contract.json');

    try {
      writeContract(contractPath);
      const result = spawnSync(process.execPath, ['scripts/check-godot-feel-metrics.mjs', '--contract', contractPath, '--json'], {
        cwd: repoRoot,
        encoding: 'utf8',
      });

      expect(result.status).toBe(0);
      const report = JSON.parse(result.stdout) as {
        failed_checks: unknown[];
        metrics: Record<string, number>;
      };
      expect(report.failed_checks).toEqual([]);
      expect(report.metrics.jump_apex_frames).toBe(21);
      expect(report.metrics.jump_height_px).toBeGreaterThan(60);
      expect(report.metrics.acceleration_frames).toBe(7);
      expect(report.metrics.turn_frames).toBeGreaterThan(report.metrics.stop_frames);
      expect(report.metrics.attack_latency_frames).toBe(0);
      expect(report.metrics.damage_recovery_frames).toBe(48);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('fails with useful evidence when a metric is outside its range', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-feel-metrics-fail-'));
    const contractPath = join(tempDir, 'feel_metrics_contract.json');

    try {
      writeContract(contractPath, {
        metrics: {
          jump_apex_frames: { min: 1, max: 2 },
        },
      });
      const result = spawnSync(process.execPath, ['scripts/check-godot-feel-metrics.mjs', '--contract', contractPath, '--json'], {
        cwd: repoRoot,
        encoding: 'utf8',
      });

      expect(result.status).toBe(1);
      const report = JSON.parse(result.stdout) as {
        failed_checks: { rule: string; metric: string; message: string }[];
      };
      expect(report.failed_checks).toContainEqual(
        expect.objectContaining({
          rule: 'metric_range',
          metric: 'jump_apex_frames',
        }),
      );
      expect(report.failed_checks.map((check) => check.message).join('\n')).toContain('jump_apex_frames');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('validates the canonical controller feel contract', () => {
    const result = spawnSync(process.execPath, ['scripts/check-godot-feel-metrics.mjs', '--json'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout) as {
      failed_checks: unknown[];
      metrics: Record<string, number>;
      tuning: Record<string, number>;
    };
    expect(report.failed_checks).toEqual([]);
    expect(report.tuning.max_speed).toBe(220);
    expect(report.metrics).toMatchObject({
      coyote_time_frames: 5,
      jump_buffer_frames: 7,
      hover_max_fall_speed: 90,
    });
  });
});
