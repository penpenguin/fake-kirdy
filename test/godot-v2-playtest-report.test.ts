import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

const writeFixtureSession = (tracePath: string, bookmarksPath: string): void => {
  writeNdjson(tracePath, [
    {
      frame: 0,
      time_ms: 0,
      event_type: 'player.spawned',
      level_id: 'central_hub',
      player: { position: { x: 32, y: 96 } },
      payload: { hp: 6, ability_type: 'none', enemy_count: 0, fps: 60, screenshot_path: 'shots/0000.png' },
    },
    {
      frame: 60,
      time_ms: 1000,
      event_type: 'playtest.sample',
      level_id: 'central_hub',
      player: { position: { x: 144, y: 96 } },
      payload: { hp: 6, ability_type: 'fire', enemy_count: 1, fps: 59, screenshot_path: 'shots/0001.png' },
    },
    {
      frame: 120,
      time_ms: 2000,
      event_type: 'door.locked',
      level_id: 'central_hub',
      player: { position: { x: 208, y: 96 } },
      payload: { reason: 'requires_fire_key', hp: 6, ability_type: 'fire', enemy_count: 1, fps: 58 },
    },
    {
      frame: 1800,
      time_ms: 30000,
      event_type: 'playtest.sample',
      level_id: 'fire_area',
      player: { position: { x: 320, y: 368 } },
      payload: { hp: 5, ability_type: 'fire', enemy_count: 1, fps: 58, screenshot_path: 'shots/0030.png' },
    },
    {
      frame: 3600,
      time_ms: 60000,
      event_type: 'playtest.sample',
      level_id: 'labyrinth_011',
      player: { position: { x: 96, y: 368 } },
      payload: { hp: 5, ability_type: 'fire', enemy_count: 2, fps: 57, screenshot_path: 'shots/0060.png' },
    },
    {
      frame: 4200,
      time_ms: 70000,
      event_type: 'run.finished',
      level_id: 'labyrinth_011',
      player: { position: { x: 180, y: 368 } },
      payload: { outcome: 'manual_fire_path_complete', hp: 5, ability_type: 'fire', enemy_count: 0, fps: 58 },
    },
  ]);
  writeFileSync(
    bookmarksPath,
    `${JSON.stringify(
      [
        {
          id: 'unclear_locked_door',
          kind: 'issue',
          category: 'objective_clarity',
          severity: 'medium',
          note: 'Locked door reason was easy to miss during manual play.',
          level_id: 'central_hub',
          time_ms: 2000,
          position: { x: 208, y: 96 },
          screenshot_path: 'shots/0002.png',
        },
        {
          id: 'ice_gate_blocks_navigation',
          kind: 'note',
          category: 'navigation_blocker',
          severity: 'info',
          status: 'resolved',
          note: 'The ice gate visibly blocked the Fire route before the ability was used.',
          level_id: 'fire_area',
          time_ms: 30000,
          position: { x: 320, y: 368 },
          screenshot_path: 'shots/0030.png',
        },
        {
          id: 'fire_hit_feedback_readable',
          kind: 'note',
          category: 'combat_feedback',
          severity: 'info',
          status: 'resolved',
          note: 'The fire enemy and gate feedback were readable during the route.',
          level_id: 'fire_area',
          time_ms: 36000,
          position: { x: 360, y: 368 },
          screenshot_path: 'shots/0036.png',
        },
        {
          id: 'enemy_ai_pressure_observed',
          kind: 'note',
          category: 'enemy_ai',
          severity: 'info',
          status: 'resolved',
          note: 'The fire enemy provided visible route pressure without blocking completion.',
          level_id: 'fire_area',
          time_ms: 42000,
          position: { x: 400, y: 368 },
          screenshot_path: 'shots/0042.png',
        },
      ],
      null,
      2,
    )}\n`,
  );
};

