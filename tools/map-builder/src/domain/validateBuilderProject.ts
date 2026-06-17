import { isKebabCaseStageId, stageIdToGodotId } from './ids';
import { getEffectiveRuntimeLayout } from './applyRoomEdits';
import type {
  BuilderProject,
  GeneratedLevel,
  JsonObject,
  RuntimeContent,
  RuntimeLayout,
  ValidationIssue,
  Vector2,
} from './project';

const oppositeDirection: Record<string, string> = {
  west: 'east',
  east: 'west',
  north: 'south',
  south: 'north',
};

const contentCollections = ['enemies', 'heals', 'collectibles', 'hazards', 'ability_gates', 'goals'] as const;

export function validateBuilderProject(project: BuilderProject): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const stageIds = new Set(project.stageManifest.stages.map((stage) => stage.id));

  for (const stage of project.stageManifest.stages) {
    if (!isKebabCaseStageId(stage.id)) {
      issues.push(error(`stage_manifest.${stage.id}.id`, `Stage id ${stage.id} must be kebab-case.`));
    }

    if (!/^[a-z0-9_]+$/.test(stageIdToGodotId(stage.id))) {
      issues.push(error(`stage_manifest.${stage.id}.id`, `Stage id ${stage.id} cannot map to a snake_case Godot id.`));
    }

    for (const [direction, targetStageId] of Object.entries(stage.neighbors ?? {})) {
      if (!stageIds.has(targetStageId)) {
        issues.push(error(`stage_manifest.${stage.id}.neighbors.${direction}`, `Neighbor target ${targetStageId} does not exist.`));
      }
    }
  }

  const generatedByStageId = new Map(project.proceduralLevels.levels.map((level) => [level.stage_id, level]));
  for (const [stageId, override] of Object.entries(project.proceduralLevelOverrides.levels)) {
    const level = generatedByStageId.get(stageId);
    if (level === undefined) {
      issues.push(error(`procedural_level_overrides.${stageId}`, `Override target ${stageId} is not a generated schema stage.`));
      continue;
    }

    if (override.runtime_layout === undefined) {
      continue;
    }

    issues.push(...validateGeneratedRuntimeLayout(level, getEffectiveRuntimeLayout(level, project.proceduralLevelOverrides), stageId));
  }

  for (const level of project.proceduralLevels.levels) {
    issues.push(...validateGeneratedRuntimeLayout(level, getEffectiveRuntimeLayout(level, project.proceduralLevelOverrides), level.stage_id));
  }

  return dedupeIssues(issues);
}

function validateGeneratedRuntimeLayout(level: GeneratedLevel, layout: RuntimeLayout, stageId: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const safety = layout.safety ?? {};
  const minSpawnDoorDistance = numberValue(safety.min_spawn_door_distance, 64);
  const doorSafeRadius = numberValue(safety.door_safe_radius, 96);

  for (const direction of Object.keys(level.neighbors ?? {})) {
    const targetSpawnId = oppositeDirection[direction] ?? 'default';
    const door = layout.doors?.[targetSpawnId];
    const spawn = layout.spawns?.[targetSpawnId];

    if (door === undefined) {
      issues.push(error(`procedural_level_overrides.${stageId}.runtime_layout.doors.${targetSpawnId}`, `Missing ${targetSpawnId} door for ${direction} neighbor.`));
      continue;
    }

    if (spawn === undefined) {
      issues.push(error(`procedural_level_overrides.${stageId}.runtime_layout.spawns.${targetSpawnId}`, `Missing ${targetSpawnId} spawn for ${direction} neighbor.`));
      continue;
    }

    if (!isFiniteVector(door) || !isFiniteVector(spawn)) {
      issues.push(error(`procedural_level_overrides.${stageId}.runtime_layout.${targetSpawnId}`, `${targetSpawnId} door/spawn must use finite coordinates.`));
      continue;
    }

    const distance = distanceBetween(door, spawn);
    if (distance < minSpawnDoorDistance) {
      issues.push(error(`procedural_level_overrides.${stageId}.runtime_layout.spawns.${targetSpawnId}`, `${targetSpawnId} spawn is ${distance.toFixed(1)}px from its door; minimum is ${minSpawnDoorDistance}px.`));
    }
  }

  issues.push(...validateContentIds(layout.content ?? {}, stageId));

  const activeDoors = Object.keys(level.neighbors ?? {})
    .map((direction) => layout.doors?.[direction])
    .filter((position): position is Vector2 => position !== undefined && isFiniteVector(position));
  const markers = flattenContentMarkers(layout.content ?? {});

  for (const marker of markers) {
    const position = marker.position;
    if (!isVectorLike(position) || !isFiniteVector(position)) {
      issues.push(error(`procedural_level_overrides.${stageId}.runtime_layout.content.${marker.id}`, `Content marker ${marker.id} must use finite coordinates.`));
      continue;
    }

    for (const door of activeDoors) {
      const distance = distanceBetween(position, door);
      if (distance < doorSafeRadius) {
        issues.push(error(`procedural_level_overrides.${stageId}.runtime_layout.content.${marker.id}`, `Content marker ${marker.id} is inside a ${doorSafeRadius}px door safe radius.`));
      }
    }
  }

  return issues;
}

function validateContentIds(content: RuntimeContent, stageId: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenIds = new Set<string>();

  for (const collectionName of contentCollections) {
    const collection = content[collectionName] ?? [];
    for (const marker of collection) {
      const markerId = String(marker.id ?? '');
      if (markerId.length === 0) {
        issues.push(error(`procedural_level_overrides.${stageId}.runtime_layout.content.${collectionName}`, `${collectionName} marker is missing id.`));
        continue;
      }

      if (seenIds.has(markerId)) {
        issues.push(error(`procedural_level_overrides.${stageId}.runtime_layout.content.${collectionName}.${markerId}`, `Duplicate content id ${markerId}.`));
      }
      seenIds.add(markerId);
    }
  }

  return issues;
}

function flattenContentMarkers(content: RuntimeContent): Array<JsonObject & { id: string; position?: unknown }> {
  return contentCollections.flatMap((collectionName) =>
    (content[collectionName] ?? []).map((marker) => ({
      ...marker,
      id: String(marker.id ?? `${collectionName}.unknown`),
      position: marker.position,
    })),
  );
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isVectorLike(value: unknown): value is Vector2 {
  return typeof value === 'object' && value !== null && 'x' in value && 'y' in value;
}

function isFiniteVector(value: Vector2): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y);
}

function distanceBetween(left: Vector2, right: Vector2): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function error(path: string, message: string): ValidationIssue {
  return { severity: 'error', path, message };
}

function dedupeIssues(issues: ValidationIssue[]): ValidationIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.severity}:${issue.path}:${issue.message}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
