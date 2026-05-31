import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, '..');
const godotRoot = join(repoRoot, 'godot');

const readGodotFile = (relativePath: string): string =>
  readFileSync(join(godotRoot, relativePath), 'utf8');

const reliquaryCases = [
  {
    levelId: 'forest_reliquary',
    phaserStageId: 'forest-reliquary',
    itemId: 'forest-keystone',
    cluster: 'forest',
    difficulty: 3,
  },
  {
    levelId: 'ice_reliquary',
    phaserStageId: 'ice-reliquary',
    itemId: 'ice-keystone',
    cluster: 'ice',
    difficulty: 4,
  },
  {
    levelId: 'fire_reliquary',
    phaserStageId: 'fire-reliquary',
    itemId: 'fire-keystone',
    cluster: 'fire',
    difficulty: 4,
  },
  {
    levelId: 'ruins_reliquary',
    phaserStageId: 'ruins-reliquary',
    itemId: 'cave-keystone',
    cluster: 'ruins',
    difficulty: 3,
  },
] as const;

describe('Godot v2 collectible progression slice', () => {
  it('adds marker-driven collectible metadata to the Godot level system', () => {
    const marker = readGodotFile('scripts/level/markers/CollectibleMarker.gd');
    const definition = readGodotFile('scripts/level/LevelDefinition.gd');
    const session = readGodotFile('scripts/session/GameSession.gd');

    expect(marker).toContain('class_name CollectibleMarker');
    expect(marker).toContain('@export var collectible_id');
    expect(marker).toContain('@export var item_id');
    expect(marker).toContain('"marker_type": "collectible"');
    expect(marker).toContain('"trigger_radius": trigger_radius');
    expect(definition).toContain('var collectibles');
    expect(definition).toContain('"collectible"');
    expect(session).toContain('collected_collectible_ids');
    expect(session).toContain('acquired_item_ids');
    expect(session).toContain('check_collectible_pickups');
    expect(session).toContain('collectible.collected');
    expect(session).toContain('item.acquired');
  });

  it('maps Phaser reliquary collectibles into playable Godot levels', () => {
    const sourceCatalog = JSON.parse(readGodotFile('levels/level_catalog.source.json')) as {
      levels?: Array<{
        id?: string;
        stage_id?: string;
        expected_collectibles?: string[];
        expected_metadata?: Record<string, string | number | boolean>;
      }>;
    };
    const catalog = readGodotFile('levels/level_catalog.json');

    reliquaryCases.forEach(({ levelId, phaserStageId, itemId, cluster, difficulty }) => {
      const level = readGodotFile(`levels/${levelId}.tscn`);
      const replayPath = join(godotRoot, 'tests', 'replays', `${levelId}_collectible.json`);
      const mappedLevel = sourceCatalog.levels?.find((entry) => entry.id === levelId);

      expect(mappedLevel?.stage_id).toBe(phaserStageId);
      expect(mappedLevel?.expected_collectibles).toEqual([itemId]);
      expect(mappedLevel?.expected_metadata).toEqual({
        cluster,
        difficulty,
      });
      expect(catalog).toContain(`"${levelId}"`);
      expect(level).toContain('CollectibleMarker.gd');
      expect(level).toContain(`collectible_id = "${itemId}"`);
      expect(level).toContain(`item_id = "${itemId}"`);
      expect(level).toContain('DoorMarker.gd');
      expect(existsSync(replayPath)).toBe(true);

      const replay = JSON.parse(readFileSync(replayPath, 'utf8')) as {
        start_level_id?: string;
        frames?: Array<{ actions?: Record<string, boolean> }>;
      };
      expect(replay.start_level_id).toBe(levelId);
      expect(replay.frames?.some((frame) => frame.actions?.move_right)).toBe(true);
    });
  });

  it('validates collectible expectations through the catalog generator', () => {
    const output = execFileSync('node', ['scripts/generate-godot-level-catalog.mjs', '--check'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(output).toContain('validated 15 canonical stage mappings');
    expect(output).toContain('validated expected_collectibles for 4 level mappings');
  });

  it('gates cross-cluster door transitions behind the previous cluster keystone', () => {
    const session = readGodotFile('scripts/session/GameSession.gd');
    const loader = readGodotFile('scripts/level/LevelLoader.gd');
    const suite = JSON.parse(readGodotFile('tests/replay_suite.json')) as {
      replays?: Array<{ id?: string; expected_events?: string[] }>;
    };
    const replayPath = join(godotRoot, 'tests', 'replays', 'central_hub_ice_gate_without_keystone.json');

    expect(loader).toContain('func get_level_cluster(level_id: String) -> String:');
    expect(session).toContain('@export var cluster_keystone_progression_enabled: bool = true');
    expect(session).toContain('const CLUSTER_KEYSTONE_REQUIREMENTS');
    expect(session).toContain('func get_cluster_transition_lock_reason(payload: Dictionary) -> String:');
    expect(session).toContain('var explicit_required_item_id := String(payload.get("required_keystone_item_id", ""))');
    expect(session).toContain('missing_cluster_keystone');
    expect(session).toContain('clear_resolved_locked_door_reason("missing_cluster_keystone", item_id)');
    expect(readGodotFile('scripts/level/markers/DoorMarker.gd')).toContain('@export var required_keystone_item_id: String = ""');

    expect(readGodotFile('levels/central_hub.tscn')).toContain('spawn_id = "ice_gate_check"');
    expect(existsSync(replayPath)).toBe(true);

    const replayEntry = suite.replays?.find((entry) => entry.id === 'central_hub_ice_gate_without_keystone');
    expect(replayEntry?.expected_events).toContain('door.locked');
  });
});
