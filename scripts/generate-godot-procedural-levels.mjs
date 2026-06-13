import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const repoRoot = process.cwd();
const manifestPath = join(repoRoot, 'godot', 'levels', 'stage_manifest.json');
const catalogSourcePath = join(repoRoot, 'godot', 'levels', 'level_catalog.source.json');
const outputPath = join(repoRoot, 'godot', 'levels', 'generated', 'procedural_levels.json');
const checkOnly = process.argv.includes('--check');
const doorTriggerRadius = 48;
const minSpawnDoorDistance = 64;
const doorSafeRadius = 96;
const minPlatformClearancePx = 36;
const maxBottomFloorGapPx = 0;
const verticalSpawnClearanceRadius = 72;
const verticalMaxSpawnDropDistance = 96;
const branchDensityMinimum = 0.2;

const manifest = loadJson(manifestPath, 'stage manifest');
const catalogSource = loadJson(catalogSourcePath, 'Godot level catalog source');
const stageIdToGodotId = buildStageIdMap(catalogSource);
const exportData = buildProceduralLevelExport(manifest, stageIdToGodotId);
const nextOutputText = `${JSON.stringify(exportData, null, 2)}\n`;

if (checkOnly) {
  const currentOutputText = existsSync(outputPath) ? readFileSync(outputPath, 'utf8') : '';
  if (currentOutputText !== nextOutputText) {
    console.error('[godot:procedural-levels] procedural_levels.json is out of date; run npm run godot:procedural-levels.');
    process.exit(1);
  }

  console.log(`[godot:procedural-levels] procedural_levels.json is up to date; exported ${exportData.levels.length} procedural levels.`);
  process.exit(0);
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, nextOutputText);
console.log(`[godot:procedural-levels] wrote godot/levels/generated/procedural_levels.json; exported ${exportData.levels.length} procedural levels.`);

