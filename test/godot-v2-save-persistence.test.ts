import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, '..');
const godotRoot = join(repoRoot, 'godot');

const readGodotFile = (relativePath: string): string =>
  readFileSync(join(godotRoot, relativePath), 'utf8');

describe('Godot v2 save persistence foundation', () => {
  it('defines a minimal JSON save state and store for progression data', () => {
    const statePath = join(godotRoot, 'scripts', 'save', 'SaveState.gd');
    const storePath = join(godotRoot, 'scripts', 'save', 'SaveStore.gd');

    expect(existsSync(statePath)).toBe(true);
    expect(existsSync(storePath)).toBe(true);

    const state = readGodotFile('scripts/save/SaveState.gd');
    const store = readGodotFile('scripts/save/SaveStore.gd');

    expect(state).toContain('class_name SaveState');
    expect(state).toContain('CURRENT_VERSION');
    expect(state).toContain('var acquired_item_ids');
    expect(state).toContain('var completed_level_ids');
    expect(state).toContain('var visited_level_ids');
    expect(state).toContain('var unlocked_door_ids');
    expect(state).toContain('var opened_ability_gate_ids');
    expect(state).toContain('var explored_tiles');
    expect(state).toContain('sanitize_explored_tiles');
    expect(state).toContain('var current_level_id');
    expect(state).toContain('var player_position');
    expect(state).toContain('var ability_type');
    expect(state).toContain('var settings');
    expect(state).toContain('sanitize_settings');
    expect(state).toContain('var player_hp');
    expect(state).toContain('var player_max_hp');
    expect(state).toContain('var consumed_heal_ids');
    expect(state).toContain('"consumed_heal_ids": consumed_heal_ids');
    expect(state).toContain('data.get("consumed_heal_ids", [])');
    expect(state).toContain('to_dictionary');
    expect(state).toContain('from_dictionary');
    expect(store).toContain('class_name SaveStore');
    expect(store).toContain('load_state');
    expect(store).toContain('save_state');
    expect(store).toContain('FileAccess.open');
    expect(store).toContain('JSON.parse_string');
  });

  it('wires GameSession collectible acquisition to persistent save trace events', () => {
    const session = readGodotFile('scripts/session/GameSession.gd');

    expect(session).toContain('SaveStore');
    expect(session).toContain('@export var save_enabled');
    expect(session).toContain('@export var save_path');
    expect(session).toContain('load_persistent_state');
    expect(session).toContain('write_persistent_state');
    expect(session).toContain('save.loaded');
    expect(session).toContain('save.written');
    expect(session).toContain('save.error');
    expect(session).toContain('item.acquired');
    expect(session).toContain('completed_level_ids');
    expect(session).toContain('visited_level_ids');
    expect(session).toContain('unlocked_door_ids');
    expect(session).toContain('opened_ability_gate_ids');
    expect(session).toContain('get_opened_ability_gate_ids');
    expect(session).toContain('explored_tiles');
    expect(session).toContain('mark_player_tile_explored');
    expect(session).toContain('get_explored_tiles_payload');
    expect(session).toContain('complete_level');
    expect(session).toContain('mark_level_visited');
    expect(session).toContain('unlock_door');
    expect(session).toContain('saved_level_id');
    expect(session).toContain('saved_player_position');
    expect(session).toContain('saved_ability_type');
    expect(session).toContain('get_saved_player_position_payload');
    expect(session).toContain('get_player_ability_type');
    expect(session).toContain('get_settings_payload');
    expect(session).toContain('@export var setting_volume');
    expect(session).toContain('@export var setting_controls');
    expect(session).toContain('@export var setting_difficulty');
    expect(session).toContain('player_hp');
    expect(session).toContain('for heal_id in state.consumed_heal_ids');
    expect(session).toContain('"consumed_heal_ids": get_consumed_heal_ids()');
    expect(session).toContain('build_save_payload');
  });

  it('lets headless replay opt into a deterministic save path', () => {
    const runner = readGodotFile('tests/run_replay.gd');
    const replayPath = join(godotRoot, 'tests', 'replays', 'use_saved_ability.json');

    expect(runner).toContain('--save');
    expect(runner).toContain('save_enabled');
    expect(runner).toContain('save_path');
    expect(existsSync(replayPath)).toBe(true);

    const replay = JSON.parse(readFileSync(replayPath, 'utf8')) as {
      start_level_id: string;
      frames: Array<{ actions?: Record<string, boolean> }>;
    };
    expect(replay.start_level_id).toBe('flat_room');
    expect(replay.frames.some((frame) => frame.actions?.use_ability)).toBe(true);
  });

  it('documents Godot save persistence semantics', () => {
    const docsPath = join(repoRoot, 'docs', 'godot-v2', 'save-persistence.md');

    expect(existsSync(docsPath)).toBe(true);

    const docs = readFileSync(docsPath, 'utf8');
    expect(docs).toContain('Save Persistence');
    expect(docs).toContain('item.acquired');
    expect(docs).toContain('save.loaded');
    expect(docs).toContain('save.written');
  });
});
