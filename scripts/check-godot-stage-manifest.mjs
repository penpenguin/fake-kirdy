import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = process.cwd();
const manifestPath = join(repoRoot, 'godot', 'levels', 'stage_manifest.json');

if (!existsSync(manifestPath)) {
  console.error('[godot:stage-manifest] missing godot/levels/stage_manifest.json');
  process.exit(1);
}

const manifestText = readFileSync(manifestPath, 'utf8');
const manifest = JSON.parse(manifestText);
const errors = validateStageManifest(manifest, manifestText);

if (errors.length > 0) {
  errors.forEach((error) => console.error(`[godot:stage-manifest] ${error}`));
  process.exit(1);
}

console.log(`[godot:stage-manifest] stage_manifest.json is up to date; validated ${manifest.stages.length} stages.`);

function validateStageManifest(value, rawText) {
  const validationErrors = [];
  if (value?.version !== 1) {
    validationErrors.push('version must be 1');
  }
  if (value?.canonical_source !== 'godot/levels/stage_manifest.json') {
    validationErrors.push('canonical_source must be godot/levels/stage_manifest.json');
  }
  if (!Array.isArray(value?.stages) || value.stages.length === 0) {
    validationErrors.push('stages must be a non-empty array');
    return validationErrors;
  }
  if (rawText.includes('legacy/phaser-reference') || rawText.includes('"source_path"') || rawText.includes('"procedural_generated"')) {
    validationErrors.push('manifest must not depend on legacy source paths or old generated flags');
  }

  const stageIds = new Set();
  for (const [index, stage] of value.stages.entries()) {
    validateStage(stage, index, stageIds, validationErrors);
  }

  for (const stage of value.stages) {
    for (const [direction, targetStageId] of Object.entries(stage.neighbors ?? {})) {
      if (!stageIds.has(targetStageId)) {
        validationErrors.push(`${stage.id}.neighbors.${direction} targets missing stage ${targetStageId}`);
      }
    }
  }

  const generatedCount = value.stages.filter((stage) => stage.origin === 'generated_schema').length;
  if (value.stages.length !== 146) {
    validationErrors.push(`expected 146 stages, got ${value.stages.length}`);
  }
  if (generatedCount !== 132) {
    validationErrors.push(`expected 132 generated_schema stages, got ${generatedCount}`);
  }

  return validationErrors;
}

function validateStage(stage, index, stageIds, validationErrors) {
  const prefix = `stages[${index}]`;
  if (stage === null || typeof stage !== 'object') {
    validationErrors.push(`${prefix} must be an object`);
    return;
  }
  if (typeof stage.id !== 'string' || stage.id.length === 0) {
    validationErrors.push(`${prefix}.id must be a non-empty string`);
  } else if (stageIds.has(stage.id)) {
    validationErrors.push(`${prefix}.id duplicates ${stage.id}`);
  } else {
    stageIds.add(stage.id);
  }
  if (!['authored', 'generated_schema'].includes(stage.origin)) {
    validationErrors.push(`${prefix}.origin must be authored or generated_schema`);
  }
  if (stage.layout?.rows <= 0 || stage.layout?.columns <= 0 || stage.layout?.tile_size <= 0) {
    validationErrors.push(`${prefix}.layout must define positive rows, columns, and tile_size`);
  }
  if (typeof stage.neighbors !== 'object' || stage.neighbors === null || Array.isArray(stage.neighbors)) {
    validationErrors.push(`${prefix}.neighbors must be an object`);
  }
}
