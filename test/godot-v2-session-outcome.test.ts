import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, '..');
const godotRoot = join(repoRoot, 'godot');

const readGodotFile = (relativePath: string): string =>
  readFileSync(join(godotRoot, relativePath), 'utf8');

describe('Godot v2 session death and game-over outcome', () => {
  it('tracks player HP and emits death/game-over trace events from GameSession', () => {
    const source = readGodotFile('scripts/session/GameSession.gd');

    expect(source).toContain('player_max_hp');
    expect(source).toContain('player_hp');
    expect(source).toContain('damage_player');
    expect(source).toContain('check_enemy_contact_damage');
    expect(source).toContain('player.damaged');
    expect(source).toContain('player.defeated');
    expect(source).toContain('game.over');
    expect(source).toContain('"outcome": "game_over"');
  });

  it('lets enemy marker metadata configure contact damage', () => {
    const marker = readGodotFile('scripts/level/markers/EnemySpawnMarker.gd');
    const enemy = readGodotFile('scripts/enemies/SimpleEnemy.gd');

    expect(marker).toContain('@export var contact_damage');
    expect(marker).toContain('"contact_damage"');
    expect(enemy).toContain('@export var contact_damage');
  });

  it('adds a replayable danger room that can end in game over', () => {
    const level = readGodotFile('levels/danger_room.tscn');
    const catalog = readGodotFile('levels/level_catalog.json');
    const replayPath = join(godotRoot, 'tests', 'replays', 'danger_room_game_over.json');

    expect(level).toContain('EnemySpawnMarker.gd');
    expect(level).toContain('contact_damage = 3');
    expect(catalog).toContain('"danger_room"');
    expect(existsSync(replayPath)).toBe(true);

    const replay = JSON.parse(readFileSync(replayPath, 'utf8')) as {
      start_level_id?: string;
      max_frames?: number;
      frames?: Array<{ actions?: Record<string, boolean> }>;
    };

    expect(replay.start_level_id).toBe('danger_room');
    expect(replay.max_frames).toBeGreaterThan(10);
    expect(replay.frames?.some((frame) => frame.actions?.move_right)).toBe(true);
  });

  it('documents death and game-over trace semantics', () => {
    const docsPath = join(repoRoot, 'docs', 'godot-v2', 'session-outcomes.md');

    expect(existsSync(docsPath)).toBe(true);

    const docs = readFileSync(docsPath, 'utf8');
    expect(docs).toContain('player.damaged');
    expect(docs).toContain('player.defeated');
    expect(docs).toContain('game.over');
    expect(docs).toContain('danger_room_game_over.json');
  });
});
