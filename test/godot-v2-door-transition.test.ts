import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, '..');
const godotRoot = join(repoRoot, 'godot');

const readGodotFile = (relativePath: string): string =>
  readFileSync(join(godotRoot, relativePath), 'utf8');

describe('Godot v2 door transition and run outcome', () => {
  it('keeps door transition metadata on DoorMarker', () => {
    const source = readGodotFile('scripts/level/markers/DoorMarker.gd');

    expect(source).toContain('@export var door_id');
    expect(source).toContain('@export var target_level_id');
    expect(source).toContain('@export var target_spawn_id');
    expect(source).toContain('trigger_radius');
  });

  it('loads target levels by id through LevelLoader', () => {
    const source = readGodotFile('scripts/level/LevelLoader.gd');
    const catalog = readFileSync(join(godotRoot, 'levels', 'level_catalog.json'), 'utf8');

    expect(source).toContain('level_catalog_path');
    expect(source).toContain('catalog_levels');
    expect(catalog).toContain('"door_room"');
    expect(catalog).toContain('"flat_room"');
    expect(source).toContain('get_level_path');
    expect(source).toContain('load_level_by_id');
  });

  it('adds a GameSession that owns level, player, trace, timer, and outcome', () => {
    const source = readGodotFile('scripts/session/GameSession.gd');

    expect(source).toContain('class_name GameSession');
    expect(source).toContain('current_level_id');
    expect(source).toContain('player');
    expect(source).toContain('trace_recorder');
    expect(source).toContain('run_frame');
    expect(source).toContain('run_time_ms');
    expect(source).toContain('outcome');
    expect(source).toContain('load_level');
    expect(source).toContain('spawn_player');
    expect(source).toContain('door.entered');
    expect(source).toContain('level.loaded');
    expect(source).toContain('run.finished');
  });

  it('adds a replay that moves from door_room to a goal', () => {
    const replayPath = join(godotRoot, 'tests', 'replays', 'door_to_goal.json');
    const replay = JSON.parse(readFileSync(replayPath, 'utf8'));

    expect(replay.start_level_id).toBe('door_room');
    expect(replay.level_id).toBe('door_room');
    expect(replay.max_frames).toBeGreaterThan(120);
    expect(replay.frames.some((frame: { actions?: Record<string, boolean> }) => frame.actions?.move_right)).toBe(true);
  });

  it('updates the runner to support GameSession replay mode', () => {
    const source = readGodotFile('tests/run_replay.gd');

    expect(source).toContain('GameSession');
    expect(source).toContain('start_level_id');
    expect(source).toContain('run_session_replay');
    expect(source).toContain('trace_recorder');
    expect(source).toContain('is_finished');
  });

  it('documents door transition flow', () => {
    const docsPath = join(repoRoot, 'docs', 'godot-v2', 'door-transition-flow.md');

    expect(existsSync(docsPath)).toBe(true);

    const docs = readFileSync(docsPath, 'utf8');
    expect(docs).toContain('Door Transition');
    expect(docs).toContain('door.entered');
    expect(docs).toContain('level.loaded');
    expect(docs).toContain('run.finished');
    expect(docs).toContain('door_to_goal.json');
  });
});
