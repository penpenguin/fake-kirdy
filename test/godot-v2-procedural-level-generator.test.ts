import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, '..');
const proceduralLevelsPath = join(repoRoot, 'godot', 'levels', 'generated', 'procedural_levels.json');

type ProceduralLevelExport = {
  version?: number;
  generated_from?: string;
  validation?: {
    branch_density_minimum?: number;
    branch_density_by_cluster?: Record<string, {
      level_count?: number;
      branch_level_count?: number;
      ratio?: number;
    }>;
    multi_shape_layout_minimum?: number;
    multi_shape_layouts_by_shape?: Record<string, number>;
    branch_exit_rule_count?: number;
  };
  levels?: Array<{
    id?: string;
    stage_id?: string;
    scene_strategy?: string;
    layout?: {
      rows?: number;
      columns?: number;
      tile_size?: number;
    };
    runtime_layout?: {
      tile_size?: { x?: number; y?: number };
      grid?: { columns?: number; rows?: number };
      room?: { width?: number; height?: number; variant?: string; shape_profile?: string };
      camera_bounds?: { position?: { x?: number; y?: number }; size?: { x?: number; y?: number } };
      spawns?: Record<string, { x?: number; y?: number }>;
      doors?: Record<string, { x?: number; y?: number }>;
      safety?: {
        door_trigger_radius?: number;
        min_spawn_door_distance?: number;
        door_safe_radius?: number;
        min_platform_clearance_px?: number;
        max_bottom_floor_gap_px?: number;
        vertical_transition?: {
          enabled?: boolean;
          max_spawn_drop_distance?: number;
          spawn_clearance_radius?: number;
          protected_spawn_ids?: string[];
          landing_surface_ids?: string[];
        };
      };
      floor?: { id?: string; position?: { x?: number; y?: number }; size?: { x?: number; y?: number } };
      floor_segments?: Array<{ id?: string; position?: { x?: number; y?: number }; size?: { x?: number; y?: number } }>;
      platforms?: Array<{ id?: string; position?: { x?: number; y?: number }; size?: { x?: number; y?: number } }>;
      branch_exit_rules?: Array<{
        direction?: string;
        target_level_id?: string;
        rule_type?: string;
        required_item_id?: string;
        required_keystone_item_id?: string;
      }>;
      content?: {
        objective?: {
          objective_type?: string;
          objective_id?: string;
          required_item_id?: string;
          required_ability_type?: string;
        };
        enemies?: Array<{
          id?: string;
          spawn_id?: string;
          enemy_type?: string;
          ability_type?: string;
          contact_damage?: number;
          attack_damage?: number;
          attack_radius?: number;
          attack_cooldown_ms?: number;
          position?: { x?: number; y?: number };
        }>;
        heals?: Array<{
          id?: string;
          heal_id?: string;
          amount?: number;
          reward_type?: string;
          position?: { x?: number; y?: number };
        }>;
        collectibles?: Array<{
          id?: string;
          collectible_id?: string;
          item_id?: string;
          trigger_radius?: number;
          position?: { x?: number; y?: number };
        }>;
        goals?: Array<{
          id?: string;
          goal_id?: string;
          result_label?: string;
          trigger_radius?: number;
          position?: { x?: number; y?: number };
        }>;
        hazards?: Array<{
          id?: string;
          hazard_id?: string;
          hazard_type?: string;
          hazard_visual_style?: string;
          hazard_texture_path?: string;
          damage?: number;
          trigger_radius?: number;
          position?: { x?: number; y?: number };
        }>;
        ability_gates?: Array<{
          id?: string;
          gate_id?: string;
          required_ability_type?: string;
          gate_visual_style?: string;
          gate_texture_path?: string;
          hint_text?: string;
          gate_effect?: string;
          trigger_radius?: number;
          position?: { x?: number; y?: number };
        }>;
      };
    };
    metadata?: Record<string, string | number | boolean>;
    stage_neighbors?: Record<string, string>;
    neighbors?: Record<string, string>;
  }>;
};

