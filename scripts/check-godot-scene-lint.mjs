import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, join, relative, resolve } from 'node:path';

const repoRoot = process.cwd();
const defaultContractPath = join(repoRoot, 'godot', 'tests', 'scene_lint_contract.json');
const options = parseArgs(process.argv.slice(2));
const contractPath = resolve(repoRoot, options.contractPath ?? defaultContractPath);
const contract = readContract(contractPath);
const levelsDir = resolve(repoRoot, options.levelsDir ?? contract.levels_dir ?? 'godot/levels');
const proceduralLevelsPath = resolve(
  repoRoot,
  options.proceduralLevelsPath ?? contract.procedural_levels_path ?? 'godot/levels/generated/procedural_levels.json',
);

const sceneLevels = collectSceneLevels(levelsDir);
const proceduralLevels = collectProceduralLevels(proceduralLevelsPath);
const levelIndex = mergeLevelIndexes(sceneLevels, proceduralLevels);
const issues = lintSceneLevels(sceneLevels, levelIndex, contract.rules ?? {});
const failedChecks = issues.filter((issue) => issue.severity === 'error');

const report = {
  contract_path: relativeToRepo(contractPath),
  levels_dir: relativeToRepo(levelsDir),
  procedural_levels_path: existsSync(proceduralLevelsPath) ? relativeToRepo(proceduralLevelsPath) : null,
  level_count: levelIndex.size,
  scene_level_count: sceneLevels.length,
  issue_count: issues.length,
  failed_checks: failedChecks,
  issues,
};

if (options.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  printHumanReport(report);
}

process.exit(failedChecks.length > 0 ? 1 : 0);

function parseArgs(args) {
  const parsed = {
    json: false,
    contractPath: null,
    levelsDir: null,
    proceduralLevelsPath: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') {
      parsed.json = true;
      continue;
    }
    if (arg === '--contract') {
      parsed.contractPath = readArgValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--levels-dir') {
      parsed.levelsDir = readArgValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--procedural-levels') {
      parsed.proceduralLevelsPath = readArgValue(args, index, arg);
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

function readContract(path) {
  if (!existsSync(path)) {
    throw new Error(`Scene lint contract not found: ${path}`);
  }
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  if (parsed?.version !== 1) {
    throw new Error('Scene lint contract must use version 1');
  }
  return parsed;
}

function collectSceneLevels(directory) {
  if (!existsSync(directory)) {
    throw new Error(`Levels directory not found: ${directory}`);
  }

  return listFiles(directory)
    .filter((path) => extname(path) === '.tscn')
    .map((path) => parseSceneLevel(path));
}

function listFiles(directory) {
  const entries = readdirSync(directory)
    .filter((entry) => !entry.startsWith('.'))
    .map((entry) => join(directory, entry));
  const files = [];

  for (const entry of entries) {
    const stats = statSync(entry);
    if (stats.isDirectory()) {
      files.push(...listFiles(entry));
    } else if (stats.isFile()) {
      files.push(entry);
    }
  }

  return files;
}

function parseSceneLevel(path) {
  const text = readFileSync(path, 'utf8');
  const resources = parseExtResources(text);
  const nodes = parseNodes(text, resources);
  const markers = nodes.filter((node) => node.marker_type !== null);
  const markerGroups = groupMarkers(markers);

  return {
    id: basename(path, '.tscn'),
    path,
    path_relative: relativeToRepo(path),
    source: 'tscn',
    spawns: new Set(markerGroups.player_spawn.map((marker) => marker.id)),
    markers,
    marker_groups: markerGroups,
  };
}

function parseExtResources(text) {
  const resources = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('[ext_resource ')) {
      continue;
    }
    const attributes = parseHeaderAttributes(line);
    if (typeof attributes.id === 'string' && typeof attributes.path === 'string') {
      resources.set(attributes.id, attributes.path);
    }
  }
  return resources;
}

function parseNodes(text, resources) {
  const nodes = [];
  let current = null;

  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('[node ')) {
      if (current !== null) {
        nodes.push(finalizeNode(current, resources));
      }
      current = {
        header: parseHeaderAttributes(line),
        props: {},
      };
      continue;
    }
    if (line.startsWith('[')) {
      if (current !== null) {
        nodes.push(finalizeNode(current, resources));
        current = null;
      }
      continue;
    }
    if (current === null) {
      continue;
    }
    const match = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.+)$/);
    if (match !== null) {
      current.props[match[1]] = parseValue(match[2]);
    }
  }

  if (current !== null) {
    nodes.push(finalizeNode(current, resources));
  }

  return nodes;
}

