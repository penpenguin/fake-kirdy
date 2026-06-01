import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repoRoot = process.cwd();
const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const contractPath = resolvePath(readOption('--contract') ?? join('godot', 'tests', 'enemy_ai_arena_contract.json'));

try {
  const contract = loadJson(contractPath, 'enemy AI arena contract');
  const simpleEnemySource = readFileSync(resolvePath(requireString(contract.source_paths?.simple_enemy, 'source_paths.simple_enemy')), 'utf8');
  const gameSessionSource = readFileSync(resolvePath(requireString(contract.source_paths?.game_session, 'source_paths.game_session')), 'utf8');
  const enemyDefaults = extractExportDefaults(simpleEnemySource);
  const abilityProfiles = extractEnemyAbilityAiProfiles(gameSessionSource);
  const cases = requireArray(contract.cases, 'cases').map((testCase) =>
    simulateArenaCase(testCase, contract.arena_defaults ?? {}, enemyDefaults, abilityProfiles),
  );
  const failedChecks = [
    ...checkExpectedEvents(contract, cases),
    ...checkAbilityProfiles(contract, cases),
    ...checkMovementBounds(contract, cases),
    ...checkCooldowns(contract, cases),
  ];
  const report = {
    contract_path: contractPath,
    case_count: cases.length,
    profile_count: Object.keys(abilityProfiles).length,
    cases,
    failed_checks: failedChecks,
  };

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else if (failedChecks.length > 0) {
    console.error(`[godot:enemy-ai-arena] failed ${failedChecks.length} check(s).`);
    for (const check of failedChecks) {
      console.error(`[godot:enemy-ai-arena] ${check.rule} ${check.message}`);
    }
  } else {
    console.log(`[godot:enemy-ai-arena] passed ${cases.length} arena case(s).`);
  }

  process.exit(failedChecks.length > 0 ? 1 : 0);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (jsonOutput) {
    console.log(
      JSON.stringify(
        {
          contract_path: contractPath,
          case_count: 0,
          profile_count: 0,
          cases: [],
          failed_checks: [{ rule: 'runtime_error', message }],
        },
        null,
        2,
      ),
    );
  } else {
    console.error(`[godot:enemy-ai-arena] ${message}`);
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
    defaults[match[1]] = parseGdValue(match[2].trim());
  }
  return defaults;
}

function extractEnemyAbilityAiProfiles(sourceText) {
  const profiles = {};
  const bodyMatch = sourceText.match(/func get_enemy_ability_ai_profile\(ability_type: String\) -> Dictionary:([\s\S]*?)\n\nfunc /);
  if (!bodyMatch) {
    throw new Error('Unable to locate get_enemy_ability_ai_profile in GameSession.gd');
  }

  const casePattern = /\n {8}((?:"[^"]+"(?:,\s*"[^"]+")*)):\n {12}return \{([\s\S]*?)\n {12}\}/g;
  for (const match of bodyMatch[1].matchAll(casePattern)) {
    const aliases = Array.from(match[1].matchAll(/"([^"]+)"/g)).map((aliasMatch) => aliasMatch[1]);
    const profile = parseGdDictionary(match[2]);
    for (const alias of aliases) {
      profiles[alias] = profile;
    }
  }
  return profiles;
}

function parseGdDictionary(dictionaryText) {
  const profile = {};
  const entryPattern = /"([^"]+)":\s*([^,\n}]+)/g;
  for (const match of dictionaryText.matchAll(entryPattern)) {
    profile[match[1]] = parseGdValue(match[2].trim());
  }
  return profile;
}

function parseGdValue(rawValue) {
  if (rawValue === 'true') {
    return true;
  }
  if (rawValue === 'false') {
    return false;
  }
  if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
    return rawValue.slice(1, -1);
  }
  const vectorMatch = rawValue.match(/^Vector2\(([-0-9.]+),\s*([-0-9.]+)\)$/);
  if (vectorMatch) {
    return { x: Number(vectorMatch[1]), y: Number(vectorMatch[2]) };
  }
  const numericValue = Number(rawValue);
  if (!Number.isNaN(numericValue)) {
    return numericValue;
  }
  return rawValue;
}

