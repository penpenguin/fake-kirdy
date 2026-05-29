import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = process.cwd();
const sourcePath = join(repoRoot, 'godot', 'levels', 'level_catalog.source.json');
const outputPath = join(repoRoot, 'godot', 'levels', 'level_catalog.json');
const stageManifestPath = join(repoRoot, 'godot', 'levels', 'stage_manifest.json');
const checkOnly = process.argv.includes('--check');

const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
const stageManifest = loadStageManifest();
const validation = validateSource(source, stageManifest);

const catalog = {
  version: source.version,
  levels: source.levels.map(({ id, scene_path, tags, source_ref }) => ({
    id,
    scene_path,
    tags,
    source_ref,
  })),
};
const nextCatalogText = `${JSON.stringify(catalog, null, 2)}\n`;

if (checkOnly) {
  const currentCatalogText = existsSync(outputPath) ? readFileSync(outputPath, 'utf8') : '';
  if (currentCatalogText !== nextCatalogText) {
    console.error('[godot:catalog] level_catalog.json is out of date; run npm run godot:catalog.');
    process.exit(1);
  }

  console.log('[godot:catalog] level_catalog.json is up to date.');
  console.log(`[godot:catalog] validated ${validation.stageMappings} canonical stage ${pluralizeMapping(validation.stageMappings)}.`);
  console.log(`[godot:catalog] validated expected_collectibles for ${validation.collectibleMappings} level ${validation.collectibleMappings === 1 ? 'mapping' : 'mappings'}.`);
  console.log(`[godot:catalog] validated expected_dead_end_rewards for ${validation.deadEndRewardMappings} level ${validation.deadEndRewardMappings === 1 ? 'mapping' : 'mappings'}.`);
  console.log('[godot:catalog] validated catalog mappings against stage_manifest.json.');
  process.exit(0);
}

writeFileSync(outputPath, nextCatalogText);
console.log('[godot:catalog] wrote godot/levels/level_catalog.json');
console.log(`[godot:catalog] validated ${validation.stageMappings} canonical stage ${pluralizeMapping(validation.stageMappings)}.`);
console.log(`[godot:catalog] validated expected_collectibles for ${validation.collectibleMappings} level ${validation.collectibleMappings === 1 ? 'mapping' : 'mappings'}.`);
console.log(`[godot:catalog] validated expected_dead_end_rewards for ${validation.deadEndRewardMappings} level ${validation.deadEndRewardMappings === 1 ? 'mapping' : 'mappings'}.`);
console.log('[godot:catalog] validated catalog mappings against stage_manifest.json.');

function validateSource(data, stageManifest) {
  if (data?.version !== 1 || !Array.isArray(data.levels)) {
    throw new Error('Level catalog source must have version 1 and a levels array');
  }

  const stagesById = new Map(stageManifest.stages.map((stage) => [stage.id, stage]));
  const seenIds = new Set();
  let stageMappings = 0;
  let collectibleMappings = 0;
  let deadEndRewardMappings = 0;
  for (const level of data.levels) {
    const id = requireString(level.id, 'id');
    const scenePath = requireString(level.scene_path, `${id}.scene_path`);
    const tags = level.tags;
    const migrationStatus = requireString(level.migration_status, `${id}.migration_status`);

    if (seenIds.has(id)) {
      throw new Error(`Duplicate level id: ${id}`);
    }
    seenIds.add(id);

    if (!Array.isArray(tags) || tags.length === 0 || tags.some((tag) => typeof tag !== 'string')) {
      throw new Error(`Level ${id} must define non-empty string tags`);
    }

    if (migrationStatus.length === 0) {
      throw new Error(`Level ${id} must define migration_status`);
    }

    const localScenePath = godotPathToRepoPath(scenePath);
    if (!existsSync(localScenePath)) {
      throw new Error(`Level ${id} scene does not exist: ${scenePath}`);
    }

    const sourceRef = String(level.source_ref ?? '');
    if (sourceRef !== '' && !sourceRef.startsWith('stage_manifest:') && !existsSync(join(repoRoot, sourceRef))) {
      throw new Error(`Level ${id} source_ref does not exist: ${sourceRef}`);
    }

    if (typeof level.stage_id === 'string' && level.stage_id !== '') {
      const levelValidation = validateStageMapping(level, sourceRef, stagesById);
      stageMappings += 1;
      if (levelValidation.hasCollectibleExpectations) {
        collectibleMappings += 1;
      }
      if (levelValidation.hasDeadEndRewardExpectations) {
        deadEndRewardMappings += 1;
      }
    }
  }

  return { stageMappings, collectibleMappings, deadEndRewardMappings };
}


