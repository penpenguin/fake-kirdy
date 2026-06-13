import { readFileSync } from 'node:fs';

const inputPath = process.argv[2];

if (!inputPath) {
  console.error('Usage: npm run trace:summary -- <trace.json|trace.ndjson>');
  process.exit(1);
}

const raw = readFileSync(inputPath, 'utf8').trim();
const events = parseTrace(raw);
const countsByType = {};
const levels = new Set();
const collectiblesCollected = new Set();
const itemsCollected = new Set();
const abilitiesAcquired = new Set();
const abilitiesUsed = new Set();
const enemiesDefeated = new Set();
const completedLevels = new Set();
const visitedLevelIds = new Set();
const unlockedDoorIds = new Set();
const defeatedEnemyGroupIds = new Set();
const defeatedBossIds = new Set();
const doorLockReasons = new Set();
const hazardsEntered = new Set();
const abilityGatesOpened = new Set();
const exploredTilesByLevel = new Map();
const playerMotion = createPlayerMotion();
let firstFrame = null;
let lastFrame = null;
let lastPlayerPosition = null;
let lastAbilityType = null;
let lastSettings = null;
let lastInventory = null;
let lastPlayerReviveCount = null;
let lastHud = null;
let lastResultOverlay = null;
let lastResultsScene = null;
let lastRuntimeError = null;
let maxTimeMs = 0;
let outcome = 'unknown';

for (const event of events) {
  const eventType = String(event.event_type ?? 'unknown');
  countsByType[eventType] = (countsByType[eventType] ?? 0) + 1;

  if (event.level_id) {
    levels.add(String(event.level_id));
  }

  addPlayerMotionSample(playerMotion, event.player);

  if (Number.isFinite(event.frame)) {
    firstFrame = firstFrame === null ? event.frame : Math.min(firstFrame, event.frame);
    lastFrame = lastFrame === null ? event.frame : Math.max(lastFrame, event.frame);
  }

  if (Number.isFinite(event.time_ms)) {
    maxTimeMs = Math.max(maxTimeMs, event.time_ms);
  }

  if (eventType === 'run.finished') {
    outcome = String(event.payload?.outcome ?? event.payload?.result_label ?? 'finished');
    if (outcome === 'complete' || outcome === 'completed') {
      addEventString(completedLevels, event, 'level_id');
    }
  }

  if (eventType === 'collectible.collected') {
    addPayloadString(collectiblesCollected, event, 'collectible_id');
    addPayloadString(itemsCollected, event, 'item_id');
  }

  if (eventType === 'item.acquired') {
    addPayloadString(itemsCollected, event, 'item_id');
  }

  if (
    eventType === 'save.loaded' ||
    eventType === 'save.written' ||
    eventType === 'map.updated' ||
    eventType === 'inventory.updated'
  ) {
    addPayloadStringArray(itemsCollected, event, 'items_collected');
    addPayloadStringArray(completedLevels, event, 'completed_level_ids');
    addPayloadStringArray(visitedLevelIds, event, 'visited_level_ids');
    addPayloadStringArray(unlockedDoorIds, event, 'unlocked_door_ids');
    addPayloadStringArray(defeatedEnemyGroupIds, event, 'defeated_enemy_group_ids');
    addPayloadStringArray(defeatedBossIds, event, 'defeated_boss_ids');
    addPayloadStringArray(abilityGatesOpened, event, 'opened_ability_gate_ids');
    addExploredTiles(exploredTilesByLevel, event.payload?.explored_tiles);
    const position = parsePosition(event.payload?.player_position);
    if (position !== null) {
      lastPlayerPosition = position;
    }
    const abilityType = parseString(event.payload?.ability_type);
    if (abilityType !== null) {
      lastAbilityType = abilityType;
    }
    const settings = parseSettings(event.payload?.settings);
    if (settings !== null) {
      lastSettings = settings;
    }
    const reviveCount = parseNonNegativeInteger(event.payload?.player_revive_count);
    if (reviveCount !== null) {
      lastPlayerReviveCount = reviveCount;
    }
  }

  if (eventType === 'door.entered') {
    addPayloadString(unlockedDoorIds, event, 'unlocked_door_id');
  }

  if (eventType === 'door.locked') {
    addPayloadString(doorLockReasons, event, 'reason');
  }

  if (eventType === 'hazard.entered') {
    addPayloadString(hazardsEntered, event, 'hazard_id');
  }

  if (eventType === 'ability_gate.opened') {
    addPayloadString(abilityGatesOpened, event, 'gate_id');
    addPayloadStringArray(abilityGatesOpened, event, 'opened_ability_gate_ids');
  }

  if (eventType === 'hud.updated') {
    const hud = parseHud(event.payload);
    if (hud !== null) {
      lastHud = hud;
    }
  }

  if (eventType === 'settings.updated') {
    const settings = parseSettings(event.payload);
    if (settings !== null) {
      lastSettings = settings;
    }
  }

  if (eventType === 'inventory.updated') {
    const inventory = parseInventory(event.payload);
    if (inventory !== null) {
      lastInventory = inventory;
    }
  }

  if (eventType === 'result.overlay.shown') {
    const resultOverlay = parseResultOverlay(event.payload);
    if (resultOverlay !== null) {
      lastResultOverlay = resultOverlay;
    }
  }

  if (eventType === 'results.scene.shown') {
    const resultsScene = parseResultOverlay(event.payload);
    if (resultsScene !== null) {
      lastResultsScene = resultsScene;
    }
  }

  if (eventType === 'runtime.error.shown') {
    const runtimeError = parseRuntimeError(event.payload);
    if (runtimeError !== null) {
      lastRuntimeError = runtimeError;
    }
  }

  if (eventType === 'ability.acquired') {
    addPayloadString(abilitiesAcquired, event, 'ability_type');
  }

  if (eventType === 'ability.used') {
    addPayloadString(abilitiesUsed, event, 'ability_type');
  }

  if (eventType === 'enemy.defeated') {
    addPayloadString(enemiesDefeated, event, 'enemy_id');
    addPayloadString(defeatedEnemyGroupIds, event, 'enemy_group_id');
    addPayloadString(defeatedBossIds, event, 'boss_id');
  }

  if (eventType === 'replay.error') {
    outcome = 'error';
  }
}