const writeFixtureContract = (path: string, tracePath: string, bookmarksPath: string, outJson: string, outMd: string): void => {
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        version: 1,
        trace_path: tracePath,
        bookmarks_path: bookmarksPath,
        output_json_path: outJson,
        output_markdown_path: outMd,
        sample_interval_ms: 1000,
        recent_event_limit: 4,
        min_duration_ms: 60000,
        required_route_level_ids: ['central_hub', 'fire_area', 'labyrinth_011'],
        required_observation_categories: ['navigation_blocker', 'combat_feedback', 'enemy_ai', 'objective_clarity'],
        required_sample_fields: [
          'level_id',
          'position',
          'hp',
          'ability_type',
          'enemy_count',
          'fps',
          'recent_events',
          'screenshot_path',
        ],
        required_bookmark_fields: ['id', 'kind', 'category', 'note', 'level_id', 'position'],
        issue_bookmark_kinds: ['issue'],
        issue_categories: ['navigation_blocker', 'combat_feedback', 'enemy_ai', 'objective_clarity', 'web_runtime'],
      },
      null,
      2,
    )}\n`,
  );
};

describe('Godot playtest report', () => {
  it('defines a playtest report command, contract, canonical report, and static gate hook', () => {
    const scripts = readPackageScripts();

    expect(scripts['godot:playtest-report']).toBe('node scripts/generate-godot-playtest-report.mjs');
    expect(scripts['check:godot']).toContain('godot:playtest-report -- --check');
    expect(existsSync(join(repoRoot, 'scripts', 'generate-godot-playtest-report.mjs'))).toBe(true);
    expect(existsSync(join(repoRoot, 'godot', 'tests', 'playtest_report_contract.json'))).toBe(true);
    expect(existsSync(join(repoRoot, 'reports', 'godot-playtest-report.json'))).toBe(true);
    expect(existsSync(join(repoRoot, 'reports', 'godot-playtest-report.md'))).toBe(true);
  });

  it('turns a manual trace and issue bookmark into JSON, Markdown, and generated task text', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-playtest-report-'));
    const tracePath = join(tempDir, 'trace.ndjson');
    const bookmarksPath = join(tempDir, 'bookmarks.json');
    const contractPath = join(tempDir, 'contract.json');
    const outJson = join(tempDir, 'report.json');
    const outMd = join(tempDir, 'report.md');

    try {
      writeFixtureSession(tracePath, bookmarksPath);
      writeFixtureContract(contractPath, tracePath, bookmarksPath, outJson, outMd);

      const result = spawnSync(process.execPath, ['scripts/generate-godot-playtest-report.mjs', '--contract', contractPath, '--json'], {
        cwd: repoRoot,
        encoding: 'utf8',
      });

      expect(result.status).toBe(0);
      const commandReport = JSON.parse(result.stdout) as {
        failed_checks: unknown[];
        sample_count: number;
        bookmark_count: number;
        generated_task_count: number;
      };
      expect(commandReport.failed_checks).toEqual([]);
      expect(commandReport.sample_count).toBeGreaterThanOrEqual(2);
      expect(commandReport.bookmark_count).toBe(4);
      expect(commandReport.generated_task_count).toBe(1);

      const report = JSON.parse(readFileSync(outJson, 'utf8')) as {
        samples: { level_id: string; recent_events: string[]; screenshot_path: string }[];
        generated_tasks: { title: string; body: string }[];
      };
      expect(report.samples[0]).toMatchObject({ level_id: 'central_hub', screenshot_path: 'shots/0000.png' });
      expect(report.samples.at(-1)?.recent_events).toContain('door.locked');
      expect(report.generated_tasks[0].title).toContain('objective_clarity');
      expect(report.generated_tasks[0].body).toContain('Locked door reason was easy to miss');
      expect(readFileSync(outMd, 'utf8')).toContain('## Generated Tasks');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('fails with useful evidence when samples or bookmark fields are missing', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-playtest-report-fail-'));
    const tracePath = join(tempDir, 'trace.ndjson');
    const bookmarksPath = join(tempDir, 'bookmarks.json');
    const contractPath = join(tempDir, 'contract.json');

    try {
      writeNdjson(tracePath, [{ frame: 0, time_ms: 0, event_type: 'playtest.sample', level_id: 'central_hub' }]);
      writeFileSync(bookmarksPath, `${JSON.stringify([{ id: 'bad_bookmark', kind: 'issue' }], null, 2)}\n`);
      writeFixtureContract(contractPath, tracePath, bookmarksPath, join(tempDir, 'report.json'), join(tempDir, 'report.md'));

      const result = spawnSync(process.execPath, ['scripts/generate-godot-playtest-report.mjs', '--contract', contractPath, '--json'], {
        cwd: repoRoot,
        encoding: 'utf8',
      });

      expect(result.status).toBe(1);
      const report = JSON.parse(result.stdout) as { failed_checks: { rule: string; message: string }[] };
      expect(report.failed_checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ rule: 'sample_field' }),
          expect.objectContaining({ rule: 'bookmark_field' }),
          expect.objectContaining({ rule: 'duration' }),
          expect.objectContaining({ rule: 'route_coverage' }),
          expect.objectContaining({ rule: 'observation_category' }),
        ]),
      );
      expect(report.failed_checks.map((check) => check.message).join('\n')).toContain('position');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('validates the checked-in canonical playtest report is current and issue-free', () => {
    const result = spawnSync(process.execPath, ['scripts/generate-godot-playtest-report.mjs', '--check', '--json'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const commandReport = JSON.parse(result.stdout) as {
      failed_checks: unknown[];
      sample_count: number;
      generated_task_count: number;
    };
    expect(commandReport.failed_checks).toEqual([]);
    expect(commandReport.sample_count).toBeGreaterThanOrEqual(2);
    expect(commandReport.generated_task_count).toBe(0);

    const report = JSON.parse(readFileSync(join(repoRoot, 'reports', 'godot-playtest-report.json'), 'utf8')) as {
      summary: { duration_ms: number };
      unresolved_issue_count: number;
      samples: { level_id: string }[];
      bookmarks: { category: string }[];
    };
    expect(report.unresolved_issue_count).toBe(0);
    expect(report.summary.duration_ms).toBeGreaterThanOrEqual(60000);
    expect(report.samples.map((sample) => sample.level_id)).toEqual(
      expect.arrayContaining(['central_hub', 'fire_area', 'labyrinth_011']),
    );
    expect(report.bookmarks.map((bookmark) => bookmark.category)).toEqual(
      expect.arrayContaining(['navigation_blocker', 'combat_feedback', 'enemy_ai', 'objective_clarity']),
    );
  });
});
