import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

const readPackageScripts = (): Record<string, string> => {
  const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };
  return packageJson.scripts ?? {};
};

const writeFixtureContract = (path: string, tempDir: string): void => {
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        version: 1,
        source_paths: {
          save_state: join(tempDir, 'SaveState.gd'),
          game_session: join(tempDir, 'GameSession.gd'),
          run_replay: join(tempDir, 'run_replay.gd'),
          replay_suite: join(tempDir, 'replay_suite.json'),
        },
        required_roundtrip_fields: [
          { key: 'acquired_item_ids', state_var: 'acquired_item_ids', kind: 'array' },
          { key: 'completed_level_ids', state_var: 'completed_level_ids', kind: 'array' },
          { key: 'opened_ability_gate_ids', state_var: 'opened_ability_gate_ids', kind: 'array' },
          { key: 'defeated_enemy_group_ids', state_var: 'defeated_enemy_group_ids', kind: 'array' },
          { key: 'explored_tiles', state_var: 'explored_tiles', kind: 'dictionary' },
          { key: 'current_level_id', state_var: 'current_level_id', kind: 'scalar' },
          { key: 'player_position', state_var: 'player_position', kind: 'dictionary' },
          { key: 'ability_type', state_var: 'ability_type', kind: 'scalar' },
          { key: 'settings', state_var: 'settings', kind: 'dictionary' },
          { key: 'player_hp', state_var: 'player_hp', kind: 'scalar' },
          { key: 'player_revive_count', state_var: 'player_revive_count', kind: 'scalar' },
        ],
        representative_replays: [
          {
            id: 'use_saved_ability',
            replay_path: 'res://tests/replays/use_saved_ability.json',
            required_events: ['save.loaded', 'ability.used'],
          },
        ],
        roundtrip_samples: [
          {
            id: 'fixture_state_sanitizes_and_preserves_progression',
            input: {
              acquired_item_ids: ['forest-keystone', 'forest-keystone', ''],
              opened_ability_gate_ids: ['gate-a'],
              defeated_enemy_group_ids: ['group-a'],
              explored_tiles: {
                flat_room: ['1,1', '1,1', '-1,0', 'bad'],
              },
              current_level_id: 'flat_room',
              player_position: { x: 120.5, y: 368 },
              ability_type: 'spark',
              settings: { volume: 2, controls: 'touch', difficulty: 'hard' },
              player_hp: 2,
              player_revive_count: 1,
            },
            expected: {
              acquired_item_ids: ['forest-keystone'],
              opened_ability_gate_ids: ['gate-a'],
              defeated_enemy_group_ids: ['group-a'],
              explored_tiles: {
                flat_room: ['1,1'],
              },
              current_level_id: 'flat_room',
              player_position: { x: 120.5, y: 368 },
              ability_type: 'spark',
              settings: { volume: 1, controls: 'touch', difficulty: 'hard' },
              player_hp: 2,
              player_revive_count: 1,
            },
          },
        ],
        rules: {
          save_state_field_roundtrip: { severity: 'error' },
          session_save_payload_field: { severity: 'error' },
          session_load_payload_field: { severity: 'error' },
          replay_save_path_support: { severity: 'error' },
          representative_replay_exists: { severity: 'error' },
          sample_roundtrip: { severity: 'error' },
        },
      },
      null,
      2,
    )}\n`,
  );
};

const writeGoodFixtureSources = (tempDir: string): void => {
  writeFileSync(
    join(tempDir, 'SaveState.gd'),
    `var acquired_item_ids: Array[String] = []
var completed_level_ids: Array[String] = []
var opened_ability_gate_ids: Array[String] = []
var defeated_enemy_group_ids: Array[String] = []
var explored_tiles: Dictionary = {}
var current_level_id: String = ""
var player_position: Dictionary = {}
var ability_type: String = ""
var settings: Dictionary = {}
var player_hp: int = 0
var player_revive_count: int = 0

func to_dictionary() -> Dictionary:
    return {
        "acquired_item_ids": acquired_item_ids,
        "completed_level_ids": completed_level_ids,
        "opened_ability_gate_ids": opened_ability_gate_ids,
        "defeated_enemy_group_ids": defeated_enemy_group_ids,
        "explored_tiles": explored_tiles,
        "current_level_id": current_level_id,
        "player_position": player_position,
        "ability_type": ability_type,
        "settings": settings,
        "player_hp": player_hp,
        "player_revive_count": player_revive_count,
    }