const summary = {
  event_count: events.length,
  levels: [...levels].sort(),
  first_frame: firstFrame,
  last_frame: lastFrame,
  duration_ms: maxTimeMs,
  outcome,
  counts_by_type: countsByType,
  collectibles_collected: [...collectiblesCollected].sort(),
  items_collected: [...itemsCollected].sort(),
  abilities_acquired: [...abilitiesAcquired].sort(),
  abilities_used: [...abilitiesUsed].sort(),
  enemies_defeated: [...enemiesDefeated].sort(),
  completed_levels: [...completedLevels].sort(),
  visited_level_ids: [...visitedLevelIds].sort(),
  unlocked_door_ids: [...unlockedDoorIds].sort(),
  defeated_enemy_group_ids: [...defeatedEnemyGroupIds].sort(),
  defeated_boss_ids: [...defeatedBossIds].sort(),
  door_lock_reasons: [...doorLockReasons].sort(),
  hazards_entered: [...hazardsEntered].sort(),
  ability_gates_opened: [...abilityGatesOpened].sort(),
  explored_tiles_by_level: serializeExploredTiles(exploredTilesByLevel),
  explored_tile_count: countExploredTiles(exploredTilesByLevel),
  player_motion: serializePlayerMotion(playerMotion),
  last_player_position: lastPlayerPosition,
  last_ability_type: lastAbilityType,
  last_settings: lastSettings,
  last_inventory: lastInventory,
  last_player_revive_count: lastPlayerReviveCount,
  last_hud: lastHud,
  last_result_overlay: lastResultOverlay,
  last_results_scene: lastResultsScene,
  last_runtime_error: lastRuntimeError,
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

function parseTrace(rawText) {
  if (rawText.length === 0) {
    return [];
  }

  if (rawText.startsWith('[')) {
    const parsed = JSON.parse(rawText);
    if (!Array.isArray(parsed)) {
      throw new Error('Trace JSON must be an array');
    }
    return parsed;
  }

  return rawText
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

function addPayloadString(target, event, fieldName) {
  const value = event.payload?.[fieldName];
  if (typeof value === 'string' && value.length > 0) {
    target.add(value);
  }
}

function addEventString(target, event, fieldName) {
  const value = event?.[fieldName];
  if (typeof value === 'string' && value.length > 0) {
    target.add(value);
  }
}

function addPayloadStringArray(target, event, fieldName) {
  const values = event.payload?.[fieldName];
  if (!Array.isArray(values)) {
    return;
  }

  for (const value of values) {
    if (typeof value === 'string' && value.length > 0) {
      target.add(value);
    }
  }
}

function parsePosition(value) {
  if (
    value === null ||
    typeof value !== 'object' ||
    !Number.isFinite(value.x) ||
    !Number.isFinite(value.y)
  ) {
    return null;
  }

  return {
    x: value.x,
    y: value.y,
  };
}

function parseVelocity(value) {
  return parsePosition(value);
}

function parseString(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }

  return value;
}

function parseNonNegativeInteger(value) {
  if (!Number.isInteger(value) || value < 0) {
    return null;
  }

  return value;
}

function parseSettings(value) {
  if (
    value === null ||
    typeof value !== 'object' ||
    !Number.isFinite(value.volume) ||
    typeof value.controls !== 'string' ||
    value.controls.length === 0 ||
    typeof value.difficulty !== 'string' ||
    value.difficulty.length === 0
  ) {
    return null;
  }

  return {
    volume: value.volume,
    controls: value.controls,
    difficulty: value.difficulty,
  };
}

function parseInventory(value) {
  if (
    value === null ||
    typeof value !== 'object' ||
    typeof value.ability_type !== 'string' ||
    !Array.isArray(value.items_collected) ||
    !Array.isArray(value.completed_level_ids) ||
    !Array.isArray(value.visited_level_ids) ||
    !Array.isArray(value.unlocked_door_ids)
  ) {
    return null;
  }

  return {
    ability_type: value.ability_type,
    items_collected: normalizeStringArray(value.items_collected),
    completed_level_ids: normalizeStringArray(value.completed_level_ids),
    visited_level_ids: normalizeStringArray(value.visited_level_ids),
    unlocked_door_ids: normalizeStringArray(value.unlocked_door_ids),
  };
}

function normalizeStringArray(values) {
  return values.filter((value) => typeof value === 'string' && value.length > 0).sort();
}

function parseHud(value) {
  if (
    value === null ||
    typeof value !== 'object' ||
    typeof value.level_id !== 'string' ||
    !Number.isInteger(value.hp) ||
    !Number.isInteger(value.max_hp) ||
    !Number.isInteger(value.revive_count) ||
    typeof value.ability_type !== 'string' ||
    !Array.isArray(value.items_collected) ||
    typeof value.outcome !== 'string'
  ) {
    return null;
  }

  return {
    level_id: value.level_id,
    hp: value.hp,
    max_hp: value.max_hp,
    revive_count: value.revive_count,
    ability_type: value.ability_type,
    items_collected: value.items_collected.filter((item) => typeof item === 'string').sort(),
    score: Number.isInteger(value.score) ? value.score : undefined,
    remaining_life_bonus: Number.isInteger(value.remaining_life_bonus) ? value.remaining_life_bonus : undefined,
    difficulty: typeof value.difficulty === 'string' ? value.difficulty : undefined,
    target_enemy_hp: Number.isInteger(value.target_enemy_hp) ? value.target_enemy_hp : undefined,
    ability_cooldown_ms: Number.isInteger(value.ability_cooldown_ms) ? value.ability_cooldown_ms : undefined,
    locked_door_reason: typeof value.locked_door_reason === 'string' ? value.locked_door_reason : undefined,
    outcome: value.outcome,
  };
}

function parseResultOverlay(value) {
  if (
    value === null ||
    typeof value !== 'object' ||
    typeof value.level_id !== 'string' ||
    typeof value.outcome !== 'string' ||
    !Number.isInteger(value.time_ms) ||
    !Number.isInteger(value.frames) ||
    !Array.isArray(value.items_collected) ||
    !Array.isArray(value.completed_level_ids)
  ) {
    return null;
  }

  return {
    level_id: value.level_id,
    outcome: value.outcome,
    time_ms: value.time_ms,
    frames: value.frames,
    items_collected: value.items_collected.filter((item) => typeof item === 'string').sort(),
    completed_level_ids: value.completed_level_ids.filter((levelId) => typeof levelId === 'string').sort(),
    score: Number.isInteger(value.score) ? value.score : undefined,
    remaining_life_bonus: Number.isInteger(value.remaining_life_bonus) ? value.remaining_life_bonus : undefined,
    result_elapsed_ms: Number.isInteger(value.result_elapsed_ms) ? value.result_elapsed_ms : undefined,
    auto_delay_ms: Number.isInteger(value.auto_delay_ms) ? value.auto_delay_ms : undefined,
  };
}

function parseRuntimeError(value) {
  if (
    value === null ||
    typeof value !== 'object' ||
    typeof value.message !== 'string' ||
    value.message.length === 0 ||
    typeof value.outcome !== 'string'
  ) {
    return null;
  }

  return {
    level_id: typeof value.level_id === 'string' ? value.level_id : '',
    requested_level_id: typeof value.requested_level_id === 'string' ? value.requested_level_id : '',
    requested_spawn_id: typeof value.requested_spawn_id === 'string' ? value.requested_spawn_id : '',
    outcome: value.outcome,
    reason: typeof value.reason === 'string' ? value.reason : '',
    message: value.message,
    retry_available: value.retry_available === true,
    retry_action: typeof value.retry_action === 'string' ? value.retry_action : '',
  };
}

function addExploredTiles(target, value) {
  if (value === null || typeof value !== 'object') {
    return;
  }

  for (const [levelId, tiles] of Object.entries(value)) {
    if (typeof levelId !== 'string' || levelId.length === 0 || !Array.isArray(tiles)) {
      continue;
    }

    if (!target.has(levelId)) {
      target.set(levelId, new Set());
    }

    const levelTiles = target.get(levelId);
    for (const tile of tiles) {
      if (typeof tile === 'string' && /^\d+,\d+$/.test(tile)) {
        levelTiles.add(tile);
      }
    }
  }
}

function serializeExploredTiles(source) {
  const serialized = {};
  for (const levelId of [...source.keys()].sort()) {
    const tiles = [...source.get(levelId)].sort();
    if (tiles.length > 0) {
      serialized[levelId] = tiles;
    }
  }
  return serialized;
}

function countExploredTiles(source) {
  let count = 0;
  for (const tiles of source.values()) {
    count += tiles.size;
  }
  return count;
}

function createPlayerMotion() {
  return {
    sampleCount: 0,
    minPositionX: null,
    minPositionY: null,
    maxPositionX: null,
    maxPositionY: null,
    maxAbsVelocityX: 0,
    maxAbsVelocityY: 0,
    maxFallSpeed: 0,
    maxRiseSpeed: 0,
  };
}

function addPlayerMotionSample(target, player) {
  if (player === null || typeof player !== 'object') {
    return;
  }

  const position = parsePosition(player.position);
  const velocity = parseVelocity(player.velocity);
  if (position === null && velocity === null) {
    return;
  }

  target.sampleCount += 1;

  if (position !== null) {
    target.minPositionX = target.minPositionX === null ? position.x : Math.min(target.minPositionX, position.x);
    target.minPositionY = target.minPositionY === null ? position.y : Math.min(target.minPositionY, position.y);
    target.maxPositionX = target.maxPositionX === null ? position.x : Math.max(target.maxPositionX, position.x);
    target.maxPositionY = target.maxPositionY === null ? position.y : Math.max(target.maxPositionY, position.y);
  }

  if (velocity !== null) {
    target.maxAbsVelocityX = Math.max(target.maxAbsVelocityX, Math.abs(velocity.x));
    target.maxAbsVelocityY = Math.max(target.maxAbsVelocityY, Math.abs(velocity.y));
    target.maxFallSpeed = Math.max(target.maxFallSpeed, velocity.y);
    target.maxRiseSpeed = Math.max(target.maxRiseSpeed, -velocity.y);
  }
}

function serializePlayerMotion(source) {
  if (source.sampleCount === 0) {
    return {
      sample_count: 0,
      min_position: null,
      max_position: null,
      max_abs_velocity: {
        x: 0,
        y: 0,
      },
      max_fall_speed: 0,
      max_rise_speed: 0,
    };
  }

  return {
    sample_count: source.sampleCount,
    min_position: {
      x: source.minPositionX,
      y: source.minPositionY,
    },
    max_position: {
      x: source.maxPositionX,
      y: source.maxPositionY,
    },
    max_abs_velocity: {
      x: source.maxAbsVelocityX,
      y: source.maxAbsVelocityY,
    },
    max_fall_speed: source.maxFallSpeed,
    max_rise_speed: source.maxRiseSpeed,
  };
}
