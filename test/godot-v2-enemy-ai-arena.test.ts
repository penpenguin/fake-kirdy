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
          simple_enemy: 'godot/scripts/enemies/SimpleEnemy.gd',
          flying_enemy: 'godot/scripts/enemies/FlyingEnemy.gd',
          game_session: 'godot/scripts/session/GameSession.gd',
        },
        arena_defaults: {
          delta_ms: 100,
          max_frames: 80,
          player_near_distance: 64,
          player_far_distance: 420,
          damage_per_hit: 1,
        },
        cases: [
          {
            id: 'spark_ground_patrol_chase_attack',
            enemy_type: 'simple_ground',
            ability_type: 'spark',
            patrol_radius: 48,
            expected_events: [
              'enemy.ai.patrol',
              'enemy.ai.detected',
              'enemy.ai.chase',
              'enemy.attack.started',
              'enemy.attack.cooldown',
              'enemy.ai.return',
              'enemy.hurt',
              'enemy.defeated',
            ],
          },
        ],
        rules: {
          expected_events: { severity: 'error' },
          ability_profile_applied: { severity: 'error' },
          movement_bounds: { severity: 'error' },
          cooldown_after_attack: { severity: 'error' },
        },
        ...overrides,
      },
      null,
      2,
    )}\n`,
  );
};

describe('Godot enemy AI arena', () => {
  it('defines an enemy AI arena command and static gate hook', () => {
    const scripts = readPackageScripts();

    expect(scripts['godot:enemy-ai-arena']).toBe('node scripts/check-godot-enemy-ai-arena.mjs');
    expect(scripts['check:godot']).toContain('godot:enemy-ai-arena');
    expect(existsSync(join(repoRoot, 'scripts', 'check-godot-enemy-ai-arena.mjs'))).toBe(true);
    expect(existsSync(join(repoRoot, 'godot', 'tests', 'enemy_ai_arena_contract.json'))).toBe(true);
  });

  it('simulates patrol, detection, chase, attack cooldown, return, hurt, and defeat', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-enemy-ai-arena-'));
    const contractPath = join(tempDir, 'enemy_ai_arena_contract.json');

    try {
      writeContract(contractPath);
      const result = spawnSync(process.execPath, ['scripts/check-godot-enemy-ai-arena.mjs', '--contract', contractPath, '--json'], {
        cwd: repoRoot,
        encoding: 'utf8',
      });

      expect(result.status).toBe(0);
      const report = JSON.parse(result.stdout) as {
        case_count: number;
        failed_checks: unknown[];
        cases: { id: string; events: { event_type: string }[]; final_state: string }[];
      };
      expect(report.case_count).toBe(1);
      expect(report.failed_checks).toEqual([]);
      expect(report.cases[0].events.map((event) => event.event_type)).toEqual(
        expect.arrayContaining([
          'enemy.ai.patrol',
          'enemy.ai.detected',
          'enemy.ai.chase',
          'enemy.attack.started',
          'enemy.attack.cooldown',
          'enemy.ai.return',
          'enemy.hurt',
          'enemy.defeated',
        ]),
      );
      expect(report.cases[0].final_state).toBe('enemy.defeated');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('fails with useful evidence when an expected AI event is missing', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-enemy-ai-arena-fail-'));
    const contractPath = join(tempDir, 'enemy_ai_arena_contract.json');

    try {
      writeContract(contractPath, {
        cases: [
          {
            id: 'idle_enemy_without_patrol',
            enemy_type: 'simple_ground',
            ability_type: 'spark',
            patrol_radius: 0,
            expected_events: ['enemy.ai.patrol'],
          },
        ],
      });
      const result = spawnSync(process.execPath, ['scripts/check-godot-enemy-ai-arena.mjs', '--contract', contractPath, '--json'], {
        cwd: repoRoot,
        encoding: 'utf8',
      });

      expect(result.status).toBe(1);
      const report = JSON.parse(result.stdout) as {
        failed_checks: { rule: string; case_id: string; message: string }[];
      };
      expect(report.failed_checks).toContainEqual(
        expect.objectContaining({
          rule: 'expected_events',
          case_id: 'idle_enemy_without_patrol',
        }),
      );
      expect(report.failed_checks.map((check) => check.message).join('\n')).toContain('enemy.ai.patrol');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('validates canonical ground, flying, and ability-profile AI arena cases', () => {
    const result = spawnSync(process.execPath, ['scripts/check-godot-enemy-ai-arena.mjs', '--json'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout) as {
      case_count: number;
      failed_checks: unknown[];
      cases: { id: string; applied_profile?: Record<string, unknown>; events: { event_type: string }[] }[];
    };
    expect(report.case_count).toBeGreaterThanOrEqual(5);
    expect(report.failed_checks).toEqual([]);
    expect(report.cases.map((testCase) => testCase.id)).toEqual(
      expect.arrayContaining(['spark_ground_patrol_chase_attack', 'frost_flying_hover_profile', 'fire_ground_rush_profile', 'stone_sentry_return_profile', 'leaf_sprite_drift_profile']),
    );
    expect(report.cases.find((testCase) => testCase.id === 'frost_flying_hover_profile')?.applied_profile).toMatchObject({
      ai_behavior: 'frost_hover',
    });
  });
});
