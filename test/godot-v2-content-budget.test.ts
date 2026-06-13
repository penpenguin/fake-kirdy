import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

const writeScene = (path: string): void => {
  writeFileSync(
    path,
    `[gd_scene load_steps=7 format=3]

[ext_resource type="Script" path="res://scripts/level/markers/PlayerSpawn.gd" id="1_spawn"]
[ext_resource type="Script" path="res://scripts/level/markers/DoorMarker.gd" id="2_door"]
[ext_resource type="Script" path="res://scripts/level/markers/EnemySpawnMarker.gd" id="3_enemy"]
[ext_resource type="Script" path="res://scripts/level/markers/HealMarker.gd" id="4_heal"]
[ext_resource type="Script" path="res://scripts/level/markers/AbilityGateMarker.gd" id="5_gate"]
[ext_resource type="Script" path="res://scripts/level/markers/LevelPacingMarker.gd" id="6_pacing"]

[sub_resource type="RectangleShape2D" id="RectangleShape2D_floor"]
size = Vector2(760, 32)

[node name="FixtureLevel" type="Node2D"]

[node name="BranchPacingMarker" type="Node2D" parent="."]
script = ExtResource("6_pacing")
pacing_profile = "branch"
critical_path_px = 560.0
rest_stop_count = 1
safe_spawn_radius = 96.0
door_preview_spacing_px = 144.0
encounter_budget = 1

[node name="PlayerSpawn" type="Node2D" parent="."]
position = Vector2(96, 368)
script = ExtResource("1_spawn")
spawn_id = "default"

[node name="DoorToNext" type="Node2D" parent="."]
position = Vector2(620, 368)
script = ExtResource("2_door")
door_id = "fixture_exit"
target_level_id = "next_room"
target_spawn_id = "default"
trigger_radius = 48.0

[node name="EnemySpawnMarker" type="Node2D" parent="."]
position = Vector2(320, 400)
script = ExtResource("3_enemy")
spawn_id = "fixture_enemy"
enemy_type = "simple_ground"

[node name="HealMarker" type="Node2D" parent="."]
position = Vector2(520, 368)
script = ExtResource("4_heal")
heal_id = "fixture_heal"
amount = 2
reward_type = "health"

[node name="Gate" type="Node2D" parent="."]
position = Vector2(452, 368)
script = ExtResource("5_gate")
gate_id = "fixture_gate"
required_ability_type = "fire"

[node name="Floor" type="StaticBody2D" parent="."]
position = Vector2(380, 432)

[node name="CollisionShape2D" type="CollisionShape2D" parent="Floor"]
shape = SubResource("RectangleShape2D_floor")
`,
  );
};

