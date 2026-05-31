import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, '..');
const godotRoot = join(repoRoot, 'godot');

const readGodotFile = (relativePath: string): string =>
  readFileSync(join(godotRoot, relativePath), 'utf8');

describe('Godot v2 result overlay', () => {
  it('adds a minimal result overlay scene for completed and game-over runs', () => {
    const scriptPath = join(godotRoot, 'scripts', 'ui', 'ResultOverlay.gd');
    const scenePath = join(godotRoot, 'scenes', 'ui', 'ResultOverlay.tscn');

    expect(existsSync(scriptPath)).toBe(true);
    expect(existsSync(scenePath)).toBe(true);

    const script = readGodotFile('scripts/ui/ResultOverlay.gd');
    const scene = readGodotFile('scenes/ui/ResultOverlay.tscn');

    expect(script).toContain('class_name ResultOverlay');
    expect(script).toContain('extends Control');
    expect(script).toContain('set_result_state');
    expect(script).toContain('get_summary_text');
    expect(script).toContain('outcome');
    expect(script).toContain('time_ms');
    expect(script).toContain('score');
    expect(script).toContain('remaining_life_bonus');
    expect(script).toContain('items_collected');
    expect(script).toContain('restart_available');
    expect(scene).toContain('ResultOverlay.gd');
    expect(scene).toContain('TitleLabel');
    expect(scene).toContain('TimeLabel');
    expect(scene).toContain('ScoreLabel');
    expect(scene).toContain('BonusLabel');
    expect(scene).toContain('ItemsLabel');
    expect(scene).toContain('RestartLabel');
  });

  it('keeps the result overlay hidden until a finished result is provided', () => {
    const script = readGodotFile('scripts/ui/ResultOverlay.gd');

    expect(script).toContain('has_finished_result');
    expect(script).toContain('visible = has_finished_result(result_state)');
    expect(script).toContain('"completed", "complete", "game_over"');
    expect(script).not.toContain('visible = true');
  });

  it('shows result overlay from GameSession and exposes it to trace metrics', () => {
    const session = readGodotFile('scripts/session/GameSession.gd');
    const mainScene = readGodotFile('scenes/Main.tscn');
    const traceSummary = readFileSync(join(repoRoot, 'scripts', 'trace-summary.mjs'), 'utf8');
    const restartBody = session.slice(
      session.indexOf('func restart_current_run'),
      session.indexOf('func show_result_overlay'),
    );

    expect(session).toContain('ResultOverlayScene');
    expect(session).toContain('@export var result_overlay_enabled');
    expect(session).toContain('setup_result_overlay');
    expect(session).toContain('show_result_overlay');
    expect(session).toContain('build_result_payload');
    expect(session).toContain('calculate_total_score');
    expect(session).toContain('remaining_life_bonus');
    expect(session).toContain('@export var result_restart_action');
    expect(session).toContain('check_result_actions');
    expect(session).toContain('restart_current_run');
    expect(session).toContain('reset_run_clock');
    expect(session).toContain('trace_recorder.call("set_frame", run_frame)');
    expect(restartBody).toContain('reset_run_clock()');
    expect(session).toContain('run.restart.selected');
    expect(session).toContain('result.overlay.shown');
    expect(mainScene).toContain('result_overlay_enabled = true');
    expect(traceSummary).toContain('last_result_overlay');
    expect(traceSummary).toContain("eventType === 'result.overlay.shown'");
  });
});
