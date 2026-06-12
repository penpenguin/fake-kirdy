import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, join, relative, resolve } from 'node:path';

const repoRoot = process.cwd();
const defaultContractPath = join(repoRoot, 'godot', 'tests', 'level_graph_contract.json');
const options = parseArgs(process.argv.slice(2));
const contractPath = resolve(repoRoot, options.contractPath ?? defaultContractPath);
const contract = readContract(contractPath);
const levelsDir = resolve(repoRoot, options.levelsDir ?? contract.levels_dir ?? 'godot/levels');
const proceduralLevelsPath = resolve(
  repoRoot,
  options.proceduralLevelsPath ?? contract.procedural_levels_path ?? 'godot/levels/generated/procedural_levels.json',
);
const levelCatalogPath = resolve(repoRoot, contract.level_catalog_path ?? 'godot/levels/level_catalog.json');
const stageManifestPath = resolve(repoRoot, contract.stage_manifest_path ?? 'godot/levels/stage_manifest.json');
const startLevelId = options.startLevelId ?? contract.start_level_id;
const finalLevelId = options.finalLevelId ?? contract.final_level_id;
const canonicalContractChecks =
  options.startLevelId === null &&
  options.finalLevelId === null &&
  options.levelsDir === null &&
  !options.noProcedural;

const catalog = readOptionalJson(levelCatalogPath);
const stageManifest = readOptionalJson(stageManifestPath);
const sceneLevels = collectSceneLevels(levelsDir, catalog, stageManifest);
const proceduralLevels = options.noProcedural ? [] : collectProceduralLevels(proceduralLevelsPath);
const levels = mergeLevels(sceneLevels, proceduralLevels);
const graph = buildGraph(levels);
const reachableLevelIds = startLevelId ? findReachableLevelIds(graph, startLevelId) : [];
const paths = {};
if (startLevelId && finalLevelId) {
  paths[`${startLevelId}_to_${finalLevelId}`] = findPath(graph, startLevelId, finalLevelId);
}

const itemSources = buildItemSources(levels);
const requirementIndex = buildRequirementIndex(levels);
const issues = validateGraph({
  levels,
  graph,
  reachableLevelIds,
  paths,
  itemSources,
  requirementIndex,
  contract,
  startLevelId,
  finalLevelId,
  canonicalContractChecks,
});
const failedChecks = issues.filter((issue) => issue.severity === 'error');

const report = {
  contract_path: relativeToRepo(contractPath),
  levels_dir: relativeToRepo(levelsDir),
  procedural_levels_path: options.noProcedural || !existsSync(proceduralLevelsPath) ? null : relativeToRepo(proceduralLevelsPath),
  start_level_id: startLevelId,
  final_level_id: finalLevelId,
  canonical_contract_checks: canonicalContractChecks,
  level_count: levels.length,
  edge_count: graph.edge_count,
  reachable_level_ids: reachableLevelIds,
  paths,
  item_sources: itemSources,
  requirement_index: requirementIndex,
  failed_checks: failedChecks,
  issues,
  levels: levels.map(serializeLevel),
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
    noProcedural: false,
    startLevelId: null,
    finalLevelId: null,
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
    if (arg === '--no-procedural') {
      parsed.noProcedural = true;
      continue;
    }
    if (arg === '--start') {
      parsed.startLevelId = readArgValue(args, index, arg);
      index += 1;
      continue;
    }
    if (arg === '--final') {
      parsed.finalLevelId = readArgValue(args, index, arg);
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
    throw new Error(`Level graph contract not found: ${path}`);
  }
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  if (parsed?.version !== 1) {
    throw new Error('Level graph contract must use version 1');
  }
  return parsed;
}

