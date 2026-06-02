import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const repoRoot = process.cwd();
const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const checkOnly = args.includes('--check');
const contractPath = resolvePath(readOption('--contract') ?? 'godot/tests/quality_report_contract.json');

try {
  const contract = loadJson(contractPath, 'quality report contract');
  const outputJsonPath = resolvePath(readOption('--out-json') ?? requireString(contract.output_json_path, 'output_json_path'));
  const outputMarkdownPath = resolvePath(readOption('--out-md') ?? requireString(contract.output_markdown_path, 'output_markdown_path'));
  const sources = runSources(requireArray(contract.checks, 'checks'));
  const missingSourceChecks = checkRequiredSources(contract, sources);
  const report = buildQualityReport(sources);
  const markdown = renderMarkdown(report);
  const failedChecks = [...missingSourceChecks, ...report.failed_checks];

  if (checkOnly && failedChecks.length === 0) {
    const expectedJson = `${JSON.stringify(report, null, 2)}\n`;
    if (!existsSync(outputJsonPath) || readFileSync(outputJsonPath, 'utf8') !== expectedJson) {
      failedChecks.push({
        source_id: 'quality-report',
        rule: 'report_freshness',
        severity: 'error',
        message: `${outputJsonPath} is not current. Run npm run godot:quality-report.`,
      });
    }
    if (!existsSync(outputMarkdownPath) || readFileSync(outputMarkdownPath, 'utf8') !== markdown) {
      failedChecks.push({
        source_id: 'quality-report',
        rule: 'report_freshness',
        severity: 'error',
        message: `${outputMarkdownPath} is not current. Run npm run godot:quality-report.`,
      });
    }
  }

  if (!checkOnly) {
    writeText(outputJsonPath, `${JSON.stringify(report, null, 2)}\n`);
    writeText(outputMarkdownPath, markdown);
  }

  const commandReport = {
    contract_path: contractPath,
    output_json_path: outputJsonPath,
    output_markdown_path: outputMarkdownPath,
    total: report.summary.total,
    passed: report.summary.passed,
    failed: report.summary.failed,
    warning_count: report.summary.warning_count,
    failed_checks: failedChecks,
  };

  if (jsonOutput) {
    console.log(JSON.stringify(commandReport, null, 2));
  } else if (failedChecks.length > 0) {
    console.error(`[godot:quality-report] failed ${failedChecks.length} check(s).`);
    for (const check of failedChecks) {
      console.error(`[godot:quality-report] ${check.source_id} ${check.rule}: ${check.message}`);
    }
  } else if (checkOnly) {
    console.log(`[godot:quality-report] report is current; passed=${report.summary.passed}/${report.summary.total}.`);
  } else {
    console.log(`[godot:quality-report] wrote ${outputJsonPath} and ${outputMarkdownPath}.`);
  }

  process.exit(failedChecks.length > 0 ? 1 : 0);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const commandReport = {
    contract_path: contractPath,
    total: 0,
    passed: 0,
    failed: 1,
    warning_count: 0,
    failed_checks: [{ source_id: 'quality-report', rule: 'runtime_error', severity: 'error', message }],
  };
  if (jsonOutput) {
    console.log(JSON.stringify(commandReport, null, 2));
  } else {
    console.error(`[godot:quality-report] ${message}`);
  }
  process.exit(1);
}

function runSources(checks) {
  return checks.map((check) => {
    const id = requireString(check.id, 'check.id');
    const label = requireString(check.label ?? check.id, 'check.label');
    const result = check.report_path ? readSourceReport(check) : runSourceCommand(check);
    const failedChecks = normalizeFailedChecks(id, result.report.failed_checks ?? []);
    const warnings = normalizeWarnings(id, result.report.warnings ?? []);
    const commandFailedCheck =
      result.exit_status === 0
        ? []
        : [{
            source_id: id,
            rule: 'command_exit',
            severity: 'error',
            message: `${label} exited with status ${result.exit_status}.`,
          }];
    const source = {
      id,
      label,
      status: failedChecks.length === 0 && commandFailedCheck.length === 0 ? 'passed' : 'failed',
      exit_status: result.exit_status,
      failed_check_count: failedChecks.length + commandFailedCheck.length,
      warning_count: warnings.length,
      failed_checks: [...failedChecks, ...commandFailedCheck],
      warnings,
      summary: summarizeSource(result.report),
    };
    if (result.report.skipped === true) {
      source.skipped = true;
      source.skip_reason = String(result.report.skip_reason ?? 'Quality source was skipped.');
    }
    return source;
  });
}

function readSourceReport(check) {
  const reportPath = resolvePath(requireString(check.report_path, 'check.report_path'));
  return { exit_status: 0, report: loadJson(reportPath, `${check.id} report`) };
}