describe('Godot v2 procedural level schema generation', () => {
  it('generates a checked-in Godot schema for every Phaser procedural stage', () => {
    const output = execFileSync('node', ['scripts/generate-godot-procedural-levels.mjs', '--check'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(output).toContain('procedural_levels.json is up to date');
    expect(output).toContain('exported 132 procedural levels');
    expect(existsSync(proceduralLevelsPath)).toBe(true);
  });

  it('maps Phaser procedural topology into Godot level ids without requiring hand-authored scenes', () => {
    const generated = JSON.parse(readFileSync(proceduralLevelsPath, 'utf8')) as ProceduralLevelExport;
    const levels = new Map(generated.levels?.map((level) => [level.id, level]));

    expect(generated.version).toBe(1);
    expect(generated.generated_from).toBe('godot/levels/stage_manifest.json');
    expect(generated.levels).toHaveLength(132);

    expect(levels.get('labyrinth_001')).toMatchObject({
      stage_id: 'labyrinth-001',
      scene_strategy: 'generated_schema',
      layout: {
        rows: 12,
        columns: 18,
        tile_size: 32,
      },
      metadata: {
        cluster: 'forest',
        difficulty: 2,
      },
      stage_neighbors: {
        west: 'forest-area',
        east: 'labyrinth-002',
      },
      neighbors: {
        west: 'forest_area',
        east: 'labyrinth_002',
      },
    });

    expect(levels.get('labyrinth_005')?.neighbors?.east).toBe('forest_reliquary');
    expect(levels.get('labyrinth_006')?.neighbors).toMatchObject({
      west: 'ice_area',
      east: 'labyrinth_007',
    });
    expect(levels.get('labyrinth_010')?.neighbors?.east).toBe('ice_reliquary');
    expect(levels.get('labyrinth_033')?.neighbors?.south).toBe('cave_area');
    expect(levels.get('labyrinth_050')?.neighbors?.east).toBe('ruins_reliquary');
    expect(levels.get('labyrinth_051')?.neighbors?.south).toBe('sky_sanctum');
    expect(levels.get('labyrinth_069')?.neighbors?.north).toBe('labyrinth_068');
    expect(levels.get('labyrinth_132')?.neighbors?.west).toBe('labyrinth_131');
  });

  it('exports runtime layout metadata for generated rooms instead of leaving placement in GDScript constants', () => {
    const generated = JSON.parse(readFileSync(proceduralLevelsPath, 'utf8')) as ProceduralLevelExport;
    const levels = new Map(generated.levels?.map((level) => [level.id, level]));
    const iceRoom = levels.get('labyrinth_010');
    const terminalRoom = levels.get('labyrinth_132');

    expect(iceRoom?.runtime_layout).toMatchObject({
      tile_size: { x: 32, y: 32 },
      grid: { columns: 18, rows: 12 },
      room: { width: 760, height: 432 },
      camera_bounds: {
        position: { x: 380, y: 178 },
        size: { x: 840, y: 540 },
      },
      spawns: {
        default: { x: 96, y: 368 },
        west: { x: 112, y: 368 },
        east: { x: 624, y: 368 },
      },
      doors: {
        west: { x: 16, y: 368 },
        east: { x: 704, y: 368 },
      },
      safety: {
        door_trigger_radius: 48,
        min_spawn_door_distance: 64,
        door_safe_radius: 96,
        min_platform_clearance_px: 36,
        max_bottom_floor_gap_px: 0,
      },
    });
    expect(iceRoom?.runtime_layout?.platforms?.map((platform) => platform.id)).toEqual([
      'GeneratedPlatformLow',
      'GeneratedPlatformHigh',
    ]);
    expect(terminalRoom?.runtime_layout?.platforms?.map((platform) => platform.id)).toEqual([]);
  });

  it('merges map builder runtime layout overrides into generated schema output without changing topology metadata', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-procedural-'));
    const outputPath = join(tempDir, 'procedural_levels.json');
    const overridesPath = join(tempDir, 'procedural_level_overrides.source.json');
    writeFileSync(overridesPath, `${JSON.stringify({
      version: 1,
      levels: {
        'labyrinth-010': {
          runtime_layout: {
            camera_bounds: {
              position: { x: 384, y: 188 },
              size: { x: 880, y: 560 },
            },
            platforms: [
              {
                id: 'BuilderPlatformLow',
                position: { x: 360, y: 340 },
                size: { x: 160, y: 24 },
              },
            ],
            visuals: {
              profile_id: 'ice_default',
            },
          },
        },
      },
    }, null, 2)}\n`);

    execFileSync('node', [
      'scripts/generate-godot-procedural-levels.mjs',
      '--out',
      outputPath,
      '--overrides',
      overridesPath,
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    const generated = JSON.parse(readFileSync(outputPath, 'utf8')) as ProceduralLevelExport;
    const levels = new Map(generated.levels?.map((level) => [level.id, level]));
    const iceRoom = levels.get('labyrinth_010');

    expect(iceRoom).toMatchObject({
      id: 'labyrinth_010',
      stage_id: 'labyrinth-010',
      scene_strategy: 'generated_schema',
      metadata: {
        cluster: 'ice',
        difficulty: 3,
      },
      neighbors: {
        east: 'ice_reliquary',
      },
    });
    expect(iceRoom?.runtime_layout?.camera_bounds).toEqual({
      position: { x: 384, y: 188 },
      size: { x: 880, y: 560 },
    });
    expect(iceRoom?.runtime_layout?.platforms).toEqual([
      {
        id: 'BuilderPlatformLow',
        position: { x: 360, y: 340 },
        size: { x: 160, y: 24 },
      },
    ]);
    expect(iceRoom?.runtime_layout).toMatchObject({
      visuals: {
        profile_id: 'ice_default',
      },
    });
  });

  it('rejects map builder overrides that try to change generated topology or unsafe runtime sections', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-procedural-'));
    const outputPath = join(tempDir, 'procedural_levels.json');
    const overridesPath = join(tempDir, 'procedural_level_overrides.source.json');
    writeFileSync(overridesPath, `${JSON.stringify({
      version: 1,
      levels: {
        'labyrinth-010': {
          neighbors: {
            east: 'goal_sanctum',
          },
          runtime_layout: {
            branch_exit_rules: [],
          },
        },
      },
    }, null, 2)}\n`);

    const result = spawnSync('node', [
      'scripts/generate-godot-procedural-levels.mjs',
      '--out',
      outputPath,
      '--overrides',
      overridesPath,
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('cannot be overridden by map builder');
  });

  it('exports multi-shape generated room geometry as schema-owned floor segments', () => {
    const generated = JSON.parse(readFileSync(proceduralLevelsPath, 'utf8')) as ProceduralLevelExport;
    const levels = new Map(generated.levels?.map((level) => [level.id, level]));
    const branchRoom = levels.get('labyrinth_001');
    const reliquaryRoute = levels.get('labyrinth_010');
    const terminalRoom = levels.get('labyrinth_132');

    expect(generated.validation?.multi_shape_layout_minimum).toBe(4);
    expect(generated.validation?.multi_shape_layouts_by_shape).toMatchObject({
      branch_room: expect.any(Number),
      reliquary_gate: expect.any(Number),
      vertical_route: expect.any(Number),
      terminal_goal: expect.any(Number),
    });

    expect(branchRoom?.runtime_layout?.room?.shape_profile).toBe('branch_room');
    expect(branchRoom?.runtime_layout?.floor_segments?.map((segment) => segment.id)).toEqual([
      'FloorMain',
      'FloorBranchLeft',
      'FloorBranchHigh',
    ]);

    expect(reliquaryRoute?.runtime_layout?.room?.shape_profile).toBe('reliquary_gate');
    expect(reliquaryRoute?.runtime_layout?.floor_segments?.map((segment) => segment.id)).toEqual([
      'FloorMain',
      'FloorGateApproach',
    ]);

    expect(terminalRoom?.runtime_layout?.room?.shape_profile).toBe('terminal_goal');
    expect(terminalRoom?.runtime_layout?.floor_segments?.map((segment) => segment.id)).toEqual([
      'FloorMain',
      'FloorGoalDais',
    ]);
  });

  it('exports generated gameplay marker placement in runtime layout metadata', () => {
    const generated = JSON.parse(readFileSync(proceduralLevelsPath, 'utf8')) as ProceduralLevelExport;
    const levels = new Map(generated.levels?.map((level) => [level.id, level]));
    const iceRoom = levels.get('labyrinth_010');
    const terminalRoom = levels.get('labyrinth_132');

    expect(iceRoom?.runtime_layout?.content).toMatchObject({
      enemies: [
        {
          id: 'GeneratedEnemySpawn',
          spawn_id: 'labyrinth_010_generated_enemy',
          enemy_type: 'frost_flyer',
          ability_type: 'frost',
          contact_damage: 1,
          attack_damage: 1,
          attack_radius: 112,
          attack_cooldown_ms: 4000,
          position: { x: 256, y: 368 },
        },
        {
          id: 'GeneratedFlyingEnemySpawn',
          spawn_id: 'labyrinth_010_generated_flying',
          enemy_type: 'frost_flyer',
          ability_type: 'frost',
          contact_damage: 1,
          attack_damage: 1,
          attack_radius: 148,
          attack_cooldown_ms: 4000,
          position: { x: 520, y: 320 },
        },
      ],
      collectibles: [
        {
          id: 'GeneratedCollectibleMarker',
          collectible_id: 'labyrinth_010_generated_shard',
          item_id: 'ice-generated-shard',
          trigger_radius: 48,
          position: { x: 592, y: 368 },
        },
      ],
      goals: [],
    });
    expect(iceRoom?.runtime_layout?.content?.heals).toEqual(expect.arrayContaining([
      {
        id: 'GeneratedHealMarkerRoute',
        heal_id: 'labyrinth_010_generated_heal',
        amount: 3,
        reward_type: 'health',
        position: { x: 520, y: 368 },
      },
      {
        id: 'GeneratedHealMarkerHealth',
        heal_id: 'labyrinth_010_dead_end_health',
        dead_end_id: 'labyrinth_010_dead_end_health',
        amount: 1,
        reward_type: 'health',
        position: { x: 112, y: 304 },
      },
      {
        id: 'GeneratedHealMarkerMaxHealth',
        heal_id: 'labyrinth_010_dead_end_max_health',
        dead_end_id: 'labyrinth_010_dead_end_max_health',
        amount: 1,
        reward_type: 'max-health',
        position: { x: 496, y: 80 },
      },
      {
        id: 'GeneratedHealMarkerRevive',
        heal_id: 'labyrinth_010_dead_end_revive',
        dead_end_id: 'labyrinth_010_dead_end_revive',
        amount: 1,
        reward_type: 'revive',
        position: { x: 304, y: 272 },
      },
    ]));
    expect(terminalRoom?.runtime_layout?.content?.goals).toEqual([
      {
        id: 'GeneratedGoalMarker',
        goal_id: 'labyrinth_132_generated_goal',
        result_label: 'complete',
        trigger_radius: 48,
        position: { x: 224, y: 368 },
      },
    ]);
  });

  it('varies generated room objectives and adds generated hazards and ability gates', () => {
    const generated = JSON.parse(readFileSync(proceduralLevelsPath, 'utf8')) as ProceduralLevelExport;
    const levels = new Map(generated.levels?.map((level) => [level.id, level]));
    const forestRoute = levels.get('labyrinth_002');
    const iceReliquaryRoute = levels.get('labyrinth_010');
    const fireReliquaryRoute = levels.get('labyrinth_032');
    const ruinsRoute = levels.get('labyrinth_047');
    const terminalRoom = levels.get('labyrinth_132');

    expect(forestRoute?.runtime_layout?.content?.objective).toMatchObject({
      objective_type: 'defeat_enemies',
      objective_id: 'labyrinth_002_defeat_enemies',
    });
    expect(forestRoute?.runtime_layout?.content?.hazards).toEqual(expect.arrayContaining([
      expect.objectContaining({
        hazard_id: 'labyrinth_002_spike_hazard',
        hazard_type: 'spike',
      }),
    ]));

    expect(iceReliquaryRoute?.runtime_layout?.content?.objective).toMatchObject({
      objective_type: 'collect_key',
      required_item_id: 'ice-generated-shard',
    });
    expect(iceReliquaryRoute?.runtime_layout?.content?.ability_gates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        gate_id: 'labyrinth_010_ice_gate',
        required_ability_type: 'ice',
        gate_effect: 'freeze_water',
      }),
    ]));

    expect(fireReliquaryRoute?.runtime_layout?.content?.ability_gates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        required_ability_type: 'fire',
        gate_effect: 'melt_ice',
      }),
    ]));
    expect(ruinsRoute?.runtime_layout?.content?.ability_gates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        required_ability_type: 'stone',
        gate_effect: 'press_switch',
      }),
    ]));
    expect(terminalRoom?.runtime_layout?.content?.objective).toMatchObject({
      objective_type: 'goal',
      objective_id: 'labyrinth_132_goal',
    });
  });

  it('exports texture-backed hazard and ability gate metadata for labyrinth_011 instead of fallback markers', () => {
    const generated = JSON.parse(readFileSync(proceduralLevelsPath, 'utf8')) as ProceduralLevelExport;
    const levels = new Map(generated.levels?.map((level) => [level.id, level]));
    const labyrinth011 = levels.get('labyrinth_011');
    const loader = readFileSync(join(repoRoot, 'godot', 'scripts', 'level', 'LevelLoader.gd'), 'utf8');
    const generator = readFileSync(join(repoRoot, 'scripts', 'generate-godot-procedural-levels.mjs'), 'utf8');

    expect(labyrinth011?.metadata?.cluster).toBe('fire');
    expect(labyrinth011?.runtime_layout?.content?.hazards).toEqual(expect.arrayContaining([
      expect.objectContaining({
        hazard_id: 'labyrinth_011_lava_hazard',
        hazard_type: 'lava',
        hazard_visual_style: 'lava_texture',
        hazard_texture_path: 'res://resources/assets/images/hazards/lava-hazard.webp',
      }),
    ]));
    expect(labyrinth011?.runtime_layout?.content?.ability_gates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        gate_id: 'labyrinth_011_fire_gate',
        required_ability_type: 'fire',
        gate_visual_style: 'fire_gate',
        gate_texture_path: 'res://resources/assets/images/ui/ability-gate-fire.webp',
        hint_text: 'Fire Gate',
      }),
    ]));
    expect(loader).toContain('hazard.set("hazard_visual_style"');
    expect(loader).toContain('hazard.set("hazard_texture_path"');
    expect(loader).toContain('gate.set("gate_visual_style"');
    expect(loader).toContain('gate.set("gate_texture_path"');
    expect(generator).toContain('hazard_texture_path');
    expect(generator).toContain('gate_texture_path');
  });

  it('keeps authored and generated levels protected by camera bounds clamps at screen edges', () => {
    const generated = JSON.parse(readFileSync(proceduralLevelsPath, 'utf8')) as ProceduralLevelExport;
    const session = readFileSync(join(repoRoot, 'godot', 'scripts', 'session', 'GameSession.gd'), 'utf8');
    const tutorial = readFileSync(join(repoRoot, 'godot', 'levels', 'tutorial_room.tscn'), 'utf8');
    const labyrinth011 = generated.levels?.find((level) => level.id === 'labyrinth_011');

    expect(tutorial).toContain('spawn_id = "left_edge_check"');
    expect(tutorial).toContain('spawn_id = "right_edge_check"');
    expect(labyrinth011?.runtime_layout?.camera_bounds).toMatchObject({
      position: { x: 380, y: 178 },
      size: { x: 840, y: 540 },
    });
    expect(session).toContain('func constrain_player_to_camera_bounds() -> void:');
    expect(session).toContain('var min_position := center - bounds_size * 0.5 + Vector2(player_boundary_padding, player_boundary_padding)');
    expect(session).toContain('var max_position := center + bounds_size * 0.5 - Vector2(player_boundary_padding, player_boundary_padding)');
    expect(session).toContain('player.boundary.clamped');
    expect(session).toContain('"recovery_mode": "stop_velocity"');
    expect(session).not.toContain('player.global_position = recovery_position\n    player.velocity = Vector2.ZERO\n    trace_recorder.call("record_player_event", "player.boundary.clamped"');
  });

  it('publishes branch-exit rules and locks generated reliquary exits behind local route shards', () => {
    const generated = JSON.parse(readFileSync(proceduralLevelsPath, 'utf8')) as ProceduralLevelExport;
    const levels = new Map(generated.levels?.map((level) => [level.id, level]));
    const iceReliquaryRoute = levels.get('labyrinth_010');
    const skyCrossClusterRoute = levels.get('labyrinth_051');
    const loader = readFileSync(join(repoRoot, 'godot', 'scripts', 'level', 'LevelLoader.gd'), 'utf8');

    expect(generated.validation?.branch_exit_rule_count).toBeGreaterThan(0);
    expect(iceReliquaryRoute?.runtime_layout?.branch_exit_rules).toEqual(expect.arrayContaining([
      {
        direction: 'east',
        target_level_id: 'ice_reliquary',
        rule_type: 'reliquary_requires_route_shard',
        required_item_id: 'ice-generated-shard',
      },
    ]));
    expect(skyCrossClusterRoute?.runtime_layout?.branch_exit_rules).toEqual(expect.arrayContaining([
      {
        direction: 'south',
        target_level_id: 'sky_sanctum',
        rule_type: 'cross_cluster_keystone',
        required_keystone_item_id: 'cave-keystone',
      },
    ]));
    expect(loader).toContain('func get_generated_branch_exit_rule(runtime_layout: Dictionary, direction: String) -> Dictionary:');
    expect(loader).toContain('var required_item_id := String(branch_rule.get("required_item_id", ""))');
    expect(loader).toContain('door.set("required_item_id", required_item_id)');
    expect(loader).toContain('door.set("required_keystone_item_id", String(branch_rule.get("required_keystone_item_id", "")))');
    expect(loader).not.toContain('required_item_id = String(branch_rule.get("required_keystone_item_id", ""))');
  });

  it('varies generated enemy encounters with multiple enemy roles and attack timing', () => {
    const generated = JSON.parse(readFileSync(proceduralLevelsPath, 'utf8')) as ProceduralLevelExport;
    const levels = new Map(generated.levels?.map((level) => [level.id, level]));
    const iceReliquaryRoute = levels.get('labyrinth_010');
    const skyRoute = levels.get('labyrinth_051');
    const terminalRoom = levels.get('labyrinth_132');

    expect(iceReliquaryRoute?.runtime_layout?.content?.enemies).toEqual(expect.arrayContaining([
      expect.objectContaining({
        spawn_id: 'labyrinth_010_generated_enemy',
        enemy_type: 'frost_flyer',
        attack_damage: 1,
        attack_radius: 112,
        attack_cooldown_ms: 4000,
      }),
      expect.objectContaining({
        spawn_id: 'labyrinth_010_generated_flying',
        enemy_type: 'frost_flyer',
        attack_radius: 148,
      }),
    ]));

    expect(skyRoute?.runtime_layout?.content?.enemies).toEqual(expect.arrayContaining([
      expect.objectContaining({
        spawn_id: 'labyrinth_051_generated_elite',
        enemy_type: 'spark_wisp',
        contact_damage: 1,
        attack_damage: 1,
        attack_cooldown_ms: 4000,
      }),
    ]));
    expect(terminalRoom?.runtime_layout?.content?.enemies).toEqual([
      expect.objectContaining({
        spawn_id: 'labyrinth_132_final_boss',
        enemy_type: 'spark_wisp',
        ability_type: 'spark',
        enemy_group_id: 'labyrinth_132_final_guard',
        boss_id: 'labyrinth_132_final_boss',
        attack_cooldown_ms: 4000,
      }),
    ]);
  });

  it('marks north/south procedural rooms with vertical-route layout metadata', () => {
    const generated = JSON.parse(readFileSync(proceduralLevelsPath, 'utf8')) as ProceduralLevelExport;
    const levels = new Map(generated.levels?.map((level) => [level.id, level]));
    const southExitRoom = levels.get('labyrinth_033');
    const northLinkRoom = levels.get('labyrinth_069');

    expect(southExitRoom?.neighbors?.south).toBe('cave_area');
    expect(southExitRoom?.runtime_layout?.room?.variant).toBe('vertical_route');
    expect(southExitRoom?.runtime_layout?.platforms?.map((platform) => platform.id)).toContain(
      'GeneratedPlatformVerticalStep',
    );

    expect(northLinkRoom?.neighbors?.north).toBe('labyrinth_068');
    expect(northLinkRoom?.runtime_layout?.room?.variant).toBe('vertical_route');
    expect(northLinkRoom?.runtime_layout?.platforms?.map((platform) => platform.id)).toEqual([
      'GeneratedPlatformVerticalLanding',
      'GeneratedPlatformVerticalStep',
    ]);
  });

  it('adds landing and clearance metadata for generated vertical transitions', () => {
    const generated = JSON.parse(readFileSync(proceduralLevelsPath, 'utf8')) as ProceduralLevelExport;

    for (const level of generated.levels ?? []) {
      const verticalDirections = ['north', 'south'].filter((direction) => level.neighbors?.[direction] !== undefined);
      if (verticalDirections.length === 0) {
        continue;
      }

      const layout = level.runtime_layout;
      const verticalSafety = layout?.safety?.vertical_transition;
      const maxDropDistance = Number(verticalSafety?.max_spawn_drop_distance);

      expect(verticalSafety?.enabled, `${level.id} missing vertical safety flag`).toBe(true);
      expect(verticalSafety?.spawn_clearance_radius, `${level.id} missing vertical spawn clearance`).toBe(72);
      expect(maxDropDistance, `${level.id} missing vertical max drop`).toBe(96);
      expect(verticalSafety?.protected_spawn_ids).toEqual(['north', 'south']);
      expect(verticalSafety?.landing_surface_ids).toEqual([
        'GeneratedPlatformVerticalLanding',
        'Floor',
      ]);

      const landingSurfaces = [
        layout?.floor,
        ...(layout?.platforms ?? []),
      ].filter((surface): surface is NonNullable<typeof surface> => surface !== undefined);

      for (const spawnId of verticalSafety?.protected_spawn_ids ?? []) {
        const spawn = layout?.spawns?.[spawnId];
        expect(spawn, `${level.id} missing ${spawnId} protected spawn`).toBeTruthy();

        const reachableLanding = landingSurfaces.find((surface) => {
          const surfaceTop = Number(surface.position?.y) - Number(surface.size?.y) / 2;
          const halfWidth = Number(surface.size?.x) / 2;
          const horizontalDelta = Math.abs(Number(spawn?.x) - Number(surface.position?.x));
          const verticalDrop = surfaceTop - Number(spawn?.y);

          return horizontalDelta <= halfWidth && verticalDrop >= 0 && verticalDrop <= maxDropDistance;
        });

        expect(reachableLanding?.id, `${level.id} ${spawnId} spawn has no protected landing`).toBeTruthy();
      }
    }
  });

  it('keeps generated target spawns outside their corresponding door trigger radius', () => {
    const generated = JSON.parse(readFileSync(proceduralLevelsPath, 'utf8')) as ProceduralLevelExport;
    const oppositeDirection: Record<string, string> = {
      west: 'east',
      east: 'west',
      north: 'south',
      south: 'north',
    };

    for (const level of generated.levels ?? []) {
      const layout = level.runtime_layout;
      const doorTriggerRadius = layout?.safety?.door_trigger_radius ?? 48;
      const minSpawnDoorDistance = layout?.safety?.min_spawn_door_distance ?? 0;

      expect(minSpawnDoorDistance).toBeGreaterThan(doorTriggerRadius);

      for (const direction of Object.keys(level.neighbors ?? {})) {
        const targetSpawnId = oppositeDirection[direction];
        const door = layout?.doors?.[targetSpawnId];
        const spawn = layout?.spawns?.[targetSpawnId];
        expect(door, `${level.id} missing ${targetSpawnId} door`).toBeTruthy();
        expect(spawn, `${level.id} missing ${targetSpawnId} spawn`).toBeTruthy();

        const distance = Math.hypot(Number(spawn?.x) - Number(door?.x), Number(spawn?.y) - Number(door?.y));
        expect(distance, `${level.id} ${targetSpawnId} spawn too close to door`).toBeGreaterThanOrEqual(
          minSpawnDoorDistance,
        );
      }
    }
  });

  it('bottom-aligns generated floors and keeps platform gaps traversable', () => {
    const generated = JSON.parse(readFileSync(proceduralLevelsPath, 'utf8')) as ProceduralLevelExport;

    for (const level of generated.levels ?? []) {
      const layout = level.runtime_layout;
      const safety = layout?.safety;
      const minClearance = Number(safety?.min_platform_clearance_px);
      const maxBottomGap = Number(safety?.max_bottom_floor_gap_px);

      expect(minClearance, `${level.id} missing platform clearance`).toBe(36);
      expect(maxBottomGap, `${level.id} missing bottom floor gap limit`).toBe(0);

      const cameraBottom = Number(layout?.camera_bounds?.position?.y) + Number(layout?.camera_bounds?.size?.y) / 2;
      const floorSurfaces = [
        layout?.floor,
        ...(layout?.floor_segments ?? []),
      ].filter((surface): surface is NonNullable<typeof surface> => surface !== undefined);
      const allSurfaces = [
        ...floorSurfaces,
        ...(layout?.platforms ?? []),
      ];
      const bottomFloor = floorSurfaces.reduce((bottom, surface) => {
        return Math.max(bottom, Number(surface.position?.y) + Number(surface.size?.y) / 2);
      }, Number.NEGATIVE_INFINITY);

      expect(cameraBottom - bottomFloor, `${level.id} bottom floor floats above camera bottom`).toBeLessThanOrEqual(maxBottomGap);

      for (let lowerIndex = 0; lowerIndex < allSurfaces.length; lowerIndex += 1) {
        for (let upperIndex = 0; upperIndex < allSurfaces.length; upperIndex += 1) {
          if (lowerIndex === upperIndex) {
            continue;
          }
          const lower = allSurfaces[lowerIndex];
          const upper = allSurfaces[upperIndex];
          const lowerTop = Number(lower.position?.y) - Number(lower.size?.y) / 2;
          const upperBottom = Number(upper.position?.y) + Number(upper.size?.y) / 2;
          const verticalGap = lowerTop - upperBottom;
          if (verticalGap <= 0) {
            continue;
          }
          const horizontalOverlap = Math.min(
            Number(lower.position?.x) + Number(lower.size?.x) / 2,
            Number(upper.position?.x) + Number(upper.size?.x) / 2,
          ) - Math.max(
            Number(lower.position?.x) - Number(lower.size?.x) / 2,
            Number(upper.position?.x) - Number(upper.size?.x) / 2,
          );
          if (horizontalOverlap <= 0) {
            continue;
          }
          expect(verticalGap, `${level.id} ${upper.id} -> ${lower.id} gap is not traversable`).toBeGreaterThanOrEqual(minClearance);
        }
      }
    }
  });

  it('keeps generated gameplay markers outside door safe rings', () => {
    const generated = JSON.parse(readFileSync(proceduralLevelsPath, 'utf8')) as ProceduralLevelExport;

    for (const level of generated.levels ?? []) {
      const layout = level.runtime_layout;
      const doorSafeRadius = layout?.safety?.door_safe_radius;
      expect(doorSafeRadius, `${level.id} missing door_safe_radius`).toBe(96);

      const activeDoorPositions = Object.keys(level.neighbors ?? {})
        .map((direction) => layout?.doors?.[direction])
        .filter((position): position is { x?: number; y?: number } => position !== undefined);

      const content = layout?.content ?? {};
      const gameplayMarkers = [
        ...(content.enemies ?? []),
        ...(content.heals ?? []),
        ...(content.collectibles ?? []),
        ...(content.hazards ?? []),
        ...(content.ability_gates ?? []),
        ...(content.goals ?? []),
      ];

      for (const marker of gameplayMarkers) {
        for (const door of activeDoorPositions) {
          const distance = Math.hypot(
            Number(marker.position?.x) - Number(door.x),
            Number(marker.position?.y) - Number(door.y),
          );
          expect(
            distance,
            `${level.id} ${marker.id} is inside a generated door safe ring`,
          ).toBeGreaterThanOrEqual(Number(doorSafeRadius));
        }
      }
    }
  });

  it('publishes CI branch density metrics with at least 20 percent dead-end coverage per biome', () => {
    const generated = JSON.parse(readFileSync(proceduralLevelsPath, 'utf8')) as ProceduralLevelExport;
    const densityByCluster = generated.validation?.branch_density_by_cluster ?? {};

    expect(generated.validation?.branch_density_minimum).toBe(0.2);
    expect(Object.keys(densityByCluster)).toEqual(expect.arrayContaining([
      'forest',
      'ice',
      'fire',
      'ruins',
      'sky',
      'void',
    ]));

    for (const [cluster, density] of Object.entries(densityByCluster)) {
      expect(density.level_count, `${cluster} level count`).toBeGreaterThan(0);
      expect(density.branch_level_count, `${cluster} branch count`).toBeGreaterThan(0);
      expect(density.ratio, `${cluster} branch density`).toBeGreaterThanOrEqual(0.2);
    }
  });

  it('wires procedural schema generation into canonical Godot validation', () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.['godot:procedural-levels']).toContain('scripts/generate-godot-procedural-levels.mjs');
    expect(packageJson.scripts?.['check:godot']).toContain('godot:procedural-levels');
  });
});
