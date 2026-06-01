import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const repoRoot = process.cwd();
const godotRoot = join(repoRoot, 'godot');
const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const runtimeMode = args.includes('--runtime');
const contractPath = resolvePath(readOption('--contract') ?? join('godot', 'tests', 'save_load_roundtrip_contract.json'), repoRoot);

try {
  const contract = loadJson(contractPath, 'save/load roundtrip contract');
  const contractDir = dirname(contractPath);
  const paths = {
    save_state: resolvePath(requireString(contract.source_paths?.save_state, 'source_paths.save_state'), contractDir),
    game_session: resolvePath(requireString(contract.source_paths?.game_session, 'source_paths.game_session'), contractDir),
    run_replay: resolvePath(requireString(contract.source_paths?.run_replay, 'source_paths.run_replay'), contractDir),
    replay_suite: resolvePath(requireString(contract.source_paths?.replay_suite, 'source_paths.replay_suite'), contractDir),
  };
  const sources = {
    save_state: readFileSync(paths.save_state, 'utf8'),
    game_session: readFileSync(paths.game_session, 'utf8'),
    run_replay: readFileSync(paths.run_replay, 'utf8'),
    replay_suite: loadJson(paths.replay_suite, 'replay suite'),
  };
  const requiredFields = checkRequiredFields(contract, sources);
  const replayCoverage = checkReplayCoverage(contract, contractDir, sources);
  const sampleChecks = checkRoundtripSamples(contract);
  const runtimeChecks = runtimeMode ? runRuntimeRoundtrip(contract) : { checks: [], report: null };
  const checks = [
    ...requiredFields.checks,
    ...replayCoverage.checks,
    ...sampleChecks.checks,
    ...runtimeChecks.checks,
  ];
  const failedChecks = checks.filter((check) => check.severity === 'error');
  const warnings = checks.filter((check) => check.severity === 'warning');
  const report = {
    contract_path: contractPath,
    source_paths: paths,
    runtime: runtimeChecks.report,
    required_fields: requiredFields.fields,
    representative_replays: replayCoverage.replays,
    sample_results: sampleChecks.samples,
    categories: {
      save_state_fields: requiredFields.fields.length,
      session_payloads: requiredFields.fields.length * 2,
      roundtrip_samples: sampleChecks.samples.length,
      replay_coverage: replayCoverage.replays.length,
    },
    warnings,
    failed_checks: failedChecks,
  };

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else if (failedChecks.length > 0) {
    console.error(`[godot:save-load-roundtrip] failed ${failedChecks.length} check(s).`);
    for (const check of failedChecks) {
      console.error(`[godot:save-load-roundtrip] ${check.rule} ${check.message}`);
    }
  } else {
    const runtimeSuffix = runtimeMode && runtimeChecks.report != null ? `; runtime=${runtimeChecks.report.status}` : '';
    console.log(
      `[godot:save-load-roundtrip] passed ${requiredFields.fields.length} field(s), ${sampleChecks.samples.length} sample(s), and ${replayCoverage.replays.length} replay contract(s)${runtimeSuffix}.`,
    );
  }

  process.exit(failedChecks.length > 0 ? 1 : 0);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const report = {
    contract_path: contractPath,
    runtime: null,
    required_fields: [],
    representative_replays: [],
    sample_results: [],
    categories: {
      save_state_fields: 0,
      session_payloads: 0,
      roundtrip_samples: 0,
      replay_coverage: 0,
    },
    warnings: [],
    failed_checks: [{ rule: 'runtime_error', severity: 'error', message }],
  };
  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.error(`[godot:save-load-roundtrip] ${message}`);
  }
  process.exit(1);
}

function readOption(name) {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`Missing value for ${name}`);
  }
  return value;
}

function resolvePath(path, baseDir) {
  if (path.startsWith('res://')) {
    return join(godotRoot, path.slice('res://'.length));
  }
  if (isAbsolute(path)) {
    return path;
  }
  const repoRelative = resolve(repoRoot, path);
  if (existsSync(repoRelative) || path.startsWith('godot/') || path.startsWith('scripts/') || path.startsWith('test/')) {
    return repoRelative;
  }
  return resolve(baseDir, path);
}

function resolveReplayPath(path, contractDir) {
  if (!path.startsWith('res://')) {
    return resolvePath(path, contractDir);
  }
  if (contractPath.startsWith(godotRoot)) {
    return join(godotRoot, path.slice('res://'.length));
  }
  return join(contractDir, path.slice('res://'.length));
}

function loadJson(path, label) {
  if (!existsSync(path)) {
    throw new Error(`Missing ${label}: ${path}`);
  }
  const data = JSON.parse(readFileSync(path, 'utf8'));
  if (data?.version !== 1) {
    throw new Error(`${label} must declare version 1`);
  }
  return data;
}