function runSourceCommand(check) {
  const script = requireString(check.script, 'check.script');
  const commandArgs = requireArray(check.args ?? ['--json'], 'check.args').map(String);
  const result = spawnSync(process.execPath, [script, ...commandArgs], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  const stdout = result.stdout.trim();
  if (stdout.length === 0) {
    return {
      exit_status: result.status ?? 1,
      report: {
        failed_checks: [{
          rule: 'missing_json',
          message: `${check.id} did not emit JSON output.`,
        }],
      },
    };
  }
  try {
    return { exit_status: result.status ?? 0, report: JSON.parse(stdout) };
  } catch (error) {
    return {
      exit_status: result.status ?? 1,
      report: {
        failed_checks: [{
          rule: 'invalid_json',
          message: `${check.id} emitted invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
        }],
      },
    };
  }
}

function buildQualityReport(sources) {
  const failedChecks = sources.flatMap((source) => source.failed_checks);
  const warnings = sources.flatMap((source) => source.warnings);
  const playtestSource = sources.find((source) => source.id === 'playtest-report');
  return {
    version: 1,
    generated_at: '1970-01-01T00:00:00.000Z',
    summary: {
      total: sources.length,
      passed: sources.filter((source) => source.status === 'passed').length,
      failed: sources.filter((source) => source.status === 'failed').length,
      failed_check_count: failedChecks.length,
      warning_count: warnings.length,
    },
    manual_playtest: {
      unresolved_issue_count: Number(playtestSource?.summary.unresolved_issue_count ?? 0),
      generated_task_count: Number(playtestSource?.summary.generated_task_count ?? 0),
    },
    sources,
    failed_checks: failedChecks,
    warnings,
  };
}

function renderMarkdown(report) {
  const lines = [
    '# Godot Quality Report',
    '',
    `- Passed: ${report.summary.passed}/${report.summary.total}`,
    `- Failed checks: ${report.summary.failed_check_count}`,
    `- Warnings: ${report.summary.warning_count}`,
    `- Manual playtest unresolved issues: ${report.manual_playtest.unresolved_issue_count}`,
    '',
    '## Sources',
    '',
  ];
  for (const source of report.sources) {
    lines.push(`- ${source.id}: ${source.status} (${source.failed_check_count} failed, ${source.warning_count} warnings)`);
  }
  lines.push('', '## Failed Checks', '');
  if (report.failed_checks.length === 0) {
    lines.push('- None');
  } else {
    for (const check of report.failed_checks) {
      lines.push(`- ${check.source_id} ${check.rule}: ${check.message}`);
    }
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function checkRequiredSources(contract, sources) {
  const checks = [];
  const present = new Set(sources.map((source) => source.id));
  for (const id of requireArray(contract.required_check_ids ?? [], 'required_check_ids').map(String)) {
    const source = sources.find((entry) => entry.id === id);
    if (!present.has(id)) {
      checks.push({
        source_id: 'quality-report',
        rule: 'required_source',
        severity: 'error',
        message: `Quality report contract is missing required source ${id}.`,
      });
    } else if (source?.skipped === true) {
      checks.push({
        source_id: id,
        rule: 'required_source_skipped',
        severity: 'error',
        message: `Required quality source ${id} was skipped: ${source.skip_reason}`,
      });
    }
  }
  return checks;
}

function normalizeFailedChecks(sourceId, checks) {
  if (!Array.isArray(checks)) {
    return [];
  }
  return checks.map((check) => ({
    ...objectOrEmpty(check),
    source_id: sourceId,
    rule: String(check?.rule ?? 'failed_check'),
    severity: String(check?.severity ?? 'error'),
    message: String(check?.message ?? 'Quality source reported a failed check.'),
  }));
}

function normalizeWarnings(sourceId, warnings) {
  if (!Array.isArray(warnings)) {
    return [];
  }
  return warnings.map((warning) => ({
    ...objectOrEmpty(warning),
    source_id: sourceId,
    rule: String(warning?.rule ?? 'warning'),
    severity: String(warning?.severity ?? 'warning'),
    message: String(warning?.message ?? 'Quality source reported a warning.'),
  }));
}

function summarizeSource(report) {
  return {
    assertion_count: report.assertion_count,
    sample_count: report.sample_count,
    generated_task_count: report.generated_task_count,
    unresolved_issue_count: report.unresolved_issue_count,
    smoke_steps: Array.isArray(report.smoke_steps) ? report.smoke_steps.length : undefined,
  };
}

function loadJson(path, label) {
  if (!existsSync(path)) {
    throw new Error(`${label} not found: ${path}`);
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readOption(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function resolvePath(path) {
  return resolve(repoRoot, path);
}

function writeText(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a string.`);
  }
  return value;
}

function requireArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }
  return value;
}

function objectOrEmpty(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
