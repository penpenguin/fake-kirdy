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

const extractNodePositionX = (source: string, nodeName: string): number => {
  const match = source.match(
    new RegExp(`\\[node name="${nodeName}"[^\\]]*\\][\\s\\S]*?position = Vector2\\(([-0-9.]+),`),
  );
  if (!match) {
    throw new Error(`Missing position for ${nodeName}`);
  }

  return Number(match[1]);
};

describe('Godot v2 gameplay completion backlog', () => {
  it('starts the mainline game from the central hub instead of the combat test room', () => {
    const scene = readGodotFile('scenes/Main.tscn');
    const session = readGodotFile('scripts/session/GameSession.gd');

    expect(scene).toContain('initial_level_id = "central_hub"');
    expect(session).toContain('@export var initial_level_id: String = "central_hub"');
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
    expect(definition).toContain('var ability_gates');
    expect(definition).toContain('"ability_gate"');
    expect(loader).toContain('AbilityGateMarkerScript');
    expect(session).toContain('check_ability_gate_interactions');
    expect(session).toContain('ability_gate.opened');
    expect(session).toContain('opened_ability_gate_ids');
    expect(fireArea).toContain('gate_effect = "melt_ice"');
    expect(fireArea).toContain('required_ability_type = "fire"');
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
