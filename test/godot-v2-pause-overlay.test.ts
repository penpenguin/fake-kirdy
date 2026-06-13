import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, '..');
const godotRoot = join(repoRoot, 'godot');

const readGodotFile = (relativePath: string): string =>
  readFileSync(join(godotRoot, relativePath), 'utf8');

describe('Godot v2 pause overlay', () => {
  it('adds a minimal pause overlay scene for paused sessions', () => {
    const scriptPath = join(godotRoot, 'scripts', 'ui', 'PauseOverlay.gd');
    const scenePath = join(godotRoot, 'scenes', 'ui', 'PauseOverlay.tscn');

    expect(existsSync(scriptPath)).toBe(true);
    expect(existsSync(scenePath)).toBe(true);

    const script = readGodotFile('scripts/ui/PauseOverlay.gd');
    const scene = readGodotFile('scenes/ui/PauseOverlay.tscn');

    expect(script).toContain('class_name PauseOverlay');
    expect(script).toContain('extends Control');
    expect(script).toContain('set_pause_state');
    expect(script).toContain('is_paused');
    expect(script).toContain('settings_open');
    expect(script).toContain('visible = is_paused');
    expect(scene).toContain('PauseOverlay.gd');
    expect(scene).toContain('TitleLabel');
    expect(scene).toContain('ResumeLabel');
    expect(scene).toContain('SettingsLabel');
  });

  it('wires pause overlay, input, and trace through GameSession', () => {
    const session = readGodotFile('scripts/session/GameSession.gd');
    const mainScene = readGodotFile('scenes/Main.tscn');
    const project = readGodotFile('project.godot');

    expect(session).toContain('PauseOverlayScene');
    expect(session).toContain('@export var pause_menu_enabled');
    expect(session).toContain('@export var pause_toggle_action');
    expect(session).toContain('@export var pause_settings_action');
    expect(session).toContain('pause_settings_open');
    expect(session).toContain('setup_pause_overlay');
    expect(session).toContain('check_pause_actions');
    expect(session).toContain('toggle_pause_menu');
    expect(session).toContain('open_pause_settings');
    expect(session).toContain('close_pause_settings');
    expect(session).toContain('sync_pause_overlay');
    expect(session).toContain('pause.toggled');
    expect(session).toContain('pause.settings.opened');
    expect(session).toContain('pause.settings.closed');
    expect(mainScene).toContain('pause_menu_enabled = true');
    expect(project).toContain('pause_toggle');
    expect(project).toContain('pause_settings');
    expect(project).toContain('pause_reset');
    expect(project).toContain('keycode":4194305');
  });

  it('adds a dedicated PauseScene with blur/fallback background management', () => {
    const scriptPath = join(godotRoot, 'scripts', 'ui', 'PauseScene.gd');
    const scenePath = join(godotRoot, 'scenes', 'ui', 'PauseScene.tscn');

    expect(existsSync(scriptPath)).toBe(true);
    expect(existsSync(scenePath)).toBe(true);

    const script = readGodotFile('scripts/ui/PauseScene.gd');
    const scene = readGodotFile('scenes/ui/PauseScene.tscn');
    const session = readGodotFile('scripts/session/GameSession.gd');
    const docs = readFileSync(join(repoRoot, 'docs', 'godot-v2', 'pause-overlay.md'), 'utf8');

    expect(script).toContain('class_name PauseScene');
    expect(script).toContain('extends PauseOverlay');
    expect(script).toContain('blur_managed_by_parent');
    expect(script).toContain('canvas_fallback_blur_enabled');
    expect(script).toContain('set_blur_active');
    expect(script).toContain('BlurFallback');
    expect(scene).toContain('PauseScene.gd');
    expect(scene).toContain('BlurFallback');
    expect(session).toContain('PauseSceneScene');
    expect(session).toContain('setup_pause_scene');
    expect(session).toContain('sync_pause_scene');
    expect(session).toContain('pause.scene.shown');
    expect(session).toContain('blur_active');
    expect(docs).toContain('PauseScene.gd');
    expect(docs).toContain('blur fallback');
  });

  it('keeps pause text in a foreground modal panel with readable controls and reset affordance', () => {
    const script = readGodotFile('scripts/ui/PauseOverlay.gd');
    const scene = readGodotFile('scenes/ui/PauseScene.tscn');

    expect(scene).toContain('ModalPanel');
    expect(scene).toContain('z_index = 100');
    expect(scene).toContain('z_index = 101');
    expect(scene).toContain('ResetLabel');
    expect(scene).toContain('ControlsHelpLabel');
    expect(script).toContain('reset_label');
    expect(script).toContain('Press R to reset position');
    expect(script).toContain('get_pause_reset_text');
    expect(script).toContain('get_controls_help_text');
  });

  it('adds replay coverage for pausing and resuming', () => {
    const replayPath = join(godotRoot, 'tests', 'replays', 'pause_toggle_menu.json');
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
    const suiteEntry = suite.replays?.find((entry) => entry.id === 'pause_toggle_menu');

    expect(replay.frames?.some((frame) => frame.actions?.pause_toggle)).toBe(true);
    expect(suiteEntry?.replay_path).toBe('res://tests/replays/pause_toggle_menu.json');
    expect(suiteEntry?.expected_events).toContain('pause.toggled');
  });

  it('checks pause input before advancing replay timing while paused', () => {
    const session = readGodotFile('scripts/session/GameSession.gd');
    const physicsProcessStart = session.indexOf('func _physics_process(delta: float) -> void:');
    const pauseCheckIndex = session.indexOf('check_pause_actions()', physicsProcessStart);
    const runFrameIndex = session.indexOf('run_frame += 1', physicsProcessStart);
    const pausedReturnIndex = session.indexOf('if session_paused:', physicsProcessStart);

    expect(physicsProcessStart).toBeGreaterThanOrEqual(0);
    expect(pauseCheckIndex).toBeGreaterThan(physicsProcessStart);
    expect(pausedReturnIndex).toBeGreaterThan(pauseCheckIndex);
    expect(runFrameIndex).toBeGreaterThan(pausedReturnIndex);
  });

  it('pauses actor physics while the pause overlay is active', () => {
    const session = readGodotFile('scripts/session/GameSession.gd');

    expect(session).toContain('var paused_actor_physics_states: Dictionary = {}');
    expect(session).toContain('func apply_actor_pause_state(paused: bool) -> void:');
    expect(session).toContain('func set_pause_actor_state(paused: bool, reason: String = "") -> void:');
    expect(session).toContain('pause_actor_physics(player)');
    expect(session).toContain('pause_actor_physics(enemy)');
    expect(session).toContain('restore_paused_actor_physics()');
    expect(session).toContain('set_pause_actor_state(session_paused, "pause.toggled")');
    expect(session).toContain('"pause.actors.paused"');
    expect(session).toContain('"pause.actors.restored"');
  });

  it('resets the player to the active safe spawn from pause without leaving pause state', () => {
    const session = readGodotFile('scripts/session/GameSession.gd');
    const project = readGodotFile('project.godot');

    expect(session).toContain('@export var pause_reset_action');
    expect(session).toContain('is_session_action_just_pressed(pause_reset_action)');
    expect(session).toContain('func reset_player_to_safe_spawn() -> void:');
    expect(session).toContain('spawn_player(requested_spawn_id)');
    expect(session).toContain('"pause.position_reset"');
    expect(session).toContain('"previous_position"');
    expect(session).toContain('"reset_position"');
    expect(project).toContain('pause_reset');
    expect(project).toContain('keycode":82');
  });

  it('adds replay coverage for opening settings from pause and closing the menu hierarchy', () => {
    const replayPath = join(godotRoot, 'tests', 'replays', 'pause_settings_flow.json');
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
    const suiteEntry = suite.replays?.find((entry) => entry.id === 'pause_settings_flow');

    expect(replay.frames?.some((frame) => frame.actions?.pause_toggle)).toBe(true);
    expect(replay.frames?.some((frame) => frame.actions?.pause_settings)).toBe(true);
    expect(replay.frames?.some((frame) => frame.actions?.settings_volume_up)).toBe(true);
    expect(suiteEntry?.replay_path).toBe('res://tests/replays/pause_settings_flow.json');
    expect(suiteEntry?.expected_events).toEqual(expect.arrayContaining([
      'pause.settings.opened',
      'settings.updated',
      'pause.settings.closed',
      'pause.toggled',
    ]));
  });

  it('adds replay coverage for pause position reset', () => {
    const replayPath = join(godotRoot, 'tests', 'replays', 'pause_position_reset.json');
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
    const suiteEntry = suite.replays?.find((entry) => entry.id === 'pause_position_reset');

    expect(replay.frames?.some((frame) => frame.actions?.pause_toggle)).toBe(true);
    expect(replay.frames?.some((frame) => frame.actions?.pause_reset)).toBe(true);
    expect(suiteEntry?.replay_path).toBe('res://tests/replays/pause_position_reset.json');
    expect(suiteEntry?.expected_events).toEqual(expect.arrayContaining(['pause.position_reset', 'hud.updated']));
  });
});