function finalizeNode(node, resources) {
  const scriptResourceId = node.props.script?.resource_id;
  const scriptPath = scriptResourceId === undefined ? null : resources.get(scriptResourceId) ?? null;
  const markerType = markerTypeFromScript(scriptPath);
  const position = node.props.position ?? { x: 0, y: 0 };

  return {
    name: node.header.name ?? '<unnamed>',
    marker_type: markerType,
    position,
    id: markerId(markerType, node.props),
    trigger_radius: markerRadius(markerType, node.props),
    props: node.props,
  };
}

function parseHeaderAttributes(line) {
  const attributes = {};
  for (const match of line.matchAll(/([A-Za-z0-9_]+)="([^"]*)"/g)) {
    attributes[match[1]] = match[2];
  }
  return attributes;
}

function parseValue(rawValue) {
  const value = rawValue.trim();
  const extResource = value.match(/^ExtResource\("([^"]+)"\)$/);
  if (extResource !== null) {
    return { resource_id: extResource[1] };
  }
  const vector = value.match(/^Vector2i?\(([-0-9.]+),\s*([-0-9.]+)\)$/);
  if (vector !== null) {
    return { x: Number(vector[1]), y: Number(vector[2]) };
  }
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  if (/^-?\d+(?:\.\d+)?$/.test(value)) {
    return Number(value);
  }
  return value;
}

function markerTypeFromScript(scriptPath) {
  if (scriptPath === null) {
    return null;
  }
  if (scriptPath.endsWith('/PlayerSpawn.gd')) {
    return 'player_spawn';
  }
  if (scriptPath.endsWith('/DoorMarker.gd')) {
    return 'door';
  }
  if (scriptPath.endsWith('/GoalMarker.gd') || scriptPath.endsWith('/GoalDoorController.gd')) {
    return 'goal';
  }
  if (scriptPath.endsWith('/HazardMarker.gd')) {
    return 'hazard';
  }
  if (scriptPath.endsWith('/EnemySpawnMarker.gd')) {
    return 'enemy_spawn';
  }
  if (scriptPath.endsWith('/AbilityGateMarker.gd')) {
    return 'ability_gate';
  }
  if (scriptPath.endsWith('/CollectibleMarker.gd')) {
    return 'collectible';
  }
  if (scriptPath.endsWith('/HealMarker.gd')) {
    return 'heal';
  }
  return null;
}

function markerId(markerType, props) {
  if (markerType === 'player_spawn') {
    return stringProp(props.spawn_id, 'default');
  }
  if (markerType === 'door') {
    return stringProp(props.door_id, 'door');
  }
  if (markerType === 'goal') {
    return stringProp(props.goal_id, 'goal');
  }
  if (markerType === 'hazard') {
    return stringProp(props.hazard_id, 'hazard');
  }
  if (markerType === 'enemy_spawn') {
    return stringProp(props.spawn_id, 'enemy');
  }
  if (markerType === 'ability_gate') {
    return stringProp(props.gate_id, 'ability_gate');
  }
  if (markerType === 'collectible') {
    return stringProp(props.collectible_id, 'collectible');
  }
  if (markerType === 'heal') {
    return stringProp(props.heal_id, 'heal');
  }
  return null;
}

function markerRadius(markerType, props) {
  if (Number.isFinite(props.trigger_radius)) {
    return props.trigger_radius;
  }
  if (markerType === 'door' || markerType === 'goal') {
    return 64;
  }
  if (markerType === 'hazard') {
    return 40;
  }
  if (markerType === 'enemy_spawn') {
    return 24;
  }
  return 0;
}

function groupMarkers(markers) {
  return {
    player_spawn: markers.filter((marker) => marker.marker_type === 'player_spawn'),
    door: markers.filter((marker) => marker.marker_type === 'door'),
    goal: markers.filter((marker) => marker.marker_type === 'goal'),
    hazard: markers.filter((marker) => marker.marker_type === 'hazard'),
    enemy_spawn: markers.filter((marker) => marker.marker_type === 'enemy_spawn'),
    ability_gate: markers.filter((marker) => marker.marker_type === 'ability_gate'),
    collectible: markers.filter((marker) => marker.marker_type === 'collectible'),
    heal: markers.filter((marker) => marker.marker_type === 'heal'),
  };
}

function collectProceduralLevels(path) {
  if (!existsSync(path)) {
    return [];
  }

  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  if (!Array.isArray(parsed.levels)) {
    return [];
  }

  return parsed.levels.map((level) => ({
    id: level.id,
    path,
    path_relative: relativeToRepo(path),
    source: 'procedural',
    spawns: new Set(Object.keys(level.runtime_layout?.spawns ?? {})),
    markers: [],
    marker_groups: groupMarkers([]),
  }));
}