function loadStageManifest() {
  if (!existsSync(stageManifestPath)) {
    throw new Error('Missing godot/levels/stage_manifest.json; run npm run godot:stage-manifest.');
  }

  const manifest = JSON.parse(readFileSync(stageManifestPath, 'utf8'));
  if (manifest?.version !== 1 || !Array.isArray(manifest.stages)) {
    throw new Error('Stage manifest must have version 1 and a stages array');
  }

  return manifest;
}


function validateStageMapping(level, sourceRef, stagesById) {
  if (sourceRef === '') {
    throw new Error(`Level ${level.id} defines stage_id without source_ref`);
  }

  const stageId = String(level.stage_id);
  const stage = stagesById.get(stageId);
  if (stage === undefined) {
    throw new Error(`Level ${level.id} stage_id is missing from stage_manifest.json: ${stageId}`);
  }

  if (sourceRef !== `stage_manifest:${stageId}`) {
    throw new Error(`Level ${level.id} source_ref must be stage_manifest:${stageId}`);
  }

  if (!Array.isArray(level.expected_neighbors)) {
    throw new Error(`Level ${level.id} with stage_id must define expected_neighbors`);
  }

  for (const neighborId of level.expected_neighbors) {
    if (typeof neighborId !== 'string' || neighborId.length === 0) {
      throw new Error(`Level ${level.id} expected_neighbors must be non-empty strings`);
    }

    if (!Object.values(stage.neighbors ?? {}).includes(neighborId)) {
      throw new Error(`Level ${level.id} expected neighbor missing from stage_manifest.json: ${neighborId}`);
    }
  }

  if (level.expected_metadata !== undefined) {
    validateExpectedMetadata(level, stage);
  }

  const hasCollectibleExpectations = level.expected_collectibles !== undefined;
  if (hasCollectibleExpectations) {
    validateExpectedCollectibles(level, stage);
  }

  const hasDeadEndRewardExpectations = level.expected_dead_end_rewards !== undefined;
  if (hasDeadEndRewardExpectations) {
    validateExpectedDeadEndRewards(level, stage);
  }

  return { hasCollectibleExpectations, hasDeadEndRewardExpectations };
}

function validateExpectedMetadata(level, stage) {
  if (
    typeof level.expected_metadata !== 'object' ||
    level.expected_metadata === null ||
    Array.isArray(level.expected_metadata)
  ) {
    throw new Error(`Level ${level.id} expected_metadata must be an object`);
  }

  for (const [field, expectedValue] of Object.entries(level.expected_metadata)) {
    if (!isSupportedExpectedValue(expectedValue)) {
      throw new Error(`Level ${level.id} expected_metadata.${field} must be a string, number, or boolean`);
    }

    if (stage.metadata?.[field] !== expectedValue) {
      throw new Error(`Level ${level.id} expected metadata missing from stage_manifest.json: ${field}=${expectedValue}`);
    }
  }
}

function validateExpectedCollectibles(level, stage) {
  if (
    !Array.isArray(level.expected_collectibles) ||
    level.expected_collectibles.some((collectibleId) => typeof collectibleId !== 'string' || collectibleId.length === 0)
  ) {
    throw new Error(`Level ${level.id} expected_collectibles must be non-empty strings`);
  }

  const stageCollectibleIds = new Set(
    (stage.collectibles ?? []).flatMap((collectible) => [collectible.id, collectible.itemId].filter((value) => typeof value === 'string')),
  );

  for (const expectedCollectibleId of level.expected_collectibles) {
    if (!stageCollectibleIds.has(expectedCollectibleId)) {
      throw new Error(`Level ${level.id} expected collectible missing from stage_manifest.json: ${expectedCollectibleId}`);
    }
  }
}

function validateExpectedDeadEndRewards(level, stage) {
  if (
    !Array.isArray(level.expected_dead_end_rewards) ||
    level.expected_dead_end_rewards.some((reward) => typeof reward !== 'string' || reward.length === 0)
  ) {
    throw new Error(`Level ${level.id} expected_dead_end_rewards must be non-empty strings`);
  }

  const stageRewards = new Set(
    (stage.dead_ends ?? []).map((deadEnd) => deadEnd.reward).filter((value) => typeof value === 'string'),
  );

  for (const expectedReward of level.expected_dead_end_rewards) {
    if (!stageRewards.has(expectedReward)) {
      throw new Error(`Level ${level.id} expected dead-end reward missing from stage_manifest.json: ${expectedReward}`);
    }
  }
}

function isSupportedExpectedValue(value) {
  return ['string', 'number', 'boolean'].includes(typeof value);
}

function pluralizeMapping(count) {
  return count === 1 ? 'mapping' : 'mappings';
}

function requireString(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Level catalog field ${fieldName} must be a non-empty string`);
  }

  return value;
}

function godotPathToRepoPath(godotPath) {
  if (!godotPath.startsWith('res://')) {
    throw new Error(`Godot scene path must start with res://: ${godotPath}`);
  }

  return join(repoRoot, 'godot', godotPath.slice('res://'.length));
}
