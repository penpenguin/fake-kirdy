import type { AreaDefinition, AreaTransitionDirection } from '../AreaManager';
import { centralHub } from './central-hub';
import { mirrorCorridor } from './mirror-corridor';
import { iceArea } from './ice-area';
import { forestArea } from './forest-area';
import { caveArea } from './cave-area';
import { fireArea } from './fire-area';
import { goalSanctum } from './goal-sanctum';

export const STAGE_DEFINITIONS: ReadonlyArray<AreaDefinition> = [
  centralHub,
  mirrorCorridor,
  iceArea,
  forestArea,
  caveArea,
  fireArea,
  goalSanctum,
];

const TRANSITIONS: AreaTransitionDirection[] = ['north', 'south', 'east', 'west'];

export function cloneStageDefinition(definition: AreaDefinition): AreaDefinition {
  const layout = [...definition.layout];
  const neighbors = { ...definition.neighbors };

  const entryPoints: AreaDefinition['entryPoints'] = {
    default: {
      position: { ...definition.entryPoints.default.position },
      ...(definition.entryPoints.default.facing ? { facing: definition.entryPoints.default.facing } : {}),
    },
  };

  TRANSITIONS.forEach((direction) => {
    const point = definition.entryPoints[direction];
    if (point) {
      entryPoints[direction] = {
        position: { ...point.position },
        ...(point.facing ? { facing: point.facing } : {}),
      };
    }
  });

  const enemySpawns = definition.enemySpawns
    ? {
        baseline: definition.enemySpawns.baseline,
        maxActive: definition.enemySpawns.maxActive,
        entries: definition.enemySpawns.entries.map((entry) => ({ ...entry })),
      }
    : undefined;

  return {
    ...definition,
    layout,
    neighbors,
    entryPoints,
    enemySpawns,
  } satisfies AreaDefinition;
}