const writeContract = (path: string, catalogPath: string, proceduralPath: string): void => {
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        version: 1,
        source_paths: {
          catalog_source: catalogPath,
          procedural_levels: proceduralPath,
        },
        required_metrics: [
          'enemy_count',
          'enemy_density',
          'heal_amount',
          'key_count',
          'ability_gate_count',
          'hazard_count',
          'platform_count',
          'vertical_travel_px',
          'hidden_count',
          'rest_stop_count',
          'door_preview_spacing_px',
          'goal_distance_px',
        ],
        profiles: {
          branch: {
            min: {
              door_count: 1,
              enemy_count: 1,
              platform_count: 1,
              critical_path_px: 300,
              door_preview_spacing_px: 96,
              content_score: 3,
            },
            max: {
              enemy_density: 0.01,
            },
          },
        },
      },
      null,
      2,
    )}\n`,
  );
};

describe('Godot content budget', () => {
  it('defines a content budget command and static gate hook', () => {
    const scripts = readPackageScripts();

    expect(scripts['godot:content-budget']).toBe('node scripts/check-godot-content-budget.mjs');
    expect(scripts['check:godot']).toContain('godot:content-budget');
  });

  it('calculates density metrics for scene and generated levels', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-content-budget-'));
    const scenePath = join(tempDir, 'fixture_branch.tscn');
    const catalogPath = join(tempDir, 'level_catalog.source.json');
    const proceduralPath = join(tempDir, 'procedural_levels.json');
    const contractPath = join(tempDir, 'content_budget_contract.json');

    try {
      writeScene(scenePath);
      writeFileSync(
        catalogPath,
        `${JSON.stringify(
          {
            version: 1,
            levels: [
              {
                id: 'fixture_branch',
                scene_path: scenePath,
                tags: ['representative', 'branch'],
                coverage_status: 'representative',
              },
            ],
          },
          null,
          2,
        )}\n`,
      );
      writeFileSync(
        proceduralPath,
        `${JSON.stringify(
          {
            version: 1,
            levels: [
              {
                id: 'generated_branch',
                scene_strategy: 'generated_schema',
                runtime_layout: {
                  room: { width: 760, height: 432, shape_profile: 'branch_room' },
                  spawns: { default: { x: 96, y: 368 } },
                  doors: { east: { x: 704, y: 368 } },
                  floor_segments: [{ id: 'FloorMain', position: { x: 380, y: 432 }, size: { x: 760, y: 32 } }],
                  platforms: [{ id: 'Platform', position: { x: 380, y: 320 }, size: { x: 160, y: 24 } }],
                  content: {
                    enemies: [{ id: 'Enemy', position: { x: 320, y: 368 } }],
                    heals: [{ id: 'Heal', amount: 1, reward_type: 'health', position: { x: 520, y: 368 } }],
                    collectibles: [],
                    hazards: [],
                    ability_gates: [{ id: 'Gate', required_ability_type: 'fire', position: { x: 500, y: 368 } }],
                    goals: [],
                  },
                },
              },
            ],
          },
          null,
          2,
        )}\n`,
      );
      writeContract(contractPath, catalogPath, proceduralPath);

      const result = spawnSync(process.execPath, ['scripts/check-godot-content-budget.mjs', '--contract', contractPath, '--json'], {
        cwd: repoRoot,
        encoding: 'utf8',
      });

      expect(result.status).toBe(0);
      const report = JSON.parse(result.stdout) as {
        failed_checks: unknown[];
        level_count: number;
        profile_counts: Record<string, number>;
        levels: Array<{ id: string; metrics: Record<string, number> }>;
      };
      expect(report.failed_checks).toEqual([]);
      expect(report.level_count).toBe(2);
      expect(report.profile_counts.branch).toBe(2);
      expect(report.levels.find((level) => level.id === 'fixture_branch')?.metrics).toMatchObject({
        enemy_count: 1,
        heal_amount: 2,
        ability_gate_count: 1,
        platform_count: 1,
        door_preview_spacing_px: 144,
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('calculates scene door preview spacing between doors instead of nearby return spawns', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-content-budget-door-spacing-'));
    const scenePath = join(tempDir, 'fixture_return_spawn.tscn');
    const catalogPath = join(tempDir, 'level_catalog.source.json');
    const proceduralPath = join(tempDir, 'procedural_levels.json');
    const contractPath = join(tempDir, 'content_budget_contract.json');

    try {
      writeFileSync(
        scenePath,
        `[gd_scene load_steps=6 format=3]

[ext_resource type="Script" path="res://scripts/level/markers/PlayerSpawn.gd" id="1_spawn"]
[ext_resource type="Script" path="res://scripts/level/markers/DoorMarker.gd" id="2_door"]
[ext_resource type="Script" path="res://scripts/level/markers/EnemySpawnMarker.gd" id="3_enemy"]
[ext_resource type="Script" path="res://scripts/level/markers/HealMarker.gd" id="4_heal"]

[sub_resource type="RectangleShape2D" id="RectangleShape2D_floor"]
size = Vector2(760, 32)

[node name="FixtureReturnSpawn" type="Node2D"]

[node name="PlayerSpawnNearReturnDoor" type="Node2D" parent="."]
position = Vector2(744, 368)
script = ExtResource("1_spawn")
spawn_id = "north"

[node name="DoorToGoal" type="Node2D" parent="."]
position = Vector2(220, 368)
script = ExtResource("2_door")
door_id = "fixture_goal"
target_level_id = "goal"
target_spawn_id = "default"

[node name="DoorToReturnBranch" type="Node2D" parent="."]
position = Vector2(800, 368)
script = ExtResource("2_door")
door_id = "fixture_return"
target_level_id = "branch"
target_spawn_id = "south"

