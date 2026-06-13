import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const repoRoot = process.cwd();
const defaultContractPath = join(repoRoot, 'godot', 'tests', 'progression_solver_contract.json');
const options = parseArgs(process.argv.slice(2));
const contractPath = resolve(repoRoot, options.contractPath ?? defaultContractPath);
const contract = readContract(contractPath);
const startLevelId = options.startLevelId ?? contract.start_level_id;
const finalLevelId = options.finalLevelId ?? contract.final_level_id;
const canonicalContractChecks =
  options.startLevelId === null &&
  options.finalLevelId === null &&
  options.levelsDir === null &&
  !options.noProcedural;
const graph = readLevelGraph(contract);
const solverResult = solveProgression(graph, contract, startLevelId, finalLevelId, canonicalContractChecks);
const issues = validateProgression(graph, solverResult, contract, startLevelId, finalLevelId, canonicalContractChecks);
const failedChecks = issues.filter((issue) => issue.severity === 'error');

const report = {
  contract_path: relativeToRepo(contractPath),
  graph_level_count: graph.level_count,
  graph_edge_count: graph.edge_count,
  start_level_id: startLevelId,
  final_level_id: finalLevelId,
  canonical_contract_checks: canonicalContractChecks,
  explored_state_count: solverResult.explored_state_count,
  reachable_level_ids: solverResult.reachable_level_ids,
  reachable_biome_destinations: getReachableBiomeDestinations(solverResult, contract),
  blocked_requirements: solverResult.blocked_requirements,
  solution: solverResult.solution,
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
    throw new Error(`Progression solver contract not found: ${path}`);
  }
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  if (parsed?.version !== 1) {
    throw new Error('Progression solver contract must use version 1');
  }
  return parsed;
}

function readLevelGraph(contract) {
  const args = ['scripts/check-godot-level-graph.mjs', '--json'];
  const graphContractPath = options.levelsDir === null ? contract.level_graph_contract_path : null;
  if (graphContractPath !== null) {
    args.push('--contract', graphContractPath);
  }
  if (options.levelsDir !== null) {
    args.push('--levels-dir', options.levelsDir);
  }
  if (options.noProcedural) {
    args.push('--no-procedural');
  }
  if (options.startLevelId !== null) {
    args.push('--start', options.startLevelId);
  }
  if (options.finalLevelId !== null) {
    args.push('--final', options.finalLevelId);
  }

  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if ((result.status ?? 0) !== 0) {
    const graphReport = parseJsonOrNull(result.stdout);
    return {
      failed_checks: graphReport?.failed_checks ?? [
        {
          rule: 'level_graph_valid',
          severity: 'error',
          message: result.stderr || 'level graph command failed',
        },
      ],
      levels: graphReport?.levels ?? [],
      level_count: graphReport?.level_count ?? 0,
      edge_count: graphReport?.edge_count ?? 0,
    };
  }
  return JSON.parse(result.stdout);
}

function solveProgression(graph, contract, startLevelId, finalLevelId, canonicalContractChecks) {
  const levelsById = new Map((graph.levels ?? []).map((level) => [level.id, level]));
  if (!levelsById.has(startLevelId)) {
    return {
      explored_state_count: 0,
      reachable_level_ids: [],
      blocked_requirements: {},
      solution: null,
    };
  }

  const initialState = collectLevelRewards({
    level_id: startLevelId,
    items: new Set(),
    abilities: new Set(),
    completed_levels: new Set(),
    defeated_enemy_groups: new Set(),
    defeated_bosses: new Set(),
    gameplay_beats: new Set(),
    path: [startLevelId],
  }, levelsById);
  const queue = [initialState];
  const seen = new Set([stateKey(initialState)]);
  const blockedRequirements = {};
  const reachableLevelIds = new Set();
  let exploredStateCount = 0;
  let solution = null;

  while (queue.length > 0) {
    const state = queue.shift();
    exploredStateCount += 1;
    reachableLevelIds.add(state.level_id);
    if (state.level_id === finalLevelId && solution === null) {
      solution = serializeState(state);
    }

    const level = levelsById.get(state.level_id);
    for (const door of level?.doors ?? []) {
      const targetLevel = levelsById.get(door.target_level_id);
      if (targetLevel === undefined) {
        continue;
      }
      const missingRequirements = missingDoorRequirements(state, level, targetLevel, door, contract, canonicalContractChecks);
      if (missingRequirements.length > 0) {
        for (const missing of missingRequirements) {
          blockedRequirements[missing] ??= [];
          blockedRequirements[missing].push(`${state.level_id}:${door.id}`);
        }
        continue;
      }
      const nextState = collectLevelRewards({
        level_id: targetLevel.id,
        items: new Set(state.items),
        abilities: new Set(state.abilities),
        completed_levels: new Set(state.completed_levels),
        defeated_enemy_groups: new Set(state.defeated_enemy_groups),
        defeated_bosses: new Set(state.defeated_bosses),
        gameplay_beats: new Set(state.gameplay_beats),
        path: [...state.path, targetLevel.id],
      }, levelsById);
      if (hasExplicitDoorRequirements(door) || clusterRequirement(level, targetLevel, contract) !== null) {
        nextState.gameplay_beats.add('locked_gate');
      }
      const key = stateKey(nextState);
      if (!seen.has(key)) {
        seen.add(key);
        queue.push(nextState);
      }
    }
  }

  return {
    explored_state_count: exploredStateCount,
    reachable_level_ids: [...reachableLevelIds].sort(),
    blocked_requirements: sortRecordArrays(blockedRequirements),
    solution,
  };
}

