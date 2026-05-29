import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, '..');
const godotRoot = join(repoRoot, 'godot');

const readGodotFile = (relativePath: string): string =>
  readFileSync(join(godotRoot, relativePath), 'utf8');

describe('Godot v2 HUD overlay', () => {
  it('adds a minimal mainline HUD for HP, ability, items, level, and outcome', () => {
    const scriptPath = join(godotRoot, 'scripts', 'ui', 'HudOverlay.gd');
    const scenePath = join(godotRoot, 'scenes', 'ui', 'HudOverlay.tscn');

    expect(existsSync(scriptPath)).toBe(true);
    expect(existsSync(scenePath)).toBe(true);

    const script = readGodotFile('scripts/ui/HudOverlay.gd');
    const scene = readGodotFile('scenes/ui/HudOverlay.tscn');

    expect(script).toContain('class_name HudOverlay');
    expect(script).toContain('extends Control');
    expect(script).toContain('set_hud_state');
    expect(script).toContain('get_summary_text');
    expect(script).toContain('hp');
    expect(script).toContain('ability_type');
    expect(script).toContain('items_collected');
    expect(script).toContain('outcome');
    expect(scene).toContain('HudOverlay.gd');
    expect(scene).toContain('HpLabel');
    expect(scene).toContain('AbilityLabel');
    expect(scene).toContain('ItemsLabel');
    expect(scene).toContain('OutcomeLabel');
  });

  it('syncs GameSession state into the HUD and trace stream', () => {
    const session = readGodotFile('scripts/session/GameSession.gd');
    const mainScene = readGodotFile('scenes/Main.tscn');
    const traceSummary = readFileSync(join(repoRoot, 'scripts', 'trace-summary.mjs'), 'utf8');

    expect(session).toContain('HudOverlayScene');
    expect(session).toContain('@export var hud_overlay_enabled');
    expect(session).toContain('setup_hud_overlay');
    expect(session).toContain('sync_hud_overlay');
    expect(session).toContain('build_hud_payload');
    expect(session).toContain('hud.updated');
    expect(mainScene).toContain('hud_overlay_enabled = true');
    expect(traceSummary).toContain('last_hud');
    expect(traceSummary).toContain("eventType === 'hud.updated'");
  });
});
