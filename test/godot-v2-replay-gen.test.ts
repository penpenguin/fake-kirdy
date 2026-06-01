import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

describe('Godot replay generator', () => {
  it('defines a replay generation command and static gate hook', () => {
    const scripts = readPackageScripts();

    expect(scripts['godot:replay-gen']).toBe('node scripts/generate-godot-replays.mjs');
    expect(scripts['check:godot']).toContain('godot:replay-gen -- --check');
    expect(existsSync(join(repoRoot, 'scripts', 'generate-godot-replays.mjs'))).toBe(true);
    expect(existsSync(join(repoRoot, 'godot', 'tests', 'replay_scripts', 'combat_capture_swallow_goal.scenario.json'))).toBe(true);
  });

  it('generates replay frames from high-level action steps', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-replay-gen-'));
    const scenarioDir = join(tempDir, 'scenarios');
    const outputPath = join(tempDir, 'generated_replay.json');
    const scenarioPath = join(scenarioDir, 'generated.scenario.json');

    try {
      mkdirSync(scenarioDir, { recursive: true });
      writeFileSync(
        scenarioPath,
        JSON.stringify(
          {
            version: 1,
            id: 'generated_replay',
            output_path: outputPath,
            start_level_id: 'combat_room',
            start_spawn_id: 'default',
            level_id: 'combat_room',
            fps: 60,
            max_frames: 120,
            initial_actions: {
              move_right: false,
              inhale: false,
              swallow: false,
            },
            steps: [
              { at: 0, do: 'move', direction: 'right', active: true },
              { at: 5, do: 'hold', action: 'inhale' },
              { at: 8, do: 'tap', action: 'swallow' },
              { at: 9, do: 'release', action: 'inhale' },
              { at: 30, do: 'move', direction: 'right', active: false },
            ],
          },
          null,
          2,
        ),
      );

      const result = spawnSync(process.execPath, ['scripts/generate-godot-replays.mjs', '--scenario-dir', scenarioDir, '--json'], {
        cwd: repoRoot,
        encoding: 'utf8',
      });

      expect(result.status).toBe(0);
      const replay = JSON.parse(readFileSync(outputPath, 'utf8')) as { frames: unknown[] };
      expect(replay).toMatchObject({
        start_level_id: 'combat_room',
        start_spawn_id: 'default',
        level_id: 'combat_room',
        fps: 60,
        max_frames: 120,
      });
      expect(replay.frames).toEqual([
        { frame: 0, actions: { move_right: true, inhale: false, swallow: false } },
        { frame: 5, actions: { inhale: true } },
        { frame: 8, actions: { swallow: true } },
        { frame: 9, actions: { inhale: false, swallow: false } },
        { frame: 30, actions: { move_right: false } },
      ]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('fails check mode when a generated replay is stale', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-replay-gen-stale-'));
    const scenarioDir = join(tempDir, 'scenarios');
    const outputPath = join(tempDir, 'stale_replay.json');
    const scenarioPath = join(scenarioDir, 'stale.scenario.json');

    try {
      mkdirSync(scenarioDir, { recursive: true });
      writeFileSync(
        scenarioPath,
        JSON.stringify(
          {
            version: 1,
            id: 'stale_replay',
            output_path: outputPath,
            start_level_id: 'door_room',
            start_spawn_id: 'default',
            fps: 60,
            max_frames: 40,
            steps: [{ at: 2, do: 'tap', action: 'pause_toggle' }],
          },
          null,
          2,
        ),
      );
      writeFileSync(outputPath, `${JSON.stringify({ stale: true }, null, 2)}\n`);

      const result = spawnSync(
        process.execPath,
        ['scripts/generate-godot-replays.mjs', '--scenario-dir', scenarioDir, '--check', '--json'],
        { cwd: repoRoot, encoding: 'utf8' },
      );

      expect(result.status).toBe(1);
      const report = JSON.parse(result.stdout) as { stale_outputs: string[] };
      expect(report.stale_outputs).toEqual([outputPath]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('keeps the checked-in combat capture replay synchronized with its scenario', () => {
    const result = spawnSync(process.execPath, ['scripts/generate-godot-replays.mjs', '--check', '--json'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout) as { scenario_count: number; stale_outputs: unknown[] };
    expect(report.scenario_count).toBeGreaterThanOrEqual(1);
    expect(report.stale_outputs).toEqual([]);
  });
});
