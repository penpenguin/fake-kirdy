import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, '..');
const godotRoot = join(repoRoot, 'godot');

const readGodotFile = (relativePath: string): string =>
  readFileSync(join(godotRoot, relativePath), 'utf8');

describe('Godot v2 heal pickup flow', () => {
  it('consumes HealMarker metadata in GameSession and emits heal traces', () => {
    const source = readGodotFile('scripts/session/GameSession.gd');
    const enemyScene = readGodotFile('scenes/enemies/SimpleEnemy.tscn');

    expect(source).toContain('consumed_heal_ids');
    expect(source).toContain('check_heal_pickups');
    expect(source).toContain('heal.collected');
    expect(source).toContain('player.healed');
    expect(source).toContain('reward_type');
    expect(source).toContain('player.max_hp_increased');
    expect(source).toContain('player_revive_count');
    expect(source).toContain('player.revive_acquired');
    expect(source).toContain('player.revived');
    expect(source).toContain('player_invulnerability_ms');
    expect(readGodotFile('scripts/level/markers/HealMarker.gd')).toContain('@export var reward_type');
    expect(readGodotFile('scripts/save/SaveState.gd')).toContain('var player_revive_count');
    expect(enemyScene).toContain('collision_layer = 0');
    expect(enemyScene).toContain('collision_mask = 0');
  });

  it('adds a replayable revive reward room that avoids game over once', () => {
    const level = readGodotFile('levels/revive_room.tscn');
    const catalog = readGodotFile('levels/level_catalog.json');
    const replayPath = join(godotRoot, 'tests', 'replays', 'revive_room_revive_then_game_over.json');

    expect(level).toContain('HealMarker.gd');
    expect(level).toContain('reward_type = "revive"');
    expect(level).toContain('contact_damage = 3');
    expect(catalog).toContain('"revive_room"');
    expect(existsSync(replayPath)).toBe(true);
  });

  it('adds a replayable heal_room with enemy damage, heal marker, and goal', () => {
    const level = readGodotFile('levels/heal_room.tscn');
    const catalog = readGodotFile('levels/level_catalog.json');
    const replayPath = join(godotRoot, 'tests', 'replays', 'heal_room_recover_and_goal.json');

    expect(level).toContain('EnemySpawnMarker.gd');
    expect(level).toContain('HealMarker.gd');
    expect(level).toContain('GoalMarker.gd');
    expect(catalog).toContain('"heal_room"');
    expect(existsSync(replayPath)).toBe(true);

    const replay = JSON.parse(readFileSync(replayPath, 'utf8')) as {
      start_level_id?: string;
      frames?: Array<{ actions?: Record<string, boolean> }>;
    };

    expect(replay.start_level_id).toBe('heal_room');
    expect(replay.frames?.some((frame) => frame.actions?.move_right)).toBe(true);
  });

  it('documents heal trace semantics', () => {
    const docsPath = join(repoRoot, 'docs', 'godot-v2', 'session-outcomes.md');
    const docs = readFileSync(docsPath, 'utf8');

    expect(docs).toContain('heal.collected');
    expect(docs).toContain('player.healed');
    expect(docs).toContain('player.revive_acquired');
    expect(docs).toContain('player.revived');
    expect(docs).toContain('heal_room_recover_and_goal.json');
  });
});
