import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, '..');
const godotRoot = join(repoRoot, 'godot');

const readGodotFile = (relativePath: string): string =>
  readFileSync(join(godotRoot, relativePath), 'utf8');

describe('Godot v2 minimal combat slice', () => {
  it('defines one simple enemy with ability metadata and capture states', () => {
    const script = readGodotFile('scripts/enemies/SimpleEnemy.gd');
    const scene = readGodotFile('scenes/enemies/SimpleEnemy.tscn');

    expect(script).toContain('class_name SimpleEnemy');
    expect(script).toContain('@export var ability_type');
    expect(script).toContain('enemy.idle');
    expect(script).toContain('enemy.captured');
    expect(script).toContain('enemy.swallowed');
    expect(scene).toContain('SimpleEnemy.gd');
    expect(scene).not.toContain('RigidBody2D');
  });

  it('defines a second flying enemy type selected by enemy marker metadata', () => {
    const scriptPath = join(godotRoot, 'scripts', 'enemies', 'FlyingEnemy.gd');
    const scenePath = join(godotRoot, 'scenes', 'enemies', 'FlyingEnemy.tscn');
    expect(existsSync(scriptPath)).toBe(true);
    expect(existsSync(scenePath)).toBe(true);

    const script = readFileSync(scriptPath, 'utf8');
    const scene = readFileSync(scenePath, 'utf8');
    const session = readGodotFile('scripts/session/GameSession.gd');
    const level = readGodotFile('levels/flying_combat_room.tscn');

    expect(script).toContain('class_name FlyingEnemy');
    expect(script).toContain('extends "res://scripts/enemies/SimpleEnemy.gd"');
    expect(script).toContain('@export var hover_amplitude');
    expect(script).toContain('enemy.idle');
    expect(script).toContain('tick_hurt_invulnerability(delta)');
    expect(scene).toContain('FlyingEnemy.gd');
    expect(scene).not.toContain('RigidBody2D');
    expect(session).toContain('FlyingEnemyScene');
    expect(session).toContain('enemy_type');
    expect(level).toContain('enemy_type = "flying"');
    expect(level).toContain('ability_type = "frost"');
  });

  it('adds player inhale, swallow, and ability actions', () => {
    const project = readGodotFile('project.godot');
    const controller = readGodotFile('scripts/player/PlayerController.gd');
    const playerScene = readGodotFile('scenes/player/Player.tscn');

    expect(project).toContain('inhale');
    expect(project).toContain('swallow');
    expect(project).toContain('use_ability');
    expect(controller).toContain('inhale_action');
    expect(controller).toContain('swallow_action');
    expect(controller).toContain('use_ability_action');
    expect(controller).toContain('ability_type');
    expect(controller).toContain('is_inhale_pressed');
    expect(controller).toContain('is_swallow_pressed');
    expect(controller).toContain('is_use_ability_pressed');
    expect(controller).toContain('set_facing');
    expect(playerScene).toContain('InhaleArea');
    expect(playerScene).toContain('Area2D');
  });

  it('carries enemy ability metadata through level markers and the combat room', () => {
    const marker = readGodotFile('scripts/level/markers/EnemySpawnMarker.gd');
    const level = readGodotFile('levels/combat_room.tscn');
    const catalog = readGodotFile('levels/level_catalog.json');

    expect(marker).toContain('@export var ability_type');
    expect(marker).toContain('"ability_type"');
    expect(level).toContain('EnemySpawnMarker.gd');
    expect(level).toContain('DoorMarker.gd');
    expect(level).toContain('GoalMarker.gd');
    expect(level).toContain('ability_type');
    expect(catalog).toContain('"combat_room"');
  });

  it('extends GameSession with capture, swallow, ability, and combat traces', () => {
    const source = readGodotFile('scripts/session/GameSession.gd');

    expect(source).toContain('SimpleEnemy');
    expect(source).toContain('spawn_enemies');
    expect(source).toContain('check_combat_actions');
    expect(source).toContain('captured_enemy');
    expect(source).toContain('detach_current_ability');
    expect(source).toContain('enemy.captured');
    expect(source).toContain('enemy.released');
    expect(source).toContain('enemy.swallowed');
    expect(source).toContain('ability.acquired');
    expect(source).toContain('ability.used');
    expect(source).toContain('ability.detached');
  });

  it('sorts non-piercing projectile targets by forward distance before applying hits', () => {
    const source = readGodotFile('scripts/session/GameSession.gd');

    expect(source).toContain('sort_projectile_targets_by_forward_distance(find_enemy_targets(profile), projectile)');
    expect(source).toContain('func sort_projectile_targets_by_forward_distance(targets: Array, projectile: Node) -> Array:');
    expect(source).toContain('func get_projectile_forward_distance(target: Node, projectile: Node) -> float:');
    expect(source).toContain('projectile.get("direction")');
  });

  it('uses a safe fallback visual for the inhale pull effect', () => {
    const controller = readGodotFile('scripts/player/PlayerController.gd');
    const session = readGodotFile('scripts/session/GameSession.gd');
    const suite = JSON.parse(readGodotFile('tests/replay_suite.json')) as {
      replays?: Array<{
        id?: string;
        expected_events?: string[];
      }>;
    };

    expect(controller).toContain('@export var inhale_effect_fallback_enabled: bool = true');
    expect(controller).toContain('func show_inhale_effect_fallback(target_position: Vector2) -> void:');
    expect(controller).toContain('Line2D.new()');
    expect(controller).toContain('InhaleEffectFallback');
    expect(controller).toContain('func hide_inhale_effect_fallback() -> void:');
    expect(session).toContain('show_inhale_effect_fallback');
    expect(session).toContain('inhale.effect.fallback');
    expect(suite.replays?.find((entry) => entry.id === 'combat_capture_swallow_goal')?.expected_events).toEqual(
      expect.arrayContaining(['inhale.effect.fallback']),
    );
  });

  it('uses a dedicated timed Spark attack texture instead of a permanent blue line', () => {
    const controller = readGodotFile('scripts/player/PlayerController.gd');
    const session = readGodotFile('scripts/session/GameSession.gd');
    const effectAssetPath = join(godotRoot, 'resources', 'assets', 'images', 'effects', 'spark-attack.webp');

    expect(existsSync(effectAssetPath)).toBe(true);
    expect(controller).toContain('ability_attack_effect_sprite');
    expect(controller).toContain('Sprite2D.new()');
    expect(controller).toContain('show_ability_attack_effect(attack_type: String, effect_color: Color, range: float, effect_texture: Texture2D');
    expect(controller).not.toContain('ability_attack_effect_line');
    expect(controller).not.toContain('AbilityAttackEffectFallback');
    expect(session).toContain('effect_texture_path');
    expect(session).toContain('res://resources/assets/images/effects/spark-attack.webp');
    expect(session).toContain('player.call("show_ability_attack_effect", current_ability_type,');
  });

  it('clears the capture link when a held enemy is defeated externally', () => {
    const source = readGodotFile('scripts/session/GameSession.gd');

    expect(source).toContain('clear_defeated_captured_enemy');
    expect(source).toContain('enemy.capture.cleared');
    expect(source).toContain('String(captured_enemy.state) == "enemy.defeated"');
  });

  it('uses player facing when choosing inhale capture targets', () => {
    const source = readGodotFile('scripts/session/GameSession.gd');

    expect(source).toContain('get_player_facing_direction');
    expect(source).toContain('delta_x * facing < -16.0');
    expect(source).toContain('player.call("set_facing"');
    expect(source).not.toContain('if delta_x < -16.0');
  });

  it('adds combat replays and docs', () => {
    const replayPath = join(godotRoot, 'tests', 'replays', 'combat_capture_swallow_goal.json');
    const flyingReplayPath = join(godotRoot, 'tests', 'replays', 'flying_enemy_release_swallow_goal.json');
    const detachReplayPath = join(godotRoot, 'tests', 'replays', 'combat_detach_ability.json');
    const docsPath = join(repoRoot, 'docs', 'godot-v2', 'combat-slice.md');
    const replay = JSON.parse(readFileSync(replayPath, 'utf8'));
    const flyingReplay = JSON.parse(readFileSync(flyingReplayPath, 'utf8'));
    const detachReplay = JSON.parse(readFileSync(detachReplayPath, 'utf8'));

    expect(replay.start_level_id).toBe('combat_room');
    expect(replay.frames.some((frame: { actions?: Record<string, boolean> }) => frame.actions?.inhale)).toBe(true);
    expect(replay.frames.some((frame: { actions?: Record<string, boolean> }) => frame.actions?.swallow)).toBe(true);
    expect(replay.frames.some((frame: { actions?: Record<string, boolean> }) => frame.actions?.use_ability)).toBe(true);
    expect(flyingReplay.start_level_id).toBe('flying_combat_room');
    expect(flyingReplay.frames.some((frame: { actions?: Record<string, boolean> }) => frame.actions?.inhale === false)).toBe(true);
    expect(flyingReplay.frames.some((frame: { actions?: Record<string, boolean> }) => frame.actions?.swallow)).toBe(true);
    expect(detachReplay.initial_ability_type).toBe('spark');
    expect(detachReplay.frames.some((frame: { actions?: Record<string, boolean> }) => frame.actions?.swallow)).toBe(true);
    expect(existsSync(docsPath)).toBe(true);

    const docs = readFileSync(docsPath, 'utf8');
    expect(docs).toContain('Combat Slice');
    expect(docs).toContain('enemy.captured');
    expect(docs).toContain('enemy.released');
    expect(docs).toContain('enemy.swallowed');
    expect(docs).toContain('ability.acquired');
    expect(docs).toContain('ability.detached');
    expect(docs).toContain('combat_capture_swallow_goal.json');
    expect(docs).toContain('flying_enemy_release_swallow_goal.json');
    expect(docs).toContain('combat_detach_ability.json');
    expect(docs).toContain('capture_defeated_enemy_auto_clear.json');
  });
});
