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

const sceneHeader = `[gd_scene load_steps=5 format=3]

[ext_resource type="Script" path="res://scripts/level/markers/PlayerSpawn.gd" id="1_spawn"]
[ext_resource type="Script" path="res://scripts/level/markers/DoorMarker.gd" id="2_door"]
[ext_resource type="Script" path="res://scripts/level/markers/GoalMarker.gd" id="3_goal"]
[ext_resource type="Script" path="res://scripts/level/markers/CollectibleMarker.gd" id="4_collectible"]
`;

describe('Godot progression solver', () => {
  it('defines a static progression solver command and contract', () => {
    const scripts = readPackageScripts();

    expect(scripts['godot:progression-solver']).toBe('node scripts/check-godot-progression-solver.mjs');
    expect(scripts['check:godot']).toContain('godot:progression-solver');
    expect(existsSync(join(repoRoot, 'scripts', 'check-godot-progression-solver.mjs'))).toBe(true);
    expect(existsSync(join(repoRoot, 'godot', 'tests', 'progression_solver_contract.json'))).toBe(true);

    const contract = JSON.parse(
      readFileSync(join(repoRoot, 'godot', 'tests', 'progression_solver_contract.json'), 'utf8'),
    ) as {
      version?: number;
      start_level_id?: string;
      final_level_id?: string;
      cluster_unlocks?: Record<string, string>;
      required_final_items?: string[];
      rules?: Record<string, { severity?: string }>;
    };
    expect(contract.version).toBe(1);
    expect(contract.start_level_id).toBe('central_hub');
    expect(contract.final_level_id).toBe('labyrinth_132');
    expect(contract.cluster_unlocks?.ice).toBe('forest-keystone');
    expect(contract.required_final_items).toEqual(
      expect.arrayContaining(['forest-keystone', 'ice-keystone', 'fire-keystone', 'cave-keystone']),
    );
    expect(contract.rules?.final_state_reachable?.severity).toBe('error');
  });

  it('solves item-gated scene progression in order', () => {
    const levelsDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-progression-solver-'));
    writeFileSync(
      join(levelsDir, 'central_hub.tscn'),
      `${sceneHeader}
[node name="CentralHub" type="Node2D"]

[node name="PlayerSpawn" type="Node2D" parent="."]
script = ExtResource("1_spawn")
spawn_id = "default"

[node name="DoorToBranch" type="Node2D" parent="."]
script = ExtResource("2_door")
door_id = "hub_to_branch"
target_level_id = "branch_room"
target_spawn_id = "default"
`,
    );
    writeFileSync(
      join(levelsDir, 'branch_room.tscn'),
      `${sceneHeader}
[node name="BranchRoom" type="Node2D"]

[node name="PlayerSpawn" type="Node2D" parent="."]
script = ExtResource("1_spawn")
spawn_id = "default"

[node name="BranchKey" type="Node2D" parent="."]
script = ExtResource("4_collectible")
collectible_id = "branch-key"
item_id = "branch-key"

[node name="DoorToGoal" type="Node2D" parent="."]
script = ExtResource("2_door")
door_id = "branch_to_goal"
target_level_id = "goal_sanctum"
target_spawn_id = "default"
required_item_id = "branch-key"
`,
    );
    writeFileSync(
      join(levelsDir, 'goal_sanctum.tscn'),
      `${sceneHeader}
[node name="GoalSanctum" type="Node2D"]

[node name="PlayerSpawn" type="Node2D" parent="."]
script = ExtResource("1_spawn")
spawn_id = "default"

[node name="GoalMarker" type="Node2D" parent="."]
script = ExtResource("3_goal")
goal_id = "final_goal"
`,
    );

    try {
      const result = spawnSync(
        process.execPath,
        [
          'scripts/check-godot-progression-solver.mjs',
          '--levels-dir',
          levelsDir,
          '--no-procedural',
          '--start',
          'central_hub',
          '--final',
          'goal_sanctum',
          '--json',
        ],
        { cwd: repoRoot, encoding: 'utf8' },
      );

      expect(result.status).toBe(0);
      const report = JSON.parse(result.stdout) as {
        failed_checks: unknown[];
        solution?: { path: string[]; items: string[] };
      };
      expect(report.failed_checks).toEqual([]);
      expect(report.solution?.path).toEqual(['central_hub', 'branch_room', 'goal_sanctum']);
      expect(report.solution?.items).toContain('branch-key');
    } finally {
      rmSync(levelsDir, { recursive: true, force: true });
    }
  });

  it('fails when a final level is graph-reachable but progression-locked', () => {
    const levelsDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-progression-locked-'));
    writeFileSync(
      join(levelsDir, 'central_hub.tscn'),
      `${sceneHeader}
[node name="CentralHub" type="Node2D"]

[node name="PlayerSpawn" type="Node2D" parent="."]
script = ExtResource("1_spawn")
spawn_id = "default"

[node name="DoorToGoal" type="Node2D" parent="."]
script = ExtResource("2_door")
door_id = "hub_to_goal"
target_level_id = "goal_sanctum"
target_spawn_id = "default"
required_item_id = "missing-key"
`,
    );
    writeFileSync(
      join(levelsDir, 'goal_sanctum.tscn'),
      `${sceneHeader}
[node name="GoalSanctum" type="Node2D"]

[node name="PlayerSpawn" type="Node2D" parent="."]
script = ExtResource("1_spawn")
spawn_id = "default"
`,
    );

    try {
      const result = spawnSync(
        process.execPath,
        [
          'scripts/check-godot-progression-solver.mjs',
          '--levels-dir',
          levelsDir,
          '--no-procedural',
          '--start',
          'central_hub',
          '--final',
          'goal_sanctum',
          '--json',
        ],
        { cwd: repoRoot, encoding: 'utf8' },
      );

      expect(result.status).toBe(1);
      const report = JSON.parse(result.stdout) as {
        failed_checks: { rule: string }[];
        blocked_requirements: Record<string, string[]>;
      };
      expect(report.failed_checks).toContainEqual(expect.objectContaining({ rule: 'final_state_reachable' }));
      expect(report.blocked_requirements['required_item_id:missing-key']).toContain('central_hub:hub_to_goal');
    } finally {
      rmSync(levelsDir, { recursive: true, force: true });
    }
  });

  it('solves the canonical keystone route through the terminal generated goal', () => {
    const result = spawnSync(process.execPath, ['scripts/check-godot-progression-solver.mjs', '--json'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout) as {
      failed_checks: unknown[];
      solution?: { path: string[]; items: string[]; completed_levels: string[] };
      explored_state_count: number;
    };
    expect(report.failed_checks).toEqual([]);
    expect(report.explored_state_count).toBeGreaterThan(10);
    expect(report.solution?.path).toEqual(
      expect.arrayContaining(['central_hub', 'forest_reliquary', 'ice_reliquary', 'fire_reliquary', 'ruins_reliquary', 'labyrinth_132']),
    );
    expect(report.solution?.items).toEqual(
      expect.arrayContaining(['forest-keystone', 'ice-keystone', 'fire-keystone', 'cave-keystone']),
    );
    expect(report.solution?.completed_levels).toContain('labyrinth_132');
  });
});