function mergeLevelIndexes(sceneLevels, proceduralLevels) {
  const index = new Map();
  for (const level of proceduralLevels) {
    if (typeof level.id === 'string' && level.id.length > 0) {
      index.set(level.id, level);
    }
  }
  for (const level of sceneLevels) {
    const existing = index.get(level.id);
    if (existing !== undefined) {
      level.spawns = new Set([...existing.spawns, ...level.spawns]);
    }
    index.set(level.id, level);
  }
  return index;
}

function lintSceneLevels(levels, levelIndex, rules) {
  const issues = [];
  for (const level of levels) {
    lintDoors(level, levelIndex, rules, issues);
    lintDoorRoles(level, rules, issues);
    lintNearbyDoorAmbiguity(level, rules, issues);
    lintAbilityGates(level, rules, issues);
    lintHiddenDiscovery(level, rules, issues);
    lintDoorGoalOverlap(level, rules, issues);
    lintHazardSpawnOverlap(level, rules, issues);
    lintEnemySpawnDistance(level, rules, issues);
  }
  return issues;
}

function lintDoors(level, levelIndex, rules, issues) {
  for (const door of level.marker_groups.door) {
    const targetLevelId = stringProp(door.props.target_level_id, '');
    const targetSpawnId = stringProp(door.props.target_spawn_id, 'default');
    if (targetLevelId.length === 0 || !levelIndex.has(targetLevelId)) {
      addIssue(issues, rules, 'door_target_exists', level, door, `Door targets missing level '${targetLevelId}'.`);
      continue;
    }
    const targetLevel = levelIndex.get(targetLevelId);
    if (!targetLevel.spawns.has(targetSpawnId)) {
      addIssue(
        issues,
        rules,
        'door_target_spawn_exists',
        level,
        door,
        `Door targets spawn '${targetSpawnId}' missing from level '${targetLevelId}'.`,
      );
    }
  }
}

function lintDoorRoles(level, rules, issues) {
  const rule = rules.door_role_required;
  if (rule?.severity === 'off') {
    return;
  }
  const representativeLevelIds = new Set(rule?.representative_level_ids ?? []);
  if (representativeLevelIds.size > 0 && !representativeLevelIds.has(level.id) && options.levelsDir === null) {
    return;
  }
  const allowedRoles = new Set(rule?.allowed_roles ?? []);
  for (const door of level.marker_groups.door) {
    if (door.props.hidden_until_discovered === true) {
      continue;
    }
    const role = stringProp(door.props.door_role, '');
    const label = stringProp(door.props.door_label, '');
    if (role.length === 0 || (allowedRoles.size > 0 && !allowedRoles.has(role))) {
      addIssue(issues, rules, 'door_role_required', level, door, 'Visible door must declare a valid door_role.');
      continue;
    }
    if (label.length === 0 && role !== 'return') {
      addIssue(issues, rules, 'door_role_required', level, door, 'Visible non-return door must declare a readable door_label.');
    }
  }
}

function lintNearbyDoorAmbiguity(level, rules, issues) {
  const rule = rules.nearby_door_ambiguity;
  if (rule?.severity === 'off') {
    return;
  }
  const representativeLevelIds = new Set(rule?.representative_level_ids ?? []);
  if (representativeLevelIds.size > 0 && !representativeLevelIds.has(level.id) && options.levelsDir === null) {
    return;
  }
  const minDistance = Number(rule?.min_distance_px ?? 96);
  const visibleDoors = level.marker_groups.door.filter((door) => door.props.hidden_until_discovered !== true);
  for (let leftIndex = 0; leftIndex < visibleDoors.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < visibleDoors.length; rightIndex += 1) {
      const left = visibleDoors[leftIndex];
      const right = visibleDoors[rightIndex];
      const actualDistance = distance(left.position, right.position);
      if (actualDistance >= minDistance) {
        continue;
      }
      const leftRole = stringProp(left.props.door_role, '');
      const rightRole = stringProp(right.props.door_role, '');
      const leftLabel = stringProp(left.props.door_label, '');
      const rightLabel = stringProp(right.props.door_label, '');
      const leftStyle = stringProp(left.props.door_visual_style, '');
      const rightStyle = stringProp(right.props.door_visual_style, '');
      const hasReadablePurpose = leftLabel.length > 0 && rightLabel.length > 0 && leftLabel !== rightLabel;
      const hasDistinctCategory = leftRole !== rightRole || (leftStyle.length > 0 && rightStyle.length > 0 && leftStyle !== rightStyle);
      if (hasReadablePurpose && hasDistinctCategory) {
        continue;
      }
      addIssue(
        issues,
        rules,
        'nearby_door_ambiguity',
        level,
        left,
        `Nearby doors '${left.id}' and '${right.id}' are ${round(actualDistance)}px apart without distinct labels, roles, or visual styles.`,
      );
    }
  }
}

