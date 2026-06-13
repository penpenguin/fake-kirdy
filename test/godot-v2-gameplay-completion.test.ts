import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, '..');
const godotRoot = join(repoRoot, 'godot');

const readGodotFile = (relativePath: string): string =>
  readFileSync(join(godotRoot, relativePath), 'utf8');

const readRepoFile = (relativePath: string): string =>
  readFileSync(join(repoRoot, relativePath), 'utf8');

const readWebpDimensions = (relativePath: string): { width: number; height: number } => {
  const buffer = readFileSync(join(repoRoot, relativePath));
  const chunkType = buffer.toString('ascii', 12, 16);

  if (chunkType === 'VP8X') {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }

  if (chunkType === 'VP8L') {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }

  const startCode = buffer.indexOf(Buffer.from([0x9d, 0x01, 0x2a]));
  if (startCode < 0) {
    throw new Error(`Unsupported WebP header for ${relativePath}`);
  }

  return {
    width: buffer.readUInt16LE(startCode + 3) & 0x3fff,
    height: buffer.readUInt16LE(startCode + 5) & 0x3fff,
  };
};

const extractNodePositionX = (source: string, nodeName: string): number => {
  const match = source.match(
    new RegExp(`\\[node name="${nodeName}"[^\\]]*\\][\\s\\S]*?position = Vector2\\(([-0-9.]+),`),
  );
  if (!match) {
    throw new Error(`Missing position for ${nodeName}`);
  }

  return Number(match[1]);
};

const extractNodePosition = (source: string, nodeName: string): { x: number; y: number } => {
  const match = source.match(
    new RegExp(`\\[node name="${nodeName}"[^\\]]*\\][\\s\\S]*?position = Vector2\\(([-0-9.]+), ([-0-9.]+)\\)`),
  );
  if (!match) {
    throw new Error(`Missing position for ${nodeName}`);
  }

  return { x: Number(match[1]), y: Number(match[2]) };
};

const extractNodeBlock = (source: string, nodeName: string): string => {
  const match = source.match(new RegExp(`\\[node name="${nodeName}"[^\\]]*\\][\\s\\S]*?(?=\\n\\[node |$)`));
  if (!match) {
    throw new Error(`Missing node block for ${nodeName}`);
  }

  return match[0];
};

const extractNodeScale = (source: string, nodeName: string): { x: number; y: number } => {
  const block = extractNodeBlock(source, nodeName);
  const match = block.match(/scale = Vector2\(([-0-9.]+), ([-0-9.]+)\)/);
  if (!match) {
    return { x: 1, y: 1 };
  }

  return { x: Number(match[1]), y: Number(match[2]) };
};

