import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repoRoot = process.cwd();
const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const detailedOutput = args.includes('--details');
const contractPath = resolvePath(readOption('--contract') ?? join('godot', 'tests', 'content_budget_contract.json'));

try {
  const contract = loadJson(contractPath, 'content budget contract');
  const catalogPath = resolvePath(requireString(contract.source_paths?.catalog_source, 'source_paths.catalog_source'));
  const proceduralPath = resolvePath(requireString(contract.source_paths?.procedural_levels, 'source_paths.procedural_levels'));
  const catalog = loadJson(catalogPath, 'level catalog source');
  const proceduralLevels = loadJson(proceduralPath, 'procedural levels');
  const sceneLevels = buildSceneLevelReports(contract, catalog);
  const generatedLevels = buildGeneratedLevelReports(contract, proceduralLevels);
  const levels = [...sceneLevels, ...generatedLevels].sort((left, right) => left.id.localeCompare(right.id));
  const failedChecks = [
    ...checkRequiredMetrics(contract, levels),
    ...checkProfiles(contract, levels),
  ];
  const includeLevelDetails = detailedOutput || levels.length <= 50 || failedChecks.length > 0;
  const report = {
    contract_path: contractPath,
    source_paths: {
      catalog_source: catalogPath,
      procedural_levels: proceduralPath,
    },
    level_count: levels.length,
    profile_counts: buildProfileCounts(levels),
    levels: includeLevelDetails ? levels : [],
    failed_checks: failedChecks,
  };

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else if (failedChecks.length > 0) {
    console.error(`[godot:content-budget] failed ${failedChecks.length} check(s).`);
    for (const check of failedChecks) {
      console.error(`[godot:content-budget] ${check.level_id} ${check.rule} ${check.message}`);
    }
  } else {
    console.log(`[godot:content-budget] passed ${levels.length} level content budget(s).`);
  }

  process.exit(failedChecks.length > 0 ? 1 : 0);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (jsonOutput) {
    console.log(
      JSON.stringify(
        {
          contract_path: contractPath,
          level_count: 0,
          profile_counts: {},
          levels: [],
          failed_checks: [{ rule: 'runtime_error', message }],
        },
        null,
        2,
      ),
    );
  } else {
    console.error(`[godot:content-budget] ${message}`);
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
  if (path.startsWith('res://')) {
    return resolve(repoRoot, 'godot', path.slice('res://'.length));
  }
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

function buildSceneLevelReports(contract, catalog) {
  const levels = requireArray(catalog.levels, 'catalog.levels');
  const includeStatuses = new Set(requireOptionalArray(contract.include_coverage_statuses, 'include_coverage_statuses').map(String));
  return levels
    .filter((level) => includeStatuses.size === 0 || includeStatuses.has(String(level.coverage_status ?? '')))
    .map((level) => buildSceneLevelReport(contract, level));
}

function buildSceneLevelReport(contract, level) {
  const id = requireString(level.id, 'level.id');
  const scenePath = resolvePath(requireString(level.scene_path, `${id}.scene_path`));
  const sceneText = readFileSync(scenePath, 'utf8');
  const nodes = parseTscnNodes(sceneText);
  const extResources = parseExtResources(sceneText);
  const subResourceSizes = parseRectangleShapeSizes(sceneText);
  const markers = nodes.map((node) => ({
    ...node,
    script_path: extResources.get(String(node.props.script ?? '')) ?? '',
  }));
  const pacing = markers.find((marker) => marker.script_path.endsWith('/LevelPacingMarker.gd'));
  const profile = inferSceneProfile(contract, level, pacing);
  const room = getSceneRoom(markers);
  const metrics = calculateSceneMetrics(markers, subResourceSizes, pacing, room);
  return {
    id,
    source_type: 'scene',
    path: repoRelative(scenePath),
    profile,
    tags: requireOptionalArray(level.tags, `${id}.tags`).map(String),
    metrics,
  };
}

function inferSceneProfile(contract, level, pacing) {
  const pacingProfile = stringValue(pacing?.props?.pacing_profile ?? '');
  if (pacingProfile !== '') {
    return pacingProfile;
  }

  const profileByTag = contract.catalog_profile_by_tag ?? {};
  for (const tag of requireOptionalArray(level.tags, `${level.id}.tags`)) {
    const profile = profileByTag[String(tag)];
    if (typeof profile === 'string' && profile !== '') {
      return profile;
    }
  }
  return 'branch';
}

function calculateSceneMetrics(markers, subResourceSizes, pacing, room) {
  const spawns = markers.filter((marker) => marker.script_path.endsWith('/PlayerSpawn.gd'));
  const doors = markers.filter((marker) => marker.script_path.endsWith('/DoorMarker.gd'));
  const enemies = markers.filter((marker) => marker.script_path.endsWith('/EnemySpawnMarker.gd'));
  const heals = markers.filter((marker) => marker.script_path.endsWith('/HealMarker.gd'));
  const collectibles = markers.filter((marker) => marker.script_path.endsWith('/CollectibleMarker.gd'));
  const hazards = markers.filter((marker) => marker.script_path.endsWith('/HazardMarker.gd'));
  const abilityGates = markers.filter((marker) => marker.script_path.endsWith('/AbilityGateMarker.gd'));
  const goals = markers.filter((marker) => marker.script_path.endsWith('/GoalDoorController.gd') || marker.script_path.endsWith('/GoalMarker.gd'));
  const platformCount = countScenePlatforms(markers, subResourceSizes);
  const roomArea = Math.max(room.width * room.height, 1);
  const positions = [...spawns, ...doors, ...enemies, ...heals, ...collectibles, ...hazards, ...abilityGates, ...goals]
    .map((marker) => marker.position)
    .filter(Boolean);

  return normalizeMetrics({
    room_width: room.width,
    room_height: room.height,
    room_area: roomArea,
    spawn_count: spawns.length,
    door_count: doors.length,
    enemy_count: enemies.length,
    enemy_density: enemies.length / roomArea,
    heal_count: heals.length,
    heal_amount: sum(heals.map((marker) => numberValue(marker.props.amount, 1))),
    collectible_count: collectibles.length,
    key_count: collectibles.filter((marker) => isKeyLike(marker.props.item_id ?? marker.props.collectible_id)).length,
    ability_gate_count: abilityGates.length,
    hazard_count: hazards.length,
    platform_count: platformCount,
    vertical_travel_px: calculateVerticalTravel(positions),
    hidden_count: [...collectibles, ...doors].filter((marker) => booleanValue(marker.props.hidden_until_discovered)).length,
    rest_stop_count: numberValue(pacing?.props?.rest_stop_count, 0),
    door_preview_spacing_px: numberValue(pacing?.props?.door_preview_spacing_px, calculateDoorPreviewSpacing(spawns, doors)),
    critical_path_px: numberValue(pacing?.props?.critical_path_px, estimateCriticalPath(spawns, doors, goals)),
    safe_spawn_radius: numberValue(pacing?.props?.safe_spawn_radius, 0),
    encounter_budget: numberValue(pacing?.props?.encounter_budget, 0),
    goal_count: goals.length,
    goal_distance_px: calculateNearestDistance(spawns, goals),
    collectible_visibility: stringValue(pacing?.props?.collectible_visibility ?? ''),
    content_score: calculateContentScore({
      enemies: enemies.length,
      heals: heals.length,
      collectibles: collectibles.length,
      hazards: hazards.length,
      abilityGates: abilityGates.length,
      goals: goals.length,
      platformCount,
      verticalTravel: calculateVerticalTravel(positions),
      restStops: numberValue(pacing?.props?.rest_stop_count, 0),
      hiddenCount: [...collectibles, ...doors].filter((marker) => booleanValue(marker.props.hidden_until_discovered)).length,
    }),
  });
}

function buildGeneratedLevelReports(contract, proceduralLevels) {
  return requireArray(proceduralLevels.levels, 'procedural.levels')
    .filter((level) => level.scene_strategy === 'generated_schema')
    .map((level) => buildGeneratedLevelReport(contract, level));
}

function buildGeneratedLevelReport(contract, level) {
  const id = requireString(level.id, 'generated.id');
  const layout = level.runtime_layout ?? {};
  const shapeProfile = String(layout.room?.shape_profile ?? 'branch_room');
  const profile = String(contract.generated_profile_by_shape?.[shapeProfile] ?? 'branch');
  return {
    id,
    source_type: 'generated_schema',
    path: 'godot/levels/generated/procedural_levels.json',
    profile,
    tags: [shapeProfile, String(level.metadata?.cluster ?? '')].filter(Boolean),
    metrics: calculateGeneratedMetrics(layout),
  };
}

function calculateGeneratedMetrics(layout) {
  const room = layout.room ?? {};
  const content = layout.content ?? {};
  const spawns = Object.values(layout.spawns ?? {});
  const doors = Object.values(layout.doors ?? {});
  const enemies = requireOptionalArray(content.enemies, 'content.enemies');
  const heals = requireOptionalArray(content.heals, 'content.heals');
  const collectibles = requireOptionalArray(content.collectibles, 'content.collectibles');
  const hazards = requireOptionalArray(content.hazards, 'content.hazards');
  const abilityGates = requireOptionalArray(content.ability_gates, 'content.ability_gates');
  const goals = requireOptionalArray(content.goals, 'content.goals');
  const floorSegments = requireOptionalArray(layout.floor_segments, 'layout.floor_segments');
  const platforms = requireOptionalArray(layout.platforms, 'layout.platforms');
  const roomWidth = Number(room.width ?? layout.camera_bounds?.size?.x ?? 0);
  const roomHeight = Number(room.height ?? layout.camera_bounds?.size?.y ?? 0);
  const roomArea = Math.max(roomWidth * roomHeight, 1);
  const positions = [...spawns, ...doors, ...enemies, ...heals, ...collectibles, ...hazards, ...abilityGates, ...goals]
    .map((entry) => entry.position ?? entry)
    .filter(Boolean);
  const verticalTravel = calculateVerticalTravel(positions);

  return normalizeMetrics({
    room_width: roomWidth,
    room_height: roomHeight,
    room_area: roomArea,
    spawn_count: spawns.length,
    door_count: doors.length,
    enemy_count: enemies.length,
    enemy_density: enemies.length / roomArea,
    heal_count: heals.length,
    heal_amount: sum(heals.map((heal) => Number(heal.amount ?? 1))),
    collectible_count: collectibles.length,
    key_count: collectibles.filter((collectible) => isKeyLike(collectible.item_id ?? collectible.collectible_id)).length,
    ability_gate_count: abilityGates.length,
    hazard_count: hazards.length,
    platform_count: floorSegments.length + platforms.length,
    vertical_travel_px: verticalTravel,
    hidden_count: [...collectibles, ...doors].filter((entry) => Boolean(entry.hidden_until_discovered)).length,
    rest_stop_count: heals.length,
    door_preview_spacing_px: calculateDoorPreviewSpacing(spawns, doors),
    critical_path_px: estimatePathFromPositions(spawns, [...doors, ...goals]),
    safe_spawn_radius: Number(layout.safety?.min_spawn_door_distance ?? 0),
    encounter_budget: enemies.length,
    goal_count: goals.length,
    goal_distance_px: calculateNearestDistance(spawns.map((position) => ({ position })), goals.map((goal) => ({ position: goal.position }))),
    collectible_visibility: collectibles.length > 0 ? 'critical_path' : '',
    content_score: calculateContentScore({
      enemies: enemies.length,
      heals: heals.length,
      collectibles: collectibles.length,
      hazards: hazards.length,
      abilityGates: abilityGates.length,
      goals: goals.length,
      platformCount: floorSegments.length + platforms.length,
      verticalTravel,
      restStops: heals.length,
      hiddenCount: [...collectibles, ...doors].filter((entry) => Boolean(entry.hidden_until_discovered)).length,
    }),
  });
}

function checkRequiredMetrics(contract, levels) {
  const failedChecks = [];
  for (const level of levels) {
    for (const metric of requireOptionalArray(contract.required_metrics, 'required_metrics')) {
      if (level.metrics[String(metric)] === undefined) {
        failedChecks.push({
          rule: 'missing_metric',
          level_id: level.id,
          profile: level.profile,
          metric,
          message: `${level.id} is missing metric ${metric}.`,
        });
      }
    }
  }
  return failedChecks;
}

function checkProfiles(contract, levels) {
  const failedChecks = [];
  const profiles = contract.profiles ?? {};
  for (const level of levels) {
    const profile = profiles[level.profile];
    if (profile === undefined) {
      failedChecks.push({
        rule: 'unknown_profile',
        level_id: level.id,
        profile: level.profile,
        metric: 'profile',
        message: `${level.id} uses unknown content budget profile ${level.profile}.`,
      });
      continue;
    }

    failedChecks.push(...checkProfileNumberRules('profile_min', level, profile.min ?? {}, (actual, expected) => actual >= expected));
    failedChecks.push(...checkProfileNumberRules('profile_max', level, profile.max ?? {}, (actual, expected) => actual <= expected));
    failedChecks.push(...checkProfileEqualsRules(level, profile.equals ?? {}));
  }
  return failedChecks;
}

function checkProfileNumberRules(rule, level, entries, predicate) {
  const failedChecks = [];
  for (const [metric, expected] of Object.entries(entries)) {
    const actual = Number(level.metrics[metric] ?? 0);
    const expectedNumber = Number(expected);
    if (!predicate(actual, expectedNumber)) {
      failedChecks.push({
        rule,
        level_id: level.id,
        profile: level.profile,
        metric,
        expected: expectedNumber,
        actual,
        message: `${metric}=${actual} does not satisfy ${rule} ${expectedNumber}.`,
      });
    }
  }
  return failedChecks;
}

function checkProfileEqualsRules(level, entries) {
  const failedChecks = [];
  for (const [metric, expected] of Object.entries(entries)) {
    const actual = level.metrics[metric] ?? '';
    if (actual !== expected) {
      failedChecks.push({
        rule: 'profile_equals',
        level_id: level.id,
        profile: level.profile,
        metric,
        expected,
        actual,
        message: `${metric}=${actual} does not equal ${expected}.`,
      });
    }
  }
  return failedChecks;
}

function parseExtResources(sceneText) {
  const resources = new Map();
  const pattern = /\[ext_resource[^\]]*path="([^"]+)"[^\]]*id="([^"]+)"[^\]]*\]/g;
  for (const match of sceneText.matchAll(pattern)) {
    resources.set(`ExtResource("${match[2]}")`, match[1]);
  }
  return resources;
}