function checkRequiredFields(contract, sources) {
  const checks = [];
  const fields = [];
  const saveDictionaryBody = extractFunctionBody(sources.save_state, 'to_dictionary');
  const fromDictionaryBody = extractFunctionBody(sources.save_state, 'from_dictionary');
  const buildSaveBody = extractFunctionBody(sources.game_session, 'build_save_payload');
  const loadPersistentBody = extractFunctionBody(sources.game_session, 'load_persistent_state');

  for (const field of requireArray(contract.required_roundtrip_fields, 'required_roundtrip_fields')) {
    const key = requireString(field.key, 'required_roundtrip_fields.key');
    const stateVar = requireString(field.state_var, `${key}.state_var`);
    const hasStateVar = sources.save_state.includes(`var ${stateVar}`);
    const hasToDictionary = saveDictionaryBody.includes(`"${key}"`) && saveDictionaryBody.includes(stateVar);
    const hasFromDictionary = fromDictionaryBody.includes(`data.get("${key}"`) || fromDictionaryBody.includes(`state.${stateVar}`);
    const hasSavePayload = buildSaveBody.includes(`"${key}"`);
    const hasLoadPayload = loadPersistentBody.includes(`"${key}"`);
    const saveStateStatus = hasStateVar && hasToDictionary && hasFromDictionary ? 'covered' : 'missing';
    const sessionSaveStatus = hasSavePayload ? 'covered' : 'missing';
    const sessionLoadStatus = hasLoadPayload ? 'covered' : 'missing';
    fields.push({
      key,
      state_var: stateVar,
      kind: String(field.kind ?? 'unknown'),
      save_state_status: saveStateStatus,
      session_save_status: sessionSaveStatus,
      session_load_status: sessionLoadStatus,
    });

    if (saveStateStatus !== 'covered') {
      checks.push(buildCheck(contract, 'save_state_field_roundtrip', {
        field: key,
        message: `${key} must be declared, serialized by SaveState.to_dictionary, and accepted by SaveState.from_dictionary.`,
      }));
    }
    if (sessionSaveStatus !== 'covered') {
      checks.push(buildCheck(contract, 'session_save_payload_field', {
        field: key,
        message: `${key} is missing from GameSession.build_save_payload.`,
      }));
    }
    if (sessionLoadStatus !== 'covered') {
      checks.push(buildCheck(contract, 'session_load_payload_field', {
        field: key,
        message: `${key} is missing from GameSession save.loaded trace payload.`,
      }));
    }
  }

  return { fields, checks };
}

function checkReplayCoverage(contract, contractDir, sources) {
  const checks = [];
  const replays = [];
  const runReplaySupportsSave =
    sources.run_replay.includes('--save') && sources.run_replay.includes('save_enabled') && sources.run_replay.includes('save_path');
  if (!runReplaySupportsSave) {
    checks.push(buildCheck(contract, 'replay_save_path_support', {
      message: 'run_replay.gd must support --save by enabling GameSession.save_enabled and setting save_path.',
    }));
  }

  for (const replay of requireOptionalArray(contract.representative_replays, 'representative_replays')) {
    const id = requireString(replay.id, 'representative_replay.id');
    const replayPath = requireString(replay.replay_path, `${id}.replay_path`);
    const resolvedPath = resolveReplayPath(replayPath, contractDir);
    const suiteEntry = Array.isArray(sources.replay_suite.replays)
      ? sources.replay_suite.replays.find((entry) => entry?.id === id || entry?.replay_path === replayPath)
      : null;
    const exists = existsSync(resolvedPath);
    replays.push({
      id,
      replay_path: replayPath,
      resolved_path: resolvedPath,
      exists,
      listed_in_suite: suiteEntry != null,
      required_events: requireOptionalArray(replay.required_events, `${id}.required_events`).map(String),
    });
    if (!exists) {
      checks.push(buildCheck(contract, 'representative_replay_exists', {
        replay_id: id,
        replay_path: replayPath,
        message: `${id} representative replay is missing: ${replayPath}.`,
      }));
    }
  }

  return { replays, checks };
}

