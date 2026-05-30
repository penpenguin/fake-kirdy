import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, '..');
const godotRoot = join(repoRoot, 'godot');

const readGodotFile = (relativePath: string): string =>
  readFileSync(join(godotRoot, relativePath), 'utf8');

describe('Godot v2 virtual controls overlay', () => {
  it('adds a touch virtual controls scene with D-pad and Z/X/C buttons', () => {
    const scriptPath = join(godotRoot, 'scripts', 'ui', 'VirtualControlsOverlay.gd');
    const scenePath = join(godotRoot, 'scenes', 'ui', 'VirtualControlsOverlay.tscn');

    expect(existsSync(scriptPath)).toBe(true);
    expect(existsSync(scenePath)).toBe(true);

    const script = readGodotFile('scripts/ui/VirtualControlsOverlay.gd');
    const scene = readGodotFile('scenes/ui/VirtualControlsOverlay.tscn');

    expect(script).toContain('class_name VirtualControlsOverlay');
    expect(script).toContain('extends Control');
    expect(script).toContain('set_virtual_controls_state');
    expect(script).toContain('ACTION_BINDINGS');
    expect(script).toContain('handle_button_pressed');
    expect(script).toContain('handle_button_released');
    expect(script).toContain('Input.action_press');
    expect(script).toContain('Input.action_release');
    expect(script).toContain('pressed_actions');
    expect(scene).toContain('VirtualControlsOverlay.gd');
    expect(scene).toContain('DpadLeftButton');
    expect(scene).toContain('DpadRightButton');
    expect(scene).toContain('DpadUpButton');
    expect(scene).toContain('ActionZButton');
    expect(scene).toContain('ActionXButton');
    expect(scene).toContain('ActionCButton');
  });

  it('maps virtual buttons to canonical gameplay actions', () => {
    const script = readGodotFile('scripts/ui/VirtualControlsOverlay.gd');

    expect(script).toContain('"DpadLeftButton": &"move_left"');
    expect(script).toContain('"DpadRightButton": &"move_right"');
    expect(script).toContain('"DpadUpButton": &"jump"');
    expect(script).toContain('"ActionZButton": &"use_ability"');
    expect(script).toContain('"ActionXButton": &"swallow"');
    expect(script).toContain('"ActionCButton": &"inhale"');
  });

  it('wires touch controls visibility through GameSession and settings state', () => {
    const session = readGodotFile('scripts/session/GameSession.gd');
    const mainScene = readGodotFile('scenes/Main.tscn');

    expect(session).toContain('VirtualControlsOverlayScene');
    expect(session).toContain('@export var virtual_controls_enabled');
    expect(session).toContain('virtual_controls_overlay');
    expect(session).toContain('setup_virtual_controls_overlay');
    expect(session).toContain('sync_virtual_controls_overlay');
    expect(session).toContain('virtual_controls.updated');
    expect(session).toContain('setting_controls == "touch"');
    expect(mainScene).toContain('virtual_controls_enabled = true');
  });

  it('adds replay coverage for enabling virtual controls through touch settings', () => {
    const replayPath = join(godotRoot, 'tests', 'replays', 'virtual_controls_touch_mode.json');
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
    const suiteEntry = suite.replays?.find((entry) => entry.id === 'virtual_controls_touch_mode');

    expect(replay.frames?.some((frame) => frame.actions?.settings_cycle_controls)).toBe(true);
    expect(suiteEntry?.replay_path).toBe('res://tests/replays/virtual_controls_touch_mode.json');
    expect(suiteEntry?.expected_events).toContain('virtual_controls.updated');
    expect(suiteEntry?.expected_events).toContain('settings.updated');
  });
});
