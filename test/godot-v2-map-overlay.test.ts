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
    expect(script).toContain('get_visible_tile_count');
    expect(script).toContain('draw_rect');
    expect(scene).toContain('MapOverlay.gd');
  });

  it('syncs GameSession exploration state into the map overlay and trace stream', () => {
    const session = readGodotFile('scripts/session/GameSession.gd');
    const mainScene = readGodotFile('scenes/Main.tscn');

    expect(session).toContain('MapOverlayScene');
    expect(session).toContain('@export var map_overlay_enabled');
    expect(session).toContain('setup_map_overlay');
    expect(session).toContain('sync_map_overlay');
    expect(session).toContain('map.updated');
    expect(session).toContain('get_explored_tile_count');
    expect(session).toContain('mark_player_tile_explored');
    expect(mainScene).toContain('map_overlay_enabled = true');
  });
});
