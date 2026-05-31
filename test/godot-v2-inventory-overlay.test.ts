import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, '..');
const godotRoot = join(repoRoot, 'godot');

describe('Godot v2 inventory overlay and trace', () => {
  it('adds a minimal InventoryOverlay scene for item, ability, and progress state', () => {
    const scriptPath = join(godotRoot, 'scripts', 'ui', 'InventoryOverlay.gd');
    const scenePath = join(godotRoot, 'scenes', 'ui', 'InventoryOverlay.tscn');

    expect(existsSync(scriptPath)).toBe(true);
    expect(existsSync(scenePath)).toBe(true);

    const script = readFileSync(scriptPath, 'utf8');
    const scene = readFileSync(scenePath, 'utf8');

    expect(script).toContain('class_name InventoryOverlay');
    expect(script).toContain('extends Control');
    expect(script).toContain('set_inventory_state');
    expect(script).toContain('get_summary_text');
    expect(script).toContain('items_collected');
    expect(script).toContain('ability_type');
    expect(script).toContain('completed_level_ids');
    expect(script).toContain('visited_level_ids');
    expect(scene).toContain('InventoryOverlay.gd');
    expect(scene).toContain('ItemsLabel');
    expect(scene).toContain('AbilityLabel');
    expect(scene).toContain('ProgressLabel');
  });

  it('wires inventory overlay through GameSession and Main', () => {
    const session = readFileSync(join(godotRoot, 'scripts', 'session', 'GameSession.gd'), 'utf8');
    const mainScene = readFileSync(join(godotRoot, 'scenes', 'Main.tscn'), 'utf8');

    expect(session).toContain('InventoryOverlayScene');
    expect(session).toContain('@export var inventory_overlay_enabled');
    expect(session).toContain('setup_inventory_overlay');
    expect(session).toContain('sync_inventory_overlay');
    expect(session).toContain('build_inventory_payload');
    expect(session).toContain('inventory.updated');
    expect(mainScene).toContain('inventory_overlay_enabled = true');
  });

  it('exposes inventory trace metrics and docs', () => {
    const traceSummary = readFileSync(join(repoRoot, 'scripts', 'trace-summary.mjs'), 'utf8');
    const docs = readFileSync(join(repoRoot, 'docs', 'godot-v2', 'hud-overlay.md'), 'utf8');

    expect(traceSummary).toContain("eventType === 'inventory.updated'");
    expect(traceSummary).toContain('last_inventory');
    expect(docs).toContain('InventoryOverlay.gd');
    expect(docs).toContain('inventory.updated');
  });
});
