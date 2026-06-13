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

const writeReplay = (path: string): void => {
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        start_level_id: 'combat_room',
        start_spawn_id: 'default',
        fps: 60,
        max_frames: 120,
        frames: [{ frame: 0, actions: { move_right: true } }],
      },
      null,
      2,
    )}\n`,
  );
};

const writeContract = (path: string, baselinePath: string, replayPath: string): void => {
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        version: 1,
        viewport: { width: 1280, height: 720 },
        snapshots: [
          {
            id: 'fixture_hud_snapshot',
            replay_path: replayPath,
            frame: 30,
            baseline_path: baselinePath,
            visual_tags: ['hud', 'ability_display'],
            required_scene_paths: ['godot/scenes/ui/HudOverlay.tscn'],
            required_resource_paths: ['godot/resources/assets/images/ui/door-marker.webp'],
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
};

describe('Godot visual snapshots', () => {
  it('defines a visual snapshot command and static gate hook', () => {
    const scripts = readPackageScripts();

    expect(scripts['godot:visual-snapshot']).toBe('node scripts/check-godot-visual-snapshot.mjs');
    expect(scripts['check:godot']).toContain('godot:visual-snapshot');
    expect(existsSync(join(repoRoot, 'scripts', 'check-godot-visual-snapshot.mjs'))).toBe(true);
    expect(existsSync(join(repoRoot, 'godot', 'tests', 'visual_snapshot_contract.json'))).toBe(true);
  });

  it('can generate and verify a snapshot baseline contract', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-visual-snapshot-'));
    const replayPath = join(tempDir, 'fixture_replay.json');
    const baselinePath = join(tempDir, 'baseline.json');
    const contractPath = join(tempDir, 'visual_snapshot_contract.json');

    try {
      writeReplay(replayPath);
      writeContract(contractPath, baselinePath, replayPath);

      const updateResult = spawnSync(
        process.execPath,
        ['scripts/check-godot-visual-snapshot.mjs', '--contract', contractPath, '--update', '--json'],
        { cwd: repoRoot, encoding: 'utf8' },
      );
      expect(updateResult.status).toBe(0);
      expect(existsSync(baselinePath)).toBe(true);

      const checkResult = spawnSync(process.execPath, ['scripts/check-godot-visual-snapshot.mjs', '--contract', contractPath, '--json'], {
        cwd: repoRoot,
        encoding: 'utf8',
      });
      expect(checkResult.status).toBe(0);
      const report = JSON.parse(checkResult.stdout) as { failed_checks: unknown[]; snapshot_count: number };
      expect(report.snapshot_count).toBe(1);
      expect(report.failed_checks).toEqual([]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('fails with useful evidence when a baseline is stale', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-visual-snapshot-stale-'));
    const replayPath = join(tempDir, 'fixture_replay.json');
    const baselinePath = join(tempDir, 'baseline.json');
    const contractPath = join(tempDir, 'visual_snapshot_contract.json');

    try {
      writeReplay(replayPath);
      writeContract(contractPath, baselinePath, replayPath);
      writeFileSync(
        baselinePath,
        `${JSON.stringify({ snapshot_id: 'fixture_hud_snapshot', content_hash: 'stale-hash', visual_tags: ['hud'] }, null, 2)}\n`,
      );

      const result = spawnSync(process.execPath, ['scripts/check-godot-visual-snapshot.mjs', '--contract', contractPath, '--json'], {
        cwd: repoRoot,
        encoding: 'utf8',
      });

      expect(result.status).toBe(1);
      const report = JSON.parse(result.stdout) as {
        failed_checks: { rule: string; snapshot_id: string; message: string }[];
      };
      expect(report.failed_checks).toContainEqual(
        expect.objectContaining({
          rule: 'baseline_stale',
          snapshot_id: 'fixture_hud_snapshot',
        }),
      );
      expect(report.failed_checks.map((check) => check.message).join('\n')).toContain('stale');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('validates canonical HUD, feedback, terrain, overlay, and control snapshot targets', () => {
    const result = spawnSync(process.execPath, ['scripts/check-godot-visual-snapshot.mjs', '--json'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout) as {
      snapshot_count: number;
      failed_checks: unknown[];
      coverage: Record<string, number>;
    };
    expect(report.snapshot_count).toBeGreaterThanOrEqual(8);
    expect(report.failed_checks).toEqual([]);
    expect(report.coverage).toMatchObject({
      hud: expect.any(Number),
      ability_feedback: expect.any(Number),
      locked_door: expect.any(Number),
      map_overlay: expect.any(Number),
      pause_overlay: expect.any(Number),
      settings_overlay: expect.any(Number),
      result_overlay: expect.any(Number),
      virtual_controls: expect.any(Number),
      level_terrain: expect.any(Number),
      door_scale: expect.any(Number),
    });
    expect(report.coverage.level_terrain).toBeGreaterThanOrEqual(4);
    expect(report.coverage.door_scale).toBeGreaterThanOrEqual(1);
  });

  it('tiles terrain textures across multi-cell floor polygons instead of stretching one tile', () => {
    const levelVisualAssets = readFileSync(join(repoRoot, 'godot', 'scripts', 'level', 'LevelVisualAssets.gd'), 'utf8');

    expect(levelVisualAssets).toContain('polygon.texture_repeat = CanvasItem.TEXTURE_REPEAT_ENABLED');
    expect(levelVisualAssets).toContain('polygon.texture_scale = Vector2(1.0, 1.0)');
  });

  it('applies terrain textures from stage metadata instead of only the raw level id', () => {
    const session = readFileSync(join(repoRoot, 'godot', 'scripts', 'session', 'GameSession.gd'), 'utf8');
    const levelVisualAssets = readFileSync(join(repoRoot, 'godot', 'scripts', 'level', 'LevelVisualAssets.gd'), 'utf8');

    expect(session).toContain('func get_level_visual_key(level_id: String) -> String:');
    expect(session).toContain('current_level.get_meta("stage_id", "")');
    expect(session).toContain('level_loader.call("get_level_cluster", level_id)');
    expect(session).toContain('level_visual_assets.call("apply_to_level", current_level, get_level_visual_key(current_level_id))');
    expect(levelVisualAssets).toContain('normalized_level_id.contains("cluster:forest")');
    expect(levelVisualAssets).toContain('normalized_level_id.contains("cluster:fire")');
    expect(levelVisualAssets).toContain('normalized_level_id.contains("cluster:ice")');
    expect(levelVisualAssets).toContain('normalized_level_id.contains("cluster:ruins")');
    expect(levelVisualAssets).toContain('normalized_level_id.contains("cluster:sky")');
  });
});
