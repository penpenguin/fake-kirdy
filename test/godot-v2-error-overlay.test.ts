import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, '..');
const godotRoot = join(repoRoot, 'godot');

const readGodotFile = (relativePath: string): string =>
  readFileSync(join(godotRoot, relativePath), 'utf8');

describe('Godot v2 runtime error recovery overlay', () => {
  it('adds a minimal error overlay scene with retry guidance', () => {
    const scriptPath = join(godotRoot, 'scripts', 'ui', 'ErrorOverlay.gd');
    const scenePath = join(godotRoot, 'scenes', 'ui', 'ErrorOverlay.tscn');

    expect(existsSync(scriptPath)).toBe(true);
    expect(existsSync(scenePath)).toBe(true);

    const script = readGodotFile('scripts/ui/ErrorOverlay.gd');
    const scene = readGodotFile('scenes/ui/ErrorOverlay.tscn');

    expect(script).toContain('class_name ErrorOverlay');
    expect(script).toContain('extends Control');
    expect(script).toContain('set_error_state');
    expect(script).toContain('normalize_error_state');
    expect(script).toContain('runtime_error');
    expect(script).toContain('retry_available');
    expect(script).toContain('get_summary_text');
    expect(scene).toContain('ErrorOverlay.gd');
    expect(scene).toContain('TitleLabel');
    expect(scene).toContain('MessageLabel');
    expect(scene).toContain('RetryLabel');
  });

  it('shows runtime load errors from GameSession and records recovery UI traces', () => {
    const session = readGodotFile('scripts/session/GameSession.gd');
    const mainScene = readGodotFile('scenes/Main.tscn');
    const traceSummary = readFileSync(join(repoRoot, 'scripts', 'trace-summary.mjs'), 'utf8');

    expect(session).toContain('ErrorOverlayScene');
    expect(session).toContain('@export var error_overlay_enabled');
    expect(session).toContain('@export var error_retry_action');
    expect(session).toContain('setup_error_overlay');
    expect(session).toContain('show_error_overlay');
    expect(session).toContain('build_error_payload');
    expect(session).toContain('retry_after_error');
    expect(session).toContain('check_error_actions');
    expect(session).toContain('runtime.error.shown');
    expect(session).toContain('runtime.error.retry_selected');
    expect(session).toContain('Unable to load level: %s');
    expect(mainScene).toContain('error_overlay_enabled = true');
    expect(traceSummary).toContain('last_runtime_error');
    expect(traceSummary).toContain("eventType === 'runtime.error.shown'");
  });
});