function lintAbilityGates(level, rules, issues) {
  for (const gate of level.marker_groups.ability_gate) {
    const requiredAbility = stringProp(gate.props.required_ability_type, '');
    if (requiredAbility.length === 0) {
      addIssue(issues, rules, 'ability_gate_requires_ability', level, gate, 'Ability gate has no required ability.');
    }
  }
}

function lintHiddenDiscovery(level, rules, issues) {
  const markers = [...level.marker_groups.door, ...level.marker_groups.collectible];
  const minRadius = rules.hidden_discovery_radius?.min_radius_px ?? 1;
  for (const marker of markers) {
    if (marker.props.hidden_until_discovered !== true) {
      continue;
    }
    if (!Number.isFinite(marker.props.discovery_radius) || marker.props.discovery_radius < minRadius) {
      addIssue(
        issues,
        rules,
        'hidden_discovery_radius',
        level,
        marker,
        `Hidden marker discovery_radius must be at least ${minRadius}.`,
      );
    }
  }
}

function lintDoorGoalOverlap(level, rules, issues) {
  for (const door of level.marker_groups.door) {
    for (const goal of level.marker_groups.goal) {
      const minDistance = door.trigger_radius + goal.trigger_radius;
      const actualDistance = distance(door.position, goal.position);
      if (actualDistance < minDistance) {
        addIssue(
          issues,
          rules,
          'door_goal_overlap',
          level,
          door,
          `Door overlaps goal '${goal.id}' (${round(actualDistance)}px < ${round(minDistance)}px).`,
        );
      }
    }
  }
}

function lintHazardSpawnOverlap(level, rules, issues) {
  const safeSpawnRadius = rules.hazard_spawn_overlap?.safe_spawn_radius_px ?? 24;
  for (const hazard of level.marker_groups.hazard) {
    for (const spawn of level.marker_groups.player_spawn) {
      const minDistance = hazard.trigger_radius + safeSpawnRadius;
      const actualDistance = distance(hazard.position, spawn.position);
      if (actualDistance < minDistance) {
        addIssue(
          issues,
          rules,
          'hazard_spawn_overlap',
          level,
          hazard,
          `Hazard overlaps spawn '${spawn.id}' (${round(actualDistance)}px < ${round(minDistance)}px).`,
        );
      }
    }
  }
}

function lintEnemySpawnDistance(level, rules, issues) {
  const minDistance = rules.enemy_spawn_distance?.min_distance_px ?? 48;
  for (const enemy of level.marker_groups.enemy_spawn) {
    for (const spawn of level.marker_groups.player_spawn) {
      const actualDistance = distance(enemy.position, spawn.position);
      if (actualDistance < minDistance) {
        addIssue(
          issues,
          rules,
          'enemy_spawn_distance',
          level,
          enemy,
          `Enemy spawn is too close to player spawn '${spawn.id}' (${round(actualDistance)}px < ${round(minDistance)}px).`,
        );
      }
    }
  }
}

function addIssue(issues, rules, rule, level, marker, message) {
  const severity = rules[rule]?.severity ?? 'warning';
  if (severity === 'off') {
    return;
  }
  issues.push({
    rule,
    severity,
    level_id: level.id,
    scene_path: level.path_relative,
    marker_name: marker.name,
    marker_id: marker.id,
    message,
  });
}

function stringProp(value, fallback) {
  return typeof value === 'string' ? value : fallback;
}

function distance(a, b) {
  return Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.y ?? 0) - (b?.y ?? 0));
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function relativeToRepo(path) {
  return relative(repoRoot, path);
}

function printHumanReport(report) {
  console.log(`[godot:scene-lint] levels=${report.level_count} scene_levels=${report.scene_level_count}`);
  for (const issue of report.issues) {
    console.log(
      `[godot:scene-lint] ${issue.severity} ${issue.rule} ${issue.level_id}/${issue.marker_name}: ${issue.message}`,
    );
  }
  if (report.failed_checks.length === 0) {
    console.log('[godot:scene-lint] passed');
  }
}