function checkRoundtripSamples(contract) {
  const checks = [];
  const samples = [];
  for (const sample of requireOptionalArray(contract.roundtrip_samples, 'roundtrip_samples')) {
    const id = requireString(sample.id, 'roundtrip_sample.id');
    const actual = sanitizeSaveDictionary(sample.input ?? {});
    const expected = sample.expected ?? {};
    const mismatches = collectMismatches(expected, actual);
    samples.push({ id, actual, expected, status: mismatches.length === 0 ? 'passed' : 'failed', mismatches });
    for (const mismatch of mismatches) {
      checks.push(buildCheck(contract, 'sample_roundtrip', {
        sample_id: id,
        field: mismatch.path,
        message: `${id} expected ${mismatch.path}=${JSON.stringify(mismatch.expected)}, got ${JSON.stringify(mismatch.actual)}.`,
      }));
    }
  }
  return { samples, checks };
}

function sanitizeSaveDictionary(input) {
  return {
    acquired_item_ids: sanitizeStringArray(input.acquired_item_ids),
    completed_level_ids: sanitizeStringArray(input.completed_level_ids),
    visited_level_ids: sanitizeStringArray(input.visited_level_ids),
    unlocked_door_ids: sanitizeStringArray(input.unlocked_door_ids),
    defeated_enemy_group_ids: sanitizeStringArray(input.defeated_enemy_group_ids),
    defeated_boss_ids: sanitizeStringArray(input.defeated_boss_ids),
    opened_ability_gate_ids: sanitizeStringArray(input.opened_ability_gate_ids),
    discovered_hidden_feature_ids: sanitizeStringArray(input.discovered_hidden_feature_ids),
    completed_dead_end_ids: sanitizeStringArray(input.completed_dead_end_ids),
    explored_tiles: sanitizeExploredTiles(input.explored_tiles),
    current_level_id: stringValue(input.current_level_id),
    player_position: sanitizePosition(input.player_position),
    ability_type: stringValue(input.ability_type),
    consumed_heal_ids: sanitizeStringArray(input.consumed_heal_ids),
    settings: sanitizeSettings(input.settings),
    player_hp: intValue(input.player_hp),
    player_max_hp: intValue(input.player_max_hp),
    player_revive_count: Math.max(intValue(input.player_revive_count), 0),
  };
}

function sanitizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value.map(String).filter((entry) => entry.length > 0))].sort();
}

function sanitizeExploredTiles(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const result = {};
  for (const [levelId, tiles] of Object.entries(value)) {
    const normalizedLevelId = String(levelId);
    if (normalizedLevelId.length === 0 || !Array.isArray(tiles)) {
      continue;
    }
    const validTiles = [...new Set(tiles.map(String).filter(isValidTileKey))].sort();
    if (validTiles.length > 0) {
      result[normalizedLevelId] = validTiles;
    }
  }
  return Object.fromEntries(Object.entries(result).sort(([left], [right]) => left.localeCompare(right)));
}

function isValidTileKey(tileKey) {
  const parts = tileKey.split(',');
  if (parts.length !== 2) {
    return false;
  }
  const x = Number(parts[0]);
  const y = Number(parts[1]);
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0;
}

function sanitizeSettings(value) {
  const defaults = { volume: 0.4, controls: 'keyboard', difficulty: 'normal' };
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return defaults;
  }
  const controls = ['keyboard', 'touch', 'controller'].includes(String(value.controls)) ? String(value.controls) : defaults.controls;
  const difficulty = ['easy', 'normal', 'hard'].includes(String(value.difficulty)) ? String(value.difficulty) : defaults.difficulty;
  return {
    volume: clamp(Number(value.volume ?? defaults.volume), 0, 1),
    controls,
    difficulty,
  };
}

function sanitizePosition(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return {
    x: Number(value.x ?? 0),
    y: Number(value.y ?? 0),
  };
}

