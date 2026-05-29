import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const repoRoot = process.cwd();
const manifestPath = join(repoRoot, 'godot', 'levels', 'stage_manifest.json');
const catalogSourcePath = join(repoRoot, 'godot', 'levels', 'level_catalog.source.json');
const outputPath = join(repoRoot, 'godot', 'levels', 'generated', 'procedural_levels.json');
const checkOnly = process.argv.includes('--check');
const doorTriggerRadius = 48;
const minSpawnDoorDistance = 64;

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

  return {
    version: 1,
    generated_from: 'godot/levels/stage_manifest.json',
    levels: proceduralStages.map((stage) => buildProceduralLevel(stage, idMap)),
  };
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
    },
    camera_bounds: {
      position: { x: 380, y: 270 },
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
    },
    floor: {
      id: 'Floor',
      position: { x: 380, y: 432 },
      size: { x: 760, y: 32 },
    },
    platforms: buildRuntimePlatforms(difficulty, roomVariant),
    content: buildRuntimeContent(levelId, cluster, difficulty, neighbors, deadEnds, normalizedLayout.tile_size),
  };
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
      id: 'GeneratedPlatformVerticalStep',
      position: { x: 380, y: 304 },
      size: { x: 120, y: 24 },
    });
  }

  return platforms;
}

function buildRuntimeContent(levelId, cluster, difficulty, neighbors, deadEnds, tileSize) {
  return {
    enemies: difficulty >= 2
      ? [
          {
            id: 'GeneratedEnemySpawn',
            spawn_id: `${levelId}_generated_enemy`,
            enemy_type: 'generated_ground',
            ability_type: getGeneratedAbilityType(cluster),
            contact_damage: 1,
            position: { x: 336, y: 400 },
          },
        ]
      : [],
    heals: difficulty >= 2 ? buildRuntimeHeals(levelId, deadEnds, tileSize) : [],
    collectibles: shouldAddGeneratedCollectible(neighbors)
      ? [
          {
            id: 'GeneratedCollectibleMarker',
            collectible_id: `${levelId}_generated_shard`,
            item_id: `${cluster}-generated-shard`,
            trigger_radius: 48,
            position: { x: 592, y: 368 },
          },
        ]
      : [],
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

function buildRuntimeHeals(levelId, deadEnds, tileSize) {
  return [
    {
      id: 'GeneratedHealMarkerRoute',
      heal_id: `${levelId}_generated_heal`,
      amount: 1,
      reward_type: 'health',
      position: { x: 456, y: 368 },
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
    return {
      id: `GeneratedHealMarker${toPascalCase(reward)}`,
      heal_id: `${levelId}_dead_end_${reward.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '')}`,
      amount: 1,
      reward_type: reward,
      position: {
        x: (Number(deadEnd.column) * tileSize) + (tileSize / 2),
        y: (Number(deadEnd.row) * tileSize) + (tileSize / 2),
      },
    };
  });
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