static func from_dictionary(data: Dictionary):
    state.acquired_item_ids = data.get("acquired_item_ids", [])
    state.completed_level_ids = data.get("completed_level_ids", [])
    state.opened_ability_gate_ids = data.get("opened_ability_gate_ids", [])
    state.defeated_enemy_group_ids = data.get("defeated_enemy_group_ids", [])
    state.explored_tiles = sanitize_explored_tiles(data.get("explored_tiles", {}))
    state.current_level_id = String(data.get("current_level_id", ""))
    var raw_position = data.get("player_position", {})
    state.ability_type = String(data.get("ability_type", ""))
    state.settings = sanitize_settings(data.get("settings", {}))
    state.player_hp = int(data.get("player_hp", 0))
    state.player_revive_count = int(data.get("player_revive_count", 0))
`,
  );
  writeFileSync(
    join(tempDir, 'GameSession.gd'),
    `func load_persistent_state() -> void:
    for item_id in state.acquired_item_ids:
        acquired_item_ids[String(item_id)] = true
    for level_id in state.completed_level_ids:
        completed_level_ids[String(level_id)] = true
    for gate_id in state.opened_ability_gate_ids:
        opened_ability_gate_ids[String(gate_id)] = true
    for group_id in state.defeated_enemy_group_ids:
        defeated_enemy_group_ids[String(group_id)] = true
    for level_id in state.explored_tiles.keys():
        explored_tiles[String(level_id)] = true
    saved_level_id = String(state.current_level_id)
    saved_player_position = dictionary_to_vector2(state.player_position)
    saved_ability_type = String(state.ability_type)
    apply_settings_payload(state.settings)
    player_hp = int(state.player_hp)
    player_revive_count = int(state.player_revive_count)
    trace_recorder.call("record_event", "save.loaded", {
        "acquired_item_ids": get_acquired_item_ids(),
        "completed_level_ids": get_completed_level_ids(),
        "opened_ability_gate_ids": get_opened_ability_gate_ids(),
        "defeated_enemy_group_ids": get_defeated_enemy_group_ids(),
        "explored_tiles": get_explored_tiles_payload(),
        "current_level_id": saved_level_id,
        "player_position": get_saved_player_position_payload(),
        "ability_type": saved_ability_type,
        "settings": get_settings_payload(),
        "player_hp": player_hp,
        "player_revive_count": player_revive_count,
    })

func write_persistent_state() -> void:
    trace_recorder.call("record_event", "save.written", build_save_payload())

func build_save_payload() -> Dictionary:
    return {
        "acquired_item_ids": get_acquired_item_ids(),
        "completed_level_ids": get_completed_level_ids(),
        "opened_ability_gate_ids": get_opened_ability_gate_ids(),
        "defeated_enemy_group_ids": get_defeated_enemy_group_ids(),
        "explored_tiles": get_explored_tiles_payload(),
        "current_level_id": current_level_id,
        "player_position": get_player_position_payload(),
        "ability_type": get_player_ability_type(),
        "settings": get_settings_payload(),
        "player_hp": player_hp,
        "player_revive_count": player_revive_count,
    }
