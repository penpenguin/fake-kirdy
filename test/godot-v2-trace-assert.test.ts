import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

const writeNdjson = (path: string, events: unknown[]): void => {
  writeFileSync(path, `${events.map((event) => JSON.stringify(event)).join('\n')}\n`);
};

describe('Godot trace assertions', () => {
  it('defines a trace assertion command and runtime gate hook', () => {
    const scripts = readPackageScripts();

    expect(scripts['godot:trace-assert']).toBe('node scripts/assert-godot-trace.mjs');
    expect(scripts['check:godot:runtime']).toContain('godot:trace-assert');
  });

  it('passes ordered, payload, and forbidden-event assertions', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-trace-assert-'));
    const tracePath = join(tempDir, 'trace.ndjson');
    const assertionPath = join(tempDir, 'assertions.json');
    writeNdjson(tracePath, [
      { frame: 10, time_ms: 167, event_type: 'ability.used', level_id: 'combat_room', payload: { ability_type: 'fire' } },
      { frame: 18, time_ms: 300, event_type: 'ability.projectile.spawned', level_id: 'combat_room', payload: { ability_type: 'fire' } },
      {
        frame: 24,
        time_ms: 400,
        event_type: 'enemy.damaged',
        level_id: 'combat_room',
        payload: { damage_amount: 2, enemy_hp_before: 2, enemy_hp_after: 0, ability_type: 'fire' },
      },
      { frame: 25, time_ms: 417, event_type: 'enemy.defeated', level_id: 'combat_room', payload: { enemy_id: 'dummy' } },
      { frame: 40, time_ms: 667, event_type: 'run.finished', level_id: 'combat_room', payload: { outcome: 'complete' } },
    ]);
    writeFileSync(
      assertionPath,
      JSON.stringify(
        {
          version: 1,
          trace_path: tracePath,
          assertions: [
            {
              id: 'fire_projectile_spawn_timing',
              type: 'event_sequence',
              events: ['ability.used', 'ability.projectile.spawned'],
              max_frame_span: 20,
            },
            {
              id: 'damage_reduces_enemy_hp',
              type: 'payload_conditions',
              event_type: 'enemy.damaged',
              conditions: [
                { path: 'payload.damage_amount', op: '>', value: 0 },
                { path: 'payload.enemy_hp_after', op: '<', other_path: 'payload.enemy_hp_before' },
              ],
            },
            {
              id: 'no_level_load_after_finish',
              type: 'forbidden_event',
              event_type: 'level.loaded',
              after_event: 'run.finished',
            },
          ],
        },
        null,
        2,
      ),
    );

    try {
      const result = spawnSync(process.execPath, ['scripts/assert-godot-trace.mjs', '--assertions', assertionPath, '--json'], {
        cwd: repoRoot,
        encoding: 'utf8',
      });

      expect(result.status).toBe(0);
      const report = JSON.parse(result.stdout) as { failed_checks: unknown[]; assertion_count: number };
      expect(report.assertion_count).toBe(3);
      expect(report.failed_checks).toEqual([]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('fails with useful evidence for ordering, payload, and forbidden violations', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-trace-assert-fail-'));
    const tracePath = join(tempDir, 'trace.ndjson');
    const assertionPath = join(tempDir, 'assertions.json');
    writeNdjson(tracePath, [
      { frame: 10, time_ms: 167, event_type: 'ability.used', level_id: 'combat_room', payload: { ability_type: 'fire' } },
      { frame: 42, time_ms: 700, event_type: 'ability.projectile.spawned', level_id: 'combat_room', payload: { ability_type: 'fire' } },
      {
        frame: 50,
        time_ms: 833,
        event_type: 'enemy.damaged',
        level_id: 'combat_room',
        payload: { damage_amount: 0, enemy_hp_before: 2, enemy_hp_after: 2, ability_type: 'fire' },
      },
      { frame: 60, time_ms: 1000, event_type: 'run.finished', level_id: 'combat_room', payload: { outcome: 'complete' } },
      { frame: 61, time_ms: 1017, event_type: 'level.loaded', level_id: 'flat_room', payload: { level_id: 'flat_room' } },
    ]);
    writeFileSync(
      assertionPath,
      JSON.stringify(
        {
          version: 1,
          trace_path: tracePath,
          assertions: [
            {
              id: 'projectile_spawn_too_late',
              type: 'event_sequence',
              events: ['ability.used', 'ability.projectile.spawned'],
              max_frame_span: 20,
            },
            {
              id: 'damage_payload_bad',
              type: 'payload_conditions',
              event_type: 'enemy.damaged',
              conditions: [
                { path: 'payload.damage_amount', op: '>', value: 0 },
                { path: 'payload.enemy_hp_after', op: '<', other_path: 'payload.enemy_hp_before' },
              ],
            },
            {
              id: 'forbid_level_load_after_finish',
              type: 'forbidden_event',
              event_type: 'level.loaded',
              after_event: 'run.finished',
            },
          ],
        },
        null,
        2,
      ),
    );

    try {
      const result = spawnSync(process.execPath, ['scripts/assert-godot-trace.mjs', '--assertions', assertionPath, '--json'], {
        cwd: repoRoot,
        encoding: 'utf8',
      });

      expect(result.status).toBe(1);
      const report = JSON.parse(result.stdout) as {
        failed_checks: { assertion_id: string; message: string }[];
      };
      expect(report.failed_checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ assertion_id: 'projectile_spawn_too_late' }),
          expect.objectContaining({ assertion_id: 'damage_payload_bad' }),
          expect.objectContaining({ assertion_id: 'forbid_level_load_after_finish' }),
        ]),
      );
      expect(report.failed_checks.map((check) => check.message).join('\n')).toContain('frame span');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('validates the checked-in combat trace assertion fixtures', () => {
    const result = spawnSync(process.execPath, ['scripts/assert-godot-trace.mjs', '--json'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout) as {
      assertion_file_count: number;
      assertion_count: number;
      failed_checks: unknown[];
    };
    expect(report.assertion_file_count).toBeGreaterThanOrEqual(1);
    expect(report.assertion_count).toBeGreaterThanOrEqual(3);
    expect(report.failed_checks).toEqual([]);
  });
});
