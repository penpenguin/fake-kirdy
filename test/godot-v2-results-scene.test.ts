import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, '..');
const godotRoot = join(repoRoot, 'godot');

const readGodotFile = (relativePath: string): string =>
  readFileSync(join(godotRoot, relativePath), 'utf8');

describe('Godot v2 ResultsScene', () => {
  it('adds a dedicated ResultsScene UI for final results', () => {
    const scriptPath = join(godotRoot, 'scripts', 'ui', 'ResultsScene.gd');
    const scenePath = join(godotRoot, 'scenes', 'ui', 'ResultsScene.tscn');

    expect(existsSync(scriptPath)).toBe(true);
    expect(existsSync(scenePath)).toBe(true);

    const script = readGodotFile('scripts/ui/ResultsScene.gd');
    const scene = readGodotFile('scenes/ui/ResultsScene.tscn');

    expect(script).toContain('class_name ResultsScene');
    expect(script).toContain('extends Control');
    expect(script).toContain('set_results_state');
    expect(script).toContain('get_summary_text');
    expect(script).toContain('score');
    expect(script).toContain('remaining_life_bonus');
    expect(script).toContain('time_ms');
    expect(scene).toContain('ResultsScene.gd');
    expect(scene).toContain('PopupBackdrop');
    expect(scene).toContain('ModalPanel');
    expect(scene).toContain('TitleLabel');
    expect(scene).toContain('ScoreLabel');
    expect(scene).toContain('TimeLabel');
    expect(scene).toContain('BonusLabel');
    expect(script).toContain('$ModalPanel/TitleLabel');
    expect(script).toContain('$ModalPanel/ScoreLabel');
  });

  it('shows foreground result controls so the full results scene is operable over the map', () => {
    const script = readGodotFile('scripts/ui/ResultsScene.gd');
    const scene = readGodotFile('scenes/ui/ResultsScene.tscn');

    expect(scene).toContain('PopupBackdrop');
    expect(scene).toContain('ModalPanel');
    expect(scene).toContain('z_index = 100');
    expect(scene).toContain('z_index = 101');
    expect(scene).toContain('ContinueLabel');
    expect(scene).toContain('RestartLabel');
    expect(script).toContain('continue_label');
    expect(script).toContain('restart_label');
    expect(script).toContain('Press Enter to return to hub');
    expect(script).toContain('Press R to restart');
  });

  it('wires ResultsScene transition through GameSession with key and delay paths', () => {
    const session = readGodotFile('scripts/session/GameSession.gd');
    const project = readGodotFile('project.godot');

    expect(session).toContain('ResultsSceneScene');
    expect(session).toContain('@export var result_continue_action');
    expect(session).toContain('@export var result_restart_action');
    expect(session).toContain('@export var result_auto_results_delay_ms');
    expect(session).toContain('result_elapsed_ms');
    expect(session).toContain('check_result_actions');
    expect(session).toContain('show_results_scene');
    expect(session).toContain('hide_results_scene("result.restart.selected")');
    expect(session).toContain('restart_current_run(true)');
    expect(session).toContain('results.scene.shown');
    expect(session).toContain('result_elapsed_ms');
    expect(session).toContain('results_payload["result_elapsed_ms"] = result_elapsed_ms');
    expect(session).toContain('results_payload["auto_delay_ms"] = result_auto_results_delay_ms');
    expect(project).toContain('result_continue');
    expect(project).toContain('result_restart');
  });

  it('adds replay coverage for continuing from result overlay into ResultsScene', () => {
    const replayPath = join(godotRoot, 'tests', 'replays', 'results_scene_continue.json');
    const suite = JSON.parse(readGodotFile('tests/replay_suite.json')) as {
      replays?: Array<{
        id?: string;
        replay_path?: string;
        expected_events?: string[];
      }>;
    };

    expect(existsSync(replayPath)).toBe(true);

    const replay = JSON.parse(readFileSync(replayPath, 'utf8')) as {
      continue_after_finished?: boolean;
      frames?: Array<{ actions?: Record<string, boolean> }>;
    };
    const suiteEntry = suite.replays?.find((entry) => entry.id === 'results_scene_continue');

    expect(replay.continue_after_finished).toBe(true);
    expect(replay.frames?.some((frame) => frame.actions?.result_continue)).toBe(true);
    expect(suiteEntry?.replay_path).toBe('res://tests/replays/results_scene_continue.json');
    expect(suiteEntry?.expected_events).toContain('results.scene.shown');
  });

  it('keeps result menu controls live after the full ResultsScene is visible', () => {
    const replayPath = join(godotRoot, 'tests', 'replays', 'results_scene_restart.json');
    const session = readGodotFile('scripts/session/GameSession.gd');
    const suite = JSON.parse(readGodotFile('tests/replay_suite.json')) as {
      replays?: Array<{
        id?: string;
        replay_path?: string;
        expected_events?: string[];
      }>;
    };

    expect(existsSync(replayPath)).toBe(true);
    expect(session).toContain('func hide_results_scene(reason: String = "") -> void:');
    expect(session).toContain('"results.scene.hidden"');

    const replay = JSON.parse(readFileSync(replayPath, 'utf8')) as {
      continue_after_finished?: boolean;
      frames?: Array<{ actions?: Record<string, boolean> }>;
    };
    const suiteEntry = suite.replays?.find((entry) => entry.id === 'results_scene_restart');

    expect(replay.continue_after_finished).toBe(true);
    expect(replay.frames?.some((frame) => frame.actions?.result_continue)).toBe(true);
    expect(replay.frames?.some((frame) => frame.actions?.result_restart)).toBe(true);
    expect(suiteEntry?.expected_events).toEqual(
      expect.arrayContaining(['results.scene.shown', 'results.scene.hidden', 'run.restart.selected']),
    );
  });

  it('continues from the full ResultsScene back to Central Hub with live controls', () => {
    const replayPath = join(godotRoot, 'tests', 'replays', 'results_scene_continue_to_hub.json');
    const session = readGodotFile('scripts/session/GameSession.gd');
    const suite = JSON.parse(readGodotFile('tests/replay_suite.json')) as {
      replays?: Array<{
        id?: string;
        replay_path?: string;
        expected_events?: string[];
      }>;
    };

    expect(existsSync(replayPath)).toBe(true);
    expect(session).toContain('func continue_results_to_hub() -> void:');
    expect(session).toContain('hide_results_scene("results.continue.selected")');
    expect(session).toContain('load_level("central_hub", "default")');
    expect(session).toContain('record_event", "results.continue.selected"');

    const replay = JSON.parse(readFileSync(replayPath, 'utf8')) as {
      continue_after_finished?: boolean;
      frames?: Array<{ actions?: Record<string, boolean> }>;
    };
    const suiteEntry = suite.replays?.find((entry) => entry.id === 'results_scene_continue_to_hub');

    expect(replay.continue_after_finished).toBe(true);
    expect(replay.frames?.some((frame) => frame.actions?.result_continue)).toBe(true);
    expect(replay.frames?.some((frame) => frame.actions?.move_right || frame.actions?.jump)).toBe(true);
    expect(suiteEntry?.replay_path).toBe('res://tests/replays/results_scene_continue_to_hub.json');
    expect(suiteEntry?.expected_events).toEqual(
      expect.arrayContaining(['results.scene.shown', 'results.continue.selected', 'door.entered', 'player.jump.started']),
    );
  });
});
