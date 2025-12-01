import type { AreaDefinition, AreaTransitionDirection } from '../AreaManager';
import { centralHub } from './central-hub';
import { mirrorCorridor } from './mirror-corridor';
import { iceArea } from './ice-area';
import { forestArea } from './forest-area';
import { caveArea } from './cave-area';
import { fireArea } from './fire-area';
import { goalSanctum } from './goal-sanctum';
import { skySanctum } from './sky-sanctum';
import { auroraSpire } from './aurora-spire';
import { starlitKeep } from './starlit-keep';
import { PROCEDURAL_STAGE_DEFINITIONS } from './procedural';
import { forestReliquary } from './forest-reliquary';
import { iceReliquary } from './ice-reliquary';
import { fireReliquary } from './fire-reliquary';
import { ruinsReliquary } from './ruins-reliquary';
import { forestBoss } from './forest-boss';
import { iceBoss } from './ice-boss';
import { fireBoss } from './fire-boss';
import { ruinsBoss } from './ruins-boss';

export const STAGE_DEFINITIONS: ReadonlyArray<AreaDefinition> = [
  centralHub,
  mirrorCorridor,
  iceArea,
  forestArea,
  caveArea,
  fireArea,
  goalSanctum,
  skySanctum,
  auroraSpire,
  starlitKeep,
  forestReliquary,
  forestBoss,
  iceReliquary,
  iceBoss,
  fireReliquary,
  fireBoss,
  ruinsReliquary,
  ruinsBoss,
  ...PROCEDURAL_STAGE_DEFINITIONS,
];

const TRANSITIONS: AreaTransitionDirection[] = [
  'north',
  'south',
  'east',
  'west',
  'northeast',
  'northwest',
  'southeast',
  'southwest',
];

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

  const metadata = definition.metadata
    ? {
        cluster: definition.metadata.cluster,
        index: definition.metadata.index,
        difficulty: definition.metadata.difficulty,
      }
    : undefined;

  const doors = definition.doors?.map((door) => ({
    ...door,
    tile: { ...door.tile },
    position: { ...door.position },
  }));

  const deadEnds = definition.deadEnds?.map((deadEnd) => ({
    ...deadEnd,
    tile: { ...deadEnd.tile },
    position: { ...deadEnd.position },
  }));

  const goal = definition.goal
    ? {
        doorId: definition.goal.doorId,
        texture: definition.goal.texture,
        resultOverlayKey: definition.goal.resultOverlayKey,
        scoreBonus: definition.goal.scoreBonus,
      }
    : undefined;

  return {
    ...definition,
    doorBuffer: definition.doorBuffer,
    layout,
    neighbors,
    entryPoints,
    enemySpawns,
    metadata,
    doors,
    deadEnds,
    goal: goal ?? null,
  } satisfies AreaDefinition;
}