function runRuntimeRoundtrip(contract) {
  const checks = [];
  if (!existsSync(join(godotRoot, 'project.godot'))) {
    return {
      checks: [buildCheck(contract, 'runtime_godot_project_missing', { message: 'godot/project.godot is missing.' })],
      report: { status: 'failed', skipped: false, reason: 'missing_project' },
    };
  }

  const godot = resolveGodotExecutable();
  if (godot === null) {
    return { checks: [], report: { status: 'skipped', skipped: true, reason: 'Godot is not installed' } };
  }

  const runtime = contract.runtime_roundtrip ?? {};
  const tempDir = join(tmpdir(), `fake-kirdy-save-load-roundtrip-${process.pid}`);
  mkdirSync(tempDir, { recursive: true });
  const savePath = join(tempDir, 'roundtrip-save.json');
  const seedTracePath = join(tempDir, 'seed.ndjson');
  const loadTracePath = join(tempDir, 'load.ndjson');
  const initialSave = sanitizeSaveDictionary(runtime.initial_save ?? {});
  writeFileSync(savePath, `${JSON.stringify(initialSave, null, 2)}\n`);

  const seedReplay = String(runtime.seed_replay_path ?? 'res://tests/replays/save_load_roundtrip_seed.json');
  const loadReplay = String(runtime.load_replay_path ?? 'res://tests/replays/use_saved_ability.json');
  const seed = runGodotReplay(godot.command, seedReplay, seedTracePath, savePath);
  const load = seed.status === 'passed' ? runGodotReplay(godot.command, loadReplay, loadTracePath, savePath) : null;
  const seedEvents = seed.status === 'passed' ? readNdjson(seedTracePath) : [];
  const loadEvents = load?.status === 'passed' ? readNdjson(loadTracePath) : [];
  const writtenSave = existsSync(savePath) ? JSON.parse(readFileSync(savePath, 'utf8')) : {};
  const requiredSaveFields = requireOptionalArray(runtime.required_saved_fields, 'runtime_roundtrip.required_saved_fields').map(String);
  const requiredLoadEvents = requireOptionalArray(runtime.required_load_events, 'runtime_roundtrip.required_load_events').map(String);

  if (seed.status !== 'passed') {
    checks.push(buildCheck(contract, 'runtime_seed_replay_failed', { message: seed.failure }));
  }
  if (load == null || load.status !== 'passed') {
    checks.push(buildCheck(contract, 'runtime_load_replay_failed', { message: load?.failure ?? 'load replay was not run.' }));
  }
  for (const field of requiredSaveFields) {
    if (!Object.prototype.hasOwnProperty.call(writtenSave, field)) {
      checks.push(buildCheck(contract, 'runtime_saved_field_missing', {
        field,
        message: `runtime save file is missing ${field}.`,
      }));
    }
  }
  const eventCounts = countEvents([...seedEvents, ...loadEvents]);
  for (const eventType of requiredLoadEvents) {
    if (Number(eventCounts[eventType] ?? 0) <= 0) {
      checks.push(buildCheck(contract, 'runtime_event_missing', {
        event_type: eventType,
        message: `runtime roundtrip trace is missing ${eventType}.`,
      }));
    }
  }

  return {
    checks,
    report: {
      status: checks.length === 0 ? 'passed' : 'failed',
      skipped: false,
      godot_command: godot.command,
      godot_version: godot.version,
      save_path: savePath,
      seed_trace_path: seedTracePath,
      load_trace_path: loadTracePath,
      event_counts: eventCounts,
    },
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

function runGodotReplay(godotCommand, replayPath, tracePath, savePath) {
  const result = spawnSync(
    godotCommand,
    ['--path', godotRoot, '--headless', '--script', 'tests/run_replay.gd', '--', '--replay', replayPath, '--out', tracePath, '--save', savePath],
    { encoding: 'utf8' },
  );
  if (result.error) {
    return { status: 'failed', failure: result.error.message };
  }
  if ((result.status ?? 0) !== 0) {
    return { status: 'failed', failure: result.stderr || result.stdout || `Godot exited ${result.status}` };
  }
  if (!existsSync(tracePath)) {
    return { status: 'failed', failure: `trace was not written: ${tracePath}` };
  }
  return { status: 'passed', failure: null };
}

function readNdjson(path) {
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

function countEvents(events) {
  const counts = {};
  for (const event of events) {
    const eventType = String(event.event_type ?? '');
    if (eventType.length === 0) {
      continue;
    }
    counts[eventType] = (counts[eventType] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function collectMismatches(expected, actual, prefix = '') {
  const mismatches = [];
  for (const [key, expectedValue] of Object.entries(expected)) {
    const path = prefix.length === 0 ? key : `${prefix}.${key}`;
    const actualValue = actual?.[key];
    if (isPlainObject(expectedValue)) {
      mismatches.push(...collectMismatches(expectedValue, actualValue ?? {}, path));
      continue;
    }
    if (JSON.stringify(actualValue) !== JSON.stringify(expectedValue)) {
      mismatches.push({ path, expected: expectedValue, actual: actualValue });
    }
  }
  return mismatches;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function extractFunctionBody(sourceText, functionName) {
  const match = sourceText.match(new RegExp(`func ${escapeRegExp(functionName)}\\([^\\n]*\\)(?:\\s*->\\s*[^:]+)?:([\\s\\S]*?)(?=\\n\\nfunc |\\n\\nstatic func |\\n\\n@|\\n\\n$|$)`));
  return match?.[1] ?? '';
}

function buildCheck(contract, rule, details) {
  const severity = String(contract.rules?.[rule]?.severity ?? 'error');
  return { rule, severity, ...details };
}

function requireArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  return value;
}

function requireOptionalArray(value, label) {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  return value;
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function stringValue(value) {
  return typeof value === 'string' ? value : '';
}

function intValue(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
