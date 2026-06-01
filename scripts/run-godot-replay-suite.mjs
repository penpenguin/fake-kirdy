import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const repoRoot = process.cwd();
const godotRoot = join(repoRoot, 'godot');
const defaultSuitePath = join(godotRoot, 'tests', 'replay_suite.json');

const options = parseArgs(process.argv.slice(2));
const suitePath = resolve(repoRoot, options.suitePath ?? defaultSuitePath);
const suite = readSuite(suitePath);

if (options.list) {
  writeJson({
    version: suite.version,
    replay_count: suite.replays.length,
    replays: suite.replays.map(({ id, replay_path, expected_outcome, expected_events, expected_last_hud, tags }) => ({
      id,
      replay_path,
      expected_outcome,
      expected_events,
      expected_last_hud,
      tags,
    })),
  });
  process.exit(0);
}

if (!existsSync(join(godotRoot, 'project.godot'))) {
  console.error('[godot:replay-suite] Missing canonical Godot project at godot/project.godot');
  process.exit(1);
}

const godot = resolveGodotExecutable();
if (godot === null) {
  writeJson({
    skipped: true,
    reason: 'Godot is not installed',
    suite_path: relativeToRepo(suitePath),
    replay_count: suite.replays.length,
  });
  process.exit(0);
}

ensureGodotImport(godot.command);

const outDir = resolve(repoRoot, options.outDir ?? join(tmpdir(), `fake-kirdy-godot-replay-suite-${process.pid}`));
mkdirSync(outDir, { recursive: true });

const results = suite.replays.map((replay) => runReplay(godot.command, replay, outDir));
const failedReplays = results.filter((result) => result.status !== 'passed');

writeJson({
  skipped: false,
  suite_path: relativeToRepo(suitePath),
  out_dir: outDir,
  godot_command: godot.command,
  godot_version: godot.version,
  replay_count: results.length,
  passed_replays: results.length - failedReplays.length,
  failed_replays: failedReplays.length,
  results,
});

process.exit(failedReplays.length > 0 ? 1 : 0);