describe('Godot v2 gameplay completion backlog', () => {
  it('starts the player-facing game from a tutorial room instead of validation or hub scenes', () => {
    const scene = readGodotFile('scenes/Main.tscn');
    const session = readGodotFile('scripts/session/GameSession.gd');

    expect(scene).toContain('initial_level_id = "tutorial_room"');
    expect(session).toContain('@export var initial_level_id: String = "tutorial_room"');
  });

  it('keeps debug-style overlays hidden on the initial player-facing screen', () => {
    const session = readGodotFile('scripts/session/GameSession.gd');
    const mainScene = readGodotFile('scenes/Main.tscn');

    expect(session).toContain('ControlGuideOverlayScene');
    expect(session).toContain('setup_control_guide_overlay');
    expect(session).toContain('map_overlay.visible = false');
    expect(session).toContain('@export var inventory_debug_overlay_enabled: bool = false');
    expect(session).toContain('inventory_overlay.visible = inventory_debug_overlay_enabled');
    expect(mainScene).toContain('inventory_debug_overlay_enabled = false');
  });

  it('adds a player-facing control guide with the tutorial actions', () => {
    const script = readGodotFile('scripts/ui/ControlGuideOverlay.gd');
    const scene = readGodotFile('scenes/ui/ControlGuideOverlay.tscn');

    expect(script).toContain('class_name ControlGuideOverlay');
    expect(scene).toContain('Move  A/D or arrows');
    expect(scene).toContain('Jump  Space');
    expect(scene).toContain('Inhale  C');
    expect(scene).toContain('Swallow  X');
    expect(scene).toContain('Spark Burst  Z');
  });

  it('uses an explicit interact action for player-facing door transitions', () => {
    const project = readGodotFile('project.godot');
    const doorMarker = readGodotFile('scripts/level/markers/DoorMarker.gd');
    const session = readGodotFile('scripts/session/GameSession.gd');

    expect(project).toContain('interact={');
    expect(doorMarker).toContain('@export var requires_interact: bool = true');
    expect(doorMarker).toContain('"requires_interact": requires_interact');
    expect(session).toContain('@export var door_interact_action: StringName = &"interact"');
    expect(session).toContain('is_door_interaction_confirmed(payload)');
    expect(session).toContain('door.prompted');
  });

  it('provides a first playable tutorial loop before any goal can finish the run', () => {
    const tutorial = readGodotFile('levels/tutorial_room.tscn');
    const catalog = readGodotFile('levels/level_catalog.json');

    expect(catalog).toContain('"tutorial_room"');
    expect(tutorial).toContain('EnemySpawnMarker.gd');
    expect(tutorial).toContain('ability_type = "spark"');
    expect(tutorial).toContain('AbilityGateMarker.gd');
    expect(tutorial).toContain('required_ability_type = "spark"');
    expect(tutorial).not.toContain('GoalMarker.gd');
    expect(tutorial).not.toContain('[node name="GoalMarker"');

    const spawnX = extractNodePositionX(tutorial, 'PlayerSpawn');
    const enemyX = extractNodePositionX(tutorial, 'EnemySpawnMarker');
    const gateX = extractNodePositionX(tutorial, 'TutorialSparkGate');
    const doorX = extractNodePositionX(tutorial, 'DoorToCentralHub');
    const spawn = extractNodePosition(tutorial, 'PlayerSpawn');
    const enemy = extractNodePosition(tutorial, 'EnemySpawnMarker');
    const captureDistance = Math.hypot(enemy.x - spawn.x, enemy.y - spawn.y);

    expect(enemyX).toBeGreaterThan(spawnX + 64);
    expect(enemyX).toBeLessThan(spawnX + 220);
    expect(captureDistance).toBeLessThanOrEqual(120);
    expect(gateX).toBeGreaterThan(enemyX + 120);
    expect(doorX).toBeGreaterThan(gateX + 120);
  });

  it('renders primary enemies large enough to read against Kirdy', () => {
    const playerScene = readGodotFile('scenes/player/Player.tscn');
    const simpleEnemyScene = readGodotFile('scenes/enemies/SimpleEnemy.tscn');
    const flyingEnemyScene = readGodotFile('scenes/enemies/FlyingEnemy.tscn');
    const playerScale = extractNodeScale(playerScene, 'Body');
    const simpleScale = extractNodeScale(simpleEnemyScene, 'Body');
    const flyingScale = extractNodeScale(flyingEnemyScene, 'Body');
    const playerTexture = readWebpDimensions('godot/resources/assets/images/characters/kirdy/kirdy-idle.webp');
    const simpleEnemyTexture = readWebpDimensions('godot/resources/assets/images/enemies/wabble-bee.webp');
    const flyingEnemyTexture = readWebpDimensions('godot/resources/assets/images/enemies/frost-flutter.webp');
    const playerVisibleHeight = playerTexture.height * playerScale.y;

    expect(simpleEnemyTexture.height * simpleScale.y).toBeGreaterThanOrEqual(playerVisibleHeight * 0.7);
    expect(flyingEnemyTexture.height * flyingScale.y).toBeGreaterThanOrEqual(playerVisibleHeight * 0.7);
  });

  it('keeps the goal door visual readable and centered on its completion trigger', () => {
    const goalMarker = readGodotFile('scripts/level/markers/GoalMarker.gd');
    const goalSanctum = readGodotFile('levels/goal_sanctum.tscn');
    const goalPosition = extractNodePosition(goalSanctum, 'GoalMarker');

    expect(goalMarker).toContain('visual.scale = Vector2(1.0, 1.0)');
    expect(goalMarker).toContain('visual.centered = true');
    expect(goalSanctum).toContain('GoalDoorController.gd');
    expect(goalPosition.x).toBeGreaterThan(0);
    expect(goalPosition.y).toBeGreaterThan(0);
  });

  it('makes tutorial enemies nonlethal while the player is learning capture and swallow', () => {
    const tutorial = readGodotFile('levels/tutorial_room.tscn');

    expect(tutorial).toContain('contact_damage = 0');
    expect(tutorial).toContain('attack_damage = 0');
    expect(tutorial).toContain('attack_radius = 72.0');
  });

  it('blocks tutorial edge falls with visible guard rails inside the camera bounds', () => {
    const tutorial = readGodotFile('levels/tutorial_room.tscn');
    const leftGuard = extractNodePosition(tutorial, 'LeftEdgeGuard');
    const rightGuard = extractNodePosition(tutorial, 'RightEdgeGuard');

    expect(tutorial).toContain('[node name="LeftEdgeGuard" type="StaticBody2D" parent="."]');
    expect(tutorial).toContain('[node name="RightEdgeGuard" type="StaticBody2D" parent="."]');
    expect(tutorial).toContain('[node name="LeftEdgeGuardVisual" type="Polygon2D" parent="LeftEdgeGuard"]');
    expect(tutorial).toContain('[node name="RightEdgeGuardVisual" type="Polygon2D" parent="RightEdgeGuard"]');
    expect(leftGuard.x).toBeGreaterThanOrEqual(0);
    expect(rightGuard.x).toBeLessThanOrEqual(920);
  });

  it('explains the blue ability wall in-world and routes the tutorial exit toward a real stage', () => {
    const tutorial = readGodotFile('levels/tutorial_room.tscn');
    const hub = readGodotFile('levels/central_hub.tscn');

    expect(tutorial).toContain('hint_text = "Spark opens blue walls. Inhale the spark enemy, swallow, then press Z."');
    expect(tutorial).toContain('[node name="BlueWallHintLabel" type="Label" parent="."]');
    expect(tutorial).toContain('text = "Storm Wall: Copy Spark, then burst"');
    expect(tutorial).toContain('[node name="HubExitLabel" type="Label" parent="."]');
    expect(tutorial).toContain('text = "Hub Gate: choose your first trial"');
    expect(tutorial).toContain('target_spawn_id = "tutorial_fire_route"');
    expect(hub).toContain('spawn_id = "tutorial_fire_route"');
    expect(hub).toContain('[node name="TutorialFireRouteLabel" type="Label" parent="."]');
    expect(hub).toContain('text = "Ember Gate: first route"');
    expect(hub).toContain('door_id = "hub_tutorial_to_fire_area"');
    expect(hub).toContain('door_label = "Ember Gate"');
    expect(hub).toContain('target_level_id = "fire_area"');
    expect(hub).toContain('bypass_cluster_lock = true');
    expect(readGodotFile('scripts/level/markers/DoorMarker.gd')).toContain('@export var bypass_cluster_lock: bool = false');
    expect(readGodotFile('scripts/session/GameSession.gd')).toContain('payload.get("bypass_cluster_lock", false)');
  });

  it('keeps the combat room door reachable before any local completion goal can finish the run', () => {
    const level = readGodotFile('levels/combat_room.tscn');
    const doorX = extractNodePositionX(level, 'DoorMarker');
    const goalX = extractNodePositionX(level, 'GoalMarker');

    expect(goalX).toBeGreaterThan(doorX + 64);
  });

  it('models enemies as damageable combat targets with defeat traces', () => {
    const enemy = readGodotFile('scripts/enemies/SimpleEnemy.gd');
    const session = readGodotFile('scripts/session/GameSession.gd');

    expect(enemy).toContain('@export var max_hp');
    expect(enemy).toContain('var hp: int');
    expect(enemy).toContain('func take_damage');
    expect(enemy).toContain('func die');
    expect(enemy).toContain('enemy.defeated');
    expect(session).toContain('enemy.damaged');
    expect(session).toContain('enemy.defeated');
  });

  it('limits active enemy spawning to three enemies and traces skipped spawns', () => {
    const session = readGodotFile('scripts/session/GameSession.gd');
    const level = readGodotFile('levels/enemy_spawn_limit_room.tscn');
    const suite = JSON.parse(readGodotFile('tests/replay_suite.json')) as {
      replays?: Array<{
        id?: string;
        expected_events?: string[];
      }>;
    };

    expect(session).toContain('@export var max_active_enemy_count: int = 3');
    expect(session).toContain('if enemies.size() >= max_active_enemy_count');
    expect(session).toContain('enemy.spawn.skipped');
    expect(level.match(/\[node name="EnemySpawnMarker/g)?.length).toBe(4);
    expect(suite.replays?.find((entry) => entry.id === 'enemy_spawn_limit')?.expected_events).toContain(
      'enemy.spawn.skipped',
    );
  });

  it('keeps distance when two enemies crowd Kirdy and traces spacing', () => {
    const session = readGodotFile('scripts/session/GameSession.gd');
    const level = readGodotFile('levels/enemy_crowd_spacing_room.tscn');
    const suite = JSON.parse(readGodotFile('tests/replay_suite.json')) as {
      replays?: Array<{
        id?: string;
        expected_events?: string[];
      }>;
    };

    expect(session).toContain('@export var enemy_crowd_player_radius: float = 112.0');
    expect(session).toContain('@export var enemy_crowd_min_player_distance: float = 72.0');
    expect(session).toContain('func apply_enemy_crowd_spacing() -> void:');
    expect(session).toContain('enemy.crowd.spacing_applied');
    expect(level.match(/\[node name="EnemySpawnMarker/g)?.length).toBe(2);
    expect(suite.replays?.find((entry) => entry.id === 'enemy_crowd_spacing')?.expected_events).toContain(
      'enemy.crowd.spacing_applied',
    );
  });

  it('turns ability use and spit release into real damage actions', () => {
    const session = readGodotFile('scripts/session/GameSession.gd');

    expect(session).toContain('get_ability_profile');
    expect(session).toContain('find_enemy_targets');
    expect(session).toContain('take_damage');
    expect(session).toContain('spit.projectile.fired');
    expect(session).toContain('spit.projectile.hit');
    expect(session).toContain('"fire"');
    expect(session).toContain('"frost"');
    expect(session).toContain('"sword"');
    expect(session).toContain('"spark"');
    expect(session).toContain('"leaf"');
    expect(session).toContain('"stone"');
  });

  it('uses a dedicated projectile node for fire ability attacks', () => {
    const projectileScriptPath = join(godotRoot, 'scripts', 'combat', 'AbilityProjectile.gd');
    const projectileScenePath = join(godotRoot, 'scenes', 'combat', 'AbilityProjectile.tscn');
    const session = readGodotFile('scripts/session/GameSession.gd');
    const suite = JSON.parse(readGodotFile('tests/replay_suite.json')) as {
      replays?: Array<{
        id?: string;
        expected_events?: string[];
      }>;
    };

    expect(existsSync(projectileScriptPath)).toBe(true);
    expect(existsSync(projectileScenePath)).toBe(true);

    const projectile = readFileSync(projectileScriptPath, 'utf8');
    const projectileScene = readFileSync(projectileScenePath, 'utf8');
    const replay = JSON.parse(readGodotFile('tests/replays/fire_ability_projectile_hit.json')) as {
      initial_ability_type?: string;
      frames?: Array<{ actions?: Record<string, boolean> }>;
    };

    expect(projectile).toContain('class_name AbilityProjectile');
    expect(projectile).toContain('configure_projectile');
    expect(projectile).toContain('mark_hit');
    expect(projectileScene).toContain('AbilityProjectile.gd');
    expect(session).toContain('AbilityProjectileScene');
    expect(session).toContain('spawn_ability_projectile');
    expect(session).toContain('resolve_ability_projectile_hits');
    expect(session).toContain('ability.projectile.spawned');
    expect(session).toContain('ability.projectile.hit');
    expect(replay.initial_ability_type).toBe('fire');
    expect(replay.frames?.some((frame) => frame.actions?.use_ability)).toBe(true);
    expect(suite.replays?.find((entry) => entry.id === 'fire_ability_projectile_hit')?.expected_events).toEqual(
      expect.arrayContaining(['ability.projectile.spawned', 'ability.projectile.hit', 'enemy.damaged']),
    );
  });

  it('applies a movement effect for enemy abilities and traces it', () => {
    const session = readGodotFile('scripts/session/GameSession.gd');
    const replay = JSON.parse(readGodotFile('tests/replays/spark_ability_dash_movement.json')) as {
      initial_ability_type?: string;
    };
    const suite = JSON.parse(readGodotFile('tests/replay_suite.json')) as {
      replays?: Array<{
        id?: string;
        expected_events?: string[];
      }>;
    };

    expect(session).toContain('func apply_ability_movement(ability_type: String, profile: Dictionary) -> void:');
    expect(session).toContain('"movement_effect": "dash"');
    expect(session).toContain('"movement_impulse": 64.0');
    expect(session).toContain('ability.movement.applied');
    expect(replay.initial_ability_type).toBe('spark');
    expect(suite.replays?.find((entry) => entry.id === 'spark_ability_dash_movement')?.expected_events).toContain(
      'ability.movement.applied',
    );
  });

  it('applies ability-specific enemy AI profiles and traces them', () => {
    const session = readGodotFile('scripts/session/GameSession.gd');
    const replay = JSON.parse(readGodotFile('tests/replays/frost_enemy_ai_profile.json')) as {
      start_level_id?: string;
    };
    const suite = JSON.parse(readGodotFile('tests/replay_suite.json')) as {
      replays?: Array<{
        id?: string;
        expected_events?: string[];
      }>;
    };

    expect(session).toContain('func get_enemy_ability_ai_profile(ability_type: String) -> Dictionary:');
    expect(session).toContain('func apply_enemy_ability_ai_profile(enemy: Node) -> void:');
    expect(session).toContain('"ai_behavior": "frost_hover"');
    expect(session).toContain('enemy.ai.profile.applied');
    expect(replay.start_level_id).toBe('flying_combat_room');
    expect(suite.replays?.find((entry) => entry.id === 'frost_enemy_ai_profile')?.expected_events).toContain(
      'enemy.ai.profile.applied',
    );
  });

  it('discovers hidden collectibles and hidden passages before using them', () => {
    const collectibleMarker = readGodotFile('scripts/level/markers/CollectibleMarker.gd');
    const doorMarker = readGodotFile('scripts/level/markers/DoorMarker.gd');
    const session = readGodotFile('scripts/session/GameSession.gd');
    const level = readGodotFile('levels/hidden_discovery_room.tscn');
    const suite = JSON.parse(readGodotFile('tests/replay_suite.json')) as {
      replays?: Array<{
        id?: string;
        expected_events?: string[];
      }>;
    };

    expect(collectibleMarker).toContain('@export var hidden_until_discovered: bool = false');
    expect(doorMarker).toContain('@export var hidden_until_discovered: bool = false');
    expect(session).toContain('var discovered_hidden_feature_ids: Dictionary = {}');
    expect(session).toContain('func check_hidden_discoveries() -> void:');
    expect(session).toContain('hidden.discovered');
    expect(session).toContain('is_hidden_feature_discovered');
    expect(session).toContain('reapply_discovered_hidden_marker_visuals()');
    expect(session).toContain('if is_hidden_feature_discovered(feature_type, feature_id):');
    expect(session).toContain('reveal_hidden_marker_visual(feature_type, feature_id)');
    expect(level).toContain('hidden_until_discovered = true');
    expect(suite.replays?.find((entry) => entry.id === 'hidden_discovery_path')?.expected_events).toEqual(
      expect.arrayContaining(['hidden.discovered', 'collectible.collected', 'door.entered']),
    );
  });

  it('marks dead-end rewards as exploration completion on the map', () => {
    const healMarker = readGodotFile('scripts/level/markers/HealMarker.gd');
    const mapOverlay = readGodotFile('scripts/ui/MapOverlay.gd');
    const session = readGodotFile('scripts/session/GameSession.gd');
    const level = readGodotFile('levels/central_hub.tscn');
    const suite = JSON.parse(readGodotFile('tests/replay_suite.json')) as {
      replays?: Array<{
        id?: string;
        expected_events?: string[];
      }>;
    };

    expect(healMarker).toContain('@export var dead_end_id: String = ""');
    expect(level).toContain('dead_end_id = "central_hub_dead_end_max_health"');
    expect(session).toContain('var completed_dead_end_ids: Dictionary = {}');
    expect(session).toContain('func complete_dead_end(dead_end_id: String, heal_id: String) -> void:');
    expect(session).toContain('dead_end.completed');
    expect(session).toContain('"feature_type": "dead_end"');
    expect(mapOverlay).toContain('dead_end_completed_color');
    expect(mapOverlay).toContain('draw_rect(Rect2(marker["position"]');
    expect(suite.replays?.find((entry) => entry.id === 'central_hub_dead_end_max_health')?.expected_events).toEqual(
      expect.arrayContaining(['dead_end.completed', 'map.updated']),
    );
  });

  it('finishes the canonical goal door through a dedicated controller with result metrics', () => {
    const goalDoorController = readGodotFile('scripts/level/markers/GoalDoorController.gd');
    const session = readGodotFile('scripts/session/GameSession.gd');
    const level = readGodotFile('levels/goal_sanctum.tscn');
    const suite = JSON.parse(readGodotFile('tests/replay_suite.json')) as {
      replays?: Array<{
        id?: string;
        expected_events?: string[];
      }>;
    };

    expect(goalDoorController).toContain('class_name GoalDoorController');
    expect(goalDoorController).toContain('extends GoalMarker');
    expect(goalDoorController).toContain('goal-door.webp');
    expect(goalDoorController).toContain('@export var collect_score_metrics: bool = true');
    expect(goalDoorController).toContain('@export var collect_time_metrics: bool = true');
    expect(level).toContain('GoalDoorController.gd');
    expect(session).toContain('goal.door.entered');
    expect(session).toContain('"score": calculate_total_score()');
    expect(session).toContain('"remaining_life_bonus": calculate_remaining_life_bonus()');
    expect(suite.replays?.find((entry) => entry.id === 'sky_generated_goal_path')?.expected_events).toEqual(
      expect.arrayContaining(['goal.door.entered', 'run.finished', 'result.overlay.shown']),
    );
  });

  it('supports item, ability, level, enemy-group, and boss door gates', () => {
    const marker = readGodotFile('scripts/level/markers/DoorMarker.gd');
    const session = readGodotFile('scripts/session/GameSession.gd');

    expect(marker).toContain('@export var required_item_id');
    expect(marker).toContain('@export var required_ability_type');
    expect(marker).toContain('@export var required_completed_level_id');
    expect(marker).toContain('@export var required_defeated_enemy_group_id');
    expect(marker).toContain('@export var required_boss_id');
    expect(session).toContain('func get_door_lock_reason');
    expect(session).toContain('door.locked');
    expect(session).toContain('defeated_enemy_group_ids');
    expect(session).toContain('defeated_boss_ids');
  });

  it('grants orb rewards from boss defeats and provides a Central return door', () => {
    const enemyMarker = readGodotFile('scripts/level/markers/EnemySpawnMarker.gd');
    const enemy = readGodotFile('scripts/enemies/SimpleEnemy.gd');
    const session = readGodotFile('scripts/session/GameSession.gd');
    const forestReliquary = readGodotFile('levels/forest_reliquary.tscn');
    const suite = JSON.parse(readGodotFile('tests/replay_suite.json')) as {
      replays?: Array<{
        id?: string;
        expected_events?: string[];
        expected_event_sequence?: Array<{ event_type?: string; payload?: Record<string, unknown> }>;
        expected_last_hud?: Record<string, unknown>;
      }>;
    };
    const replayEntry = suite.replays?.find((entry) => entry.id === 'forest_reliquary_boss_orb_return');

    expect(enemyMarker).toContain('@export var orb_reward_item_id: String = ""');
    expect(enemyMarker).toContain('"orb_reward_item_id": orb_reward_item_id');
    expect(enemy).toContain('@export var orb_reward_item_id: String = ""');
    expect(enemy).toContain('"orb_reward_item_id": orb_reward_item_id');
    expect(session).toContain('func grant_boss_orb_reward(result: Dictionary) -> void:');
    expect(session).toContain('boss.defeated');
    expect(session).toContain('acquire_item(orb_reward_item_id, boss_id)');
    expect(forestReliquary).toContain('enemy_rank = "boss"');
    expect(forestReliquary).toContain('boss_id = "forest_guard_boss"');
    expect(forestReliquary).toContain('orb_reward_item_id = "forest-orb"');
    expect(forestReliquary).toContain('door_id = "forest_reliquary_return_to_central_hub"');
    expect(forestReliquary).toContain('target_level_id = "central_hub"');
    expect(forestReliquary).toContain('required_boss_id = "forest_guard_boss"');
    expect(forestReliquary).toContain('required_item_id = "forest-orb"');
    expect(replayEntry?.expected_events).toEqual(expect.arrayContaining([
      'enemy.defeated',
      'boss.defeated',
      'item.acquired',
      'hud.updated',
      'door.entered',
    ]));
    expect(replayEntry?.expected_event_sequence).toEqual(expect.arrayContaining([
      { event_type: 'boss.defeated', payload: { boss_id: 'forest_guard_boss', orb_reward_item_id: 'forest-orb' } },
      { event_type: 'item.acquired', payload: { item_id: 'forest-orb' } },
      { event_type: 'door.entered', payload: { door_id: 'forest_reliquary_return_to_central_hub', target_level_id: 'central_hub' } },
    ]));
    expect(replayEntry?.expected_last_hud).toMatchObject({
      acquired_orb_ids: ['forest-orb'],
    });
  });

  it('routes every mainline biome boss through an orb reward and Central return door', () => {
    const routes = [
      {
        levelPath: 'levels/forest_reliquary.tscn',
        bossId: 'forest_guard_boss',
        orbItemId: 'forest-orb',
        returnDoorId: 'forest_reliquary_return_to_central_hub',
      },
      {
        levelPath: 'levels/ice_reliquary.tscn',
        bossId: 'ice_guard_boss',
        orbItemId: 'ice-orb',
        returnDoorId: 'ice_reliquary_return_to_central_hub',
      },
      {
        levelPath: 'levels/fire_reliquary.tscn',
        bossId: 'fire_guard_boss',
        orbItemId: 'fire-orb',
        returnDoorId: 'fire_reliquary_return_to_central_hub',
      },
      {
        levelPath: 'levels/ruins_reliquary.tscn',
        bossId: 'ruins_guard_boss',
        orbItemId: 'cave-orb',
        returnDoorId: 'ruins_reliquary_return_to_central_hub',
      },
      {
        levelPath: 'levels/sky_sanctum.tscn',
        bossId: 'sky_guard_boss',
        orbItemId: 'sky-orb',
        returnDoorId: 'sky_sanctum_return_to_central_hub',
      },
    ];

    for (const route of routes) {
      const level = readGodotFile(route.levelPath);

      expect(level, `${route.levelPath} should mark its guard as a boss`).toContain('enemy_rank = "boss"');
      expect(level, `${route.levelPath} should expose boss id ${route.bossId}`).toContain(`boss_id = "${route.bossId}"`);
      expect(level, `${route.levelPath} should reward ${route.orbItemId}`).toContain(`orb_reward_item_id = "${route.orbItemId}"`);
      expect(level, `${route.levelPath} should provide a Central return door`).toContain(`door_id = "${route.returnDoorId}"`);
      expect(level, `${route.levelPath} should return to Central Hub`).toContain('target_level_id = "central_hub"');
      expect(level, `${route.levelPath} should gate Central return by boss defeat`).toContain(`required_boss_id = "${route.bossId}"`);
      expect(level, `${route.levelPath} should gate Central return by orb possession`).toContain(`required_item_id = "${route.orbItemId}"`);
    }
  });

  it('adds a non-forest replay for boss orb return progression', () => {
    const suite = JSON.parse(readGodotFile('tests/replay_suite.json')) as {
      replays?: Array<{
        id?: string;
        expected_events?: string[];
        expected_event_sequence?: Array<{ event_type?: string; payload?: Record<string, unknown> }>;
        expected_last_hud?: Record<string, unknown>;
      }>;
    };
    const replay = suite.replays?.find((entry) => entry.id === 'ice_reliquary_boss_orb_return');

    expect(replay?.expected_events).toEqual(expect.arrayContaining([
      'enemy.defeated',
      'boss.defeated',
      'item.acquired',
      'door.entered',
    ]));
    expect(replay?.expected_event_sequence).toEqual(expect.arrayContaining([
      { event_type: 'boss.defeated', payload: { boss_id: 'ice_guard_boss', orb_reward_item_id: 'ice-orb' } },
      { event_type: 'item.acquired', payload: { item_id: 'ice-orb' } },
      { event_type: 'door.entered', payload: { door_id: 'ice_reliquary_return_to_central_hub', target_level_id: 'central_hub' } },
    ]));
    expect(replay?.expected_last_hud).toMatchObject({
      acquired_orb_ids: ['ice-orb'],
    });
  });

  it('uses progression gates in authored playable levels', () => {
    const combatRoom = readGodotFile('levels/combat_room.tscn');
    const forestReliquary = readGodotFile('levels/forest_reliquary.tscn');
    const skySanctum = readGodotFile('levels/sky_sanctum.tscn');

    expect(combatRoom).toContain('required_ability_type = "spark"');
    expect(forestReliquary).toContain('required_item_id = "forest-keystone"');
    expect(skySanctum).toContain('required_completed_level_id = "goal_sanctum"');
    expect(skySanctum).toContain('required_defeated_enemy_group_id = "sky_guard"');
    expect(skySanctum).toContain('required_boss_id = "sky_guard_boss"');
  });

  it('connects difficulty and combat feedback to runtime state and HUD traces', () => {
    const session = readGodotFile('scripts/session/GameSession.gd');
    const traceSummary = readRepoFile('scripts/trace-summary.mjs');

    expect(session).toContain('get_difficulty_profile');
    expect(session).toContain('apply_difficulty_to_enemy');
    expect(session).toContain('scale_enemy_damage_for_difficulty');
    expect(session).toContain('if amount <= 0:');
    expect(session).toContain('objective_text');
    expect(session).toContain('ability_cooldown_ms');
    expect(session).toContain('locked_door_reason');
    expect(session).toContain('clear_resolved_locked_door_reason');
    expect(session).toContain('"missing_item:"');
    expect(session).toContain('"missing_ability:"');
    expect(session).toContain('target_enemy_hp');
    expect(traceSummary).toContain('enemies_defeated');
    expect(traceSummary).toContain('door_lock_reasons');
  });

  it('shows visible enemy hit feedback and traces it during combat', () => {
    const enemy = readGodotFile('scripts/enemies/SimpleEnemy.gd');
    const session = readGodotFile('scripts/session/GameSession.gd');
    const suite = JSON.parse(readGodotFile('tests/replay_suite.json')) as {
      replays?: Array<{
        id?: string;
        expected_events?: string[];
      }>;
    };

    expect(enemy).toContain('@export var hit_flash_ms: int = 140');
    expect(enemy).toContain('func show_hit_feedback');
    expect(enemy).toContain('feedback_flash_remaining_ms');
    expect(enemy).toContain('get_node_or_null("Body")');
    expect(enemy).toContain('modulate = hit_flash_color');
    expect(session).toContain('enemy.feedback.shown');
    expect(suite.replays?.find((entry) => entry.id === 'combat_ability_damage_enemy')?.expected_events).toEqual(
      expect.arrayContaining(['enemy.feedback.shown']),
    );
  });

  it('reflects dynamic branch neighbors as playable Godot doors', () => {
    const fireArea = readGodotFile('levels/fire_area.tscn');
    const iceArea = readGodotFile('levels/ice_area.tscn');
    const caveArea = readGodotFile('levels/cave_area.tscn');

    expect(fireArea).toContain('target_level_id = "labyrinth_011"');
    expect(iceArea).toContain('target_level_id = "labyrinth_006"');
    expect(caveArea).toContain('target_level_id = "labyrinth_033"');
  });

  it('adds marker-driven hazards that damage the player and emit traceable hazard events', () => {
    const markerPath = join(godotRoot, 'scripts', 'level', 'markers', 'HazardMarker.gd');
    expect(existsSync(markerPath)).toBe(true);

    const marker = readGodotFile('scripts/level/markers/HazardMarker.gd');
    const definition = readGodotFile('scripts/level/LevelDefinition.gd');
    const loader = readGodotFile('scripts/level/LevelLoader.gd');
    const session = readGodotFile('scripts/session/GameSession.gd');
    const dangerRoom = readGodotFile('levels/danger_room.tscn');
    const traceSummary = readRepoFile('scripts/trace-summary.mjs');

    expect(marker).toContain('class_name HazardMarker');
    expect(marker).toContain('@export var hazard_type');
    expect(marker).toContain('@export var damage');
    expect(definition).toContain('var hazards');
    expect(definition).toContain('"hazard"');
    expect(loader).toContain('HazardMarkerScript');
    expect(session).toContain('check_hazard_contacts');
    expect(session).toContain('hazard.entered');
    expect(session).toContain('"source_type": "hazard"');
    expect(dangerRoom).toContain('HazardMarker.gd');
    expect(traceSummary).toContain('hazards_entered');
  });

  it('adds ability-gated terrain interactions for core copied abilities', () => {
    const markerPath = join(godotRoot, 'scripts', 'level', 'markers', 'AbilityGateMarker.gd');
    expect(existsSync(markerPath)).toBe(true);

    const marker = readGodotFile('scripts/level/markers/AbilityGateMarker.gd');
    const definition = readGodotFile('scripts/level/LevelDefinition.gd');
    const loader = readGodotFile('scripts/level/LevelLoader.gd');
    const session = readGodotFile('scripts/session/GameSession.gd');
    const fireArea = readGodotFile('levels/fire_area.tscn');
    const iceArea = readGodotFile('levels/ice_area.tscn');
    const forestArea = readGodotFile('levels/forest_area.tscn');
    const caveArea = readGodotFile('levels/cave_area.tscn');
    const skySanctum = readGodotFile('levels/sky_sanctum.tscn');
    const traceSummary = readRepoFile('scripts/trace-summary.mjs');

    expect(marker).toContain('class_name AbilityGateMarker');
    expect(marker).toContain('@export var required_ability_type');
    expect(marker).toContain('@export var gate_effect');
    expect(marker).toContain('@export var opened: bool = false');
    expect(marker).toContain('func open_gate');
    expect(marker).toContain('CollisionShape2D');
    expect(marker).toContain('Visual');
    expect(definition).toContain('var ability_gates');
    expect(definition).toContain('"ability_gate"');
    expect(loader).toContain('AbilityGateMarkerScript');
    expect(session).toContain('check_ability_gate_interactions');
    expect(session).toContain('open_ability_gate_scene_node');
    expect(session).toContain('ability_gate.opened');
    expect(session).toContain('opened_ability_gate_ids');
    expect(fireArea).toContain('gate_effect = "melt_ice"');
    expect(fireArea).toContain('required_ability_type = "fire"');
    expect(fireArea).toContain('[node name="Visual" type="Polygon2D" parent="IceBlockGate"]');
    expect(fireArea).toContain('[node name="CollisionBody" type="StaticBody2D" parent="IceBlockGate"]');
    expect(fireArea).toContain('[node name="CollisionShape2D" type="CollisionShape2D" parent="IceBlockGate/CollisionBody"]');
    expect(iceArea).toContain('gate_effect = "freeze_water"');
    expect(iceArea).toContain('required_ability_type = "ice"');
    expect(forestArea).toContain('gate_effect = "cut_vines"');
    expect(forestArea).toContain('required_ability_type = "leaf"');
    expect(caveArea).toContain('gate_effect = "press_switch"');
    expect(caveArea).toContain('required_ability_type = "stone"');
    expect(skySanctum).toContain('gate_effect = "power_device"');
    expect(skySanctum).toContain('required_ability_type = "spark"');
    expect(traceSummary).toContain('ability_gates_opened');
  });

  it('uses patrol metadata for minimal enemy AI instead of idle-only enemies', () => {
    const enemy = readGodotFile('scripts/enemies/SimpleEnemy.gd');
    const session = readGodotFile('scripts/session/GameSession.gd');

    expect(enemy).toContain('@export var patrol_radius');
    expect(enemy).toContain('@export var detection_radius');
    expect(enemy).toContain('enemy.patrolling');
    expect(enemy).toContain('enemy.chasing');
    expect(enemy).toContain('func configure_ai');
    expect(session).toContain('patrol_radius');
    expect(session).toContain('player.global_position');
  });

  it('gives enemies active attack timing instead of only passive contact damage', () => {
    const marker = readGodotFile('scripts/level/markers/EnemySpawnMarker.gd');
    const enemy = readGodotFile('scripts/enemies/SimpleEnemy.gd');
    const session = readGodotFile('scripts/session/GameSession.gd');

    expect(marker).toContain('@export var attack_radius');
    expect(marker).toContain('@export var attack_cooldown_ms');
    expect(enemy).toContain('@export var attack_damage');
    expect(enemy).toContain('@export var attack_radius');
    expect(enemy).toContain('@export var attack_cooldown_ms');
    expect(enemy).toContain('var attack_cooldown_remaining_ms');
    expect(enemy).toContain('func can_attack_player');
    expect(enemy).toContain('func mark_attack_started');
    expect(session).toContain('check_enemy_attacks');
    expect(session).toContain('enemy.attack.started');
    expect(session).toContain('"source_type": "enemy_attack"');
    expect(session).toContain('enemy_attack_cooldown_multiplier');
  });
});