function simulateArenaCase(testCase, arenaDefaults, enemyDefaults, abilityProfiles) {
  const id = requireString(testCase.id, 'case.id');
  const abilityType = requireString(testCase.ability_type, `${id}.ability_type`);
  const enemyType = requireString(testCase.enemy_type, `${id}.enemy_type`);
  const appliedProfile = abilityProfiles[abilityType] ?? {};
  const enemy = buildEnemyState(testCase, arenaDefaults, enemyDefaults, appliedProfile);
  const events = [];
  const deltaSeconds = Number(arenaDefaults.delta_ms ?? 100) / 1000;

  if (Object.keys(appliedProfile).length > 0) {
    record(events, 'enemy.ai.profile.applied', enemy, { profile: appliedProfile });
  }

  if (enemyType.includes('flying')) {
    record(events, 'enemy.ai.hover', enemy, {
      hover_amplitude: Number(testCase.hover_amplitude ?? appliedProfile.hover_amplitude ?? 18),
      hover_speed: Number(testCase.hover_speed ?? appliedProfile.hover_speed ?? 2.4),
    });
  }

  if (enemy.patrol_radius > 0) {
    enemy.state = 'enemy.patrolling';
    const patrolStep = Math.min(enemy.patrol_radius, enemy.patrol_speed * deltaSeconds);
    enemy.position.x = enemy.spawn_position.x + patrolStep;
    record(events, 'enemy.ai.patrol', enemy, {
      patrol_radius: enemy.patrol_radius,
      patrol_speed: enemy.patrol_speed,
      distance_from_spawn: Math.abs(enemy.position.x - enemy.spawn_position.x),
    });
  }

  const nearDistance = Number(testCase.player_near_distance ?? arenaDefaults.player_near_distance ?? 64);
  enemy.player_position = { x: enemy.position.x + nearDistance, y: enemy.position.y };
  if (nearDistance <= enemy.detection_radius) {
    const previousState = enemy.state;
    enemy.state = 'enemy.chasing';
    record(events, 'enemy.ai.detected', enemy, {
      previous_state: previousState,
      detection_radius: enemy.detection_radius,
      player_distance: nearDistance,
    });
    enemy.position.x += Math.sign(enemy.player_position.x - enemy.position.x) * enemy.chase_speed * deltaSeconds;
    record(events, 'enemy.ai.chase', enemy, {
      chase_speed: enemy.chase_speed,
      player_distance: distance(enemy.position, enemy.player_position),
    });
  }

  if (distance(enemy.position, enemy.player_position) <= enemy.attack_radius) {
    record(events, 'enemy.attack.started', enemy, {
      attack_damage: enemy.attack_damage,
      attack_radius: enemy.attack_radius,
      attack_cooldown_ms: enemy.attack_cooldown_ms,
    });
    enemy.attack_cooldown_remaining_ms = enemy.attack_cooldown_ms;
    record(events, 'enemy.attack.cooldown', enemy, {
      attack_cooldown_remaining_ms: enemy.attack_cooldown_remaining_ms,
    });
  }

  const farDistance = Number(testCase.player_far_distance ?? arenaDefaults.player_far_distance ?? 420);
  if (enemy.state === 'enemy.chasing' && farDistance > enemy.return_radius) {
    enemy.player_position = { x: enemy.spawn_position.x + farDistance, y: enemy.spawn_position.y };
    enemy.state = 'enemy.returning';
    enemy.position.x += Math.sign(enemy.spawn_position.x - enemy.position.x) * enemy.patrol_speed * deltaSeconds;
    record(events, 'enemy.ai.return', enemy, {
      return_radius: enemy.return_radius,
      player_distance: farDistance,
    });
  }

  const damagePerHit = Number(testCase.damage_per_hit ?? arenaDefaults.damage_per_hit ?? 1);
  let hitIndex = 0;
  while (enemy.hp > 0 && damagePerHit > 0 && hitIndex < 20) {
    const previousHp = enemy.hp;
    enemy.hp = Math.max(enemy.hp - damagePerHit, 0);
    hitIndex += 1;
    record(events, 'enemy.hurt', enemy, {
      damage: damagePerHit,
      enemy_hp_before: previousHp,
      enemy_hp_after: enemy.hp,
    });
    if (enemy.hp <= 0) {
      enemy.state = 'enemy.defeated';
      record(events, 'enemy.defeated', enemy, {
        hit_count: hitIndex,
      });
    }
  }

  return {
    id,
    enemy_type: enemyType,
    ability_type: abilityType,
    applied_profile: appliedProfile,
    expected_profile: testCase.expected_profile ?? {},
    expected_events: requireOptionalArray(testCase.expected_events, `${id}.expected_events`),
    movement_bounds: testCase.movement_bounds ?? {},
    final_state: enemy.state,
    final_position: enemy.position,
    events,
  };
}