function parseArgs(args) {
  const parsed = {
    list: false,
    suitePath: null,
    outDir: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--list') {
      parsed.list = true;
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

function readSuite(path) {
  if (!existsSync(path)) {
    throw new Error(`Replay suite not found: ${path}`);
  }

  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  if (parsed?.version !== 1 || !Array.isArray(parsed.replays)) {
    throw new Error('Replay suite must be version 1 with a replays array');
  }

  const ids = new Set();
  const replays = parsed.replays.map((replay, index) => {
    if (typeof replay?.id !== 'string' || replay.id.length === 0) {
      throw new Error(`Replay suite entry ${index} is missing id`);
    }

    if (ids.has(replay.id)) {
      throw new Error(`Duplicate replay suite id: ${replay.id}`);
    }
    ids.add(replay.id);

    if (typeof replay.replay_path !== 'string' || !replay.replay_path.startsWith('res://')) {
      throw new Error(`Replay suite entry ${replay.id} must use a res:// replay_path`);
    }

    if (
      replay.expected_outcome !== undefined &&
      (typeof replay.expected_outcome !== 'string' || replay.expected_outcome.length === 0)
    ) {
      throw new Error(`Replay suite entry ${replay.id} has invalid expected_outcome`);
    }

    if (replay.tags !== undefined && !Array.isArray(replay.tags)) {
      throw new Error(`Replay suite entry ${replay.id} has invalid tags`);
    }

    if (replay.expected_events !== undefined && !Array.isArray(replay.expected_events)) {
      throw new Error(`Replay suite entry ${replay.id} has invalid expected_events`);
    }

    if (
      replay.expected_last_hud !== undefined &&
      (typeof replay.expected_last_hud !== 'object' || replay.expected_last_hud === null || Array.isArray(replay.expected_last_hud))
    ) {
      throw new Error(`Replay suite entry ${replay.id} has invalid expected_last_hud`);
    }

    return {
      id: replay.id,
      replay_path: replay.replay_path,
      expected_outcome: replay.expected_outcome ?? null,
      expected_events: (replay.expected_events ?? []).map((eventType) => {
        if (typeof eventType !== 'string' || eventType.length === 0) {
          throw new Error(`Replay suite entry ${replay.id} has invalid expected_events item`);
        }
        return eventType;
      }),
      expected_last_hud: replay.expected_last_hud ?? {},
      tags: replay.tags ?? [],
    };
  });

  return {
    version: parsed.version,
    replays,
  };
}

function resolveGodotExecutable() {
  const commands = [
    process.env.GODOT_BIN,
    'godot',
    'godot4',
  ].filter(Boolean);

  for (const command of commands) {
    const version = spawnSync(command, ['--version'], { encoding: 'utf8' });
    if (version.error?.code === 'ENOENT' || version.error || (version.status ?? 0) !== 0) {
      continue;
    }
    return {
      command,
      version: String(version.stdout || version.stderr).trim(),
    };
  }

  return null;
}

function ensureGodotImport(godotCommand) {
  const importResult = spawnSync(godotCommand, ['--headless', '--path', godotRoot, '--import'], {
    encoding: 'utf8',
  });

  if (importResult.error) {
    console.error(`[godot:replay-suite] ${importResult.error.message}`);
    process.exit(1);
  }

  if ((importResult.status ?? 0) !== 0) {
    if (importResult.stdout) {
      console.error(importResult.stdout);
    }
    if (importResult.stderr) {
      console.error(importResult.stderr);
    }
    console.error('[godot:replay-suite] Godot asset import failed.');
    process.exit(importResult.status ?? 1);
  }
}

function runReplay(godotCommand, replay, outDir) {
  const tracePath = join(outDir, `${sanitizeFilename(replay.id)}.ndjson`);
  const replayResult = spawnSync(
    godotCommand,
    ['--path', godotRoot, '--headless', '--script', 'tests/run_replay.gd', '--', '--replay', replay.replay_path, '--out', tracePath],
    { encoding: 'utf8' },
  );

  if (replayResult.error) {
    return failureResult(replay, tracePath, `godot failed: ${replayResult.error.message}`);
  }

  if ((replayResult.status ?? 0) !== 0) {
    return failureResult(replay, tracePath, 'godot replay exited non-zero', replayResult);
  }

  if (!existsSync(tracePath)) {
    return failureResult(replay, tracePath, 'trace output was not written', replayResult);
  }

  const summaryResult = spawnSync('node', ['scripts/trace-summary.mjs', tracePath], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  if (summaryResult.error) {
    return failureResult(replay, tracePath, `trace summary failed: ${summaryResult.error.message}`);
  }

  if ((summaryResult.status ?? 0) !== 0) {
    return failureResult(replay, tracePath, 'trace summary exited non-zero', summaryResult);
  }

  const summary = JSON.parse(summaryResult.stdout);
  const outcomeMatches =
    replay.expected_outcome === null || summary.outcome === replay.expected_outcome;
  const missingEvents = replay.expected_events.filter((eventType) => Number(summary.counts_by_type?.[eventType] ?? 0) <= 0);
  const lastHudMismatches = getObjectSubsetMismatches(replay.expected_last_hud, summary.last_hud ?? {});
  const passed = outcomeMatches && missingEvents.length === 0 && lastHudMismatches.length === 0;

  return {
    id: replay.id,
    replay_path: replay.replay_path,
    trace_path: tracePath,
    expected_outcome: replay.expected_outcome,
    expected_events: replay.expected_events,
    expected_last_hud: replay.expected_last_hud,
    outcome: summary.outcome,
    status: passed ? 'passed' : 'failed',
    failure: passed ? null : buildReplayFailure(replay, summary, missingEvents, lastHudMismatches),
    event_count: summary.event_count,
    levels: summary.levels,
    counts_by_type: summary.counts_by_type,
    items_collected: summary.items_collected,
    collectibles_collected: summary.collectibles_collected,
    abilities_acquired: summary.abilities_acquired,
    abilities_used: summary.abilities_used,
    completed_levels: summary.completed_levels,
    unlocked_door_ids: summary.unlocked_door_ids,
    player_motion: summary.player_motion,
    last_hud: summary.last_hud,
    last_result_overlay: summary.last_result_overlay,
  };
}

function buildReplayFailure(replay, summary, missingEvents, lastHudMismatches) {
  const failures = [];
  if (replay.expected_outcome !== null && summary.outcome !== replay.expected_outcome) {
    failures.push(`expected outcome ${replay.expected_outcome}, got ${summary.outcome}`);
  }
  if (missingEvents.length > 0) {
    failures.push(`missing expected events: ${missingEvents.join(', ')}`);
  }
  if (lastHudMismatches.length > 0) {
    failures.push(`last_hud mismatches: ${lastHudMismatches.join(', ')}`);
  }
  return failures.join('; ');
}

function getObjectSubsetMismatches(expected, actual) {
  return Object.entries(expected).flatMap(([key, expectedValue]) => {
    const actualValue = actual?.[key];
    if (actualValue === expectedValue) {
      return [];
    }
    return [`${key} expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`];
  });
}

function failureResult(replay, tracePath, failure, result = null) {
  return {
    id: replay.id,
    replay_path: replay.replay_path,
    trace_path: tracePath,
    expected_outcome: replay.expected_outcome,
    expected_events: replay.expected_events ?? [],
    expected_last_hud: replay.expected_last_hud ?? {},
    outcome: null,
    status: 'failed',
    failure,
    stdout: snippet(result?.stdout),
    stderr: snippet(result?.stderr),
  };
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
