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

describe('Godot level graph', () => {
  it('defines a static level graph command and contract', () => {
    const scripts = readPackageScripts();

    expect(scripts['godot:level-graph']).toBe('node scripts/check-godot-level-graph.mjs');
    expect(scripts['check:godot']).toContain('godot:level-graph');
    expect(existsSync(join(repoRoot, 'scripts', 'check-godot-level-graph.mjs'))).toBe(true);
    expect(existsSync(join(repoRoot, 'godot', 'tests', 'level_graph_contract.json'))).toBe(true);

    const contract = JSON.parse(
      readFileSync(join(repoRoot, 'godot', 'tests', 'level_graph_contract.json'), 'utf8'),
    ) as {
      version?: number;
      start_level_id?: string;
      final_level_id?: string;
      required_reachable_level_ids?: string[];
      cluster_keystone_order?: { item_id: string }[];
      forbidden_goal_shortcuts?: Array<{ from_level_id: string; door_id: string; required_keystone_item_id: string }>;
      rules?: Record<string, { severity?: string }>;
    };
    expect(contract.version).toBe(1);
    expect(contract.start_level_id).toBe('central_hub');
    expect(contract.final_level_id).toBe('goal_sanctum');
    expect(contract.required_reachable_level_ids).toEqual(expect.arrayContaining(['goal_sanctum', 'labyrinth_132']));
    expect(contract.cluster_keystone_order?.map((entry) => entry.item_id)).toEqual([
      'forest-keystone',
      'ice-keystone',
      'fire-keystone',
      'cave-keystone',
    ]);
    expect(contract.forbidden_goal_shortcuts).toContainEqual({
      from_level_id: 'mirror_corridor',
      door_id: 'mirror_corridor_to_goal_sanctum',
      required_keystone_item_id: 'cave-keystone',
    });
    expect(contract.rules?.final_level_reachable?.severity).toBe('error');
    expect(contract.rules?.door_target_spawn_exists?.severity).toBe('error');
    expect(contract.rules?.forbidden_goal_shortcut_locked?.severity).toBe('error');
  });

  it('extracts graph edges, requirements, collectibles, and final-level paths from scenes', () => {
    const levelsDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-level-graph-'));
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
target_spawn_id = "entry"
`,
    );
    writeFileSync(
      join(levelsDir, 'branch_room.tscn'),
      `${sceneHeader}
[node name="BranchRoom" type="Node2D"]

[node name="PlayerSpawnEntry" type="Node2D" parent="."]
script = ExtResource("1_spawn")
spawn_id = "entry"

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
          'scripts/check-godot-level-graph.mjs',
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
        paths: Record<string, string[]>;
        levels: { id: string; collectibles: { item_id: string }[]; doors: { requirements: Record<string, string> }[] }[];
      };
      expect(report.failed_checks).toEqual([]);
      expect(report.paths.central_hub_to_goal_sanctum).toEqual(['central_hub', 'branch_room', 'goal_sanctum']);
      expect(report.levels.find((level) => level.id === 'branch_room')?.collectibles).toContainEqual(
        expect.objectContaining({ item_id: 'branch-key' }),
      );
      expect(report.levels.find((level) => level.id === 'branch_room')?.doors).toContainEqual(
        expect.objectContaining({
          requirements: expect.objectContaining({ required_item_id: 'branch-key' }),
        }),
      );
    } finally {
      rmSync(levelsDir, { recursive: true, force: true });
    }
  });

  it('fails on missing target spawns and unreachable final levels', () => {
    const levelsDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-level-graph-broken-'));
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
target_spawn_id = "missing"
`,
    );
    writeFileSync(
      join(levelsDir, 'branch_room.tscn'),
      `${sceneHeader}
[node name="BranchRoom" type="Node2D"]

[node name="PlayerSpawn" type="Node2D" parent="."]
script = ExtResource("1_spawn")
spawn_id = "default"
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
          'scripts/check-godot-level-graph.mjs',
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
      };
      expect(report.failed_checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ rule: 'door_target_spawn_exists' }),
          expect.objectContaining({ rule: 'final_level_reachable' }),
        ]),
      );
    } finally {
      rmSync(levelsDir, { recursive: true, force: true });
    }
  });

  it('validates the canonical Godot mainline route and generated graph', () => {
    const result = spawnSync(process.execPath, ['scripts/check-godot-level-graph.mjs', '--json'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout) as {
      level_count: number;
      edge_count: number;
      failed_checks: unknown[];
      paths: Record<string, string[]>;
      reachable_level_ids: string[];
      item_sources: Record<string, string[]>;
      requirement_index: Record<string, string[]>;
      levels: Array<{ id: string; doors: Array<{ id: string; requirements: Record<string, string> }> }>;
    };
    expect(report.level_count).toBeGreaterThanOrEqual(150);
    expect(report.edge_count).toBeGreaterThanOrEqual(150);
    expect(report.failed_checks).toEqual([]);
    expect(report.paths.central_hub_to_goal_sanctum).toEqual(
      expect.arrayContaining(['central_hub', 'mirror_corridor', 'goal_sanctum']),
    );
    expect(report.reachable_level_ids).toEqual(expect.arrayContaining(['labyrinth_132', 'forest_reliquary']));
    expect(report.item_sources['forest-keystone']).toContain('forest_reliquary');
    expect(report.requirement_index['required_keystone_item_id:forest-keystone']).toContain('labyrinth_006');
    expect(report.levels.find((level) => level.id === 'mirror_corridor')?.doors).toContainEqual(
      expect.objectContaining({
        id: 'mirror_corridor_to_goal_sanctum',
        requirements: expect.objectContaining({ required_keystone_item_id: 'cave-keystone' }),
      }),
    );
  });
});