function buildEnemyState(testCase, arenaDefaults, enemyDefaults, appliedProfile) {
  const attackCooldownMultiplier = Number(appliedProfile.attack_cooldown_multiplier ?? 1);
  return {
    state: 'enemy.idle',
    hp: Number(testCase.max_hp ?? enemyDefaults.max_hp ?? 2),
    max_hp: Number(testCase.max_hp ?? enemyDefaults.max_hp ?? 2),
    patrol_radius: Number(testCase.patrol_radius ?? enemyDefaults.patrol_radius ?? 0),
    patrol_speed: Number(testCase.patrol_speed ?? enemyDefaults.patrol_speed ?? 42),
    chase_speed: Number(testCase.chase_speed ?? appliedProfile.chase_speed ?? enemyDefaults.chase_speed ?? 72),
    detection_radius: Number(testCase.detection_radius ?? appliedProfile.detection_radius ?? enemyDefaults.detection_radius ?? 180),
    return_radius: Number(testCase.return_radius ?? appliedProfile.return_radius ?? enemyDefaults.return_radius ?? 260),
    attack_damage: Number(testCase.attack_damage ?? enemyDefaults.attack_damage ?? 1),
    attack_radius: Number(testCase.attack_radius ?? enemyDefaults.attack_radius ?? 120),
    attack_cooldown_ms: Math.max(
      Math.round(Number(testCase.attack_cooldown_ms ?? enemyDefaults.attack_cooldown_ms ?? 1200) * attackCooldownMultiplier),
      120,
    ),
    attack_cooldown_remaining_ms: 0,
    spawn_position: { x: Number(arenaDefaults.spawn_x ?? 0), y: Number(arenaDefaults.spawn_y ?? 0) },
    position: { x: Number(arenaDefaults.spawn_x ?? 0), y: Number(arenaDefaults.spawn_y ?? 0) },
    player_position: { x: Number(arenaDefaults.player_far_distance ?? 420), y: 0 },
  };
}

function record(events, eventType, enemy, payload = {}) {
  events.push({
    frame: events.length,
    event_type: eventType,
    enemy_state: enemy.state,
    position: { ...enemy.position },
    payload,
  });
}

function checkExpectedEvents(contract, cases) {
  if (!isErrorRuleEnabled(contract, 'expected_events')) {
    return [];
  }
  const failedChecks = [];
  for (const testCase of cases) {
    const eventTypes = testCase.events.map((event) => event.event_type);
    for (const expectedEvent of testCase.expected_events) {
      if (!eventTypes.includes(expectedEvent)) {
        failedChecks.push({
          rule: 'expected_events',
          case_id: testCase.id,
          message: `${testCase.id} did not emit expected event ${expectedEvent}`,
        });
      }
    }
  }
  return failedChecks;
}

function checkAbilityProfiles(contract, cases) {
  if (!isErrorRuleEnabled(contract, 'ability_profile_applied')) {
    return [];
  }
  const failedChecks = [];
  for (const testCase of cases) {
    for (const [key, expectedValue] of Object.entries(testCase.expected_profile ?? {})) {
      if (testCase.applied_profile?.[key] !== expectedValue) {
        failedChecks.push({
          rule: 'ability_profile_applied',
          case_id: testCase.id,
          message: `${testCase.id} expected profile ${key}=${expectedValue}, got ${testCase.applied_profile?.[key] ?? '<missing>'}`,
        });
      }
    }
  }
  return failedChecks;
}

function checkMovementBounds(contract, cases) {
  if (!isErrorRuleEnabled(contract, 'movement_bounds')) {
    return [];
  }
  const failedChecks = [];
  for (const testCase of cases) {
    const patrolEvent = testCase.events.find((event) => event.event_type === 'enemy.ai.patrol');
    const maxPatrolDistance = Number(testCase.movement_bounds.max_patrol_distance ?? Infinity);
    if (patrolEvent !== undefined && Math.abs(patrolEvent.payload.distance_from_spawn) > maxPatrolDistance) {
      failedChecks.push({
        rule: 'movement_bounds',
        case_id: testCase.id,
        message: `${testCase.id} patrol distance ${patrolEvent.payload.distance_from_spawn} exceeds ${maxPatrolDistance}`,
      });
    }

    const hoverEvent = testCase.events.find((event) => event.event_type === 'enemy.ai.hover');
    const maxHoverAmplitude = Number(testCase.movement_bounds.max_hover_amplitude ?? Infinity);
    if (hoverEvent !== undefined && Number(hoverEvent.payload.hover_amplitude) > maxHoverAmplitude) {
      failedChecks.push({
        rule: 'movement_bounds',
        case_id: testCase.id,
        message: `${testCase.id} hover amplitude ${hoverEvent.payload.hover_amplitude} exceeds ${maxHoverAmplitude}`,
      });
    }
  }
  return failedChecks;
}

function checkCooldowns(contract, cases) {
  if (!isErrorRuleEnabled(contract, 'cooldown_after_attack')) {
    return [];
  }
  const failedChecks = [];
  for (const testCase of cases) {
    const attackEvent = testCase.events.find((event) => event.event_type === 'enemy.attack.started');
    if (attackEvent === undefined) {
      continue;
    }
    const cooldownEvent = testCase.events.find((event) => event.event_type === 'enemy.attack.cooldown');
    if (cooldownEvent === undefined || Number(cooldownEvent.payload.attack_cooldown_remaining_ms) <= 0) {
      failedChecks.push({
        rule: 'cooldown_after_attack',
        case_id: testCase.id,
        message: `${testCase.id} attacked without entering cooldown`,
      });
    }
  }
  return failedChecks;
}

function distance(left, right) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function isErrorRuleEnabled(contract, ruleName) {
  return String(contract.rules?.[ruleName]?.severity ?? 'error') === 'error';
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