function loadJson(filePath, label) {
  if (!existsSync(filePath)) {
    throw new Error(`Missing ${label}: ${filePath}`);
  }

  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function buildStageIdMap(source) {
  if (source?.version !== 1 || !Array.isArray(source.levels)) {
    throw new Error('Godot level catalog source must have version 1 and a levels array');
  }

  const idMap = new Map();
  for (const level of source.levels) {
    if (typeof level.stage_id === 'string' && level.stage_id.length > 0) {
      idMap.set(level.stage_id, requireString(level.id, `${level.stage_id}.id`));
    }
  }
  return idMap;
}

function buildProceduralLevelExport(stageManifest, idMap) {
  if (stageManifest?.version !== 1 || !Array.isArray(stageManifest.stages)) {
    throw new Error('Stage manifest must have version 1 and a stages array');
  }

  const proceduralStages = stageManifest.stages
    .filter((stage) => stage.origin === 'generated_schema')
    .sort((left, right) => requireString(left.id, 'stage.id').localeCompare(requireString(right.id, 'stage.id')));

  const levels = proceduralStages.map((stage) => buildProceduralLevel(stage, idMap));

  return {
    version: 1,
    generated_from: 'godot/levels/stage_manifest.json',
    validation: {
      branch_density_minimum: branchDensityMinimum,
      branch_density_by_cluster: buildBranchDensityByCluster(proceduralStages),
      multi_shape_layout_minimum: 4,
      multi_shape_layouts_by_shape: buildMultiShapeLayoutMetrics(levels),
      branch_exit_rule_count: countBranchExitRules(levels),
    },
    levels,
  };
}

function buildBranchDensityByCluster(stages) {
  const densityByCluster = {};
  for (const stage of stages) {
    const cluster = String(stage.metadata?.cluster ?? 'unknown');
    if (densityByCluster[cluster] === undefined) {
      densityByCluster[cluster] = {
        level_count: 0,
        branch_level_count: 0,
        ratio: 0,
      };
    }

    densityByCluster[cluster].level_count += 1;
    if (Array.isArray(stage.dead_ends) && stage.dead_ends.length > 0) {
      densityByCluster[cluster].branch_level_count += 1;
    }
  }

  for (const [cluster, density] of Object.entries(densityByCluster)) {
    density.ratio = Number((density.branch_level_count / density.level_count).toFixed(4));
    if (density.ratio < branchDensityMinimum) {
      throw new Error(`${cluster} generated branch density ${density.ratio} is below ${branchDensityMinimum}`);
    }
  }

  return densityByCluster;
}

function buildProceduralLevel(stage, idMap) {
  const stageId = requireString(stage.id, 'stage.id');
  const stageNeighbors = normalizeNeighbors(stage.neighbors ?? {});
  const godotNeighbors = Object.fromEntries(
    Object.entries(stageNeighbors).map(([direction, targetStageId]) => [
      direction,
      mapStageIdToGodotId(targetStageId, idMap),
    ]),
  );

  return {
    id: mapStageIdToGodotId(stageId, idMap),
    stage_id: stageId,
    name: requireString(stage.name, `${stageId}.name`),
    layout: normalizeLayout(stage.layout, stageId),
    metadata: normalizeMetadata(stage.metadata ?? {}, stageId),
    runtime_layout: buildRuntimeLayout(stage.layout, stage.metadata ?? {}, stageId, godotNeighbors, stage.dead_ends ?? []),
    stage_neighbors: stageNeighbors,
    neighbors: godotNeighbors,
    scene_strategy: 'generated_schema',
  };
}

function buildRuntimeLayout(layout, metadata, stageId, neighbors, deadEnds) {
  const normalizedLayout = normalizeLayout(layout, stageId);
  const normalizedMetadata = normalizeMetadata(metadata, stageId);
  const difficulty = Number(normalizedMetadata.difficulty ?? 1);
  const levelId = mapStageIdToGodotId(stageId, new Map());
  const cluster = String(normalizedMetadata.cluster ?? 'void');
  const roomVariant = hasVerticalRoute(neighbors) ? 'vertical_route' : 'horizontal_route';
  const shapeProfile = getRuntimeShapeProfile(cluster, difficulty, neighbors, deadEnds);

  return {
    tile_size: {
      x: normalizedLayout.tile_size,
      y: normalizedLayout.tile_size,
    },
    grid: {
      columns: normalizedLayout.columns,
      rows: normalizedLayout.rows,
    },
    room: {
      width: 760,
      height: 432,
      variant: roomVariant,
      shape_profile: shapeProfile,
    },
    camera_bounds: {
      position: { x: 380, y: 178 },
      size: { x: 840, y: 540 },
    },
    spawns: {
      default: { x: 96, y: 368 },
      west: { x: 112, y: 368 },
      east: { x: 624, y: 368 },
      north: { x: 380, y: 160 },
      south: { x: 380, y: 336 },
    },
    doors: {
      west: { x: 16, y: 368 },
      east: { x: 704, y: 368 },
      north: { x: 380, y: 96 },
      south: { x: 380, y: 416 },
    },
    safety: {
      door_trigger_radius: doorTriggerRadius,
      min_spawn_door_distance: minSpawnDoorDistance,
      door_safe_radius: doorSafeRadius,
      min_platform_clearance_px: minPlatformClearancePx,
      max_bottom_floor_gap_px: maxBottomFloorGapPx,
      ...(roomVariant === 'vertical_route'
        ? {
            vertical_transition: {
              enabled: true,
              max_spawn_drop_distance: verticalMaxSpawnDropDistance,
              spawn_clearance_radius: verticalSpawnClearanceRadius,
              protected_spawn_ids: ['north', 'south'],
              landing_surface_ids: ['GeneratedPlatformVerticalLanding', 'Floor'],
            },
          }
        : {}),
    },
    floor: {
      id: 'Floor',
      position: { x: 380, y: 432 },
      size: { x: 760, y: 32 },
    },
    floor_segments: buildRuntimeFloorSegments(shapeProfile),
    platforms: buildRuntimePlatforms(difficulty, roomVariant),
    branch_exit_rules: buildRuntimeBranchExitRules(cluster, neighbors),
    content: buildRuntimeContent(levelId, cluster, difficulty, neighbors, deadEnds, normalizedLayout.tile_size),
  };
}

function buildMultiShapeLayoutMetrics(levels) {
  const counts = {};
  for (const level of levels) {
    const shape = String(level.runtime_layout?.room?.shape_profile ?? 'single_corridor');
    counts[shape] = (counts[shape] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function countBranchExitRules(levels) {
  return levels.reduce((count, level) => count + (level.runtime_layout?.branch_exit_rules?.length ?? 0), 0);
}

function getRuntimeShapeProfile(cluster, difficulty, neighbors, deadEnds) {
  if (shouldAddGeneratedGoal(cluster, neighbors)) {
    return 'terminal_goal';
  }

  if (shouldAddGeneratedCollectible(neighbors)) {
    return 'reliquary_gate';
  }

  if (hasVerticalRoute(neighbors)) {
    return 'vertical_route';
  }

  if (Array.isArray(deadEnds) && deadEnds.length > 0) {
    return 'branch_room';
  }

  if (difficulty >= 4) {
    return 'arena_route';
  }

  return 'single_corridor';
}

function buildRuntimeFloorSegments(shapeProfile) {
  const floorMain = {
    id: 'FloorMain',
    position: { x: 380, y: 432 },
    size: { x: 760, y: 32 },
  };

  switch (shapeProfile) {
    case 'branch_room':
      return [
        floorMain,
        {
          id: 'FloorBranchLeft',
          position: { x: 128, y: 320 },
          size: { x: 192, y: 24 },
        },
        {
          id: 'FloorBranchHigh',
          position: { x: 560, y: 192 },
          size: { x: 160, y: 24 },
        },
      ];
    case 'reliquary_gate':
      return [
        floorMain,
        {
          id: 'FloorGateApproach',
          position: { x: 636, y: 368 },
          size: { x: 160, y: 24 },
        },
      ];
    case 'terminal_goal':
      return [
        floorMain,
        {
          id: 'FloorGoalDais',
          position: { x: 224, y: 368 },
          size: { x: 176, y: 24 },
        },
      ];
    case 'vertical_route':
      return [
        floorMain,
        {
          id: 'FloorVerticalLower',
          position: { x: 380, y: 368 },
          size: { x: 240, y: 24 },
        },
      ];
    case 'arena_route':
      return [
        floorMain,
        {
          id: 'FloorArenaLeft',
          position: { x: 188, y: 344 },
          size: { x: 144, y: 24 },
        },
        {
          id: 'FloorArenaRight',
          position: { x: 572, y: 344 },
          size: { x: 144, y: 24 },
        },
      ];
    default:
      return [floorMain];
  }
}

function buildRuntimeBranchExitRules(cluster, neighbors) {
  return Object.entries(neighbors)
    .map(([direction, targetLevelId]) => buildRuntimeBranchExitRule(cluster, direction, String(targetLevelId)))
    .filter((rule) => rule !== null)
    .sort((left, right) => left.direction.localeCompare(right.direction));
}

function buildRuntimeBranchExitRule(cluster, direction, targetLevelId) {
  if (targetLevelId.endsWith('_reliquary')) {
    return {
      direction,
      target_level_id: targetLevelId,
      rule_type: 'reliquary_requires_route_shard',
      required_item_id: `${cluster}-generated-shard`,
    };
  }

  const requiredKeystone = getClusterEntryKeystoneRequirement(targetLevelId);
  if (requiredKeystone !== '') {
    return {
      direction,
      target_level_id: targetLevelId,
      rule_type: 'cross_cluster_keystone',
      required_keystone_item_id: requiredKeystone,
    };
  }

  if (targetLevelId.includes('labyrinth_')) {
    return {
      direction,
      target_level_id: targetLevelId,
      rule_type: 'route_continue',
    };
  }

  return null;
}

function getClusterEntryKeystoneRequirement(targetLevelId) {
  switch (targetLevelId) {
    case 'ice_area':
      return 'forest-keystone';
    case 'fire_area':
      return 'ice-keystone';
    case 'cave_area':
    case 'goal_sanctum':
      return 'fire-keystone';
    case 'sky_sanctum':
      return 'cave-keystone';
    default:
      return '';
  }
}

function buildRuntimePlatforms(difficulty, roomVariant) {
  const platforms = [];
  if (difficulty >= 2) {
    platforms.push({
      id: 'GeneratedPlatformLow',
      position: { x: 328, y: 344 },
      size: { x: 144, y: 24 },
    });
  }

  if (difficulty >= 3) {
    platforms.push({
      id: 'GeneratedPlatformHigh',
      position: { x: 548, y: 280 },
      size: { x: 128, y: 24 },
    });
  }

  if (roomVariant === 'vertical_route') {
    platforms.push({
      id: 'GeneratedPlatformVerticalLanding',
      position: { x: 380, y: 200 },
      size: { x: 160, y: 24 },
    });
    platforms.push({
      id: 'GeneratedPlatformVerticalStep',
      position: { x: 380, y: 284 },
      size: { x: 120, y: 24 },
    });
  }

  return platforms;
}

function buildRuntimeContent(levelId, cluster, difficulty, neighbors, deadEnds, tileSize) {
  return {
    objective: buildRuntimeObjective(levelId, cluster, difficulty, neighbors),
    enemies: buildRuntimeEnemies(levelId, cluster, difficulty),
    heals: difficulty >= 2 ? buildRuntimeHeals(levelId, deadEnds, tileSize) : [],
    collectibles: buildRuntimeCollectibles(levelId, cluster, neighbors),
    hazards: buildRuntimeHazards(levelId, cluster, difficulty),
    ability_gates: buildRuntimeAbilityGates(levelId, cluster, difficulty),
    goals: shouldAddGeneratedGoal(cluster, neighbors)
      ? [
          {
            id: 'GeneratedGoalMarker',
            goal_id: `${levelId}_generated_goal`,
            result_label: 'complete',
            trigger_radius: 48,
            position: { x: 224, y: 368 },
          },
        ]
      : [],
  };
}

function buildRuntimeCollectibles(levelId, cluster, neighbors) {
  const collectibles = [];
  if (shouldAddGeneratedCollectible(neighbors)) {
    collectibles.push({
      id: 'GeneratedCollectibleMarker',
      collectible_id: `${levelId}_generated_shard`,
      item_id: `${cluster}-generated-shard`,
      trigger_radius: 48,
      position: { x: 592, y: 368 },
    });
  }

  if (levelId === 'labyrinth_011') {
    collectibles.push({
      id: 'GeneratedCollectibleMarkerFireRouteCache',
      collectible_id: 'fire_route_cache',
      item_id: 'fire-route-cache',
      trigger_radius: 48,
      position: { x: 380, y: 320 },
    });
  }

  return collectibles;
}

function buildRuntimeEnemies(levelId, cluster, difficulty) {
  const enemyType = getGeneratedEnemyType(cluster);
  if (levelId === 'labyrinth_132') {
    return [
      {
        id: 'GeneratedFinalBossSpawn',
        spawn_id: 'labyrinth_132_final_boss',
        enemy_type: enemyType,
        ability_type: 'spark',
        enemy_group_id: 'labyrinth_132_final_guard',
        boss_id: 'labyrinth_132_final_boss',
        contact_damage: 1,
        attack_damage: 1,
        attack_radius: 172,
        attack_cooldown_ms: 4000,
        patrol_radius: 128,
        position: { x: 420, y: 320 },
      },
    ];
  }

  if (difficulty < 2) {
    return [];
  }

  const abilityType = getGeneratedAbilityType(cluster);
  const enemies = [
    {
      id: 'GeneratedEnemySpawn',
      spawn_id: `${levelId}_generated_enemy`,
      enemy_type: enemyType,
      ability_type: abilityType,
      contact_damage: 1,
      attack_damage: 1,
      attack_radius: 112,
      attack_cooldown_ms: 4000,
      patrol_radius: 64,
      position: { x: 256, y: 368 },
    },
  ];

  if (difficulty >= 3) {
    enemies.push({
      id: 'GeneratedFlyingEnemySpawn',
      spawn_id: `${levelId}_generated_flying`,
      enemy_type: enemyType,
      ability_type: abilityType,
      contact_damage: 1,
      attack_damage: 1,
      attack_radius: 148,
      attack_cooldown_ms: 4000,
      patrol_radius: 96,
      position: { x: 520, y: 320 },
    });
  }

  if (difficulty >= 4) {
    enemies.push({
      id: 'GeneratedEliteEnemySpawn',
      spawn_id: `${levelId}_generated_elite`,
      enemy_type: enemyType,
      ability_type: abilityType,
      contact_damage: 1,
      attack_damage: 1,
      attack_radius: 172,
      attack_cooldown_ms: 4000,
      patrol_radius: 128,
      position: { x: 220, y: 280 },
    });
  }

  return enemies;
}

function buildRuntimeObjective(levelId, cluster, difficulty, neighbors) {
  if (shouldAddGeneratedGoal(cluster, neighbors)) {
    return {
      objective_type: 'goal',
      objective_id: `${levelId}_goal`,
    };
  }

  if (shouldAddGeneratedCollectible(neighbors)) {
    return {
      objective_type: 'collect_key',
      objective_id: `${levelId}_collect_key`,
      required_item_id: `${cluster}-generated-shard`,
    };
  }

  if (difficulty >= 2) {
    return {
      objective_type: 'defeat_enemies',
      objective_id: `${levelId}_defeat_enemies`,
    };
  }

  return {
    objective_type: 'explore',
    objective_id: `${levelId}_explore`,
  };
}

function buildRuntimeHazards(levelId, cluster, difficulty) {
  if (difficulty < 2) {
    return [];
  }

  const isFire = cluster === 'fire';
  return [
    {
      id: 'GeneratedHazardMarker',
      hazard_id: `${levelId}_${isFire ? 'lava' : 'spike'}_hazard`,
      hazard_type: isFire ? 'lava' : 'spike',
      damage: 1,
      trigger_radius: 40,
      position: { x: 252, y: 288 },
    },
  ];
}

function buildRuntimeAbilityGates(levelId, cluster, difficulty) {
  const gateSpec = getGeneratedGateSpec(cluster);
  if (gateSpec === undefined || difficulty < 2) {
    return [];
  }

  return [
    {
      id: 'GeneratedAbilityGateMarker',
      gate_id: `${levelId}_${gateSpec.id}_gate`,
      required_ability_type: gateSpec.requiredAbilityType,
      gate_effect: gateSpec.gateEffect,
      trigger_radius: 96,
      position: { x: 500, y: 368 },
    },
  ];
}

function buildRuntimeHeals(levelId, deadEnds, tileSize) {
  return [
    {
      id: 'GeneratedHealMarkerRoute',
      heal_id: `${levelId}_generated_heal`,
      amount: 3,
      reward_type: 'health',
      position: { x: 520, y: 368 },
    },
    ...buildRuntimeDeadEndHeals(levelId, deadEnds, tileSize),
  ];
}

function buildRuntimeDeadEndHeals(levelId, deadEnds, tileSize) {
  if (!Array.isArray(deadEnds) || deadEnds.length === 0) {
    return [];
  }

  return deadEnds.map((deadEnd) => {
    const reward = typeof deadEnd.reward === 'string' && deadEnd.reward.length > 0 ? deadEnd.reward : 'health';
    const healId = `${levelId}_dead_end_${reward.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '')}`;
    return {
      id: `GeneratedHealMarker${toPascalCase(reward)}`,
      heal_id: healId,
      dead_end_id: healId,
      amount: 1,
      reward_type: reward,
      position: {
        x: getDoorSafeDeadEndX(Number(deadEnd.column), tileSize),
        y: (Number(deadEnd.row) * tileSize) + (tileSize / 2),
      },
    };
  });
}

function getDoorSafeDeadEndX(column, tileSize) {
  const x = (column * tileSize) + (tileSize / 2);
  return x < 96 ? 112 : x;
}

function toPascalCase(value) {
  return String(value)
    .split(/[^a-z0-9]+/i)
    .filter((part) => part.length > 0)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join('');
}

function getGeneratedAbilityType(cluster) {
  switch (cluster) {
    case 'forest':
      return 'leaf';
    case 'ice':
      return 'frost';
    case 'fire':
      return 'flame';
    case 'sky':
      return 'spark';
    case 'ruins':
      return 'stone';
    default:
      return 'spark';
  }
}

function getGeneratedEnemyType(cluster) {
  switch (cluster) {
    case 'forest':
      return 'leaf_sprite';
    case 'ice':
      return 'frost_flyer';
    case 'fire':
      return 'fire_imp';
    case 'ruins':
      return 'stone_sentry';
    case 'sky':
      return 'spark_wisp';
    default:
      return 'spark_wisp';
  }
}

function getGeneratedGateSpec(cluster) {
  switch (cluster) {
    case 'forest':
      return {
        id: 'sword',
        requiredAbilityType: 'sword',
        gateEffect: 'cut_vines',
      };
    case 'ice':
      return {
        id: 'ice',
        requiredAbilityType: 'ice',
        gateEffect: 'freeze_water',
      };
    case 'fire':
      return {
        id: 'fire',
        requiredAbilityType: 'fire',
        gateEffect: 'melt_ice',
      };
    case 'sky':
      return {
        id: 'spark',
        requiredAbilityType: 'spark',
        gateEffect: 'power_device',
      };
    case 'ruins':
      return {
        id: 'stone',
        requiredAbilityType: 'stone',
        gateEffect: 'press_switch',
      };
    default:
      return undefined;
  }
}

function shouldAddGeneratedCollectible(neighbors) {
  return Object.values(neighbors).some((targetLevelId) => String(targetLevelId).endsWith('_reliquary'));
}

function shouldAddGeneratedGoal(cluster, neighbors) {
  return cluster === 'void' && Object.keys(neighbors).length === 1 && neighbors.west !== undefined;
}

function hasVerticalRoute(neighbors) {
  return neighbors.north !== undefined || neighbors.south !== undefined;
}

function normalizeNeighbors(neighbors) {
  if (typeof neighbors !== 'object' || neighbors === null || Array.isArray(neighbors)) {
    throw new Error('Procedural stage neighbors must be an object');
  }

  return Object.fromEntries(
    Object.entries(neighbors)
      .map(([direction, targetStageId]) => [direction, requireString(targetStageId, `neighbors.${direction}`)])
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function normalizeLayout(layout, stageId) {
  if (typeof layout !== 'object' || layout === null || Array.isArray(layout)) {
    throw new Error(`Procedural stage ${stageId} layout must be an object`);
  }

  return {
    rows: requireNumber(layout.rows, `${stageId}.layout.rows`),
    columns: requireNumber(layout.columns, `${stageId}.layout.columns`),
    tile_size: requireNumber(layout.tile_size, `${stageId}.layout.tile_size`),
  };
}

function normalizeMetadata(metadata, stageId) {
  if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
    throw new Error(`Procedural stage ${stageId} metadata must be an object`);
  }

  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function mapStageIdToGodotId(stageId, idMap) {
  if (idMap.has(stageId)) {
    return idMap.get(stageId);
  }

  if (/^labyrinth-\d{3}$/.test(stageId)) {
    return stageId.replaceAll('-', '_');
  }

  return stageId.replaceAll('-', '_');
}

function requireString(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Expected non-empty string for ${fieldName}`);
  }

  return value;
}

function requireNumber(value, fieldName) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Expected finite number for ${fieldName}`);
  }

  return value;
}