function parseRectangleShapeSizes(sceneText) {
  const sizes = new Map();
  const pattern = /\[sub_resource type="RectangleShape2D" id="([^"]+)"\]([\s\S]*?)(?=\n\[|$)/g;
  for (const match of sceneText.matchAll(pattern)) {
    const sizeMatch = match[2].match(/size = Vector2\(([-0-9.]+),\s*([-0-9.]+)\)/);
    if (sizeMatch) {
      sizes.set(`SubResource("${match[1]}")`, {
        x: Number(sizeMatch[1]),
        y: Number(sizeMatch[2]),
      });
    }
  }
  return sizes;
}

function parseTscnNodes(sceneText) {
  const nodes = [];
  const pattern = /\[node name="([^"]+)" type="([^"]+)"[^\]]*\]([\s\S]*?)(?=\n\[|$)/g;
  for (const match of sceneText.matchAll(pattern)) {
    nodes.push({
      name: match[1],
      type: match[2],
      props: parseNodeProperties(match[3]),
      position: parsePosition(match[3]),
    });
  }
  return nodes;
}

function parseNodeProperties(block) {
  const props = {};
  for (const rawLine of block.split('\n')) {
    const line = rawLine.trim();
    const match = line.match(/^([A-Za-z0-9_]+) = (.+)$/);
    if (!match) {
      continue;
    }
    props[match[1]] = parseGdValue(match[2]);
  }
  return props;
}

