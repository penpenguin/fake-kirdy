import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repoRoot = process.cwd();
const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const contractPath = resolvePath(readOption('--contract') ?? join('godot', 'tests', 'feel_metrics_contract.json'));

try {
  const contract = loadJson(contractPath, 'feel metrics contract');
  const playerTuningPath = resolvePath(requireString(contract.source_paths?.player_tuning, 'source_paths.player_tuning'));
  const gameSessionPath = resolvePath(requireString(contract.source_paths?.game_session, 'source_paths.game_session'));
  const tuning = extractExportDefaults(readFileSync(playerTuningPath, 'utf8'));
  const gameSession = extractGameSessionValues(readFileSync(gameSessionPath, 'utf8'));
  const metrics = calculateFeelMetrics(tuning, gameSession, contract.simulation ?? {});
  const failedChecks = checkMetricRanges(contract, metrics);
  const report = {
    contract_path: contractPath,
    source_paths: {
      player_tuning: playerTuningPath,
      game_session: gameSessionPath,
    },
    simulation: normalizeSimulation(contract.simulation ?? {}),
    tuning,
    game_session: gameSession,
    metrics,
    failed_checks: failedChecks,
  };

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else if (failedChecks.length > 0) {
    console.error(`[godot:feel-metrics] failed ${failedChecks.length} check(s).`);
    for (const check of failedChecks) {
      console.error(`[godot:feel-metrics] ${check.metric} ${check.message}`);
    }
  } else {
    console.log(`[godot:feel-metrics] passed ${Object.keys(metrics).length} controller feel metric(s).`);
  }

  process.exit(failedChecks.length > 0 ? 1 : 0);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (jsonOutput) {
    console.log(
      JSON.stringify(
        {
          contract_path: contractPath,
          metrics: {},
          failed_checks: [{ rule: 'runtime_error', message }],
        },
        null,
        2,
      ),
    );
  } else {
    console.error(`[godot:feel-metrics] ${message}`);
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

function resolvePath(path) {
  return resolve(repoRoot, path);
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

function extractExportDefaults(sourceText) {
  const defaults = {};
  const exportPattern = /@export var ([a-zA-Z0-9_]+): [^=]+ = ([^\n]+)/g;
  for (const match of sourceText.matchAll(exportPattern)) {
    const value = parseGdValue(match[2].trim());
    if (typeof value === 'number') {
      defaults[match[1]] = value;
    }
  }
  return defaults;
}

function extractGameSessionValues(sourceText) {
  const exports = extractExportDefaults(sourceText);
  const difficultyProfiles = extractDifficultyProfiles(sourceText, exports);
  const abilityProfiles = extractAbilityProfiles(sourceText);
  return {
    player_invulnerability_ms: Number(exports.player_invulnerability_ms ?? 800),
    difficulty_profiles: difficultyProfiles,
    ability_profiles: abilityProfiles,
  };
}

function extractDifficultyProfiles(sourceText, exports) {
  const profiles = {};
  const bodyMatch = sourceText.match(/func get_difficulty_profile\(\) -> Dictionary:([\s\S]*?)\n\nfunc /);
  if (!bodyMatch) {
    return profiles;
  }

  const casePattern = /\n {8}"([^"]+)":\n {12}return \{([\s\S]*?)\n {12}\}/g;
  for (const match of bodyMatch[1].matchAll(casePattern)) {
    profiles[match[1]] = parseGdDictionary(match[2], exports);
  }

  const defaultMatch = bodyMatch[1].match(/\n {8}_:\n {12}return \{([\s\S]*?)\n {12}\}/);
  if (defaultMatch) {
    profiles.normal = parseGdDictionary(defaultMatch[1], exports);
  }

  return profiles;
}

function extractAbilityProfiles(sourceText) {
  const profiles = {};
  const bodyMatch = sourceText.match(/func get_ability_profile\(ability_type: String\) -> Dictionary:([\s\S]*?)\n\nfunc /);
  if (!bodyMatch) {
    return profiles;
  }

  const casePattern = /\n {8}((?:"[^"]+"(?:,\s*"[^"]+")*)):\n {12}return \{([\s\S]*?)\n {12}\}/g;
  for (const match of bodyMatch[1].matchAll(casePattern)) {
    const aliases = Array.from(match[1].matchAll(/"([^"]+)"/g)).map((aliasMatch) => aliasMatch[1]);
    const profile = parseGdDictionary(match[2], {});
    for (const alias of aliases) {
      profiles[alias] = profile;
    }
  }
  return profiles;
}

function parseGdDictionary(dictionaryText, variables) {
  const profile = {};
  const entryPattern = /"([^"]+)":\s*([^,\n}]+)/g;
  for (const match of dictionaryText.matchAll(entryPattern)) {
    profile[match[1]] = parseGdValue(match[2].trim(), variables);
  }
  return profile;
}

