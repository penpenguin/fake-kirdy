import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, '..');
const godotRoot = join(repoRoot, 'godot');

const readGodotFile = (relativePath: string): string =>
  readFileSync(join(godotRoot, relativePath), 'utf8');

describe('Godot v2 map overlay', () => {
  it('adds a minimal UI overlay for explored tile visibility', () => {
    const scriptPath = join(godotRoot, 'scripts', 'ui', 'MapOverlay.gd');
    const scenePath = join(godotRoot, 'scenes', 'ui', 'MapOverlay.tscn');

    expect(existsSync(scriptPath)).toBe(true);
    expect(existsSync(scenePath)).toBe(true);

    const script = readGodotFile('scripts/ui/MapOverlay.gd');
    const scene = readGodotFile('scenes/ui/MapOverlay.tscn');

    expect(script).toContain('class_name MapOverlay');
    expect(script).toContain('extends Control');
    expect(script).toContain('set_map_state');
    expect(script).toContain('build_tile_rects');
    expect(script).toContain('build_feature_markers');
    expect(script).toContain('get_visible_tile_count');
    expect(script).toContain('undiscovered_feature_color');
    expect(script).toContain('discovered_feature_color');
    expect(script).toContain('draw_rect');
    expect(script).toContain('draw_circle');
    expect(scene).toContain('MapOverlay.gd');
  });

  it('syncs GameSession exploration state into the map overlay and trace stream', () => {
    const session = readGodotFile('scripts/session/GameSession.gd');
    const mainScene = readGodotFile('scenes/Main.tscn');
    const project = readGodotFile('project.godot');

    expect(session).toContain('MapOverlayScene');
    expect(session).toContain('@export var map_overlay_enabled');
    expect(session).toContain('@export var map_toggle_action');
    expect(session).toContain('setup_map_overlay');
    expect(session).toContain('check_map_actions');
    expect(session).toContain('toggle_map_overlay');
    expect(session).toContain('sync_map_overlay');
    expect(session).toContain('map.updated');
    expect(session).toContain('map.toggled');
    expect(session).toContain('"map_visible"');
    expect(session).toContain('get_map_features_payload');
    expect(session).toContain('"feature_type"');
    expect(session).toContain('"discovered"');
    expect(session).toContain('is_tile_explored');
    expect(session).toContain('get_explored_tile_count');
    expect(session).toContain('mark_player_tile_explored');
    expect(mainScene).toContain('map_overlay_enabled = true');
    expect(project).toContain('map_toggle');
    expect(project).toContain('keycode":77');
  });

  it('carries readable door target labels through map feature payloads', () => {
    const session = readGodotFile('scripts/session/GameSession.gd');
    const script = readGodotFile('scripts/ui/MapOverlay.gd');

    expect(session).toContain('append_door_map_features(features, current_definition.doors)');
    expect(session).toContain('"door_label": get_door_label(payload, target_level_id)');
    expect(session).toContain('"target_level_id": target_level_id');
    expect(session).toContain('"target_level_display_name": get_level_display_name(target_level_id)');

    expect(script).toContain('"door_label": String(feature.get("door_label", ""))');
    expect(script).toContain('"target_level_id": String(feature.get("target_level_id", ""))');
    expect(script).toContain('"target_level_display_name": String(feature.get("target_level_display_name", ""))');
  });

  it('adds replay coverage for map visibility toggling', () => {
    const replayPath = join(godotRoot, 'tests', 'replays', 'map_toggle_visibility.json');
    const suite = JSON.parse(readGodotFile('tests/replay_suite.json')) as {
      replays?: Array<{
        id?: string;
        replay_path?: string;
        expected_events?: string[];
      }>;
    };

    expect(existsSync(replayPath)).toBe(true);

    const replay = JSON.parse(readFileSync(replayPath, 'utf8')) as {
      frames?: Array<{ actions?: Record<string, boolean> }>;
    };
    const suiteEntry = suite.replays?.find((entry) => entry.id === 'map_toggle_visibility');

    expect(replay.frames?.some((frame) => frame.actions?.map_toggle)).toBe(true);
    expect(suiteEntry?.replay_path).toBe('res://tests/replays/map_toggle_visibility.json');
    expect(suiteEntry?.expected_events).toContain('map.toggled');
  });
});
