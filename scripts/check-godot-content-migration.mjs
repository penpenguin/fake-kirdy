import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = process.cwd();
const catalogSourcePath = join(repoRoot, 'godot', 'levels', 'level_catalog.source.json');
const stageManifestPath = join(repoRoot, 'godot', 'levels', 'phaser_stage_manifest.json');
const proceduralLevelsPath = join(repoRoot, 'godot', 'levels', 'generated', 'procedural_levels.json');

const catalogSource = readJson(catalogSourcePath);
const stageManifest = readJson(stageManifestPath);
const proceduralLevels = readJson(proceduralLevelsPath);

validateContentMigration(catalogSource, stageManifest, proceduralLevels);

function validateContentMigration(catalog, manifest, procedural) {
  if (catalog?.version !== 1 || !Array.isArray(catalog.levels)) {
    throw new Error('Level catalog source must have version 1 and a levels array');
  }
  if (manifest?.version !== 1 || !Array.isArray(manifest.stages)) {
    throw new Error('Phaser stage manifest must have version 1 and a stages array');
  }
  if (procedural?.version !== 1 || !Array.isArray(procedural.levels)) {
    throw new Error('Procedural levels must have version 1 and a levels array');
  }

  const stagesById = new Map(manifest.stages.map((stage) => [stage.id, stage]));
  const levelsByStageId = new Map(
    catalog.levels
      .filter((level) => typeof level.phaser_stage_id === 'string' && level.phaser_stage_id !== '')
      .map((level) => [level.phaser_stage_id, level]),
  );
  const levelIds = new Set(catalog.levels.map((level) => level.id).filter((id) => typeof id === 'string' && id !== ''));
  const generatedLevelIds = new Set();
  const generatedStageIds = new Set();
  let generatedNeighborEdges = 0;

  let validatedDoors = 0;
  let deferredNeighbors = 0;
  const validatedLines = [];

  for (const level of procedural.levels) {
    const levelId = requireString(level.id, 'procedural level id');
    const phaserStageId = requireString(level.phaser_stage_id, `${levelId}.phaser_stage_id`);

    if (level.scene_strategy !== 'generated_schema') {
      throw new Error(`${levelId} must use generated_schema scene_strategy`);
    }
    if (!stagesById.has(phaserStageId)) {
      throw new Error(`${levelId} references missing Phaser stage ${phaserStageId}`);
    }
    if (generatedLevelIds.has(levelId)) {
      throw new Error(`Duplicate generated level id: ${levelId}`);
    }
    if (generatedStageIds.has(phaserStageId)) {
      throw new Error(`Duplicate generated Phaser stage id: ${phaserStageId}`);
    }

    generatedLevelIds.add(levelId);
    generatedStageIds.add(phaserStageId);
  }

  for (const level of procedural.levels) {
    const levelId = requireString(level.id, 'procedural level id');
    const neighbors = level.neighbors ?? {};
    for (const [direction, targetLevelId] of Object.entries(neighbors)) {
      if (typeof targetLevelId !== 'string' || targetLevelId === '') {
        throw new Error(`${levelId}.${direction} must target a non-empty Godot level id`);
      }
      if (!generatedLevelIds.has(targetLevelId) && !levelIds.has(targetLevelId)) {
        throw new Error(`${levelId}.${direction} targets missing Godot level id ${targetLevelId}`);
      }
      generatedNeighborEdges += 1;
    }
  }

  for (const level of catalog.levels) {
    if (typeof level.phaser_stage_id !== 'string' || level.phaser_stage_id === '') {
      continue;
    }

    const stage = stagesById.get(level.phaser_stage_id);
    if (stage === undefined) {
      throw new Error(`Missing Phaser stage manifest entry for ${level.phaser_stage_id}`);
    }

    const expectedNeighbors = Array.isArray(level.expected_neighbors) ? level.expected_neighbors : [];
    const sceneTargets = readDoorTargets(level);

    for (const neighborStageId of expectedNeighbors) {
      if (!Object.values(stage.neighbors ?? {}).includes(neighborStageId)) {
        throw new Error(`${level.phaser_stage_id} does not declare expected neighbor ${neighborStageId} in phaser_stage_manifest.json`);
      }

      const targetLevel = levelsByStageId.get(neighborStageId);
      if (targetLevel === undefined) {
        deferredNeighbors += 1;
        continue;
      }

      if (!sceneTargets.has(targetLevel.id)) {
        throw new Error(`${level.id} scene is missing DoorMarker target_level_id "${targetLevel.id}" for Phaser edge ${level.phaser_stage_id} -> ${neighborStageId}`);
      }

      validatedDoors += 1;
      validatedLines.push(`${level.phaser_stage_id} -> ${neighborStageId} maps to ${level.id} -> ${targetLevel.id}`);
    }
  }

  const coveredStageIds = new Set([...levelsByStageId.keys(), ...generatedStageIds]);
  const missingStageIds = manifest.stages
    .map((stage) => stage.id)
    .filter((stageId) => !coveredStageIds.has(stageId));
  if (missingStageIds.length > 0) {
    throw new Error(`Missing Godot topology mapping for Phaser stage(s): ${missingStageIds.join(', ')}`);
  }

  console.log(`[godot:content-check] validated ${validatedDoors} mapped neighbor door(s).`);
  console.log(`[godot:content-check] deferred ${deferredNeighbors} unmapped neighbor(s).`);
  console.log(`[godot:content-check] validated ${coveredStageIds.size} Phaser stage topology mapping(s).`);
  console.log(`[godot:content-check] validated ${generatedLevelIds.size} generated schema level(s).`);
  console.log(`[godot:content-check] validated ${generatedNeighborEdges} generated neighbor edge(s).`);
  for (const line of validatedLines) {
    console.log(`[godot:content-check] ${line}`);
  }
}

function readDoorTargets(level) {
  const scenePath = godotPathToRepoPath(requireString(level.scene_path, `${level.id}.scene_path`));
  if (!existsSync(scenePath)) {
    throw new Error(`Level scene does not exist: ${level.scene_path}`);
  }

  const sceneText = readFileSync(scenePath, 'utf8');
  const targets = new Set();
  const matcher = /target_level_id\s*=\s*"([^"]+)"/g;
  let match = matcher.exec(sceneText);
  while (match !== null) {
    targets.add(match[1]);
    match = matcher.exec(sceneText);
  }

  return targets;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function requireString(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }

  return value;
}

function godotPathToRepoPath(godotPath) {
  if (!godotPath.startsWith('res://')) {
    throw new Error(`Godot scene path must start with res://: ${godotPath}`);
  }

  return join(repoRoot, 'godot', godotPath.slice('res://'.length));
}
