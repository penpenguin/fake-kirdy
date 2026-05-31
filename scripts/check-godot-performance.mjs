import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const repoRoot = process.cwd();
const godotRoot = join(repoRoot, 'godot');
const defaultBudgetPath = join(godotRoot, 'tests', 'performance_budget.json');
const defaultSuitePath = join(godotRoot, 'tests', 'replay_suite.json');

const options = parseArgs(process.argv.slice(2));
const budgetPath = resolve(repoRoot, options.budgetPath ?? defaultBudgetPath);
const suitePath = resolve(repoRoot, options.suitePath ?? defaultSuitePath);
const outDir = resolve(repoRoot, options.outDir ?? join(tmpdir(), `fake-kirdy-godot-performance-${process.pid}`));
const budget = readBudget(budgetPath);
const suite = readSuite(suitePath);
const selectedReplays = selectReplays(suite, budget.replay_ids);

if (!existsSync(join(godotRoot, 'project.godot'))) {
  console.error('[godot:performance] Missing canonical Godot project at godot/project.godot');
  process.exit(1);
}

const version = spawnSync('godot', ['--version'], { encoding: 'utf8' });
if (version.error?.code === 'ENOENT') {
  writeJson({
    skipped: true,
    reason: 'Godot is not installed',
    budget_path: relativeToRepo(budgetPath),
    replay_count: selectedReplays.length,
  });
  process.exit(0);
}

