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

const sceneHeader = `[gd_scene load_steps=6 format=3]

[ext_resource type="Script" path="res://scripts/level/markers/PlayerSpawn.gd" id="1_spawn"]
[ext_resource type="Script" path="res://scripts/level/markers/DoorMarker.gd" id="2_door"]
[ext_resource type="Script" path="res://scripts/level/markers/GoalMarker.gd" id="3_goal"]
[ext_resource type="Script" path="res://scripts/level/markers/HazardMarker.gd" id="4_hazard"]
[ext_resource type="Script" path="res://scripts/level/markers/EnemySpawnMarker.gd" id="5_enemy"]
[ext_resource type="Script" path="res://scripts/level/markers/AbilityGateMarker.gd" id="6_gate"]
`;

describe('Godot scene lint', () => {
  it('defines a static scene lint command and contract', () => {
    const scripts = readPackageScripts();

    expect(scripts['godot:scene-lint']).toBe('node scripts/check-godot-scene-lint.mjs');
    expect(scripts['check:godot']).toContain('godot:scene-lint');
    expect(existsSync(join(repoRoot, 'scripts', 'check-godot-scene-lint.mjs'))).toBe(true);
    expect(existsSync(join(repoRoot, 'godot', 'tests', 'scene_lint_contract.json'))).toBe(true);

    const contract = JSON.parse(
      readFileSync(join(repoRoot, 'godot', 'tests', 'scene_lint_contract.json'), 'utf8'),
    ) as {
      version?: number;
      rules?: Record<string, { severity?: string }>;
    };
    expect(contract.version).toBe(1);
    expect(contract.rules?.door_target_exists?.severity).toBe('error');
    expect(contract.rules?.door_target_spawn_exists?.severity).toBe('error');
    expect(contract.rules?.ability_gate_requires_ability?.severity).toBe('error');
    expect(contract.rules?.door_goal_overlap?.severity).toBe('warning');
  });

  it('fails on broken door targets, missing target spawns, and empty ability gates', () => {
    const levelsDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-scene-lint-'));
    writeFileSync(
      join(levelsDir, 'target_room.tscn'),
      `${sceneHeader}
[node name="TargetRoom" type="Node2D"]

[node name="PlayerSpawn" type="Node2D" parent="."]
position = Vector2(96, 368)
script = ExtResource("1_spawn")
spawn_id = "default"
`,
    );
    writeFileSync(
      join(levelsDir, 'broken_room.tscn'),
      `${sceneHeader}
[node name="BrokenRoom" type="Node2D"]

[node name="PlayerSpawn" type="Node2D" parent="."]
position = Vector2(96, 368)
script = ExtResource("1_spawn")
spawn_id = "default"

[node name="MissingLevelDoor" type="Node2D" parent="."]
position = Vector2(160, 368)
script = ExtResource("2_door")
target_level_id = "missing_room"
target_spawn_id = "default"

[node name="MissingSpawnDoor" type="Node2D" parent="."]
position = Vector2(260, 368)
script = ExtResource("2_door")
target_level_id = "target_room"
target_spawn_id = "entry"

[node name="GoalMarker" type="Node2D" parent="."]
position = Vector2(260, 368)
script = ExtResource("3_goal")

[node name="SpikeHazard" type="Node2D" parent="."]
position = Vector2(108, 368)
script = ExtResource("4_hazard")
trigger_radius = 48.0

[node name="EnemySpawnMarker" type="Node2D" parent="."]
position = Vector2(112, 368)
script = ExtResource("5_enemy")

[node name="AbilityGateMarker" type="Node2D" parent="."]
position = Vector2(420, 368)
script = ExtResource("6_gate")
required_ability_type = ""
`,
    );

    try {
      const result = spawnSync(
        process.execPath,
        ['scripts/check-godot-scene-lint.mjs', '--levels-dir', levelsDir, '--json'],
        {
          cwd: repoRoot,
          encoding: 'utf8',
        },
      );

      expect(result.status).toBe(1);
      const report = JSON.parse(result.stdout) as {
        failed_checks: { rule: string }[];
        issues: { rule: string; severity: string }[];
      };
      expect(report.failed_checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ rule: 'door_target_exists' }),
          expect.objectContaining({ rule: 'door_target_spawn_exists' }),
          expect.objectContaining({ rule: 'ability_gate_requires_ability' }),
        ]),
      );
      expect(report.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ rule: 'door_goal_overlap', severity: 'warning' }),
          expect.objectContaining({ rule: 'hazard_spawn_overlap', severity: 'warning' }),
          expect.objectContaining({ rule: 'enemy_spawn_distance', severity: 'warning' }),
        ]),
      );
    } finally {
      rmSync(levelsDir, { recursive: true, force: true });
    }
  });

  it('passes the canonical level set without requiring Godot', () => {
    const result = spawnSync(process.execPath, ['scripts/check-godot-scene-lint.mjs', '--json'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout) as {
      level_count: number;
      failed_checks: unknown[];
      issues: { severity?: string }[];
    };
    expect(report.level_count).toBeGreaterThan(10);
    expect(report.failed_checks).toEqual([]);
    expect(report.issues.filter((issue) => issue.severity === 'warning')).toEqual([]);
  });
});