function readOptionalJson(path) {
  if (!existsSync(path)) {
    return null;
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

function collectSceneLevels(directory, catalog, stageManifest) {
  if (!existsSync(directory)) {
    throw new Error(`Levels directory not found: ${directory}`);
  }

  const catalogById = new Map((catalog?.levels ?? []).map((level) => [level.id, level]));
  const stageById = new Map((stageManifest?.stages ?? []).map((stage) => [normalizeStageId(stage.id), stage]));

  return listFiles(directory)
    .filter((path) => extname(path) === '.tscn')
    .map((path) => parseSceneLevel(path, catalogById, stageById));
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

function parseSceneLevel(path, catalogById, stageById) {
  const id = basename(path, '.tscn');
  const text = readFileSync(path, 'utf8');
  const resources = parseExtResources(text);
  const nodes = parseNodes(text, resources);
  const catalogEntry = catalogById.get(id);
  const stageId = catalogEntry?.source_ref?.startsWith('stage_manifest:')
    ? normalizeStageId(catalogEntry.source_ref.slice('stage_manifest:'.length))
    : id;
  const stage = stageById.get(stageId);
  const cluster = stage?.metadata?.cluster ?? inferCluster(catalogEntry?.tags ?? []);
  const spawns = nodes
    .filter((node) => node.marker_type === 'player_spawn')
    .map((node) => stringProp(node.props.spawn_id, 'default'));

  return {
    id,
    source: 'tscn',
    path,
    path_relative: relativeToRepo(path),
    stage_id: stage?.id ?? null,
    cluster,
    spawns: unique(spawns),
    doors: nodes.filter((node) => node.marker_type === 'door').map((node) => sceneDoor(node)),
    collectibles: nodes.filter((node) => node.marker_type === 'collectible').map((node) => sceneCollectible(node)),
    goals: nodes.filter((node) => node.marker_type === 'goal').map((node) => ({ id: stringProp(node.props.goal_id, 'goal') })),
    enemy_groups: nodes
      .filter((node) => node.marker_type === 'enemy_spawn')
      .flatMap((node) => [stringProp(node.props.enemy_group_id, ''), stringProp(node.props.boss_id, '')])
      .filter((value) => value.length > 0),
    ability_rewards: nodes
      .filter((node) => node.marker_type === 'enemy_spawn' || node.marker_type === 'collectible')
      .map((node) => stringProp(node.props.ability_type, ''))
      .filter((value) => value.length > 0),
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
      current = { header: parseHeaderAttributes(line), props: {} };
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
  return {
    name: node.header.name ?? '<unnamed>',
    marker_type: markerTypeFromScript(scriptPath),
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
  if (scriptPath.endsWith('/CollectibleMarker.gd')) {
    return 'collectible';
  }
  if (scriptPath.endsWith('/EnemySpawnMarker.gd')) {
    return 'enemy_spawn';
  }
  return null;
}

function sceneDoor(node) {
  return {
    id: stringProp(node.props.door_id, 'door'),
    target_level_id: stringProp(node.props.target_level_id, ''),
    target_spawn_id: stringProp(node.props.target_spawn_id, 'default'),
    requirements: requirementsFrom(node.props),
  };
}

function sceneCollectible(node) {
  return {
    id: stringProp(node.props.collectible_id, 'collectible'),
    item_id: stringProp(node.props.item_id, 'collectible'),
  };
}

function collectProceduralLevels(path) {
  if (!existsSync(path)) {
    return [];
  }
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  return (parsed.levels ?? []).map((level) => {
    const content = level.runtime_layout?.content ?? {};
    return {
      id: level.id,
      source: 'procedural',
      path,
      path_relative: relativeToRepo(path),
      stage_id: level.stage_id ?? null,
      cluster: level.metadata?.cluster ?? null,
      spawns: Object.keys(level.runtime_layout?.spawns ?? {}),
      doors: (level.runtime_layout?.branch_exit_rules ?? []).map((rule) => ({
        id: `${level.id}_${rule.direction}`,
        target_level_id: rule.target_level_id,
        target_spawn_id: reverseDirection(rule.direction),
        requirements: requirementsFrom(rule),
      })),
      collectibles: (content.collectibles ?? []).map((collectible) => ({
        id: collectible.collectible_id ?? collectible.id,
        item_id: collectible.item_id,
      })),
      goals: (content.goals ?? []).map((goal) => ({ id: goal.goal_id ?? goal.id })),
      enemy_groups: (content.enemies ?? [])
        .flatMap((enemy) => [enemy.enemy_group_id ?? '', enemy.boss_id ?? ''])
        .filter((value) => value.length > 0),
      ability_rewards: [
        ...(content.enemies ?? []).map((enemy) => String(enemy.ability_type ?? '')),
        ...(content.collectibles ?? []).map((collectible) => String(collectible.ability_type ?? '')),
      ].filter((value) => value.length > 0),
    };
  });
}

function mergeLevels(sceneLevels, proceduralLevels) {
  const byId = new Map();
  for (const level of proceduralLevels) {
    byId.set(level.id, level);
  }
  for (const level of sceneLevels) {
    const existing = byId.get(level.id);
    if (existing !== undefined) {
      byId.set(level.id, {
        ...existing,
        ...level,
        source: 'tscn+procedural',
        spawns: unique([...existing.spawns, ...level.spawns]),
        doors: uniqueDoors([...existing.doors, ...level.doors]),
        collectibles: uniqueBy([...existing.collectibles, ...level.collectibles], (item) => item.item_id),
        goals: uniqueBy([...existing.goals, ...level.goals], (goal) => goal.id),
        enemy_groups: unique([...existing.enemy_groups, ...level.enemy_groups]),
        ability_rewards: unique([...(existing.ability_rewards ?? []), ...(level.ability_rewards ?? [])]),
      });
    } else {
      byId.set(level.id, level);
    }
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function buildGraph(levels) {
  const adjacency = new Map(levels.map((level) => [level.id, []]));
  let edgeCount = 0;
  for (const level of levels) {
    for (const door of level.doors) {
      if (!door.target_level_id) {
        continue;
      }
      adjacency.get(level.id).push({
        from: level.id,
        to: door.target_level_id,
        door_id: door.id,
        target_spawn_id: door.target_spawn_id,
        requirements: door.requirements,
      });
      edgeCount += 1;
    }
  }
  return {
    adjacency,
    levels_by_id: new Map(levels.map((level) => [level.id, level])),
    edge_count: edgeCount,
  };
}

function findReachableLevelIds(graph, startLevelId) {
  if (!graph.levels_by_id.has(startLevelId)) {
    return [];
  }
  const seen = new Set([startLevelId]);
  const queue = [startLevelId];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const edge of graph.adjacency.get(current) ?? []) {
      if (!graph.levels_by_id.has(edge.to) || seen.has(edge.to)) {
        continue;
      }
      seen.add(edge.to);
      queue.push(edge.to);
    }
  }
  return [...seen].sort();
}

function findPath(graph, startLevelId, finalLevelId) {
  if (!graph.levels_by_id.has(startLevelId) || !graph.levels_by_id.has(finalLevelId)) {
    return null;
  }
  const seen = new Set([startLevelId]);
  const queue = [{ id: startLevelId, path: [startLevelId] }];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current.id === finalLevelId) {
      return current.path;
    }
    for (const edge of graph.adjacency.get(current.id) ?? []) {
      if (!graph.levels_by_id.has(edge.to) || seen.has(edge.to)) {
        continue;
      }
      seen.add(edge.to);
      queue.push({ id: edge.to, path: [...current.path, edge.to] });
    }
  }
  return null;
}

function buildItemSources(levels) {
  const sources = {};
  for (const level of levels) {
    for (const collectible of level.collectibles) {
      if (!collectible.item_id) {
        continue;
      }
      sources[collectible.item_id] ??= [];
      sources[collectible.item_id].push(level.id);
    }
  }
  return sortRecordArrays(sources);
}

function buildRequirementIndex(levels) {
  const index = {};
  for (const level of levels) {
    for (const door of level.doors) {
      for (const [field, value] of Object.entries(door.requirements)) {
        if (!value) {
          continue;
        }
        const key = `${field}:${value}`;
        index[key] ??= [];
        index[key].push(level.id);
      }
    }
  }
  return sortRecordArrays(index);
}

function validateGraph(input) {
  const issues = [];
  validateDoorTargets(input, issues);
  validateReachability(input, issues);
  validateBranchReturns(input, issues);
  validateKeystones(input, issues);
  validateForbiddenGoalShortcuts(input, issues);
  return issues;
}

function validateDoorTargets({ levels, graph, contract }, issues) {
  for (const level of levels) {
    for (const door of level.doors) {
      const target = graph.levels_by_id.get(door.target_level_id);
      if (target === undefined) {
        addIssue(issues, contract, 'door_target_exists', level.id, door.id, `Door target '${door.target_level_id}' is missing.`);
        continue;
      }
      if (!target.spawns.includes(door.target_spawn_id)) {
        addIssue(
          issues,
          contract,
          'door_target_spawn_exists',
          level.id,
          door.id,
          `Door target spawn '${door.target_spawn_id}' is missing from '${door.target_level_id}'.`,
        );
      }
    }
  }
}

function validateReachability({ reachableLevelIds, paths, contract, startLevelId, finalLevelId, canonicalContractChecks }, issues) {
  if (startLevelId && finalLevelId && paths[`${startLevelId}_to_${finalLevelId}`] === null) {
    addIssue(issues, contract, 'final_level_reachable', startLevelId, null, `${finalLevelId} is not reachable from ${startLevelId}.`);
  }
  if (!canonicalContractChecks) {
    return;
  }
  for (const levelId of contract.required_reachable_level_ids ?? []) {
    if (!reachableLevelIds.includes(levelId)) {
      addIssue(issues, contract, 'required_level_reachable', levelId, null, `${levelId} is not reachable from ${startLevelId}.`);
    }
  }
}

function validateBranchReturns({ graph, contract, canonicalContractChecks }, issues) {
  if (!canonicalContractChecks) {
    return;
  }
  const hubId = contract.branch_return_target_id;
  if (!hubId) {
    return;
  }
  for (const levelId of contract.branch_level_ids ?? []) {
    const path = findPath(graph, levelId, hubId);
    if (path === null) {
      addIssue(issues, contract, 'branch_returns_to_hub', levelId, null, `${levelId} cannot return to ${hubId}.`);
    }
  }
}

function validateKeystones({ itemSources, requirementIndex, contract, canonicalContractChecks }, issues) {
  if (!canonicalContractChecks) {
    return;
  }
  for (const entry of contract.cluster_keystone_order ?? []) {
    if (!Array.isArray(itemSources[entry.item_id]) || itemSources[entry.item_id].length === 0) {
      addIssue(issues, contract, 'keystone_source_exists', entry.cluster, null, `Missing source for ${entry.item_id}.`);
    }
    const requirementKey = `required_keystone_item_id:${entry.item_id}`;
    if (!Array.isArray(requirementIndex[requirementKey]) || requirementIndex[requirementKey].length === 0) {
      addIssue(issues, contract, 'keystone_requirement_exists', entry.cluster, null, `Missing requirement for ${entry.item_id}.`);
    }
  }
}

function validateForbiddenGoalShortcuts({ graph, contract, canonicalContractChecks }, issues) {
  if (!canonicalContractChecks) {
    return;
  }
  for (const shortcut of contract.forbidden_goal_shortcuts ?? []) {
    const level = graph.levels_by_id.get(shortcut.from_level_id);
    const door = level?.doors.find((candidate) => candidate.id === shortcut.door_id);
    if (door === undefined) {
      addIssue(
        issues,
        contract,
        'forbidden_goal_shortcut_locked',
        shortcut.from_level_id,
        shortcut.door_id,
        `Expected goal shortcut door '${shortcut.door_id}' to exist for lock validation.`,
      );
      continue;
    }
    const requiredKeystone = String(shortcut.required_keystone_item_id ?? '');
    if (requiredKeystone !== '' && door.requirements?.required_keystone_item_id !== requiredKeystone) {
      addIssue(
        issues,
        contract,
        'forbidden_goal_shortcut_locked',
        shortcut.from_level_id,
        shortcut.door_id,
        `Goal shortcut '${shortcut.door_id}' must require ${requiredKeystone}.`,
      );
    }
  }
}

function addIssue(issues, contract, rule, levelId, doorId, message) {
  const severity = contract.rules?.[rule]?.severity ?? 'warning';
  if (severity === 'off') {
    return;
  }
  issues.push({
    rule,
    severity,
    level_id: levelId,
    door_id: doorId,
    message,
  });
}

function serializeLevel(level) {
  return {
    id: level.id,
    source: level.source,
    stage_id: level.stage_id,
    cluster: level.cluster,
    spawns: level.spawns,
    doors: level.doors,
    collectibles: level.collectibles,
    goals: level.goals,
    enemy_groups: level.enemy_groups,
    ability_rewards: level.ability_rewards ?? [],
  };
}

function requirementsFrom(source) {
  const requirements = {};
  for (const key of [
    'required_item_id',
    'required_keystone_item_id',
    'required_ability_type',
    'required_completed_level_id',
    'required_defeated_enemy_group_id',
    'required_boss_id',
  ]) {
    const value = stringProp(source[key], '');
    if (value.length > 0) {
      requirements[key] = value;
    }
  }
  return requirements;
}

function reverseDirection(direction) {
  const reverse = {
    north: 'south',
    south: 'north',
    east: 'west',
    west: 'east',
  };
  return reverse[direction] ?? 'default';
}

function normalizeStageId(stageId) {
  return String(stageId ?? '').replaceAll('-', '_');
}

function inferCluster(tags) {
  return tags.find((tag) => ['hub', 'forest', 'ice', 'fire', 'ruins', 'sky', 'void'].includes(tag)) ?? null;
}

function unique(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.length > 0))].sort();
}