if (version.error) {
  console.error(`[godot:performance] ${version.error.message}`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
const result = await runPerformanceCheck(selectedReplays, budget, outDir);
writeJson(result);
process.exit(result.failed_checks.length > 0 ? 1 : 0);

async function runPerformanceCheck(replays, performanceBudget, outputDir) {
  const failedChecks = [];
  const importMetrics = await runCommandWithMetrics('godot', ['--headless', '--path', godotRoot, '--import']);

  if (importMetrics.status !== 0) {
    failedChecks.push({
      scope: 'import',
      metric: 'exit_status',
      actual: importMetrics.status,
      budget: 0,
      message: snippet(importMetrics.stderr),
    });
  }
  if (importMetrics.wall_time_ms > performanceBudget.max_import_wall_time_ms) {
    failedChecks.push({
      scope: 'import',
      metric: 'wall_time_ms',
      actual: importMetrics.wall_time_ms,
      budget: performanceBudget.max_import_wall_time_ms,
    });
  }

  const replayResults = [];
  for (const replay of replays) {
    const replayResult = await runReplayPerformance(replay, performanceBudget, outputDir);
    replayResults.push(replayResult);
    failedChecks.push(...replayResult.failed_checks);
  }

  return {
    skipped: false,
    budget_path: relativeToRepo(budgetPath),
    suite_path: relativeToRepo(suitePath),
    out_dir: outputDir,
    target_fps: performanceBudget.target_fps,
    import_metrics: importMetrics,
    replay_count: replayResults.length,
    failed_checks: failedChecks,
    results: replayResults,
  };
}

async function runReplayPerformance(replay, performanceBudget, outputDir) {
  const tracePath = join(outputDir, `${sanitizeFilename(replay.id)}.ndjson`);
  const replayMetrics = await runCommandWithMetrics(
    'godot',
    ['--path', godotRoot, '--headless', '--script', 'tests/run_replay.gd', '--', '--replay', replay.replay_path, '--out', tracePath],
  );
  const failedChecks = [];

  if (replayMetrics.status !== 0) {
    failedChecks.push({
      scope: replay.id,
      metric: 'exit_status',
      actual: replayMetrics.status,
      budget: 0,
      message: snippet(replayMetrics.stderr),
    });
  }
  if (replayMetrics.wall_time_ms > performanceBudget.max_replay_wall_time_ms) {
    failedChecks.push({
      scope: replay.id,
      metric: 'wall_time_ms',
      actual: replayMetrics.wall_time_ms,
      budget: performanceBudget.max_replay_wall_time_ms,
    });
  }
  if (
    replayMetrics.peak_rss_bytes !== null &&
    replayMetrics.peak_rss_bytes > performanceBudget.max_replay_rss_bytes
  ) {
    failedChecks.push({
      scope: replay.id,
      metric: 'peak_rss_bytes',
      actual: replayMetrics.peak_rss_bytes,
      budget: performanceBudget.max_replay_rss_bytes,
    });
  }

  if (!existsSync(tracePath)) {
    failedChecks.push({
      scope: replay.id,
      metric: 'trace_written',
      actual: false,
      budget: true,
    });
    return buildReplayResult(replay, tracePath, replayMetrics, null, null, failedChecks);
  }

  const traceSizeBytes = statSync(tracePath).size;
  if (traceSizeBytes > performanceBudget.max_trace_bytes) {
    failedChecks.push({
      scope: replay.id,
      metric: 'trace_size_bytes',
      actual: traceSizeBytes,
      budget: performanceBudget.max_trace_bytes,
    });
  }

  const summaryResult = spawnSync('node', ['scripts/trace-summary.mjs', tracePath], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if ((summaryResult.status ?? 0) !== 0 || summaryResult.error) {
    failedChecks.push({
      scope: replay.id,
      metric: 'trace_summary',
      actual: summaryResult.status ?? 1,
      budget: 0,
      message: summaryResult.error?.message ?? snippet(summaryResult.stderr),
    });
    return buildReplayResult(replay, tracePath, replayMetrics, traceSizeBytes, null, failedChecks);
  }

  const summary = JSON.parse(summaryResult.stdout);
  const effectiveTraceFps = calculateEffectiveTraceFps(summary);
  if (effectiveTraceFps !== null && effectiveTraceFps < performanceBudget.min_effective_trace_fps) {
    failedChecks.push({
      scope: replay.id,
      metric: 'effective_trace_fps',
      actual: effectiveTraceFps,
      budget: performanceBudget.min_effective_trace_fps,
    });
  }

  return buildReplayResult(replay, tracePath, replayMetrics, traceSizeBytes, {
    outcome: summary.outcome,
    first_frame: summary.first_frame,
    last_frame: summary.last_frame,
    duration_ms: summary.duration_ms,
    effective_trace_fps: effectiveTraceFps,
  }, failedChecks);
}

function buildReplayResult(replay, tracePath, replayMetrics, traceSizeBytes, summary, failedChecks) {
  return {
    id: replay.id,
    replay_path: replay.replay_path,
    trace_path: tracePath,
    metrics: replayMetrics,
    trace_size_bytes: traceSizeBytes,
    summary,
    status: failedChecks.length === 0 ? 'passed' : 'failed',
    failed_checks: failedChecks,
  };
}

function calculateEffectiveTraceFps(summary) {
  if (!Number.isFinite(summary?.duration_ms) || summary.duration_ms <= 0) {
    return null;
  }
  if (!Number.isFinite(summary?.first_frame) || !Number.isFinite(summary?.last_frame)) {
    return null;
  }

  return ((summary.last_frame - summary.first_frame) * 1000) / summary.duration_ms;
}

async function runCommandWithMetrics(command, args) {
  const startedAt = process.hrtime.bigint();
  const child = spawn(command, args, {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  let peakRssBytes = readPeakRssBytes(child.pid);
  const poll = setInterval(() => {
    const rssBytes = readPeakRssBytes(child.pid);
    if (rssBytes !== null) {
      peakRssBytes = Math.max(peakRssBytes ?? 0, rssBytes);
    }
  }, 50);

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });

  const status = await new Promise((resolveStatus) => {
    child.on('error', () => resolveStatus(1));
    child.on('close', (code) => resolveStatus(code ?? 1));
  });
  clearInterval(poll);

  return {
    status,
    wall_time_ms: Number(process.hrtime.bigint() - startedAt) / 1_000_000,
    peak_rss_bytes: peakRssBytes,
    stdout: snippet(stdout),
    stderr: snippet(stderr),
  };
}

function readPeakRssBytes(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return null;
  }

  try {
    const statusText = readFileSync(`/proc/${pid}/status`, 'utf8');
    const match = statusText.match(/^VmRSS:\s+(\d+)\s+kB$/m);
    return match ? Number(match[1]) * 1024 : null;
  } catch {
    return null;
  }
}

function readBudget(path) {
  if (!existsSync(path)) {
    throw new Error(`Performance budget not found: ${path}`);
  }

  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  const requiredNumbers = [
    'target_fps',
    'min_effective_trace_fps',
    'max_import_wall_time_ms',
    'max_replay_wall_time_ms',
    'max_replay_rss_bytes',
    'max_trace_bytes',
  ];
  if (parsed?.version !== 1) {
    throw new Error('Performance budget must be version 1');
  }
  for (const key of requiredNumbers) {
    if (!Number.isFinite(parsed[key]) || parsed[key] <= 0) {
      throw new Error(`Performance budget has invalid ${key}`);
    }
  }
  if (!Array.isArray(parsed.replay_ids) || parsed.replay_ids.length === 0) {
    throw new Error('Performance budget must include replay_ids');
  }

  return parsed;
}

function readSuite(path) {
  if (!existsSync(path)) {
    throw new Error(`Replay suite not found: ${path}`);
  }

  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  if (parsed?.version !== 1 || !Array.isArray(parsed.replays)) {
    throw new Error('Replay suite must be version 1 with a replays array');
  }
  return parsed.replays;
}

function selectReplays(replays, replayIds) {
  return replayIds.map((id) => {
    const replay = replays.find((entry) => entry.id === id);
    if (replay === undefined) {
      throw new Error(`Performance replay not found in suite: ${id}`);
    }
    return replay;
  });
}

function parseArgs(args) {
  const parsed = {
    budgetPath: null,
    suitePath: null,
    outDir: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--budget') {
      parsed.budgetPath = readArgValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--suite') {
      parsed.suitePath = readArgValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--out-dir') {
      parsed.outDir = readArgValue(args, index, arg);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function readArgValue(args, index, flag) {
  const value = args[index + 1];
  if (typeof value !== 'string' || value.length === 0 || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function sanitizeFilename(value) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function snippet(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return '';
  }
  return value.trim().slice(-2000);
}

function relativeToRepo(path) {
  return path.startsWith(repoRoot) ? path.slice(repoRoot.length + 1) : path;
}

function writeJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