[node name="EnemySpawnMarker" type="Node2D" parent="."]
position = Vector2(420, 400)
script = ExtResource("3_enemy")
spawn_id = "fixture_enemy"
enemy_type = "simple_ground"

[node name="HealMarker" type="Node2D" parent="."]
position = Vector2(540, 368)
script = ExtResource("4_heal")
heal_id = "fixture_heal"
amount = 1
reward_type = "health"

[node name="Floor" type="StaticBody2D" parent="."]
position = Vector2(380, 432)

[node name="CollisionShape2D" type="CollisionShape2D" parent="Floor"]
shape = SubResource("RectangleShape2D_floor")
`,
      );
      writeFileSync(
        catalogPath,
        `${JSON.stringify(
          {
            version: 1,
            levels: [{ id: 'fixture_return_spawn', scene_path: scenePath, tags: [], coverage_status: 'representative' }],
          },
          null,
          2,
        )}\n`,
      );
      writeFileSync(proceduralPath, `${JSON.stringify({ version: 1, levels: [] }, null, 2)}\n`);
      writeContract(contractPath, catalogPath, proceduralPath);

      const result = spawnSync(process.execPath, ['scripts/check-godot-content-budget.mjs', '--contract', contractPath, '--json'], {
        cwd: repoRoot,
        encoding: 'utf8',
      });

      expect(result.status).toBe(0);
      const report = JSON.parse(result.stdout) as {
        levels: Array<{ id: string; metrics: Record<string, number> }>;
      };
      expect(report.levels.find((level) => level.id === 'fixture_return_spawn')?.metrics.door_preview_spacing_px).toBe(580);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('fails with useful evidence when a branch level is an empty corridor', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-content-budget-empty-'));
    const scenePath = join(tempDir, 'empty_branch.tscn');
    const catalogPath = join(tempDir, 'level_catalog.source.json');
    const proceduralPath = join(tempDir, 'procedural_levels.json');
    const contractPath = join(tempDir, 'content_budget_contract.json');

    try {
      writeFileSync(
        scenePath,
        `[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://scripts/level/markers/LevelPacingMarker.gd" id="1_pacing"]

[node name="EmptyBranch" type="Node2D"]

[node name="BranchPacingMarker" type="Node2D" parent="."]
script = ExtResource("1_pacing")
pacing_profile = "branch"
critical_path_px = 120.0
door_preview_spacing_px = 32.0
`,
      );
      writeFileSync(
        catalogPath,
        `${JSON.stringify(
          {
            version: 1,
            levels: [{ id: 'empty_branch', scene_path: scenePath, tags: ['representative'], coverage_status: 'representative' }],
          },
          null,
          2,
        )}\n`,
      );
      writeFileSync(proceduralPath, `${JSON.stringify({ version: 1, levels: [] }, null, 2)}\n`);
      writeContract(contractPath, catalogPath, proceduralPath);

      const result = spawnSync(process.execPath, ['scripts/check-godot-content-budget.mjs', '--contract', contractPath, '--json'], {
        cwd: repoRoot,
        encoding: 'utf8',
      });

      expect(result.status).toBe(1);
      const report = JSON.parse(result.stdout) as { failed_checks: { level_id: string; metric: string; rule: string }[] };
      expect(report.failed_checks).toContainEqual(
        expect.objectContaining({
          level_id: 'empty_branch',
          metric: 'content_score',
          rule: 'profile_min',
        }),
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('validates canonical hub, branch, arena, reliquary, terminal, and generated content profiles', () => {
    const result = spawnSync(process.execPath, ['scripts/check-godot-content-budget.mjs', '--json'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout) as {
      failed_checks: unknown[];
      level_count: number;
      profile_counts: Record<string, number>;
    };
    expect(report.failed_checks).toEqual([]);
    expect(report.level_count).toBeGreaterThanOrEqual(140);
    expect(report.profile_counts).toMatchObject({
      hub: expect.any(Number),
      branch: expect.any(Number),
      arena: expect.any(Number),
      reliquary: expect.any(Number),
      terminal: expect.any(Number),
    });
  });
});
