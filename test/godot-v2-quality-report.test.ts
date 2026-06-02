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

const writeReport = (path: string, failedChecks: unknown[] = [], warnings: unknown[] = []): void => {
  writeFileSync(path, `${JSON.stringify({ failed_checks: failedChecks, warnings }, null, 2)}\n`);
};

const writeFixtureContract = (path: string, outJson: string, outMd: string, checks: unknown[]): void => {
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        version: 1,
        output_json_path: outJson,
        output_markdown_path: outMd,
        checks,
        required_check_ids: ['scene-lint', 'level-graph', 'progression-solver'],
      },
      null,
      2,
    )}\n`,
  );
};

describe('Godot quality report', () => {
  it('defines a quality report command, contract, canonical report, and static gate hook', () => {
    const scripts = readPackageScripts();
    const contract = JSON.parse(readFileSync(join(repoRoot, 'godot', 'tests', 'quality_report_contract.json'), 'utf8')) as {
      required_check_ids?: string[];
      checks?: { id: string }[];
    };

    expect(scripts['godot:quality-report']).toBe('node scripts/generate-godot-quality-report.mjs');
    expect(scripts['check:godot']).toContain('godot:quality-report -- --check');
    expect(scripts['check:full']).toContain('godot:web-smoke -- --require-export --require-browser');
    expect(contract.required_check_ids).not.toContain('web-smoke');
    expect(contract.checks?.map((check) => check.id)).not.toContain('web-smoke');
    expect(existsSync(join(repoRoot, 'scripts', 'generate-godot-quality-report.mjs'))).toBe(true);
    expect(existsSync(join(repoRoot, 'godot', 'tests', 'quality_report_contract.json'))).toBe(true);
    expect(existsSync(join(repoRoot, 'reports', 'godot-quality-report.json'))).toBe(true);
    expect(existsSync(join(repoRoot, 'reports', 'godot-quality-report.md'))).toBe(true);
  });

  it('merges source reports into a single failed check list and Markdown summary', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-quality-report-'));
    const passPath = join(tempDir, 'pass.json');
    const failPath = join(tempDir, 'fail.json');
    const contractPath = join(tempDir, 'contract.json');
    const outJson = join(tempDir, 'quality.json');
    const outMd = join(tempDir, 'quality.md');

    try {
      writeReport(passPath);
      writeReport(failPath, [{ rule: 'door_target', message: 'Door target is missing.' }]);
      writeFixtureContract(contractPath, outJson, outMd, [
        { id: 'scene-lint', label: 'Scene lint', report_path: passPath },
        { id: 'level-graph', label: 'Level graph', report_path: failPath },
        { id: 'progression-solver', label: 'Progression solver', report_path: passPath },
      ]);

      const result = spawnSync(process.execPath, ['scripts/generate-godot-quality-report.mjs', '--contract', contractPath, '--json'], {
        cwd: repoRoot,
        encoding: 'utf8',
      });

      expect(result.status).toBe(1);
      const commandReport = JSON.parse(result.stdout) as {
        failed_checks: { source_id: string; rule: string; message: string }[];
      };
      expect(commandReport.failed_checks).toContainEqual(
        expect.objectContaining({ source_id: 'level-graph', rule: 'door_target' }),
      );

      const report = JSON.parse(readFileSync(outJson, 'utf8')) as {
        summary: { total: number; failed: number };
        failed_checks: { source_id: string }[];
      };
      expect(report.summary).toMatchObject({ total: 3, failed: 1 });
      expect(report.failed_checks[0].source_id).toBe('level-graph');
      expect(readFileSync(outMd, 'utf8')).toContain('Door target is missing.');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('fails when required quality sources are missing from the contract', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-quality-report-missing-'));
    const passPath = join(tempDir, 'pass.json');
    const contractPath = join(tempDir, 'contract.json');

    try {
      writeReport(passPath);
      writeFixtureContract(contractPath, join(tempDir, 'quality.json'), join(tempDir, 'quality.md'), [
        { id: 'scene-lint', label: 'Scene lint', report_path: passPath },
      ]);

      const result = spawnSync(process.execPath, ['scripts/generate-godot-quality-report.mjs', '--contract', contractPath, '--json'], {
        cwd: repoRoot,
        encoding: 'utf8',
      });

      expect(result.status).toBe(1);
      const commandReport = JSON.parse(result.stdout) as { failed_checks: { rule: string; message: string }[] };
      expect(commandReport.failed_checks).toContainEqual(expect.objectContaining({ rule: 'required_source' }));
      expect(commandReport.failed_checks.map((check) => check.message).join('\n')).toContain('level-graph');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('fails when a required quality source is skipped', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fake-kirdy-quality-report-skipped-'));
    const skippedPath = join(tempDir, 'skipped.json');
    const contractPath = join(tempDir, 'contract.json');

    try {
      writeFileSync(
        skippedPath,
        `${JSON.stringify(
          {
            skipped: true,
            skip_reason: 'Godot Web export artifacts are missing; run npm run build:public first',
            failed_checks: [],
            warnings: [],
          },
          null,
          2,
        )}\n`,
      );
      writeFileSync(
        contractPath,
        `${JSON.stringify(
          {
            version: 1,
            output_json_path: join(tempDir, 'quality.json'),
            output_markdown_path: join(tempDir, 'quality.md'),
            required_check_ids: ['web-smoke'],
            checks: [{ id: 'web-smoke', label: 'Web smoke', report_path: skippedPath }],
          },
          null,
          2,
        )}\n`,
      );

      const result = spawnSync(process.execPath, ['scripts/generate-godot-quality-report.mjs', '--contract', contractPath, '--json'], {
        cwd: repoRoot,
        encoding: 'utf8',
      });

      expect(result.status).toBe(1);
      const commandReport = JSON.parse(result.stdout) as { failed_checks: { rule: string; source_id: string; message: string }[] };
      expect(commandReport.failed_checks).toContainEqual(
        expect.objectContaining({ source_id: 'web-smoke', rule: 'required_source_skipped' }),
      );
      expect(commandReport.failed_checks.map((check) => check.message).join('\n')).toContain('Godot Web export artifacts');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('validates the checked-in canonical quality report is current and failure-free', () => {
    const result = spawnSync(process.execPath, ['scripts/generate-godot-quality-report.mjs', '--check', '--json'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const commandReport = JSON.parse(result.stdout) as {
      failed_checks: unknown[];
      total: number;
      failed: number;
    };
    expect(commandReport.failed_checks).toEqual([]);
    expect(commandReport.total).toBeGreaterThanOrEqual(10);
    expect(commandReport.failed).toBe(0);

    const report = JSON.parse(readFileSync(join(repoRoot, 'reports', 'godot-quality-report.json'), 'utf8')) as {
      summary: { failed: number };
      sources: { id: string; status: string }[];
      manual_playtest: { unresolved_issue_count: number };
    };
    expect(report.summary.failed).toBe(0);
    expect(report.sources.map((source) => source.id)).toEqual(
      expect.arrayContaining(['scene-lint', 'level-graph', 'progression-solver', 'playtest-report']),
    );
    expect(report.sources.map((source) => source.id)).not.toContain('web-smoke');
    expect(report.manual_playtest.unresolved_issue_count).toBe(0);
  });
});