function collectLevelRewards(state, levelsById) {
  const level = levelsById.get(state.level_id);
  if (String(level?.source ?? '').includes('procedural')) {
    state.gameplay_beats.add('generated_route');
  }
  for (const collectible of level?.collectibles ?? []) {
    if (collectible.item_id) {
      state.items.add(collectible.item_id);
      state.gameplay_beats.add('collectible');
    }
  }
  for (const goal of level?.goals ?? []) {
    if (goal.id) {
      state.completed_levels.add(state.level_id);
    }
  }
  for (const groupId of level?.enemy_groups ?? []) {
    state.defeated_enemy_groups.add(groupId);
    state.gameplay_beats.add('enemy');
  }
  for (const bossId of level?.bosses ?? []) {
    state.defeated_bosses.add(bossId);
    state.gameplay_beats.add('boss');
  }
  for (const abilityType of level?.ability_rewards ?? []) {
    state.abilities.add(abilityType);
    state.gameplay_beats.add('ability_reward');
  }
  return state;
}

function hasExplicitDoorRequirements(door) {
  return Object.values(door.requirements ?? {}).some((value) => typeof value === 'string' && value.length > 0);
}

function missingDoorRequirements(state, fromLevel, targetLevel, door, contract, canonicalContractChecks) {
  const missing = [];
  const requirements = door.requirements ?? {};
  requireSetValue(missing, 'required_item_id', requirements.required_item_id, state.items);
  requireSetValue(missing, 'required_keystone_item_id', requirements.required_keystone_item_id, state.items);
  requireSetValue(missing, 'required_ability_type', requirements.required_ability_type, state.abilities);
  requireSetValue(missing, 'required_completed_level_id', requirements.required_completed_level_id, state.completed_levels);
  requireSetValue(
    missing,
    'required_defeated_enemy_group_id',
    requirements.required_defeated_enemy_group_id,
    state.defeated_enemy_groups,
  );
  requireSetValue(missing, 'required_boss_id', requirements.required_boss_id, state.defeated_bosses);

  const dynamicClusterRequirement = canonicalContractChecks ? clusterRequirement(fromLevel, targetLevel, contract) : null;
  if (dynamicClusterRequirement !== null && !state.items.has(dynamicClusterRequirement)) {
    missing.push(`cluster_unlock:${targetLevel.cluster}:${dynamicClusterRequirement}`);
  }

  return missing;
}

function requireSetValue(missing, field, value, set) {
  if (typeof value === 'string' && value.length > 0 && !set.has(value)) {
    missing.push(`${field}:${value}`);
  }
}

function clusterRequirement(fromLevel, targetLevel, contract) {
  if (!targetLevel?.cluster || targetLevel.cluster === fromLevel?.cluster) {
    return null;
  }
  if (targetLevel.cluster === 'forest' || targetLevel.cluster === 'hub') {
    return null;
  }
  return contract.cluster_unlocks?.[targetLevel.cluster] ?? null;
}