`,
  );
};

describe('Godot save/load roundtrip audit', () => {
  it('defines a save/load roundtrip command and static/runtime gate hooks', () => {
    const scripts = readPackageScripts();

    expect(scripts['godot:save-load-roundtrip']).toBe('node scripts/check-godot-save-load-roundtrip.mjs');
    expect(scripts['check:godot']).toContain('godot:save-load-roundtrip');
    expect(scripts['check:godot:runtime']).toContain('godot:save-load-roundtrip -- --runtime');
    expect(existsSync(join(repoRoot, 'scripts', 'check-godot-save-load-roundtrip.mjs'))).toBe(true);
    expect(existsSync(join(repoRoot, 'godot', 'tests', 'save_load_roundtrip_contract.json'))).toBe(true);
  });

  it('passes a fixture with save state fields, session payloads, replay save support, and sample roundtrip', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-save-roundtrip-'));
    const contractPath = join(tempDir, 'save_load_roundtrip_contract.json');

    try {
      writeGoodFixtureSources(tempDir);
      writeFileSync(join(tempDir, 'run_replay.gd'), 'if arg == "--save":\n    session.save_enabled = true\n    session.save_path = String(args["save"])\n');
      writeFileSync(join(tempDir, 'replay_suite.json'), JSON.stringify({ version: 1, replays: [] }, null, 2));
      mkdirSync(join(tempDir, 'tests', 'replays'), { recursive: true });
      writeFileSync(join(tempDir, 'tests', 'replays', 'use_saved_ability.json'), JSON.stringify({ start_level_id: 'flat_room' }));
      writeFixtureContract(contractPath, tempDir);

      const result = spawnSync(process.execPath, ['scripts/check-godot-save-load-roundtrip.mjs', '--contract', contractPath, '--json'], {
        cwd: repoRoot,
        encoding: 'utf8',
      });

      expect(result.status).toBe(0);
      const report = JSON.parse(result.stdout) as {
        failed_checks: unknown[];
        categories: Record<string, number>;
      };
      expect(report.failed_checks).toEqual([]);
      expect(report.categories).toMatchObject({
        save_state_fields: 11,
        session_payloads: expect.any(Number),
        roundtrip_samples: 1,
        replay_coverage: 1,
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('fails with useful evidence when a field cannot roundtrip through save/load', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-save-roundtrip-broken-'));
    const contractPath = join(tempDir, 'save_load_roundtrip_contract.json');

    try {
      writeGoodFixtureSources(tempDir);
      writeFileSync(
        join(tempDir, 'GameSession.gd'),
        readFileSync(join(tempDir, 'GameSession.gd'), 'utf8')
          .split('"opened_ability_gate_ids": get_opened_ability_gate_ids(),')
          .join('')
          .replace('"ability_type": saved_ability_type,', ''),
      );
      writeFileSync(join(tempDir, 'run_replay.gd'), 'func run() -> void:\n    pass\n');
      writeFileSync(join(tempDir, 'replay_suite.json'), JSON.stringify({ version: 1, replays: [] }, null, 2));
      writeFixtureContract(contractPath, tempDir);

      const result = spawnSync(process.execPath, ['scripts/check-godot-save-load-roundtrip.mjs', '--contract', contractPath, '--json'], {
        cwd: repoRoot,
        encoding: 'utf8',
      });

      expect(result.status).toBe(1);
      const report = JSON.parse(result.stdout) as {
        failed_checks: { rule: string; field?: string; message: string }[];
      };
      expect(report.failed_checks).toContainEqual(expect.objectContaining({ rule: 'session_save_payload_field', field: 'opened_ability_gate_ids' }));
      expect(report.failed_checks).toContainEqual(expect.objectContaining({ rule: 'session_load_payload_field', field: 'ability_type' }));
      expect(report.failed_checks).toContainEqual(expect.objectContaining({ rule: 'replay_save_path_support' }));
      expect(report.failed_checks).toContainEqual(expect.objectContaining({ rule: 'representative_replay_exists' }));
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('validates canonical save/load state, replay save support, and roundtrip sample coverage', () => {
    const result = spawnSync(process.execPath, ['scripts/check-godot-save-load-roundtrip.mjs', '--json'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout) as {
      failed_checks: unknown[];
      required_fields: { key: string; save_state_status: string; session_save_status: string; session_load_status: string }[];
      categories: Record<string, number>;
    };
    expect(report.failed_checks).toEqual([]);
    expect(report.required_fields.map((field) => field.key)).toEqual(
      expect.arrayContaining([
        'acquired_item_ids',
        'ability_type',
        'opened_ability_gate_ids',
        'defeated_enemy_group_ids',
        'settings',
        'explored_tiles',
        'current_level_id',
        'player_position',
      ]),
    );
    expect(report.required_fields.every((field) => field.save_state_status === 'covered')).toBe(true);
    expect(report.required_fields.every((field) => field.session_save_status === 'covered')).toBe(true);
    expect(report.required_fields.every((field) => field.session_load_status === 'covered')).toBe(true);
    expect(report.categories.roundtrip_samples).toBeGreaterThanOrEqual(1);
    expect(report.categories.replay_coverage).toBeGreaterThanOrEqual(1);
  });
});
