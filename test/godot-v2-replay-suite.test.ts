import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, '..');
const suitePath = join(repoRoot, 'godot', 'tests', 'replay_suite.json');

describe('Godot v2 replay suite workflow', () => {
  it('defines a canonical representative replay suite', () => {
    expect(existsSync(suitePath)).toBe(true);

    const suite = JSON.parse(readFileSync(suitePath, 'utf8')) as {
      version?: number;
      replays?: Array<{
        id?: string;
        replay_path?: string;
        expected_outcome?: string;
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
    expect(byId.get('settings_adjustment')?.expected_outcome).toBe('replay.max_frames_reached');
    expect(byId.get('revive_room_revive_then_game_over')?.expected_outcome).toBe('game_over');
    expect(byId.get('forest_generated_reliquary_chain')?.replay_path).toBe('res://tests/replays/labyrinth_002_to_forest_reliquary_generated_chain.json');
    expect(byId.get('ice_generated_reliquary_chain')?.replay_path).toBe('res://tests/replays/labyrinth_006_to_ice_reliquary_generated_chain.json');
    expect(byId.get('fire_generated_reliquary_chain')?.replay_path).toBe('res://tests/replays/labyrinth_029_to_fire_reliquary_generated_chain.json');
    expect(byId.get('ruins_generated_reliquary_chain')?.replay_path).toBe('res://tests/replays/labyrinth_047_to_ruins_reliquary_generated_chain.json');
    expect(byId.get('sky_generated_goal_path')?.expected_outcome).toBe('complete');
    expect(byId.get('terminal_generated_goal')?.expected_outcome).toBe('complete');
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
    expect(listed.replays?.map((replay) => replay.id)).toContain('controller_lab_jump');
    expect(listed.replays?.map((replay) => replay.id)).toContain('revive_room_revive_then_game_over');
  });

  it('wires the suite into package scripts and documentation', () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const docs = readFileSync(join(repoRoot, 'docs', 'godot-v2', 'replay-and-trace.md'), 'utf8');
    const runner = readFileSync(join(repoRoot, 'scripts', 'run-godot-replay-suite.mjs'), 'utf8');

    expect(packageJson.scripts?.['godot:replay-suite']).toContain('scripts/run-godot-replay-suite.mjs');
    expect(runner).toContain('last_hud: summary.last_hud');
    expect(runner).toContain('last_result_overlay: summary.last_result_overlay');
    expect(docs).toContain('godot:replay-suite');
    expect(docs).toContain('replay_suite.json');
    expect(docs).toContain('player_motion');
    expect(docs).toContain('last_hud');
    expect(docs).toContain('last_result_overlay');
  });
});