function uniqueBy(values, keyFn) {
  const byKey = new Map();
  for (const value of values) {
    byKey.set(keyFn(value), value);
  }
  return [...byKey.values()];
}

function uniqueDoors(doors) {
  return uniqueBy(doors, (door) => `${door.id}:${door.target_level_id}:${door.target_spawn_id}`);
}

function stringProp(value, fallback) {
  return typeof value === 'string' ? value : fallback;
}

function sortRecordArrays(record) {
  return Object.fromEntries(Object.entries(record).sort().map(([key, values]) => [key, unique(values)]));
}

function relativeToRepo(path) {
  return relative(repoRoot, path);
}

function printHumanReport(report) {
  console.log(`[godot:level-graph] levels=${report.level_count} edges=${report.edge_count}`);
  for (const issue of report.issues) {
    console.log(`[godot:level-graph] ${issue.severity} ${issue.rule} ${issue.level_id}: ${issue.message}`);
  }
  const pathKey = `${report.start_level_id}_to_${report.final_level_id}`;
  if (report.paths[pathKey] !== null) {
    console.log(`[godot:level-graph] ${pathKey}: ${report.paths[pathKey].join(' -> ')}`);
  }
  if (report.failed_checks.length === 0) {
    console.log('[godot:level-graph] passed');
  }
}
