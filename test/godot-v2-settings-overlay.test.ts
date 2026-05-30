import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, '..');
const godotRoot = join(repoRoot, 'godot');

describe('Godot v2 settings overlay and trace', () => {
  it('adds a minimal SettingsOverlay scene for player-facing settings state', () => {
    const scriptPath = join(godotRoot, 'scripts', 'ui', 'SettingsOverlay.gd');
    const scenePath = join(godotRoot, 'scenes', 'ui', 'SettingsOverlay.tscn');

    expect(existsSync(scriptPath)).toBe(true);
    expect(existsSync(scenePath)).toBe(true);

    const script = readFileSync(scriptPath, 'utf8');
    const scene = readFileSync(scenePath, 'utf8');

    expect(script).toContain('class_name SettingsOverlay');
    expect(script).toContain('extends Control');
    expect(script).toContain('set_settings_state');
    expect(script).toContain('set_menu_visible');
    expect(script).toContain('set_focus_index');
    expect(script).toContain('selected_setting_index');
    expect(script).toContain('focus_prefix');
    expect(script).toContain('post_processing_blur_enabled');
    expect(script).toContain('canvas_fallback_blur_enabled');
    expect(script).toContain('PostProcessBlur');
    expect(script).toContain('BlurFallback');
    expect(script).toContain('set_blur_active');
    expect(script).toContain('get_summary_text');
    expect(script).toContain('volume');
    expect(script).toContain('controls');
    expect(script).toContain('difficulty');
    expect(scene).toContain('SettingsOverlay.gd');
    expect(scene).toContain('SettingsBlur.gdshader');
    expect(scene).toContain('PostProcessBlur');
    expect(scene).toContain('BlurFallback');
    expect(scene).toContain('VolumeLabel');
    expect(scene).toContain('ControlsLabel');
    expect(scene).toContain('DifficultyLabel');
  });

  it('wires settings overlay and replay actions through GameSession', () => {
    const session = readFileSync(join(godotRoot, 'scripts', 'session', 'GameSession.gd'), 'utf8');
    const mainScene = readFileSync(join(godotRoot, 'scenes', 'Main.tscn'), 'utf8');
    const project = readFileSync(join(godotRoot, 'project.godot'), 'utf8');

    expect(session).toContain('SettingsOverlayScene');
    expect(session).toContain('@export var settings_overlay_enabled');
    expect(session).toContain('settings_volume_up_action');
    expect(session).toContain('settings_cycle_controls_action');
    expect(session).toContain('settings_cycle_difficulty_action');
    expect(session).toContain('@export var settings_menu_action');
    expect(session).toContain('@export var settings_focus_next_action');
    expect(session).toContain('@export var settings_focus_previous_action');
    expect(session).toContain('settings_menu_open');
    expect(session).toContain('setup_settings_overlay');
    expect(session).toContain('check_settings_menu_actions');
    expect(session).toContain('open_settings_menu');
    expect(session).toContain('close_settings_menu');
    expect(session).toContain('move_settings_focus');
    expect(session).toContain('check_settings_actions');
    expect(session).toContain('sync_settings_overlay');
    expect(session).toContain('sync_settings_menu_visibility');
    expect(session).toContain('apply_settings_update');
    expect(session).toContain('settings.updated');
    expect(session).toContain('settings.menu.opened');
    expect(session).toContain('settings.menu.closed');
    expect(session).toContain('settings.focus.changed');
    expect(mainScene).toContain('settings_overlay_enabled = true');
    expect(project).toContain('settings_menu');
    expect(project).toContain('settings_focus_next');
    expect(project).toContain('settings_focus_previous');
    expect(project).toContain('settings_volume_up');
    expect(project).toContain('settings_cycle_controls');
    expect(project).toContain('settings_cycle_difficulty');
  });

  it('adds replay coverage and trace summary support for settings updates', () => {
    const replayPath = join(godotRoot, 'tests', 'replays', 'settings_adjustment.json');
    expect(existsSync(replayPath)).toBe(true);

    const replay = readFileSync(replayPath, 'utf8');
    const traceSummary = readFileSync(join(repoRoot, 'scripts', 'trace-summary.mjs'), 'utf8');
    const docs = readFileSync(join(repoRoot, 'docs', 'godot-v2', 'save-persistence.md'), 'utf8');

    expect(replay).toContain('settings_volume_up');
    expect(replay).toContain('settings_cycle_controls');
    expect(replay).toContain('settings_cycle_difficulty');
    expect(replay).toContain('settings_menu');
    expect(replay).toContain('settings_focus_next');
    expect(traceSummary).toContain("eventType === 'settings.updated'");
    expect(docs).toContain('SettingsOverlay.gd');
    expect(docs).toContain('settings.updated');
  });

  it('adds replay coverage for opening settings from the game menu with focus and blur state', () => {
    const replayPath = join(godotRoot, 'tests', 'replays', 'settings_menu_flow.json');
    const suite = JSON.parse(readFileSync(join(godotRoot, 'tests', 'replay_suite.json'), 'utf8')) as {
      replays?: Array<{
        id?: string;
        replay_path?: string;
        expected_events?: string[];
      }>;
    };

    expect(existsSync(replayPath)).toBe(true);

    const replay = readFileSync(replayPath, 'utf8');
    const suiteEntry = suite.replays?.find((entry) => entry.id === 'settings_menu_flow');

    expect(replay).toContain('settings_menu');
    expect(replay).toContain('settings_focus_next');
    expect(replay).toContain('settings_volume_up');
    expect(suiteEntry?.replay_path).toBe('res://tests/replays/settings_menu_flow.json');
    expect(suiteEntry?.expected_events).toEqual(expect.arrayContaining([
      'settings.menu.opened',
      'settings.focus.changed',
      'settings.updated',
      'settings.menu.closed',
    ]));
  });
});