function parsePosition(block) {
  const match = block.match(/position = Vector2\(([-0-9.]+),\s*([-0-9.]+)\)/);
  if (!match) {
    return null;
  }
  return {
    x: Number(match[1]),
    y: Number(match[2]),
  };
}

function parseGdValue(rawValue) {
  const trimmed = rawValue.trim();
  if (trimmed === 'true') {
    return true;
  }
  if (trimmed === 'false') {
    return false;
  }
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  if (trimmed.startsWith('ExtResource(') || trimmed.startsWith('SubResource(')) {
    return trimmed;
  }
  const numeric = Number(trimmed);
  if (!Number.isNaN(numeric)) {
    return numeric;
  }
  return trimmed;
}

function countScenePlatforms(markers, subResourceSizes) {
  let platformCount = 0;
  for (const marker of markers) {
    if (marker.type !== 'StaticBody2D') {
      continue;
    }
    platformCount += 1;
  }
  for (const marker of markers) {
    const shape = marker.props.shape;
    if (typeof shape === 'string' && subResourceSizes.has(shape)) {
      platformCount += 0;
    }
  }
  return platformCount;
}

function getSceneRoom(markers) {
  const camera = markers.find((marker) => marker.script_path.endsWith('/CameraBoundsMarker.gd'));
  if (camera !== undefined && typeof camera.props.size === 'string') {
    const size = parseVector(camera.props.size);
    if (size !== null) {
      return {
        width: size.x,
        height: size.y,
      };
    }
  }

  const positions = markers.map((marker) => marker.position).filter(Boolean);
  return {
    width: Math.max(calculateRange(positions.map((position) => position.x)), 1),
    height: Math.max(calculateRange(positions.map((position) => position.y)), 1),
  };
}

