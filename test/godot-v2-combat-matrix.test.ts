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
        source_path: 'godot/scripts/session/GameSession.gd',
        abilities: [
          {
            id: 'fire',
            aliases: ['flame'],
            role: 'ranged_projectile',
            expectations: { attack_type: 'projectile', min_damage: 2, min_range: 200 },
          },
        ],
        difficulties: {
          normal: { enemy_hp_multiplier: 1.0 },
        },
        enemy_archetypes: [
          {
            id: 'ground',
            type: 'ground',
            role: 'basic',
            base_hp: 1,
            ttk_seconds: { min: 0, max: 4 },
          },
        ],
        rules: {
          matrix_coverage: { severity: 'error' },
          role_expectations: { severity: 'error' },
          ttk_range: { severity: 'error' },
        },
        ...overrides,
      },
      null,
      2,
    )}\n`,
  );
};

describe('Godot combat matrix', () => {
  it('defines a combat matrix command and static gate hook', () => {
    const scripts = readPackageScripts();

    expect(scripts['godot:combat-matrix']).toBe('node scripts/check-godot-combat-matrix.mjs');
    expect(scripts['check:godot']).toContain('godot:combat-matrix');
    expect(existsSync(join(repoRoot, 'scripts', 'check-godot-combat-matrix.mjs'))).toBe(true);
    expect(existsSync(join(repoRoot, 'godot', 'tests', 'combat_matrix_contract.json'))).toBe(true);
  });

  it('computes hits-to-defeat and TTK from the real Godot ability profile', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-combat-matrix-'));
    const contractPath = join(tempDir, 'combat_matrix_contract.json');

    try {
      writeContract(contractPath);
      const result = spawnSync(process.execPath, ['scripts/check-godot-combat-matrix.mjs', '--contract', contractPath, '--json'], {
        cwd: repoRoot,
        encoding: 'utf8',
      });

      expect(result.status).toBe(0);
      const report = JSON.parse(result.stdout) as {
        matrix_count: number;
        failed_checks: unknown[];
        matrix: { ability_id: string; enemy_archetype_id: string; difficulty: string; hits_to_defeat: number; ttk_seconds: number }[];
      };
      expect(report.failed_checks).toEqual([]);
      expect(report.matrix_count).toBe(1);
      expect(report.matrix).toContainEqual(
        expect.objectContaining({
          ability_id: 'fire',
          enemy_archetype_id: 'ground',
          difficulty: 'normal',
          hits_to_defeat: 1,
          ttk_seconds: 0,
        }),
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('fails with evidence when a TTK range is violated', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-combat-matrix-fail-'));
    const contractPath = join(tempDir, 'combat_matrix_contract.json');

    try {
      writeContract(contractPath, {
        enemy_archetypes: [
          {
            id: 'elite',
            type: 'elite',
            base_hp: 10,
            ttk_seconds: { min: 0, max: 0.1 },
          },
        ],
      });
      const result = spawnSync(process.execPath, ['scripts/check-godot-combat-matrix.mjs', '--contract', contractPath, '--json'], {
        cwd: repoRoot,
        encoding: 'utf8',
      });

      expect(result.status).toBe(1);
      const report = JSON.parse(result.stdout) as {
        failed_checks: { rule: string; ability_id: string; enemy_archetype_id: string; difficulty: string; message: string }[];
      };
      expect(report.failed_checks).toContainEqual(
        expect.objectContaining({
          rule: 'ttk_range',
          ability_id: 'fire',
          enemy_archetype_id: 'elite',
          difficulty: 'normal',
        }),
      );
      expect(report.failed_checks.map((check) => check.message).join('\n')).toContain('TTK');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('validates the canonical ability x enemy x difficulty matrix contract', () => {
    const result = spawnSync(process.execPath, ['scripts/check-godot-combat-matrix.mjs', '--json'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout) as {
      ability_count: number;
      enemy_archetype_count: number;
      difficulty_count: number;
      matrix_count: number;
      failed_checks: unknown[];
      ability_profiles: Record<string, { role: string; attack_type?: string }>;
    };
    expect(report.ability_count).toBe(8);
    expect(report.enemy_archetype_count).toBe(5);
    expect(report.difficulty_count).toBe(3);
    expect(report.matrix_count).toBe(120);
    expect(report.failed_checks).toEqual([]);
    expect(report.ability_profiles.fire.attack_type).toBe('projectile');
    expect(report.ability_profiles.leaf.attack_type).toBe('cutter');
    expect(report.ability_profiles.none.role).toBe('no_direct_attack');
  });

  it('keeps basic small enemies at 1 HP and marks midboss or boss HP exceptions explicitly', () => {
    const contract = JSON.parse(readFileSync(join(repoRoot, 'godot', 'tests', 'combat_matrix_contract.json'), 'utf8')) as {
      enemy_archetypes?: Array<{
        id?: string;
        base_hp?: number;
        role?: string;
        hp_exception?: boolean;
      }>;
      rules?: Record<string, { severity?: string }>;
    };
    const simpleEnemy = readFileSync(join(repoRoot, 'godot', 'scripts', 'enemies', 'SimpleEnemy.gd'), 'utf8');
    const enemyMarker = readFileSync(join(repoRoot, 'godot', 'scripts', 'level', 'markers', 'EnemySpawnMarker.gd'), 'utf8');
    const session = readFileSync(join(repoRoot, 'godot', 'scripts', 'session', 'GameSession.gd'), 'utf8');

    expect(simpleEnemy).toContain('@export var max_hp: int = 1');
    expect(simpleEnemy).toContain('var hp: int = 1');
    expect(enemyMarker).toContain('@export var max_hp');
    expect(enemyMarker).toContain('@export var enemy_rank');
    expect(session).toContain('func resolve_enemy_max_hp(enemy_type: String, marker_payload: Dictionary) -> int:');
    expect(session).toContain('enemy.max_hp = resolve_enemy_max_hp(enemy_type, marker_payload)');
    expect(contract.rules?.basic_enemy_hp?.severity).toBe('error');

    const archetypes = contract.enemy_archetypes ?? [];
    expect(archetypes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'ground', base_hp: 1, role: 'basic' }),
        expect.objectContaining({ id: 'flying', base_hp: 1, role: 'basic' }),
        expect.objectContaining({ id: 'sentry', role: 'midboss', hp_exception: true }),
        expect.objectContaining({ id: 'elite', role: 'midboss', hp_exception: true }),
        expect.objectContaining({ id: 'boss', role: 'boss', hp_exception: true }),
      ]),
    );
  });
});
