import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, '..');
const godotRoot = join(repoRoot, 'godot');

const readGodotFile = (relativePath: string): string =>
  readFileSync(join(godotRoot, relativePath), 'utf8');

describe('Godot v2 replay and trace foundation', () => {
  it('defines a frame input model for replayed actions', () => {
    const source = readGodotFile('scripts/sim/FrameInput.gd');

    expect(source).toContain('extends RefCounted');
    expect(source).toContain('class_name FrameInput');
    expect(source).toContain('var frame: int');
    expect(source).toContain('var actions: Dictionary');
    expect(source).toContain('from_dictionary');
    expect(source).toContain('is_action_pressed');
    expect(source).toContain('get_axis');
  });

  it('loads sparse JSON replay input frame by frame', () => {
    const source = readGodotFile('scripts/sim/ReplayInputSource.gd');

    expect(source).toContain('class_name ReplayInputSource');
    expect(source).toContain('JSON.parse_string');
    expect(source).toContain('load_replay');
    expect(source).toContain('advance_frame');
    expect(source).toContain('is_action_pressed');
    expect(source).toContain('is_action_just_pressed');
    expect(source).toContain('is_action_just_released');
    expect(source).toContain('get_axis');
    expect(source).toContain('initial_player_hp');
    expect(source).toContain('initial_player_max_hp');
  });

  it('records trace events as JSON or NDJSON with terminal events', () => {
    const source = readGodotFile('scripts/sim/TraceRecorder.gd');

    expect(source).toContain('class_name TraceRecorder');
    expect(source).toContain('record_player_event');
    expect(source).toContain('record_run_finished');
    expect(source).toContain('record_replay_error');
    expect(source).toContain('run.finished');
    expect(source).toContain('replay.error');
    expect(source).toContain('write_to_path');
    expect(source).toContain('to_json');
    expect(source).toContain('ndjson');
  });

  it('provides a valid controller lab sample replay', () => {
    const replayPath = join(godotRoot, 'tests', 'replays', 'controller_lab_jump.json');
    const replay = JSON.parse(readFileSync(replayPath, 'utf8'));

    expect(replay.scene_path).toBe('res://levels/controller_lab.tscn');
    expect(replay.level_id).toBe('controller_lab');
    expect(replay.fps).toBeGreaterThan(0);
    expect(replay.max_frames).toBeGreaterThan(30);
    expect(Array.isArray(replay.frames)).toBe(true);
    expect(replay.frames.some((frame: { actions?: Record<string, boolean> }) => frame.actions?.jump)).toBe(true);
    expect(replay.frames.some((frame: { actions?: Record<string, boolean> }) => frame.actions?.move_right)).toBe(true);
  });

  it('adds a headless runner that connects replay input to trace output', () => {
    const source = readGodotFile('tests/run_replay.gd');

    expect(source).toContain('ReplayInputSource');
    expect(source).toContain('TraceRecorder');
    expect(source).toContain('load_replay');
    expect(source).toContain('load_interactive');
    expect(source).toContain('input_source');
    expect(source).toContain('trace_event.connect');
    expect(source).toContain('advance_frame');
    expect(source).toContain('player.sampled');
    expect(source).toContain('record_player_sample');
    expect(source).toContain('write_to_path');
    expect(source).toContain('record_run_finished');
    expect(source).toContain('record_replay_error');
    expect(source).toContain('apply_initial_player_health');
  });

  it('allows selected session replays to continue after a finished state for result menu input', () => {
    const runner = readGodotFile('tests/run_replay.gd');
    const inputSource = readGodotFile('scripts/sim/ReplayInputSource.gd');

    expect(inputSource).toContain('continue_after_finished');
    expect(inputSource).toContain('parsed.get("continue_after_finished"');
    expect(runner).toContain('continue_after_finished');
    expect(runner).toContain('if session.call("is_finished") and not input_source.get("continue_after_finished")');
  });

  it('lets PlayerController use replay input and emit recorder-ready player traces', () => {
    const source = readGodotFile('scripts/player/PlayerController.gd');

    expect(source).toContain('var input_source');
    expect(source).toContain('get_input_axis');
    expect(source).toContain('is_input_action_pressed');
    expect(source).toContain('is_input_action_just_pressed');
    expect(source).toContain('is_input_action_just_released');
    expect(source).toContain('"player"');
    expect(source).toContain('"position"');
    expect(source).toContain('"velocity"');
    expect(source).toContain('player.jump.started');
    expect(source).toContain('player.landed');
    expect(source).toContain('player.hover.started');
  });

  it('documents replay and trace usage', () => {
    const docsPath = join(repoRoot, 'docs', 'godot-v2', 'replay-and-trace.md');

    expect(existsSync(docsPath)).toBe(true);

    const docs = readFileSync(docsPath, 'utf8');
    expect(docs).toContain('Replay');
    expect(docs).toContain('Trace');
    expect(docs).toContain('run.finished');
    expect(docs).toContain('replay.error');
    expect(docs).toContain('controller_lab_jump.json');
  });
});