function parseVector(value) {
  const match = String(value).match(/Vector2\(([-0-9.]+),\s*([-0-9.]+)\)/);
  if (!match) {
    return null;
  }
  return {
    x: Number(match[1]),
    y: Number(match[2]),
  };
}

function calculateVerticalTravel(positions) {
  return calculateRange(positions.map((position) => Number(position.y ?? 0)));
}

function calculateRange(values) {
  const finiteValues = values.filter(Number.isFinite);
  if (finiteValues.length === 0) {
    return 0;
  }
  return Math.max(...finiteValues) - Math.min(...finiteValues);
}

function calculateNearestDistance(fromMarkers, toMarkers) {
  const fromPositions = fromMarkers.map((marker) => marker.position ?? marker).filter(Boolean);
  const toPositions = toMarkers.map((marker) => marker.position ?? marker).filter(Boolean);
  if (fromPositions.length === 0 || toPositions.length === 0) {
    return 0;
  }
  let nearest = Number.POSITIVE_INFINITY;
  for (const from of fromPositions) {
    for (const to of toPositions) {
      nearest = Math.min(nearest, distance(from, to));
    }
  }
  return Number.isFinite(nearest) ? nearest : 0;
}

function calculateFarthestDistance(fromMarkers, toMarkers) {
  const fromPositions = fromMarkers.map((marker) => marker.position ?? marker).filter(Boolean);
  const toPositions = toMarkers.map((marker) => marker.position ?? marker).filter(Boolean);
  if (fromPositions.length === 0 || toPositions.length === 0) {
    return 0;
  }
  let farthest = 0;
  for (const from of fromPositions) {
    for (const to of toPositions) {
      farthest = Math.max(farthest, distance(from, to));
    }
  }
  return farthest;
}