function validateProgression(graph, solverResult, contract, startLevelId, finalLevelId, canonicalContractChecks) {
  const issues = [];
  if ((graph.failed_checks ?? []).length > 0) {
    addIssue(issues, contract, 'level_graph_valid', startLevelId, `Level graph has ${graph.failed_checks.length} failed checks.`);
  }
  if (solverResult.solution === null) {
    addIssue(issues, contract, 'final_state_reachable', startLevelId, `${finalLevelId} is not progression-reachable from ${startLevelId}.`);
    return issues;
  }
  if (canonicalContractChecks) {
    const transitionCount = Math.max((solverResult.solution.path?.length ?? 1) - 1, 0);
    if (transitionCount < (contract.minimum_solution_transitions ?? 0)) {
      addIssue(
        issues,
        contract,
        'minimum_solution_transitions',
        finalLevelId,
        `Final solution has ${transitionCount} transition(s), expected at least ${contract.minimum_solution_transitions}.`,
      );
    }
    for (const itemId of contract.required_final_items ?? []) {
      if (!solverResult.solution.items.includes(itemId)) {
        addIssue(issues, contract, 'required_final_item_collected', finalLevelId, `Final solution did not collect ${itemId}.`);
      }
    }
    for (const levelId of contract.required_solution_level_ids ?? []) {
      if (!solverResult.solution.path.includes(levelId)) {
        addIssue(issues, contract, 'required_solution_level_present', levelId, `Final solution did not visit ${levelId}.`);
      }
    }
    for (const beat of contract.required_gameplay_beats ?? []) {
      if (!solverResult.solution.gameplay_beats.includes(beat)) {
        addIssue(issues, contract, 'required_gameplay_beat_present', finalLevelId, `Final solution is missing gameplay beat ${beat}.`);
      }
    }
    for (const bossId of contract.required_boss_ids ?? []) {
      if (!solverResult.solution.defeated_bosses.includes(bossId)) {
        addIssue(issues, contract, 'required_boss_defeated', bossId, `Final solution did not defeat required boss ${bossId}.`);
      }
    }
    const requiredFinalBossId = String(contract.required_final_boss_id ?? '');
    if (requiredFinalBossId !== '' && !solverResult.solution.defeated_bosses.includes(requiredFinalBossId)) {
      addIssue(issues, contract, 'final_boss_before_clear', finalLevelId, `Final solution did not defeat final boss ${requiredFinalBossId}.`);
    }
    validateClusterMinimumLevelCounts(graph, solverResult, contract, issues);
    validateReachableBiomeDestinations(solverResult, contract, issues);
  }
  return issues;
}

function validateClusterMinimumLevelCounts(graph, solverResult, contract, issues) {
  const requirements = contract.required_cluster_minimum_level_counts ?? {};
  const levelsById = new Map((graph.levels ?? []).map((level) => [level.id, level]));
  for (const [cluster, minimumCount] of Object.entries(requirements)) {
    const count = (solverResult.solution.path ?? []).filter((levelId) => levelsById.get(levelId)?.cluster === cluster).length;
    if (count < Number(minimumCount)) {
      addIssue(
        issues,
        contract,
        'required_cluster_minimum_level_count',
        cluster,
        `Final solution visited ${count} ${cluster} level(s), expected at least ${minimumCount}.`,
      );
    }
  }
}

function validateReachableBiomeDestinations(solverResult, contract, issues) {
  const reachable = new Set(solverResult.reachable_level_ids ?? []);
  for (const levelId of contract.required_reachable_biome_destinations ?? []) {
    if (!reachable.has(levelId)) {
      addIssue(
        issues,
        contract,
        'required_reachable_biome_destination',
        levelId,
        `Required biome/area destination ${levelId} is not progression-reachable.`,
      );
    }
  }
}

function getReachableBiomeDestinations(solverResult, contract) {
  const reachable = new Set(solverResult.reachable_level_ids ?? []);
  return (contract.required_reachable_biome_destinations ?? [])
    .filter((levelId) => reachable.has(levelId))
    .sort();
}

function addIssue(issues, contract, rule, levelId, message) {
  const severity = contract.rules?.[rule]?.severity ?? 'warning';
  if (severity === 'off') {
    return;
  }
  issues.push({
    rule,
    severity,
    level_id: levelId,
    message,
  });
}

function serializeState(state) {
  return {
    level_id: state.level_id,
    path: state.path,
    items: [...state.items].sort(),
    abilities: [...state.abilities].sort(),
    completed_levels: [...state.completed_levels].sort(),
    defeated_enemy_groups: [...state.defeated_enemy_groups].sort(),
    defeated_bosses: [...state.defeated_bosses].sort(),
    gameplay_beats: [...state.gameplay_beats].sort(),
  };
}

function stateKey(state) {
  return [
    state.level_id,
    [...state.items].sort().join(','),
    [...state.abilities].sort().join(','),
    [...state.completed_levels].sort().join(','),
    [...state.defeated_enemy_groups].sort().join(','),
    [...state.defeated_bosses].sort().join(','),
    [...state.gameplay_beats].sort().join(','),
  ].join('|');
}

function parseJsonOrNull(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function sortRecordArrays(record) {
  return Object.fromEntries(
    Object.entries(record)
      .sort()
      .map(([key, values]) => [key, [...new Set(values)].sort()]),
  );
}

function relativeToRepo(path) {
  return relative(repoRoot, path);
}

function printHumanReport(report) {
  console.log(`[godot:progression-solver] explored_states=${report.explored_state_count}`);
  if (report.solution !== null) {
    console.log(`[godot:progression-solver] ${report.solution.path.join(' -> ')}`);
  }
  for (const issue of report.issues) {
    console.log(`[godot:progression-solver] ${issue.severity} ${issue.rule}: ${issue.message}`);
  }
  if (report.failed_checks.length === 0) {
    console.log('[godot:progression-solver] passed');
  }
}
