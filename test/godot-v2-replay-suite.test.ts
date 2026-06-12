import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, '..');
const suitePath = join(repoRoot, 'godot', 'tests', 'replay_suite.json');
const replayRoot = join(repoRoot, 'godot', 'tests', 'replays');

const readReplay = (filename: string): {
  start_level_id?: string;
  start_spawn_id?: string;
  initial_ability_type?: string;
  initial_item_ids?: string[];
  setting_difficulty?: string;
  continue_after_finished?: boolean;
  max_frames?: number;
  frames?: Array<{ frame?: number; actions?: Record<string, boolean> }>;
} => JSON.parse(readFileSync(join(replayRoot, filename), 'utf8'));

type ExpectedEventSequenceItem = {
  event_type: string;
  payload?: Record<string, string | number | boolean>;
};

const tutorialForbiddenEvents = [
  'game.over',
  'player.defeated',
  'replay.error',
  'goal.door.entered',
  'result.overlay.shown',
];
const tutorialForbiddenEventPayloads = [
  { event_type: 'run.finished', payload: { result_label: 'complete' } },
  { event_type: 'run.finished', payload: { outcome: 'completed' } },
];

describe('Godot v2 replay suite workflow', () => {
  it('defines a canonical representative replay suite', () => {
    expect(existsSync(suitePath)).toBe(true);

    const suite = JSON.parse(readFileSync(suitePath, 'utf8')) as {
      version?: number;
      replays?: Array<{
        id?: string;
        replay_path?: string;
        expected_outcome?: string;
        expected_events?: string[];
        forbidden_events?: string[];
        expected_event_sequence?: ExpectedEventSequenceItem[];
        expected_last_hud?: Record<string, string | number | boolean>;
        tags?: string[];
      }>;
    };

    expect(suite.version).toBe(1);
    expect(suite.replays?.length).toBeGreaterThanOrEqual(8);

    const byId = new Map(suite.replays?.map((replay) => [replay.id, replay]));
    expect(byId.get('controller_lab_jump')?.expected_outcome).toBe('finished');
    expect(byId.get('combat_capture_swallow_goal')?.expected_outcome).toBe('complete');
    expect(byId.get('flying_enemy_release_swallow_goal')?.expected_outcome).toBe('complete');
    expect(byId.get('central_hub_to_heal_goal')?.expected_outcome).toBe('complete');
    expect(byId.get('central_hub_dead_end_max_health')?.expected_outcome).toBe('replay.max_frames_reached');
    expect(byId.get('central_hub_dead_end_max_health')?.expected_last_hud).toMatchObject({
      score: 400,
    });
    expect(byId.get('settings_adjustment')?.expected_outcome).toBe('replay.max_frames_reached');
    expect(byId.get('settings_menu_pause_toggle_closes')?.expected_events).toEqual(expect.arrayContaining([
      'settings.menu.opened',
      'settings.menu.closed',
    ]));
    expect(byId.get('map_toggle_visibility')?.expected_events).toContain('map.toggled');
    expect(byId.get('pause_toggle_menu')?.expected_events).toContain('pause.toggled');
    expect(byId.get('pause_settings_flow')?.expected_events).toEqual(expect.arrayContaining([
      'pause.settings.opened',
      'settings.updated',
      'pause.settings.closed',
      'pause.toggled',
    ]));
    expect(byId.get('virtual_controls_touch_mode')?.expected_events).toEqual(expect.arrayContaining([
      'settings.updated',
      'virtual_controls.updated',
    ]));
    expect(byId.get('revive_room_revive_then_game_over')?.expected_outcome).toBe('game_over');
    expect(byId.get('game_over_restart_option')?.expected_outcome).toBe('replay.max_frames_reached');
    expect(byId.get('game_over_restart_option')?.expected_events).toEqual(expect.arrayContaining([
      'game.over',
      'run.restart.selected',
      'level.loaded',
    ]));
    expect(byId.get('game_over_restart_option')?.expected_last_hud).toMatchObject({
      hp: 3,
      outcome: 'running',
    });
    expect(byId.get('results_scene_continue')?.expected_outcome).toBe('complete');
    expect(byId.get('results_scene_continue')?.expected_events).toEqual(expect.arrayContaining([
      'result.overlay.shown',
      'results.scene.shown',
    ]));
    expect(byId.get('forest_generated_reliquary_chain')?.replay_path).toBe('res://tests/replays/labyrinth_002_to_forest_reliquary_generated_chain.json');
    expect(byId.get('ice_generated_reliquary_chain')?.replay_path).toBe('res://tests/replays/labyrinth_006_to_ice_reliquary_generated_chain.json');
    expect(byId.get('fire_generated_reliquary_chain')?.replay_path).toBe('res://tests/replays/labyrinth_029_to_fire_reliquary_generated_chain.json');
    expect(byId.get('ruins_generated_reliquary_chain')?.replay_path).toBe('res://tests/replays/labyrinth_047_to_ruins_reliquary_generated_chain.json');
    expect(byId.get('sky_generated_goal_path')?.expected_outcome).toBe('complete');
    expect(byId.get('terminal_generated_goal')?.expected_outcome).toBe('complete');
  });

  it('adds focused replay fixtures for the new gameplay completion contracts', () => {
    const suite = JSON.parse(readFileSync(suitePath, 'utf8')) as {
      replays?: Array<{
        id?: string;
        replay_path?: string;
        expected_outcome?: string;
        expected_events?: string[];
        forbidden_events?: string[];
        expected_event_sequence?: ExpectedEventSequenceItem[];
        expected_last_hud?: Record<string, string | number | boolean>;
        tags?: string[];
      }>;
    };
    const byId = new Map(suite.replays?.map((replay) => [replay.id, replay]));

    expect(byId.get('combat_ability_damage_enemy')?.expected_events).toEqual(expect.arrayContaining([
      'ability.used',
      'enemy.damaged',
      'enemy.defeated',
    ]));
    expect(readReplay('combat_ability_damage_enemy.json').frames?.some((frame) => frame.actions?.use_ability)).toBe(true);

    expect(byId.get('combat_locked_door_without_ability')?.expected_events).toContain('door.locked');
    expect(readReplay('combat_locked_door_without_ability.json').start_level_id).toBe('combat_room');

    expect(byId.get('combat_ability_unlocks_door')?.expected_events).toEqual(expect.arrayContaining([
      'door.entered',
      'level.loaded',
    ]));
    expect(readReplay('combat_ability_unlocks_door.json').initial_ability_type).toBe('spark');

    expect(byId.get('combat_detach_ability')?.expected_events).toEqual(expect.arrayContaining([
      'ability.detached',
      'hud.updated',
      'inventory.updated',
    ]));
    expect(byId.get('capture_defeated_enemy_auto_clear')?.expected_events).toEqual(expect.arrayContaining([
      'enemy.captured',
      'enemy.defeated',
      'enemy.capture.cleared',
    ]));
    expect(byId.get('combat_detach_ability')?.expected_last_hud).toMatchObject({
      ability_type: '',
    });
    expect(readReplay('combat_detach_ability.json').initial_ability_type).toBe('spark');
    expect(readReplay('combat_detach_ability.json').frames?.some((frame) => frame.actions?.swallow)).toBe(true);
    expect(readReplay('capture_defeated_enemy_auto_clear.json').frames?.some((frame) => frame.actions?.defeat_captured_enemy)).toBe(true);

    expect(byId.get('danger_hazard_trace')?.expected_events).toEqual(expect.arrayContaining([
      'hazard.entered',
      'player.damaged',
    ]));
    expect(readReplay('danger_hazard_trace.json').start_level_id).toBe('danger_room');

    expect(byId.get('fire_area_ability_gate_trace')?.expected_events).toEqual(expect.arrayContaining([
      'ability.used',
      'ability_gate.opened',
    ]));
    expect(readReplay('fire_area_ability_gate_trace.json').initial_ability_type).toBe('fire');

    const goldenFirePath = byId.get('golden_fire_path');
    expect(goldenFirePath?.replay_path).toBe('res://tests/replays/golden_fire_path.json');
    expect(goldenFirePath?.expected_outcome).toBe('replay.max_frames_reached');
    expect(goldenFirePath?.expected_event_sequence).toEqual([
      { event_type: 'enemy.captured' },
      { event_type: 'ability.acquired', payload: { ability_type: 'fire' } },
      { event_type: 'ability.used', payload: { ability_type: 'fire' } },
      { event_type: 'ability_gate.opened', payload: { gate_id: 'fire_area_ice_block' } },
      { event_type: 'door.entered', payload: { door_id: 'fire_area_to_fire_expanse' } },
      { event_type: 'collectible.collected' },
      { event_type: 'run.finished' },
    ]);
    expect(readReplay('golden_fire_path.json').initial_ability_type).toBeUndefined();

    expect(byId.get('hard_enemy_attack_trace')?.expected_events).toEqual(expect.arrayContaining([
      'enemy.attack.started',
      'player.damaged',
    ]));
    expect(byId.get('hard_enemy_attack_trace')?.expected_last_hud).toMatchObject({
      difficulty: 'hard',
      target_enemy_hp: 3,
    });
    expect(readReplay('hard_enemy_attack_trace.json').setting_difficulty).toBe('hard');

    expect(byId.get('flying_spit_projectile_hit')?.expected_events).toEqual(expect.arrayContaining([
      'enemy.released',
      'spit.projectile.fired',
      'spit.projectile.hit',
      'enemy.damaged',
    ]));
    expect(readReplay('flying_spit_projectile_hit.json').frames?.some((frame) => frame.actions?.inhale === false)).toBe(true);

    expect(byId.get('forest_reliquary_locked_without_key')?.expected_events).toContain('door.locked');
    expect(readReplay('forest_reliquary_locked_without_key.json').start_spawn_id).toBe('door_check');

    expect(byId.get('forest_reliquary_key_unlocks_door')?.expected_events).toEqual(expect.arrayContaining([
      'collectible.collected',
      'item.acquired',
      'door.entered',
    ]));
    expect(readReplay('forest_reliquary_key_unlocks_door.json').start_level_id).toBe('forest_reliquary');
    expect(byId.get('sky_generated_goal_path')?.expected_events).toEqual(expect.arrayContaining([
      'door.entered',
      'goal.door.entered',
      'run.finished',
    ]));
    expect(byId.get('sky_generated_exit_locked_without_keystone')?.expected_events).toContain('door.locked');
    expect(byId.get('sky_generated_exit_locked_without_keystone')?.expected_last_hud).toMatchObject({
      locked_door_reason: 'missing_cluster_keystone:cave-keystone',
    });
    expect(readReplay('labyrinth_051_to_sky_sanctum_without_keystone.json').initial_item_ids).toEqual([
      'forest-keystone',
      'ice-keystone',
      'fire-keystone',
    ]);
    expect(readReplay('labyrinth_051_to_sky_sanctum_generated_exit.json').initial_item_ids).toEqual([
      'forest-keystone',
      'ice-keystone',
      'fire-keystone',
      'cave-keystone',
    ]);

    expect(readReplay('game_over_restart_option.json').continue_after_finished).toBe(true);
    expect(readReplay('game_over_restart_option.json').frames?.some((frame) => frame.actions?.result_restart)).toBe(true);
    expect(readReplay('results_scene_continue.json').continue_after_finished).toBe(true);
    expect(readReplay('results_scene_continue.json').frames?.some((frame) => frame.actions?.result_continue)).toBe(true);
  });

  it('adds tutorial onboarding replay fixtures that forbid death and prove the real-stage route', () => {
    const suite = JSON.parse(readFileSync(suitePath, 'utf8')) as {
      replays?: Array<{
        id?: string;
        replay_path?: string;
        expected_outcome?: string;
        expected_events?: string[];
        forbidden_events?: string[];
        forbidden_event_payloads?: ExpectedEventSequenceItem[];
        expected_event_sequence?: ExpectedEventSequenceItem[];
        tags?: string[];
      }>;
    };
    const byId = new Map(suite.replays?.map((replay) => [replay.id, replay]));

    expect(byId.get('tutorial_no_death_path')).toMatchObject({
      replay_path: 'res://tests/replays/tutorial_no_death_path.json',
      expected_outcome: 'replay.max_frames_reached',
      forbidden_events: tutorialForbiddenEvents,
      forbidden_event_payloads: tutorialForbiddenEventPayloads,
    });
    expect(byId.get('tutorial_no_death_path')?.expected_events).toEqual(expect.arrayContaining([
      'enemy.captured',
      'ability.acquired',
      'ability_gate.opened',
      'door.entered',
    ]));
    expect(readReplay('tutorial_no_death_path.json').start_level_id).toBe('tutorial_room');

    expect(byId.get('tutorial_no_edge_fall_path')).toMatchObject({
      replay_path: 'res://tests/replays/tutorial_no_edge_fall_path.json',
      expected_outcome: 'replay.max_frames_reached',
      forbidden_events: tutorialForbiddenEvents,
      forbidden_event_payloads: tutorialForbiddenEventPayloads,
    });
    expect(readReplay('tutorial_no_edge_fall_path.json').frames?.some((frame) => frame.actions?.move_left)).toBe(true);

    expect(byId.get('tutorial_to_real_stage_path')?.expected_event_sequence).toEqual([
      { event_type: 'door.entered', payload: { target_level_id: 'central_hub' } },
      { event_type: 'level.loaded', payload: { level_id: 'central_hub' } },
      { event_type: 'door.entered', payload: { target_level_id: 'fire_area' } },
      { event_type: 'level.loaded', payload: { level_id: 'fire_area' } },
    ]);
    expect(byId.get('tutorial_to_real_stage_path')?.forbidden_events).toEqual(tutorialForbiddenEvents);
    expect(byId.get('tutorial_to_real_stage_path')?.forbidden_event_payloads).toEqual(tutorialForbiddenEventPayloads);
    expect(readReplay('tutorial_to_real_stage_path.json').start_level_id).toBe('tutorial_room');
  });

  it('provides a replay suite runner that can list the configured suite without Godot', () => {
    const output = execFileSync('node', ['scripts/run-godot-replay-suite.mjs', '--list'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    const listed = JSON.parse(output) as {
      replay_count?: number;
      replays?: Array<{ id?: string }>;
    };

    expect(listed.replay_count).toBeGreaterThanOrEqual(13);
    expect(listed.replays?.map((replay) => replay.id)).toContain('terminal_generated_goal');
    expect(listed.replays?.map((replay) => replay.id)).toContain('settings_adjustment');
    expect(listed.replays?.map((replay) => replay.id)).toContain('settings_menu_pause_toggle_closes');
    expect(listed.replays?.map((replay) => replay.id)).toContain('map_toggle_visibility');
    expect(listed.replays?.map((replay) => replay.id)).toContain('pause_toggle_menu');
    expect(listed.replays?.map((replay) => replay.id)).toContain('pause_settings_flow');
    expect(listed.replays?.map((replay) => replay.id)).toContain('virtual_controls_touch_mode');
    expect(listed.replays?.map((replay) => replay.id)).toContain('controller_lab_jump');
    expect(listed.replays?.map((replay) => replay.id)).toContain('revive_room_revive_then_game_over');
    expect(listed.replays?.map((replay) => replay.id)).toContain('game_over_restart_option');
    expect(listed.replays?.map((replay) => replay.id)).toContain('results_scene_continue');
    expect(listed.replays?.map((replay) => replay.id)).toContain('combat_ability_damage_enemy');
    expect(listed.replays?.map((replay) => replay.id)).toContain('combat_detach_ability');
    expect(listed.replays?.map((replay) => replay.id)).toContain('capture_defeated_enemy_auto_clear');
    expect(listed.replays?.map((replay) => replay.id)).toContain('fire_area_ability_gate_trace');
    expect(listed.replays?.map((replay) => replay.id)).toContain('golden_fire_path');
    expect(listed.replays?.map((replay) => replay.id)).toContain('flying_spit_projectile_hit');
    expect(listed.replays?.map((replay) => replay.id)).toContain('forest_reliquary_key_unlocks_door');
    expect(listed.replays?.map((replay) => replay.id)).toContain('sky_generated_exit_locked_without_keystone');
  });

  it('fails a replay when expected_event_sequence is present but the trace is out of order', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-replay-suite-sequence-'));
    const fakeGodot = join(tempDir, 'fake-godot');
    const fixtureSuite = join(tempDir, 'replay_suite.json');
    const outDir = join(tempDir, 'out');

    try {
      writeFileSync(
        fakeGodot,
        `#!/bin/sh
if [ "$1" = "--version" ]; then
  echo "4.6.fake-replay-suite"
  exit 0
fi
out=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --out)
      shift
      out="$1"
      ;;
  esac
  shift
done
if [ -n "$out" ]; then
  {
    printf '{"frame":0,"time_ms":0,"event_type":"ability_gate.opened","level_id":"fire_area","payload":{"gate_id":"fire_area_ice_block"}}\\n'
    printf '{"frame":1,"time_ms":16,"event_type":"ability.acquired","level_id":"fire_area","payload":{"ability_type":"fire"}}\\n'
    printf '{"frame":2,"time_ms":32,"event_type":"run.finished","level_id":"fire_area","payload":{"outcome":"finished"}}\\n'
  } > "$out"
fi
exit 0
`,
      );
      chmodSync(fakeGodot, 0o755);
      writeFileSync(
        fixtureSuite,
        `${JSON.stringify(
          {
            version: 1,
            replays: [
              {
                id: 'bad_sequence',
                replay_path: 'res://tests/replays/bad_sequence.json',
                expected_outcome: 'finished',
                expected_event_sequence: [
                  { event_type: 'ability.acquired', payload: { ability_type: 'fire' } },
                  { event_type: 'ability_gate.opened', payload: { gate_id: 'fire_area_ice_block' } },
                ],
              },
            ],
          },
          null,
          2,
        )}\n`,
      );

      const result = spawnSync(process.execPath, ['scripts/run-godot-replay-suite.mjs', '--suite', fixtureSuite, '--out-dir', outDir], {
        cwd: repoRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          GODOT_BIN: fakeGodot,
          PATH: dirname(process.execPath),
        },
      });
      expect(result.status).toBe(1);
      const report = JSON.parse(result.stdout) as {
        failed_replays?: number;
        results?: { failure?: string | null }[];
      };

      expect(report.failed_replays).toBe(1);
      expect(report.results?.[0]?.failure).toContain('expected event sequence');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('fails a replay when a forbidden event appears in the trace', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-replay-suite-forbidden-'));
    const fakeGodot = join(tempDir, 'fake-godot');
    const fixtureSuite = join(tempDir, 'replay_suite.json');
    const outDir = join(tempDir, 'out');

    try {
      writeFileSync(
        fakeGodot,
        `#!/bin/sh
if [ "$1" = "--version" ]; then
  echo "4.6.fake-replay-suite"
  exit 0
fi
out=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --out)
      shift
      out="$1"
      ;;
  esac
  shift
done
if [ -n "$out" ]; then
  {
    printf '{"frame":0,"time_ms":0,"event_type":"player.spawned","level_id":"tutorial_room"}\\n'
    printf '{"frame":1,"time_ms":16,"event_type":"game.over","level_id":"tutorial_room","payload":{"outcome":"game_over"}}\\n'
  } > "$out"
fi
exit 0
`,
      );
      chmodSync(fakeGodot, 0o755);
      writeFileSync(
        fixtureSuite,
        `${JSON.stringify(
          {
            version: 1,
            replays: [
              {
                id: 'forbidden_death',
                replay_path: 'res://tests/replays/forbidden_death.json',
                expected_outcome: 'game_over',
                forbidden_events: ['game.over'],
              },
            ],
          },
          null,
          2,
        )}\n`,
      );

      const result = spawnSync(process.execPath, ['scripts/run-godot-replay-suite.mjs', '--suite', fixtureSuite, '--out-dir', outDir], {
        cwd: repoRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          GODOT_BIN: fakeGodot,
          PATH: dirname(process.execPath),
        },
      });
      expect(result.status).toBe(1);
      const report = JSON.parse(result.stdout) as {
        failed_replays?: number;
        results?: { failure?: string | null }[];
      };

      expect(report.failed_replays).toBe(1);
      expect(report.results?.[0]?.failure).toContain('forbidden event appeared: game.over');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('fails a replay when a forbidden event payload appears in the trace', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-replay-suite-forbidden-payload-'));
    const godotBin = join(tempDir, 'godot');
    const suitePath = join(tempDir, 'suite.json');
    const replayPath = join(tempDir, 'fixture_replay.json');
    const outDir = join(tempDir, 'out');

    try {
      writeFileSync(replayPath, JSON.stringify({ max_frames: 1 }));
      writeFileSync(
        suitePath,
        JSON.stringify(
          {
            version: 1,
            replays: [
              {
                id: 'fixture_forbidden_payload',
                replay_path: 'res://tests/replays/fixture_replay.json',
                expected_outcome: 'finished',
                forbidden_event_payloads: [{ event_type: 'run.finished', payload: { result_label: 'complete' } }],
              },
            ],
          },
          null,
          2,
        ),
      );
      writeFileSync(
        godotBin,
        `#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
if (args.includes('--version')) {
  console.log('fixture-godot');
  process.exit(0);
}
const traceIndex = args.indexOf('--out');
if (traceIndex >= 0) {
  fs.writeFileSync(args[traceIndex + 1], [
    JSON.stringify({ event_type: 'run.finished', payload: { result_label: 'complete' } }),
  ].join('\\n') + '\\n');
}
`,
      );
      chmodSync(godotBin, 0o755);

      const result = spawnSync(
        process.execPath,
        ['scripts/run-godot-replay-suite.mjs', '--suite', suitePath, '--out-dir', outDir],
        {
          cwd: repoRoot,
          encoding: 'utf8',
          env: { ...process.env, GODOT_BIN: godotBin },
        },
      );

      expect(result.status).toBe(1);
      const report = JSON.parse(result.stdout) as {
        failed_replays?: number;
        results?: Array<{ failure?: string }>;
      };
      expect(report.failed_replays).toBe(1);
      expect(report.results?.[0]?.failure).toContain('forbidden event payload appeared');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('uses GODOT_BIN for replay suite import and replay execution when godot is not on PATH', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-replay-suite-godot-bin-'));
    const fakeGodot = join(tempDir, 'fake-godot');
    const fixtureSuite = join(tempDir, 'replay_suite.json');
    const outDir = join(tempDir, 'out');

    try {
      writeFileSync(
        fakeGodot,
        `#!/bin/sh
if [ "$1" = "--version" ]; then
  echo "4.6.fake-replay-suite"
  exit 0
fi
out=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --out)
      shift
      out="$1"
      ;;
  esac
  shift
done
if [ -n "$out" ]; then
  printf '{"frame":0,"time_ms":0,"event_type":"run.finished","level_id":"fixture","payload":{"outcome":"finished"}}\\n' > "$out"
fi
exit 0
`,
      );
      chmodSync(fakeGodot, 0o755);
      writeFileSync(
        fixtureSuite,
        `${JSON.stringify(
          {
            version: 1,
            replays: [
              {
                id: 'godot_bin_replay',
                replay_path: 'res://tests/replays/godot_bin_replay.json',
                expected_outcome: 'finished',
              },
            ],
          },
          null,
          2,
        )}\n`,
      );

      const output = execFileSync('node', ['scripts/run-godot-replay-suite.mjs', '--suite', fixtureSuite, '--out-dir', outDir], {
        cwd: repoRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          GODOT_BIN: fakeGodot,
          PATH: dirname(process.execPath),
        },
      });
      const report = JSON.parse(output) as {
        skipped?: boolean;
        replay_count?: number;
        passed_replays?: number;
        failed_replays?: number;
      };

      expect(report).toMatchObject({
        skipped: false,
        replay_count: 1,
        passed_replays: 1,
        failed_replays: 0,
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('wires the suite into package scripts and documentation', () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const docs = readFileSync(join(repoRoot, 'docs', 'godot-v2', 'replay-and-trace.md'), 'utf8');
    const runner = readFileSync(join(repoRoot, 'scripts', 'run-godot-replay-suite.mjs'), 'utf8');

    expect(packageJson.scripts?.['godot:replay-suite']).toContain('scripts/run-godot-replay-suite.mjs');
    expect(runner).toContain('expected_events');
    expect(runner).toContain('forbidden_events');
    expect(runner).toContain('forbidden_event_payloads');
    expect(runner).toContain('expected_event_sequence');
    expect(runner).toContain('expected_last_hud');
    expect(runner).toContain('last_hud: summary.last_hud');
    expect(runner).toContain('last_result_overlay: summary.last_result_overlay');
    expect(docs).toContain('godot:replay-suite');
    expect(docs).toContain('replay_suite.json');
    expect(docs).toContain('player_motion');
    expect(docs).toContain('last_hud');
    expect(docs).toContain('last_result_overlay');
  });
});