function calculateDoorPreviewSpacing(spawns, doors) {
  const doorPositions = doors.map((door) => door.position ?? door).filter(Boolean);
  if (doorPositions.length > 1) {
    let nearest = Number.POSITIVE_INFINITY;
    for (let leftIndex = 0; leftIndex < doorPositions.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < doorPositions.length; rightIndex += 1) {
        nearest = Math.min(nearest, distance(doorPositions[leftIndex], doorPositions[rightIndex]));
      }
    }
    return Number.isFinite(nearest) ? nearest : 0;
  }

  return calculateNearestDistance(spawns, doors);
}

function estimateCriticalPath(spawns, doors, goals) {
  return Math.max(
    calculateFarthestDistance(spawns, doors),
    calculateFarthestDistance(spawns, goals),
  );
}

function estimatePathFromPositions(spawns, targets) {
  return calculateFarthestDistance(spawns.map((position) => ({ position })), targets.map((position) => ({ position: position.position ?? position })));
}

function distance(left, right) {
  const dx = Number(left.x ?? 0) - Number(right.x ?? 0);
  const dy = Number(left.y ?? 0) - Number(right.y ?? 0);
  return Math.sqrt(dx * dx + dy * dy);
}

function calculateContentScore(input) {
  let score = 0;
  score += input.enemies > 0 ? 1 : 0;
  score += input.heals > 0 ? 1 : 0;
  score += input.collectibles > 0 ? 1 : 0;
  score += input.hazards > 0 ? 1 : 0;
  score += input.abilityGates > 0 ? 1 : 0;
  score += input.goals > 0 ? 1 : 0;
  score += input.platformCount > 0 ? 1 : 0;
  score += input.verticalTravel >= 96 ? 1 : 0;
  score += input.restStops > 0 ? 1 : 0;
  score += input.hiddenCount > 0 ? 1 : 0;
  return score;
}

function normalizeMetrics(metrics) {
  const normalized = {};
  for (const [key, value] of Object.entries(metrics)) {
    normalized[key] = typeof value === 'number' ? roundMetric(value) : value;
  }
  return normalized;
}

function roundMetric(value) {
  return Math.round(value * 1000) / 1000;
}

function isKeyLike(value) {
  const text = String(value ?? '');
  return text.includes('key') || text.includes('keystone') || text.includes('artifact') || text.includes('shard');
}

function numberValue(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function stringValue(value) {
  return typeof value === 'string' ? value : '';
}

function booleanValue(value) {
  return value === true || value === 'true';
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value ?? 0), 0);
}

function buildProfileCounts(levels) {
  const counts = {};
  for (const level of levels) {
    counts[level.profile] = (counts[level.profile] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function repoRelative(path) {
  return path.startsWith(repoRoot) ? path.slice(repoRoot.length + 1) : path;
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
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