function parseGdValue(rawValue, variables = {}) {
  if (rawValue === 'true') {
    return true;
  }
  if (rawValue === 'false') {
    return false;
  }
  if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
    return rawValue.slice(1, -1);
  }
  if (variables[rawValue] !== undefined) {
    return variables[rawValue];
  }
  const numericValue = Number(rawValue);
  if (!Number.isNaN(numericValue)) {
    return numericValue;
  }
  return rawValue;
}

function calculateFeelMetrics(tuning, gameSession, simulation) {
  const normalizedSimulation = normalizeSimulation(simulation);
  const fps = normalizedSimulation.fps;
  const delta = 1 / fps;
  const targetSpeed = tuning.max_speed * normalizedSimulation.target_speed_ratio;
  const normalDifficulty = gameSession.difficulty_profiles.normal ?? {};

  return {
    jump_apex_frames: simulateJumpApexFrames(tuning, delta, normalizedSimulation.max_seconds),
    jump_height_px: roundMetric(simulateJumpHeight(tuning, delta, normalizedSimulation.max_seconds)),
    landing_frames: simulateLandingFrames(tuning, delta, normalizedSimulation.max_seconds),
    coyote_time_frames: Math.floor((tuning.coyote_time_ms / 1000) * fps),
    jump_buffer_frames: Math.floor((tuning.jump_buffer_ms / 1000) * fps),
    hover_max_fall_speed: tuning.hover_max_fall_speed,
    acceleration_frames: Math.ceil(targetSpeed / (tuning.ground_accel * delta)),
    stop_frames: Math.ceil((tuning.max_speed - tuning.max_speed * (1 - normalizedSimulation.target_speed_ratio)) / (tuning.ground_decel * delta)),
    turn_frames: Math.ceil((tuning.max_speed + targetSpeed) / (tuning.ground_accel * delta)),
    attack_latency_frames: 0,
    spark_dash_distance_px: roundMetric(Number(gameSession.ability_profiles.spark?.movement_impulse ?? 0)),
    damage_recovery_frames: Math.round((Number(normalDifficulty.player_invulnerability_ms ?? gameSession.player_invulnerability_ms) / 1000) * fps),
  };
}

function normalizeSimulation(simulation) {
  return {
    fps: Number(simulation.fps ?? 60),
    max_seconds: Number(simulation.max_seconds ?? 4),
    target_speed_ratio: Number(simulation.target_speed_ratio ?? 0.95),
  };
}

function simulateJumpApexFrames(tuning, delta, maxSeconds) {
  let velocityY = -tuning.jump_velocity;
  const maxFrames = Math.ceil(maxSeconds / delta);
  for (let frame = 1; frame <= maxFrames; frame += 1) {
    velocityY += tuning.gravity_up * delta;
    if (velocityY >= 0) {
      return frame;
    }
  }
  return maxFrames;
}

function simulateJumpHeight(tuning, delta, maxSeconds) {
  let velocityY = -tuning.jump_velocity;
  let positionY = 0;
  let minimumY = 0;
  const maxFrames = Math.ceil(maxSeconds / delta);
  for (let frame = 1; frame <= maxFrames; frame += 1) {
    positionY += velocityY * delta;
    minimumY = Math.min(minimumY, positionY);
    velocityY += tuning.gravity_up * delta;
    if (velocityY >= 0) {
      break;
    }
  }
  return Math.abs(minimumY);
}

function simulateLandingFrames(tuning, delta, maxSeconds) {
  let velocityY = -tuning.jump_velocity;
  let positionY = 0;
  const maxFrames = Math.ceil(maxSeconds / delta);
  for (let frame = 1; frame <= maxFrames; frame += 1) {
    positionY += velocityY * delta;
    velocityY += (velocityY < 0 ? tuning.gravity_up : tuning.gravity_down) * delta;
    if (positionY >= 0 && frame > 1) {
      return frame;
    }
  }
  return maxFrames;
}

function checkMetricRanges(contract, metrics) {
  const failedChecks = [];
  for (const [metric, range] of Object.entries(contract.metrics ?? {})) {
    const value = metrics[metric];
    if (value === undefined) {
      failedChecks.push({
        rule: 'metric_range',
        metric,
        message: `${metric} is missing from feel metrics output`,
      });
      continue;
    }
    const minimum = Number(range.min ?? -Infinity);
    const maximum = Number(range.max ?? Infinity);
    if (value < minimum || value > maximum) {
      failedChecks.push({
        rule: 'metric_range',
        metric,
        value,
        expected_min: minimum,
        expected_max: maximum,
        message: `${metric}=${value} is outside ${minimum}-${maximum}`,
      });
    }
  }
  return failedChecks;
}

function roundMetric(value) {
  return Number(value.toFixed(3));
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}
